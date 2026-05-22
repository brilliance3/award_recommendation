# 공적조서 자동 생성 시스템 (MVP)

표창 추천 업무를 위한 **공적 데이터 관리 + 행정문서 자동 생성** 웹 시스템입니다.
대상자 정보를 입력하면 다음 3개 파일이 자동으로 생성됩니다.

| 구분 | 파일                                                 | 역할             |
| ---- | ---------------------------------------------------- | ---------------- |
| 01   | `공적개요서(추천자).xlsx`                            | 공적 요약 DB     |
| 02   | `공적조서(대상자).pdf`                               | 최종 제출 문서   |
| 03   | `표창대상자(추천자 추천_대상자 등 N인).xlsx`         | 추천 대상자 명단 |

---

## 구성

```
award_recommendation/
├── backend/                 FastAPI + SQLAlchemy + WeasyPrint/Playwright + openpyxl
│   ├── app/
│   │   ├── api/             REST 라우터
│   │   ├── models/          SQLAlchemy 모델 (6개 테이블)
│   │   ├── schemas/         Pydantic 스키마
│   │   ├── services/        PDF/XLSX/URL추출/AI 생성
│   │   ├── templates/       merit_report.html (4페이지 양식)
│   │   ├── config.py
│   │   ├── database.py
│   │   └── main.py
│   ├── storage/             SQLite DB + 생성 파일
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
└── frontend/                React 18 + Vite + TypeScript + Tailwind + React Router
    ├── src/
    │   ├── api/             axios 기반 API 클라이언트
    │   ├── components/      Layout / Field / Button
    │   ├── pages/           7개 페이지 (Dashboard / Create / List / Edit / Merit / Preview / Download)
    │   ├── types/           DTO 타입
    │   ├── App.tsx
    │   └── main.tsx
    └── package.json
```

---

## 빠른 시작 (로컬 개발)

### 사전 준비

- Python 3.10 이상
- Node.js 18 이상

### 1) 백엔드

```bash
cd backend
python -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate

pip install -r requirements.txt
# (선택) Playwright 사용 시
# pip install playwright && playwright install chromium

cp .env.example .env                # 필요시 수정
uvicorn app.main:app --reload --port 8000
```

브라우저에서 [http://localhost:8000/docs](http://localhost:8000/docs) 로 OpenAPI Swagger UI 확인 가능합니다.

> WeasyPrint는 시스템 라이브러리(pango, cairo 등)가 필요합니다.
> macOS는 `brew install pango cairo gdk-pixbuf libffi`,
> Ubuntu는 `apt install libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 fonts-noto-cjk` 권장.
> 환경 구성이 어려우면 `.env` 에 `PDF_ENGINE=playwright` 로 변경 가능합니다.

### 2) 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

[http://localhost:5173](http://localhost:5173) 접속.  
Vite 개발 서버가 `/api/*` 요청을 `http://localhost:8000` 으로 프록시합니다.

---

## 주요 사용 흐름

1. **새 표창 건 생성** - 표창 건명·훈격·추천자·표창일 입력
2. **대상자 등록** - 수동 입력 또는 (선택) URL 추출 / XLSX 업로드
3. **공적내용 입력** - 공적요지·공적사항·추천사유  
   *AI 보조 버튼* 으로 초안 자동 생성 (`ANTHROPIC_API_KEY` 또는 `OPENAI_API_KEY` 가 있으면 LLM, 없으면 규칙 기반 템플릿)
4. **미리보기** - 공적조서 HTML 인라인 프레임으로 확인
5. **문서 생성**
   - `01 공적개요서.xlsx` + `03 표창대상자.xlsx` 일괄 생성
   - 대상자별 `02 공적조서.pdf` 생성
   - 전체 ZIP 패키지 다운로드

---

## 환경변수

| 변수                | 기본값                          | 설명                            |
| ------------------- | ------------------------------- | ------------------------------- |
| `DATABASE_URL`      | `sqlite:///./storage/app.db`    | DB 연결 문자열 (PostgreSQL 가능) |
| `PDF_ENGINE`        | `weasyprint`                    | `weasyprint` 또는 `playwright`  |
| `ALLOWED_ORIGINS`   | `http://localhost:5173,...`     | CORS 허용 origin                |
| `ANTHROPIC_API_KEY` | (비어 있음)                     | 있으면 Claude API 호출          |
| `OPENAI_API_KEY`    | (비어 있음)                     | 있으면 OpenAI API 호출          |

---

## 검증 규칙

- **필수값** (PDF 생성 전 검증 권장): 성명, 생년월일, 소속, 직위, 주소, 공적분야, 공적기간, 추천훈격, 표창일, 추천자, 공적요지, 공적사항
- **권장**: 공적요지 50자 내외, 공적사항 500자 이상, 공적기간 2년 이상
- **AI 생성**: 모든 결과는 사람이 반드시 검토. 허위사실 추가 금지가 프롬프트에 명시되어 있으나 LLM 한계상 검수 필수.

---

## 배포

### Docker (백엔드만)

```bash
cd backend
docker build -t award-backend .
docker run -p 8000:8000 -v $(pwd)/storage:/app/storage award-backend
```

### 프론트엔드 정적 빌드

```bash
cd frontend
npm run build   # dist/ 가 결과물
```

내부망 배포 시 Nginx 등으로 `dist/` 를 서빙하고 `/api` 를 FastAPI 컨테이너로 프록시하세요.

---

## 라이선스 / 기여

- 본 시스템은 행정 업무 자동화 MVP로 제공됩니다.
- 공적사항·추천사유는 항상 사람의 책임 하에 최종 검수 후 사용하세요.
