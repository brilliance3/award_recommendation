# Playwright 공식 이미지 (Chromium 사전 설치) → PDF 엔진은 playwright 사용
FROM mcr.microsoft.com/playwright/python:v1.47.0-jammy

# 한글 폰트 (Noto Sans CJK / 나눔)
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-cjk fonts-nanum \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
RUN mkdir -p /app/storage/generated /app/storage/uploads

ENV PDF_ENGINE=playwright \
    PYTHONUNBUFFERED=1 \
    STORAGE_DIR=/app/storage

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
