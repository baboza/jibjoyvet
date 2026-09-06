@echo off
echo ===================================================
echo Installing Next.js with Tailwind CSS and TypeScript
echo ===================================================
call npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes

echo ===================================================
echo Installing Firebase and Lucide-React
echo ===================================================
call npm install firebase lucide-react

echo ===================================================
echo Initialization Complete! You can close this window.
echo ===================================================
pause
