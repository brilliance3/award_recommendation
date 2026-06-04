"""개인정보 수집·이용 및 제공 동의서 HWPX 생성.

경기도 기관 표준 양식('개인정보활용제공동의서 샘플.hwpx', 서식 15-1)의 header.xml(스타일)과
secPr을 재사용하여, 표창 추천용 내용으로 1.수집·이용 / 2.제3자 제공 2개 섹션을 구성한다.
(우리 시스템은 주민등록번호 등 고유식별정보·민감정보를 수집하지 않으므로 해당 섹션은 제외)

사전 준비(이미 추출돼 있어야 함):
  /tmp/refkr_header.xml  (analyze_template.py --extract-header)
  /tmp/refkr_section.xml (analyze_template.py --extract-section)
실행: <py3.12+lxml> scripts/gen_consent_hwpx.py
산출: 개인정보_활용동의서.hwpx
"""
import os
import subprocess
import sys

SKILL = "/Users/jun/.claude/skills/hwpxskill"
HEADER = "/tmp/refkr_header.xml"
# secPr 은 base 템플릿(균형 보장)에서 가져오고 스타일만 refkr 헤더 사용
REF_SECTION = f"{SKILL}/templates/base/Contents/section0.xml"
OUT = "개인정보_활용동의서.hwpx"

# 기관 양식에서 추출한 스타일 ID
C_TITLE, P_TITLE = 43, 44       # 제목
C_HEAD, P_HEAD = 42, 5          # 섹션 제목 (1. / 2.)
C_LABEL, P_LABEL = 49, 45       # 표 라벨 셀
C_VAL, P_VAL = 50, 7            # 표 내용 셀
C_AGREE, P_AGREE = 42, 48       # (필수) 동의함 □ ...
C_BODY, P_BODY = 50, 7          # 본문/서명
LABEL_W, VAL_W = 14800, 27720   # 셀 너비 (합=42520 표준 본문폭)

_id = [1100000000]
def nid():
    _id[0] += 1
    return str(_id[0])

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def para(text, c=C_BODY, p=P_BODY):
    return (f'<hp:p id="{nid()}" paraPrIDRef="{p}" styleIDRef="0" pageBreak="0" '
            f'columnBreak="0" merged="0"><hp:run charPrIDRef="{c}"><hp:t>{esc(text)}</hp:t>'
            f'</hp:run></hp:p>')

def empty():
    return (f'<hp:p id="{nid()}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" '
            f'merged="0"><hp:run charPrIDRef="0"><hp:t/></hp:run></hp:p>')

def _cell(text, col, row, w, h, bfill, label):
    c = C_LABEL if label else C_VAL
    pp = P_LABEL if label else P_VAL
    return (
        f'<hp:tc name="" header="0" hasMargin="1" protect="0" editable="0" dirty="0" '
        f'borderFillIDRef="{bfill}">'
        f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" '
        f'linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
        f'<hp:p id="{nid()}" paraPrIDRef="{pp}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="{c}"><hp:t>{esc(text)}</hp:t></hp:run></hp:p>'
        f'</hp:subList>'
        f'<hp:cellAddr colAddr="{col}" rowAddr="{row}"/>'
        f'<hp:cellSpan colSpan="1" rowSpan="1"/>'
        f'<hp:cellSz width="{w}" height="{h}"/>'
        f'<hp:cellMargin left="510" right="510" top="141" bottom="141"/>'
        f'</hp:tc>')

def label_table(rows, row_h=2600):
    """rows: list[(label, value)]. 라벨/내용 2열, 위치별 테두리(15/16 첫행, 17/18 중간, 19/20 끝행)."""
    n = len(rows)
    total = row_h * n
    out = [
        f'<hp:p id="{nid()}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="0">'
        f'<hp:tbl id="{nid()}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" '
        f'textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="0" '
        f'rowCnt="{n}" colCnt="2" cellSpacing="0" borderFillIDRef="3" noAdjust="0">'
        f'<hp:sz width="{LABEL_W+VAL_W}" widthRelTo="ABSOLUTE" height="{total}" heightRelTo="ABSOLUTE" protect="0"/>'
        f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" '
        f'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" '
        f'vertOffset="0" horzOffset="0"/>'
        f'<hp:outMargin left="0" right="0" top="0" bottom="0"/>'
        f'<hp:inMargin left="0" right="0" top="0" bottom="0"/>'
    ]
    for r, (lab, val) in enumerate(rows):
        if r == 0:
            lb, vb = 15, 16
        elif r == n - 1:
            lb, vb = 19, 20
        else:
            lb, vb = 17, 18
        out.append('<hp:tr>')
        out.append(_cell(lab, 0, r, LABEL_W, row_h, lb, True))
        out.append(_cell(val, 1, r, VAL_W, row_h, vb, False))
        out.append('</hp:tr>')
    out.append('</hp:tbl></hp:run></hp:p>')
    return "".join(out)

def build_body():
    b = []
    b.append(para("개인정보 수집·이용 및 제공 동의서", C_TITLE, P_TITLE))
    b.append(empty())
    b.append(para("경기도의회(보건복지전문위원실)는 「개인정보 보호법」 제15조·제17조·제22조에 따라 "
                  "「경기도의회 의장 표창」 추천을 위하여 귀하의 개인정보를 아래와 같이 수집·이용 및 제공하고자 "
                  "합니다. 동의 여부를 체크하여 주시기 바랍니다."))
    b.append(empty())

    b.append(para("1. 개인정보 수집·이용에 대한 동의", C_HEAD, P_HEAD))
    b.append(label_table([
        ("개인정보의 수집 및 이용목적",
         "표창 추천 적격 심사, 부적격 체크리스트 확인, 공적조서 작성, 표창장 발급·등기 발송, 추천 명단·수상 기록 관리"),
        ("개인정보 수집 항목",
         "성명, 생년월일, 주소, 연락처, 소속(단체명), 직위, 주요 공적사항(공적기간·내용·경력·기존 표창이력) "
         "※ 주민등록번호 등 고유식별정보·민감정보는 수집하지 않음"),
        ("개인정보의 보유 및 이용기간",
         "미선정 시 처리 목적 달성 후 지체 없이 파기하며, 선정 시 공적조서·심사자료 등 관련 기록은 "
         "경기도의회 기록관리기준표에 따른 보존연한 동안 보관합니다."),
        ("동의 거부 권리와 불이익",
         "귀하는 위 사항에 대하여 동의를 거부할 권리가 있으며, 거부 시 표창 추천·심사·공적조서 작성·발급·발송 "
         "절차 진행이 제한됩니다."),
    ]))
    b.append(para("(필   수)        동의함 ☐                동의하지 않음 ☐", C_AGREE, P_AGREE))
    b.append(empty())

    b.append(para("2. 제3자 제공 및 활용 동의", C_HEAD, P_HEAD))
    b.append(label_table([
        ("제3자 제공·활용 목적",
         "추천자료 보완, 절차 진행·결과 안내, 표창 전달 협조, 표창장 등기 발송"),
        ("제3자 제공·활용 항목",
         "성명, 소속, 직위, 연락처, 주소, 보완이 필요한 공적사항, 선정 여부"),
        ("제3자 제공·활용 보유 및 이용기간",
         "추천·표창 절차 종료 시까지(등기 발송은 배송 관련 민원 처리 종료 시까지)"),
        ("제공받는 자",
         "추천기관·신청기관 및 담당자, 우정사업본부(표창장 등기 발송)"),
        ("동의 거부 권리와 불이익",
         "귀하는 위 사항에 대하여 동의를 거부할 권리가 있으며, 거부 시 표창 추천·발급·발송 절차 진행이 "
         "제한됩니다."),
    ]))
    b.append(para("(필   수)        동의함 ☐                동의하지 않음 ☐", C_AGREE, P_AGREE))
    b.append(empty())

    b.append(para("본인은 상기 내용과 같이 개인정보를 수집·이용 및 제공하는 데 동의합니다."))
    b.append(empty())
    b.append(para("20          년          월          일", C_AGREE, P_AGREE))
    b.append(empty())
    b.append(para("대상자 성명 :                              (서명 또는 인)"))
    b.append(para("법정대리인(만14세 미만 시) :                       (서명 또는 인)"))
    b.append(para("대리 작성 시 — 기관명 :              담당자 :              "
                  "(대상자에게 고지·동의받았음을 확약)"))
    b.append(empty())
    b.append(para("경기도의회(보건복지전문위원실) 귀하", C_HEAD, P_AGREE))
    return "".join(b)

def main():
    if not os.path.exists(HEADER) or not os.path.exists(REF_SECTION):
        sys.exit("먼저 analyze_template.py 로 /tmp/refkr_header.xml, /tmp/refkr_section.xml 추출 필요")
    ref = open(REF_SECTION, encoding="utf-8").read()
    head = ref[: ref.index("</hs:sec>")]
    prefix = head[: head.index("</hp:p>") + len("</hp:p>")]  # secPr 포함 첫 문단
    section = prefix + build_body() + "</hs:sec>"
    with open("/tmp/consent_section0.xml", "w", encoding="utf-8") as f:
        f.write(section)
    subprocess.run([sys.executable, f"{SKILL}/scripts/build_hwpx.py",
                    "--header", HEADER, "--section", "/tmp/consent_section0.xml",
                    "--title", "개인정보 수집·이용 및 제공 동의서",
                    "--creator", "경기도의회 보건복지전문위원실", "--output", OUT], check=True)
    print("생성:", OUT)

if __name__ == "__main__":
    main()
