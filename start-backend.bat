@echo off
@chcp 65001 > nul
title Viễn Đông Sales Backend Server
set PATH=%PATH%;C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs
cd /d "%~dp0backend"
echo Dang khoi chạy Viễn Đông Sales Backend Server...
node server.js
pause
