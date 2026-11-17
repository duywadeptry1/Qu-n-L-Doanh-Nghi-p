#!/usr/bin/env bash

# Thoát ngay lập tức nếu có lệnh nào bị lỗi
set -e

# Thiết lập tiêu đề Terminal
echo -e "\033]0;Day code len GitHub (Force Push)\007"

# Chuyển đến đúng thư mục chứa tệp script đang chạy
cd "$(dirname "$0")"

# 1. Kiểm tra cấu hình Git (tránh lỗi Author identity unknown)
if [ -z "$(git config --global user.name)" ]; then
    echo "⚠️ Chưa cấu hình Git user.name. Đang thiết lập mặc định..."
    git config --global user.name "Pham Minh Duy"
fi

if [ -z "$(git config --global user.email)" ]; then
    echo "⚠️ Chưa cấu hình Git user.email. Đang thiết lập mặc định..."
    git config --global user.email "minhduy@archlinux"
fi

echo "[1/3] Đang thêm tất cả tệp mới và thay đổi..."
git add .

# Kiểm tra xem có thay đổi nào cần commit không
if git diff-index --quiet HEAD --; then
    echo "ℹ️ Không có thay đổi mới nào để commit."
else
    echo "[2/3] Đang Commit code..."
    git commit -m "Update full code: MongoDB Atlas backend, REST API, edit status, pick image gallery"
fi

echo "[3/3] Đang ghi đè và đẩy code lên GitHub (Force Push)..."
if git push origin main --force; then
    echo "========================================="
    echo "✅ ĐÃ ĐẨY VÀ GHI ĐÈ PHIÊN BẢN MỚI LÊN GITHUB THÀNH CÔNG!"
    echo "========================================="
else
    echo "========================================="
    echo "❌ LỖI: Không thể đẩy code lên GitHub."
    echo "💡 Gợi ý: Hãy kiểm tra lại kết nối mạng hoặc Personal Access Token (PAT) của bạn."
    echo "========================================="
fi

read -p "Nhấn Enter để thoát..."
