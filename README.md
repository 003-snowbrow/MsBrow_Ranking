# MS.BROW · 美睫師考核排名

事業一部每月考核排名網頁。現在是 **Google Apps Script 網頁應用程式**：伺服端直接讀雲端硬碟「薪資單」資料夾裡每月的試算表，
新月份的薪資單建好後網頁就會自動出現，不用再手動匯出 xlsx、更新 `data.json`。

- **網址**：https://script.google.com/macros/s/AKfycbysswFGv-ErRkaMmv0-fYc3fFHqe831pbfwfCk3ta0rytf7Np6iDq9TpyQK5ZPneCXDuA/exec
- Apps Script 專案（擁有者 003@msbrow.com）：https://script.google.com/d/1DPoZxx81wyslaRGXDbP79koMhjOxndapnXmzJCyKQjA5SaxR6YgjhIpq/edit
- 舊版 GitHub Pages 網站（手動更新 `data.json`）：https://003-snowbrow.github.io/MsBrow_Ranking/ ，去留見文末

## 運作方式

1. 掃描雲端硬碟資料夾 `1L7GsmJYGjmi2GkENduBtW1_pLiAPtD5d`（「薪資單」）裡的 **Google 試算表**，只看標題是
   `薪資單_<版本>_YY/MM` 的檔案（例如 `薪資單_2.2_26/10`）。標題含「測試」的略過；舊的 .xlsx 檔不讀。
2. 每個檔案讀「**一部考核總表**」（至少 A1:S45，表格更大會讀到最後一欄／列）：第 2 列是等級、第 3 列是名字（D 欄起；C 欄的部長不列入排名），
   A 欄標籤對應各項數據（當月客數、當月新客數、當月入會客數、現場預約客數、IG分享數、Google好評、微信照片上傳率、達標率，
   以及達標率組成 IG分享／新客google好評率／新客入會率／現場預約率／客量／紀錄照上傳率）。
3. **月份以個人工作表 E3 的「日期范围」為準**（A1 含「员工业绩统计表」的那些分頁）。跟檔名不一致的檔案會跳過，
   並在網頁月份列下方「有 N 個薪資單檔案未納入排名」列出原因。同一月份有多個檔案時，取**最後修改時間最新**的那個。
4. 每個檔案的解析結果快取在 Apps Script 的「指令碼屬性」（鍵 `kaohe:<fileId>`，記錄檔案的 lastUpdated），
   只有檔案有修改才會重讀，所以平常開網頁只要一兩秒；第一次或很多檔案同時改過時要十幾秒。
5. 密碼在伺服端驗證：先看指令碼屬性 `PASSWORD`，沒有設定時用 `gas/Config.gs` 的 `DEFAULT_PASSWORD`（`msbrow2026`）。
6. 網頁以**部署者的身分**執行（`executeAs: USER_DEPLOYING`，`access: ANYONE_ANONYMOUS`）：看的人不需要 Google 帳號，
   也碰不到試算表本身。腳本只要求 `drive.readonly` 與 `spreadsheets.readonly` 兩個唯讀權限。
   因此試算表是用 **Sheets 進階服務（Sheets API v4）** 讀的，不是 `SpreadsheetApp.openById`——後者一定要完整的 `spreadsheets` 權限，
   會出現「指定的權限不足」。每個檔案只需兩次 API 呼叫（工作表清單 + 一次 `batchGet`）。

## 每月要做的事

什麼都不用。薪資單建好、「一部考核總表」算好之後，打開網址（或按右上角「重新整理資料」）就會看到新月份。
只要注意：檔名要是 `薪資單_2.2_26/10` 這種格式、個人工作表 E3 的日期范围要是該月。

## 變更密碼

1. 開 [Apps Script 專案](https://script.google.com/d/1DPoZxx81wyslaRGXDbP79koMhjOxndapnXmzJCyKQjA5SaxR6YgjhIpq/edit) → 左側齒輪「專案設定」→ 最下方「指令碼屬性」
2. 「新增指令碼屬性」：屬性 `PASSWORD`、值填新密碼 → 「儲存指令碼屬性」
3. 立即生效，不用重新部署。拿舊密碼的人（包括勾了「記住這台裝置」的）下次開網頁會被要求重新輸入。

> 不要只改 `gas/Config.gs` 的 `DEFAULT_PASSWORD`：這個專案是公開的 GitHub repo，寫在那裡的值等於公開。
> 它只是「還沒設定指令碼屬性時」的預設值，建議部署後就到指令碼屬性設一組正式密碼。

## 改程式後重新部署

```bash
cd ~/ms-brow-kaohe-ranking/gas
clasp push --force
clasp redeploy AKfycbysswFGv-ErRkaMmv0-fYc3fFHqe831pbfwfCk3ta0rytf7Np6iDq9TpyQK5ZPneCXDuA -d "改了什麼"
```

網址不會變。改了 `Code.gs` 的解析邏輯時，把 `PARSER_VERSION` 加一，所有檔案會重新解析（否則會沿用舊快取）。
clasp 登入過期時（`clasp list` 回 `invalid_rapt`）先跑 `clasp login`，用 003@msbrow.com 登入。

如果改了 `appsscript.json` 的 `oauthScopes`，部署者要重新授權一次：開
[Apps Script 編輯器](https://script.google.com/d/1DPoZxx81wyslaRGXDbP79koMhjOxndapnXmzJCyKQjA5SaxR6YgjhIpq/edit)
→ 函式選 `doGet` → 執行 → 審查權限 → 允許（直接開 /exec 網址有時只會看到「需要存取權」，從編輯器執行最保險）。
在授權完成前，所有人開網址都會看到「需要存取權」。

## 本機預覽（不連 Google）

```bash
python3 tools/preview_gas.py
```

開 http://localhost:5191 ，密碼 `msbrow2026`，資料用 `source/months.json`（舊版留下的解析結果，已被 git 忽略），
`google.script.run` 由 `tools/preview_gas.py` 模擬。

## 檔案

| 檔案 | 用途 |
|---|---|
| `gas/Code.gs` | `doGet`、`getData(password)`、掃描資料夾、解析「一部考核總表」、快取 |
| `gas/Config.gs` | 資料夾 ID、預設密碼、工作表名稱與讀取範圍上限 |
| `gas/index.html` | 整個前端（密碼閘門、排名、趨勢圖、重新整理、登出） |
| `gas/appsscript.json` | 時區、權限範圍、網頁應用程式設定 |
| `gas/.clasp.json` | clasp 對應的 scriptId |
| `tools/preview_gas.py` | 本機預覽伺服器 |
| `index.html`、`data.json`、`tools/parse_kaohe.py`、`tools/build_months.py`、`tools/encrypt.mjs`、`tools/decrypt.mjs` | **舊版** GitHub Pages 網站與其工具 |

## 資料格式（`getData` 回傳）

```
{ ok: true,
  months: [ { month: "2026-09", label, source: "薪資單_2.2_26/09", fileId, range, updatedAt, importedAt, warnings: [],
              staff: [ { name, level, clients, newClients, members, walkIn, ig, google, photoRate, score,
                         parts: { ig, google, member, walkIn, volume, photo } } ] } ],
  generatedAt, skipped: [ { name, reason } ], files, parsed }
```

- `score` = 達標率（排名依據）；`parts` 為達標率的五個組成（各滿分 0.2，`walkIn` 或 `volume` 擇一）。
- 試算表中 `#DIV/0!` 之類無法計算的值存為 `null`，該美睫師排在最後，並在網頁上方提示。
- 密碼錯誤回 `{ ok: false, error: "bad_password" }`。

## 舊版 GitHub Pages 網站怎麼辦

舊版（https://003-snowbrow.github.io/MsBrow_Ranking/ ）還能開，但**不會自動更新**，密碼也和新版分開管理，久了會不同步。

- **下架（建議）**：GitHub 專案 → Settings → Pages → Source 選「None」。repo 裡的 `index.html`、`data.json` 可以留著當紀錄，也可以一併刪掉。
- **保留**：當備援用，資料要照下面的舊流程手動更新。

<details>
<summary>舊版更新流程（只在保留 GitHub Pages 版時需要）</summary>

資料以密碼加密後放在 `data.json`（AES-256-GCM，PBKDF2-SHA256 30 萬次迭代），網頁在瀏覽器中解密。

1. 在 Google 試算表開啟當月薪資單 →「檔案 → 下載 → Microsoft Excel (.xlsx)」。
2. 開舊版網站 → 右上角「更新資料」→ 把 .xlsx 拖進去 → 確認月份與預覽 →「套用並下載 data.json」。
3. 到 GitHub 專案覆蓋 `data.json` 並 Commit。約一分鐘後網站更新。

用指令：

```bash
cd ~/ms-brow-kaohe-ranking
python3 tools/parse_kaohe.py 薪資單_2.2_26_10.xlsx source/months/26-10.json   # 需要 openpyxl
python3 tools/build_months.py
KAOHE_PASSWORD='目前密碼' node tools/encrypt.mjs
git add data.json && git commit -m "2026-10 考核資料" && git push
```

變更舊版密碼：網站「更新資料」→「變更密碼」會下載一份用新密碼加密的 `data.json`，覆蓋到 GitHub；或 `KAOHE_PASSWORD='新密碼' node tools/encrypt.mjs`。
本機預覽：`python3 -m http.server 5190` 後開 http://localhost:5190 。

</details>
