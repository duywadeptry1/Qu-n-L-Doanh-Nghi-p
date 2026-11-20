# Quản Lý Doanh Nghiệp – Viễn Đông Sales (Android + Node.js + MongoDB Atlas)

Ứng dụng di động quản lý vận hành bán hàng, kho sản phẩm và thống kê thu nhập thời gian thực dành cho **Công ty TNHH Thương Mại & Dịch Vụ Viễn Đông**, kết nối trực tiếp với cơ sở dữ liệu đám mây **MongoDB Atlas**.

---

## Tính năng Nổi bật

### 1. Lộ trình Đơn hàng 4 Bước Chuẩn xác & Xác nhận Trạng thái
Loại bỏ các tính năng rườm rà không cần thiết (như định vị GPS shipper) và tập trung vào quy trình vận hành thực tế gồm **4 bước rõ ràng**:
1. **Khách hàng đặt hàng (`PLACED`)** – Tiếp nhận đơn hàng mới và tự động khấu trừ tồn kho.
2. **Duyệt đơn và chuẩn bị hàng (`PREPARING`)** – Xác nhận duyệt đơn, kiểm tra mã SKU và đóng gói.
3. **Giao cho đơn vị vận chuyển (`DELIVERING`)** – Bàn giao kiện hàng cho đối tác vận chuyển.
4. **Đơn hàng đã đến tay khách hàng (`DELIVERED`)** – Giao thành công, tự động ghi nhận doanh thu vào bảng thống kê thu nhập.
- **Hộp thoại xác nhận (Confirmation Dialog):** Xác nhận chuyển bước tiếp theo ngay trên thẻ đơn hàng hoặc trong màn hình Chi tiết đơn hàng để tránh thao tác nhầm.

### 2. Lịch Đơn hàng Theo Ngày & Theo Tháng (Dữ liệu thật – Hôm nay `17/11/2026`)
- Hiển thị đầy đủ **30 ngày của Tháng 11/2026** (`01/11` đến `30/11`).
- **Từ `01/11` đến `17/11`:** Thống kê chính xác số đơn phát sinh, số đơn đã đến tay khách hàng và số đơn đang xử lý/giao vận trong từng ngày. Chạm vào ngày bất kỳ để lọc danh sách đơn hàng của ngày đó.
- **Các ngày chưa tới (`18/11` – `30/11`):** Tự động làm mờ và để trống số liệu (`--`).

### 3. Bảng Thống Kê Thu Nhập từ 100% Dữ liệu Thật
- Loại bỏ hoàn toàn số liệu ảo cố định.
- Tự động tính **Tổng thu nhập**, **Tiền thu hộ COD (ĐVVC)**, **Chuyển khoản / Ví điện tử**, biểu đồ cột theo **Tuần / Tháng / Năm** và **Nhật ký đơn hàng đã thu tiền** trực tiếp từ các đơn hàng đã hoàn tất (`DELIVERED`).
- Khi xác nhận một đơn hàng sang trạng thái **Đã đến tay khách hàng**, doanh thu và biểu đồ được cập nhật ngay lập tức.

### 4. Chuông Thông báo Trực quan
- Tự động tổng hợp thông báo theo thời gian thực từ trạng thái đơn hàng (`PLACED`, `PREPARING`, `DELIVERING`, `DELIVERED`) và cảnh báo các sản phẩm sắp hết hàng (`tồn kho <= 10`).
- Bấm trực tiếp vào thông báo để mở ngay hộp thoại **Chi tiết & Xác nhận đơn hàng** hoặc chuyển tới màn hình **Sản phẩm**.

### 5. Quản lý Kho & Nhập Hàng Loạt 100+ Sản phẩm bằng File Excel (`.xlsx` / `.csv`)
- Hỗ trợ thêm lẻ từng sản phẩm kèm ảnh từ thư viện hoặc **Thêm hàng loạt (100+ sản phẩm cùng lúc)** qua:
  - **Nhập file Excel (`.xlsx`) hoặc `.csv`** (có nút tải file Excel mẫu ngay trên ứng dụng và bộ file mẫu tại thư mục `sample-data/`).
  - **Dán nhanh nhiều dòng văn bản** theo cú pháp `Tên SP | Giá | Tồn kho | Danh mục | Mã SKU`.

---

## Cấu trúc Thư mục Dự án

```text
Qu-n-L-Doanh-Nghi-p/
├── app/                        # Ứng dụng Android (Kotlin, ViewBinding, Coroutines/StateFlow, Retrofit2)
│   └── src/main/java/com/example/
│       ├── api/                # RetrofitClient, SalesApiService, ApiModels
│       ├── model/              # Domain models (Order,OrderStatus, Product, CalendarDaySummary...)
│       ├── repository/         # SalesRepository (đồng bộ REST API & dữ liệu)
│       ├── ui/                 # Fragments, Adapters, BottomSheetDialogs, Custom Canvas Views
│       ├── utils/              # ExcelProductParser (đọc/ghi .xlsx & .csv)
│       └── viewmodel/          # SalesViewModel (quản lý trạng thái & tính toán dữ liệu thật)
├── backend/                    # Backend Server (Node.js, Express, Mongoose, MongoDB Atlas)
│   ├── models/                 # Mongoose Schemas (Order, Product, Transaction, CalendarDay, Notification)
│   ├── seedData.js             # Khởi tạo & đồng bộ tự động Lịch tháng, Giao dịch, Thông báo từ dữ liệu thật
│   ├── server.js               # REST API Endpoints
│   └── README.md               # Tài liệu chi tiết Backend API
├── sample-data/                # File Excel/CSV mẫu để test tính năng thêm nhanh 10–100 sản phẩm
│   ├── mau_san_pham_10.xlsx
│   ├── mau_san_pham_100.xlsx
│   └── mau_san_pham_100.csv
└── start-backend.sh            # Script khởi chạy nhanh Backend & tự động cấu hình adb reverse
```

---

## Hướng dẫn Cài đặt & Chạy Dự án

### Bước 1: Khởi chạy Backend Server
```bash
chmod +x start-backend.sh
./start-backend.sh
```
*(Hoặc chạy `cd backend && npm install && npm start`)*.

### Bước 2: Chạy Ứng dụng Android
1. Mở dự án trong **Android Studio**.
2. Kết nối điện thoại Android qua cáp USB (hoặc khởi động máy ảo Android Emulator).
3. Nếu dùng điện thoại thật qua USB, đảm bảo đã chạy:
   ```bash
   adb reverse tcp:5000 tcp:5000
   ```
   *(Bạn cũng có thể đổi IP Server trực tiếp ngay trong ứng dụng tại tab **Cá nhân → Đổi IP**).*
4. Nhấn **Run (`app`)** trong Android Studio hoặc chạy lệnh:
   ```bash
   ./gradlew installDebug
   ```

### Bước 3: Chạy Kiểm thử Tự động (Unit Tests)
```bash
./gradlew testDebugUnitTest
```
