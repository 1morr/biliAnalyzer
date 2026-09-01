# Stage 1: Build frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json frontend/.npmrc* ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Backend + static files
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-wqy-microhei \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies from pyproject.toml (single source of truth) before
# copying the rest of the source, so this layer stays cached across code-only
# changes. tomllib is stdlib on Python 3.11+, so no extra tool is needed.
COPY backend/pyproject.toml .
RUN python -c "import tomllib; deps = tomllib.load(open('pyproject.toml', 'rb'))['project']['dependencies']; print('\n'.join(deps))" > /tmp/requirements.txt \
    && pip install --no-cache-dir -r /tmp/requirements.txt

COPY backend/ .
COPY --from=frontend-builder /app/dist ./frontend/dist/

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
