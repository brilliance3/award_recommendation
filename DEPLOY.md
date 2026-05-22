# 배포 가이드 — Vercel + Fly.io + Supabase (무료 데모용)

> ⚠️ **중요**: 이 무료 클라우드 배포는 **시연·테스트 용도**입니다.
> 실제 표창 대상자의 개인정보(성명·생년월일·주소)는 절대 올리지 마세요.
> 실 업무용은 의회 내부망 배포를 권장합니다.

본 가이드는 다음 분리 배포 구성을 설정합니다.

| 구성 요소 | 서비스 | 비용 |
| -------- | ------ | ---- |
| 프론트엔드(React) | **Vercel** | 무료 |
| 백엔드(FastAPI) | **Fly.io** | 무료 한도 내 |
| 데이터베이스(Postgres) | **Supabase** | 무료 500MB |
| 파일 저장(생성 PDF/XLSX) | Fly.io 볼륨 1GB | 무료 |

---

## 0. 사전 준비

- GitHub 저장소에 코드 푸시 완료
- Vercel 가입: https://vercel.com (GitHub로 로그인)
- Fly.io 가입: https://fly.io (신용카드 검증만 필요, 무료 사용시 청구 없음)
- Supabase 가입: https://supabase.com (GitHub 로그인)
- Mac 로컬에 `flyctl` 설치
  ```bash
  brew install flyctl
  flyctl auth login
  ```

---

## 1. Supabase — Postgres DB 생성

1. Supabase 대시보드 → **New project** 클릭
2. Project name `award-recommendation`, Region `Northeast Asia (Seoul)` 또는 `Tokyo` 선택
3. DB 비밀번호 강한 것으로 설정 → **저장 필수**
4. 프로젝트 생성 완료 후 좌측 **Project Settings → Database → Connection string → URI** 복사
   - 형식: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`
   - `[YOUR-PASSWORD]` 부분을 실제 비밀번호로 교체해 두세요

---

## 2. Fly.io — 백엔드 배포

### 2.1 앱 생성 (한 번만)

```bash
cd ~/Downloads/project/award_recommendation/backend

# fly.toml 의 app 이름을 본인 고유한 이름으로 수정 (예: award-recommendation-홍길동)
# 그 다음:
flyctl launch --no-deploy --copy-config --name <앱이름> --region nrt
```

- DB 추가 여부 물으면 **No** (Supabase 사용)
- 즉시 배포 여부 물으면 **No** (시크릿 먼저 등록)

### 2.2 영구 볼륨 생성 (생성 PDF/XLSX 저장용)

```bash
flyctl volumes create award_data --size 1 --region nrt
```

### 2.3 시크릿(환경변수) 등록

```bash
# Supabase에서 복사한 DATABASE_URL
flyctl secrets set DATABASE_URL="postgresql://postgres:비밀번호@db.xxxxx.supabase.co:5432/postgres"

# CORS - Vercel 도메인 (3단계에서 받음. 일단 *로 두고 나중에 좁힐 수도 있음)
flyctl secrets set ALLOWED_ORIGINS="https://<your-vercel-app>.vercel.app"

# AI 보조 (선택)
# flyctl secrets set ANTHROPIC_API_KEY="sk-ant-..."
# flyctl secrets set OPENAI_API_KEY="sk-..."
```

### 2.4 배포

```bash
flyctl deploy
```

배포가 끝나면 백엔드 URL 확인:

```bash
flyctl status        # Hostname 줄에 https://<app>.fly.dev
curl https://<app>.fly.dev/api/health
# → {"status":"ok"}
```

---

## 3. Vercel — 프론트엔드 배포

### 3.1 GitHub에서 Import

1. Vercel 대시보드 → **Add New → Project**
2. GitHub 저장소 `award_recommendation` 선택
3. **Root Directory** 를 `frontend` 로 변경 (꼭!)
4. Framework: `Vite` 자동 감지 확인

### 3.2 환경변수 등록

Vercel 프로젝트 설정 → **Settings → Environment Variables**:

| Key | Value |
|-----|-------|
| `VITE_API_BASE_URL` | `https://<your-fly-app>.fly.dev` |

(Production / Preview / Development 모두 체크)

### 3.3 배포

**Deploy** 버튼 클릭. 1분 정도 후 `https://<project>.vercel.app` 발급.

### 3.4 CORS 마무리

Vercel URL이 확정되면 Fly.io 백엔드 CORS를 정확한 값으로 갱신:

```bash
cd backend
flyctl secrets set ALLOWED_ORIGINS="https://<project>.vercel.app"
# 시크릿 변경 시 자동 재배포됨
```

---

## 4. 동작 확인

브라우저로 `https://<project>.vercel.app` 접속 후:

1. **표창 건 생성** → 입력 후 "표창 건 생성" 클릭 → 정상 이동되면 OK
2. **대상자 추가** → 기본정보 입력 → 저장
3. **공적내용 입력** → 공적요지·공적사항 작성 → "저장 + PDF 생성"
4. PDF가 새 탭으로 열리면 전체 흐름 완성

문제 발생 시 로그 확인:

```bash
flyctl logs           # 백엔드 실시간 로그
```

브라우저 개발자도구 → Console / Network 탭도 함께 확인하세요.

---

## 5. 비용 관리 팁

- Fly.io `fly.toml` 에 `auto_stop_machines = "stop"`, `min_machines_running = 0` 설정되어 있어 트래픽 없을 때 머신이 자동 정지 → 무료 한도 내 유지
- Cold start 시 첫 요청이 5~15초 걸릴 수 있음 (정상)
- Vercel은 트래픽 기준 무료. 개인 시연 수준은 사실상 무제한
- Supabase 500MB 한도 — 표창 건 수천 건은 무난. PDF는 Fly.io 볼륨에 저장되어 DB 차지 안 함
- Fly.io 1GB 볼륨: PDF 1개 ~50KB 가정 시 약 2만 건 저장 가능

---

## 6. 자주 만나는 문제

### 6.1 PDF 생성 시 메모리 부족 (Fly.io 256MB)

`fly.toml` 의 메모리를 512MB로 올리세요 (현재 설정 그대로면 OK). Playwright Chromium 동작에 최소 400MB 권장.

### 6.2 CORS 에러

브라우저 콘솔에 `Access-Control-Allow-Origin` 관련 오류가 보이면:

```bash
flyctl secrets set ALLOWED_ORIGINS="https://정확한-vercel-url.vercel.app"
```

### 6.3 DB 연결 실패

- Supabase 프로젝트 Settings → Database 에서 `Connection pooling` 사용 시 포트 6543 형식의 URI가 따로 있음. 일반 직결 5432 URI를 쓰세요.
- 비밀번호에 특수문자가 있으면 URL 인코딩 필요 (`@` → `%40` 등)

### 6.4 Fly.io 한국 리전에서 더 빠르게 하고 싶다면

도쿄(nrt)는 한국에서 ~30ms로 거의 한국 리전과 차이 없음. 추가 작업 불필요.

---

## 7. 배포 후 GitHub 자동 배포 흐름

- `main` 브랜치 푸시 → Vercel 자동 재배포 (프론트엔드)
- 백엔드는 수동 — 코드 수정 후 `flyctl deploy` 실행
  - GitHub Actions로 자동화 가능. 필요 시 별도 워크플로 작성

---

## 8. 운영 종료 / 비용 0 만들기

데모가 끝나고 정리할 때:

```bash
# Fly.io 앱 삭제 (볼륨 포함 모두 삭제)
flyctl apps destroy <앱이름>

# Vercel 프로젝트 삭제: 대시보드에서 직접
# Supabase 프로젝트 삭제: 대시보드 → Settings → General → Delete project
```

이상으로 무료 데모 배포가 완료됩니다. 실제 업무 도입은 의회 정보화 부서와 협의해 내부망 배포로 전환하세요.
