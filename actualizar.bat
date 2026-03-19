@echo off
title Actualizador de Melodi Music
echo ===========================================
echo   SUBIDA AUTOMATICA A GITHUB - MELODI
echo ===========================================
echo.

:: 1. Pedir el mensaje de la actualizacion
set /p msg="¿Que has cambiado hoy? (En esta subida instalacion web y movil, y funcionamiento local sin internet): "

:: 2. Preparar los archivos
echo.
echo [+] Preparando archivos...
git add .

:: 3. Crear el punto de control (Commit)
echo [+] Guardando cambios localmente...
git commit -m "%msg%"

:: 4. Empujar a la nube
echo [+] Subiendo a GitHub...
git push

echo.
echo ===========================================
echo   ¡LISTO! Tu app ya esta en la nube.
echo ===========================================
pause
