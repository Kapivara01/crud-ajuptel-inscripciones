@echo off
title AJUPTEL - Sistema de Inscripciones
cd /d "%~dp0"
start http://localhost:3000
node server.js