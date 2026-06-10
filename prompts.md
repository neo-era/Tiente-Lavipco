# PROMPTS.MD — Bộ prompt triển khai dự án QLDT LAVIPCO

## Cách dùng

Mỗi prompt là một phiên làm việc độc lập với Claude Code.
Thực hiện **đúng thứ tự P01 → P17** vì các file sau phụ thuộc vào file trước.
Trước mỗi phiên, đảm bảo `CLAUDE.md`, `rules.md`, `skills.md` đã có trong repo.

---

## P01 — Config.gs

```
Đọc CLAUDE.md và rules.md trong repo này.

Tạo file `Config.gs` cho dự án Google Apps Script quản lý dòng tiền LAVIPCO.

File này là trung tâm hằng số toàn dự án. Cần có:

1. SPREADSHEET_ID — ID của Google Sheet: 1GHFKlN5Q86BnYIgyNeQpzP5ODMhWeky7VGE_3qQ1zyw

2. SHEET_NAMES — object map tên 10 sheet:
   DM_DuAn, DM_DoiTac, DM_HangMuc, DM_TaiKhoan,
   KeHoach, GiaoDich, HoSo, Dashboard, Forecast, BaoCao

3. HEADERS — object map tên sheet → mảng tên cột theo đúng thứ tự:
   - DM_DuAn: MaDuAn, TenDuAn, TenChuDauTu, GiaTriHD, NgayKy, TrangThai, GhiChu
   - DM_DoiTac: MaDoiTac, TenDoiTac, LoaiDoiTac, SoDienThoai, Email, GhiChu
   - DM_HangMuc: MaHangMuc, TenHangMuc, LoaiThuChi, GhiChu
   - DM_TaiKhoan: MaTK, TenTK, NganHang, SoDuDauKy, HanMucToiThieu, GhiChu
   - KeHoach: MaKeHoach, MaDuAn, MaDoiTac, LoaiThuChi, SoTien, NgayDuKien, TrangThai, MaGDKhop, GhiChu
   - GiaoDich: MaGD, NgayGD, MaDuAn, MaDoiTac, MaTK, MaHangMuc, LoaiThuChi, SoTien, LoaiChungTu, SoChungTu, NguoiNopThu, MaKHKhop, GhiChu, TrangThai
   - HoSo: MaHoSo, MaDuAn, TenFile, LoaiTaiLieu, DuongDanGoiY, NgayTao, TrangThai, GhiChu
   - Dashboard, Forecast, BaoCao: không cần định nghĩa header (viết tay bởi Dashboard.gs)

4. TAI_KHOAN — object: { ACB: 'TK_ACB', SCB: 'TK_SCB', TIEN_MAT: 'TK_TM' }

5. LOAI_THU_CHI — { THU: 'Thu', CHI: 'Chi' }

6. LOAI_CHUNG_TU — { PT: 'PT', PC: 'PC', UNC: 'UNC', SAO_KE: 'SaoKe' }

7. LOAI_TAI_LIEU — { HOP_DONG: 'HopDong', BIEN_BAN: 'BienBan', THANH_TOAN: 'ThanhToan', BAN_VE: 'BanVe', HOA_DON: 'HoaDon', KHAC: 'Khac' }

8. TRANG_THAI — { CHUA_THUC_HIEN: 'ChuaThucHien', DA_THUC_HIEN: 'DaThucHien', QUA_HAN: 'QuaHan', DA_XOA: 'DaXoa', CHO_LUU: 'ChoLuu', DA_LUU: 'DaLuu' }

9. VAT_RATE = 0.08

10. NGAY_CANH_BAO_DEN_HAN = 7 (số ngày trước hạn thì cảnh báo)
    NGAY_CANH_BAO_HO_SO = 3 (hồ sơ ChoLuu quá N ngày thì cảnh báo)
    TY_LE_GIU_LAI_BAO_HANH = 0.05
    THOI_HAN_BAO_HANH_THANG = 12

Viết dạng const/var ở global scope của GAS. Không có function trong file này.
```

---

## P02 — Utils.gs

```
Đọc CLAUDE.md, rules.md, skills.md và Config.gs đã tạo.

Tạo file `Utils.gs` — thư viện helper dùng chung cho toàn dự án.

Implement đầy đủ các hàm sau (xem signatures trong skills.md):

1. getSpreadsheet_() — (private) trả về Spreadsheet object từ SPREADSHEET_ID.
   Dùng SpreadsheetApp.openById(), KHÔNG dùng getActiveSpreadsheet().

2. getSheet_(sheetName) — (private) trả về Sheet object.

3. headerMap(sheetName) → Object
   Đọc hàng đầu tiên, trả về { TenCot: index (0-based) }.
   Cache kết quả trong biến global để tránh đọc lại nhiều lần.

4. readRows(sheetName) → Object[]
   Đọc toàn bộ dữ liệu (từ hàng 2), map sang array of objects dùng headerMap.
   Bỏ qua hàng có TrangThai = TRANG_THAI.DA_XOA.

5. appendRow(sheetName, obj) → void
   Thêm hàng mới theo thứ tự header. Giá trị thiếu điền ''.

6. updateRow(sheetName, idValue, obj) → void
   Tìm hàng có cột đầu tiên = idValue, cập nhật các field trong obj.
   Batch: đọc 1 lần, sửa trong memory, ghi 1 lần.

7. softDelete(sheetName, idValue) → void
   Gọi updateRow với { TrangThai: TRANG_THAI.DA_XOA }.

8. genId(prefix) → string
   Format: PREFIX-YYYYMMDD-NNN (NNN là số thứ tự trong ngày, padStart 3).
   Đọc sheet tương ứng để lấy số thứ tự tiếp theo.

9. genSoChungTu(loai) → string
   Format: PT-YYYYMM-NNN hoặc PC-YYYYMM-NNN.
   Đọc sheet GiaoDich lọc SoChungTu cùng tháng để lấy NNN tiếp theo.

10. formatVND(so) → string
    1500000 → '1.500.000 đ'. Dùng toLocaleString hoặc tự format.

11. parseDate(str) → Date
    Nhận 'dd/MM/yyyy', trả về Date object.

12. formatDate(date) → string
    Nhận Date object, trả về 'dd/MM/yyyy'.

13. getToday() → Date — trả về ngày hôm nay (00:00:00).

14. addDays(date, n) → Date — cộng n ngày vào date.

15. diffDays(date1, date2) → number — số ngày giữa 2 ngày.

Quy tắc: batch read/write, không gọi Sheets API trong loop.
```

---

## P03 — Setup.gs

```
Đọc CLAUDE.md, rules.md, Config.gs, Utils.gs đã tạo.

Tạo file `Setup.gs` — khởi tạo workbook và menu.

1. onOpen()
   Tạo menu custom "💰 Dòng tiền" với các mục:
   - Khởi tạo workbook
   - Xóa dữ liệu mẫu
   - --- (separator)
   - Cài trigger hằng ngày
   - Gỡ trigger
   - --- (separator)
   - Cập nhật Dashboard
   - Cập nhật Forecast

2. khoiTaoWorkbook()
   - Tạo hoặc lấy 10 sheet theo SHEET_NAMES (dùng getSheetByName, nếu chưa có thì insertSheet)
   - Với mỗi sheet trong HEADERS: ghi header vào hàng 1, bold, freeze row 1, autoResize
   - Với sheet Dashboard/Forecast/BaoCao: chỉ tạo sheet nếu chưa có, không ghi header
   - Gọi taoSeedData_() sau khi tạo xong
   - Idempotent: chạy lại không xóa dữ liệu hiện có

3. taoSeedData_() — (private)
   Chỉ chạy nếu DM_DuAn đang trống.
   Thêm dữ liệu mẫu có prefix [MẪU] vào 4 sheet danh mục:
   - 2 dự án mẫu: DA-001 [MẪU] Chiếu sáng Quận 3, DA-002 [MẪU] Chiếu sáng Bình Dương
   - 3 đối tác mẫu: chủ đầu tư, NCC, thầu phụ
   - 5 hạng mục mẫu: Vật tư thiết bị, Nhân công, Vận chuyển, Chi phí quản lý, Thu nghiệm thu
   - 3 tài khoản: ACB (SoDuDauKy=0, HanMucToiThieu=5000000),
                  Sacombank (SoDuDauKy=0, HanMucToiThieu=5000000),
                  Tiền mặt (SoDuDauKy=0, HanMucToiThieu=2000000)

4. xoaDuLieuMau()
   Xóa (soft delete) tất cả hàng có TenDuAn / TenDoiTac / TenHangMuc bắt đầu bằng '[MẪU]'
   trong 4 sheet danh mục. Hiện toast thông báo khi xong.
```

---

## P04 — Transactions.gs

```
Đọc CLAUDE.md, rules.md, skills.md, Config.gs, Utils.gs đã tạo.

Tạo file `Transactions.gs` — quản lý giao dịch thu/chi.

1. themGiaoDich(data) → { ok: boolean, id: string, soChungTu?: string }
   data: { NgayGD, MaDuAn, MaDoiTac, MaTK, MaHangMuc, LoaiThuChi, SoTien, MaKHKhop?, GhiChu?, NguoiNopThu? }

   Logic:
   - Validate: NgayGD, MaDuAn, MaTK, SoTien, LoaiThuChi là bắt buộc
   - Sinh MaGD = genId('GD')
   - Nếu MaTK = tài khoản tiền mặt (TK_TM):
       * Sinh SoChungTu = genSoChungTu(LoaiThuChi === 'Thu' ? 'PT' : 'PC')
       * LoaiChungTu = PT hoặc PC
       * Kiểm tra tồn quỹ nếu Chi: lấy soDuHienTai_(), nếu SoTien > soDu thì throw Error cảnh báo
   - Nếu MaTK là ngân hàng: LoaiChungTu = UNC (chi) hoặc để trống (thu)
   - TrangThai = CHUA_THUC_HIEN (chưa khớp kế hoạch) hoặc DA_THUC_HIEN nếu MaKHKhop được truyền
   - appendRow vào GiaoDich
   - Nếu tồn quỹ sau giao dịch < HanMucToiThieu → gọi guiCanhBaoTonQuy_() (import từ Telegram.gs)

2. danhSachGiaoDich(filter?) → Object[]
   filter: { maDuAn?, maTK?, tuNgay?, denNgay?, loaiThuChi? }
   Đọc GiaoDich, bỏ DaXoa, áp filter, sắp xếp NgayGD giảm dần.

3. xoaGiaoDich(maGD) → { ok: boolean }
   Soft delete. Nếu giao dịch đang khớp kế hoạch (MaKHKhop không rỗng) → throw Error.

4. soDuHienTai_(maTK) → number   (private)
   SoDuDauKy + Σ Thu - Σ Chi từ GiaoDich (bỏ DaXoa) của tài khoản đó.

5. soDuTheoTK_() → { [maTK]: number }   (private)
   Tính song song cho tất cả tài khoản, đọc sheet 1 lần.

6. soQuyTienMat(tuNgay, denNgay) → Object[]
   Lọc GiaoDich theo MaTK = TK_TM và khoảng ngày.
   Mỗi dòng có thêm field SoDuSauGD (tính lũy kế).
   Thêm dòng đầu: số dư đầu kỳ.

7. kiemTraHanMucTonQuy_(maTK, soDuMoi) → boolean   (private)
   Đọc HanMucToiThieu từ DM_TaiKhoan, trả về true nếu soDuMoi < hạn mức.
```

---

## P05 — Planning.gs

```
Đọc CLAUDE.md, rules.md, skills.md, Config.gs, Utils.gs, Transactions.gs đã tạo.

Tạo file `Planning.gs` — quản lý kế hoạch thu/chi (AR/AP).

1. themKeHoach(data) → { ok, id }
   data: { MaDuAn, MaDoiTac, LoaiThuChi, SoTien, NgayDuKien, GhiChu? }
   Sinh MaKeHoach = genId('KH'), TrangThai = CHUA_THUC_HIEN.

2. taoLichThanhToan(maDuAn, giaTriHD, tyLe, ngayKy) → { ok, ids: string[] }
   tyLe: number[] — ví dụ [30, 60, 10] (phần trăm, tổng = 100)
   ngayKy: Date — ngày ký hợp đồng
   Sinh kế hoạch Thu tự động:
   - Đợt 1 (30%): ngayKy + 30 ngày
   - Đợt 2 (60%): ngayKy + 90 ngày
   - Đợt cuối: ngayKy + 150 ngày
   (Khoảng cách ngày tỉ lệ với % đợt thanh toán)
   GhiChu: 'Đợt 1 - 30% giá trị HĐ', v.v.

3. taoGiuLaiBaoHanh(maDuAn, ngayNghiemThu, tyLe?) → { ok, id }
   tyLe mặc định = TY_LE_GIU_LAI_BAO_HANH (5%)
   Đọc GiaTriHD từ DM_DuAn.
   NgayDuKien = ngayNghiemThu + THOI_HAN_BAO_HANH_THANG tháng.
   LoaiThuChi = Thu, GhiChu = 'Giữ lại bảo hành 5%'.

4. khopKeHoach(maKH, maGD) → { ok }
   - Validate: cả hai tồn tại và chưa khớp
   - Cập nhật KeHoach: TrangThai = DA_THUC_HIEN, MaGDKhop = maGD
   - Cập nhật GiaoDich: MaKHKhop = maKH, TrangThai = DA_THUC_HIEN

5. huyKhopKeHoach(maKH) → { ok }
   - Lấy MaGDKhop từ KeHoach
   - Reset KeHoach: TrangThai = CHUA_THUC_HIEN, MaGDKhop = ''
   - Reset GiaoDich: MaKHKhop = '', TrangThai = CHUA_THUC_HIEN

6. congNo() → { phaiThu: Object[], phaiTra: Object[] }
   phaiThu: KeHoach Thu với TrangThai != DA_THUC_HIEN và != DA_XOA, group theo MaDuAn.
   phaiTra: KeHoach Chi tương tự.
   Mỗi nhóm có: maDuAn, tenDuAn, soKhoan, tongTien, soKhoanQuaHan.

7. capNhatQuaHan() → void
   Đọc tất cả KeHoach có TrangThai = CHUA_THUC_HIEN.
   Nếu NgayDuKien < getToday() → updateRow TrangThai = QUA_HAN.
   Batch update: đọc 1 lần, xác định rows cần sửa, ghi lại 1 lần.
```

---

## P06 — Forecast.gs

```
Đọc CLAUDE.md, rules.md, Config.gs, Utils.gs, Planning.gs đã tạo.

Tạo file `Forecast.gs`.

capNhatForecast() → void
Tính dự báo dòng tiền 6 tháng kế tiếp từ tháng hiện tại.

Logic:
1. Lấy số dư hiện tại tất cả tài khoản (gọi soDuTheoTK_ từ Transactions.gs).
   Tổng số dư đầu kỳ = Σ tất cả tài khoản.

2. Lấy tất cả KeHoach chưa thực hiện (TrangThai != DA_THUC_HIEN, != DA_XOA).

3. Group theo tháng (YYYY-MM):
   - Tổng Thu dự kiến mỗi tháng
   - Tổng Chi dự kiến mỗi tháng
   - Ròng = Thu - Chi

4. Tính lũy kế 6 tháng:
   Tháng 1: SoDuDauKy + Ròng tháng 1
   Tháng 2: Lũy kế tháng 1 + Ròng tháng 2
   ...

5. Ghi vào sheet Forecast (xóa nội dung cũ trước):
   Header: Tháng | Thu kế hoạch | Chi kế hoạch | Ròng | Lũy kế
   Một hàng cho mỗi trong 6 tháng.

6. Highlight đỏ (background #FFE0E0) các hàng có Lũy kế < 0 (tháng âm tiền).

7. Tạo biểu đồ cột trên sheet Forecast nếu chưa có.
   Series: Thu (xanh lá), Chi (đỏ), Lũy kế (đường - xanh dương).
```

---

## P07 — Dashboard.gs

```
Đọc CLAUDE.md, rules.md, Config.gs, Utils.gs, Transactions.gs, Planning.gs đã tạo.

Tạo file `Dashboard.gs`.

capNhatDashboard() → void

Xóa nội dung sheet Dashboard rồi ghi lại toàn bộ. Không dùng format bảng phức tạp — ghi vào các cell cụ thể.

Các khối thông tin cần ghi:

KHỐI 1 — Số dư tài khoản (cột A-C, bắt đầu hàng 1):
- Tiêu đề: 'SỐ DƯ TÀI KHOẢN' (bold, merge A1:C1)
- Mỗi tài khoản 1 hàng: TenTK | SoDu (formatVND) | % thay đổi so tháng trước
- Highlight đỏ nếu tài khoản Tiền mặt < HanMucToiThieu

KHỐI 2 — Công nợ (cột E-G, bắt đầu hàng 1):
- Tiêu đề: 'CÔNG NỢ'
- Phải thu: số khoản, tổng tiền
- Phải trả: số khoản, tổng tiền
- Quá hạn thu: số khoản, tổng tiền (highlight đỏ)
- Quá hạn trả: số khoản, tổng tiền (highlight đỏ)

KHỐI 3 — Top 5 dự án phải thu lớn nhất (cột A-C, hàng 12+):
- TenDuAn | Phải thu | % đã thu

KHỐI 4 — Biểu đồ dòng tiền 12 tháng qua (cột E-L, hàng 8+):
- Tính Thu/Chi từng tháng trong 12 tháng qua từ GiaoDich
- Tạo biểu đồ cột nếu chưa có

Cập nhật cell A1 của sheet Dashboard với timestamp 'Cập nhật lúc: dd/MM/yyyy HH:mm'.
```

---

## P08 — ProjectReport.gs

```
Đọc CLAUDE.md, rules.md, Config.gs, Utils.gs, Transactions.gs, Planning.gs đã tạo.

Tạo file `ProjectReport.gs`.

baoCaoDuAn(maDuAn?) → void
Nếu maDuAn = null thì báo cáo tất cả dự án, mỗi dự án một section.

Với mỗi dự án, xóa nội dung cũ trên sheet BaoCao và ghi:

1. Header dự án: TenDuAn | GiaTriHD | NgayKy | TrangThai (bold, merge)

2. Bảng P&L tiền mặt:
   | Chỉ tiêu          | Kế hoạch | Thực tế | % thực hiện |
   | Thu nghiệm thu     | ...      | ...     | ...         |
   | Chi vật tư         | ...      | ...     | ...         |
   | Chi nhân công      | ...      | ...     | ...         |
   | Chi khác           | ...      | ...     | ...         |
   | TỔNG THU           | ...      | ...     | ...         |
   | TỔNG CHI           | ...      | ...     | ...         |
   | RÒNG (Thu - Chi)   | ...      | ...     | ...         |

   Nguồn dữ liệu:
   - Kế hoạch: từ sheet KeHoach, group theo MaHangMuc
   - Thực tế: từ sheet GiaoDich, group theo MaHangMuc

3. Bảng chi tiết giao dịch thực tế (10 giao dịch gần nhất):
   NgayGD | LoaiThuChi | SoTien | TenHangMuc | SoChungTu | GhiChu

4. Highlight hàng TỔNG THU/CHI/RÒNG (background vàng nhạt, bold).
   Highlight đỏ nếu RÒNG < 0.
```

---

## P09 — Telegram.gs

```
Đọc CLAUDE.md, rules.md, prompts.md (phần template Telegram), Config.gs, Utils.gs đã tạo.

Tạo file `Telegram.gs` — gửi thông báo qua Telegram Bot và Gmail.

1. guiTelegram_(message) — (private)
   Lấy TELEGRAM_TOKEN và TELEGRAM_CHAT_ID từ PropertiesService.getScriptProperties().
   POST tới https://api.telegram.org/bot{TOKEN}/sendMessage
   payload: { chat_id, text: message, parse_mode: 'Markdown' }
   Wrap trong try/catch — không throw, chỉ log lỗi.

2. guiEmail_(subject, body) — (private)
   Lấy EMAIL_CANH_BAO từ Script Properties (fallback: Session.getActiveUser().getEmail()).
   GmailApp.sendEmail(to, subject, body).
   Wrap trong try/catch.

3. guiCanhBaoTongHop() — gọi bởi trigger 7h sáng
   Thu thập dữ liệu từ tất cả hàm private bên dưới.
   Gộp thành 1 tin Telegram duy nhất theo template trong prompts.md.
   Gọi cả guiTelegram_ và guiEmail_ (email có HTML format).

4. guiCanhBaoDenHan_() → Object — (private)
   Lấy KeHoach có NgayDuKien trong [hôm nay, hôm nay + NGAY_CANH_BAO_DEN_HAN].
   TrangThai != DA_THUC_HIEN, != DA_XOA.
   Trả về { soKhoan, tongTien, chiTiet: string }.

5. guiCanhBaoQuaHan_() → Object — (private)
   Lấy KeHoach có TrangThai = QUA_HAN.
   Trả về { soKhoan, tongTien, chiTiet: string }.

6. guiCanhBaoCashGap_() → Object — (private)
   Đọc sheet Forecast, tìm hàng có Lũy kế < 0.
   Trả về { soThang, chiTiet: string } (tên các tháng âm tiền).

7. guiCanhBaoTonQuy_() — (private) — gọi ngay khi nhập giao dịch tiền mặt
   Đọc tồn quỹ TK_TM và HanMucToiThieu.
   Nếu < hạn mức: gọi guiTelegram_ với template cảnh báo khẩn.

8. guiCanhBaoHoSoChoLuu_() → Object — (private)
   Lấy HoSo có TrangThai = CHO_LUU và NgayTao < hôm nay - NGAY_CANH_BAO_HO_SO.
   Trả về { soFile, chiTiet: string }.

Template tin nhắn: xem phần "Telegram — Template" trong prompts.md (phần 2 bên dưới).
```

---

## P10 — Triggers.gs

```
Đọc CLAUDE.md, rules.md, Config.gs đã tạo.

Tạo file `Triggers.gs`.

1. caiTrigger() → void
   - Xóa tất cả trigger hiện có có tên hàm = 'chayHangNgay'
   - Tạo 1 trigger mới: ScriptApp.newTrigger('chayHangNgay').timeBased().everyDays(1).atHour(7).create()
   - Idempotent — gọi lại không tạo duplicate
   - Hiển thị toast 'Đã cài trigger 7h sáng hằng ngày'

2. goTrigger() → void
   - Xóa tất cả trigger của project
   - Toast 'Đã gỡ tất cả trigger'

3. chayHangNgay() → void — hàm được gọi bởi trigger
   - capNhatQuaHan()       (từ Planning.gs)
   - capNhatForecast()     (từ Forecast.gs)
   - capNhatDashboard()    (từ Dashboard.gs)
   - guiCanhBaoTongHop()   (từ Telegram.gs)
   Wrap toàn bộ trong try/catch, log lỗi vào Logger.
   Dùng SpreadsheetApp.openById(SPREADSHEET_ID) — không dùng getActiveSpreadsheet().
```

---

## P11 — HoSoServer.gs

```
Đọc CLAUDE.md, rules.md, prompts.md (phần P01 — Gemini API), Config.gs, Utils.gs đã tạo.

Tạo file `HoSoServer.gs` — xử lý hồ sơ dự án + tích hợp Gemini.

1. phanLoaiHoSo(tenFile, contentBase64) → { loai, tenThuMucCon, maDuAnGoiY, moTa, doTinCay }
   - Đọc GEMINI_API_KEY từ Script Properties
   - Gọi Gemini 1.5 Flash với prompt trong prompts.md phần "Phân loại hồ sơ dự án"
   - Truyền tenFile + 2000 ký tự đầu của nội dung (decode base64 nếu là text)
   - Truyền danh sách dự án hiện có (readRows DM_DuAn)
   - Parse JSON response
   - Nếu GEMINI_API_KEY chưa cấu hình → fallback sang phanLoaiTheoTenFile_(tenFile)

2. phanLoaiTheoTenFile_(tenFile) → Object — (private) fallback không cần AI
   Dùng regex/keyword matching theo bảng trong chucnang.md phần 7.
   HĐ/hop-dong/contract → HopDong, BB/bien-ban → BienBan, v.v.

3. xayDungDuongDan_(loai, maDuAn, tenDuAn, tenFile) → string — (private)
   Đọc ONEDRIVE_ROOT_PATH từ Script Properties.
   Format: {root}\{maDuAn}_{tenDuAn}\{tenThuMucCon}\{tenFile}
   TenDuAn bỏ dấu tiếng Việt (dùng hàm boiDau_).

4. boiDau_(str) → string — (private)
   Bỏ dấu tiếng Việt: 'Chiếu sáng' → 'Chieu sang'. Dùng normalize + replace regex.

5. luuMetadataHoSo(data) → { ok, id, duongDanGoiY }
   data: { maDuAn, tenFile, loaiTaiLieu, contentBase64? }
   - Gọi phanLoaiHoSo nếu loaiTaiLieu chưa có
   - Lấy tenDuAn từ DM_DuAn
   - Xây dựng đường dẫn gợi ý
   - Sinh MaHoSo = genId('HS')
   - appendRow vào HoSo với TrangThai = CHO_LUU
   - Trả về { ok, id, duongDanGoiY }

6. xacNhanDaLuu(maHoSo) → { ok }
   updateRow HoSo: TrangThai = DA_LUU.

7. danhSachHoSo(maDuAn?) → Object[]
   readRows HoSo, filter theo maDuAn nếu có, sắp xếp NgayTao giảm dần.
```

---

## P12 — ImportServer.gs

```
Đọc CLAUDE.md, rules.md, Config.gs, Utils.gs, Transactions.gs đã tạo.

Tạo file `ImportServer.gs` — import sao kê ngân hàng.

1. parseBankStatement(csvText, maTK) → Object[]
   Nhận CSV paste từ user, maTK là tài khoản ngân hàng tương ứng.
   Parse từng dòng CSV (bỏ header), trả về array:
   { ngay, soTien, loaiThuChi, moTa, rawLine }

   Xử lý 2 định dạng:
   - ACB: cột Ngày, Số tiền ghi nợ, Số tiền ghi có, Mô tả
   - Sacombank: cột Ngày GD, Phát sinh Nợ, Phát sinh Có, Diễn giải
   Nhận diện định dạng từ header row.

2. xemTruocImport(csvText, maTK) → { rows: Object[], tongThu, tongChi, soHangLoi }
   Gọi parseBankStatement, nhóm kết quả, trả về để hiển thị preview trước khi xác nhận.

3. xacNhanImport(rows, maDuAn) → { ok, soHangDaNhap, soHangBo }
   rows: array từ parseBankStatement (đã user review)
   Với mỗi hàng được chọn (checked = true):
   - Gọi themGiaoDich với LoaiChungTu = SAO_KE
   - Không sinh SoChungTu cho sao kê
   Trả về số hàng nhập thành công / bỏ qua.

4. kiemTraTrungLap_(ngay, soTien, maTK) → boolean — (private)
   Kiểm tra GiaoDich đã có hàng tương tự (cùng ngày, số tiền, tài khoản) chưa.
   Dùng để warn user trước khi import.
```

---

## P13 — FormServer.gs

```
Đọc CLAUDE.md, rules.md, Config.gs, Utils.gs và tất cả .gs đã tạo.

Tạo file `FormServer.gs` — entry point web app, API layer cho frontend.

1. doGet(e) → HtmlOutput
   return HtmlService.createTemplateFromFile('index').evaluate()
     .setTitle('LAVIPCO — Quản lý Dòng tiền')
     .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

2. include(filename) — helper cho HTML template
   return HtmlService.createHtmlOutputFromFile(filename).getContent();

Các hàm API (gọi qua google.script.run từ frontend):

3. getOverviewData() → Object
   Trả về: { soDuTheoTK, congNo, tonQuyTienMat, hanMucTienMat, forecast6thang (tóm tắt) }

4. getForecastData() → Object[]
   Đọc sheet Forecast, trả về array 6 tháng.

5. getProjectList() → Object[]
   readRows DM_DuAn, chỉ trả về { maDuAn, tenDuAn } cho dropdown.

6. getAccountList() → Object[]
   readRows DM_TaiKhoan, trả về { maTK, tenTK, nganHang }.

7. getPartnerList() → Object[]
   readRows DM_DoiTac, trả về { maDoiTac, tenDoiTac, loaiDoiTac }.

8. getCategoryList() → Object[]
   readRows DM_HangMuc, trả về { maHangMuc, tenHangMuc, loaiThuChi }.

9. getPlanList(maDuAn) → Object[]
   KeHoach của dự án đó, TrangThai = CHUA_THUC_HIEN.

10. submitTransaction(data) → { ok, id, soChungTu? }
    Gọi themGiaoDich(data).

11. getTransactionList(filter) → Object[]
    Gọi danhSachGiaoDich(filter).

12. deleteTransaction(maGD) → { ok }
    Gọi xoaGiaoDich(maGD).

13. getCashBook(tuNgay, denNgay) → Object[]
    Gọi soQuyTienMat(parseDate(tuNgay), parseDate(denNgay)).

14. getProjectReport(maDuAn) → Object
    Tính P&L tại chỗ (không ghi vào sheet), trả về data cho frontend render.

15. importBankStatement(csvText, maTK, maDuAn) → { ok, preview: Object[] }
    Gọi xemTruocImport, trả về preview cho user xem trước.

16. confirmImport(rows, maDuAn) → { ok, count }
    Gọi xacNhanImport.

17. classifyDocument(tenFile, contentBase64) → Object
    Gọi phanLoaiHoSo từ HoSoServer.gs.

18. saveDocumentMeta(data) → { ok, id, duongDanGoiY }
    Gọi luuMetadataHoSo.

19. confirmDocumentSaved(maHoSo) → { ok }
    Gọi xacNhanDaLuu.

20. getDocumentList(maDuAn?) → Object[]
    Gọi danhSachHoSo.
```

---

## P14 — index.html (SPA Dashboard)

```
Đọc CLAUDE.md, rules.md, skills.md (FormServer.gs API), chucnang.md phần 5.

Tạo file `index.html` — Single Page Application, dashboard chính của web app.

Stack frontend: HTML + CSS thuần + Vanilla JS (không dùng React/Vue/framework).
Responsive, mobile-friendly. Font: system-ui hoặc Roboto CDN.

Cấu trúc trang:

NAVBAR (cố định trên cùng):
- Logo LAVIPCO + tên app
- Nav tabs: Dashboard | Giao dịch | Kế hoạch | Sổ quỹ | Hồ sơ | Báo cáo | Import

PANEL: DASHBOARD (tab mặc định):
- 4 card số dư tài khoản (ACB / Sacombank / Tiền mặt / Tổng) — highlight đỏ nếu < hạn mức
- 2 card công nợ: Phải thu (xanh) / Phải trả (đỏ) — hiển thị tổng và số khoản quá hạn
- Bảng "Đến hạn trong 7 ngày" — 5 dòng gần nhất
- Section Forecast: 6 tháng dạng progress bar lũy kế, tháng âm màu đỏ

PANEL: GIAO DỊCH:
- Nút "Nhập giao dịch mới" → mở Form.html dạng dialog/modal
- Bảng danh sách giao dịch với filter: dự án, tài khoản, khoảng ngày
- Cột: Ngày | Dự án | Tài khoản | Loại | Số tiền | Chứng từ | Trạng thái | Xóa

PANEL: KẾ HOẠCH:
- Tabs con: Phải thu | Phải trả
- Bảng nhóm theo dự án, expand để xem chi tiết từng đợt
- Nút Khớp giao dịch (chọn kế hoạch + chọn giao dịch từ dropdown)

PANEL: SỔ QUỸ:
- Picker khoảng ngày (mặc định tháng hiện tại)
- Bảng sổ quỹ: Ngày | Chứng từ | Diễn giải | Thu | Chi | Số dư
- Dòng tổng cuối trang

PANEL: HỒ SƠ: nhúng nội dung từ HoSo.html

PANEL: BÁO CÁO:
- Dropdown chọn dự án
- Hiển thị P&L theo dạng bảng (dữ liệu từ getProjectReport)

PANEL: IMPORT: nhúng nội dung từ Import.html

Tất cả gọi backend qua google.script.run.withSuccessHandler(fn).withFailureHandler(errFn).
Hiển thị loading spinner khi chờ. Toast thông báo kết quả.
Dùng include('Form.html') và include('Import.html') qua template GAS.
```

---

## P15 — Form.html (Nhập giao dịch)

```
Đọc CLAUDE.md, rules.md, skills.md (FormServer.gs API), chucnang.md phần 2 và 4.

Tạo file `Form.html` — form nhập giao dịch thu/chi.

Đây là một fragment HTML (không có <html><body>) — được nhúng vào index.html qua include().
Hiển thị dạng modal dialog khi user click "Nhập giao dịch mới".

Form fields:
1. Ngày giao dịch (date picker, mặc định hôm nay)
2. Loại thu/chi (radio: Thu / Chi)
3. Dự án (select, load từ getProjectList)
4. Tài khoản (select, load từ getAccountList)
   → Khi chọn Tiền mặt: hiện thêm field "Người nộp/nhận tiền"
5. Đối tác (select, load từ getPartnerList)
6. Hạng mục (select, load từ getCategoryList, filter theo loại thu/chi)
7. Số tiền (number, format VND khi blur)
8. Kế hoạch liên kết (select optional, load từ getPlanList khi dự án được chọn)
9. Ghi chú (textarea)

Validation trước khi submit:
- Tất cả field bắt buộc phải có giá trị
- Số tiền > 0
- Nếu Chi tiền mặt: hiện cảnh báo nếu > tồn quỹ hiện tại

Sau khi submit thành công:
- Hiển thị toast: "Đã nhập [PT/PC nếu tiền mặt] — Số chứng từ: XXX"
- Reset form, đóng modal
- Reload bảng giao dịch và card số dư

Styling: clean, mobile-first, input height tối thiểu 44px.
```

---

## P16 — HoSo.html (Hồ sơ dự án)

```
Đọc CLAUDE.md, rules.md, skills.md (FormServer.gs API), chucnang.md phần 7, prompts.md phần Gemini.

Tạo file `HoSo.html` — quản lý hồ sơ dự án với AI phân loại.

Fragment HTML nhúng vào index.html.

PHẦN 1 — Upload & phân loại:
- Vùng kéo thả file (drag & drop zone) + nút "Chọn file"
- Chấp nhận: PDF, Word (.docx), Excel (.xlsx), ảnh (JPG/PNG)
- Giới hạn: 10MB/file
- Sau khi chọn file:
  1. Hiện loading "Đang phân tích file..."
  2. Đọc file dưới dạng base64 (FileReader API)
  3. Gọi classifyDocument(tenFile, contentBase64)
  4. Hiển thị kết quả phân tích:
     - Loại tài liệu: [icon] Hợp đồng (độ tin cậy: Cao)
     - Dự án gợi ý: DA-001 — Chiếu sáng Quận 3 (dropdown cho phép đổi)
     - Đường dẫn lưu: [path đầy đủ] [nút Copy 📋]
  5. Nút "Xác nhận & Lưu metadata" → gọi saveDocumentMeta
  6. Toast: "Đã lưu! Hãy copy đường dẫn và lưu file vào đúng vị trí"

PHẦN 2 — Danh sách hồ sơ:
- Filter: dropdown dự án + dropdown loại tài liệu + filter trạng thái (Chờ lưu/Đã lưu)
- Bảng: Tên file | Loại | Dự án | Đường dẫn | Ngày | Trạng thái | Action
- Hàng "Chờ lưu": background vàng nhạt, nút "Đã lưu" → gọi confirmDocumentSaved
- Badge đếm số file "Chờ lưu" trên tab Hồ sơ trong navbar

Lưu ý: không upload file lên server, chỉ đọc client-side để gửi cho Gemini.
File được user tự lưu vào OneDrive local theo đường dẫn gợi ý.
```

---

## P17 — Import.html (Import sao kê)

```
Đọc CLAUDE.md, rules.md, skills.md (FormServer.gs API), chucnang.md phần 6.

Tạo file `Import.html` — import sao kê ngân hàng.

Fragment HTML nhúng vào index.html.

BƯỚC 1 — Cấu hình import:
- Dropdown chọn tài khoản ngân hàng (ACB / Sacombank)
- Dropdown chọn dự án gắn vào
- Hướng dẫn ngắn: "Vào internet banking → lịch sử giao dịch → xuất CSV → paste vào ô bên dưới"

BƯỚC 2 — Paste CSV:
- Textarea lớn (10 hàng) với placeholder mẫu
- Nút "Phân tích" → gọi importBankStatement(csvText, maTK, maDuAn)

BƯỚC 3 — Xem trước kết quả:
- Hiển thị bảng preview với checkbox mỗi hàng:
  ✅ Ngày | Thu/Chi | Số tiền | Mô tả | Trạng thái (Mới / ⚠️ Trùng lặp)
- Tổng: X hàng — Thu: Y đ — Chi: Z đ
- Nút "Bỏ chọn tất cả trùng lặp" (tự động bỏ check các hàng warning)
- Nút "Xác nhận nhập" → gọi confirmImport với chỉ các hàng checked

BƯỚC 4 — Kết quả:
- Toast: "Đã nhập X giao dịch, bỏ qua Y hàng trùng/không hợp lệ"
- Reset về Bước 1

Styling nhất quán với index.html.
```

---
---

# PHẦN 2 — API Prompt Templates

## Gemini — Phân loại hồ sơ dự án

**Model:** `gemini-1.5-flash` | **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={KEY}`

### System instruction
```
Bạn là trợ lý phân loại tài liệu xây dựng cho công ty xây lắp LAVIPCO (Việt Nam).
Phân tích tên file và nội dung, trả về JSON thuần, không giải thích thêm.
```

### User prompt
```
Phân loại tài liệu:
Tên file: {{TEN_FILE}}
Nội dung (trích đầu): {{NOI_DUNG}}
Dự án hiện có: {{DANH_SACH_DU_AN}}

Trả về JSON:
{
  "loaiTaiLieu": "HopDong"|"BienBan"|"ThanhToan"|"BanVe"|"HoaDon"|"Khac",
  "moTa": "mô tả ngắn bằng tiếng Việt",
  "maDuAnGoiY": "mã dự án hoặc null",
  "tenThuMucCon": "01_HopDong"|"02_BienBan"|"03_ThanhToan"|"04_BanVe"|"05_HoaDon"|"06_Khac",
  "doTinCay": "Cao"|"Trung binh"|"Thap"
}
```

### Code GAS mẫu
```javascript
function goiGemini_(systemInstruction, userPrompt) {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ parts: [{ text: userPrompt }] }],
    generationConfig: { response_mime_type: 'application/json', temperature: 0.1 }
  };
  try {
    const res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
    const json = JSON.parse(res.getContentText());
    return JSON.parse(json.candidates[0].content.parts[0].text);
  } catch (e) {
    Logger.log('Gemini error: ' + e.message);
    return null;
  }
}
```

---

## Telegram — Template tin nhắn

### Cảnh báo tổng hợp 7h sáng
```
📊 *BÁO CÁO DÒNG TIỀN LAVIPCO*
📅 {{NGAY}}

💰 *Số dư:*
  • ACB: {{SO_DU_ACB}}
  • Sacombank: {{SO_DU_SCB}}
  • Tiền mặt: {{TON_QUY}} {{CANH_BAO_QUY}}

⚠️ *Cần xử lý:*
  • Đến hạn 7 ngày: {{SO_KHOAN_DEN_HAN}} khoản / {{TONG_DEN_HAN}}
  • Quá hạn: {{SO_KHOAN_QUA_HAN}} khoản / {{TONG_QUA_HAN}}
  • Hồ sơ chưa lưu > 3 ngày: {{SO_HO_SO}} file

📉 *Tháng âm tiền:* {{THANG_AM}}
```
`{{CANH_BAO_QUY}}` = `⚠️ DƯỚI HẠN MỨC` nếu tồn quỹ < hạn mức, ngược lại để trống.

### Cảnh báo tồn quỹ khẩn (gửi ngay)
```
🚨 *CẢNH BÁO TỒN QUỸ*
Tồn quỹ: {{TON_QUY}} đ
Hạn mức tối thiểu: {{HAN_MUC}} đ
Cần bổ sung quỹ ngay!
```

---

## Thứ tự build — Dependency map

```
P01 Config.gs
  └─ P02 Utils.gs
       ├─ P03 Setup.gs
       ├─ P04 Transactions.gs
       │    └─ P05 Planning.gs
       │         ├─ P06 Forecast.gs
       │         ├─ P07 Dashboard.gs
       │         └─ P08 ProjectReport.gs
       ├─ P09 Telegram.gs (dùng Transactions + Planning + Forecast)
       │    └─ P10 Triggers.gs
       ├─ P11 HoSoServer.gs
       ├─ P12 ImportServer.gs (dùng Transactions)
       └─ P13 FormServer.gs (dùng tất cả .gs trên)
            ├─ P14 index.html
            ├─ P15 Form.html
            ├─ P16 HoSo.html
            └─ P17 Import.html
```
