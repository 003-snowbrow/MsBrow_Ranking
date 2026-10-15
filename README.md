# MS.BROW · 美睫師考核排名（密碼保護網站）

事業一部每月考核排名網頁。資料來自每月薪資單的「一部考核總表」，以密碼加密後放在 `data.json`，
網頁在瀏覽器中用密碼解密才看得到內容（AES-256-GCM，金鑰由 PBKDF2-SHA256 推導，30 萬次迭代）。
沒有密碼的人即使打開 GitHub 專案也只會看到一串亂碼。

- 網站：https://003-snowbrow.github.io/MsBrow_Ranking/
- 專案：https://github.com/003-snowbrow/MsBrow_Ranking

## 檔案

| 檔案 | 用途 |
|---|---|
| `index.html` | 整個網站（密碼閘門、排名、趨勢圖、更新面板） |
| `data.json` | 加密後的資料檔。**只有這個檔會隨月份更新** |
| `tools/parse_kaohe.py` | 從薪資單 .xlsx 讀出「一部考核總表」A1:S40 → JSON |
| `tools/build_months.py` | 把 `source/months/*.json` 整理成 `source/months.json` |
| `tools/encrypt.mjs` / `tools/decrypt.mjs` | 用密碼加密 / 驗證 `data.json` |
| `source/` | 原始（未加密）資料，**不會上傳到 GitHub**（已列在 .gitignore） |

## 每月更新（三種方式擇一）

**A. 在網站上操作（最簡單）**
1. 在 Google 試算表開啟當月薪資單 →「檔案 → 下載 → Microsoft Excel (.xlsx)」。
2. 開網站 → 右上角「更新資料」→ 把 .xlsx 拖進去 → 確認月份與預覽 →「套用並下載 data.json」。
3. 到 GitHub 專案，覆蓋 `data.json`（點進檔案 → Edit 或 Upload files → Commit changes）。約一分鐘後網站更新。

**B. 請 Claude 做**
把 .xlsx（或雲端硬碟連結）給 Claude，請它更新 `MsBrow_Ranking` 的 `data.json` 並推送。

**C. 在電腦上用指令**
```bash
cd ~/ms-brow-kaohe-ranking
python3 tools/parse_kaohe.py 薪資單_2.2_26_10.xlsx source/months/26-10.json   # 需要 openpyxl
python3 tools/build_months.py
KAOHE_PASSWORD='目前密碼' node tools/encrypt.mjs
git add data.json && git commit -m "2026-10 考核資料" && git push
```

## 變更密碼

網站「更新資料」→「變更密碼」會下載一份用新密碼加密的 `data.json`，覆蓋到 GitHub 後所有人都要用新密碼。
用指令的話：`KAOHE_PASSWORD='新密碼' node tools/encrypt.mjs` 再推送。

## 本機預覽

```bash
cd ~/ms-brow-kaohe-ranking && python3 -m http.server 5190
```
開 http://localhost:5190 。加密功能需要 https 或 localhost，直接雙擊 index.html 無法解鎖。

## 資料格式（解密後）

`{ months: [ { month: "2026-09", label, source, range, importedAt, staff: [ { name, level, clients, newClients, members, walkIn, ig, google, photoRate, score, parts: { ig, google, member, walkIn, volume, photo } } ] } ], generatedAt }`

- `score` = 達標率（排名依據）；`parts` 為達標率的五個組成（各滿分 0.2，`walkIn` 或 `volume` 擇一）。
- 試算表中 `#DIV/0!` 之類無法計算的值存為 `null`，該美睫師排在最後。
