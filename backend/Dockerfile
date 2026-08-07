# Pinned to 3.12 (duckdb has no 3.14 wheel yet). Runs the FastAPI backend.
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY tests ./tests
COPY pytest.ini .

# Data is mounted read-only at /data (see docker-compose.yml).
ENV MIMIC_DATA_DIR=/data \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
