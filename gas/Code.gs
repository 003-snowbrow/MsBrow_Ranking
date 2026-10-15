/**
 * MS.BROW 美睫師考核排名 — Apps Script 網頁應用程式後端
 *
 * - doGet()          回傳前端 index.html
 * - getData(password) 驗證密碼後，讀取雲端硬碟資料夾內每月的「薪資單_<版本>_YY/MM」試算表，
 *                    回傳與舊版 data.json（解密後）相同結構的 months 陣列
 *
 * 只有 doGet 與 getData 可以從網頁呼叫；其他函式名稱都以「_」結尾（私有）。
 * 每個檔案的解析結果以 fileId 為鍵、lastUpdated 為版本，快取在指令碼屬性，只重讀有變動的檔案。
 *
 * 試算表用 Sheets 進階服務（Sheets API v4）讀取，而不是 SpreadsheetApp：
 * SpreadsheetApp.openById 需要完整的 spreadsheets 權限，Sheets API 的 get / batchGet 只要 spreadsheets.readonly。
 */

const CACHE_PREFIX = 'kaohe:';
// 解析邏輯有改時把這個數字加一，所有檔案就會重新解析
const PARSER_VERSION = 2;

const ROW_LABELS = {
  clients: '當月客數', newClients: '當月新客數', members: '當月入會客數', walkIn: '現場預約客數',
  ig: 'IG分享數', google: 'Google好評', score: '達標率',
};
const PART_LABELS = {
  ig: 'IG分享', google: '新客google好評率', member: '新客入會率',
  walkIn: '現場預約率', volume: '客量', photo: '紀錄照上傳率',
};
const PHOTO_LABEL = '微信照片上傳率';
const DATE_RANGE_MARK = '员工业绩统计表';

/* ======================= 對外 ======================= */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle(CONFIG.TITLE)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * @param {string} password 使用者輸入的密碼
 * @return {{ok:boolean, error?:string, message?:string, months?:Object[], generatedAt?:string, skipped?:Object[], files?:number, parsed?:number, ignored?:number, minMonth?:string}}
 */
function getData(password) {
  if (!checkPassword_(password)) return { ok: false, error: 'bad_password' };
  try {
    const result = loadMonths_();
    result.ok = true;
    return result;
  } catch (err) {
    console.error(err);
    return { ok: false, error: 'server_error', message: String((err && err.message) || err) };
  }
}

/* ======================= 密碼 ======================= */

function getPassword_() {
  const p = PropertiesService.getScriptProperties().getProperty('PASSWORD');
  return p != null && p !== '' ? p : CONFIG.DEFAULT_PASSWORD;
}

function checkPassword_(input) {
  if (typeof input !== 'string' || !input) return false;
  const expected = getPassword_();
  // 固定時間比較，避免從回應時間推測密碼
  let diff = input.length ^ expected.length;
  for (let i = 0; i < Math.max(input.length, expected.length); i++) {
    diff |= (input.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/* ======================= 讀取雲端硬碟 ======================= */

/**
 * 掃描資料夾、解析（或取快取）每個薪資單，回傳 { months, generatedAt, skipped, files, parsed }
 */
function loadMonths_() {
  const lock = LockService.getScriptLock();
  let locked = false;
  try { locked = lock.tryLock(90 * 1000); } catch (e) { locked = false; }
  try {
    return scanFolder_();
  } finally {
    if (locked) lock.releaseLock();
  }
}

function scanFolder_() {
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperties();
  const folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
  const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);

  const seenKeys = {};
  const byMonth = {};      // month -> { doc, updated, name }
  const skipped = [];
  let fileCount = 0, parsedCount = 0, ignoredCount = 0;

  while (files.hasNext()) {
    const file = files.next();
    const name = String(file.getName()).trim();
    if (name.indexOf('薪資單') < 0) continue;          // 資料夾裡其他試算表
    if (name.indexOf('測試') >= 0) continue;            // 測試檔
    const title = matchTitle_(name);
    if (!title) { skipped.push({ name: name, reason: '檔名不是「薪資單_<版本>_YY/MM」格式' }); continue; }
    if (CONFIG.MIN_MONTH && title.month < CONFIG.MIN_MONTH) { ignoredCount++; continue; }   // 早於 MIN_MONTH 的不讀、不列入

    fileCount++;
    const id = file.getId();
    const updated = file.getLastUpdated().toISOString();
    const key = CACHE_PREFIX + id;
    seenKeys[key] = true;

    let entry = parseCached_(stored[key]);
    if (!entry || entry.u !== updated || entry.v !== PARSER_VERSION) {
      entry = { u: updated, v: PARSER_VERSION };
      let transient = false;
      try {
        const r = parseFile_(id, name, title.month, updated);
        if (r.error) entry.skip = r.error; else entry.doc = r.doc;
      } catch (e) {
        // 權限、配額、暫時性錯誤：回報但不寫入快取，下次再試
        transient = true;
        entry.skip = '讀取失敗：' + String((e && e.message) || e);
        console.error('parse failed for ' + name + ': ' + e);
      }
      parsedCount++;
      if (!transient) {
        try { props.setProperty(key, JSON.stringify(entry)); } catch (e) { console.warn('cache write failed for ' + name + ': ' + e); }
      }
    }

    if (entry.skip) { skipped.push({ name: name, reason: entry.skip }); continue; }

    const doc = entry.doc;
    const cur = byMonth[doc.month];
    if (!cur) {
      byMonth[doc.month] = { doc: doc, updated: updated, name: name };
    } else if (updated > cur.updated) {
      skipped.push({ name: cur.name, reason: '同月份另有較新的檔案「' + name + '」，以較新者為準' });
      byMonth[doc.month] = { doc: doc, updated: updated, name: name };
    } else {
      skipped.push({ name: name, reason: '同月份另有較新的檔案「' + cur.name + '」，以較新者為準' });
    }
  }

  // 清掉已不在資料夾裡的快取
  Object.keys(stored).forEach(function (k) {
    if (k.indexOf(CACHE_PREFIX) === 0 && !seenKeys[k]) props.deleteProperty(k);
  });

  const months = Object.keys(byMonth).sort().map(function (m) { return byMonth[m].doc; });
  skipped.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
  return { months: months, generatedAt: new Date().toISOString(), skipped: skipped, files: fileCount, parsed: parsedCount, ignored: ignoredCount, minMonth: CONFIG.MIN_MONTH || null };
}

function parseCached_(raw) {
  if (!raw) return null;
  try { const v = JSON.parse(raw); return v && typeof v === 'object' ? v : null; } catch (e) { return null; }
}

/** 「薪資單_2.2_26/09」→ { version: '2.2', month: '2026-09' }；不符回傳 null */
function matchTitle_(name) {
  const m = String(name).trim().match(/^薪資單_(\d+(?:\.\d+)*)_(\d{2})[\/／_\-.](\d{2})$/);
  if (!m) return null;
  const mm = Number(m[3]);
  if (mm < 1 || mm > 12) return null;
  return { version: m[1], month: '20' + m[2] + '-' + m[3] };
}

/**
 * 讀一個試算表（Sheets API v4，兩次呼叫：工作表清單 + 一次 batchGet）。回傳 { doc } 或 { error }
 */
function parseFile_(id, name, titleMonth, updatedIso) {
  const meta = Sheets.Spreadsheets.get(id, { fields: 'sheets.properties(title,gridProperties(rowCount,columnCount))' });
  const sheets = (meta.sheets || []).map(function (s) { return s.properties || {}; });
  const norm = function (s) { return String(s).replace(/\s/g, ''); };

  let summary = null;
  for (let i = 0; i < sheets.length; i++) {
    if (norm(sheets[i].title) === CONFIG.SUMMARY_SHEET) { summary = sheets[i]; break; }
  }
  if (!summary) return { error: '找不到「' + CONFIG.SUMMARY_SHEET + '」工作表' };

  // 日期范围的候選工作表：名稱不像總表的先看
  const others = sheets.filter(function (p) { return p !== summary; });
  const looksLikeSummary = function (p) { return /總表|薪資單|工作表/.test(p.title); };
  const candidates = others.filter(function (p) { return !looksLikeSummary(p); })
    .concat(others.filter(looksLikeSummary));

  const grid = summary.gridProperties || {};
  const rows = Math.min(Math.max(CONFIG.MIN_ROWS, grid.rowCount || 0), CONFIG.MAX_ROWS);
  const cols = Math.min(Math.max(CONFIG.MIN_COLS, grid.columnCount || 0), CONFIG.MAX_COLS);
  const ranges = [quoteSheet_(summary.title) + '!A1:' + colLetter_(cols) + rows]
    .concat(candidates.map(function (p) { return quoteSheet_(p.title) + '!A1:E3'; }));
  const res = Sheets.Spreadsheets.Values.batchGet(id, {
    ranges: ranges, valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const valueRanges = res.valueRanges || [];
  const values = (valueRanges[0] && valueRanges[0].values) || [];

  let range = null;
  for (let j = 1; j < valueRanges.length && !range; j++) range = dateRangeFromValues_(valueRanges[j].values || []);
  if (!range) return { error: '找不到個人工作表 E3 的「日期范围」，無法判斷月份' };
  if (range.month !== titleMonth) {
    return { error: '檔名是 ' + titleMonth + '，但內容的日期范围是 ' + range.month + '（' + range.text + '）' };
  }

  const parsed = parseSummary_(values);
  if (parsed.error) return { error: parsed.error };

  const y = Number(range.month.slice(0, 4)), mo = Number(range.month.slice(5, 7));
  return {
    doc: {
      month: range.month,
      label: y + '年' + mo + '月',
      source: name,
      fileId: id,
      range: range.text,
      updatedAt: updatedIso,
      importedAt: new Date().toISOString(),
      importedBy: 'Google 雲端硬碟',
      warnings: parsed.warnings,
      staff: parsed.staff,
    },
  };
}

/**
 * 個人工作表 A1:E3 的值（A1 含「员工业绩统计表」）→ 從 E3「日期范围：2026-09-01 ~ 2026-09-30」取月份
 * Sheets API 會省略尾端空白列／格，所以每一格都要防 undefined。
 */
function dateRangeFromValues_(vals) {
  const a1 = vals[0] && vals[0][0];
  if (typeof a1 !== 'string' || a1.indexOf(DATE_RANGE_MARK) < 0) return null;
  const e3 = vals[2] && vals[2][4];
  let text = e3 == null ? '' : String(e3);
  const m = text.match(/(\d{4})-(\d{2})-\d{2}/);
  if (!m) return null;
  text = text.replace(/^[^：:]*[：:]/, '').trim();
  return { month: m[1] + '-' + m[2], text: text };
}

/** 工作表名稱轉成 A1 表示法可用的形式：'name'（單引號要寫兩次） */
function quoteSheet_(title) { return "'" + String(title).replace(/'/g, "''") + "'"; }

/** 1 → A, 26 → Z, 27 → AA */
function colLetter_(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/* ======================= 解析「一部考核總表」 ======================= */

function toNum_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const s = v.trim().replace(/[%,]/g, '');
    if (s === '') return null;
    const n = Number(s);
    if (!isFinite(n)) return null;          // '#DIV/0!'、'#REF!' 等
    return v.indexOf('%') >= 0 ? n / 100 : n;
  }
  return null;                              // 布林、Date、空白
}
function toCount_(v) {
  const n = toNum_(v);
  if (n == null) return null;
  return Math.abs(n - Math.round(n)) < 1e-9 ? Math.round(n) : Math.round(n * 100) / 100;
}
function toRate_(v) {
  const n = toNum_(v);
  if (n == null) return null;
  return Math.round((n > 1.5 ? n / 100 : n) * 10000) / 10000;
}
function cap_(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

/**
 * @param {Array<Array>} rows getValues() 的結果（第 1 列起）
 * @return {{staff:Object[], warnings:string[]}|{error:string}}
 */
function parseSummary_(rows) {
  const labelRow = {};
  for (let r = 0; r < rows.length; r++) {
    const v = rows[r][0];
    if (typeof v === 'string') {
      const t = v.trim();
      if (t && !(t in labelRow)) labelRow[t] = r;
    }
  }
  const missing = [];
  const need = function (label) { if (!(label in labelRow)) missing.push(label); return labelRow[label]; };
  const opt = function (label) { return label in labelRow ? labelRow[label] : null; };

  const idx = {};
  Object.keys(ROW_LABELS).forEach(function (k) { idx[k] = need(ROW_LABELS[k]); });
  if (missing.length) return { error: '「' + CONFIG.SUMMARY_SHEET + '」A 欄找不到：' + missing.join('、') };
  const pidx = {};
  Object.keys(PART_LABELS).forEach(function (k) { pidx[k] = opt(PART_LABELS[k]); });
  const photoRow = opt(PHOTO_LABEL);

  if (rows.length < 3) return { error: '「' + CONFIG.SUMMARY_SHEET + '」列數不足' };
  const names = rows[2], levels = rows[1];
  const warnings = [], staff = [], seen = {};
  for (let c = 3; c < names.length; c++) {            // D 欄起（C 欄是部長，不列入排名）
    const raw = names[c];
    if (raw == null || String(raw).trim() === '') continue;
    const name = String(raw).trim().toLowerCase();
    if (seen[name]) { warnings.push('名字「' + cap_(name) + '」在第 3 列出現兩次，只保留第一個。'); continue; }
    seen[name] = true;
    const s = { name: name, level: toCount_(levels[c]) };
    ['clients', 'newClients', 'members', 'walkIn', 'ig', 'google'].forEach(function (k) { s[k] = toCount_(rows[idx[k]][c]); });
    s.photoRate = photoRow == null ? null : toRate_(rows[photoRow][c]);
    s.score = toRate_(rows[idx.score][c]);
    s.parts = {};
    Object.keys(pidx).forEach(function (k) { s.parts[k] = pidx[k] == null ? null : toRate_(rows[pidx[k]][c]); });
    if (s.score == null) warnings.push(cap_(name) + ' 的達標率無法讀取（可能是 #DIV/0! 或空白），會排在最後。');
    if (s.clients == null) warnings.push(cap_(name) + ' 的當月客數是空白。');
    staff.push(s);
  }
  if (!staff.length) return { error: '第 3 列從 D 欄起沒有讀到任何美睫師名稱' };
  return { staff: staff, warnings: warnings };
}
