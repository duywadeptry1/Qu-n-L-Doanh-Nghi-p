# Viễn Đông Sales Backend (Node.js + Express + MongoDB Atlas)

Backend REST API Server kết nối trực tiếp cơ sở dữ liệu **MongoDB Atlas** (`viendong`) cho ứng dụng Quản Lý Doanh Nghiệp **Viễn Đông Sales**. Toàn bộ số liệu thống kê, lịch đơn hàng, nhật ký thu nhập và thông báo đều được đồng bộ tự động từ dữ liệu thực tế trong cơ sở dữ liệu.

---

## 1. Kiến trúc & Lộ trình Đơn hàng 4 Bước

Hệ thống quản lý vòng đời đơn hàng theo lộ trình chuẩn 4 bước:
1. **`PLACED` – Khách hàng đặt hàng:** Tiếp nhận đơn mới, tự động trừ tồn kho sản phẩm tương ứng và phát thông báo đơn mới.
2. **`PREPARING` – Duyệt đơn và chuẩn bị hàng:** Xác nhận duyệt đơn, kiểm tra SKU và đóng gói tại kho.
3. **`DELIVERING` – Giao cho đơn vị vận chuyển:** Bàn giao kiện hàng cho đơn vị vận chuyển.
4. **`DELIVERED` – Đơn hàng đã đến tay khách hàng (Thành công):** Hoàn tất đơn hàng, tự động ghi nhận giao dịch vào bảng `transactions` và cập nhật thống kê thu nhập thực tế.
- *(Trạng thái phụ)* **`CANCELLED` – Đã huỷ:** Đơn hàng bị huỷ, không tính vào doanh thu.

---

## 2. Cấu hình MongoDB Atlas

File cấu hình môi trường `backend/.env`:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@11111.vrur6g5.mongodb.net/viendong?retryWrites=true&w=majority
PORT=5000
```
- **Database Name:** `viendong`
- **Collections chính:** `orders`, `products`, `transactions`, `notifications`, `calendardays`, `companyprofiles`

---

## 3. Hướng dẫn Khởi chạy Backend Server

### Cách 1: Chạy bằng script tự động (tự động thiết lập `adb reverse` cho máy thật qua USB)
```bash
# Từ thư mục gốc dự án hoặc thư mục backend:
./start-backend.sh
```

### Cách 2: Chạy trực tiếp bằng npm
```bash
cd backend
npm install
npm start
# Hoặc chế độ phát triển (auto-reload):
npm run dev
```

Server lắng nghe tại `http://0.0.0.0:5000` (máy thật qua cáp USB kết nối qua `http://127.0.0.1:5000/`, Android Emulator kết nối qua `http://10.0.2.2:5000/`).

Khi khởi động, server sẽ:
1. Kết nối tới **MongoDB Atlas**.
2. Khởi tạo dữ liệu gốc nếu database trống (`seedDatabase()`).
3. Tự động đồng bộ dữ liệu thực tế cho:
   - **Lịch 30 ngày trong tháng (`syncMonthlyCalendarFromOrders`)**: Tính số đơn thực tế từng ngày từ `01/11` đến hôm nay (`17/11/2026`); các ngày chưa tới (`18/11` – `30/11`) được đánh dấu `isFuture: true` và để trống số liệu.
   - **Giao dịch thu nhập (`syncTransactionsFromOrders`)**: Chỉ ghi nhận từ các đơn hàng thực sự đạt trạng thái `DELIVERED`.
   - **Chuông thông báo (`syncNotificationsFromRealData`)**: Tổng hợp tự động từ trạng thái đơn hàng mới nhất và cảnh báo sản phẩm sắp hết hàng (`stock <= 10`).

---

## 4. Danh sách REST API Endpoints

### Kiểm tra hệ thống & Tổng quan
| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Kiểm tra trạng thái kết nối Server & MongoDB Atlas |
| `GET` | `/api/dashboard/kpis` | Lấy số liệu KPI thực tế (`placedCount`, `preparingCount`, `deliveringCount`, `deliveredCount`, `cancelledCount`, `totalRevenue`) |
| `GET` | `/api/calendar` | Lấy lịch đơn hàng 30 ngày trong tháng (tự động đồng bộ từ đơn hàng thật) |
| `GET` | `/api/profile` | Lấy thông tin hồ sơ pháp lý & ngân hàng của doanh nghiệp |

### Quản lý Đơn hàng (`Orders`)
| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/orders` | Lấy danh sách đơn hàng (hỗ trợ lọc `?status=...` và tìm kiếm `?search=...`) |
| `POST` | `/api/orders` | Tạo đơn hàng mới ở trạng thái `PLACED`, trừ tồn kho và đồng bộ lịch/thông báo |
| `PATCH` | `/api/orders/:id/status` | Xác nhận chuyển trạng thái đơn hàng (`PLACED` → `PREPARING` → `DELIVERING` → `DELIVERED` hoặc chỉ định `status` cụ thể) |

### Quản lý Sản phẩm & Nhập hàng loạt (`Products`)
| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/products` | Lấy danh sách sản phẩm (hỗ trợ `?category=...` và `?search=...`) |
| `POST` | `/api/products` | Thêm 1 sản phẩm mới |
| `POST` | `/api/products/bulk` | **Nhập nhanh hàng loạt (100+ sản phẩm)** từ file Excel (`.xlsx`), `.csv` hoặc danh sách văn bản |
| `PUT` | `/api/products/:id` | Cập nhật thông tin chi tiết, giá bán, tồn kho, hình ảnh sản phẩm |
| `PATCH` | `/api/products/:id/restock` | Nhập thêm tồn kho nhanh cho sản phẩm (`amount`) |

### Thống kê Thu nhập & Thông báo (`Transactions` & `Notifications`)
| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/transactions` | Lấy nhật ký thu tiền thực tế từ các đơn đã giao thành công (`DELIVERED`), hỗ trợ lọc `?paymentType=COD\|BANK\|WALLET` |
| `GET` | `/api/notifications` | Lấy danh sách thông báo trực quan (đơn hàng & cảnh báo tồn kho) |
| `PATCH` | `/api/notifications/read-all` | Đánh dấu đã đọc tất cả thông báo |
