# ============================================================
#  Voice Shopping Assistant — Backend Startup Script
#  Runs the FastAPI server on http://127.0.0.1:8000
# ============================================================

Write-Host ""
Write-Host "  Voice Shopping Assistant — Backend" -ForegroundColor Cyan
Write-Host "  FastAPI + Gemini NLU + Firebase Firestore" -ForegroundColor DarkCyan
Write-Host "  http://127.0.0.1:8000" -ForegroundColor Green
Write-Host ""

Set-Location "$PSScriptRoot\backend"
.\venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
