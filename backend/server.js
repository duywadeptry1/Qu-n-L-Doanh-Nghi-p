require('dotenv').config();
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const mongoose = require('mongoose');
const { createApp } = require('./app');
const { seedDatabase } = require('./seedData');

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Thiếu biến môi trường MONGODB_URI (kiểm tra file .env)');
}

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  Đang dùng JWT_SECRET mặc định cho môi trường dev. Hãy đặt JWT_SECRET trong file .env khi chạy production.');
}

const app = createApp();

// Connect to MongoDB Atlas
mongoose.connect(MONGODB_URI, { dbName: 'viendong' })
  .then(async () => {
    console.log(`🚀 Connected successfully to MongoDB Atlas Database (${mongoose.connection.name})!`);
    await seedDatabase();
  })
  .catch(err => {
    console.error('❌ Database Connection Error:', err.message);
  });

function getLanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(iface => iface && iface.family === 'IPv4' && !iface.internal)
    .map(iface => iface.address);
}

function setupUsbReverse(port) {
  const candidates = [
    'adb',
    path.join(os.homedir(), 'Android', 'Sdk', 'platform-tools', 'adb')
  ];
  const tryNext = index => {
    if (index >= candidates.length) return;
    execFile(candidates[index], ['reverse', `tcp:${port}`, `tcp:${port}`], err => {
      if (!err) {
        console.log(`🔌 Đã tự động bật kết nối qua cáp USB (adb reverse tcp:${port} tcp:${port})`);
      } else {
        tryNext(index + 1);
      }
    });
  };
  tryNext(0);
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Backend Server running at http://localhost:${PORT}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Portal Strict API: http://localhost:${PORT}/api/v1/auth/login`);
  setupUsbReverse(PORT);
  const lanAddresses = getLanAddresses();
  if (lanAddresses.length === 0) {
    console.log('⚠️  Không tìm thấy IP LAN nào – máy tính chưa kết nối Wi-Fi/LAN?');
  }
  lanAddresses.forEach(ip => {
    console.log(`📱 Nhập vào app (Hồ sơ → Cấu hình IP): ${ip}:${PORT}`);
    console.log(`   Kiểm tra trên trình duyệt điện thoại: http://${ip}:${PORT}/api/health`);
  });
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Cổng ${PORT} đang bị chiếm. Chạy: fuser -k ${PORT}/tcp rồi thử lại.`);
    process.exit(1);
  }
  throw err;
});
