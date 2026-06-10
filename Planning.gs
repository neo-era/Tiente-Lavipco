// ============================================================
// Planning.gs — Quản lý kế hoạch thu/chi (AR/AP)
// Phụ thuộc: Config.gs, Utils.gs
// ============================================================

// ------------------------------------------------------------
// THÊM KẾ HOẠCH THỦ CÔNG
// ------------------------------------------------------------

/**
 * Thêm 1 kế hoạch thu/chi.
 * @param {Object} data { MaDuAn, MaDoiTac?, LoaiThuChi, SoTien, NgayDuKien, GhiChu? }
 * @returns {{ ok: boolean, id: string }}
 */
function themKeHoach(data) {
  var required = ['MaDuAn', 'LoaiThuChi', 'SoTien', 'NgayDuKien'];
  required.forEach(function(f) {
    if (!data[f] && data[f] !== 0) throw new Error('Thiếu trường bắt buộc: ' + f);
  });

  var soTien = Number(data.SoTien);
  if (isNaN(soTien) || soTien <= 0) throw new Error('Số tiền phải là số dương.');

  var id = genId('KH');
  appendRow(SHEET_NAMES.KE_HOACH, {
    MaKeHoach:  id,
    MaDuAn:     data.MaDuAn,
    MaDoiTac:   data.MaDoiTac    || '',
    LoaiThuChi: data.LoaiThuChi,
    SoTien:     soTien,
    NgayDuKien: data.NgayDuKien instanceof Date ? data.NgayDuKien : parseDate(data.NgayDuKien),
    TrangThai:  TRANG_THAI.CHUA_THUC_HIEN,
    MaGDKhop:   '',
    GhiChu:     data.GhiChu || ''
  });

  return { ok: true, id: id };
}

// ------------------------------------------------------------
// TẠO LỊCH THANH TOÁN TỰ ĐỘNG
// ------------------------------------------------------------

/**
 * Sinh các kế hoạch Thu theo tỉ lệ % và lịch thanh toán.
 * @param {string}   maDuAn
 * @param {number}   giaTriHD  — giá trị hợp đồng (VNĐ)
 * @param {number[]} tyLe      — ví dụ [30, 60, 10] (tổng = 100)
 * @param {Date}     ngayKy    — ngày ký hợp đồng
 * @returns {{ ok: boolean, ids: string[] }}
 */
function taoLichThanhToan(maDuAn, giaTriHD, tyLe, ngayKy) {
  tyLe   = tyLe   || TY_LE_THANH_TOAN_MAC_DINH;
  ngayKy = ngayKy instanceof Date ? ngayKy : parseDate(ngayKy);

  var tongTyLe = tyLe.reduce(function(s, v) { return s + v; }, 0);
  if (Math.abs(tongTyLe - 100) > 0.01) {
    throw new Error('Tổng tỉ lệ thanh toán phải bằng 100%. Hiện tại: ' + tongTyLe + '%');
  }

  // Khoảng cách ngày: phân bổ đều trong 150 ngày theo số đợt
  // [30, 90, 150] cho 3 đợt; công thức: 30 + index * (120 / (n-1)) với n >= 2
  var ids = [];
  var n   = tyLe.length;

  tyLe.forEach(function(phanTram, i) {
    var ngayOffset;
    if (n === 1) {
      ngayOffset = 30;
    } else {
      // Đợt đầu: ngayKy+30, đợt cuối: ngayKy+150, các đợt giữa tuyến tính
      ngayOffset = Math.round(30 + (i / (n - 1)) * 120);
    }

    var soTienDot = Math.round(giaTriHD * phanTram / 100);
    var ngayDuKien = addDays(ngayKy, ngayOffset);
    var dotLabel   = i === 0 ? 'Đợt 1' : (i === n - 1 ? 'Đợt cuối' : 'Đợt ' + (i + 1));
    var ghiChu     = dotLabel + ' — ' + phanTram + '% giá trị HĐ';

    var res = themKeHoach({
      MaDuAn:     maDuAn,
      LoaiThuChi: LOAI_THU_CHI.THU,
      SoTien:     soTienDot,
      NgayDuKien: ngayDuKien,
      GhiChu:     ghiChu
    });
    ids.push(res.id);
  });

  return { ok: true, ids: ids };
}

// ------------------------------------------------------------
// TẠO KHOẢN GIỮ LẠI BẢO HÀNH
// ------------------------------------------------------------

/**
 * Sinh kế hoạch Thu giữ lại bảo hành 5% giá trị HĐ.
 * NgayDuKien = ngayNghiemThu + THOI_HAN_BAO_HANH_THANG tháng.
 * @param {string} maDuAn
 * @param {Date}   ngayNghiemThu
 * @param {number} tyLe — tỉ lệ (mặc định TY_LE_GIU_LAI_BAO_HANH = 0.05)
 * @returns {{ ok: boolean, id: string }}
 */
function taoGiuLaiBaoHanh(maDuAn, ngayNghiemThu, tyLe) {
  tyLe = (tyLe !== undefined && tyLe !== null) ? Number(tyLe) : TY_LE_GIU_LAI_BAO_HANH;
  ngayNghiemThu = ngayNghiemThu instanceof Date ? ngayNghiemThu : parseDate(ngayNghiemThu);

  // Lấy GiaTriHD từ DM_DuAn
  var duAnRows = readRows(SHEET_NAMES.DM_DU_AN);
  var duAn = duAnRows.filter(function(r) { return r.MaDuAn === maDuAn; })[0];
  if (!duAn) throw new Error('Không tìm thấy dự án: ' + maDuAn);

  var giaTriHD = Number(duAn.GiaTriHD) || 0;
  if (giaTriHD <= 0) throw new Error('GiaTriHD của dự án ' + maDuAn + ' chưa nhập hoặc bằng 0.');

  var soTienGiuLai = Math.round(giaTriHD * tyLe);

  // Cộng tháng bảo hành
  var ngayDuKien = new Date(ngayNghiemThu);
  ngayDuKien.setMonth(ngayDuKien.getMonth() + THOI_HAN_BAO_HANH_THANG);

  var res = themKeHoach({
    MaDuAn:     maDuAn,
    LoaiThuChi: LOAI_THU_CHI.THU,
    SoTien:     soTienGiuLai,
    NgayDuKien: ngayDuKien,
    GhiChu:     'Giữ lại bảo hành ' + (tyLe * 100) + '% — đến hạn ' + formatDate(ngayDuKien)
  });

  return { ok: true, id: res.id };
}

// ------------------------------------------------------------
// KHỚP KẾ HOẠCH ↔ GIAO DỊCH
// ------------------------------------------------------------

/**
 * Đánh dấu kế hoạch đã thực hiện bằng giao dịch thật.
 * Quan hệ 1-1: một kế hoạch chỉ khớp 1 giao dịch.
 * @returns {{ ok: boolean }}
 */
function khopKeHoach(maKH, maGD) {
  var khRows = readRows(SHEET_NAMES.KE_HOACH);
  var kh = khRows.filter(function(r) { return r.MaKeHoach === maKH; })[0];
  if (!kh) throw new Error('Không tìm thấy kế hoạch: ' + maKH);
  if (kh.MaGDKhop) throw new Error('Kế hoạch ' + maKH + ' đã khớp với giao dịch ' + kh.MaGDKhop);

  var gdRows = readRows(SHEET_NAMES.GIAO_DICH);
  var gd = gdRows.filter(function(r) { return r.MaGD === maGD; })[0];
  if (!gd) throw new Error('Không tìm thấy giao dịch: ' + maGD);
  if (gd.MaKHKhop) throw new Error('Giao dịch ' + maGD + ' đã khớp với kế hoạch ' + gd.MaKHKhop);

  updateRow(SHEET_NAMES.KE_HOACH,  maKH, { TrangThai: TRANG_THAI.DA_THUC_HIEN, MaGDKhop: maGD });
  updateRow(SHEET_NAMES.GIAO_DICH, maGD, { TrangThai: TRANG_THAI.DA_THUC_HIEN, MaKHKhop: maKH });

  return { ok: true };
}

// ------------------------------------------------------------
// HỦY KHỚP
// ------------------------------------------------------------

/**
 * Hủy khớp giữa kế hoạch và giao dịch — reset cả hai về ChuaThucHien.
 * @returns {{ ok: boolean }}
 */
function huyKhopKeHoach(maKH) {
  var khRows = readRows(SHEET_NAMES.KE_HOACH);
  var kh = khRows.filter(function(r) { return r.MaKeHoach === maKH; })[0];
  if (!kh) throw new Error('Không tìm thấy kế hoạch: ' + maKH);
  if (!kh.MaGDKhop) throw new Error('Kế hoạch ' + maKH + ' chưa được khớp với giao dịch nào.');

  var maGD = kh.MaGDKhop;

  updateRow(SHEET_NAMES.KE_HOACH,  maKH, { TrangThai: TRANG_THAI.CHUA_THUC_HIEN, MaGDKhop: '' });
  updateRow(SHEET_NAMES.GIAO_DICH, maGD, { TrangThai: TRANG_THAI.CHUA_THUC_HIEN, MaKHKhop: '' });

  return { ok: true };
}

// ------------------------------------------------------------
// CÔNG NỢ TỔNG HỢP
// ------------------------------------------------------------

/**
 * Tổng hợp phải thu / phải trả theo dự án.
 * @returns {{ phaiThu: Object[], phaiTra: Object[] }}
 */
function congNo() {
  var today = getToday();

  // Đọc KeHoach và DM_DuAn mỗi sheet 1 lần
  var khRows  = readRows(SHEET_NAMES.KE_HOACH);
  var duAnRows = readRows(SHEET_NAMES.DM_DU_AN);

  // Map maDuAn → tenDuAn để join nhanh
  var tenDuAnMap = {};
  duAnRows.forEach(function(r) { tenDuAnMap[r.MaDuAn] = r.TenDuAn; });

  // Lọc kế hoạch chưa thực hiện (bỏ DA_THUC_HIEN và DA_XOA)
  var chuaThucHien = khRows.filter(function(r) {
    return r.TrangThai !== TRANG_THAI.DA_THUC_HIEN &&
           r.TrangThai !== TRANG_THAI.DA_XOA;
  });

  function nhomTheoDuAn(rows) {
    var nhom = {};
    rows.forEach(function(r) {
      var ma = r.MaDuAn;
      if (!nhom[ma]) {
        nhom[ma] = {
          maDuAn:        ma,
          tenDuAn:       tenDuAnMap[ma] || ma,
          soKhoan:       0,
          tongTien:      0,
          soKhoanQuaHan: 0
        };
      }
      nhom[ma].soKhoan++;
      nhom[ma].tongTien += Number(r.SoTien) || 0;
      // Kiểm tra quá hạn
      var ngayDuKien = r.NgayDuKien instanceof Date ? r.NgayDuKien : parseDate(r.NgayDuKien);
      if (ngayDuKien && ngayDuKien < today) {
        nhom[ma].soKhoanQuaHan++;
      }
    });
    // Chuyển sang array, sắp xếp theo tongTien giảm dần
    return Object.values(nhom).sort(function(a, b) { return b.tongTien - a.tongTien; });
  }

  var phaiThu = chuaThucHien.filter(function(r) { return r.LoaiThuChi === LOAI_THU_CHI.THU; });
  var phaiTra = chuaThucHien.filter(function(r) { return r.LoaiThuChi === LOAI_THU_CHI.CHI; });

  return {
    phaiThu: nhomTheoDuAn(phaiThu),
    phaiTra: nhomTheoDuAn(phaiTra)
  };
}

// ------------------------------------------------------------
// CẬP NHẬT QUÁ HẠN (BATCH)
// ------------------------------------------------------------

/**
 * Đánh dấu QuaHan cho tất cả kế hoạch ChuaThucHien có NgayDuKien < hôm nay.
 * Batch thật sự: đọc sheet 1 lần → sửa trong memory → ghi lại 1 lần.
 */
function capNhatQuaHan() {
  var sheet   = getSheet_(SHEET_NAMES.KE_HOACH);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var map     = headerMap(SHEET_NAMES.KE_HOACH);
  var cols    = sheet.getLastColumn();
  var range   = sheet.getRange(2, 1, lastRow - 1, cols);
  var data    = range.getValues();
  var today   = getToday();

  var trangThaiIdx   = map['TrangThai'];
  var ngayDuKienIdx  = map['NgayDuKien'];
  if (trangThaiIdx === undefined || ngayDuKienIdx === undefined) return;

  var soCapNhat = 0;

  data.forEach(function(row) {
    var tt = row[trangThaiIdx];
    // Chỉ xét kế hoạch đang "ChuaThucHien" (không sờ vào DaThucHien, QuaHan, DaXoa)
    if (tt !== TRANG_THAI.CHUA_THUC_HIEN) return;

    var ngay = row[ngayDuKienIdx];
    if (!ngay) return;
    var ngayDuKien = ngay instanceof Date ? ngay : parseDate(String(ngay));
    if (!ngayDuKien) return;

    // So sánh ngày (đặt giờ về 0 để tránh lỗi múi giờ)
    ngayDuKien = new Date(ngayDuKien.getFullYear(), ngayDuKien.getMonth(), ngayDuKien.getDate());
    if (ngayDuKien < today) {
      row[trangThaiIdx] = TRANG_THAI.QUA_HAN;
      soCapNhat++;
    }
  });

  // Chỉ ghi lại nếu có thay đổi — tránh API call thừa
  if (soCapNhat > 0) {
    range.setValues(data);
    Logger.log('capNhatQuaHan: đã cập nhật ' + soCapNhat + ' kế hoạch sang QuaHan.');
  }
}
