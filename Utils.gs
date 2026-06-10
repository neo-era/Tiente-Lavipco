// ============================================================
// Utils.gs — Thư viện helper dùng chung toàn dự án
// ============================================================

// Cache headerMap theo tên sheet — tồn tại trong suốt 1 lần thực thi GAS
var _headerMapCache = {};

// Cache Spreadsheet object — tránh openById() nhiều lần trong cùng 1 lần thực thi
var _ss = null;

// ------------------------------------------------------------
// SPREADSHEET & SHEET ACCESS
// ------------------------------------------------------------

function getSpreadsheet_() {
  if (!_ss) {
    _ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return _ss;
}

function getSheet_(sheetName) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Không tìm thấy sheet: ' + sheetName);
  return sheet;
}

// ------------------------------------------------------------
// HEADER MAP
// ------------------------------------------------------------

/**
 * Trả về { TenCot: index_0based } cho sheet đã cho.
 * Dùng HEADERS trong Config.gs nếu có, nếu không thì đọc từ sheet.
 * Cache trong _headerMapCache để tránh đọc lại trong cùng 1 lần thực thi.
 */
function headerMap(sheetName) {
  if (_headerMapCache[sheetName]) return _headerMapCache[sheetName];

  var map = {};

  // Ưu tiên dùng HEADERS từ Config.gs (nhanh hơn, không cần đọc sheet)
  if (HEADERS[sheetName]) {
    HEADERS[sheetName].forEach(function(col, i) { map[col] = i; });
  } else {
    // Fallback: đọc hàng 1 từ sheet
    var sheet = getSheet_(sheetName);
    var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    headerRow.forEach(function(col, i) { if (col) map[col] = i; });
  }

  _headerMapCache[sheetName] = map;
  return map;
}

// ------------------------------------------------------------
// READ / WRITE
// ------------------------------------------------------------

/**
 * Đọc toàn bộ hàng dữ liệu (từ hàng 2), trả về array of objects.
 * Bỏ qua hàng trống và hàng có TrangThai = DA_XOA.
 */
function readRows(sheetName) {
  var sheet = getSheet_(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var map = headerMap(sheetName);
  var cols = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, lastRow - 1, cols).getValues();
  var trangThaiIdx = map['TrangThai'];

  return data
    .filter(function(row) {
      // Bỏ hàng trống (cột ID trống)
      if (!row[0]) return false;
      // Bỏ hàng đã xóa
      if (trangThaiIdx !== undefined && row[trangThaiIdx] === TRANG_THAI.DA_XOA) return false;
      return true;
    })
    .map(function(row) {
      var obj = {};
      Object.keys(map).forEach(function(col) {
        obj[col] = row[map[col]];
      });
      return obj;
    });
}

/**
 * Thêm 1 hàng mới vào sheet theo thứ tự header.
 * Giá trị thiếu điền ''.
 */
function appendRow(sheetName, obj) {
  var sheet = getSheet_(sheetName);
  var map = headerMap(sheetName);
  var colCount = Object.keys(map).length;
  var row = new Array(colCount).fill('');

  Object.keys(obj).forEach(function(key) {
    if (map[key] !== undefined) row[map[key]] = obj[key];
  });

  sheet.appendRow(row);
}

/**
 * Cập nhật hàng có cột ID (cột 0) = idValue.
 * Batch: đọc toàn bộ 1 lần, sửa trong memory, ghi lại đúng range.
 */
function updateRow(sheetName, idValue, obj) {
  var sheet = getSheet_(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var map = headerMap(sheetName);
  var cols = sheet.getLastColumn();
  var range = sheet.getRange(2, 1, lastRow - 1, cols);
  var data = range.getValues();

  var targetIdx = -1;
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(idValue)) {
      targetIdx = i;
      break;
    }
  }
  if (targetIdx === -1) throw new Error('Không tìm thấy ID: ' + idValue + ' trong sheet ' + sheetName);

  Object.keys(obj).forEach(function(key) {
    if (map[key] !== undefined) data[targetIdx][map[key]] = obj[key];
  });

  range.setValues(data);
}

/**
 * Soft delete: đặt TrangThai = DA_XOA, không xóa hàng.
 */
function softDelete(sheetName, idValue) {
  updateRow(sheetName, idValue, { TrangThai: TRANG_THAI.DA_XOA });
}

// ------------------------------------------------------------
// ID GENERATION
// ------------------------------------------------------------

// Map prefix → tên sheet để tra số thứ tự
var _prefixSheetMap = {
  'GD': SHEET_NAMES.GIAO_DICH,
  'KH': SHEET_NAMES.KE_HOACH,
  'HS': SHEET_NAMES.HO_SO,
  'DA': SHEET_NAMES.DM_DU_AN,
  'DT': SHEET_NAMES.DM_DOI_TAC,
  'HM': SHEET_NAMES.DM_HANG_MUC,
  'TK': SHEET_NAMES.DM_TAI_KHOAN
};

/**
 * Sinh ID dạng PREFIX-YYYYMMDD-NNN (NNN bắt đầu từ 001 mỗi ngày).
 */
function genId(prefix) {
  var today = getToday();
  var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyyMMdd');
  var sheetName = _prefixSheetMap[prefix];
  if (!sheetName) throw new Error('prefix không hợp lệ: ' + prefix);

  var sheet = getSheet_(sheetName);
  var lastRow = sheet.getLastRow();
  var pattern = prefix + '-' + dateStr + '-';
  var maxSeq = 0;

  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(function(r) {
      var id = String(r[0]);
      if (id.indexOf(pattern) === 0) {
        var seq = parseInt(id.slice(pattern.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });
  }

  return pattern + String(maxSeq + 1).padStart(3, '0');
}

/**
 * Sinh số chứng từ tiền mặt: PT-YYYYMM-NNN hoặc PC-YYYYMM-NNN.
 */
function genSoChungTu(loai) {
  if (loai !== LOAI_CHUNG_TU.PT && loai !== LOAI_CHUNG_TU.PC) {
    throw new Error('loai phải là PT hoặc PC');
  }

  var today = getToday();
  var monthStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyyMM');
  var pattern = loai + '-' + monthStr + '-';

  var sheet = getSheet_(SHEET_NAMES.GIAO_DICH);
  var lastRow = sheet.getLastRow();
  var maxSeq = 0;

  if (lastRow >= 2) {
    var map = headerMap(SHEET_NAMES.GIAO_DICH);
    var soChungTuIdx = map['SoChungTu'];
    if (soChungTuIdx !== undefined) {
      var data = sheet.getRange(2, soChungTuIdx + 1, lastRow - 1, 1).getValues();
      data.forEach(function(r) {
        var ct = String(r[0]);
        if (ct.indexOf(pattern) === 0) {
          var seq = parseInt(ct.slice(pattern.length), 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      });
    }
  }

  return pattern + String(maxSeq + 1).padStart(3, '0');
}

// ------------------------------------------------------------
// FORMAT / PARSE
// ------------------------------------------------------------

/**
 * Format số tiền VNĐ: 1500000 → '1.500.000 đ'
 */
function formatVND(so) {
  if (so === null || so === undefined || so === '') return '0 đ';
  var n = Math.round(Number(so));
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' đ';
}

/**
 * Parse chuỗi 'dd/MM/yyyy' → Date (giờ 00:00:00 theo timezone script)
 */
function parseDate(str) {
  if (!str) return null;
  if (str instanceof Date) return new Date(str.getFullYear(), str.getMonth(), str.getDate());
  var parts = String(str).trim().split('/');
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
}

/**
 * Format Date → 'dd/MM/yyyy'
 */
function formatDate(date) {
  if (!date) return '';
  var d = date instanceof Date ? date : new Date(date);
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var yyyy = d.getFullYear();
  return dd + '/' + mm + '/' + yyyy;
}

// ------------------------------------------------------------
// DATE HELPERS
// ------------------------------------------------------------

/** Ngày hôm nay, 00:00:00 */
function getToday() {
  var now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Cộng n ngày vào date, trả về Date mới */
function addDays(date, n) {
  var d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Số ngày chênh lệch giữa 2 ngày (date2 - date1, có thể âm) */
function diffDays(date1, date2) {
  var d1 = new Date(date1); d1.setHours(0, 0, 0, 0);
  var d2 = new Date(date2); d2.setHours(0, 0, 0, 0);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

/** Trả về chuỗi 'YYYY-MM' từ Date (dùng để group theo tháng) */
function toYearMonth(date) {
  var d = date instanceof Date ? date : new Date(date);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM');
}

/** Trả về tên tháng tiếng Việt ngắn gọn: 'T6/2026' */
function formatThang(date) {
  var d = date instanceof Date ? date : new Date(date);
  return 'T' + (d.getMonth() + 1) + '/' + d.getFullYear();
}
