# 표창 추천 시스템 — 디자인 지침

경기도의회 의장 표창 추천 시스템(award_recommendation) 프론트엔드 디자인 시스템.
경기도의회 CI(Corporate Identity)를 기반으로 KRDS(전자정부 디자인 시스템) UI/UX 원칙을 적용한다.

참고 자료
- 경기도의회 CI: https://sowon-gallery-three.vercel.app/ci
- KRDS UI/UX: https://www.krds.go.kr · https://github.com/KRDS-uiux/krds-uiux
- 디자인 토큰 사양: tailwind.config.js, src/index.css

---

## 1. 기본 원칙

1. **공식 공공 서비스 톤** — 경기도의회 의장 표창이라는 공식 행정 업무를 다루므로 차분하고 권위 있는 인상을 우선한다. 불필요한 그라데이션·장식·이모지 사용 금지.
2. **접근성 우선** — KRDS 원칙에 따라 색상만으로 의미를 전달하지 않고, 텍스트·아이콘·라벨을 병행한다. 본문 대비 4.5:1 이상, 비텍스트(아이콘·버튼) 3:1 이상.
3. **일관성** — 모든 페이지는 KRDS 컴포넌트 클래스(`krds-card`, `krds-table`, `krds-badge` 등)를 사용하고, 개별 페이지에서 색상·간격을 임의로 재정의하지 않는다.
4. **한국어 가독성** — 어절 단위 줄바꿈을 위해 `word-break: keep-all` 기본 적용. Pretendard Variable 폰트 우선.

---

## 2. 색상 시스템

### 2.1 주색 (Primary)

| 토큰 | HEX | PANTONE | 용도 |
|------|-----|---------|------|
| `brand-600` | `#3C5D93` | 653C | GAC DARK BLUE — 헤더·CTA·강조 영역 핵심 |
| `brand-700` | `#324D7A` | — | 호버·진한 강조 |
| `brand-50` | `#EEF2F8` | — | 배경 톤·강조 영역 옅은 채움 |
| `brand-100`~`brand-200` | — | — | 경계선·연한 강조 |

### 2.2 보조색 (Secondary)

| 토큰 | HEX | PANTONE | 용도 |
|------|-----|---------|------|
| `sky-500` | `#2882B5` | 7690C | 보조 강조·정보 컬러 |
| `silver-600` | `#7D7D7D` | — | WARM GRAY · 보조 텍스트 |
| `silver-500` | `#999999` | 421C | 비활성·구분선 강조 |

### 2.3 시상색 (Promotional)

| 토큰 | HEX | PANTONE | 용도 |
|------|-----|---------|------|
| `gold-600` | `#AD8B3A` | 872C | 표창 강조·완료 상태·수상 결과 라벨 |
| `gold-50` | `#FAF6EC` | — | 표창 카드 배경 톤 |

### 2.4 중립 (Neutral, ink 스케일)

KRDS 회색 스케일을 그대로 사용. 본문 텍스트는 `ink-900`, 보조 텍스트는 `ink-500`, 경계선은 `ink-200`.

### 2.5 의미 색 (Semantic)

| 토큰 | 용도 |
|------|------|
| `danger-600` | 오류·삭제·부적격 |
| `warn-500` | 경고·주의 |
| `success-500` | 완료·승인 |
| `accent-600` (#007A47) | 기존 컴포넌트 호환용 보조 강조 (신규 적용 자제) |

### 2.6 정당 배지 (의원 식별용)

- `krds-badge-democratic` — 민주(파랑)
- `krds-badge-people` — 국힘(빨강)

업무 맥락이므로 정당색은 식별 목적으로만 사용하고, 메인 UI 컬러로 끌어올리지 않는다.

### 2.7 사용 금지

- 로고 색상 변형(`#3C5D93` 외 변형) 금지 — 경기도의회 CI 규정 준수
- 채도·명도가 다른 임의의 파랑 추가 금지
- 강제 흰배경 위 단독 `gold-600` 텍스트는 대비 부족하므로 표창 카드 배경(`gold-50`)과 조합

---

## 3. 타이포그래피

- 본문 폰트: **Pretendard Variable** → Pretendard → 시스템 한글 폰트 폴백
- 자간: `letter-spacing: -0.005em` (body 전역)
- 숫자 표·간격 균일: `font-feature-settings: 'tnum' on, 'ss01' on`

| 용도 | 클래스 | 비고 |
|------|--------|------|
| 페이지 제목 | `krds-page-title` (`text-xl sm:text-2xl font-bold`) | |
| 페이지 보조 | `krds-page-sub` (`text-sm text-ink-500`) | |
| 섹션 제목 | `krds-section-title` (`text-base sm:text-lg font-bold`) | 좌측에 brand 컬러 막대 표시 |
| 본문 | `text-sm` ~ `text-base` | |
| 라벨/메타 | `text-xs text-ink-500` | |

iOS 자동 줌 방지를 위해 입력 폼은 모바일에서 `font-size: 16px` 유지(데스크탑은 `0.95rem`).

---

## 4. 레이아웃 / 간격

- 컨테이너: `max-w-page` (1200px), 좌우 padding은 viewport에 따라 1rem→2rem
- 카드 padding: `krds-card-pad` (모바일 `p-4`, sm 이상 `p-6`)
- 카드 간 간격: 세로 `gap-4` ~ `gap-6`
- 그리드는 12컬럼 가정, 모바일 1열 → md 2열 → lg 3열 패턴 권장
- 모서리 반경: 카드 `rounded-xl2` (0.875rem), 배지 `rounded-md`, 버튼 `rounded-lg`

---

## 5. 컴포넌트 사용

KRDS 패턴 클래스를 우선 사용한다. 새 화면을 만들 때 같은 시각적 요소를 인라인 클래스로 다시 만들지 말 것.

| 요소 | 표준 클래스 |
|------|-------------|
| 표준 컨테이너 카드 | `.krds-card` + `.krds-card-pad` |
| 페이지 헤더 영역 | `.krds-page-header` (제목 + 우측 액션) |
| 섹션 제목 | `.krds-section-title` |
| 데이터 표 | `.krds-table` (thead 회색 배경, hover brand 톤) |
| 배지 — 일반 | `.krds-badge` + `.krds-badge-brand` / `.krds-badge-accent` / `.krds-badge-ink` |
| 텍스트 링크 | `.krds-link` |

### 5.1 그림자

- 카드 기본: `shadow-card` (2단 그림자, 옅음)
- 팝오버·모달: `shadow-pop`

### 5.2 상태 표시

전체 표창 현황(`/all-cases`)의 상태값은 다음 색 매핑을 유지한다.

| 상태 | 색 토큰 | 의도 |
|------|---------|------|
| 대기 | ink (회색) | 아직 처리 시작 전 |
| 예정 | brand (파랑) | 일정 잡힘 |
| 진행 | sky (밝은 파랑) | 검토·문서 작업 중 |
| 보관 | warn (주황) | 보류·연기 |
| 완료 | gold (금색) | 표창 발급 완료 |
| 취소 | danger (빨강) | 취소 |

`gold-600`은 "완료" 라벨에 한정해 사용한다(시상 완료 의미).

---

## 6. 폼 / 입력

- 라벨은 입력 위에 배치, 필수 표시는 `*` (color: danger-500)
- placeholder는 회색 음영 예시문(`예시) ...` 접두어 일관)
- 오류 메시지는 입력 바로 아래 한 줄, `text-xs text-danger-600`
- 모달 안 입력은 섹션 구분선(`border-t border-ink-100`)으로 영역 분리

---

## 7. 접근성 / KRDS 준수 사항

1. 모든 폼 요소에 명시적 label 또는 aria-label
2. 인터랙티브 요소는 키보드(`Tab`, `Enter`, `Space`)로 도달·작동 가능
3. 포커스 상태는 `:focus-visible`로 표현, 시각적 링 또는 배경 변화 필요(현재 outline은 제거되어 있으므로 페이지별 보강 시 brand 톤 ring 사용)
4. 색상 대비 도구로 신규 색 조합 검증(WCAG AA 4.5:1)
5. 표(table)는 thead + th scope="col" 명시, 모바일에서는 카드 형태 fallback 권장

---

## 8. 로고·심볼 사용 (경기도의회 CI 규정)

- 비율 변경·색상 변경·형태 변형 금지
- 밝은 배경에서는 컬러/블랙 마크, 어두운 배경에서는 화이트 마크
- 슬로건 워드마크("사람중심 민생중심 의회다운 의회", 신영복체)는 별도 자산 사용. 본 시스템에는 텍스트로만 노출

---

## 9. 변경 이력

- 2026-05-27: 경기도의회 CI(GAC DARK BLUE #3C5D93) 기반 토큰으로 brand 색 교체, GOLD/SILVER/SKY 보조 토큰 신설. 기존 accent(녹색) 토큰은 호환 보존.
