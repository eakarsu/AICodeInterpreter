#!/bin/bash
set -e
cd "$(dirname "$0")"

# Load env
set -a; source .env; set +a

# Kill port function
kill_port() {
  local port=$1
  local pid=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "Killing process on port $port (PID: $pid)"
    kill -9 $pid 2>/dev/null || true
    sleep 1
  fi
}

echo "=== AI Code Interpreter ==="

# Kill used ports
kill_port 3000
kill_port 3001

# Install backend deps
echo "Installing backend dependencies..."
cd backend
npm install
cd ..

# Install frontend deps
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Setup database
echo "Setting up database..."
psql -U $DB_USER -h $DB_HOST -p $DB_PORT -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c "CREATE DATABASE $DB_NAME"

# Seed database
echo "Seeding database..."
cd backend
node seeds/seed.js
cd ..

# Start backend with nodemon (auto-reload)
echo "Starting backend on port $BACKEND_PORT..."
cd backend
npx nodemon server.js &
BACKEND_PID=$!
cd ..

# Wait for backend
sleep 2

# Start frontend (auto-reload)
echo "Starting frontend on port $FRONTEND_PORT..."
cd frontend
PORT=$FRONTEND_PORT BROWSER=none npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo "=== AI Code Interpreter Running ==="
echo "Frontend: http://localhost:$FRONTEND_PORT"
echo "Backend:  http://localhost:$BACKEND_PORT"
echo "Login:    $DEFAULT_EMAIL / $DEFAULT_PASSWORD"
echo ""
echo "Press Ctrl+C to stop all services"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
