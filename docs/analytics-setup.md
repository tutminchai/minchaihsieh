# GitHub Pages 訪客後台

2026-11-13 自動記錄更新：新訪客不需先按同意，不主動顯示彈窗。移除全部彈窗與同意按鈕；依網站擁有者要求移除頁尾隱私說明連結，保留既有拒絕選擇及 DNT／GPC；加密、管理者驗證與歷史保留不變。前端以 `collection: automatic-v1` 表示記錄模式，不偽造 `consent: true`。需先部署新版 Edge Function，再發布新版前台；ticket 回覆未帶新版能力標記時，新前端不會送出紀錄。

狀態（2026-11-12）：`/admin/` 已正式發布，中英文首頁頁尾皆提供管理者登入入口。已在正式網址完成擁有者 Google 登入、登出與重新登入；訪客收集已於驗證後啟用。Supabase gateway 驗證維持開啟。

2026-11-12 舊版正式瀏覽器驗證：拒絕同意時沒有新增紀錄；同意、重新整理及切換英文頁後，同一瀏覽器累計為 1 位訪客、3 次瀏覽。管理者可查看完整 IP，再恢復遮罩。新增紀錄已能解析國家；定位功能啟用前的首筆測試維持「未提供」，不補造歷史資料。上述為實際測試瀏覽，不代表外部訪客流量。

網站擁有者已指定完整 IP、瀏覽明細與累計人數全部持續保留。資料庫沒有針對這些歷史資料的自動到期刪除；僅短效防濫用計數器會清理。此設定不代表雲端方案提供無限容量或永久託管，維護時仍需留意用量與備份。

## 架構與資料範圍

- `/admin/`：GitHub Pages 上的靜態 React 後台，以 Google 登入，權限由伺服器判定。
- `analytics.js`：中英文頁自動記錄；不注入頁尾連結，尊重既有拒絕選擇及 DNT／GPC。
- Supabase Edge Function：驗證登入、固定管理者身分、限制寫入頻率、遮罩與加密 IP。
- Supabase PostgreSQL：8 張資料表啟用 RLS，位於 `analytics_private`；瀏覽器的 anon／authenticated 角色不能讀表或執行 `analytics_rpc`。
- 國家定位：函式下載 sapics/ip-location-db 的 PDDL `user-country` IPv4／IPv6 MMDB 公開資料，於伺服器本地查詢。資料發布端只收到資料庫下載請求，不會收到訪客 IP。資料庫有快取、下載大小限制、逾時與錯誤重試間隔；查詢失敗仍保留瀏覽紀錄，國家顯示未提供。

資料無法判斷訪客真實姓名。不重複訪客依隨機瀏覽器識別碼估算，跨裝置、清除儲存空間、拒絕追蹤或阻擋程式都會影響統計。日期以臺北時區計算；不回填啟用前的紀錄。

IP 來源採用部署環境提供的 `cf-connecting-ip`，排除已知共用 Worker 位址與無效位址，不使用 `x-forwarded-for` 後備值。實際瀏覽測試已取得來源 IP；此次線上測試未完整證明所有標頭偽造情境，變更代理或 gateway 時須重新確認可信來源邊界。國家由本地 IP 資料庫判定，不採用請求中的國家欄位、瀏覽器語系或伺服器所在地。僅提供概略國家資訊；城市／縣市目前留空，不猜測。

## 部署設定

1. 由網站擁有者在 Supabase 官方介面登入並建立專用專案；不要把密碼或登入驗證碼貼到對話。
2. 新專案依序執行 `supabase/migrations/202611120001_analytics.sql` 與 `202611120002_keep_analytics_history.sql`；已完成初始 migration 的專案只執行第二份更新。後者移除歷史 IP、明細、稽核、工作階段及每日訪客索引的到期清理。
3. 在 Supabase Auth 啟用 Google provider。建立 Google OAuth Web client，把 Supabase 顯示的 callback URL 加到 Google Cloud；client secret 僅填入 Supabase，不放進 GitHub。
4. Supabase Auth 的 Site URL 與允許回跳網址使用 `https://tutminchai.github.io/minchaihsieh/admin/`，不使用萬用字元。Google OAuth 使用基本身分登入範圍。
5. Edge Function 的 `ADMIN_EMAIL` 設為擁有者確認的登入 email，安全產生至少 32 字元的 `ANALYTICS_SECRET`。Supabase 提供其標準 URL、anon key 與 service-role key 環境變數。高權限金鑰只留在伺服器；不要任意輪替加密密鑰，否則既有加密 IP 會無法讀取。
6. 部署 `supabase/functions/analytics/index.ts`，連同 `core.ts` 與 `country.ts`。採用 `supabase/config.toml`，維持 gateway 驗證開啟。tracker 帶公開 publishable key 呼叫 ticket／collect；管理者 API 另外向 Auth 驗證 bearer token、已確認 email 與固定 user ID。公開 key 不代表管理者權限。第一次合法管理者登入會固定其 user ID。
7. 在 `admin-src/config.ts` 填專案 URL 與公開 publishable key 或 legacy anon key，不能使用 secret／service-role key。執行 `npm ci`、`npm run check`、`npm test`、`npm run build`；建置會拒絕高權限金鑰。
8. `analytics-config.js` 填公開 endpoint 與 publishable key。現有正式部署已設為 `enabled:true`。日後換新環境應先停用收集，通過登入、自動記錄、停止記錄及資料檢查後再啟用。

## 已完成驗證（2026-11-12 舊版）

- 正式網站：擁有者 Google 登入與正確回跳、登出與重新登入成功。
- 正式 API：公開 key 可取得 ticket；未登入讀取報表回傳 401。
- 正式收集：拒絕同意不新增資料；同一瀏覽器的中文／英文頁共用訪客計數，頁面瀏覽數分開累計。
- 正式 IP 顯示：預設遮罩，管理者單筆查看完整 IP，再恢復遮罩。
- 正式國家定位：新紀錄取得國家；沒有資料的歷史紀錄保持未提供。
- 本機：PGlite 執行實際 PostgreSQL migration，檢查資料庫權限、重複事件、原子計數、登入拒絕、管理者固定、IP 加密與遮罩，以及超過十年的歷史資料持續可查。
- 本機：hosted 路徑回歸、國家資料庫快取、IPv4／IPv6、無效 IP、下載上限、錯誤重試及不傳送訪客 IP 的測試通過；實際公開 MMDB 的 IPv4／IPv6 解析測試通過。
- TypeScript 檢查與正式建置通過。Vite 更新為 8.3.8；當次依賴安裝稽核回報 0 個弱點。

本機 Auth 回覆使用模擬資料，不取代真實 OAuth；此次正式測試使用擁有者帳號，未另登入其他人的帳號。手機與平板分類保留於程式中，此次正式端對端測試使用桌面瀏覽器。

## 維護

修改 `admin-src/` 後必須重新建置並一起提交 `admin/`。修改 Edge Function 後需另外部署 Supabase，GitHub Pages 發布不會自動更新該函式。

公開主頁仍為既有 `index.html`、`en.html`，本工具不重新產生個人履歷內容。英文頁沿用 `tools/build-english.py`，保留管理者入口與追蹤程式標籤；變更 tracker／設定時一併更新兩頁的快取版本。

完整 IP 加密、瀏覽明細、稽核、工作階段與累計資料持續保留；不建立刪除訪客歷史的 Cron 工作。先前已儲存的停止記錄選擇與 DNT／GPC 只停止未來收集，不會自動刪除既有紀錄。CSV 與預設列表僅提供遮罩 IP，完整 IP 由管理者單筆查看並留下存取紀錄。保留既有後台，不刪除原系統。

國家資料來源：https://github.com/sapics/ip-location-db

