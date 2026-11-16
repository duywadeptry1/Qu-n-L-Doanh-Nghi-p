@echo off
@chcp 65001 > nul
title Day code len GitHub (Force Push)
set PATH=%PATH%;C:\Program Files\Git\cmd
cd /d "%~dp0"

echo [1/3] Dang them tat ca file moi va thay doi...
git add .

echo [2/3] Dang Commit code...
git commit -m "Update full code: MongoDB Atlas backend, REST API, edit status, pick image gallery"

echo [3/3] Dang ghi de va day code len GitHub...
git push origin main --force

echo =========================================
echo ✅ DA DAY VA GHI DE PHIEN BAN MOI LEN GITHUB THANH CONG!
echo =========================================
pause
