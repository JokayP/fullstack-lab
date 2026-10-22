@echo off
setlocal
pushd "%~dp0"
set "APP_JAVA="
if exist "java\bin\java.exe" set "APP_JAVA=%CD%\java\bin\java.exe"
if not defined APP_JAVA if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" set "APP_JAVA=%JAVA_HOME%\bin\java.exe"
if not defined APP_JAVA set "APP_JAVA=java"
set "APP_JAR=target\products-crud-1.0.0.jar"
if not exist "%APP_JAR%" set "APP_JAR=dist\products-crud-1.0.0.jar"
if not exist "%APP_JAR%" (
  echo Build the backend first with Java 21:
  echo   .\mvnw.cmd --batch-mode --no-transfer-progress clean verify
  popd
  pause
  exit /b 1
)
echo Starting Products API with the H2 profile. Java 21 is required.
echo Open http://localhost:8080/api/products after startup completes.
"%APP_JAVA%" -jar "%APP_JAR%" --spring.profiles.active=h2
set "APP_EXIT_CODE=%ERRORLEVEL%"
popd
pause
exit /b %APP_EXIT_CODE%
