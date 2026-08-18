@echo off
REM AI Group Chat - Android APK Build Script
REM Requires: Java 21+, Android SDK, Node.js 18+

set PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

echo ========================================
echo  AI Group Chat - Android APK Builder
echo ========================================
echo.

REM Check Java
echo [1/5] Checking Java...
java -version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Java not found. Please install Java 21+
    pause
    exit /b 1
)
echo Java OK.

REM Check Node
echo [2/5] Checking Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Please install Node.js 18+
    pause
    exit /b 1
)
echo Node.js OK.

REM Install dependencies
echo [3/5] Installing dependencies...
call npm install
call npm install @capacitor/core@6 @capacitor/cli@6 @capacitor/android@6 --save

REM Sync web assets
echo [4/5] Syncing web assets to Android...
call npx cap sync android

REM Build APK
echo [5/5] Building APK...
cd android
call gradlew.bat assembleDebug

if exist "app\build\outputs\apk\debug\app-debug.apk" (
    echo.
    echo ========================================
    echo  BUILD SUCCESSFUL!
    echo ========================================
    echo  APK location: android\app\build\outputs\apk\debug\app-debug.apk
    echo.
    echo  Copy this APK to your Android phone and install it.
    echo ========================================
) else (
    echo.
    echo BUILD FAILED. Check the errors above.
)

pause
