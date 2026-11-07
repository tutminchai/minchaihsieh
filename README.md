# 謝旻儕個人網站

公開網站：https://tutminchai.github.io/minchaihsieh/

以 HTML、CSS、JavaScript 製作的響應式個人網站，透過 GitHub Pages 的 main 分支根目錄發布。

## 網站內容

- 個人簡介、學歷、經歷及榮譽
- 研究計畫與主題篩選
- 六本專書
- 教學領域及合作單位
- 聯絡資訊：shiehminchai@gmail.com

履歷與專書資料參考 https://sites.google.com/site/minchaihsieh/ 及本人提供的履歷。專書「AR 擴增實境輕鬆學」出版年依 Google 個人網站為 2021。

## 設計與維護

白底、墨藍及朱紅的日系編輯排版。未使用人物照片、學生作品或學術論文列表。書籍圖片保留原始封面；兩本附白色背景的書封以 CSS 輪廓遮罩移除外側白邊，避免生成式處理改動原封面的作者或書名。六本書封統一顯示高度與底線。

主要內容位於 index.html，排版位於 styles.css，導覽與研究篩選位於 script.js。圖片只用於本人網站介紹，不另行授予轉用權利。

## 本機預覽

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

在瀏覽器開啟 http://127.0.0.1:8765 。部署不需安裝套件或執行建置。
