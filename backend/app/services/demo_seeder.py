"""데모/테스트용 표창 대상자 시드.

50명의 가상 대상자를 다양한 분야·소속·지역에 분포시켜 생성.
실제 운영 데이터는 아니지만 화면/문서 테스트에 충분히 사실적.
"""
from __future__ import annotations

import random
from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..models import AwardCase, CareerRecord, MeritContent, PreviousAward, Recipient

# 한국식 성+이름 후보군
LAST_NAMES = "김 이 박 최 정 강 조 윤 장 임 한 오 서 신 권 황 안 송 류 전 홍 고 문 양 손 배 백 허 노 심 유 남 진 변 채 원 천 방 공 표".split()
FIRST_M = "민준 서준 도윤 예준 시우 주원 하준 지호 지후 준우 준서 도현 건우 현우 민재 우진 선우 연우 정우 승우 영민 동현 성진 영수 현수".split()
FIRST_F = "서윤 서연 지우 서현 민서 하은 하윤 윤서 지유 채원 지민 수아 다은 예은 지아 가은 시은 유나 예린 시연 예원 윤아 채은".split()
FIRST_ALL = FIRST_M + FIRST_F

ORGS = [
    ("새마을지도자협의회", "회장"),
    ("바르게살기운동협의회", "사무국장"),
    ("한국자유총연맹", "이사"),
    ("적십자봉사회", "회장"),
    ("사회복지협의회", "이사"),
    ("한국문인협회 경기지부", "사무국장"),
    ("자원봉사센터", "팀장"),
    ("주민자치회", "회장"),
    ("학교운영위원회", "위원장"),
    ("스카우트연맹", "지도자"),
    ("청소년지도협의회", "회장"),
    ("의용소방대", "대장"),
    ("환경운동연합 경기지부", "사무국장"),
    ("어린이재단", "후원회장"),
    ("실버봉사단", "단장"),
    ("법사랑위원", "회장"),
    ("범죄피해자지원센터", "위원"),
    ("아동복지센터", "관장"),
    ("교통봉사대", "대장"),
    ("문화재지킴이", "회장"),
]
FIELDS = [
    "지역사회봉사", "사회복지", "안전·방재", "환경보호",
    "문화예술 진흥", "체육 진흥", "교육·청소년 지도",
    "농업·농촌 발전", "보건의료 봉사", "범죄예방·법무 봉사",
]
REGIONS = ["수원시", "성남시", "고양시", "용인시", "안산시", "부천시", "안양시", "평택시",
           "남양주시", "화성시", "시흥시", "파주시", "광명시", "김포시", "의정부시", "이천시",
           "여주시", "양주시", "동두천시", "양평군"]

AWARD_GRADES = [
    "경기도의회 의장 표창",
    "경기도지사 표창",
    "경기도의회 의장 모범상",
]

SAMPLE_MERIT_TEMPLATES = [
    "{org}에서 {role}으로 활동하며 {field}에 헌신해 왔음. 지역 주민과 함께 봉사 활동을 꾸준히 실천하여 따뜻한 공동체 형성에 기여하였으며, 청렴하고 솔선수범하는 자세로 주민들의 신뢰를 받아왔음.",
    "{org} {role}을(를) 맡아 {field} 분야에서 모범적인 활동을 이어가고 있음. 지역의 어려운 이웃을 살피고 다양한 봉사활동에 적극 참여하여 지역 사회 화합에 크게 기여하였음.",
    "{org}에서 {role}으로 봉사하며 {field}에 헌신함. 본인 또한 어려운 환경에서도 더 어려운 이웃을 돌아보며 물심양면으로 지원하였고, 지역 주민에게 큰 귀감이 되고 있음.",
]


def _rand_birth():
    start = date(1955, 1, 1)
    end = date(1985, 12, 31)
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def _rand_period():
    years = random.randint(3, 15)
    months = random.randint(0, 11)
    return f"{2025 - years}.{random.randint(1,12):02d} ~ 2025.12 ({years}년 {months}개월)"


def seed_demo_data(db: Session, n_recipients: int = 50) -> dict:
    """N명의 데모 대상자와 표창 건 3개 정도를 생성.

    멱등성: 제목이 "[DEMO]"로 시작하는 기존 케이스는 모두 삭제 후 재생성.
    """
    random.seed(42)  # 재현 가능

    # 1) 기존 [DEMO] 케이스 정리
    existing = db.query(AwardCase).filter(AwardCase.title.like("[DEMO]%")).all()
    for c in existing:
        db.delete(c)
    db.commit()

    # 2) 3개의 표창 건으로 분산
    cases = []
    case_specs = [
        ("[DEMO] 2026년 상반기 의장 표창 추천", "경기도의회 의장 표창",
         "경기도의회 의원 / 안전행정위원회", "강웅철"),
        ("[DEMO] 2026 도지사 표창 (지역봉사 분야)", "경기도지사 표창",
         "경기도의회 의원 / 보건복지위원회", "이선구"),
        ("[DEMO] 2026 의장 모범상 (문화·체육 분야)", "경기도의회 의장 모범상",
         "경기도의회 의원 / 문화체육관광위원회", "황대호"),
    ]
    for title, grade, full, name in case_specs:
        c = AwardCase(
            title=title,
            award_grade=grade,
            recommender_full_title=full,
            recommender_name=name,
            recommender_department="경기도의회",
            recommender_position="의원",
            recommendation_date=date(2026, 5, 1),
            award_date=date(2026, 6, 15),
        )
        db.add(c)
        db.flush()
        cases.append(c)

    # 3) N명 대상자 생성
    used_names = set()
    for i in range(n_recipients):
        # 중복 회피
        for _ in range(20):
            name = random.choice(LAST_NAMES) + random.choice(FIRST_ALL)
            if name not in used_names:
                used_names.add(name)
                break

        org, role = random.choice(ORGS)
        field = random.choice(FIELDS)
        region = random.choice(REGIONS)
        case = cases[i % len(cases)]
        birth = _rand_birth()

        r = Recipient(
            award_case_id=case.id,
            sequence_no=i + 1,
            recipient_name=name,
            chinese_name="",
            birth_date=birth,
            address=f"경기도 {region} 중앙로 {random.randint(1, 500)}",
            nationality="대한민국",
            occupation="자영업" if random.random() < 0.5 else "회사원",
            organization_name=f"{region} {org}",
            recipient_position_title=role,
            external_title=role,
            merit_category=field,
            merit_period=_rand_period(),
            recommendation_rank=f"{(i % 5) + 1}순위",
        )
        db.add(r)
        db.flush()

        # 공적내용
        body = random.choice(SAMPLE_MERIT_TEMPLATES).format(org=r.organization_name, role=role, field=field)
        mc = MeritContent(
            recipient_id=r.id,
            merit_short_summary=f"상기인은 {r.organization_name} {role}으로 {field} 분야에 헌신한 공로가 큼.",
            full_merit_text=body,
            recommendation_reason=(
                f"상기인은 {field} 분야에서 다년간 봉사와 헌신을 실천한 공로를 "
                "인정받아 수상 후보자로 추천함."
            ),
            character_assessment="성실하고 책임감 있음",
            local_reputation="주변 주민들에게 신뢰받음",
            merit_consistency="공적내용과 일치함",
        )
        db.add(mc)

        # 경력 2건
        career_year = birth.year + 25
        for k in range(2):
            db.add(CareerRecord(
                recipient_id=r.id,
                record_date=f"{career_year + k * 5}-01-01",
                description=f"{r.organization_name} {role} 임명" if k == 0 else f"{field} 봉사활동 활성화",
                sort_order=k,
            ))

        # 과거 표창 1건
        db.add(PreviousAward(
            recipient_id=r.id,
            award_date=f"{2020 + random.randint(0, 4)}-12-{random.randint(10, 28)}",
            description=f"{region}장 표창 ({field})",
            sort_order=0,
        ))

    db.commit()
    return {
        "demo_cases": [c.title for c in cases],
        "demo_recipients": n_recipients,
    }
