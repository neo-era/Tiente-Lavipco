// ============================================================
// Dashboard.gs — Tổng quan số dư, công nợ, dòng tiền
// Phụ thuộc: Config.gs, Utils.gs, Transactions.gs, Planning.gs
// ============================================================

// Vị trí layout cố định trên sheet Dashboard
var DB_TIMESTAMP_ROW  = 1;
var DB_BLOCK1_ROW     = 3;   // Số dư tài khoản (A-C)
var DB_BLOCK2_ROW     = 3;   // Công nợ (E-G)
var DB_BLOCK3_ROW     = 12;  // Top 5 dự án (A-C)
var DB_CHART_DATA_ROW = 20;  // Dữ liệu 12 tháng (A-C, ẩn) → nguồn biểu đồ
var DB_CHART_POS_ROW  = 8;   // Biểu đồ đặt tại cột E, hàng 8

/**
 * Tính toán và ghi toàn bộ nội dung Dashboard.
 * Được gọi bởi trigger 7h sáng và từ menu.
 */
function capNhatDashboard() {
  var sheet = getSheet_(SHEET_NAMES.DASHBOARD);

  // Xóa nội dung + format, giữ chart
  sheet.clearContents();
  sheet.clearFormats();

  // Thu thập dữ liệu — mỗi nguồn đọc sheet 1 lần
  var soDuMap    = soDuTheoTK_();
  var tkRows     = readRows(SHEET_NAMES.DM_TAI_KHOAN);
  var congNoData = congNo();
  var gdRows     = readRows(SHEET_NAMES.GIAO_DICH);

  // ── Timestamp ─────────────────────────────────────────────
  var tsCell = sheet.getRange(DB_TIMESTAMP_ROW, 1, 1, 12);
  tsCell.merge();
  tsCell.setValue(
    'DASHBOARD DÒNG TIỀN — LAVIPCO  |  Cập nhật lúc: ' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
  );
  tsCell.setFontWeight('bold').setFontSize(12)
        .setBackground('#1967D2').setFontColor('#FFFFFF')
        .setHorizontalAlignment('center');

  // ── KHỐI 1: Số dư tài khoản (cột A–C) ────────────────────
  ghiKhoi1SoDuTK_(sheet, tkRows, soDuMap, gdRows);

  // ── KHỐI 2: Công nợ (cột E–G) ────────────────────────────
  ghiKhoi2CongNo_(sheet, congNoData);

  // ── KHỐI 3: Top 5 dự án phải thu (cột A–C, hàng 12+) ─────
  ghiKhoi3Top5_(sheet, congNoData, gdRows);

  // ── KHỐI 4: Dữ liệu + biểu đồ 12 tháng (cột E–L, hàng 8+)
  ghiKhoi4BieudDo12Thang_(sheet, gdRows);

  // AutoResize
  [1,2,3,5,6,7].forEach(function(c) { sheet.autoResizeColumn(c); });
}

// ─────────────────────────────────────────────────────────────
// KHỐI 1 — Số dư tài khoản
// ─────────────────────────────────────────────────────────────
function ghiKhoi1SoDuTK_(sheet, tkRows, soDuMap, gdRows) {
  var r = DB_BLOCK1_ROW;

  // Header
  var hdr = sheet.getRange(r, 1, 1, 3);
  hdr.merge().setValue('SỐ DƯ TÀI KHOẢN')
     .setFontWeight('bold').setBackground('#E8F0FE').setHorizontalAlignment('center');
  r++;

  // Sub-header
  sheet.getRange(r, 1).setValue('Tài khoản').setFontWeight('bold');
  sheet.getRange(r, 2).setValue('Số dư hiện tại').setFontWeight('bold');
  sheet.getRange(r, 3).setValue('So tháng trước').setFontWeight('bold');
  r++;

  // Dữ liệu từng tài khoản
  var dauThangNay = new Date(getToday().getFullYear(), getToday().getMonth(), 1);

  tkRows.forEach(function(tk) {
    var soDuHienTai = soDuMap[tk.MaTK] || 0;

    // Tính số dư đầu tháng này (= số dư trước ngày 1 tháng hiện tại)
    var soDuDauThang = Number(tk.SoDuDauKy) || 0;
    gdRows.forEach(function(gd) {
      if (gd.MaTK !== tk.MaTK) return;
      var ngay = gd.NgayGD instanceof Date ? gd.NgayGD : parseDate(gd.NgayGD);
      if (!ngay || ngay >= dauThangNay) return;
      var st = Number(gd.SoTien) || 0;
      soDuDauThang += gd.LoaiThuChi === LOAI_THU_CHI.THU ? st : -st;
    });

    var pctThayDoi = soDuDauThang !== 0
      ? ((soDuHienTai - soDuDauThang) / Math.abs(soDuDauThang) * 100).toFixed(1) + '%'
      : '—';
    var laTienMat  = tk.MaTK === TAI_KHOAN.TIEN_MAT;
    var hanMuc     = Number(tk.HanMucToiThieu) || 0;
    var duoiHanMuc = laTienMat && soDuHienTai < hanMuc;

    sheet.getRange(r, 1).setValue(tk.TenTK);
    sheet.getRange(r, 2).setValue(formatVND(soDuHienTai))
         .setHorizontalAlignment('right');
    sheet.getRange(r, 3).setValue(pctThayDoi)
         .setHorizontalAlignment('right')
         .setFontColor(soDuHienTai >= soDuDauThang ? '#137333' : '#D93025');

    if (duoiHanMuc) {
      sheet.getRange(r, 1, 1, 3).setBackground('#FFE0E0');
      sheet.getRange(r, 1).setValue('⚠️ ' + tk.TenTK);
    }
    r++;
  });

  // Tổng
  var tongSoDu = Object.keys(soDuMap).reduce(function(s, k) { return s + (soDuMap[k] || 0); }, 0);
  sheet.getRange(r, 1).setValue('TỔNG').setFontWeight('bold');
  sheet.getRange(r, 2).setValue(formatVND(tongSoDu))
       .setFontWeight('bold').setHorizontalAlignment('right');
  sheet.getRange(r, 1, 1, 3).setBackground('#F8F9FA');
}

// ─────────────────────────────────────────────────────────────
// KHỐI 2 — Công nợ
// ─────────────────────────────────────────────────────────────
function ghiKhoi2CongNo_(sheet, congNoData) {
  var r = DB_BLOCK2_ROW;

  // Header
  var hdr = sheet.getRange(r, 5, 1, 3);
  hdr.merge().setValue('CÔNG NỢ')
     .setFontWeight('bold').setBackground('#E8F0FE').setHorizontalAlignment('center');
  r++;

  // Sub-header
  sheet.getRange(r, 5).setValue('Loại').setFontWeight('bold');
  sheet.getRange(r, 6).setValue('Số khoản').setFontWeight('bold');
  sheet.getRange(r, 7).setValue('Tổng tiền').setFontWeight('bold');
  r++;

  function tongHop(arr) {
    return arr.reduce(function(acc, g) {
      acc.soKhoan += g.soKhoan;
      acc.tongTien += g.tongTien;
      acc.soKhoanQuaHan += g.soKhoanQuaHan;
      return acc;
    }, { soKhoan: 0, tongTien: 0, soKhoanQuaHan: 0 });
  }

  var thu = tongHop(congNoData.phaiThu);
  var tra = tongHop(congNoData.phaiTra);

  var rows = [
    { label: 'Phải thu',      soKhoan: thu.soKhoan,         tongTien: thu.tongTien,         red: false },
    { label: 'Phải trả',      soKhoan: tra.soKhoan,         tongTien: tra.tongTien,         red: false },
    { label: '⚠️ Quá hạn thu', soKhoan: thu.soKhoanQuaHan,  tongTien: 0,                    red: true  },
    { label: '⚠️ Quá hạn trả', soKhoan: tra.soKhoanQuaHan,  tongTien: 0,                    red: true  }
  ];

  // Tính tổng tiền quá hạn từ dữ liệu chi tiết
  congNoData.phaiThu.forEach(function(g) {
    if (g.soKhoanQuaHan > 0) rows[2].tongTien += g.tongTien;
  });
  congNoData.phaiTra.forEach(function(g) {
    if (g.soKhoanQuaHan > 0) rows[3].tongTien += g.tongTien;
  });

  rows.forEach(function(item) {
    sheet.getRange(r, 5).setValue(item.label);
    sheet.getRange(r, 6).setValue(item.soKhoan).setHorizontalAlignment('center');
    sheet.getRange(r, 7).setValue(formatVND(item.tongTien)).setHorizontalAlignment('right');
    if (item.red && item.soKhoan > 0) {
      sheet.getRange(r, 5, 1, 3).setBackground('#FFE0E0').setFontColor('#D93025');
    }
    r++;
  });
}

// ─────────────────────────────────────────────────────────────
// KHỐI 3 — Top 5 dự án phải thu
// ─────────────────────────────────────────────────────────────
function ghiKhoi3Top5_(sheet, congNoData, gdRows) {
  var r = DB_BLOCK3_ROW;

  // Header
  var hdr = sheet.getRange(r, 1, 1, 3);
  hdr.merge().setValue('TOP 5 DỰ ÁN PHẢI THU LỚN NHẤT')
     .setFontWeight('bold').setBackground('#E8F0FE').setHorizontalAlignment('center');
  r++;

  sheet.getRange(r, 1).setValue('Dự án').setFontWeight('bold');
  sheet.getRange(r, 2).setValue('Phải thu').setFontWeight('bold');
  sheet.getRange(r, 3).setValue('% đã thu').setFontWeight('bold');
  r++;

  // Tổng thu thực từ GiaoDich theo dự án
  var daThucTheoDA = {};
  gdRows.forEach(function(gd) {
    if (gd.LoaiThuChi !== LOAI_THU_CHI.THU) return;
    if (!daThucTheoDA[gd.MaDuAn]) daThucTheoDA[gd.MaDuAn] = 0;
    daThucTheoDA[gd.MaDuAn] += Number(gd.SoTien) || 0;
  });

  // Lấy top 5 từ phaiThu (đã sort theo tongTien giảm dần bởi congNo())
  var top5 = congNoData.phaiThu.slice(0, 5);
  if (top5.length === 0) {
    sheet.getRange(r, 1).setValue('(Không có công nợ phải thu)').setFontColor('#999999');
    return;
  }

  top5.forEach(function(g) {
    var daThuc = daThucTheoDA[g.maDuAn] || 0;
    var tongKH = g.tongTien + daThuc; // Tổng kế hoạch = đã thu + còn phải thu
    var pct = tongKH > 0 ? Math.round(daThuc / tongKH * 100) + '%' : '—';

    sheet.getRange(r, 1).setValue(g.tenDuAn);
    sheet.getRange(r, 2).setValue(formatVND(g.tongTien)).setHorizontalAlignment('right');
    sheet.getRange(r, 3).setValue(pct).setHorizontalAlignment('center');
    r++;
  });
}

// ─────────────────────────────────────────────────────────────
// KHỐI 4 — Biểu đồ dòng tiền 12 tháng
// ─────────────────────────────────────────────────────────────
function ghiKhoi4BieudDo12Thang_(sheet, gdRows) {
  // Tính Thu/Chi 12 tháng qua
  var now     = getToday();
  var months  = [];
  var thuMap  = {};
  var chiMap  = {};

  for (var i = 11; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var key = toYearMonth(d);
    months.push({ key: key, label: formatThang(d) });
    thuMap[key] = 0;
    chiMap[key] = 0;
  }

  gdRows.forEach(function(gd) {
    var ngay = gd.NgayGD instanceof Date ? gd.NgayGD : parseDate(gd.NgayGD);
    if (!ngay) return;
    var key = toYearMonth(ngay);
    if (!thuMap.hasOwnProperty(key)) return;
    var st = Number(gd.SoTien) || 0;
    if (gd.LoaiThuChi === LOAI_THU_CHI.THU) thuMap[key] += st;
    else                                     chiMap[key] += st;
  });

  // Ghi dữ liệu nguồn (ẩn phía dưới bảng, dùng bởi biểu đồ)
  var dataStartRow = DB_CHART_DATA_ROW;
  sheet.getRange(dataStartRow, 1, 1, 3).setValues([['Tháng', 'Thu thực', 'Chi thực']]);
  var chartData = months.map(function(m) {
    return [m.label, thuMap[m.key], chiMap[m.key]];
  });
  sheet.getRange(dataStartRow + 1, 1, 12, 3).setValues(chartData);

  // Ẩn hàng dữ liệu nguồn (optional — giúp dashboard gọn hơn)
  sheet.hideRows(dataStartRow, 13);

  // Xóa chart cũ và tạo lại
  sheet.getCharts().forEach(function(c) { sheet.removeChart(c); });

  try {
    var dataRange = sheet.getRange(dataStartRow, 1, 13, 3);
    var chart = sheet.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(dataRange)
      .setPosition(DB_CHART_POS_ROW, 5, 0, 0)
      .setNumHeaders(1)
      .setOption('title', 'Dòng tiền 12 tháng qua')
      .setOption('legend', { position: 'bottom' })
      .setOption('vAxis', { format: '#,##0' })
      .setOption('series', {
        0: { color: '#34A853' },  // Thu — xanh lá
        1: { color: '#EA4335' }   // Chi — đỏ
      })
      .setOption('width', 680)
      .setOption('height', 320)
      .build();
    sheet.insertChart(chart);
  } catch (e) {
    Logger.log('Không tạo được biểu đồ Dashboard: ' + e.message);
  }
}
