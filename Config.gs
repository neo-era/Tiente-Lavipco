// ============================================================
// Config.gs — Hằng số trung tâm toàn dự án QLDT LAVIPCO
// ============================================================

var SPREADSHEET_ID = '1GHFKlN5Q86BnYIgyNeQpzP5ODMhWeky7VGE_3qQ1zyw';

// ------------------------------------------------------------
// Tên 10 sheet
// ------------------------------------------------------------
var SHEET_NAMES = {
  DM_DU_AN:     'DM_DuAn',
  DM_DOI_TAC:   'DM_DoiTac',
  DM_HANG_MUC:  'DM_HangMuc',
  DM_TAI_KHOAN: 'DM_TaiKhoan',
  KE_HOACH:     'KeHoach',
  GIAO_DICH:    'GiaoDich',
  HO_SO:        'HoSo',
  DASHBOARD:    'Dashboard',
  FORECAST:     'Forecast',
  BAO_CAO:      'BaoCao'
};

// ------------------------------------------------------------
// Header (thứ tự cột) từng sheet — dùng bởi Utils.gs
// ------------------------------------------------------------
var HEADERS = {
  DM_DuAn:     ['MaDuAn',    'TenDuAn',    'TenChuDauTu', 'GiaTriHD',  'NgayKy',       'TrangThai', 'GhiChu'],
  DM_DoiTac:   ['MaDoiTac',  'TenDoiTac',  'LoaiDoiTac',  'SoDienThoai','Email',        'GhiChu'],
  DM_HangMuc:  ['MaHangMuc', 'TenHangMuc', 'LoaiThuChi',  'GhiChu'],
  DM_TaiKhoan: ['MaTK',      'TenTK',      'NganHang',    'SoDuDauKy', 'HanMucToiThieu','GhiChu'],
  KeHoach:     ['MaKeHoach', 'MaDuAn',     'MaDoiTac',    'LoaiThuChi','SoTien',        'NgayDuKien','TrangThai','MaGDKhop','GhiChu'],
  GiaoDich:    ['MaGD',      'NgayGD',     'MaDuAn',      'MaDoiTac',  'MaTK',          'MaHangMuc', 'LoaiThuChi','SoTien', 'LoaiChungTu','SoChungTu','NguoiNopThu','MaKHKhop','GhiChu','TrangThai'],
  HoSo:        ['MaHoSo',    'MaDuAn',     'TenFile',     'LoaiTaiLieu','DuongDanGoiY', 'NgayTao',   'TrangThai', 'GhiChu']
  // Dashboard, Forecast, BaoCao: không định nghĩa header — viết tay bởi Dashboard.gs / Forecast.gs
};

// ------------------------------------------------------------
// Mã tài khoản chuẩn (giá trị lưu trong cột MaTK)
// ------------------------------------------------------------
var TAI_KHOAN = {
  ACB:      'TK_ACB',
  SCB:      'TK_SCB',
  TIEN_MAT: 'TK_TM'
};

// ------------------------------------------------------------
// Loại thu / chi
// ------------------------------------------------------------
var LOAI_THU_CHI = {
  THU: 'Thu',
  CHI: 'Chi'
};

// ------------------------------------------------------------
// Loại chứng từ giao dịch
// ------------------------------------------------------------
var LOAI_CHUNG_TU = {
  PT:     'PT',      // Phiếu thu tiền mặt
  PC:     'PC',      // Phiếu chi tiền mặt
  UNC:    'UNC',     // Ủy nhiệm chi ngân hàng
  SAO_KE: 'SaoKe'   // Import từ sao kê ngân hàng
};

// ------------------------------------------------------------
// Loại tài liệu hồ sơ dự án
// ------------------------------------------------------------
var LOAI_TAI_LIEU = {
  HOP_DONG:   'HopDong',
  BIEN_BAN:   'BienBan',
  THANH_TOAN: 'ThanhToan',
  BAN_VE:     'BanVe',
  HOA_DON:    'HoaDon',
  KHAC:       'Khac'
};

// Map loại tài liệu → tên thư mục con OneDrive
var THU_MUC_TAI_LIEU = {
  HopDong:    '01_HopDong',
  BienBan:    '02_BienBan',
  ThanhToan:  '03_ThanhToan',
  BanVe:      '04_BanVe',
  HoaDon:     '05_HoaDon',
  Khac:       '06_Khac'
};

// ------------------------------------------------------------
// Trạng thái dùng chung
// ------------------------------------------------------------
var TRANG_THAI = {
  CHUA_THUC_HIEN: 'ChuaThucHien',
  DA_THUC_HIEN:   'DaThucHien',
  QUA_HAN:        'QuaHan',
  DA_XOA:         'DaXoa',
  CHO_LUU:        'ChoLuu',
  DA_LUU:         'DaLuu'
};

// ------------------------------------------------------------
// Hằng số nghiệp vụ
// ------------------------------------------------------------
var VAT_RATE                  = 0.08;   // VAT 8%
var NGAY_CANH_BAO_DEN_HAN     = 7;      // Cảnh báo khoản đến hạn trong N ngày tới
var NGAY_CANH_BAO_HO_SO       = 3;      // Cảnh báo hồ sơ ChoLuu quá N ngày
var TY_LE_GIU_LAI_BAO_HANH    = 0.05;  // 5% giá trị hợp đồng
var THOI_HAN_BAO_HANH_THANG   = 12;     // Thời hạn bảo hành 12 tháng

// Tỉ lệ thanh toán mặc định (%)
var TY_LE_THANH_TOAN_MAC_DINH = [30, 60, 10];
