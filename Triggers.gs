// ============================================================
// Triggers.gs — Quản lý time-based trigger hằng ngày
// Phụ thuộc: Config.gs, Planning.gs, Forecast.gs, Dashboard.gs, Telegram.gs
// ============================================================

var TRIGGER_FUNC = 'chayHangNgay';

// ─────────────────────────────────────────────────────────────
// CÀI TRIGGER (idempotent)
// ─────────────────────────────────────────────────────────────

/**
 * Cài trigger chạy chayHangNgay() lúc 7h sáng hằng ngày.
 * Xóa trigger cũ cùng tên trước khi tạo mới → không bao giờ trùng.
 */
function caiTrigger() {
  // Xóa tất cả trigger hiện có với tên hàm 'chayHangNgay'
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === TRIGGER_FUNC) {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Tạo trigger mới
  ScriptApp.newTrigger(TRIGGER_FUNC)
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();

  SpreadsheetApp.openById(SPREADSHEET_ID)
    .toast('Đã cài trigger 7h sáng hằng ngày', 'LAVIPCO QLDT', 5);
}

// ─────────────────────────────────────────────────────────────
// GỠ TRIGGER
// ─────────────────────────────────────────────────────────────

/**
 * Xóa tất cả trigger của project.
 */
function goTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  SpreadsheetApp.openById(SPREADSHEET_ID)
    .toast('Đã gỡ tất cả trigger', 'LAVIPCO QLDT', 5);
}

// ─────────────────────────────────────────────────────────────
// HÀM CHẠY HẰNG NGÀY (entry point của trigger)
// ─────────────────────────────────────────────────────────────

/**
 * Được trigger gọi lúc 7h sáng.
 * Không dùng getActiveSpreadsheet() vì trigger chạy không có UI context.
 */
function chayHangNgay() {
  // Khởi tạo _ss cache bằng openById để tất cả helper trong Utils.gs
  // đều dùng cùng 1 Spreadsheet object — tránh openById() nhiều lần.
  _ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  var loi = [];

  try { capNhatQuaHan(); }
  catch (e) { loi.push('capNhatQuaHan: ' + e.message); Logger.log(e); }

  try { capNhatForecast(); }
  catch (e) { loi.push('capNhatForecast: ' + e.message); Logger.log(e); }

  try { capNhatDashboard(); }
  catch (e) { loi.push('capNhatDashboard: ' + e.message); Logger.log(e); }

  try { guiCanhBaoTongHop(); }
  catch (e) { loi.push('guiCanhBaoTongHop: ' + e.message); Logger.log(e); }

  if (loi.length > 0) {
    Logger.log('chayHangNgay có lỗi:\n' + loi.join('\n'));
  } else {
    Logger.log('chayHangNgay hoàn tất: ' + new Date().toISOString());
  }
}
