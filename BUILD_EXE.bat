@echo off
setlocal
cd /d "%~dp0"
echo ==============================================
echo   SMART SPACE TNJ - BUILD WINDOWS EXE
echo ==============================================
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js belum terinstall.
  echo Install Node.js LTS dari https://nodejs.org lalu jalankan lagi.
  pause
  exit /b 1
)

echo [1/4] Install dependency desktop...
call npm install
if errorlevel 1 goto :fail

echo [2/4] Install dependency frontend...
call npm --prefix frontend install
if errorlevel 1 goto :fail

echo [3/4] Install dependency backend...
call npm --prefix backend install
if errorlevel 1 goto :fail

echo [4/4] Build installer + portable EXE...
call npm run dist:win
if errorlevel 1 goto :fail

echo.
echo BUILD SELESAI.
echo File EXE ada di folder: release
echo.
explorer "%~dp0release"
pause
exit /b 0

:fail
echo.
echo [ERROR] Build gagal. Baca pesan error di atas.
pause
exit /b 1
