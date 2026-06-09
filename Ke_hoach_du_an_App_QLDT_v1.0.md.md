# KẾ HOẠCH DỰ ÁN — ỨNG DỤNG QUẢN LÝ DÒNG TIỀN LAVIPCO

**Tên dự án:** App Quản lý dòng tiền (QLDT) — Google Apps Script + Google Sheets
**Đơn vị:** CÔNG TY TNHH KỸ NGHỆ LÂM VIỆT PHÁT (LAVIPCO)
**Phiên bản kế hoạch:** v2.0
**Ngày lập:** 08/06/2026 · **Cập nhật:** 09/06/2026

---

## 1. Tổng quan dự án

### 1.1. Mục tiêu
Xây dựng ứng dụng nội bộ cho phép nhóm 3 người (admin, kế toán, giám đốc) nhập/quản lý giao dịch thu–chi, xem báo cáo dòng tiền và dự báo cash-gap theo dự án xây lắp.

### 1.2. Kiến trúc thực tế đã triển khai

```
┌────────────────────────────────────────────────────────┐
│  GitHub Pages (tĩnh)                                   │
│  neo-era.github.io/luchuyentiente/                     │
│  → Landing page → redirect tới Apps Script web app    │
└────────────────────────────────────────────────────────┘
                          │ redirect
                          ▼
┌────────────────────────────────────────────────────────┐
│  Google Apps Script Web App                            │
│  (doGet → index.html: SPA dashboard + form nhập)       │
│  Execute as: USER_DEPLOYING · Access: ANYONE           │
└───────────────────────┬────────────────────────────────┘
                        │ google.script.run
                        ▼
┌────────────────────────────────────────────────────────┐
│  Google Sheets (spreadsheet ID: 1GHFKlN5Q86B...)       │
│  9 sheet: DM_DuAn · DM_DoiTac · DM_HangMuc ·          │
│  DM_TaiKhoan · KeHoach · GiaoDich ·                    │
│  Dashboard · Forecast · BaoCao                         │
└────────────────────────────────────────────────────────┘
```

**Tại sao không dùng Vite + React?** 3 người dùng, over-engineering. Next.js/Supabase chỉ khi vượt vài nghìn giao dịch hoặc cần đa người dùng phức tạp hơn.

### 1.3. Phạm vi v1 (In scope)
- Nhập, xem giao dịch thu/chi — gắn theo dự án, hợp đồng, đối tác.
- Kế hoạch thu/chi (KeHoach) — vừa làm AR/AP vừa nuôi Forecast.
- Khớp KeHoach ↔ GiaoDich: khi tiền về/đi thật thì đánh dấu đã thực hiện.
- Dashboard: số dư từng tài khoản, phải thu/trả, công nợ quá hạn.
- Forecast 6 tháng (lũy kế), cảnh báo tháng âm tiền (cash gap).
- Báo cáo P&L tiền mặt theo từng dự án (thu/chi/ròng/% đã thu).
- Import sao kê ngân hàng (đối soát thủ công).
- Hồ sơ dự án: upload file lên OneDrive.
- Cảnh báo hằng ngày qua Zalo + Gmail (trigger 7h sáng).
- Phân quyền: Admin/Kế toán chỉnh sửa, Giám đốc chỉ xem Dashboard.

### 1.4. Ngoài phạm vi v1 (Out of scope)
- Đồng bộ tự động với sao kê ngân hàng ACB/Sacombank (đối soát thủ công ở v1).
- Xác thực Google OAuth riêng (dùng luôn `executeAs: USER_DEPLOYING`).
- Tích hợp hóa đơn MISA AMIS.
- App mobile native.

### 1.5. Bảng quyền người dùng

| Chức năng | Admin | Kế toán | Giám đốc |
|-----------|:-----:|:-------:|:--------:|
| Nhập/xem giao dịch | ✅ | ✅ | ❌ |
| Nhập kế hoạch thu/chi | ✅ | ✅ | ❌ |
| Xem Dashboard & Forecast | ✅ | ✅ | ✅ |
| Báo cáo theo dự án | ✅ | ✅ | ✅ |
| Setup (tạo sheet, trigger) | ✅ | ❌ | ❌ |
| Upload hồ sơ OneDrive | ✅ | ✅ | ❌ |

---

## 2. Tiến độ thực tế (tính đến 09/06/2026)

### ✅ Hoàn thành

| Hạng mục | File | Ghi chú |
|---|---|---|
| Hằng số trung tâm | Config.gs | 9 sheet, tài khoản, VAT 8%, cấu hình OneDrive |
| Helpers/utils | Utils.gs | genId, formatVND, readRows, appendRow, headerMap... |
| Khởi tạo workbook | Setup.gs | Tạo 9 sheet + header + named range + dữ liệu seed |
| Menu Google Sheets | Setup.gs | onOpen() → menu 💰 Dòng tiền đầy đủ |
| CRUD giao dịch | Transactions.gs | themGiaoDich, danhSach, xoa, soDuHienTai_, soDuTheoTK_ |
| Kế hoạch & công nợ | Planning.gs | themKeHoach, taoLichThanhToan, taoGiuLai, congNo, khop/huy |
| Cập nhật quá hạn | Planning.gs | capNhatQuaHan() — chạy hằng ngày bởi trigger |
| Forecast 6 tháng | Forecast.gs | capNhatForecast() — lũy kế, highlight đỏ tháng âm |
| Dashboard tổng quan | Dashboard.gs | capNhatDashboard() + biểu đồ 12 tháng |
| Báo cáo theo dự án | ProjectReport.gs | baoCaoDuAn() — P&L tiền mặt + chi theo loại + biểu đồ |
| Web app entry point | FormServer.gs | doGet() → index.html; getOverviewData, getForecastData... |
| Form nhập giao dịch | Form.html + FormServer.gs | Dialog mobile, dropdown dự án/TK/kế hoạch |
| Hồ sơ dự án | HoSo.html + HoSoServer.gs | Upload file lên OneDrive |
| Import sao kê | Import.html + ImportServer.gs | Paste CSV sao kê, map vào GiaoDich |
| OneDrive OAuth2 | OneDrive.gs | Microsoft Graph API + thư viện OAuth2 |
| Cảnh báo Zalo | Zalo.gs | guiZalo_ qua webhook + guiEmail_ qua Gmail |
| Trigger hằng ngày | Triggers.gs | caiTrigger() idempotent — 7h sáng hằng ngày |
| CI/CD | .github/workflows/deploy.yml | Push main → clasp push --force tự động |
| GitHub Pages landing | index.html | Redirect tới Apps Script web app URL |

### ⚠️ Còn cần làm trước khi dùng thật

| Việc | Cách làm | Ưu tiên |
|---|---|---|
| Push scope fix lên Google | `clasp push --force` + `clasp deploy --description "v1.1"` | 🔴 Ngay |
| Đổi webapp access → ANYONE | Sửa `appsscript.json`: `"access": "ANYONE"` rồi redeploy | 🔴 Ngay |
| Xóa dữ liệu mẫu `[MẪU]` | Menu → Xóa dữ liệu mẫu hoặc chạy `xoaDuLieuMau()` | 🔴 Trước nhập thật |
| Điền số dư đầu kỳ | Sheet `DM_TaiKhoan` cột `SoDuDauKy`: ACB, Sacombank, Tiền mặt | 🔴 Trước nhập thật |
| Cài trigger hằng ngày | Menu → Cài đặt trigger hằng ngày | 🟡 Để nhận cảnh báo |
| Cấu hình OneDrive | Script Properties: `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT` | 🟡 Khi cần hồ sơ |
| Cấu hình Zalo | Script Properties: `ZALO_WEBHOOK` (webhook OA Zalo) | 🟡 Khi cần cảnh báo Zalo |
| Phân quyền giám đốc | Share sheet Dashboard view-only cho email giám đốc | 🟡 Khi onboard |

---

## 3. Kiến trúc dữ liệu

### 3.1. Các sheet và mục đích

| Sheet | Mục đích | Ai nhập |
|---|---|---|
| `DM_DuAn` | Danh mục hợp đồng/dự án | Admin (setup) |
| `DM_DoiTac` | Danh mục đối tác (chủ đầu tư/NCC/thầu phụ) | Admin |
| `DM_HangMuc` | Danh mục thu/chi (vật tư, nhân công...) | Admin |
| `DM_TaiKhoan` | ACB, Sacombank, Tiền mặt + số dư đầu kỳ | Admin |
| `KeHoach` ⭐ | Kế hoạch thu/chi từng đợt → AR/AP + Forecast | Admin/Kế toán |
| `GiaoDich` | Phát sinh tiền thật | Kế toán |
| `Dashboard` | Tổng quan số dư, công nợ, dòng tiền (tự động) | — |
| `Forecast` | Dự báo 6 tháng lũy kế (tự động) | — |
| `BaoCao` | P&L tiền mặt từng dự án (tự động) | — |

### 3.2. Luồng nghiệp vụ chính

```
Ký HĐ dự án
    │
    ▼
Tạo DM_DuAn + sinh tự động KeHoach các đợt thanh toán (30/60/10%) + khoản giữ lại 5%
    │
    ▼
Theo dõi KeHoach → Forecast cập nhật → phát hiện cash gap tháng nào
    │
    ▼
Khi tiền về/đi thật: nhập GiaoDich → khớp với KeHoach → TrangThai = DaThucHien
    │
    ▼
Dashboard + BaoCao tự cập nhật → Giám đốc xem real-time
    │
    ▼
Trigger 7h: cảnh báo Zalo + Gmail — đến hạn / quá hạn / tháng âm tiền
```

---

## 4. Thông tin kỹ thuật

### 4.1. Các URL quan trọng

| Dịch vụ | URL |
|---|---|
| GitHub repo | `https://github.com/neo-era/luchuyentiente` |
| GitHub Pages | `https://neo-era.github.io/luchuyentiente/` |
| Apps Script web app | `https://script.google.com/macros/s/AKfycbzMNGOB4VEAJKuM2CHlRX3oRw1eskPu6pUTpvuU4ZxaIkiJvTqr21nNC3fD_IhIuJdQ/exec` |
| Google Sheet | `https://docs.google.com/spreadsheets/d/1GHFKlN5Q86BnYIgyNeQpzP5ODMhWeky7VGE_3qQ1zyw/edit` |
| Apps Script editor | Mở bằng `clasp open` |

### 4.2. Script Properties cần cấu hình

| Key | Giá trị | Bắt buộc |
|---|---|---|
| `ZALO_WEBHOOK` | URL webhook Zalo OA | Không (cảnh báo Zalo) |
| `EMAIL_CANH_BAO` | Email nhận cảnh báo | Không (mặc định: tài khoản deploy) |
| `MS_CLIENT_ID` | Azure App Client ID | Khi dùng OneDrive |
| `MS_CLIENT_SECRET` | Azure App Client Secret | Khi dùng OneDrive |
| `MS_TENANT` | Tenant ID (hoặc "common") | Khi dùng OneDrive |

### 4.3. Quy trình deploy

```bash
# Đẩy code lên Apps Script
clasp push --force

# Tạo deployment mới (cần mỗi khi muốn URL web app có code mới)
clasp deploy --description "v1.1"

# CI/CD tự động: mỗi git push lên branch main → GitHub Actions chạy clasp push --force
```

---

## 5. Rủi ro & cách giảm thiểu

| Rủi ro | Mức độ | Cách giảm thiểu |
|---|---|---|
| Quên khớp KeHoach↔GiaoDich | Cao | Form bắt buộc chọn kế hoạch hoặc bỏ qua có chủ ý |
| Số liệu Forecast sai do quên khoản giữ lại bảo hành | Cao | `taoGiuLaiBaoHanh()` tự sinh khi tạo dự án |
| Mất dữ liệu Sheet | Cao | Không xóa cứng giao dịch; backup định kỳ |
| Vượt quota Apps Script | Thấp | 3 người dùng, ít rủi ro |
| Lỗi CORS khi gọi API | Không áp dụng | Dùng `google.script.run` (same-origin), không fetch() cross-domain |
| Scope OAuth sai | Đã gặp | `gmail.send` (đúng) vs `mail.send` (sai) — đã sửa trong appsscript.json |

---

## 6. Roadmap mở rộng (sau v1)

| Phiên bản | Tính năng |
|---|---|
| v1.x | Export báo cáo PDF · Đối soát sao kê tự động · Thêm vai trò phân quyền |
| v2 | Migrate Next.js + Supabase khi dữ liệu/người dùng tăng |
| v2.x | Tích hợp hóa đơn MISA AMIS · Liên kết IoT chiếu sáng |

---

*Kế hoạch v2.0 — cập nhật theo thực tế triển khai. Kế hoạch v1.0 (Vite+React) đã thay thế bằng kiến trúc Apps Script đơn giản hơn, phù hợp quy mô 3 người dùng.*
