@echo off
echo ===================================================
echo Installing Dependencies...
echo ===================================================
call npm install

echo ===================================================
echo Starting Next.js Development Server...
echo ===================================================
call npm run dev
pause
