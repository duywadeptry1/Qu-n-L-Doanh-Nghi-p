#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/backend"

# 1. Giải phóng cổng 5000 nếu có tiến trình cũ đang chiếm
fuser -k 5000/tcp >/dev/null 2>&1 || true

# 2. Tự động nối cổng 5000 qua cáp USB (adb reverse) để điện thoại gọi được kể cả khi bật 4G / khác Wi-Fi
ADB_BIN="$(command -v adb || echo "$HOME/Android/Sdk/platform-tools/adb")"
if [ -x "$ADB_BIN" ]; then
  "$ADB_BIN" reverse tcp:5000 tcp:5000 >/dev/null 2>&1 \
    && echo "🔌 Đã bật kết nối qua cáp USB (adb reverse tcp:5000 tcp:5000)" \
    || echo "ℹ️  Chưa thấy điện thoại cắm USB (hoặc chưa bật USB Debugging)"
fi

echo "🚀 Đang khởi động Viễn Đông Sales Backend trên Linux..."
npm run dev
