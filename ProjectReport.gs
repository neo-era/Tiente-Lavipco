// ============================================================
// ProjectReport.gs — Báo cáo P&L tiền mặt theo dự án
// Phụ thuộc: Config.gs, Utils.gs, Transactions.gs, Planning.gs
// ============================================================

/**
 * Ghi báo cáo P&L vào sheet BaoCao.
 * @param {string|null} maDuAn — null = báo cáo tất cả dự án
 */
function baoCaoDuAn(maDuAn) {
  var sheet = getSheet_(SHEET_NAMES.BAO_CAO);
  sheet.clearContents();
  sheet.clearFormats();
  sheet.getCharts().forEach(function(c) { sheet.removeChart(c); });

  // Đọc tất cả dữ liệu 1 lần — chia sẻ cho mọi dự án
  var duAnRows  = readRows(SHEET_NAMES.DM_DU_AN);
  var hmRows    = readRows(SHEET_NAMES.DM_HANG_MUC);
  var khRows    = readRows(SHEET_NAMES.KE_HOACH);
  var gdRows    = readRows(SHEET_NAMES.GIAO_DICH);

  // Map tra cứu nhanh
  var tenHMMap  = {};
  hmRows.forEach(function(h) { tenHMMap[h.MaHangMuc] = h.TenHangMuc; });

  // Lọc danh sách dự án cần báo cáo
  var dsDuAn = maDuAn
    ? duAnRows.filter(function(d) { return d.MaDuAn === maDuAn; })
    : duAnRows;

  if (dsDuAn.length === 0) {
    sheet.getRange(1, 1).setValue('Không tìm thấy dự án.').setFontColor('#999');
    return;
  }

  // Tiêu đề trang
  var tsRange = sheet.getRange(1, 1, 1, 7);
  tsRange.merge().setValue(
    'BÁO CÁO P&L TIỀN MẶT — LAVIPCO  |  ' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
  ).setFontWeight('bold').setFontSize(12)
   .setBackground('#1967D2').setFontColor('#FFFFFF')
   .setHorizontalAlignment('center');

  var currentRow = 3; // Bắt đầu ghi từ hàng 3

  dsDuAn.forEach(function(duAn) {
    currentRow = ghiSectionDuAn_(
      sheet, duAn, khRows, gdRows, tenHMMap, currentRow
    );
    currentRow += 3; // Khoảng cách giữa 2 dự án
  });

  // AutoResize
  for (var c = 1; c <= 7; c++) sheet.autoResizeColumn(c);
}

// ─────────────────────────────────────────────────────────────
// GHI 1 SECTION DỰ ÁN
// ─────────────────────────────────────────────────────────────

/**
 * Ghi header + P&L + giao dịch gần đây cho 1 dự án.
 * @returns {number} hàng tiếp theo sau khi ghi xong section
 * @private
 */
function ghiSectionDuAn_(sheet, duAn, khRows, gdRows, tenHMMap, startRow) {
  var r = startRow;

  // ── Header dự án ──────────────────────────────────────────
  var hdrRange = sheet.getRange(r, 1, 1, 7);
  hdrRange.merge()
    .setValue(duAn.TenDuAn + '  |  GT HĐ: ' + formatVND(Number(duAn.GiaTriHD) || 0) +
              '  |  Ký: ' + formatDate(duAn.NgayKy instanceof Date ? duAn.NgayKy : parseDate(duAn.NgayKy)) +
              '  |  ' + (duAn.TrangThai || ''))
    .setFontWeight('bold').setFontSize(11)
    .setBackground('#34A853').setFontColor('#FFFFFF');
  r++;

  // ── Tính P&L ──────────────────────────────────────────────
  var pandl = tinhPandL_(duAn.MaDuAn, khRows, gdRows, tenHMMap);
  r = ghiBangPandL_(sheet, pandl, r);
  r++;

  // ── Giao dịch gần đây ─────────────────────────────────────
  r = ghiBangGiaoDichGanDay_(sheet, duAn.MaDuAn, gdRows, tenHMMap, r);

  return r;
}

// ─────────────────────────────────────────────────────────────
// TÍNH P&L (trả về data, không ghi sheet — dùng bởi FormServer)
// ─────────────────────────────────────────────────────────────

/**
 * Tính P&L cho 1 dự án từ KeHoach và GiaoDich.
 * @returns {{ hangMucRows: Object[], tongThu: Object, tongChi: Object, rong: Object }}
 * @private
 */
function tinhPandL_(maDuAn, khRows, gdRows, tenHMMap) {
  // Lọc theo dự án
  var kh = khRows.filter(function(r) {
    return r.MaDuAn === maDuAn && r.TrangThai !== TRANG_THAI.DA_XOA;
  });
  var gd = gdRows.filter(function(r) { return r.MaDuAn === maDuAn; });

  // Group theo MaHangMuc
  function groupByHM(rows, field) {
    var m = {};
    rows.forEach(function(r) {
      var key = r.MaHangMuc || '_KHONG_PHAN_LOAI';
      if (!m[key]) m[key] = 0;
      m[key] += Number(r[field] || r.SoTien) || 0;
    });
    return m;
  }

  var khThuByHM = groupByHM(kh.filter(function(r) { return r.LoaiThuChi === LOAI_THU_CHI.THU; }), 'SoTien');
  var khChiByHM = groupByHM(kh.filter(function(r) { return r.LoaiThuChi === LOAI_THU_CHI.CHI; }), 'SoTien');
  var gdThuByHM = groupByHM(gd.filter(function(r) { return r.LoaiThuChi === LOAI_THU_CHI.THU; }), 'SoTien');
  var gdChiByHM = groupByHM(gd.filter(function(r) { return r.LoaiThuChi === LOAI_THU_CHI.CHI; }), 'SoTien');

  // Tập hợp tất cả MaHangMuc có liên quan
  var allHM = {};
  [khThuByHM, khChiByHM, gdThuByHM, gdChiByHM].forEach(function(m) {
    Object.keys(m).forEach(function(k) { allHM[k] = true; });
  });

  // Xây dựng rows P&L — Thu trước, Chi sau
  var thuRows = [], chiRows = [];

  Object.keys(allHM).forEach(function(hmKey) {
    var tenHM = tenHMMap[hmKey] || (hmKey === '_KHONG_PHAN_LOAI' ? '(Chưa phân loại)' : hmKey);
    var isThu = !!(khThuByHM[hmKey] || gdThuByHM[hmKey]);
    var isChi = !!(khChiByHM[hmKey] || gdChiByHM[hmKey]);

    if (isThu) {
      thuRows.push({
        tenChiTieu: tenHM,
        keHoach:    khThuByHM[hmKey] || 0,
        thucTe:     gdThuByHM[hmKey] || 0,
        loai:       'Thu'
      });
    }
    if (isChi) {
      chiRows.push({
        tenChiTieu: tenHM,
        keHoach:    khChiByHM[hmKey] || 0,
        thucTe:     gdChiByHM[hmKey] || 0,
        loai:       'Chi'
      });
    }
  });

  // Tổng
  function sum(arr, field) { return arr.reduce(function(s, r) { return s + r[field]; }, 0); }
  var tongKHThu = sum(thuRows, 'keHoach');
  var tongTTThu = sum(thuRows, 'thucTe');
  var tongKHChi = sum(chiRows, 'keHoach');
  var tongTTChi = sum(chiRows, 'thucTe');

  return {
    thuRows:    thuRows,
    chiRows:    chiRows,
    tongThu:    { keHoach: tongKHThu, thucTe: tongTTThu },
    tongChi:    { keHoach: tongKHChi, thucTe: tongTTChi },
    rong:       { keHoach: tongKHThu - tongKHChi, thucTe: tongTTThu - tongTTChi }
  };
}

// ─────────────────────────────────────────────────────────────
// GHI BẢNG P&L
// ─────────────────────────────────────────────────────────────

function ghiBangPandL_(sheet, pandl, startRow) {
  var r = startRow;

  // Header bảng
  sheet.getRange(r, 1, 1, 4).setValues([['Chỉ tiêu', 'Kế hoạch', 'Thực tế', '% TH']]);
  sheet.getRange(r, 1, 1, 4)
       .setFontWeight('bold').setBackground('#E8F0FE')
       .setHorizontalAlignment('center');
  r++;

  function pct(thucTe, keHoach) {
    if (!keHoach || keHoach === 0) return thucTe > 0 ? '100%+' : '—';
    return Math.round(thucTe / keHoach * 100) + '%';
  }

  // Hàng Thu
  pandl.thuRows.forEach(function(row) {
    sheet.getRange(r, 1).setValue(row.tenChiTieu);
    sheet.getRange(r, 2).setValue(row.keHoach).setNumberFormat('#,##0').setHorizontalAlignment('right');
    sheet.getRange(r, 3).setValue(row.thucTe).setNumberFormat('#,##0').setHorizontalAlignment('right');
    sheet.getRange(r, 4).setValue(pct(row.thucTe, row.keHoach)).setHorizontalAlignment('center');
    sheet.getRange(r, 1, 1, 4).setBackground('#F0FFF4'); // Xanh nhạt cho Thu
    r++;
  });

  // Hàng Chi
  pandl.chiRows.forEach(function(row) {
    sheet.getRange(r, 1).setValue(row.tenChiTieu);
    sheet.getRange(r, 2).setValue(row.keHoach).setNumberFormat('#,##0').setHorizontalAlignment('right');
    sheet.getRange(r, 3).setValue(row.thucTe).setNumberFormat('#,##0').setHorizontalAlignment('right');
    sheet.getRange(r, 4).setValue(pct(row.thucTe, row.keHoach)).setHorizontalAlignment('center');
    sheet.getRange(r, 1, 1, 4).setBackground('#FFF8F0'); // Cam nhạt cho Chi
    r++;
  });

  // ── Dòng TỔNG THU ──
  sheet.getRange(r, 1).setValue('TỔNG THU');
  sheet.getRange(r, 2).setValue(pandl.tongThu.keHoach).setNumberFormat('#,##0').setHorizontalAlignment('right');
  sheet.getRange(r, 3).setValue(pandl.tongThu.thucTe).setNumberFormat('#,##0').setHorizontalAlignment('right');
  sheet.getRange(r, 4).setValue(pct(pandl.tongThu.thucTe, pandl.tongThu.keHoach)).setHorizontalAlignment('center');
  sheet.getRange(r, 1, 1, 4).setFontWeight('bold').setBackground('#FFF9C4'); // Vàng nhạt
  r++;

  // ── Dòng TỔNG CHI ──
  sheet.getRange(r, 1).setValue('TỔNG CHI');
  sheet.getRange(r, 2).setValue(pandl.tongChi.keHoach).setNumberFormat('#,##0').setHorizontalAlignment('right');
  sheet.getRange(r, 3).setValue(pandl.tongChi.thucTe).setNumberFormat('#,##0').setHorizontalAlignment('right');
  sheet.getRange(r, 4).setValue(pct(pandl.tongChi.thucTe, pandl.tongChi.keHoach)).setHorizontalAlignment('center');
  sheet.getRange(r, 1, 1, 4).setFontWeight('bold').setBackground('#FFF9C4');
  r++;

  // ── Dòng RÒNG ──
  var rongKH = pandl.rong.keHoach;
  var rongTT = pandl.rong.thucTe;
  sheet.getRange(r, 1).setValue('RÒNG (Thu – Chi)');
  sheet.getRange(r, 2).setValue(rongKH).setNumberFormat('#,##0').setHorizontalAlignment('right');
  sheet.getRange(r, 3).setValue(rongTT).setNumberFormat('#,##0').setHorizontalAlignment('right');
  sheet.getRange(r, 4).setValue(pct(rongTT, rongKH)).setHorizontalAlignment('center');

  var rongBg    = rongTT >= 0 ? '#FFF9C4' : '#FFE0E0';
  var rongColor = rongTT >= 0 ? '#137333' : '#D93025';
  sheet.getRange(r, 1, 1, 4).setFontWeight('bold').setBackground(rongBg);
  sheet.getRange(r, 3).setFontColor(rongColor);
  r++;

  return r;
}

// ─────────────────────────────────────────────────────────────
// GHI BẢNG GIAO DỊCH GẦN ĐÂY
// ─────────────────────────────────────────────────────────────

function ghiBangGiaoDichGanDay_(sheet, maDuAn, gdRows, tenHMMap, startRow) {
  var r = startRow;

  // Header section
  sheet.getRange(r, 1, 1, 6).merge()
    .setValue('10 GIAO DỊCH GẦN NHẤT')
    .setFontWeight('bold').setBackground('#F1F3F4')
    .setHorizontalAlignment('left');
  r++;

  // Header bảng
  sheet.getRange(r, 1, 1, 6)
    .setValues([['Ngày GD', 'Thu/Chi', 'Số tiền', 'Hạng mục', 'Số chứng từ', 'Ghi chú']])
    .setFontWeight('bold').setBackground('#E8F0FE');
  r++;

  // Lọc + sắp xếp
  var gdDuAn = gdRows
    .filter(function(gd) { return gd.MaDuAn === maDuAn; })
    .sort(function(a, b) {
      var da = a.NgayGD instanceof Date ? a.NgayGD : parseDate(a.NgayGD);
      var db = b.NgayGD instanceof Date ? b.NgayGD : parseDate(b.NgayGD);
      return db - da;
    })
    .slice(0, 10);

  if (gdDuAn.length === 0) {
    sheet.getRange(r, 1).setValue('(Chưa có giao dịch)').setFontColor('#999999');
    return r + 1;
  }

  gdDuAn.forEach(function(gd) {
    var ngay   = gd.NgayGD instanceof Date ? gd.NgayGD : parseDate(gd.NgayGD);
    var laThu  = gd.LoaiThuChi === LOAI_THU_CHI.THU;

    sheet.getRange(r, 1).setValue(formatDate(ngay)).setHorizontalAlignment('center');
    sheet.getRange(r, 2).setValue(gd.LoaiThuChi).setHorizontalAlignment('center')
         .setFontColor(laThu ? '#137333' : '#D93025');
    sheet.getRange(r, 3).setValue(Number(gd.SoTien) || 0)
         .setNumberFormat('#,##0').setHorizontalAlignment('right')
         .setFontColor(laThu ? '#137333' : '#D93025');
    sheet.getRange(r, 4).setValue(tenHMMap[gd.MaHangMuc] || gd.MaHangMuc || '—');
    sheet.getRange(r, 5).setValue(gd.SoChungTu || '—').setHorizontalAlignment('center');
    sheet.getRange(r, 6).setValue(gd.GhiChu || '');

    // Zebra stripe
    if (r % 2 === 0) sheet.getRange(r, 1, 1, 6).setBackground('#F8F9FA');
    r++;
  });

  return r;
}

// ─────────────────────────────────────────────────────────────
// API CHO FORMSERVER (trả data, không ghi sheet)
// ─────────────────────────────────────────────────────────────

/**
 * Tính P&L cho frontend — không ghi vào sheet BaoCao.
 * @param {string} maDuAn
 * @returns {Object} { duAn, pandl, gdGanDay }
 */
function getProjectReportData(maDuAn) {
  var duAnRows = readRows(SHEET_NAMES.DM_DU_AN);
  var hmRows   = readRows(SHEET_NAMES.DM_HANG_MUC);
  var khRows   = readRows(SHEET_NAMES.KE_HOACH);
  var gdRows   = readRows(SHEET_NAMES.GIAO_DICH);

  var duAn = duAnRows.filter(function(d) { return d.MaDuAn === maDuAn; })[0];
  if (!duAn) throw new Error('Không tìm thấy dự án: ' + maDuAn);

  var tenHMMap = {};
  hmRows.forEach(function(h) { tenHMMap[h.MaHangMuc] = h.TenHangMuc; });

  var pandl = tinhPandL_(maDuAn, khRows, gdRows, tenHMMap);

  // 10 giao dịch gần nhất (plain data)
  var gdGanDay = gdRows
    .filter(function(gd) { return gd.MaDuAn === maDuAn; })
    .sort(function(a, b) {
      var da = a.NgayGD instanceof Date ? a.NgayGD : parseDate(a.NgayGD);
      var db = b.NgayGD instanceof Date ? b.NgayGD : parseDate(b.NgayGD);
      return db - da;
    })
    .slice(0, 10)
    .map(function(gd) {
      return {
        ngayGD:     formatDate(gd.NgayGD instanceof Date ? gd.NgayGD : parseDate(gd.NgayGD)),
        loaiThuChi: gd.LoaiThuChi,
        soTien:     Number(gd.SoTien) || 0,
        tenHangMuc: tenHMMap[gd.MaHangMuc] || '—',
        soChungTu:  gd.SoChungTu || '—',
        ghiChu:     gd.GhiChu    || ''
      };
    });

  return {
    duAn:     duAn,
    pandl:    pandl,
    gdGanDay: gdGanDay
  };
}
