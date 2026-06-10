// ============================================================
// FormServer.gs — Entry point Web App + API layer cho frontend
// Phụ thuộc: tất cả .gs còn lại
// ============================================================

// ─────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────

/**
 * doGet: nếu có ?action=xxx → REST API (cho GitHub Pages).
 * Nếu không có action → phục vụ HTML app (GAS web app mode).
 */
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;

  if (!action) {
    // GAS web app mode (fallback)
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('LAVIPCO — Quản lý Dòng tiền')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // REST API mode — GitHub Pages gọi qua fetch()
  try {
    var p = e.parameter;
    var result;
    switch (action) {
      case 'getOverviewData':    result = getOverviewData(); break;
      case 'getForecastData':    result = getForecastData(); break;
      case 'getProjectList':     result = getProjectList(); break;
      case 'getAccountList':     result = getAccountList(); break;
      case 'getPartnerList':     result = getPartnerList(); break;
      case 'getCategoryList':    result = getCategoryList(); break;
      case 'getPlanList':        result = getPlanList(p.maDuAn); break;
      case 'getTransactionList':
        result = getTransactionList({
          maDuAn: p.maDuAn, maTK: p.maTK,
          loaiThuChi: p.loaiThuChi, tuNgay: p.tuNgay, denNgay: p.denNgay
        });
        break;
      case 'getCashBook':        result = getCashBook(p.tuNgay, p.denNgay); break;
      case 'getCongNo':          result = getCongNo(); break;
      case 'getProjectReport':   result = getProjectReport(p.maDuAn); break;
      case 'getDocumentList':    result = getDocumentList(p.maDuAn || null); break;
      default: throw new Error('Unknown action: ' + action);
    }
    return jsonResponse_({ ok: true, data: result });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

/**
 * doPost: tất cả thao tác ghi (submit, delete, import…).
 * Body: JSON { action, ...params }
 */
function doPost(e) {
  try {
    var body   = JSON.parse(e.postData.contents);
    var action = body.action;
    var result;
    switch (action) {
      case 'submitTransaction':    result = submitTransaction(body.data); break;
      case 'deleteTransaction':    result = deleteTransaction(body.maGD); break;
      case 'submitKhopKeHoach':    result = submitKhopKeHoach(body.maKH, body.maGD); break;
      case 'submitHuyKhop':        result = submitHuyKhop(body.maKH); break;
      case 'importBankStatement':  result = importBankStatement(body.csvText, body.maTK); break;
      case 'confirmImport':        result = confirmImport(body.rows, body.maTK, body.maDuAn); break;
      case 'classifyDocument':     result = classifyDocument(body.tenFile, body.contentBase64); break;
      case 'saveDocumentMeta':     result = saveDocumentMeta(body.data); break;
      case 'confirmDocumentSaved': result = confirmDocumentSaved(body.maHoSo); break;
      default: throw new Error('Unknown action: ' + action);
    }
    return jsonResponse_({ ok: true, data: result });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

/** Helper: trả về JSON response */
function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Helper: nhúng file HTML (dùng khi chạy GAS web app mode) */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD / TỔNG QUAN
// ─────────────────────────────────────────────────────────────

/**
 * Dữ liệu tổng quan cho Dashboard tab.
 * @returns {{ soDuTheoTK, congNo, tonQuyTienMat, hanMucTienMat, soThangAmForecast, denHan7Ngay }}
 */
function getOverviewData() {
  var soDuMap = soDuTheoTK_();

  // Hạn mức tồn quỹ tiền mặt
  var tkRows   = readRows(SHEET_NAMES.DM_TAI_KHOAN);
  var tkTM     = tkRows.filter(function(r) { return r.MaTK === TAI_KHOAN.TIEN_MAT; })[0];
  var hanMucTM = tkTM ? (Number(tkTM.HanMucToiThieu) || 0) : 0;

  // Công nợ tổng hợp
  var cn = congNo();

  // Số tháng âm từ Forecast sheet
  var soThangAm = 0;
  try {
    var fSheet  = getSheet_(SHEET_NAMES.FORECAST);
    var lastRow = fSheet.getLastRow();
    if (lastRow >= FORECAST_DATA_START) {
      var fData = fSheet.getRange(FORECAST_DATA_START, 5, FORECAST_MONTHS, 1).getValues();
      fData.forEach(function(r) { if ((Number(r[0]) || 0) < 0) soThangAm++; });
    }
  } catch (e) { /* Forecast chưa có dữ liệu — bỏ qua */ }

  // KeHoach đến hạn 7 ngày
  var today  = getToday();
  var cutoff = addDays(today, NGAY_CANH_BAO_DEN_HAN);
  var duAnMap = {};
  readRows(SHEET_NAMES.DM_DU_AN).forEach(function(d) { duAnMap[d.MaDuAn] = d.TenDuAn; });

  var denHan7 = readRows(SHEET_NAMES.KE_HOACH)
    .filter(function(r) {
      if (r.TrangThai === TRANG_THAI.DA_THUC_HIEN || r.TrangThai === TRANG_THAI.DA_XOA) return false;
      var ngay = r.NgayDuKien instanceof Date ? r.NgayDuKien : parseDate(r.NgayDuKien);
      return ngay && ngay >= today && ngay <= cutoff;
    })
    .slice(0, 5)
    .map(function(r) {
      var ngay = r.NgayDuKien instanceof Date ? r.NgayDuKien : parseDate(r.NgayDuKien);
      return {
        maKeHoach:  r.MaKeHoach,
        maDuAn:     r.MaDuAn,
        tenDuAn:    duAnMap[r.MaDuAn] || r.MaDuAn,
        loaiThuChi: r.LoaiThuChi,
        soTien:     Number(r.SoTien) || 0,
        ngayDuKien: formatDate(ngay),
        trangThai:  r.TrangThai
      };
    });

  // Chuyển soDuMap thành array cho frontend
  var soDuArr = tkRows.map(function(tk) {
    return {
      maTK:        tk.MaTK,
      tenTK:       tk.TenTK,
      nganHang:    tk.NganHang || '',
      soDu:        soDuMap[tk.MaTK] || 0,
      hanMuc:      Number(tk.HanMucToiThieu) || 0,
      duoiHanMuc:  (soDuMap[tk.MaTK] || 0) < (Number(tk.HanMucToiThieu) || 0)
    };
  });

  return {
    soDuTheoTK:        soDuArr,
    tongSoDu:          Object.keys(soDuMap).reduce(function(s, k) { return s + (soDuMap[k] || 0); }, 0),
    tonQuyTienMat:     soDuMap[TAI_KHOAN.TIEN_MAT] || 0,
    hanMucTienMat:     hanMucTM,
    congNo:            cn,
    soThangAmForecast: soThangAm,
    denHan7Ngay:       denHan7
  };
}

// getForecastData() đã định nghĩa trong Forecast.gs — callable trực tiếp từ frontend.
// getProjectReportData() đã định nghĩa trong ProjectReport.gs — callable trực tiếp.

// ─────────────────────────────────────────────────────────────
// DANH MỤC
// ─────────────────────────────────────────────────────────────

function getProjectList() {
  return readRows(SHEET_NAMES.DM_DU_AN).map(function(r) {
    return { maDuAn: r.MaDuAn, tenDuAn: r.TenDuAn, trangThai: r.TrangThai };
  });
}

function getAccountList() {
  return readRows(SHEET_NAMES.DM_TAI_KHOAN).map(function(r) {
    return { maTK: r.MaTK, tenTK: r.TenTK, nganHang: r.NganHang || '' };
  });
}

function getPartnerList() {
  return readRows(SHEET_NAMES.DM_DOI_TAC).map(function(r) {
    return { maDoiTac: r.MaDoiTac, tenDoiTac: r.TenDoiTac, loaiDoiTac: r.LoaiDoiTac };
  });
}

function getCategoryList() {
  return readRows(SHEET_NAMES.DM_HANG_MUC).map(function(r) {
    return { maHangMuc: r.MaHangMuc, tenHangMuc: r.TenHangMuc, loaiThuChi: r.LoaiThuChi };
  });
}

function getPlanList(maDuAn) {
  var rows = readRows(SHEET_NAMES.KE_HOACH).filter(function(r) {
    if (maDuAn && r.MaDuAn !== maDuAn) return false;
    return r.TrangThai === TRANG_THAI.CHUA_THUC_HIEN;
  });
  return rows.map(function(r) {
    var ngay = r.NgayDuKien instanceof Date ? r.NgayDuKien : parseDate(r.NgayDuKien);
    return {
      maKeHoach:  r.MaKeHoach,
      maDuAn:     r.MaDuAn,
      loaiThuChi: r.LoaiThuChi,
      soTien:     Number(r.SoTien) || 0,
      ngayDuKien: formatDate(ngay),
      ghiChu:     r.GhiChu || ''
    };
  });
}

// ─────────────────────────────────────────────────────────────
// GIAO DỊCH
// ─────────────────────────────────────────────────────────────

function submitTransaction(data) {
  var res = themGiaoDich(data);
  return { ok: res.ok, id: res.id, soChungTu: res.soChungTu || '' };
}

/**
 * @param {Object} filter — { maDuAn?, maTK?, loaiThuChi?, tuNgay?, denNgay? }
 */
function getTransactionList(filter) {
  var rows = danhSachGiaoDich(filter || {});
  return rows.map(function(r) {
    return {
      maGD:         r.MaGD,
      ngayGD:       formatDate(r.NgayGD instanceof Date ? r.NgayGD : parseDate(r.NgayGD)),
      maDuAn:       r.MaDuAn,
      maTK:         r.MaTK,
      maDoiTac:     r.MaDoiTac     || '',
      maHangMuc:    r.MaHangMuc    || '',
      loaiThuChi:   r.LoaiThuChi,
      soTien:       Number(r.SoTien) || 0,
      loaiChungTu:  r.LoaiChungTu  || '',
      soChungTu:    r.SoChungTu    || '',
      nguoiNopThu:  r.NguoiNopThu  || '',
      maKHKhop:     r.MaKHKhop     || '',
      ghiChu:       r.GhiChu       || '',
      trangThai:    r.TrangThai
    };
  });
}

function deleteTransaction(maGD) {
  return xoaGiaoDich(maGD);
}

// ─────────────────────────────────────────────────────────────
// SỔ QUỸ TIỀN MẶT
// ─────────────────────────────────────────────────────────────

function getCashBook(tuNgay, denNgay) {
  return soQuyTienMat(parseDate(tuNgay), parseDate(denNgay));
}

// ─────────────────────────────────────────────────────────────
// KẾ HOẠCH
// ─────────────────────────────────────────────────────────────

function getCongNo() {
  return congNo();
}

function submitKhopKeHoach(maKH, maGD) {
  return khopKeHoach(maKH, maGD);
}

function submitHuyKhop(maKH) {
  return huyKhopKeHoach(maKH);
}

// ─────────────────────────────────────────────────────────────
// BÁO CÁO DỰ ÁN
// ─────────────────────────────────────────────────────────────

function getProjectReport(maDuAn) {
  return getProjectReportData(maDuAn);
}

// ─────────────────────────────────────────────────────────────
// IMPORT SAO KÊ
// ─────────────────────────────────────────────────────────────

function importBankStatement(csvText, maTK) {
  var preview = xemTruocImport(csvText, maTK);
  return { ok: true, preview: preview };
}

function confirmImport(rows, maTK, maDuAn) {
  var res = xacNhanImport(rows, maTK, maDuAn);
  return { ok: res.ok, count: res.soHangDaNhap, skipped: res.soHangBo };
}

// ─────────────────────────────────────────────────────────────
// HỒ SƠ DỰ ÁN
// ─────────────────────────────────────────────────────────────

function classifyDocument(tenFile, contentBase64) {
  return phanLoaiHoSo(tenFile, contentBase64 || '');
}

function saveDocumentMeta(data) {
  return luuMetadataHoSo(data);
}

function confirmDocumentSaved(maHoSo) {
  return xacNhanDaLuu(maHoSo);
}

function getDocumentList(maDuAn) {
  var rows = danhSachHoSo(maDuAn || null);
  return rows.map(function(r) {
    return {
      maHoSo:       r.MaHoSo,
      maDuAn:       r.MaDuAn,
      tenFile:      r.TenFile,
      loaiTaiLieu:  r.LoaiTaiLieu,
      duongDanGoiY: r.DuongDanGoiY || '',
      ngayTao:      formatDate(r.NgayTao instanceof Date ? r.NgayTao : parseDate(r.NgayTao)),
      trangThai:    r.TrangThai,
      ghiChu:       r.GhiChu || ''
    };
  });
}
