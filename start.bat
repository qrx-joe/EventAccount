@echo off
chcp 65001 >nul
title T3 Program - 一键启动

echo ========================================
echo   T3 Program 开发环境一键启动
echo ========================================
echo.

:: 启动后端
echo [1/2] 启动后端 (NestJS)...
start "T3-Backend" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 2 /nobreak >nul

:: 启动前端
echo [2/2] 启动前端 (Vite)...
start "T3-Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo   两个服务已在独立窗口中启动
echo   关闭对应窗口即可停止服务
echo ========================================
pause
