// ============================================================
// HoSoServer.gs — Phân loại hồ sơ dự án + Gemini AI
// Phụ thuộc: Config.gs, Utils.gs
// ============================================================

var GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=';

var GEMINI_SYSTEM = 'Bạn là trợ lý phân loại tài liệu xây dựng cho công ty xây lắp LAVIPCO (Việt Nam).\nPhân tích tên file và nội dung, trả về JSON thuần, không giải thích thêm.';

// ─────────────────────────────────────────────────────────────
// PHÂN LOẠI HỒ SƠ (AI + fallback)
// ─────────────────────────────────────────────────────────────

/**
 * Phân loại tài liệu bằng Gemini. Fallback về keyword matching nếu không có API key.
 * @param {string} tenFile      — tên file gốc
 * @param {string} contentBase64 — nội dung file mã hóa base64 (có thể '')
 * @returns {{ loai, tenThuMucCon, maDuAnGoiY, moTa, doTinCay }}
 */
function phanLoaiHoSo(tenFile, contentBase64) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) return phanLoaiTheoTenFile_(tenFile);

  // Trích 2000 ký tự đầu nếu file text
  var noiDung = trichNoiDungText_(tenFile, contentBase64);

  // Danh sách dự án hiện có để Gemini gợi ý maDuAn
  var duAnRows = readRows(SHEET_NAMES.DM_DU_AN);
  var danhSachDA = duAnRows.map(function(r) {
    return r.MaDuAn + ': ' + r.TenDuAn;
  }).join('\n');

  var userPrompt = [
    'Phân loại tài liệu:',
    'Tên file: ' + tenFile,
    'Nội dung (trích đầu): ' + (noiDung || '(file nhị phân, không đọc được)'),
    'Dự án hiện có:\n' + (danhSachDA || '(chưa có dự án)'),
    '',
    'Trả về JSON:',
    '{',
    '  "loaiTaiLieu": "HopDong"|"BienBan"|"ThanhToan"|"BanVe"|"HoaDon"|"Khac",',
    '  "moTa": "mô tả ngắn bằng tiếng Việt",',
    '  "maDuAnGoiY": "mã dự án hoặc null",',
    '  "tenThuMucCon": "01_HopDong"|"02_BienBan"|"03_ThanhToan"|"04_BanVe"|"05_HoaDon"|"06_Khac",',
    '  "doTinCay": "Cao"|"Trung binh"|"Thap"',
    '}'
  ].join('\n');

  var ketQua = goiGemini_(apiKey, GEMINI_SYSTEM, userPrompt);

  if (!ketQua || !ketQua.loaiTaiLieu) {
    return phanLoaiTheoTenFile_(tenFile);
  }

  return {
    loai:         ketQua.loaiTaiLieu,
    tenThuMucCon: ketQua.tenThuMucCon || THU_MUC_TAI_LIEU[ketQua.loaiTaiLieu] || '06_Khac',
    maDuAnGoiY:   ketQua.maDuAnGoiY  || null,
    moTa:         ketQua.moTa         || '',
    doTinCay:     ketQua.doTinCay     || 'Thap'
  };
}

/**
 * Gọi Gemini 1.5 Flash, trả về object JSON đã parse. Trả null nếu lỗi.
 * @private
 */
function goiGemini_(apiKey, systemInstruction, userPrompt) {
  try {
    var payload = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents:           [{ parts: [{ text: userPrompt }] }],
      generationConfig:   { response_mime_type: 'application/json', temperature: 0.1 }
    };
    var options = {
      method:      'post',
      contentType: 'application/json',
      payload:     JSON.stringify(payload),
      muteHttpExceptions: true
    };
    var res  = UrlFetchApp.fetch(GEMINI_URL + apiKey, options);
    var code = res.getResponseCode();
    if (code !== 200) {
      Logger.log('Gemini HTTP ' + code + ': ' + res.getContentText().slice(0, 300));
      return null;
    }
    var json = JSON.parse(res.getContentText());
    var text = json.candidates[0].content.parts[0].text;
    return JSON.parse(text);
  } catch (e) {
    Logger.log('goiGemini_ lỗi: ' + e.message);
    return null;
  }
}

/**
 * Fallback phân loại theo tên file (không cần AI).
 * @private
 */
function phanLoaiTheoTenFile_(tenFile) {
  var name = tenFile.toLowerCase();

  var rules = [
    { re: /h[oô]p\s*[đd][oô]ng|h[đd][-_\s]|contract|hdmb|hd\d/i, loai: 'HopDong' },
    { re: /bi[eê]n\s*b[aả]n|bb[-_\s]|minutes/i,                     loai: 'BienBan' },
    { re: /thanh\s*to[aá]n|tt[-_\s]|payment|invoice|bill/i,          loai: 'ThanhToan' },
    { re: /b[aả]n\s*v[eẽ]|bv[-_\s]|drawing|cad|dwg|pdf.*ve/i,        loai: 'BanVe' },
    { re: /h[oó]a\s*[đd][oơ]n|vat|einvoice|hd[0-9]/i,                loai: 'HoaDon' }
  ];

  var loai = 'Khac';
  for (var i = 0; i < rules.length; i++) {
    if (rules[i].re.test(name)) { loai = rules[i].loai; break; }
  }

  return {
    loai:         loai,
    tenThuMucCon: THU_MUC_TAI_LIEU[loai] || '06_Khac',
    maDuAnGoiY:   null,
    moTa:         'Phân loại tự động theo tên file',
    doTinCay:     'Thap'
  };
}

/**
 * Cố gắng decode base64 và trả về 2000 ký tự đầu nếu là text.
 * Với file nhị phân (PDF, docx…) trả về chuỗi rỗng.
 * @private
 */
function trichNoiDungText_(tenFile, contentBase64) {
  if (!contentBase64) return '';
  var ext = tenFile.split('.').pop().toLowerCase();
  var textExts = ['txt', 'csv', 'json', 'xml', 'html', 'htm', 'md'];
  if (textExts.indexOf(ext) === -1) return '';

  try {
    var decoded = Utilities.newBlob(Utilities.base64Decode(contentBase64)).getDataAsString();
    return decoded.slice(0, 2000);
  } catch (e) {
    return '';
  }
}

// ─────────────────────────────────────────────────────────────
// XÂY DỰNG ĐƯỜNG DẪN GỢI Ý
// ─────────────────────────────────────────────────────────────

/**
 * Ghép đường dẫn OneDrive local theo convention.
 * Format: {root}\{maDuAn}_{tenDuAnKhongDau}\{tenThuMucCon}\{tenFile}
 * @private
 */
function xayDungDuongDan_(loai, maDuAn, tenDuAn, tenFile) {
  var root = PropertiesService.getScriptProperties().getProperty('ONEDRIVE_ROOT_PATH') || 'E:\\OneDrive';
  var tenThuMucCon = THU_MUC_TAI_LIEU[loai] || '06_Khac';
  var tenDuAnKhongDau = boiDau_(tenDuAn).replace(/[\/\\:*?"<>|]/g, '_');
  var tenFolder = maDuAn + '_' + tenDuAnKhongDau;
  return [root, tenFolder, tenThuMucCon, tenFile].join('\\');
}

/**
 * Bỏ dấu tiếng Việt.
 * 'Chiếu sáng đường Nguyễn' → 'Chieu sang duong Nguyen'
 * @private
 */
function boiDau_(str) {
  if (!str) return '';

  // Xử lý đ/Đ trước khi normalize vì chúng không decompose theo NFD
  var s = str.replace(/[đĐ]/g, function(c) { return c === 'đ' ? 'd' : 'D'; });

  // NFD decompose rồi xóa combining diacritics (U+0300–U+036F)
  if (s.normalize) {
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  return s;
}

// ─────────────────────────────────────────────────────────────
// LƯU METADATA
// ─────────────────────────────────────────────────────────────

/**
 * Phân loại file, sinh đường dẫn gợi ý, ghi vào sheet HoSo.
 * @param {{ maDuAn, tenFile, loaiTaiLieu?, contentBase64? }} data
 * @returns {{ ok: boolean, id: string, duongDanGoiY: string }}
 */
function luuMetadataHoSo(data) {
  if (!data.maDuAn)  throw new Error('Thiếu maDuAn');
  if (!data.tenFile) throw new Error('Thiếu tenFile');

  // Lấy tenDuAn
  var duAnRows = readRows(SHEET_NAMES.DM_DU_AN);
  var duAn = duAnRows.filter(function(r) { return r.MaDuAn === data.maDuAn; })[0];
  if (!duAn) throw new Error('Không tìm thấy dự án: ' + data.maDuAn);

  // Phân loại: dùng loaiTaiLieu nếu đã truyền, ngược lại gọi AI
  var ketQuaPhanLoai;
  if (data.loaiTaiLieu) {
    ketQuaPhanLoai = {
      loai:         data.loaiTaiLieu,
      tenThuMucCon: THU_MUC_TAI_LIEU[data.loaiTaiLieu] || '06_Khac',
      maDuAnGoiY:   data.maDuAn,
      moTa:         '',
      doTinCay:     'Cao'
    };
  } else {
    ketQuaPhanLoai = phanLoaiHoSo(data.tenFile, data.contentBase64 || '');
  }

  var duongDanGoiY = xayDungDuongDan_(
    ketQuaPhanLoai.loai,
    data.maDuAn,
    duAn.TenDuAn,
    data.tenFile
  );

  var id = genId('HS');

  appendRow(SHEET_NAMES.HO_SO, {
    MaHoSo:        id,
    MaDuAn:        data.maDuAn,
    TenFile:        data.tenFile,
    LoaiTaiLieu:    ketQuaPhanLoai.loai,
    DuongDanGoiY:   duongDanGoiY,
    NgayTao:        getToday(),
    TrangThai:      TRANG_THAI.CHO_LUU,
    GhiChu:         ketQuaPhanLoai.moTa || ''
  });

  return { ok: true, id: id, duongDanGoiY: duongDanGoiY };
}

// ─────────────────────────────────────────────────────────────
// XÁC NHẬN ĐÃ LƯU
// ─────────────────────────────────────────────────────────────

/**
 * Đánh dấu hồ sơ đã được lưu vào OneDrive.
 * @returns {{ ok: boolean }}
 */
function xacNhanDaLuu(maHoSo) {
  updateRow(SHEET_NAMES.HO_SO, maHoSo, { TrangThai: TRANG_THAI.DA_LUU });
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// DANH SÁCH HỒ SƠ
// ─────────────────────────────────────────────────────────────

/**
 * Lấy danh sách hồ sơ, tùy chọn filter theo dự án.
 * Sắp xếp NgayTao giảm dần (mới nhất trước).
 * @param {string=} maDuAn — nếu có thì chỉ lấy hồ sơ của dự án đó
 * @returns {Object[]}
 */
function danhSachHoSo(maDuAn) {
  var rows = readRows(SHEET_NAMES.HO_SO);

  if (maDuAn) {
    rows = rows.filter(function(r) { return r.MaDuAn === maDuAn; });
  }

  rows.sort(function(a, b) {
    var da = a.NgayTao instanceof Date ? a.NgayTao : parseDate(a.NgayTao);
    var db = b.NgayTao instanceof Date ? b.NgayTao : parseDate(b.NgayTao);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db - da; // Giảm dần
  });

  return rows;
}
