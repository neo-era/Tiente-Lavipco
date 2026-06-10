// ============================================================
// Transactions.gs — Quản lý giao dịch thu/chi
// Phụ thuộc: Config.gs, Utils.gs
// guiCanhBaoTonQuy_() được định nghĩa trong Telegram.gs
// ============================================================

// ------------------------------------------------------------
// NHẬP GIAO DỊCH
// ------------------------------------------------------------

/**
 * Thêm giao dịch mới.
 * @param {Object} data { NgayGD, MaDuAn, MaDoiTac?, MaTK, MaHangMuc?, LoaiThuChi,
 *                        SoTien, MaKHKhop?, GhiChu?, NguoiNopThu? }
 * @returns {{ ok: boolean, id: string, soChungTu?: string }}
 */
function themGiaoDich(data) {
  // --- Validate bắt buộc ---
  var required = ['NgayGD', 'MaDuAn', 'MaTK', 'SoTien', 'LoaiThuChi'];
  required.forEach(function(f) {
    if (!data[f] && data[f] !== 0) throw new Error('Thiếu trường bắt buộc: ' + f);
  });

  var soTien = Number(data.SoTien);
  if (isNaN(soTien) || soTien <= 0) throw new Error('Số tiền phải là số dương.');

  var loai = data.LoaiThuChi;
  if (loai !== LOAI_THU_CHI.THU && loai !== LOAI_THU_CHI.CHI) {
    throw new Error('LoaiThuChi phải là "Thu" hoặc "Chi".');
  }

  var maGD          = genId('GD');
  var soChungTu     = '';
  var loaiChungTu   = '';
  var laTienMat     = (data.MaTK === TAI_KHOAN.TIEN_MAT);

  // --- Xử lý tiền mặt ---
  if (laTienMat) {
    if (loai === LOAI_THU_CHI.CHI) {
      var soDuHienTai = soDuHienTai_(data.MaTK);
      if (soTien > soDuHienTai) {
        throw new Error(
          'Tồn quỹ không đủ! Hiện có: ' + formatVND(soDuHienTai) +
          ' — Cần chi: ' + formatVND(soTien)
        );
      }
      loaiChungTu = LOAI_CHUNG_TU.PC;
    } else {
      loaiChungTu = LOAI_CHUNG_TU.PT;
    }
    soChungTu = genSoChungTu(loaiChungTu);

  // --- Xử lý ngân hàng ---
  } else {
    loaiChungTu = (loai === LOAI_THU_CHI.CHI) ? LOAI_CHUNG_TU.UNC : '';
  }

  // --- Trạng thái ---
  var trangThai = data.MaKHKhop
    ? TRANG_THAI.DA_THUC_HIEN
    : TRANG_THAI.CHUA_THUC_HIEN;

  // --- Ghi vào sheet ---
  var row = {
    MaGD:         maGD,
    NgayGD:       data.NgayGD instanceof Date ? data.NgayGD : parseDate(data.NgayGD),
    MaDuAn:       data.MaDuAn,
    MaDoiTac:     data.MaDoiTac    || '',
    MaTK:         data.MaTK,
    MaHangMuc:    data.MaHangMuc   || '',
    LoaiThuChi:   loai,
    SoTien:       soTien,
    LoaiChungTu:  loaiChungTu,
    SoChungTu:    soChungTu,
    NguoiNopThu:  data.NguoiNopThu || '',
    MaKHKhop:     data.MaKHKhop    || '',
    GhiChu:       data.GhiChu      || '',
    TrangThai:    trangThai
  };
  appendRow(SHEET_NAMES.GIAO_DICH, row);

  // --- Cảnh báo tồn quỹ sau khi ghi ---
  if (laTienMat) {
    var soDuSau = soDuHienTai_(data.MaTK);
    if (kiemTraHanMucTonQuy_(data.MaTK, soDuSau)) {
      try { guiCanhBaoTonQuy_(); } catch (e) { Logger.log('Telegram chưa cấu hình: ' + e.message); }
    }
  }

  return { ok: true, id: maGD, soChungTu: soChungTu || undefined };
}

// ------------------------------------------------------------
// DANH SÁCH GIAO DỊCH
// ------------------------------------------------------------

/**
 * Lấy danh sách giao dịch, áp filter, sắp xếp NgayGD giảm dần.
 * @param {Object} filter { maDuAn?, maTK?, tuNgay?, denNgay?, loaiThuChi? }
 * @returns {Object[]}
 */
function danhSachGiaoDich(filter) {
  filter = filter || {};
  var rows = readRows(SHEET_NAMES.GIAO_DICH);

  // Chuẩn hóa ngày filter
  var tuNgay  = filter.tuNgay  ? (filter.tuNgay  instanceof Date ? filter.tuNgay  : parseDate(filter.tuNgay))  : null;
  var denNgay = filter.denNgay ? (filter.denNgay instanceof Date ? filter.denNgay : parseDate(filter.denNgay)) : null;
  // denNgay tính đến hết ngày đó
  if (denNgay) { denNgay = new Date(denNgay); denNgay.setHours(23, 59, 59, 999); }

  rows = rows.filter(function(r) {
    if (filter.maDuAn    && r.MaDuAn    !== filter.maDuAn)    return false;
    if (filter.maTK      && r.MaTK      !== filter.maTK)      return false;
    if (filter.loaiThuChi && r.LoaiThuChi !== filter.loaiThuChi) return false;
    var ngay = r.NgayGD instanceof Date ? r.NgayGD : parseDate(r.NgayGD);
    if (tuNgay  && ngay < tuNgay)  return false;
    if (denNgay && ngay > denNgay) return false;
    return true;
  });

  // Sắp xếp NgayGD giảm dần (mới nhất lên trên)
  rows.sort(function(a, b) {
    var da = a.NgayGD instanceof Date ? a.NgayGD : parseDate(a.NgayGD);
    var db = b.NgayGD instanceof Date ? b.NgayGD : parseDate(b.NgayGD);
    return db - da;
  });

  return rows;
}

// ------------------------------------------------------------
// XÓA GIAO DỊCH
// ------------------------------------------------------------

/**
 * Soft delete giao dịch.
 * Không cho phép xóa nếu đang khớp kế hoạch.
 * @returns {{ ok: boolean }}
 */
function xoaGiaoDich(maGD) {
  var rows = readRows(SHEET_NAMES.GIAO_DICH);
  var gd = rows.filter(function(r) { return r.MaGD === maGD; })[0];

  if (!gd) throw new Error('Không tìm thấy giao dịch: ' + maGD);
  if (gd.MaKHKhop) {
    throw new Error(
      'Không thể xóa giao dịch đang khớp kế hoạch ' + gd.MaKHKhop +
      '. Hãy hủy khớp trước.'
    );
  }

  softDelete(SHEET_NAMES.GIAO_DICH, maGD);
  return { ok: true };
}

// ------------------------------------------------------------
// SỐ DƯ TÀI KHOẢN
// ------------------------------------------------------------

/**
 * Tính số dư tài khoản: SoDuDauKy + Σ Thu - Σ Chi (bỏ DaXoa).
 * Đọc DM_TaiKhoan + GiaoDich mỗi lần 1 lần — không gọi API trong loop.
 * @private
 */
function soDuHienTai_(maTK) {
  return soDuTheoTK_()[maTK] || 0;
}

/**
 * Tính số dư tất cả tài khoản trong 1 lần đọc sheet.
 * @returns {{ [maTK]: number }}
 * @private
 */
function soDuTheoTK_() {
  // Khởi tạo từ SoDuDauKy
  var tkRows = readRows(SHEET_NAMES.DM_TAI_KHOAN);
  var soDu = {};
  tkRows.forEach(function(tk) {
    soDu[tk.MaTK] = Number(tk.SoDuDauKy) || 0;
  });

  // Cộng/trừ tất cả giao dịch (đọc 1 lần)
  var gdRows = readRows(SHEET_NAMES.GIAO_DICH);
  gdRows.forEach(function(gd) {
    if (!soDu.hasOwnProperty(gd.MaTK)) soDu[gd.MaTK] = 0;
    var soTien = Number(gd.SoTien) || 0;
    if (gd.LoaiThuChi === LOAI_THU_CHI.THU) {
      soDu[gd.MaTK] += soTien;
    } else {
      soDu[gd.MaTK] -= soTien;
    }
  });

  return soDu;
}

// ------------------------------------------------------------
// SỔ QUỸ TIỀN MẶT
// ------------------------------------------------------------

/**
 * Trả về sổ quỹ tiền mặt theo kỳ với số dư lũy kế từng dòng.
 * Dòng đầu tiên là "Số dư đầu kỳ".
 * @param {Date} tuNgay
 * @param {Date} denNgay
 * @returns {Object[]}
 */
function soQuyTienMat(tuNgay, denNgay) {
  tuNgay  = tuNgay  instanceof Date ? tuNgay  : parseDate(tuNgay);
  denNgay = denNgay instanceof Date ? denNgay : parseDate(denNgay);

  // Lấy SoDuDauKy của tài khoản Tiền mặt
  var tkRows = readRows(SHEET_NAMES.DM_TAI_KHOAN);
  var tkTM   = tkRows.filter(function(r) { return r.MaTK === TAI_KHOAN.TIEN_MAT; })[0];
  var soDuDauKy = tkTM ? (Number(tkTM.SoDuDauKy) || 0) : 0;

  // Tất cả giao dịch tiền mặt, sắp xếp ngày tăng dần
  var tatCaGD = readRows(SHEET_NAMES.GIAO_DICH)
    .filter(function(r) { return r.MaTK === TAI_KHOAN.TIEN_MAT; })
    .sort(function(a, b) {
      var da = a.NgayGD instanceof Date ? a.NgayGD : parseDate(a.NgayGD);
      var db = b.NgayGD instanceof Date ? b.NgayGD : parseDate(b.NgayGD);
      return da - db;
    });

  // Tính số dư tích lũy trước kỳ chọn
  var soDuTruocKy = soDuDauKy;
  tatCaGD.forEach(function(gd) {
    var ngay = gd.NgayGD instanceof Date ? gd.NgayGD : parseDate(gd.NgayGD);
    ngay.setHours(0, 0, 0, 0);
    if (ngay < tuNgay) {
      var soTien = Number(gd.SoTien) || 0;
      soDuTruocKy += gd.LoaiThuChi === LOAI_THU_CHI.THU ? soTien : -soTien;
    }
  });

  // Giao dịch trong kỳ
  var denNgayCuoiNgay = new Date(denNgay); denNgayCuoiNgay.setHours(23, 59, 59, 999);
  var gdTrongKy = tatCaGD.filter(function(gd) {
    var ngay = gd.NgayGD instanceof Date ? gd.NgayGD : parseDate(gd.NgayGD);
    return ngay >= tuNgay && ngay <= denNgayCuoiNgay;
  });

  // Xây dựng sổ quỹ
  var result = [];

  // Dòng đầu: số dư đầu kỳ
  result.push({
    _type:        'dau_ky',
    NgayGD:       formatDate(tuNgay),
    SoChungTu:    '',
    GhiChu:       'Số dư đầu kỳ (' + formatDate(tuNgay) + ')',
    SoTienThu:    '',
    SoTienChi:    '',
    SoDuSauGD:    soDuTruocKy
  });

  // Các dòng phát sinh
  var running = soDuTruocKy;
  gdTrongKy.forEach(function(gd) {
    var soTien = Number(gd.SoTien) || 0;
    var laThu  = gd.LoaiThuChi === LOAI_THU_CHI.THU;
    running += laThu ? soTien : -soTien;

    result.push({
      _type:       'phat_sinh',
      MaGD:        gd.MaGD,
      NgayGD:      formatDate(gd.NgayGD instanceof Date ? gd.NgayGD : parseDate(gd.NgayGD)),
      SoChungTu:   gd.SoChungTu   || '',
      MaDuAn:      gd.MaDuAn      || '',
      MaHangMuc:   gd.MaHangMuc   || '',
      NguoiNopThu: gd.NguoiNopThu || '',
      GhiChu:      gd.GhiChu      || '',
      SoTienThu:   laThu  ? soTien : '',
      SoTienChi:   !laThu ? soTien : '',
      SoDuSauGD:   running
    });
  });

  return result;
}

// ------------------------------------------------------------
// KIỂM TRA HẠN MỨC TỒN QUỸ
// ------------------------------------------------------------

/**
 * Trả về true nếu soDuMoi < HanMucToiThieu của tài khoản.
 * @private
 */
function kiemTraHanMucTonQuy_(maTK, soDuMoi) {
  var tkRows = readRows(SHEET_NAMES.DM_TAI_KHOAN);
  var tk = tkRows.filter(function(r) { return r.MaTK === maTK; })[0];
  if (!tk) return false;
  var hanMuc = Number(tk.HanMucToiThieu) || 0;
  return soDuMoi < hanMuc;
}
