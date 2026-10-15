# MS.BROW · 美睫師考核排名

事業一部每月考核排名網頁。現在是 **Google Apps Script 網頁應用程式**：伺服端直接讀雲端硬碟「薪資單」資料夾裡每月的試算表，
新月份的薪資單建好後網頁就會自動出現，不用再手動匯出 xlsx、更新 `data.json`。

- **網址**：https://script.google.com/macros/s/AKfycbysswFGv-ErRkaMmv0-fYc3fFHqe831pbfwfCk3ta0rytf7Np6iDq9TpyQK5ZPneCXDuA/exec
- Apps Script 專案（擁有者 003@msbrow.com）：https://script.google.com/d/1DPoZxx81wyslaRGXDbP79koMhjOxndapnXmzJCyKQjA5SaxR6YgjhIpq/edit

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
5. **只顯示 `gas/Config.gs` 的 `MIN_MONTH`（目前 `2026-01`）起的月份**，更早的薪資單不讀也不列出。要看新的一年時改這個值即可。
6. **排名只列「最新月份」有出現的美睫師**：最新月份沒有的人視為已離職，各月排名、趨勢圖與累積總排名都不列入（名次會重新計算）。
   「團隊合計」不受影響，仍是該月全部美睫師（含已離職者）的加總，副標會註明「含 N 位已離職」。
7. **年度累積總排名**：以所選月份那一年、目前有資料的各月為範圍，依各月達標率的**平均**排序（只算有達標率的月份，並標示月數），
   六項數據為各月加總，另列「前三名次數」。
8. 密碼在伺服端驗證：先看指令碼屬性 `PASSWORD`，沒有設定時用 `gas/Config.gs` 的 `DEFAULT_PASSWORD`（`msbrow2026`）。
9. 網頁以**部署者的身分**執行（`executeAs: USER_DEPLOYING`，`access: ANYONE_ANONYMOUS`）：看的人不需要 Google 帳號，
   也碰不到試算表本身。腳本只要求 `drive.readonly` 與 `spreadsheets.readonly` 兩個唯讀權限。
   因此試算表是用 **Sheets 進階服務（Sheets API v4）** 讀的，不是 `SpreadsheetApp.openById`——後者一定要完整的 `spreadsheets` 權限，
   會出現「指定的權限不足」。每個檔案只需兩次 API 呼叫（工作表清單 + 一次 `batchGet`）。

## 每月要做的事

什麼都不用。薪資單建好、「一部考核總表」算好之後，打開網址（或按右上角「重新整理資料」）就會看到新月份。
只要注意：檔名要是 `薪資單_2.2_26/10` 這種格式、個人工作表 E3 的日期范围要是該月。
新月份出現後，「在職名單」會自動以新月份為準；到了新的一年，把 `gas/Config.gs` 的 `MIN_MONTH` 改成 `2027-01` 再重新部署。

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

開 http://localhost:5191 ，密碼 `msbrow2026`，資料用 `source/months.json`（本機的解析結果，已被 git 忽略），
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

## 歷史

2026-10-15 之前曾有一版 GitHub Pages 靜態網站（加密的 `data.json` 需手動更新），已下架並移除；此 repo 現在只放 Apps Script 版。
