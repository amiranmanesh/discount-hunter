@echo off
setlocal
rem Build helper for the Android shell. Point JAVA_HOME at a JDK 21 and either
rem set ANDROID_HOME or keep sdk.dir correct in android\local.properties.
if "%JAVA_HOME%"=="" set JAVA_HOME=C:\Users\SN97\.local\jdk21
if "%ANDROID_HOME%"=="" set ANDROID_HOME=C:\Users\SN97\.local\android
set ANDROID_SDK_ROOT=%ANDROID_HOME%
set PATH=%JAVA_HOME%\bin;C:\Windows\system32;C:\Windows;%ANDROID_HOME%\platform-tools;%PATH%
cd /d "%~dp0."
call gradlew.bat %*
echo BUILD_RC=%errorlevel%