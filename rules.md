# RULES.MD — Quy tắc dự án

## 1. Quy tắc nghiệp vụ (Business Rules)

### Giao dịch
- Mỗi giao dịch **bắt buộc** có: NgayGD, MaDuAn, MaTK, SoTien, LoaiThuChi.
- Khi `MaTK = "TienMat"` → tự động sinh `SoChungTu` dạng `PT-YYYYMM-NNN` (thu) hoặc `PC-YYYYMM-NNN` (chi).
- Không xóa cứng giao dịch — chỉ soft delete (`TrangThai = 'DaXoa'`). Dữ liệu phải có thể khôi phục.
- `SoTien` luôn là số dương. `LoaiThuChi` = `'Thu'` hoặc `'Chi'` xác định chiều tiền.

### Tiền mặt (quỹ)
- Tồn quỹ tiền mặt **không được phép âm** — cảnh báo khi nhập PC vượt số dư.
- Khi tồn quỹ < `HanMucToiThieu` trong `DM_TaiKhoan` → gửi cảnh báo Telegram ngay lập tức (không chờ trigger 7h).
- Số dư đầu kỳ phải được nhập vào `DM_TaiKhoan.SoDuDauKy` trước khi nhập giao dịch thật.

### Kế hoạch & Công nợ
- Một kế hoạch chỉ khớp với **đúng một** giao dịch (1-1).
- Khoản giữ lại bảo hành mặc định **5%** giá trị hợp đồng, thời hạn 12 tháng sau nghiệm thu.
- Tỉ lệ thanh toán mặc định: **30% / 60% / 10%** (có thể tùy chỉnh khi tạo dự án).
- Kế hoạch quá hạn mà chưa khớp giao dịch → `TrangThai = 'QuaHan'` — trigger cập nhật hằng ngày.

### Hồ sơ dự án
- Mỗi file hồ sơ phải gắn với một `MaDuAn` cụ thể.
- Trạng thái `'ChoLuu'` quá 3 ngày → gửi cảnh báo Telegram.
- Đường dẫn OneDrive local là gợi ý — người dùng có thể chỉnh trước khi xác nhận.
- Không lưu file nhị phân lên Google Sheets — chỉ lưu metadata.

### Cảnh báo
- Cảnh báo đến hạn: khoản có `NgayDuKien` trong vòng **7 ngày** tới và `TrangThai != 'DaThucHien'`.
- Cảnh báo quá hạn: khoản có `NgayDuKien < hôm nay` và `TrangThai != 'DaThucHien'`.
- Trigger 7h sáng gửi **một tin** tổng hợp tất cả cảnh báo (không gửi riêng từng loại để tránh spam).

---

## 2. Quy ước đặt tên (Naming Conventions)

### ID
| Loại | Format | Ví dụ |
|---|---|---|
| Giao dịch | `GD-YYYYMMDD-NNN` | `GD-20260609-001` |
| Kế hoạch | `KH-YYYYMMDD-NNN` | `KH-20260609-001` |
| Phiếu thu | `PT-YYYYMM-NNN` | `PT-202606-001` |
| Phiếu chi | `PC-YYYYMM-NNN` | `PC-202606-001` |
| Hồ sơ | `HS-YYYYMMDD-NNN` | `HS-20260609-001` |
| Dự án | `DA-NNN` | `DA-001` |
| Đối tác | `DT-NNN` | `DT-001` |

### Hàm GAS
- Hàm **public** (gọi từ frontend hoặc menu): `camelCase`, ví dụ `themGiaoDich()`.
- Hàm **private** (nội bộ module): thêm suffix `_`, ví dụ `soDuHienTai_()`.
- Hàm **trigger**: prefix `capNhat` hoặc `gui`, ví dụ `capNhatQuaHan()`, `guiCanhBaoTongHop()`.

### Cột trong Sheets
- PascalCase, không dấu, không khoảng trắng: `MaDuAn`, `NgayGD`, `SoTien`.
- Cột trạng thái luôn tên là `TrangThai`.
- Cột ID luôn là cột đầu tiên.

### Thư mục OneDrive
- Dự án: `{MaDuAn}_{TenDuAn}` — ví dụ `DA-001_ChieuSangQuan3`
- Không dùng dấu tiếng Việt trong tên thư mục.

---

## 3. Quy tắc kỹ thuật (Coding Rules)

### Google Apps Script
- Không dùng `SpreadsheetApp.getActiveSpreadsheet()` trong hàm được gọi từ trigger — dùng `SpreadsheetApp.openById(SPREADSHEET_ID)`.
- Mọi thao tác ghi vào Sheets phải qua `appendRow()` hoặc `updateRow()` trong `Utils.gs` — không ghi trực tiếp bằng `sheet.getRange().setValue()` rải rác.
- Batch read/write: đọc toàn bộ sheet 1 lần bằng `getValues()`, xử lý trong bộ nhớ, ghi lại 1 lần — tránh gọi API lặp trong loop.
- `UrlFetchApp` gọi Telegram/Gemini phải wrap trong `try/catch` — lỗi API ngoài không được làm crash toàn bộ trigger.

### Dữ liệu
- Số tiền lưu dạng **số nguyên VNĐ** (không có dấu phẩy, không có "đ"). Format chỉ khi hiển thị.
- Ngày lưu dạng **Date object** của GAS. Khi ghi ra sheet GAS tự xử lý. Khi đọc về JS dùng `formatDate()`.
- Boolean lưu dạng `true`/`false` (không dùng `'Y'`/`'N'` hay `1`/`0`).

### Frontend (HTML)
- Gọi backend qua `google.script.run.withSuccessHandler().withFailureHandler()` — luôn có failure handler.
- Không hardcode ID sheet hay tên cột trong HTML — gọi qua `FormServer.gs` để lấy data.

---

## 4. Phân quyền

| Vai trò | Quyền |
|---|---|
| **Admin** | Toàn quyền — setup, nhập, xem, cấu hình |
| **Kế toán** | Nhập giao dịch, kế hoạch, phiếu thu/chi, hồ sơ; xem tất cả báo cáo |
| **Giám đốc** | Chỉ xem — Dashboard, Forecast, Báo cáo dự án, Sổ quỹ |

Phân quyền thực hiện bằng cách share Google Sheet với đúng mức (view/edit) theo email từng người.

---

## 5. Quy trình triển khai

1. **Lần đầu:** Chạy `khoiTaoWorkbook()` từ menu → nhập số dư đầu kỳ → xóa dữ liệu mẫu → cài trigger.
2. **Cập nhật code:** `git push origin main` → CI/CD tự `clasp push --force`.
3. **URL web app thay đổi** khi chạy `clasp deploy` mới — cần cập nhật redirect trong GitHub Pages.
4. **Không dùng** `--no-verify` để bypass pre-commit hook.
