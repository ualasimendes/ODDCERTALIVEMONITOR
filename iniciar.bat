@echo off
title OddCerta Live Monitor
color 0b
echo =========================================================
echo               OddCerta Live Monitor
echo =========================================================
echo.
echo [1/2] Iniciando servidor do monitor...
echo [2/2] Abrindo no navegador: http://localhost:3000
echo.
echo (Para fechar o monitor, basta fechar esta janela)
echo.

start http://localhost:3000

node dist/server.cjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Servidor de producao nao encontrado. Iniciando modo de desenvolvimento...
    npm run dev
)
pause
