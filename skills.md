# SKILLS.MD — Function Reference (Google Apps Script)

Tài liệu tham chiếu tất cả hàm GAS của dự án, nhóm theo module.

---

## Config.gs

| Hàm / Hằng số | Kiểu | Mô tả |
|---|---|---|
| `SHEET_NAMES` | Object | Map tên sheet: `{ GD: 'GiaoDich', KH: 'KeHoach', ... }` |
| `TAI_KHOAN` | Object | Tên tài khoản chuẩn: ACB, Sacombank, TienMat |
| `VAT_RATE` | Number | 0.08 (VAT 8%) |
| `LOAI_CHUNG_TU` | Object | `{ PT, PC, UNC, SAO_KE }` |
| `LOAI_TAI_LIEU` | Object | `{ HOP_DONG, BIEN_BAN, THANH_TOAN, BAN_VE, HOA_DON, KHAC }` |

---

## Utils.gs

| Hàm | Tham số | Trả về | Mô tả |
|---|---|---|---|
| `genId(prefix)` | `prefix: string` | `string` | Sinh ID duy nhất: `GD-20260609-001` |
| `genSoChungTu(loai)` | `loai: 'PT'|'PC'` | `string` | Sinh số chứng từ: `PT-202606-001` |
| `formatVND(so)` | `so: number` | `string` | Format tiền: `1,500,000 đ` |
| `readRows(sheetName)` | `sheetName: string` | `Object[]` | Đọc tất cả hàng → array of objects (dùng header làm key) |
| `appendRow(sheetName, obj)` | `sheetName, obj` | `void` | Thêm hàng mới theo header map |
| `updateRow(sheetName, id, obj)` | `sheetName, id, obj` | `void` | Cập nhật hàng theo ID |
| `softDelete(sheetName, id)` | `sheetName, id` | `void` | Đặt TrangThai = 'DaXoa' |
| `headerMap(sheetName)` | `sheetName: string` | `Object` | Map tên cột → index |
| `parseDate(str)` | `str: string` | `Date` | Parse chuỗi ngày `dd/MM/yyyy` |
| `formatDate(date)` | `date: Date` | `string` | Format `dd/MM/yyyy` |

---

## Setup.gs

| Hàm | Mô tả |
|---|---|
| `khoiTaoWorkbook()` | Tạo 10 sheet + header + named range + seed data. Idempotent — chạy lại không mất dữ liệu |
| `onOpen()` | Tạo menu "💰 Dòng tiền" trong Google Sheets |
| `xoaDuLieuMau()` | Xóa tất cả hàng có prefix `[MẪU]` trong tên |
| `taoSeedData_()` | (private) Sinh dữ liệu mẫu ban đầu |

---

## Transactions.gs

| Hàm | Tham số | Trả về | Mô tả |
|---|---|---|---|
| `themGiaoDich(data)` | `data: Object` | `{ok, id}` | Thêm giao dịch mới; tự sinh PT/PC nếu TK = Tiền mặt |
| `danhSachGiaoDich(filter)` | `filter: Object` | `Object[]` | Lấy danh sách; filter theo dự án/TK/kỳ |
| `xoaGiaoDich(id)` | `id: string` | `{ok}` | Soft delete |
| `soDuHienTai_(maTK)` | `maTK: string` | `number` | Số dư tài khoản tại thời điểm hiện tại |
| `soDuTheoTK_()` | — | `Object` | Map maTK → số dư tất cả tài khoản |
| `soQuyTienMat(tuNgay, denNgay)` | `Date, Date` | `Object[]` | Sổ quỹ tiền mặt theo kỳ |
| `kiemTraHanMucTonQuy_(maTK, soDu)` | `string, number` | `boolean` | True nếu tồn quỹ < hạn mức tối thiểu |

---

## Planning.gs

| Hàm | Tham số | Trả về | Mô tả |
|---|---|---|---|
| `themKeHoach(data)` | `data: Object` | `{ok, id}` | Thêm kế hoạch thu/chi |
| `taoLichThanhToan(maDuAn, giaTriHD, tyLe)` | `string, number, number[]` | `{ok}` | Sinh kế hoạch theo tỉ lệ [30,60,10] |
| `taoGiuLaiBaoHanh(maDuAn, tyLe)` | `string, number` | `{ok}` | Sinh khoản giữ lại bảo hành (mặc định 5%) |
| `khopKeHoach(maKH, maGD)` | `string, string` | `{ok}` | Khớp kế hoạch ↔ giao dịch thật |
| `huyKhopKeHoach(maKH)` | `string` | `{ok}` | Hủy khớp, đặt lại TrangThai = ChuaThucHien |
| `congNo()` | — | `Object` | Tổng hợp phải thu / phải trả theo dự án |
| `capNhatQuaHan()` | — | `void` | Cập nhật TrangThai = QuaHan nếu NgayDuKien < hôm nay |

---

## Forecast.gs

| Hàm | Mô tả |
|---|---|
| `capNhatForecast()` | Tính dự báo 6 tháng lũy kế từ KeHoach chưa thực hiện; highlight đỏ tháng âm |

---

## Dashboard.gs

| Hàm | Mô tả |
|---|---|
| `capNhatDashboard()` | Cập nhật tổng quan: số dư TK, tồn quỹ, phải thu, phải trả, quá hạn; vẽ biểu đồ 12 tháng |

---

## ProjectReport.gs

| Hàm | Tham số | Mô tả |
|---|---|---|
| `baoCaoDuAn(maDuAn)` | `string` (optional) | P&L tiền mặt theo dự án: thu/chi/ròng/% đã thu + biểu đồ chi theo loại |

---

## HoSoServer.gs

| Hàm | Tham số | Trả về | Mô tả |
|---|---|---|---|
| `phanLoaiHoSo(tenFile, contentBase64)` | `string, string` | `{loai, duongDanGoiY, duAn}` | Gọi Gemini API phân loại file; trả về loại tài liệu + đường dẫn gợi ý |
| `luuMetadataHoSo(data)` | `data: Object` | `{ok, id}` | Ghi vào sheet HoSo với TrangThai = 'ChoLuu' |
| `xacNhanDaLuu(maHoSo)` | `string` | `{ok}` | Cập nhật TrangThai = 'DaLuu' |
| `danhSachHoSo(maDuAn)` | `string` (optional) | `Object[]` | Lấy danh sách hồ sơ theo dự án |
| `xayDungDuongDan_(loai, maDuAn, tenFile)` | (private) | `string` | Ghép đường dẫn OneDrive local đầy đủ |

---

## Telegram.gs

| Hàm | Tham số | Mô tả |
|---|---|---|
| `guiTelegram_(message)` | `string` | Gửi tin nhắn qua Telegram Bot API |
| `guiEmail_(subject, body)` | `string, string` | Gửi email qua Gmail |
| `guiCanhBaoTongHop()` | — | Tổng hợp tất cả cảnh báo và gửi (gọi bởi trigger 7h sáng) |
| `guiCanhBaoDenHan_()` | (private) | Cảnh báo khoản đến hạn trong 3–7 ngày |
| `guiCanhBaoQuaHan_()` | (private) | Cảnh báo công nợ quá hạn |
| `guiCanhBaoCashGap_()` | (private) | Cảnh báo tháng âm tiền trong Forecast |
| `guiCanhBaoTonQuy_()` | (private) | Cảnh báo tồn quỹ tiền mặt < hạn mức |
| `guiCanhBaoHoSoChoLuu_()` | (private) | Cảnh báo hồ sơ Chờ lưu quá 3 ngày |

---

## Triggers.gs

| Hàm | Mô tả |
|---|---|
| `caiTrigger()` | Cài trigger 7h sáng hằng ngày — idempotent (không tạo duplicate) |
| `goTrigger()` | Gỡ tất cả trigger hiện có |

---

## FormServer.gs (Web App API)

Tất cả hàm dưới đây được gọi từ frontend qua `google.script.run`.

| Hàm | Trả về | Mô tả |
|---|---|---|
| `doGet(e)` | `HtmlOutput` | Entry point — trả về SPA |
| `getOverviewData()` | `Object` | Dữ liệu Dashboard |
| `getForecastData()` | `Object[]` | Dữ liệu Forecast 6 tháng |
| `getProjectList()` | `Object[]` | Danh sách dự án (dropdown) |
| `getAccountList()` | `Object[]` | Danh sách tài khoản (dropdown) |
| `getPlanList(maDuAn)` | `Object[]` | Kế hoạch chưa khớp theo dự án |
| `submitTransaction(data)` | `{ok, id}` | Nhập giao dịch mới |
| `getTransactionList(filter)` | `Object[]` | Danh sách giao dịch |
| `getCashBook(tuNgay, denNgay)` | `Object[]` | Sổ quỹ tiền mặt |
| `getProjectReport(maDuAn)` | `Object` | Báo cáo P&L dự án |
| `importBankStatement(csvData)` | `{ok, count}` | Import sao kê ngân hàng |
