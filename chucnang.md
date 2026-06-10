# DANH MỤC CHỨC NĂNG — APP QUẢN LÝ DÒNG TIỀN LAVIPCO

**Dự án:** App QLDT — Google Apps Script + Google Sheets
**Đơn vị:** CÔNG TY TNHH KỸ NGHỆ LÂM VIỆT PHÁT (LAVIPCO)
**Cập nhật:** 09/06/2026
**Tổng chức năng:** ~45 chức năng / 9 nhóm

---

## 1. Quản lý danh mục (Master Data)

| # | Chức năng |
|---|---|
| 1.1 | Thêm / sửa / xem dự án & hợp đồng (`DM_DuAn`) |
| 1.2 | Thêm / sửa / xem đối tác — chủ đầu tư, NCC, thầu phụ (`DM_DoiTac`) |
| 1.3 | Thêm / sửa / xem hạng mục thu/chi — vật tư, nhân công, phí... (`DM_HangMuc`) |
| 1.4 | Thêm / sửa / xem tài khoản — ACB, Sacombank, Tiền mặt; số dư đầu kỳ; hạn mức tồn quỹ tối thiểu (`DM_TaiKhoan`) |

---

## 2. Quản lý giao dịch

| # | Chức năng |
|---|---|
| 2.1 | Nhập giao dịch thu — gắn dự án, đối tác, hạng mục, tài khoản (ngân hàng hoặc tiền mặt) |
| 2.2 | Nhập giao dịch chi — gắn dự án, đối tác, hạng mục, tài khoản |
| 2.3 | Xem danh sách giao dịch — lọc theo dự án / tài khoản / khoảng thời gian |
| 2.4 | Xóa giao dịch (soft delete — không mất dữ liệu) |
| 2.5 | Xem số dư hiện tại từng tài khoản |

---

## 3. Kế hoạch thu/chi (AR/AP)

| # | Chức năng |
|---|---|
| 3.1 | Tạo kế hoạch thu/chi theo từng đợt thanh toán |
| 3.2 | Tự động sinh lịch thanh toán theo tỉ lệ hợp đồng (ví dụ: 30% / 60% / 10%) |
| 3.3 | Tự động tạo khoản giữ lại bảo hành 5% |
| 3.4 | Khớp kế hoạch ↔ giao dịch thật (đánh dấu `DaThucHien`) |
| 3.5 | Hủy khớp kế hoạch |
| 3.6 | Xem công nợ phải thu / phải trả |
| 3.7 | Tự động cập nhật trạng thái quá hạn (chạy hằng ngày) |

---

## 4. Quản lý thu chi tiền mặt (quỹ)

| # | Chức năng |
|---|---|
| 4.1 | Lập phiếu thu (PT) — tự sinh số chứng từ `PT-YYYYMM-NNN`, ghi người nộp |
| 4.2 | Lập phiếu chi (PC) — tự sinh số chứng từ `PC-YYYYMM-NNN`, ghi người nhận |
| 4.3 | Xem sổ quỹ tiền mặt — tổng hợp tự động từ GiaoDich, lọc theo kỳ |
| 4.4 | Kiểm quỹ cuối ngày / tháng (so sánh sổ sách với thực tế) |
| 4.5 | Cảnh báo ngay khi tồn quỹ xuống dưới hạn mức tối thiểu |

---

## 5. Dashboard & Báo cáo

| # | Chức năng |
|---|---|
| 5.1 | Dashboard tổng quan — số dư từng tài khoản (kể cả tồn quỹ tiền mặt), phải thu, phải trả, công nợ quá hạn |
| 5.2 | Biểu đồ dòng tiền 12 tháng |
| 5.3 | Forecast 6 tháng lũy kế — dự báo cash flow |
| 5.4 | Cảnh báo tháng âm tiền (cash gap) trên Forecast |
| 5.5 | Báo cáo P&L tiền mặt theo từng dự án (thu / chi / ròng / % đã thu) |
| 5.6 | Biểu đồ chi theo loại hạng mục trong dự án |
| 5.7 | Sổ quỹ tiền mặt theo kỳ (tháng / quý / tùy chọn) |

---

## 6. Import & Đối soát sao kê ngân hàng

| # | Chức năng |
|---|---|
| 6.1 | Paste CSV sao kê ngân hàng (ACB, Sacombank) vào form |
| 6.2 | Map dòng sao kê vào sheet `GiaoDich` |
| 6.3 | Đánh dấu `LoaiChungTu = SaoKe` để phân biệt với PT/PC tiền mặt |
| 6.4 | Đối soát thủ công — xác nhận / bỏ qua từng dòng |

---

## 7. Hồ sơ dự án (lưu thủ công có hỗ trợ AI)

| # | Chức năng |
|---|---|
| 7.1 | Kéo thả hoặc đính kèm file vào form web app |
| 7.2 | Gemini API đọc tên file + nội dung → tự phân loại loại tài liệu (hợp đồng, biên bản, hóa đơn, bản vẽ...) và nhận diện dự án liên quan |
| 7.3 | Hiển thị đường dẫn thư mục đầy đủ gợi ý để user lưu vào OneDrive local (ví dụ: `E:\OneDrive - CONG TY...\3. Cong trinh\DA-001\01_HopDong\`) kèm nút Copy đường dẫn |
| 7.4 | User tự lưu file vào đúng thư mục OneDrive local theo gợi ý → xác nhận "Đã lưu" trong app |
| 7.5 | Ghi metadata vào Sheets: tên file, loại tài liệu, dự án, đường dẫn lưu, ngày, trạng thái (`Chờ lưu` / `Đã lưu`) |
| 7.6 | Xem danh sách hồ sơ theo dự án — lọc theo loại tài liệu / trạng thái |
| 7.7 | Cảnh báo hồ sơ còn ở trạng thái `Chờ lưu` quá 3 ngày |

### Cấu trúc thư mục OneDrive local (chuẩn)

```
E:\OneDrive - CONG TY CHIEU SANG CONG CONG TP.HCM\
  3. Cong viec\
    1. LAVIPCO Ltd.,Co\
      3. Cong trinh\
        {MaDuAn}_{TenDuAn}\        ← ví dụ: DA-001_ChieuSangQuan3
          01_HopDong\
          02_BienBan\
          03_ThanhToan\
          04_BanVe\
          05_HoaDon\
          06_Khac\
```

### Phân loại tài liệu (Gemini nhận diện)

| Loại | Từ khóa nhận diện | Thư mục đích |
|---|---|---|
| Hợp đồng | HĐ, hop-dong, contract, agreement | `01_HopDong\` |
| Biên bản | BB, bien-ban, nghiem-thu, minutes | `02_BienBan\` |
| Đề nghị / chứng từ thanh toán | TT, thanh-toan, de-nghi, payment | `03_ThanhToan\` |
| Bản vẽ | BV, ban-ve, drawing, DWG, PDF kỹ thuật | `04_BanVe\` |
| Hóa đơn | HD, hoa-don, invoice, VAT | `05_HoaDon\` |
| Khác | (không khớp) | `06_Khac\` |

---

## 8. Cảnh báo & Thông báo tự động

**Kênh:** Telegram Bot (chính) + Gmail (backup)
**Setup:** Tạo bot qua @BotFather → nhận TOKEN + chat_id → điền vào Script Properties. Không cần OAuth, không cần đăng ký tổ chức.

| # | Chức năng | Kênh |
|---|---|---|
| 8.1 | Cảnh báo khoản đến hạn thu/chi trong 3–7 ngày tới | Telegram + Gmail |
| 8.2 | Cảnh báo công nợ quá hạn | Telegram + Gmail |
| 8.3 | Cảnh báo tháng có cash gap (âm tiền) | Telegram + Gmail |
| 8.4 | Cảnh báo tồn quỹ tiền mặt dưới hạn mức | Telegram + Gmail |
| 8.5 | Trigger 7h sáng hằng ngày — tổng hợp tất cả cảnh báo trên | Telegram + Gmail |
| 8.6 | Cảnh báo hồ sơ dự án còn trạng thái `Chờ lưu` quá 3 ngày | Telegram + Gmail |

---

## 9. Hệ thống & Phân quyền

| # | Chức năng |
|---|---|
| 9.1 | Phân quyền 3 vai trò: Admin (toàn quyền) · Kế toán (nhập/xem) · Giám đốc (chỉ xem Dashboard/Báo cáo/Sổ quỹ) |
| 9.2 | Setup workbook — tạo 10 sheet, header, named range, dữ liệu seed |
| 9.3 | Xóa dữ liệu mẫu `[MẪU]` trước khi dùng thật |
| 9.4 | Cài / gỡ trigger hằng ngày |
| 9.5 | Menu Google Sheets — truy cập nhanh các chức năng chính |
| 9.6 | CI/CD — GitHub Actions tự động `clasp push` khi push lên `main` |
| 9.7 | GitHub Pages — landing page redirect tới Apps Script web app |

---

*Tài liệu tham chiếu: [Ke_hoach_du_an_App_QLDT_v1.0.md.md](Ke_hoach_du_an_App_QLDT_v1.0.md.md)*
