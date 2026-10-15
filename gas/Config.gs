/**
 * 設定值。真正的密碼請放在 Apps Script「專案設定 → 指令碼屬性」的 PASSWORD，
 * 這裡的 DEFAULT_PASSWORD 只在尚未設定該屬性時使用（這個檔案會進入公開的 GitHub 專案）。
 */
const CONFIG = {
  // 雲端硬碟中放每月「薪資單_<版本>_YY/MM」試算表的資料夾
  FOLDER_ID: '1L7GsmJYGjmi2GkENduBtW1_pLiAPtD5d',
  // 尚未在指令碼屬性設定 PASSWORD 時使用的密碼
  DEFAULT_PASSWORD: 'msbrow2026',
  // 只顯示這個月份（含）之後的薪資單；更早的檔案完全不讀
  MIN_MONTH: '2026-01',
  // 要讀的工作表與範圍（至少讀到 A1:S45；表格更大時會自動讀到最後一欄／列）
  SUMMARY_SHEET: '一部考核總表',
  MIN_ROWS: 45,
  MIN_COLS: 19,
  MAX_ROWS: 120,
  MAX_COLS: 60,
  // 頁面標題
  TITLE: 'MS.BROW 美睫師考核排名',
};
