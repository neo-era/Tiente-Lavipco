# CLAUDE.md — App Quản lý Dòng tiền LAVIPCO

## Tổng quan

Ứng dụng nội bộ quản lý dòng tiền cho **CÔNG TY TNHH KỸ NGHỆ LÂM VIỆT PHÁT (LAVIPCO)** — công ty xây lắp chiếu sáng công cộng. 3 người dùng: Admin, Kế toán, Giám đốc.

**Stack:** Google Apps Script + Google Sheets + Gemini API + Telegram Bot API
**Deploy:** GitHub Actions (`clasp push --force`) → Apps Script Web App

---

## Kiến trúc

```
GitHub Pages (landing) → redirect → Apps Script Web App (SPA)
                                          │ google.script.run
                                          ▼
                                    Google Sheets (10 sheet)
                                          │
                              ┌───────────┴───────────┐
                         Gemini API              Telegram Bot API
                      (phân loại hồ sơ)        (cảnh báo hằng ngày)
```

---

## Cấu trúc file

| File | Mục đích |
|---|---|
| `Config.gs` | Hằng số trung tâm — tên 10 sheet, tài khoản, VAT 8%, Telegram, Gemini |
| `Utils.gs` | Helpers: `genId()`, `formatVND()`, `readRows()`, `appendRow()`, `headerMap()` |
| `Setup.gs` | Tạo 10 sheet + header + named range + seed data; `onOpen()` menu |
| `Transactions.gs` | CRUD giao dịch, số dư tài khoản; sinh PT/PC tự động khi TK = Tiền mặt |
| `Planning.gs` | Kế hoạch thu/chi, AR/AP, `khop()`, `huyKhop()`, `capNhatQuaHan()` |
| `Forecast.gs` | `capNhatForecast()` — 6 tháng lũy kế, highlight tháng âm |
| `Dashboard.gs` | `capNhatDashboard()` + biểu đồ 12 tháng |
| `ProjectReport.gs` | `baoCaoDuAn()` — P&L tiền mặt + chi theo loại |
| `FormServer.gs` | `doGet()` entry point; `getOverviewData()`, `getForecastData()`, v.v. |
| `HoSoServer.gs` | Nhận file upload → gọi Gemini → gợi ý đường dẫn → ghi sheet `HoSo` |
| `ImportServer.gs` | Paste CSV sao kê → map vào `GiaoDich` |
| `Telegram.gs` | `guiTelegram_()` + `guiEmail_()` — cảnh báo các loại |
| `Triggers.gs` | `caiTrigger()` idempotent — trigger 7h sáng hằng ngày |

**File HTML (frontend):**

| File | Mục đích |
|---|---|
| `index.html` | SPA dashboard chính |
| `Form.html` | Dialog nhập giao dịch (mobile-friendly) |
| `HoSo.html` | Upload hồ sơ + hiển thị gợi ý đường dẫn |
| `Import.html` | Paste CSV sao kê ngân hàng |

---

## Google Sheets — 10 sheet

| Sheet | Cột quan trọng |
|---|---|
| `DM_DuAn` | MaDuAn, TenDuAn, TenChuDauTu, GiaTriHD, NgayKy, TrangThai |
| `DM_DoiTac` | MaDoiTac, TenDoiTac, LoaiDoiTac (ChuDauTu/NCC/ThauPhu) |
| `DM_HangMuc` | MaHangMuc, TenHangMuc, LoaiThuChi (Thu/Chi) |
| `DM_TaiKhoan` | MaTK, TenTK, SoDuDauKy, **HanMucToiThieu** |
| `KeHoach` | MaKeHoach, MaDuAn, LoaiThuChi, SoTien, NgayDuKien, TrangThai |
| `GiaoDich` | MaGD, NgayGD, MaDuAn, MaTK, SoTien, **LoaiChungTu**, **SoChungTu**, **NguoiNopThu** |
| `HoSo` | MaHoSo, MaDuAn, TenFile, LoaiTaiLieu, DuongDanGoiY, NgayTao, TrangThai |
| `Dashboard` | Tự động — không nhập tay |
| `Forecast` | Tự động — không nhập tay |
| `BaoCao` | Tự động — không nhập tay |

---

## Script Properties (cấu hình trong Apps Script)

| Key | Mục đích | Bắt buộc |
|---|---|---|
| `TELEGRAM_TOKEN` | Bot token từ @BotFather | Để nhận cảnh báo |
| `TELEGRAM_CHAT_ID` | Chat ID cá nhân hoặc group | Để nhận cảnh báo |
| `EMAIL_CANH_BAO` | Email nhận backup | Không (mặc định tài khoản deploy) |
| `GEMINI_API_KEY` | Phân loại hồ sơ tự động | Khi dùng mục Hồ sơ |
| `ONEDRIVE_ROOT_PATH` | Đường dẫn gốc OneDrive local | Khi dùng mục Hồ sơ |

---

## Deploy

```bash
# Đẩy code lên Apps Script
clasp push --force

# Tạo deployment mới (URL web app mới)
clasp deploy --description "v1.x"

# Mở Apps Script editor
clasp open
```

CI/CD: mỗi `git push` lên `main` → GitHub Actions chạy `clasp push --force` tự động.

---

## URLs dự án

| Dịch vụ | URL |
|---|---|
| GitHub | `https://github.com/neo-era/luchuyentiente` |
| Web App | `https://script.google.com/macros/s/AKfycbzMNGOB4VEAJKuM2CHlRX3oRw1eskPu6pUTpvuU4ZxaIkiJvTqr21nNC3fD_IhIuJdQ/exec` |
| Google Sheet | `https://docs.google.com/spreadsheets/d/1GHFKlN5Q86BnYIgyNeQpzP5ODMhWeky7VGE_3qQ1zyw/edit` |

---

## Tham chiếu tài liệu

- [Kế hoạch dự án](Ke_hoach_du_an_App_QLDT_v1.0.md.md)
- [Danh mục chức năng](chucnang.md)
- [Business rules](rules.md)
- [Function reference](skills.md)
- [Prompt templates](prompts.md)
