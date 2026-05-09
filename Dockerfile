# ── Stage 1: Build React frontend ──────────────────────────────────────────
FROM node:20-slim AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Run Python backend + serve built frontend ─────────────────────
FROM python:3.11-slim

WORKDIR /app

# Copy backend
COPY backend/ ./backend/

# Copy the built React app from Stage 1
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Install Python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Expose Railway's dynamic port
ENV PORT=8000
EXPOSE $PORT

# Start the backend (it serves the frontend too)
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
