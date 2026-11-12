# GitHub Pages 訪客後台

狀態（2026-11-12）：資料庫與持續保留 migration 已完成，8 張資料表啟用 RLS，anon 與 authenticated 無 analytics_rpc 的 EXECUTE 權限。Google OAuth 已由擁有者建立並填入 Supabase，已透過公開 Auth 設定確認 Google provider 啟用；管理者 email 亦已依擁有者確認更新。公開連線設定已填妥，尚未完成真實登入測試。

訪客收集保持停用，先發布 `/admin/` 以便在正式 GitHub origin 測試 Google 登入。hosted 路徑修正已部署；線上探測確認帶公開 publishable key 可取得 ticket，未登入讀取統計仍為 401。新增路徑回歸測試、PGlite 權限與持續保存測試、TypeScript 檢查與正式建置皆通過。tracker 已補上公開 key header，gateway 驗證維持開啟。真實 OAuth、可信 IP／國家與同意流程仍需線上驗證，完成後才開啟收集。

網站擁有者已於 2026-11-12 明確指定：完整 IP、瀏覽明細與累計人數全部持續保留。更新 migration 移除 IP／明細／稽核／工作階段／每日訪客索引的到期清理，歷史查詢不再限於最近 90 天。僅短效防濫用計數器會清理；不建立刪除訪客歷史的 Cron 工作。

## 架構

- `/admin/`：GitHub Pages 上的靜態 React 後台，以 Google 登入，權限由伺服器判定。
- `analytics.js`：中英文訪客同意介面，取得同意後才傳送瀏覽紀錄；尊重 DNT／GPC。
- Supabase Edge Function：驗證登入、固定管理者身分、限制寫入頻率、遮罩與加密 IP。
- Supabase PostgreSQL：瀏覽明細、日統計、匿名訪客索引；不公開給瀏覽器直接查詢。

資料無法判斷訪客真實姓名。不重複訪客依同意後的瀏覽器識別碼估算，跨裝置、清除儲存空間、拒絕追蹤或阻擋程式都會影響統計。日期以臺北時區計算；不回填啟用前的紀錄。

## 完成帳號與正式連接

1. 由網站擁有者在 Supabase 官方介面登入，建立專用專案；不要把密碼或登入驗證碼貼到對話。
2. 新專案依序執行 `supabase/migrations/202611120001_analytics.sql` 與 `202611120002_keep_analytics_history.sql`；已完成初始 migration 的專案只執行第二份更新。資料表位於 `analytics_private`，`anon` 與 `authenticated` 沒有讀表或執行 RPC 的權限。
3. 在 Supabase Auth 啟用 Google provider。建立 Google OAuth Web client，把 Supabase 顯示的 callback URL 加到 Google Cloud；client secret 僅填入 Supabase，不放進 GitHub。
4. Supabase Auth 的 Site URL 與允許回跳網址設定為 `https://tutminchai.github.io/minchaihsieh/admin/`，不使用萬用字元。正式啟用前確認 Google OAuth 發布狀態與獲准使用者。
5. Edge Function 設定 `ADMIN_EMAIL` 為擁有者確認的 Google 登入 email，並安全產生至少 32 字元的 `ANALYTICS_SECRET`。Supabase 自動提供其標準 URL、anon key 及 service-role key 環境變數；所有高權限金鑰僅能留在伺服器。不要任意輪替加密密鑰，否則既有加密 IP 會無法讀取。
6. 部署 `analytics` function，採用 `supabase/config.toml` 並維持 gateway 驗證開啟。tracker 以公開 publishable key 呼叫 ticket／collect。每個管理者 API 另向 Auth 驗證 bearer token、已確認 email 與固定 user ID；公開 key 不代表管理者權限。第一次合法管理者登入會固定其 user ID。正式 OAuth 測試需確認目前 Auth JWT 與 gateway 相容。
7. 在 `admin-src/config.ts` 填專案 URL 與 **publishable key 或 legacy anon key**，不能使用 secret／service-role key。執行 `npm ci`、`npm run check`、`npm test`、`npm run build`。建置會拒絕高權限金鑰。
8. `analytics-config.js` 填入公開 endpoint 與 publishable key，仍保留 `enabled:false`，直到下列正式測試全部通過。

## 上線前測試

- 在最終 GitHub origin 完成 Google 登入與回跳，確認僅擁有者可讀取報表。未登入、其他 Google 帳號、假 token、偽造登入標頭皆無法讀取資料。
- 確認拒絕同意不送出紀錄、同意後只計一次、重播 ticket 不重算、撤回立即停止、手機與桌面登入及登出正常。
- 確認 Supabase gateway 實際傳入可信的 `cf-connecting-ip`，不能接受訪客偽造同名標頭。未確認前不得宣稱完整 IP 功能已可用；無可信 IP 時顯示無資料。
- 國家只取已驗證 gateway 的 `cf-ipcountry`，不是瀏覽器語系或伺服器所在地。城市／縣市目前留空，不猜測。若要求城市資料，需另外評估並接入可信 IP 定位來源。
- 驗證預設列表及 CSV 僅遮罩 IP，完整 IP 只能由管理者單筆查看且留下存取紀錄。
- 完整 IP 加密持續保存；瀏覽明細、稽核、工作階段與匿名累計亦持續保留。後台可選全部或自訂歷史日期。訪客同意說明須如實呈現無自動到期期限，撤回只停止未來收集，不會自動刪除既有資料。不得建立自動刪除歷史紀錄的排程。
- 先發布 `/admin/` 與前台入口，供最終網址登入測試；收集保持停用。通過正式測試後才將 `enabled` 設為 `true`。若測試未通過，保持停用；保留舊版後台。

## 本機驗證範圍

`npm test` 使用 PGlite 執行實際 PostgreSQL migration，檢查資料庫權限、重複事件與原子計數、登入拒絕、管理者固定、IP 加密遮罩、超過十年的歷史 IP／明細持續可查及篩選。Auth 網路回覆在本機測試中模擬；不能取代真實 OAuth、部署權限及 gateway 資料測試。

## 更新

修改 `admin-src/` 後必須重新建置並一起提交 `admin/`。公開主頁仍為既有 `index.html`、`en.html`，本工具不重新產生個人履歷內容。英文頁沿用 `tools/build-english.py`，由中文頁保留管理者入口及追蹤程式標籤。

