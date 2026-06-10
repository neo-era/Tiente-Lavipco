// ============================================================
// ImportServer.gs — Import sao kê ngân hàng CSV
// Phụ thuộc: Config.gs, Utils.gs
// ============================================================

// ─────────────────────────────────────────────────────────────
// PARSE CSV SAO KÊ
// ─────────────────────────────────────────────────────────────

// Định nghĩa cột theo từng định dạng ngân hàng.
// Nhận diện bằng từ khóa trong dòng header.
var _BANK_FORMATS = [
  {
    ten:       'ACB',
    detect:    /ghi\s*n[oợ].*ghi\s*c[oó]/i,  // "Số tiền ghi nợ" && "Số tiền ghi có"
    colNgay:   0,
    colNo:     1,  // Số tiền ghi nợ (Chi)
    colCo:     2,  // Số tiền ghi có (Thu)
    colMoTa:   3
  },
  {
    ten:       'Sacombank',
    detect:    /ph[aá]t\s*sinh\s*n[oợ].*ph[aá]t\s*sinh\s*c[oó]/i,
    colNgay:   0,
    colNo:     1,  // Phát sinh Nợ
    colCo:     2,  // Phát sinh Có
    colMoTa:   3
  }
];

/**
 * Parse CSV sao kê ngân hàng.
 * @param {string} csvText — nội dung CSV paste từ user
 * @param {string} maTK    — mã tài khoản ngân hàng
 * @returns {Object[]} { ngay, soTien, loaiThuChi, moTa, rawLine, trungLap }
 */
function parseBankStatement(csvText, maTK) {
  if (!csvText || !maTK) throw new Error('Thiếu csvText hoặc maTK');

  var lines  = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) throw new Error('CSV không có dữ liệu (cần ít nhất 1 dòng header + 1 dòng dữ liệu)');

  // Tìm dòng header (dòng đầu không trống)
  var headerIdx = -1;
  var fmt;
  for (var i = 0; i < Math.min(lines.length, 10); i++) {
    var line = lines[i].trim();
    if (!line) continue;
    for (var j = 0; j < _BANK_FORMATS.length; j++) {
      if (_BANK_FORMATS[j].detect.test(line)) {
        fmt = _BANK_FORMATS[j];
        headerIdx = i;
        break;
      }
    }
    if (fmt) break;
  }

  if (!fmt) {
    // Fallback: giả định cột 0=Ngày, 1=Nợ, 2=Có, 3=Mô tả
    fmt = { ten: 'Unknown', colNgay: 0, colNo: 1, colCo: 2, colMoTa: 3 };
    headerIdx = 0;
  }

  var result = [];

  for (var k = headerIdx + 1; k < lines.length; k++) {
    var rawLine = lines[k];
    if (!rawLine.trim()) continue;

    var cols = parseCsvLine_(rawLine);

    var ngayStr = (cols[fmt.colNgay] || '').trim();
    var noStr   = (cols[fmt.colNo]   || '').trim();
    var coStr   = (cols[fmt.colCo]   || '').trim();
    var moTa    = (cols[fmt.colMoTa] || '').trim();

    var ngay = parseDateFlexible_(ngayStr);
    if (!ngay) continue; // Bỏ dòng không parse được ngày

    var soNo  = parseSoTien_(noStr);
    var soCo  = parseSoTien_(coStr);

    // Một trong hai phải > 0, không cả hai cùng lúc
    if (soNo <= 0 && soCo <= 0) continue;
    if (soNo > 0 && soCo > 0)  continue; // Dữ liệu kỳ lạ — bỏ

    var loaiThuChi = soCo > 0 ? LOAI_THU_CHI.THU : LOAI_THU_CHI.CHI;
    var soTien     = soCo > 0 ? soCo : soNo;

    var trungLap = kiemTraTrungLap_(ngay, soTien, maTK);

    result.push({
      ngay:       ngay,
      soTien:     soTien,
      loaiThuChi: loaiThuChi,
      moTa:       moTa,
      rawLine:    rawLine,
      trungLap:   trungLap
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// XEM TRƯỚC
// ─────────────────────────────────────────────────────────────

/**
 * Phân tích CSV và trả về kết quả preview để user review trước khi nhập.
 * @returns {{ rows: Object[], tongThu: number, tongChi: number, soHangLoi: number }}
 */
function xemTruocImport(csvText, maTK) {
  var rows = parseBankStatement(csvText, maTK);

  var tongThu = 0;
  var tongChi = 0;

  rows.forEach(function(r) {
    if (r.loaiThuChi === LOAI_THU_CHI.THU) tongThu += r.soTien;
    else                                    tongChi += r.soTien;
  });

  // Chuẩn bị dữ liệu cho frontend (Date → string, thêm checked mặc định)
  var rowsForUI = rows.map(function(r) {
    return {
      ngay:       formatDate(r.ngay),
      soTien:     r.soTien,
      loaiThuChi: r.loaiThuChi,
      moTa:       r.moTa,
      rawLine:    r.rawLine,
      trungLap:   r.trungLap,
      checked:    !r.trungLap  // Tự bỏ chọn hàng trùng lặp
    };
  });

  return {
    rows:       rowsForUI,
    tongThu:    tongThu,
    tongChi:    tongChi,
    soHangLoi:  0  // parseBankStatement đã bỏ dòng không hợp lệ
  };
}

// ─────────────────────────────────────────────────────────────
// XÁC NHẬN IMPORT
// ─────────────────────────────────────────────────────────────

/**
 * Nhập các hàng đã được user chọn (checked = true) vào sheet GiaoDich.
 * Dùng appendRow trực tiếp thay vì themGiaoDich vì:
 *   - LoaiChungTu phải là SAO_KE (không phải PT/PC/UNC)
 *   - Không cần kiểm tra tồn quỹ tiền mặt
 *   - Không sinh SoChungTu
 * @param {Object[]} rows   — output của xemTruocImport đã user review (có checked)
 * @param {string}   maTK   — tài khoản ngân hàng
 * @param {string}   maDuAn — dự án mặc định (có thể override từng hàng)
 * @returns {{ ok: boolean, soHangDaNhap: number, soHangBo: number }}
 */
function xacNhanImport(rows, maTK, maDuAn) {
  if (!maTK)   throw new Error('Thiếu maTK');
  if (!maDuAn) throw new Error('Thiếu maDuAn');

  var daNhap = 0;
  var bo     = 0;

  rows.forEach(function(r) {
    if (!r.checked) { bo++; return; }

    try {
      var ngay = r.ngay instanceof Date ? r.ngay : parseDate(r.ngay);
      if (!ngay) { bo++; return; }

      var soTien = Number(r.soTien) || 0;
      if (soTien <= 0) { bo++; return; }

      var maGD = genId('GD');

      appendRow(SHEET_NAMES.GIAO_DICH, {
        MaGD:         maGD,
        NgayGD:       ngay,
        MaDuAn:       r.maDuAn || maDuAn,
        MaDoiTac:     '',
        MaTK:         maTK,
        MaHangMuc:    '',
        LoaiThuChi:   r.loaiThuChi,
        SoTien:       soTien,
        LoaiChungTu:  LOAI_CHUNG_TU.SAO_KE,
        SoChungTu:    '',
        NguoiNopThu:  '',
        MaKHKhop:     '',
        GhiChu:       r.moTa || '',
        TrangThai:    TRANG_THAI.CHUA_THUC_HIEN
      });

      daNhap++;
    } catch (e) {
      Logger.log('xacNhanImport: bỏ hàng do lỗi — ' + e.message + ' | ' + r.rawLine);
      bo++;
    }
  });

  return { ok: true, soHangDaNhap: daNhap, soHangBo: bo };
}

// ─────────────────────────────────────────────────────────────
// KIỂM TRA TRÙNG LẶP
// ─────────────────────────────────────────────────────────────

/**
 * Kiểm tra xem GiaoDich đã có hàng cùng ngày + số tiền + tài khoản chưa.
 * @private
 */
function kiemTraTrungLap_(ngay, soTien, maTK) {
  var ngayStr = formatDate(ngay);
  var gdRows  = readRows(SHEET_NAMES.GIAO_DICH);

  return gdRows.some(function(r) {
    if (r.MaTK !== maTK) return false;
    if (Number(r.SoTien) !== soTien) return false;
    var ngayGD = r.NgayGD instanceof Date ? r.NgayGD : parseDate(r.NgayGD);
    return formatDate(ngayGD) === ngayStr;
  });
}

// ─────────────────────────────────────────────────────────────
// PARSE HELPERS (private)
// ─────────────────────────────────────────────────────────────

/**
 * Parse 1 dòng CSV xử lý field có dấu ngoặc kép.
 * @private
 */
function parseCsvLine_(line) {
  var result = [];
  var cur    = '';
  var inQuote = false;

  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if ((c === ',' || c === '\t') && !inQuote) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

/**
 * Parse số tiền từ chuỗi ngân hàng: '1,500,000' hoặc '1.500.000' → 1500000.
 * @private
 */
function parseSoTien_(str) {
  if (!str) return 0;
  // Bỏ dấu phân cách hàng nghìn (dấu chấm hoặc dấu phẩy trước chữ số)
  var cleaned = str.replace(/[,\.]/g, '').trim();
  var n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : Math.abs(n);
}

/**
 * Parse ngày linh hoạt: dd/MM/yyyy, dd-MM-yyyy, yyyy-MM-dd.
 * @private
 */
function parseDateFlexible_(str) {
  if (!str) return null;
  str = str.trim();

  // dd/MM/yyyy hoặc dd-MM-yyyy
  var m1 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1]);

  // yyyy-MM-dd
  var m2 = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]);

  return null;
}
