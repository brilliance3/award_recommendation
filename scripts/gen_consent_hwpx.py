"""개인정보 수집·이용 및 제공 활용 동의서 HWPX 생성 (report 템플릿 스타일 재사용).

hwpxskill 의 build_hwpx.py + report 템플릿을 사용. section0.xml 본문을 코드로 생성한다.
report 스타일: charPr7=20pt제목, charPr8=14pt볼드, charPr9=10pt볼드(표헤더), charPr11=9pt,
paraPr0=기본, paraPr20=center, paraPr21=center(셀), paraPr22=justify(셀),
borderFill3=4면테두리, borderFill4=헤더배경.
"""
import re
import subprocess
import sys

SKILL = "/Users/jun/.claude/skills/hwpxskill"
OUT = "개인정보_활용동의서.hwpx"
BODY_W = 42520

_id = [1000000000]
def nid():
    _id[0] += 1
    return str(_id[0])


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def p(text, charpr=0, parapr=0):
    """일반 문단."""
    return (f'<hp:p id="{nid()}" paraPrIDRef="{parapr}" styleIDRef="0" '
            f'pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="{charpr}"><hp:t>{esc(text)}</hp:t></hp:run></hp:p>')


def empty():
    return (f'<hp:p id="{nid()}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" '
            f'columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t/></hp:run></hp:p>')


def _cell(text, col, row, w, h, charpr, parapr, bfill):
    return (
        f'<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" '
        f'borderFillIDRef="{bfill}">'
        f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" '
        f'linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
        f'<hp:p id="{nid()}" paraPrIDRef="{parapr}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="{charpr}"><hp:t>{esc(text)}</hp:t></hp:run></hp:p>'
        f'</hp:subList>'
        f'<hp:cellAddr colAddr="{col}" rowAddr="{row}"/>'
        f'<hp:cellSpan colSpan="1" rowSpan="1"/>'
        f'<hp:cellSz width="{w}" height="{h}"/>'
        f'<hp:cellMargin left="510" right="510" top="141" bottom="141"/>'
        f'</hp:tc>')


def table(rows, widths, header_first_col=False, header_row=False, row_h=2800):
    """rows: list[list[str]] (헤더 행 포함). widths 합 = BODY_W.
    header_row=True 면 첫 행을 헤더 스타일. header_first_col=True 면 각 행 첫 열을 라벨(헤더 스타일)."""
    assert sum(widths) == BODY_W, f"width sum {sum(widths)} != {BODY_W}"
    nrow, ncol = len(rows), len(widths)
    total_h = row_h * nrow
    out = [
        f'<hp:p id="{nid()}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="0">'
        f'<hp:tbl id="{nid()}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" '
        f'textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" '
        f'rowCnt="{nrow}" colCnt="{ncol}" cellSpacing="0" borderFillIDRef="3" noAdjust="0">'
        f'<hp:sz width="{BODY_W}" widthRelTo="ABSOLUTE" height="{total_h}" heightRelTo="ABSOLUTE" protect="0"/>'
        f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" '
        f'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" '
        f'vertOffset="0" horzOffset="0"/>'
        f'<hp:outMargin left="0" right="0" top="0" bottom="0"/>'
        f'<hp:inMargin left="0" right="0" top="0" bottom="0"/>'
    ]
    for r, rowdata in enumerate(rows):
        out.append('<hp:tr>')
        for c, txt in enumerate(rowdata):
            is_head = (header_row and r == 0) or (header_first_col and c == 0)
            charpr = 9 if is_head else 0
            bfill = 4 if is_head else 3
            parapr = 21 if (header_row and r == 0) else 22
            out.append(_cell(txt, c, r, widths[c], row_h, charpr, parapr, bfill))
        out.append('</hp:tr>')
    out.append('</hp:tbl></hp:run></hp:p>')
    return "".join(out)


def build_body():
    b = []
    b.append(p("개인정보 수집·이용 및 제공 활용 동의서", charpr=7, parapr=20))
    b.append(empty())
    b.append(p("경기도의회(보건복지전문위원실)는 「경기도의회 의장 표창」 추천 및 표창 업무 처리를 위하여 "
               "아래와 같이 개인정보를 수집·이용하고, 필요한 범위에서 제3자에게 제공·활용하고자 합니다. "
               "내용을 확인하신 후 동의 여부를 표시하여 주십시오."))
    b.append(empty())

    b.append(p("1. [필수] 개인정보 수집·이용 동의", charpr=8))
    b.append(table([
        ["개인정보처리자", "경기도의회(보건복지전문위원실)"],
        ["정보주체", "의장 표창 추천 대상자(피추천자)"],
        ["수집·이용 목적", "표창 추천 적격 심사, 부적격 체크리스트 확인, 공적조서 작성, 표창장 발급, 등기 발송, 추천 명단·수상 기록 관리"],
        ["수집 항목", "성명, 생년월일, 주소, 연락처, 소속(단체명), 직위, 주요 공적사항(공적기간·공적내용·경력·기존 표창이력)"],
        ["수집하지 않는 정보", "주민등록번호 등 고유식별정보, 민감정보(건강·사상·정치성향 등)"],
        ["보유·이용 기간", "미선정자: 심사 종료·결과 처리 후 지체 없이 파기 / 선정자: 공적조서·심사자료 등 관련 기록은 경기도의회 기록관리기준표에 따른 보존연한 동안 보관"],
        ["동의 거부권·불이익", "동의를 거부할 권리가 있으나, 필수 항목 미동의 시 표창 추천 접수·심사·공적조서 작성·발급·발송 절차를 진행할 수 없습니다."],
    ], widths=[9000, 33520], header_first_col=True, row_h=2600))
    b.append(p("→ 위 수집·이용에 동의하십니까?    ☐ 동의함    ☐ 동의하지 않음", charpr=8))
    b.append(empty())

    b.append(p("2. [필수] 제3자 제공 및 업무 활용 동의", charpr=8))
    b.append(table([
        ["제공·활용 대상", "목적", "항목", "보유·이용 기간"],
        ["추천기관·신청기관 및 담당자", "추천자료 보완, 절차 진행·결과 안내, 표창 전달 협조", "성명, 소속, 직위, 연락처, 보완 필요 공적사항, 선정 여부", "추천·표창 절차 종료 시까지"],
        ["우정사업본부", "표창장·문서 등기 발송 및 수령 확인", "성명, 주소, 연락처", "발송·배송 민원 처리 종료 시까지"],
    ], widths=[8520, 12000, 14000, 8000], header_row=True, row_h=3200))
    b.append(p("→ 위 제공·활용에 동의하십니까?    ☐ 동의함    ☐ 동의하지 않음", charpr=8))
    b.append(p("※ 표창장 인쇄·문자 발송·시스템 유지보수 등 외부 업체가 경기도의회의 지휘·감독 아래 처리하는 "
               "경우는 제3자 제공이 아니라 개인정보 처리 위탁으로 관리하며, 위탁 내용은 개인정보 처리방침에 공개합니다.",
               charpr=11))
    b.append(empty())

    b.append(p("3. 만 14세 미만 법정대리인 동의 (해당 시)", charpr=8))
    b.append(p("대상자가 만 14세 미만인 경우 법정대리인 동의가 필요합니다.", charpr=11))
    b.append(table([
        ["만 14세 미만 여부", "☐ 해당 없음    ☐ 해당"],
        ["법정대리인 성명 / 관계", ""],
        ["법정대리인 연락처 / 서명", ""],
    ], widths=[11000, 31520], header_first_col=True, row_h=2800))
    b.append(empty())

    b.append(p("4. 확약 및 서명", charpr=8))
    b.append(p("본인은 위 내용을 충분히 확인하였으며, 의장 표창 추천 및 표창 업무 처리를 위한 개인정보 "
               "수집·이용 및 제공·활용에 동의합니다."))
    b.append(table([
        ["구분", "성명 / 기관", "연락처", "서명"],
        ["표창 추천 대상자", "", "", ""],
        ["법정대리인(해당 시)", "", "", ""],
        ["기관 신청자(대리 입력 시)", "기관:        담당자:", "", ""],
    ], widths=[10520, 16000, 8000, 8000], header_row=True, row_h=3000))
    b.append(empty())
    b.append(p("작성일:  20        년        월        일", charpr=8, parapr=0))
    b.append(p("※ 기관 신청자가 대상자 정보를 대리 입력·제출하는 경우, 기관 신청자는 대상자(또는 법정대리인)에게 "
               "본 동의서를 고지하고 동의를 받았음을 확약하며, 경기도의회 요청 시 동의 증빙을 제출해야 합니다.",
               charpr=11))
    return "".join(b)


def main():
    import os
    cand = [f"{SKILL}/templates/report/section0.xml",
            f"{SKILL}/templates/report/Contents/section0.xml",
            f"{SKILL}/templates/base/Contents/section0.xml"]
    refpath = next(p for p in cand if os.path.exists(p))
    ref = open(refpath, encoding="utf-8").read()
    # 첫 <hp:p> ... </hp:p> (secPr 포함 문단)만 prefix로 사용
    head = ref[: ref.index("</hs:sec>")]
    first_close = head.index("</hp:p>") + len("</hp:p>")
    prefix = head[:first_close]
    section = prefix + build_body() + "</hs:sec>"
    with open("/tmp/consent_section0.xml", "w", encoding="utf-8") as f:
        f.write(section)
    cmd = [sys.executable, f"{SKILL}/scripts/build_hwpx.py",
           "--template", "report", "--section", "/tmp/consent_section0.xml",
           "--title", "개인정보 수집·이용 및 제공 활용 동의서",
           "--creator", "경기도의회 보건복지전문위원실", "--output", OUT]
    subprocess.run(cmd, check=True)
    print("생성:", OUT)


if __name__ == "__main__":
    main()
