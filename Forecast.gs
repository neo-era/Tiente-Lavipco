// ============================================================
// Forecast.gs — Dự báo dòng tiền 6 tháng lũy kế
// Phụ thuộc: Config.gs, Utils.gs, Transactions.gs, Planning.gs
// ============================================================

var FORECAST_HEADER_ROW = 4;  // Hàng header của bảng dữ liệu
var FORECAST_DATA_START  = 5;  // Hàng đầu tiên của dữ liệu
var FORECAST_MONTHS      = 6;  // Số tháng dự báo

/**
 * Tính và ghi dự báo 6 tháng vào sheet Forecast.
 * Được gọi bởi trigger 7h sáng hằng ngày và từ menu.
 */
function capNhatForecast() {
  var sheet = getSheet_(SHEET_NAMES.FORECAST);

  // ── 1. Tổng số dư hiện tại (tất cả tài khoản) ──────────────
  var soDuMap  = soDuTheoTK_();
  var tongSoDu = Object.keys(soDuMap).reduce(function(s, k) {
    return s + (soDuMap[k] || 0);
  }, 0);

  // ── 2. KeHoach chưa thực hiện ──────────────────────────────
  var khRows = readRows(SHEET_NAMES.KE_HOACH).filter(function(r) {
    return r.TrangThai !== TRANG_THAI.DA_THUC_HIEN &&
           r.TrangThai !== TRANG_THAI.DA_XOA;
  });

  // ── 3. Tạo mảng 6 tháng và group dữ liệu ──────────────────
  var now = getToday();
  var months = [];       // ['2026-06', '2026-07', ...]
  var monthLabels = [];  // ['T6/2026', 'T7/2026', ...]

  for (var i = 0; i < FORECAST_MONTHS; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(toYearMonth(d));
    monthLabels.push(formatThang(d));
  }

  // Khởi tạo map thu/chi = 0 cho 6 tháng
  var thuMap = {}, chiMap = {};
  months.forEach(function(m) { thuMap[m] = 0; chiMap[m] = 0; });

  khRows.forEach(function(r) {
    var ngay = r.NgayDuKien instanceof Date ? r.NgayDuKien : parseDate(r.NgayDuKien);
    if (!ngay) return;
    var thang = toYearMonth(ngay);
    if (!thuMap.hasOwnProperty(thang)) return; // Ngoài phạm vi 6 tháng — bỏ qua
    var soTien = Number(r.SoTien) || 0;
    if (r.LoaiThuChi === LOAI_THU_CHI.THU) thuMap[thang] += soTien;
    else                                   chiMap[thang] += soTien;
  });

  // ── 4. Tính lũy kế ─────────────────────────────────────────
  var luyCe = tongSoDu;
  var rows  = [];  // [label, thu, chi, rong, luyCe]

  months.forEach(function(m, i) {
    var thu  = thuMap[m];
    var chi  = chiMap[m];
    var rong = thu - chi;
    luyCe   += rong;
    rows.push([monthLabels[i], thu, chi, rong, luyCe]);
  });

  // ── 5. Ghi vào sheet ───────────────────────────────────────
  // Xóa nội dung và format cũ (giữ chart)
  sheet.clearContents();
  sheet.clearFormats();

  // Tiêu đề + thời điểm cập nhật
  sheet.getRange(1, 1).setValue('DỰ BÁO DÒNG TIỀN 6 THÁNG — LAVIPCO')
    .setFontWeight('bold').setFontSize(13);
  sheet.getRange(2, 1).setValue(
    'Tổng số dư hiện tại: ' + formatVND(tongSoDu) +
    ' | Cập nhật: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
  ).setFontColor('#666666');

  // Header bảng
  var headerRange = sheet.getRange(FORECAST_HEADER_ROW, 1, 1, 5);
  headerRange.setValues([['Tháng', 'Thu kế hoạch', 'Chi kế hoạch', 'Ròng', 'Lũy kế']]);
  headerRange.setFontWeight('bold')
             .setBackground('#E8F0FE')
             .setHorizontalAlignment('center');
  sheet.setFrozenRows(FORECAST_HEADER_ROW);

  // Dữ liệu 6 tháng
  var dataRange = sheet.getRange(FORECAST_DATA_START, 1, FORECAST_MONTHS, 5);
  dataRange.setValues(rows);

  // Format số tiền (cột B C D E)
  var moneyFormat = '#,##0';
  sheet.getRange(FORECAST_DATA_START, 2, FORECAST_MONTHS, 4).setNumberFormat(moneyFormat);

  // Căn lề
  sheet.getRange(FORECAST_DATA_START, 1, FORECAST_MONTHS, 1).setHorizontalAlignment('center');
  sheet.getRange(FORECAST_DATA_START, 2, FORECAST_MONTHS, 4).setHorizontalAlignment('right');

  // ── 6. Highlight đỏ tháng âm tiền (Lũy kế < 0) ────────────
  for (var r = 0; r < FORECAST_MONTHS; r++) {
    var luyCeRow = rows[r][4];
    var rowRange = sheet.getRange(FORECAST_DATA_START + r, 1, 1, 5);
    if (luyCeRow < 0) {
      rowRange.setBackground('#FFE0E0');
      sheet.getRange(FORECAST_DATA_START + r, 5).setFontColor('#D93025').setFontWeight('bold');
    } else {
      rowRange.setBackground(null);
    }
  }

  // Đường phân cách "Ròng" — tô màu theo dấu
  for (var rr = 0; rr < FORECAST_MONTHS; rr++) {
    var rongVal = rows[rr][3];
    var rongCell = sheet.getRange(FORECAST_DATA_START + rr, 4);
    rongCell.setFontColor(rongVal >= 0 ? '#137333' : '#D93025');
  }

  // AutoResize cột
  for (var c = 1; c <= 5; c++) sheet.autoResizeColumn(c);

  // ── 7. Biểu đồ combo — tạo nếu chưa có ────────────────────
  taoHoacCapNhatBieuDoForecast_(sheet);
}

// ------------------------------------------------------------
// BIỂU ĐỒ
// ------------------------------------------------------------

/**
 * Tạo biểu đồ combo (cột + đường) cho Forecast.
 * Nếu đã có biểu đồ thì cập nhật lại range; nếu chưa có thì tạo mới.
 * @private
 */
function taoHoacCapNhatBieuDoForecast_(sheet) {
  var charts    = sheet.getCharts();
  var dataRange = sheet.getRange(FORECAST_HEADER_ROW, 1, FORECAST_MONTHS + 1, 5);

  // Nếu đã có biểu đồ — xóa để tạo lại (đảm bảo dữ liệu mới nhất)
  charts.forEach(function(c) { sheet.removeChart(c); });

  try {
    var chartBuilder = sheet.newChart()
      .setChartType(Charts.ChartType.COMBO)
      .addRange(dataRange)
      .setPosition(FORECAST_DATA_START + FORECAST_MONTHS + 2, 1, 0, 0)
      .setNumHeaders(1)
      .setOption('title', 'Dự báo dòng tiền 6 tháng')
      .setOption('legend', { position: 'bottom' })
      .setOption('vAxis', { format: '#,##0' })
      .setOption('series', {
        0: { type: 'bars',  color: '#34A853', targetAxisIndex: 0 },  // Thu — xanh lá
        1: { type: 'bars',  color: '#EA4335', targetAxisIndex: 0 },  // Chi — đỏ
        2: { type: 'bars',  color: '#FBBC04', targetAxisIndex: 0 },  // Ròng — vàng
        3: { type: 'line',  color: '#1967D2', lineWidth: 3, pointSize: 6, targetAxisIndex: 0 }  // Lũy kế — xanh dương
      })
      .setOption('width', 700)
      .setOption('height', 350);

    sheet.insertChart(chartBuilder.build());
  } catch (e) {
    // Biểu đồ là nice-to-have; không để lỗi chart làm crash toàn bộ hàm
    Logger.log('Không tạo được biểu đồ Forecast: ' + e.message);
  }
}

// ------------------------------------------------------------
// ĐỌC DỮ LIỆU FORECAST (dùng bởi FormServer.gs)
// ------------------------------------------------------------

/**
 * Đọc dữ liệu Forecast đã tính từ sheet, trả về array cho frontend.
 * @returns {Object[]} [{ thang, thu, chi, rong, luyCe, amTien }]
 */
function getForecastData() {
  var sheet   = getSheet_(SHEET_NAMES.FORECAST);
  var lastRow = sheet.getLastRow();
  if (lastRow < FORECAST_DATA_START) return [];

  var rows = sheet.getRange(FORECAST_DATA_START, 1, FORECAST_MONTHS, 5).getValues();
  return rows
    .filter(function(r) { return r[0]; })
    .map(function(r) {
      return {
        thang:  String(r[0]),
        thu:    Number(r[1]) || 0,
        chi:    Number(r[2]) || 0,
        rong:   Number(r[3]) || 0,
        luyCe:  Number(r[4]) || 0,
        amTien: (Number(r[4]) || 0) < 0
      };
    });
}
