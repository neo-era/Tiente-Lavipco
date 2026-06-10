// ============================================================
// Telegram.gs — Cảnh báo qua Telegram Bot + Gmail
// Phụ thuộc: Config.gs, Utils.gs, Transactions.gs, Forecast.gs
// ============================================================

// ─────────────────────────────────────────────────────────────
// GỬI TIN
// ─────────────────────────────────────────────────────────────

/**
 * Gửi tin nhắn Markdown qua Telegram Bot API.
 * Không throw — chỉ log lỗi nếu thất bại.
 * @private
 */
function guiTelegram_(message) {
  try {
    var props   = PropertiesService.getScriptProperties();
    var token   = props.getProperty('TELEGRAM_TOKEN');
    var chatId  = props.getProperty('TELEGRAM_CHAT_ID');
    if (!token || !chatId) {
      Logger.log('Telegram: chưa cấu hình TELEGRAM_TOKEN hoặc TELEGRAM_CHAT_ID.');
      return;
    }

    var url     = 'https://api.telegram.org/bot' + token + '/sendMessage';
    var payload = JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' });
    var options = {
      method:      'post',
      contentType: 'application/json',
      payload:     payload,
      muteHttpExceptions: true
    };
    var resp = UrlFetchApp.fetch(url, options);
    var code = resp.getResponseCode();
    if (code !== 200) {
      Logger.log('Telegram HTTP ' + code + ': ' + resp.getContentText());
    }
  } catch (e) {
    Logger.log('guiTelegram_ lỗi: ' + e.message);
  }
}

/**
 * Gửi email cảnh báo qua Gmail.
 * @param {string} subject  — tiêu đề email
 * @param {string} htmlBody — nội dung HTML
 * @private
 */
function guiEmail_(subject, htmlBody) {
  try {
    var props = PropertiesService.getScriptProperties();
    var to    = props.getProperty('EMAIL_CANH_BAO') ||
                Session.getActiveUser().getEmail();
    if (!to) { Logger.log('guiEmail_: không xác định được địa chỉ email.'); return; }

    GmailApp.sendEmail(to, subject, '', { htmlBody: htmlBody, name: 'LAVIPCO QLDT' });
  } catch (e) {
    Logger.log('guiEmail_ lỗi: ' + e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// CẢNH BÁO TỔNG HỢP (trigger 7h sáng)
// ─────────────────────────────────────────────────────────────

/**
 * Gom tất cả cảnh báo thành 1 tin Telegram + 1 email HTML.
 * Luôn gửi hằng ngày dù không có gì bất thường (để xác nhận hệ thống chạy).
 */
function guiCanhBaoTongHop() {
  // Thu thập song song (đọc sheet một lần trong từng hàm)
  var denHan  = guiCanhBaoDenHan_();
  var quaHan  = guiCanhBaoQuaHan_();
  var cashGap = guiCanhBaoCashGap_();
  var hoSo    = guiCanhBaoHoSoChoLuu_();

  // Số dư tài khoản
  var soDuMap  = soDuTheoTK_();
  var tonQuy   = soDuMap[TAI_KHOAN.TIEN_MAT] || 0;
  var tkAllRows = readRows(SHEET_NAMES.DM_TAI_KHOAN);
  var tkTMRow  = tkAllRows.filter(function(r) { return r.MaTK === TAI_KHOAN.TIEN_MAT; })[0];
  var hanMucTM = tkTMRow ? (Number(tkTMRow.HanMucToiThieu) || 0) : 0;
  var caoBaoQuy = tonQuy < hanMucTM ? ' ⚠️ *DƯỚI HẠN MỨC*' : '';

  var ngayHom = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');

  // ── Telegram message ────────────────────────────────────────
  var tg = [
    '📊 *BÁO CÁO DÒNG TIỀN LAVIPCO*',
    '📅 ' + ngayHom,
    '',
    '💰 *Số dư tài khoản:*',
    '  • ACB: ' + formatVND(soDuMap[TAI_KHOAN.ACB] || 0),
    '  • Sacombank: ' + formatVND(soDuMap[TAI_KHOAN.SCB] || 0),
    '  • Tiền mặt: ' + formatVND(tonQuy) + caoBaoQuy,
    '',
    '⚠️ *Cần xử lý:*',
    '  • Đến hạn ' + NGAY_CANH_BAO_DEN_HAN + ' ngày: ' +
      denHan.soKhoan + ' khoản / ' + formatVND(denHan.tongTien),
    '  • Quá hạn: ' + quaHan.soKhoan + ' khoản / ' + formatVND(quaHan.tongTien),
    '  • Hồ sơ chưa lưu >' + NGAY_CANH_BAO_HO_SO + ' ngày: ' + hoSo.soFile + ' file'
  ];

  // Cash gap
  if (cashGap.soThang > 0) {
    tg.push('');
    tg.push('📉 *Tháng âm tiền (' + cashGap.soThang + ' tháng):* ' + cashGap.chiTiet);
  } else {
    tg.push('');
    tg.push('✅ *Forecast:* Không có tháng âm tiền trong 6 tháng tới');
  }

  // Chi tiết đến hạn
  if (denHan.chiTiet) {
    tg.push('');
    tg.push('_Đến hạn:_');
    tg.push(denHan.chiTiet);
  }

  guiTelegram_(tg.join('\n'));

  // ── Email HTML ──────────────────────────────────────────────
  var subject = '[LAVIPCO] Báo cáo dòng tiền ' + ngayHom;
  var html    = xayDungEmailHTML_(ngayHom, soDuMap, tonQuy, caoBaoQuy,
                                  denHan, quaHan, cashGap, hoSo);
  guiEmail_(subject, html);
}

// ─────────────────────────────────────────────────────────────
// THU THẬP DỮ LIỆU CẢNH BÁO (private collectors)
// ─────────────────────────────────────────────────────────────

/**
 * Kế hoạch đến hạn trong NGAY_CANH_BAO_DEN_HAN ngày tới.
 * @private
 */
function guiCanhBaoDenHan_() {
  var today   = getToday();
  var denHan  = addDays(today, NGAY_CANH_BAO_DEN_HAN);
  var khRows  = readRows(SHEET_NAMES.KE_HOACH);
  var duAnMap = {};
  readRows(SHEET_NAMES.DM_DU_AN).forEach(function(d) { duAnMap[d.MaDuAn] = d.TenDuAn; });

  var loc = khRows.filter(function(r) {
    if (r.TrangThai === TRANG_THAI.DA_THUC_HIEN) return false;
    if (r.TrangThai === TRANG_THAI.DA_XOA)       return false;
    var ngay = r.NgayDuKien instanceof Date ? r.NgayDuKien : parseDate(r.NgayDuKien);
    if (!ngay) return false;
    return ngay >= today && ngay <= denHan;
  });

  var tongTien = loc.reduce(function(s, r) { return s + (Number(r.SoTien) || 0); }, 0);
  var chiTiet  = loc.slice(0, 5).map(function(r) {
    var ngay = r.NgayDuKien instanceof Date ? r.NgayDuKien : parseDate(r.NgayDuKien);
    return '  – ' + formatDate(ngay) + ' | ' + r.LoaiThuChi + ' | ' +
           formatVND(Number(r.SoTien) || 0) + ' | ' + (duAnMap[r.MaDuAn] || r.MaDuAn);
  }).join('\n');

  return { soKhoan: loc.length, tongTien: tongTien, chiTiet: chiTiet };
}

/**
 * Kế hoạch quá hạn chưa thực hiện.
 * @private
 */
function guiCanhBaoQuaHan_() {
  var khRows  = readRows(SHEET_NAMES.KE_HOACH);
  var duAnMap = {};
  readRows(SHEET_NAMES.DM_DU_AN).forEach(function(d) { duAnMap[d.MaDuAn] = d.TenDuAn; });

  var loc = khRows.filter(function(r) {
    return r.TrangThai === TRANG_THAI.QUA_HAN;
  });

  var tongTien = loc.reduce(function(s, r) { return s + (Number(r.SoTien) || 0); }, 0);
  var chiTiet  = loc.slice(0, 5).map(function(r) {
    var ngay = r.NgayDuKien instanceof Date ? r.NgayDuKien : parseDate(r.NgayDuKien);
    var soNgay = diffDays(ngay, getToday());
    return '  – ' + (duAnMap[r.MaDuAn] || r.MaDuAn) + ' | ' + r.LoaiThuChi +
           ' | ' + formatVND(Number(r.SoTien) || 0) + ' (quá ' + soNgay + ' ngày)';
  }).join('\n');

  return { soKhoan: loc.length, tongTien: tongTien, chiTiet: chiTiet };
}

/**
 * Tháng âm tiền trong Forecast 6 tháng.
 * @private
 */
function guiCanhBaoCashGap_() {
  try {
    var sheet   = getSheet_(SHEET_NAMES.FORECAST);
    var lastRow = sheet.getLastRow();
    if (lastRow < FORECAST_DATA_START) return { soThang: 0, chiTiet: '' };

    // Cột: 1=Tháng, 2=Thu, 3=Chi, 4=Ròng, 5=Lũy kế
    var data = sheet.getRange(FORECAST_DATA_START, 1, FORECAST_MONTHS, 5).getValues();
    var amThang = [];

    data.forEach(function(row) {
      if (!row[0]) return;
      var luyCe = Number(row[4]) || 0;
      if (luyCe < 0) amThang.push(String(row[0]));
    });

    return {
      soThang: amThang.length,
      chiTiet: amThang.join(', ')
    };
  } catch (e) {
    Logger.log('guiCanhBaoCashGap_ lỗi: ' + e.message);
    return { soThang: 0, chiTiet: '' };
  }
}

/**
 * Cảnh báo tồn quỹ tiền mặt dưới hạn mức — gửi ngay (không chờ trigger).
 * Được gọi từ Transactions.gs sau mỗi lần chi tiền mặt.
 * @private
 */
function guiCanhBaoTonQuy_() {
  var soDuMap = soDuTheoTK_();
  var tonQuy  = soDuMap[TAI_KHOAN.TIEN_MAT] || 0;

  var tkRows  = readRows(SHEET_NAMES.DM_TAI_KHOAN);
  var tkTM    = tkRows.filter(function(r) { return r.MaTK === TAI_KHOAN.TIEN_MAT; })[0];
  var hanMuc  = tkTM ? (Number(tkTM.HanMucToiThieu) || 0) : 0;

  if (tonQuy >= hanMuc) return; // Không cần cảnh báo

  var message = [
    '🚨 *CẢNH BÁO TỒN QUỸ TIỀN MẶT — LAVIPCO*',
    '',
    'Tồn quỹ hiện tại: *' + formatVND(tonQuy) + '*',
    'Hạn mức tối thiểu: ' + formatVND(hanMuc),
    '',
    '⚡ Cần bổ sung quỹ hoặc kiểm tra lại!'
  ].join('\n');

  guiTelegram_(message);
  guiEmail_(
    '[LAVIPCO] ⚠️ Cảnh báo tồn quỹ tiền mặt',
    '<p><b>Tồn quỹ:</b> ' + formatVND(tonQuy) + '</p>' +
    '<p><b>Hạn mức tối thiểu:</b> ' + formatVND(hanMuc) + '</p>' +
    '<p style="color:red">Cần bổ sung quỹ ngay!</p>'
  );
}

/**
 * Hồ sơ còn trạng thái ChoLuu quá NGAY_CANH_BAO_HO_SO ngày.
 * @private
 */
function guiCanhBaoHoSoChoLuu_() {
  var today     = getToday();
  var nguong    = addDays(today, -NGAY_CANH_BAO_HO_SO);
  var hoSoRows  = readRows(SHEET_NAMES.HO_SO);

  var loc = hoSoRows.filter(function(r) {
    if (r.TrangThai !== TRANG_THAI.CHO_LUU) return false;
    var ngayTao = r.NgayTao instanceof Date ? r.NgayTao : parseDate(r.NgayTao);
    return ngayTao && ngayTao < nguong;
  });

  var chiTiet = loc.slice(0, 5).map(function(r) {
    var ngayTao = r.NgayTao instanceof Date ? r.NgayTao : parseDate(r.NgayTao);
    var soNgay  = diffDays(ngayTao, today);
    return '  – ' + r.TenFile + ' (' + soNgay + ' ngày)';
  }).join('\n');

  return { soFile: loc.length, chiTiet: chiTiet };
}

// ─────────────────────────────────────────────────────────────
// BUILD EMAIL HTML
// ─────────────────────────────────────────────────────────────

/** @private */
function xayDungEmailHTML_(ngay, soDuMap, tonQuy, canhBaoQuy, denHan, quaHan, cashGap, hoSo) {
  var style = 'font-family:Arial,sans-serif;font-size:14px;color:#202124;';
  var tbStyle = 'border-collapse:collapse;width:100%;margin:12px 0;';
  var thStyle = 'background:#1967D2;color:#fff;padding:8px 12px;text-align:left;';
  var tdStyle = 'padding:7px 12px;border-bottom:1px solid #e8eaed;';
  var redStyle = 'color:#D93025;font-weight:bold;';
  var greenStyle = 'color:#137333;';

  var rows = [
    ['ACB',       formatVND(soDuMap[TAI_KHOAN.ACB] || 0),       ''],
    ['Sacombank', formatVND(soDuMap[TAI_KHOAN.SCB] || 0),       ''],
    ['Tiền mặt', formatVND(tonQuy), canhBaoQuy ? '⚠️ Dưới hạn mức' : '✅']
  ];

  var soDuTable = '<table style="' + tbStyle + '">' +
    '<tr><th style="' + thStyle + '">Tài khoản</th><th style="' + thStyle + '">Số dư</th><th style="' + thStyle + '">Trạng thái</th></tr>' +
    rows.map(function(r) {
      return '<tr><td style="' + tdStyle + '">' + r[0] + '</td>' +
             '<td style="' + tdStyle + 'text-align:right">' + r[1] + '</td>' +
             '<td style="' + tdStyle + (r[2].indexOf('⚠️') !== -1 ? redStyle : greenStyle) + '">' + r[2] + '</td></tr>';
    }).join('') + '</table>';

  var canhBaoSection = '<h3>Cần xử lý</h3><ul>' +
    '<li>Đến hạn ' + NGAY_CANH_BAO_DEN_HAN + ' ngày: <b>' + denHan.soKhoan + ' khoản</b> — ' + formatVND(denHan.tongTien) + '</li>' +
    '<li' + (quaHan.soKhoan > 0 ? ' style="' + redStyle + '"' : '') + '>Quá hạn: <b>' + quaHan.soKhoan + ' khoản</b> — ' + formatVND(quaHan.tongTien) + '</li>' +
    '<li>Hồ sơ chưa lưu >' + NGAY_CANH_BAO_HO_SO + ' ngày: <b>' + hoSo.soFile + ' file</b></li>' +
    '<li' + (cashGap.soThang > 0 ? ' style="' + redStyle + '"' : '') + '>Tháng âm tiền: <b>' + (cashGap.soThang > 0 ? cashGap.chiTiet : 'Không có') + '</b></li>' +
    '</ul>';

  return '<div style="' + style + '">' +
    '<h2 style="color:#1967D2">📊 Báo cáo dòng tiền LAVIPCO — ' + ngay + '</h2>' +
    '<h3>Số dư tài khoản</h3>' + soDuTable +
    canhBaoSection +
    (denHan.chiTiet ? '<h4>Chi tiết đến hạn</h4><pre>' + denHan.chiTiet + '</pre>' : '') +
    (quaHan.chiTiet ? '<h4>Chi tiết quá hạn</h4><pre style="' + redStyle + '">' + quaHan.chiTiet + '</pre>' : '') +
    '<hr><p style="color:#999;font-size:12px">Gửi tự động lúc 7h sáng bởi LAVIPCO QLDT</p>' +
    '</div>';
}
