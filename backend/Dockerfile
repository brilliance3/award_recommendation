# Playwright 공식 이미지 (Chromium 사전 설치) → PDF 엔진은 playwright 사용
FROM mcr.microsoft.com/playwright/python:v1.47.0-jammy

# 한글 폰트 (Noto Sans CJK / 나눔) + LibreOffice (01 공적개요서·03 표창대상자 → PDF) +
# JRE (H2Orestart 설치/구동에 unopkg가 Java를 요구함)
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-cjk fonts-nanum \
    libreoffice-writer libreoffice-calc curl \
    default-jre-headless libreoffice-java-common \
    && rm -rf /var/lib/apt/lists/*

# H2Orestart — LibreOffice용 HWP/HWPX import 필터.
# 이게 있어야 soffice 가 .hwpx 를 열어 PDF 로 변환한다(공적조서 미리보기/제출).
RUN curl -fsSL -o /tmp/H2Orestart.oxt \
      https://github.com/ebandal/H2Orestart/releases/download/v0.7.12/H2Orestart.oxt \
    && unopkg add --shared /tmp/H2Orestart.oxt \
    && rm -f /tmp/H2Orestart.oxt

WORKDIR /app
COPY requirements.txt .
# pip install 한 뒤 해당 playwright 버전에 맞는 chromium 을 다시 받아 버전 미스매치 방지
RUN pip install --no-cache-dir -r requirements.txt && \
    playwright install chromium

# 02 공적조서 미리보기는 rhwp(@rhwp/core WASM)를 Node로 렌더해 한컴 한글과 동일한
# 페이지 분할을 재현한다. 베이스 이미지에 Node가 없으므로 NodeSource로 설치.
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*
COPY render ./render
RUN cd render && npm install --omit=dev --no-audit --no-fund
# 미리보기 글꼴 일치: 경기천년체를 시스템 폰트로 설치(chromium이 SVG의 경기천년바탕을
# fallback 명조가 아니라 실제 글꼴로 렌더하도록). 로컬(맥)은 설치된 시스템 폰트를 쓴다.
RUN mkdir -p /usr/share/fonts/gyeonggi \
    && cp render/fonts/*.otf /usr/share/fonts/gyeonggi/ \
    && fc-cache -f

COPY app ./app
# 빌드된 프론트(frontend/dist → backend/frontend_dist)를 함께 담아 백엔드가 SPA를 서빙.
# 회사 인트라넷이 vercel.app은 막고 fly.dev는 통과시키므로 단일 도메인(fly.dev)으로 제공.
# (deploy.sh 가 배포 전 프론트를 상대경로로 빌드해 frontend_dist 에 복사한다.)
COPY frontend_dist ./frontend_dist
RUN mkdir -p /app/storage/generated /app/storage/uploads

ENV PDF_ENGINE=playwright \
    PYTHONUNBUFFERED=1 \
    STORAGE_DIR=/app/storage

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
