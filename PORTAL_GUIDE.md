# Viễn Đông Sales — Hướng dẫn Vận hành & Triển khai Web Portal

Hệ thống gồm 3 thành phần dùng chung cơ sở dữ liệu **MongoDB Atlas (`viendong`)**:
1. **Android App (`app/`)** — ứng dụng bán hàng di động (tương thích qua namespace `/api/*`).
2. **Backend API (`backend/`)** — Node.js + Express + Mongoose, phân quyền JWT + RBAC chuẩn trên `/api/v1/*`.
3. **Web Portal (`portal/`)** — React + TypeScript + Vite (giao diện nền sáng dễ đọc, tối ưu thao tác quản trị).

---

## 1. Chạy phát triển cục bộ (Local Development)

### Bước 1 — Khởi chạy Backend (cổng `5000`)
Đảm bảo file `backend/.env` đã có `MONGODB_URI` (tham khảo `backend/.env.example`):

```bash
cd backend
npm install
npm run dev
```

### Bước 2 — Khởi chạy Web Portal (cổng `5173`)
```bash
cd portal
npm install
npm run dev
```

Truy cập `http://localhost:5173`. Vite dev server tự động proxy `/api/*` sang `http://localhost:5000`.

---

## 2. Triển khai 1 máy chủ duy nhất (Production Single-Server)

Backend (`backend/app.js`) tự động phục vụ giao diện Portal đã build tại `portal/dist` (nếu không đặt `SERVE_PORTAL=false`), giúp triển khai trọn gói trên 1 tiến trình duy nhất:

```bash
# 1. Build Web Portal
cd portal && npm run build

# 2. Chạy Backend (phục vụ cả Portal tại "/" và API tại "/api/v1/*" & "/api/*")
cd ../backend && npm start
```

Mở trình duyệt tại `http://localhost:5000` để truy cập trực tiếp Web Portal.

---

## 3. Tài khoản mẫu & Ma trận phân quyền RBAC

| Vai trò | Email đăng nhập | Mật khẩu mặc định | Quyền chính |
| --- | --- | --- | --- |
| **Admin** | `admin@viendong.vn` | `Admin@123` | Toàn quyền hệ thống, cấu hình VIP/Ship, quản lý user & Audit Log |
| **Quản lý (Manager)** | `manager@viendong.vn` | `Manager@123` | Xem giá nhập/lợi nhuận, quản lý kho, duyệt/huỷ mọi đơn, hồ sơ VIP |
| **Kinh doanh (Sales)** | `sales@viendong.vn` | `Sales@123` | Tạo đơn, xem doanh thu, chăm sóc VIP (**ẩn giá nhập & lợi nhuận**) |
| **Thủ kho (Warehouse)** | `warehouse@viendong.vn` | `Warehouse@123` | Nhập kho / mở khóa giao dịch, nhật ký kho, giao ĐVVC (**ẩn tài chính**) |
| **Kế toán (Accountant)** | `accountant@viendong.vn` | `Accountant@123` | Xem giá nhập, lợi nhuận, sổ giao dịch, xuất CSV & Audit Log |

> **Lưu ý bảo mật:** Đổi mật khẩu các tài khoản mẫu và thiết lập `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` mạnh trong `backend/.env` trước khi đưa lên môi trường sản xuất.

---

## 4. Các quy tắc nghiệp vụ cốt lõi đồng bộ giữa Android & Portal

- **Khóa giao dịch theo tồn kho (`Trade Lock`)**: Khi `stock <= 0` hoặc `quantity > stock`, API `POST /api/v1/orders` và `POST /api/orders` thực hiện kiểm tra nguyên tử (`$gte`) ở tầng MongoDB và trả về `HTTP 409` (`TRADE_LOCKED_INSUFFICIENT_STOCK`). Thủ kho/Quản lý mở khóa ngay bằng nút **🔓 Nhập kho nhanh**.
- **Tự động phân hạng Đại diện VIP & bảo toàn giá vốn**:
  - Hạng `⭐ VIP Bạc` / `👑 VIP Vàng` / `💎 VIP Kim Cương` tự tính theo tần suất đơn hợp lệ (có thể điều chỉnh động tại **Cài đặt → Chính sách VIP & Kho**).
  - Giảm giá sản phẩm mẫu (`isDemoProduct`) luôn được chặn không để giá bán thấp hơn `importPrice`.
  - Hỗ trợ phí ship luôn được chặn không để phí ship thực thu thấp hơn `shippingBaseCost` (giá vốn vận chuyển).
- **Đồng bộ kênh bán `🏢 B2B` & `🛍️ B2C`**: Thống kê doanh thu, lợi nhuận, tỷ trọng và xuất CSV đầy đủ theo kỳ.

---

## 5. Bộ lệnh kiểm thử tự động

```bash
# Kiểm thử Backend (Phase 1 Auth/RBAC + Phase 2 Portal APIs + Phase 5 E2E & Legacy Android)
cd backend && npm test

# Kiểm tra biên dịch TypeScript strict + đóng gói Portal
cd portal && npm run build

# Kiểm thử Unit Test & Build Android App
./gradlew :app:testDebugUnitTest :app:assembleDebug
```
