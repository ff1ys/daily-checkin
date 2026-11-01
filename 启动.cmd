@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto nonode

start "" http://localhost:4173/
node serve.mjs
goto :eof

:nonode
echo 没有检测到 Node.js，直接用浏览器打开本地文件。
echo 数据会保存在这台电脑的浏览器里。
start "" "index.html"
