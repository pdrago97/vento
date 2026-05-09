#!/bin/bash

# Function to clean up background processes on exit
cleanup() {
    echo -e "\n[Sistema] Desligando serviços..."
    kill $BACKEND_PID
    kill $FRONTEND_PID
    echo "[Sistema] Parando FalkorDB..."
    docker-compose stop
    echo "[Sistema] Todos os serviços foram encerrados."
    exit
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

echo "=========================================="
echo "🚀 Iniciando Vento Knowledge OS (Dev Mode)"
echo "=========================================="

# 1. Start FalkorDB via Docker Compose
echo "[1/3] Iniciando FalkorDB..."
docker-compose up -d
echo "✅ FalkorDB rodando."

# 2. Start Backend
echo "[2/3] Iniciando Memory Service (Backend)..."
cd memory_service
source ../venv/bin/activate
uvicorn app:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Wait 2 seconds for backend to start
sleep 2

# 3. Start Frontend
echo "[3/3] Iniciando UI (Frontend)..."
cd ui
npm run dev &
FRONTEND_PID=$!
cd ..

echo "=========================================="
echo "✨ Tudo rodando!"
echo "📡 Backend: http://localhost:8000"
echo "🖥️  Frontend: http://localhost:5173 (ou a porta mostrada acima)"
echo "🛑 Pressione Ctrl+C para desligar todos os serviços."
echo "=========================================="

# Wait indefinitely until Ctrl+C is pressed
wait
