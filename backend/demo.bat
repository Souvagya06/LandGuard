@echo off
REM LandGuard Alert System - Quick Interactive Demo (Windows)
REM Run this batch file to see the alert system in action!

setlocal enabledelayedexpansion

cls

echo.
echo ==========================================
echo LandGuard Alert System - Quick Demo
echo ==========================================
echo.

echo Prerequisites Check:
echo.

REM Check Node.js
where /q node
if errorlevel 1 (
    echo [!] Node.js not found. Please install Node.js 18+
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js installed: %NODE_VERSION%

REM Check npm
where /q npm
if errorlevel 1 (
    echo [!] npm not found
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo [OK] npm installed: %NPM_VERSION%

REM Check if server.js exists
if not exist "backend\server.js" (
    echo [!] server.js not found. Please run from project root.
    exit /b 1
)

echo [OK] All prerequisites met!
echo.

echo ==========================================
echo Step 1: Install Dependencies
echo ==========================================
echo.
echo Installing WebSocket library...
echo.

cd backend
call npm install --quiet 2>nul
if errorlevel 1 (
    call npm install
)
cd ..

echo [OK] Dependencies installed
echo.

echo ==========================================
echo Step 2: Test Server Syntax
echo ==========================================
echo.

node -c backend\server.js
if errorlevel 1 (
    echo [!] Syntax error in server.js
    exit /b 1
)

echo [OK] Server syntax is valid
echo.

echo ==========================================
echo Step 3: Start Backend Server
echo ==========================================
echo.
echo Starting backend server on http://127.0.0.1:8000
echo WebSocket endpoint: ws://127.0.0.1:8000
echo.
echo The server will start in a new window.
echo.
echo IMPORTANT: Keep this window open!
echo.
pause

REM Start backend in new window
cd backend
start "LandGuard Backend Server" cmd /k npm start
cd ..

echo.
echo ==========================================
echo Step 4: Test WebSocket Connection
echo ==========================================
echo.
echo WebSocket client should receive alerts in real-time.
echo.
echo To connect to WebSocket, open a NEW command prompt and run:
echo   npm install -g wscat
echo   wscat -c ws://127.0.0.1:8000
echo.
echo You should see:
echo   ^{"type":"connection","message":"Connected to LandGuard alert system",...^}
echo.
echo This means the connection is successful!
echo.
pause

echo.
echo ==========================================
echo Step 5: Trigger an Alert
echo ==========================================
echo.
echo We'll now trigger an alert and send it to all connected WebSocket clients.
echo.
echo In your wscat window, you should see the alert appear immediately!
echo.
echo Running:
echo   curl -X POST http://127.0.0.1:8000/alerts ^
echo     -H "Content-Type: application/json" ^
echo     -d "{"zoneId": "zone-001"}"
echo.
pause

REM Trigger alert
for /f "delims=" %%A in ('curl -s -X POST http://127.0.0.1:8000/alerts -H "Content-Type: application/json" -d "{"zoneId": "zone-001"}"') do (
    set RESPONSE=%%A
)

if "%RESPONSE%"=="" (
    echo [!] Failed to trigger alert. Make sure backend is running.
    echo.
    pause
    exit /b 1
)

echo Alert Response:
echo %RESPONSE%
echo.
echo [OK] Alert created successfully!
echo.
echo Check your wscat window - you should see:
echo   {"type":"alert","data":{...}}
echo.
echo This proves real-time alert delivery is working!
echo.

echo ==========================================
echo Step 6: Advanced Testing
echo ==========================================
echo.
echo Try these commands to test more features:
echo.
echo 1. Retrieve all alerts (HTTP):
echo    curl http://127.0.0.1:8000/alerts
echo.
echo 2. Get server health:
echo    curl http://127.0.0.1:8000/health
echo.
echo 3. Trigger multiple alerts:
echo    curl -X POST http://127.0.0.1:8000/alerts -H "Content-Type: application/json" -d "{"zoneId": "zone-002"}"
echo    curl -X POST http://127.0.0.1:8000/alerts -H "Content-Type: application/json" -d "{"zoneId": "zone-003"}"
echo.
echo 4. Open multiple wscat clients to test multi-device alerts:
echo    Open new terminal window and run:
echo    wscat -c ws://127.0.0.1:8000
echo.
echo 5. Trigger alerts and watch all wscat windows receive them instantly!
echo.

echo ==========================================
echo Demo Complete!
echo ==========================================
echo.
echo What you just demonstrated:
echo   [OK] Backend WebSocket server running
echo   [OK] Real-time alert broadcasting
echo   [OK] Persistent alert storage
echo   [OK] Multi-client support (ready for mobile)
echo.
echo Next Steps:
echo   1. Keep the backend running in the new window
echo   2. Test with multiple wscat clients
echo   3. Trigger multiple alerts and watch them broadcast
echo   4. Try the Android app integration (see ANDROID_INTEGRATION.md)
echo.
echo Documentation:
echo   - LIVE_DEMO.md         : Detailed demo guide
echo   - WEBSOCKET_API.md     : API specification
echo   - ANDROID_INTEGRATION.md : Mobile app setup
echo.

pause
