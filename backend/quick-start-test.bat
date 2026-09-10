@echo off
REM LandGuard Alert System - Quick Start Test Script (Windows)

setlocal enabledelayedexpansion

echo ==========================================
echo LandGuard Alert System - Quick Start Test
echo ==========================================
echo.

REM Check if backend directory exists
if not exist "backend" (
    echo Error: backend directory not found. Please run from project root.
    exit /b 1
)

REM Check Node.js installation
where /q node
if errorlevel 1 (
    echo Error: Node.js is not installed.
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ^✓ Node.js is installed: %NODE_VERSION%
echo.

REM Install backend dependencies
echo Step 1: Installing backend dependencies...
cd backend
call npm install --quiet 2>nul
if errorlevel 1 (
    call npm install
)
cd ..
echo ^✓ Dependencies installed
echo.

REM Verify syntax
echo Step 2: Checking server.js syntax...
node -c backend\server.js
if errorlevel 1 (
    echo Error: Syntax check failed
    exit /b 1
)
echo ^✓ Syntax is valid
echo.

REM Show configuration
echo Step 3: Configuration Summary
echo ==========================================
echo Backend API:       http://127.0.0.1:8000
echo WebSocket Server:  ws://127.0.0.1:8000
echo Frontend Dev:      http://127.0.0.1:5173
echo.
echo For Android Emulator:
echo   WebSocket URL:   ws://10.0.2.2:8000
echo.
echo For Physical Device (update with your IP):
echo   WebSocket URL:   ws://192.168.x.x:8000
echo ==========================================
echo.

echo Step 4: Ready to Start!
echo.
echo To test the system:
echo.
echo 1. Start the backend server:
echo    cd backend ^&^& npm start
echo.
echo 2. In another terminal, start the frontend:
echo    cd frontend ^&^& npm run dev
echo.
echo 3. Test WebSocket connection:
echo    npm install -g wscat
echo    wscat -c ws://127.0.0.1:8000
echo.
echo 4. Trigger an alert:
echo    curl -X POST http://127.0.0.1:8000/alerts ^
echo      -H "Content-Type: application/json" ^
echo      -d "{\"zoneId\": \"zone-001\"}"
echo.
echo 5. For Android app:
echo    - See ANDROID_INTEGRATION.md for setup instructions
echo    - Update WEBSOCKET_URL with your backend IP
echo    - Check logcat: adb logcat AlertWebSocket:V *:S
echo.
echo Documentation:
echo   - TESTING_DEPLOYMENT.md  - Detailed testing guide
echo   - WEBSOCKET_API.md       - API specification
echo   - ANDROID_INTEGRATION.md - Android setup guide
echo.
echo ^✓ All checks passed! Ready to start testing.
echo.
pause
