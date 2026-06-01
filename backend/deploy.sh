#!/usr/bin/env bash
# 백엔드(+프론트 통합) Fly.io 배포 스크립트.
#
# 회사 인트라넷이 vercel.app은 차단하고 fly.dev는 허용하므로, 백엔드 한 곳(fly.dev)에서
# 프론트(SPA)까지 서빙한다. 이 스크립트는 프론트를 '상대경로 API'로 빌드해 backend/
# frontend_dist 에 복사한 뒤 flyctl 로 배포한다.
#
# 사용법: backend/ 에서  ./deploy.sh
set -euo pipefail

APP="award-recommend-ggcit-91f8"
BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$(cd "$BACKEND_DIR/../frontend" && pwd)"

echo "▶ 프론트 빌드 (상대경로 API — 같은 도메인에서 /api 호출)"
cd "$FRONTEND_DIR"
# VITE_API_BASE_URL="" → client.ts 가 baseURL 빈 문자열(상대경로) 사용
VITE_API_BASE_URL="" npx vite build

echo "▶ 빌드 산출물을 backend/frontend_dist 로 복사"
rm -rf "$BACKEND_DIR/frontend_dist"
cp -r "$FRONTEND_DIR/dist" "$BACKEND_DIR/frontend_dist"

echo "▶ Fly.io 배포 ($APP)"
cd "$BACKEND_DIR"
flyctl deploy --ha=false -a "$APP"

echo "✓ 배포 완료 → https://$APP.fly.dev/"
