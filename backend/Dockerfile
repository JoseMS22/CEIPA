FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# (Opcional pero útil si alguna librería lo requiere)
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
# Para desarrollo estable; en prod puedes ajustar workers con --workers 2-4
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]