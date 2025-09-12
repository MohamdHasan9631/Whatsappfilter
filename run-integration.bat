@echo off
echo WhatsApp VB.NET Integration Setup
echo ================================

echo.
echo Step 1: Installing Node.js dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Failed to install Node.js dependencies
    pause
    exit /b 1
)

echo.
echo Step 2: Starting WhatsApp backend server...
echo The server will start in a new window.
echo Please keep it running while using the VB.NET application.
start "WhatsApp Backend" cmd /k "npm start"

echo.
echo Step 3: Building VB.NET application...
dotnet build WhatsAppIntegration.vbproj
if %errorlevel% neq 0 (
    echo Failed to build VB.NET application
    echo Make sure you have .NET 6.0 SDK installed
    pause
    exit /b 1
)

echo.
echo Step 4: Starting VB.NET application...
dotnet run --project WhatsAppIntegration.vbproj

echo.
echo Setup completed!
pause