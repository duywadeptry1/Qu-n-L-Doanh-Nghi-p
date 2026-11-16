# Viễn Đông Sales Backend (Node.js + Express + MongoDB Atlas)

Backend API server kết nối trực tiếp cơ sở dữ liệu MongoDB Atlas cho ứng dụng quản lý doanh nghiệp Viễn Đông Sales.

## Cấu hình MongoDB Atlas
- **Connection URI**: `mongodb+srv://1904duy_db_user:gcwbwiY2Qq10qRn2@l1111.vrur6g5.mongodb.net/viendong_sales?retryWrites=true&w=majority`
- **Database Name**: `viendong_sales`

## Hướng dẫn khởi chạy Backend Server

```bash
cd backend
npm install
npm start
```

Server sẽ lắng nghe tại cổng `http://localhost:5000` (hoặc `http://0.0.0.0:5000`), tự động kết nối MongoDB Atlas và tự động khởi tạo dữ liệu Seed (Sản phẩm, Đơn hàng, Giao dịch, Thông báo, Lịch làm việc) nếu cơ sở dữ liệu trống.

## Các API Endpoints
- `GET /api/orders` - Lấy danh sách đơn hàng
- `POST /api/orders` - Tạo đơn hàng mới
- `PATCH /api/orders/:id/status` - Cập nhật trạng thái đơn hàng (Đã đặt -> Đang giao -> Đã giao)
- `GET /api/products` - Lấy danh sách sản phẩm
- `POST /api/products` - Thêm sản phẩm mới
- `PATCH /api/products/:id/restock` - Nhập thêm kho sản phẩm
- `GET /api/transactions` - Danh sách đối soát thanh toán
- `GET /api/notifications` - Danh sách thông báo
- `GET /api/calendar` - Lịch làm việc
- `GET /api/dashboard/kpis` - Số liệu KPI tổng quan
