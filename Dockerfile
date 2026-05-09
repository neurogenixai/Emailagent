# ── Stage 1: Build React frontend ──────────────────────────────────────────
FROM node:20-slim AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Run Python backend + serve built frontend ─────────────────────
FROM python:3.11-slim

# Set working directory TO the backend folder directly
WORKDIR /app/backend

# Copy backend files into the working directory
COPY backend/ ./

# Copy the built React app from Stage 1 into /app/frontend/dist
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose port
EXPOSE 8000

# Start uvicorn — no cd needed, we're already in /app/backend
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
