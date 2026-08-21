@echo off
REM Mantido por compatibilidade. Preferira usar start.bat (ele ja instala, builda e sobe).
cd /d "%~dp0"
call "%~dp0start.bat" /rebuild
