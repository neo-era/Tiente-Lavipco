// ============================================================
// Setup.gs — Khởi tạo workbook và menu Google Sheets
// ============================================================

// ------------------------------------------------------------
// MENU
// ------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💰 Dòng tiền')
    .addItem('Khởi tạo workbook',    'khoiTaoWorkbook')
    .addItem('Xóa dữ liệu mẫu',     'xoaDuLieuMau')
    .addSeparator()
    .addItem('Cài trigger hằng ngày', 'caiTrigger')
    .addItem('Gỡ trigger',            'goTrigger')
    .addSeparator()
    .addItem('Cập nhật Dashboard',   'capNhatDashboard')
    .addItem('Cập nhật Forecast',    'capNhatForecast')
    .addToUi();
}

// ------------------------------------------------------------
// KHỞI TẠO WORKBOOK
// ------------------------------------------------------------

/**
 * Tạo hoặc chuẩn hóa 10 sheet + header + seed data.
 * Idempotent — chạy lại không xóa dữ liệu hiện có.
 */
function khoiTaoWorkbook() {
  var ss = getSpreadsheet_();
  var ui = SpreadsheetApp.getUi();

  // Thứ tự sheet muốn hiển thị trên tab bar
  var sheetOrder = [
    SHEET_NAMES.DM_DU_AN,
    SHEET_NAMES.DM_DOI_TAC,
    SHEET_NAMES.DM_HANG_MUC,
    SHEET_NAMES.DM_TAI_KHOAN,
    SHEET_NAMES.KE_HOACH,
    SHEET_NAMES.GIAO_DICH,
    SHEET_NAMES.HO_SO,
    SHEET_NAMES.DASHBOARD,
    SHEET_NAMES.FORECAST,
    SHEET_NAMES.BAO_CAO
  ];

  // Sheet tự động — không ghi header
  var autoSheets = [SHEET_NAMES.DASHBOARD, SHEET_NAMES.FORECAST, SHEET_NAMES.BAO_CAO];

  sheetOrder.forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);

    // Tạo sheet nếu chưa có
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    // Ghi header nếu sheet có trong HEADERS và hàng 1 đang trống
    if (autoSheets.indexOf(sheetName) === -1 && HEADERS[sheetName]) {
      var firstCell = sheet.getRange(1, 1).getValue();
      if (!firstCell) {
        taoHeader_(sheet, HEADERS[sheetName]);
      }
    }
  });

  // Sắp xếp tab theo đúng thứ tự
  sheetOrder.forEach(function(sheetName, idx) {
    var sheet = ss.getSheetByName(sheetName);
    if (sheet) ss.setActiveSheet(sheet);
    try { ss.moveActiveSheet(idx + 1); } catch(e) {}
  });

  // Seed data (chỉ chạy nếu DM_DuAn trống)
  taoSeedData_();

  SpreadsheetApp.getActive().toast('Workbook đã sẵn sàng! Hãy nhập số dư đầu kỳ vào sheet DM_TaiKhoan.', '✅ Khởi tạo xong', 8);
}

/**
 * Ghi header, format bold + freeze + autoResize.  (private)
 */
function taoHeader_(sheet, headers) {
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);

  // Bold + background xanh nhạt
  range.setFontWeight('bold');
  range.setBackground('#E8F0FE');
  range.setHorizontalAlignment('center');

  // Freeze hàng đầu
  sheet.setFrozenRows(1);

  // AutoResize tất cả cột
  for (var i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  // Đặt độ rộng tối thiểu 80px cho các cột hẹp
  for (var j = 1; j <= headers.length; j++) {
    if (sheet.getColumnWidth(j) < 80) sheet.setColumnWidth(j, 80);
  }
}

// ------------------------------------------------------------
// SEED DATA
// ------------------------------------------------------------

/**
 * Thêm dữ liệu mẫu có prefix [MẪU].
 * Chỉ chạy nếu DM_DuAn đang hoàn toàn trống (chưa có dữ liệu nào).
 */
function taoSeedData_() {
  var duAnSheet = getSheet_(SHEET_NAMES.DM_DU_AN);
  if (duAnSheet.getLastRow() >= 2) return; // Đã có dữ liệu — bỏ qua

  var today = formatDate(getToday());

  // --- DM_DuAn ---
  var duAnSeed = [
    { MaDuAn: 'DA-001', TenDuAn: '[MẪU] Chiếu sáng Quận 3',       TenChuDauTu: '[MẪU] Ban QLDA Quận 3',   GiaTriHD: 850000000,  NgayKy: today, TrangThai: 'DangThiCong', GhiChu: 'Dữ liệu mẫu' },
    { MaDuAn: 'DA-002', TenDuAn: '[MẪU] Chiếu sáng Bình Dương',    TenChuDauTu: '[MẪU] Sở GTCC Bình Dương', GiaTriHD: 1200000000, NgayKy: today, TrangThai: 'DangThiCong', GhiChu: 'Dữ liệu mẫu' }
  ];
  duAnSeed.forEach(function(r) { appendRow(SHEET_NAMES.DM_DU_AN, r); });

  // --- DM_DoiTac ---
  var doiTacSeed = [
    { MaDoiTac: 'DT-001', TenDoiTac: '[MẪU] Ban QLDA Quận 3',         LoaiDoiTac: 'ChuDauTu', SoDienThoai: '028.1234.5678', Email: 'qlda.q3@example.com', GhiChu: 'Dữ liệu mẫu' },
    { MaDoiTac: 'DT-002', TenDoiTac: '[MẪU] Công ty Thiết bị Điện ABC', LoaiDoiTac: 'NCC',      SoDienThoai: '028.9876.5432', Email: 'abc.dien@example.com',  GhiChu: 'Dữ liệu mẫu' },
    { MaDoiTac: 'DT-003', TenDoiTac: '[MẪU] Thầu phụ Thi công XYZ',    LoaiDoiTac: 'ThauPhu',  SoDienThoai: '090.1111.2222', Email: 'xyz.tc@example.com',    GhiChu: 'Dữ liệu mẫu' }
  ];
  doiTacSeed.forEach(function(r) { appendRow(SHEET_NAMES.DM_DOI_TAC, r); });

  // --- DM_HangMuc ---
  var hangMucSeed = [
    { MaHangMuc: 'HM-001', TenHangMuc: 'Vật tư thiết bị',    LoaiThuChi: 'Chi', GhiChu: 'Đèn, cột, dây, tủ điện...' },
    { MaHangMuc: 'HM-002', TenHangMuc: 'Nhân công',           LoaiThuChi: 'Chi', GhiChu: 'Lương thi công, nhân viên giám sát' },
    { MaHangMuc: 'HM-003', TenHangMuc: 'Vận chuyển',          LoaiThuChi: 'Chi', GhiChu: 'Chi phí vận chuyển vật tư' },
    { MaHangMuc: 'HM-004', TenHangMuc: 'Chi phí quản lý',     LoaiThuChi: 'Chi', GhiChu: 'Chi phí quản lý dự án, văn phòng' },
    { MaHangMuc: 'HM-005', TenHangMuc: 'Thu nghiệm thu',      LoaiThuChi: 'Thu', GhiChu: 'Tiền thu từ chủ đầu tư sau nghiệm thu' }
  ];
  hangMucSeed.forEach(function(r) { appendRow(SHEET_NAMES.DM_HANG_MUC, r); });

  // --- DM_TaiKhoan --- (không có prefix [MẪU] — tài khoản thật, chỉ cần nhập số dư)
  var taiKhoanSeed = [
    { MaTK: TAI_KHOAN.ACB,      TenTK: 'ACB',       NganHang: 'Ngân hàng ACB',       SoDuDauKy: 0, HanMucToiThieu: 5000000,  GhiChu: 'Nhập số dư đầu kỳ thực tế' },
    { MaTK: TAI_KHOAN.SCB,      TenTK: 'Sacombank',  NganHang: 'Ngân hàng Sacombank', SoDuDauKy: 0, HanMucToiThieu: 5000000,  GhiChu: 'Nhập số dư đầu kỳ thực tế' },
    { MaTK: TAI_KHOAN.TIEN_MAT, TenTK: 'Tiền mặt',  NganHang: '—',                   SoDuDauKy: 0, HanMucToiThieu: 2000000,  GhiChu: 'Nhập tồn quỹ đầu kỳ thực tế' }
  ];
  taiKhoanSeed.forEach(function(r) { appendRow(SHEET_NAMES.DM_TAI_KHOAN, r); });
}

// ------------------------------------------------------------
// XÓA DỮ LIỆU MẪU
// ------------------------------------------------------------

/**
 * Soft delete tất cả hàng có tên bắt đầu bằng '[MẪU]'
 * trong 3 sheet danh mục (DM_DuAn, DM_DoiTac, DM_HangMuc).
 * DM_TaiKhoan không xóa vì tài khoản là cấu hình thật.
 */
function xoaDuLieuMau() {
  var targets = [
    { sheetName: SHEET_NAMES.DM_DU_AN,    tenCot: 'TenDuAn'   },
    { sheetName: SHEET_NAMES.DM_DOI_TAC,  tenCot: 'TenDoiTac' },
    { sheetName: SHEET_NAMES.DM_HANG_MUC, tenCot: 'TenHangMuc'}
  ];

  var totalDeleted = 0;

  targets.forEach(function(target) {
    var sheet = getSheet_(target.sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var map = headerMap(target.sheetName);
    var idIdx   = 0;                       // cột ID luôn là cột đầu tiên
    var tenIdx  = map[target.tenCot];
    var tthIdx  = map['TrangThai'];

    if (tenIdx === undefined) return;

    var cols = sheet.getLastColumn();
    var range = sheet.getRange(2, 1, lastRow - 1, cols);
    var data  = range.getValues();
    var changed = false;

    data.forEach(function(row) {
      var ten = String(row[tenIdx]);
      var tth = tthIdx !== undefined ? String(row[tthIdx]) : '';
      if (ten.indexOf('[MẪU]') === 0 && tth !== TRANG_THAI.DA_XOA) {
        if (tthIdx !== undefined) row[tthIdx] = TRANG_THAI.DA_XOA;
        totalDeleted++;
        changed = true;
      }
    });

    if (changed) range.setValues(data);
  });

  SpreadsheetApp.getActive().toast(
    'Đã xóa ' + totalDeleted + ' hàng dữ liệu mẫu. Workbook sẵn sàng để nhập thật.',
    '🗑️ Xóa dữ liệu mẫu',
    5
  );
}
