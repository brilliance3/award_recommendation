"""HWPX 생성 서비스 (공적개요서)

표창 양식 .hwpx 템플릿을 기반으로 데이터 행의 텍스트 노드를 치환하여
한글(HWPX) 파일을 생성합니다.

템플릿 셀 구조 (총 14개 hp:tc):
  - 셀 0~6: 헤더 (연번/단체명/성명·생년월일/공적분야/추천훈격/직위/공적개요)
  - 셀 7:   연번
  - 셀 8:   단체명
  - 셀 9:   성명 + (생년월일)
  - 셀 10:  공적분야 (두 단락 — 첫 단락에 전체 텍스트, 두 번째는 빈 문자열)
  - 셀 11:  추천훈격 (의장 고정 — 그대로 두면 됨)
  - 셀 12:  직위
  - 셀 13:  공적개요 1~4 (1. 본문 / 2. 본문 / 3. 본문 / 4. 본문 — 홀수 인덱스가 본문)
"""
from __future__ import annotations

import copy
import zipfile
from datetime import date
from pathlib import Path

from lxml import etree

from ..config import DEFAULT_INVESTIGATOR, GENERATED_DIR
from ..models import AwardCase, Recipient

TEMPLATE_PATH = (
    Path(__file__).resolve().parent.parent / "templates" / "공적개요서_template.hwpx"
)
REPORT_TEMPLATE_PATH = (
    Path(__file__).resolve().parent.parent / "templates" / "공적조서_template.hwpx"
)
CHECKLIST_TEMPLATE_PATH = (
    Path(__file__).resolve().parent.parent / "templates" / "체크리스트_template.hwpx"
)

NS = {
    "hp": "http://www.hancom.co.kr/hwpml/2011/paragraph",
    "hs": "http://www.hancom.co.kr/hwpml/2011/section",
}


def _fmt_birth(d) -> str:
    if not d:
        return ""
    if isinstance(d, date):
        return f"({d.year:04d}.{d.month:02d}.{d.day:02d}.)"
    return f"({d})"


def _cell_texts(cell):
    return cell.findall(".//hp:t", NS)


def _set_first_text(cell, text: str) -> None:
    ts = _cell_texts(cell)
    if not ts:
        # 빈 셀(run은 있으나 hp:t 없음): 첫 run에 hp:t 생성
        run = cell.find(".//hp:run", NS)
        if run is None:
            p = cell.find(".//hp:p", NS)
            if p is None:
                return
            run = etree.SubElement(p, f"{{{NS['hp']}}}run")
        t = etree.SubElement(run, f"{{{NS['hp']}}}t")
        t.text = text
        return
    for i, t in enumerate(ts):
        t.text = text if i == 0 else ""


def _collapse_to_first_paragraph(cell) -> None:
    """셀의 첫 문단만 남기고 나머지(양식 여분 빈 문단)를 제거.
    일부 값 셀(예: 조사자 소속)이 양식에 빈 문단을 포함해, _set_first_text로 값을
    채운 뒤에도 빈 줄(엔터)이 남는 것을 정리한다."""
    sub = cell.find("hp:subList", NS)
    if sub is None:
        return
    ps = sub.findall("hp:p", NS)
    for p in ps[1:]:
        sub.remove(p)


def _set_two_texts(cell, t1: str, t2: str) -> None:
    ts = _cell_texts(cell)
    if ts:
        ts[0].text = t1
    if len(ts) >= 2:
        ts[1].text = t2
    for t in ts[2:]:
        t.text = ""


def _wrap_merit_field(text: str) -> str:
    """공적분야명에 합성어 경계(보이지 않는 줄바꿈 위치, ZWSP)를 넣어
    셀에서 줄바뀜 시 글자 중간이 아니라 '유공' 앞에서 끊기게 한다."""
    t = text or ""
    if t.endswith("유공") and len(t) > 2:
        return t[:-2] + "​" + "유공"
    return t


def _fill_overview_data_row(row, recipient: Recipient, seq: int) -> None:
    """01 공적개요서의 데이터 행 1개 채움 (셀 7개)."""
    cells = row.findall("hp:tc", NS)
    if len(cells) < 7:
        return
    mc = recipient.merit_content
    _set_first_text(cells[0], str(seq))
    _set_first_text(cells[1], recipient.organization_name or "")
    _set_two_texts(cells[2], recipient.recipient_name or "", _fmt_birth(recipient.birth_date))
    _set_two_texts(cells[3], _wrap_merit_field(recipient.merit_category or ""), "")
    # 셀 4(추천훈격)은 의장 고정 — 손대지 않음
    _set_first_text(cells[5], recipient.recipient_position_title or "")

    cell6_ts = _cell_texts(cells[6])
    full_text = (mc.full_merit_text if mc else "") or ""
    if full_text.strip():
        from .merit_generator import summarize_to_overview_4
        overviews = summarize_to_overview_4(full_text)
    else:
        overviews = [
            (mc.merit_overview_1 if mc else "") or "",
            (mc.merit_overview_2 if mc else "") or "",
            (mc.merit_overview_3 if mc else "") or "",
            (mc.merit_overview_4 if mc else "") or "",
        ]
    # 패턴: [0]="1. ", [1]=본문1, [2]="2. ", [3]=본문2, ...
    # 번호 구분자("1. ")는 동그라미 불릿(◦)으로 교체.
    # 본문 앞에 이미 번호(①·1. 등)가 있으면 제거 — 구분자와 중복 방지.
    import re

    for i, body in enumerate(overviews):
        num_idx = 2 * i
        body_idx = 2 * i + 1
        body = re.sub(r"^\s*([0-9]+|[①-⑨])[.)\s]+", "", body or "").strip()
        if num_idx < len(cell6_ts):
            cell6_ts[num_idx].text = "◦ "
        if body_idx < len(cell6_ts):
            cell6_ts[body_idx].text = body


def generate_merit_overview_hwpx(case: AwardCase) -> Path:
    """01. 공적개요서.hwpx 생성 — 대상자 수만큼 데이터 행을 복제하여 추가"""
    if not case.recipients:
        raise ValueError("대상자가 없습니다")

    with zipfile.ZipFile(TEMPLATE_PATH, "r") as zin:
        section_bytes = zin.read("Contents/section0.xml")

    root = etree.fromstring(section_bytes)
    tables = root.findall(".//hp:tbl", NS)
    if not tables:
        raise RuntimeError("템플릿에 표가 없습니다")
    tbl = tables[0]
    rows = tbl.findall("hp:tr", NS)
    if len(rows) < 2:
        raise RuntimeError(f"템플릿 행 수 비정상: rows={len(rows)}")

    # row[0]=헤더, row[1]=데이터 양식 행 (첫 대상자에 사용)
    data_row_template = rows[1]
    recipients = list(case.recipients)

    # 첫 번째 대상자는 기존 행을 그대로 사용
    _fill_overview_data_row(data_row_template, recipients[0], seq=1)

    # 두 번째부터는 양식 행을 deepcopy 후 cellAddr 업데이트 + 데이터 채움
    for idx, r in enumerate(recipients[1:], start=2):
        new_row = copy.deepcopy(data_row_template)
        for c in new_row.findall("hp:tc", NS):
            addr = c.find("hp:cellAddr", NS)
            if addr is not None:
                addr.set("rowAddr", str(idx))
        _fill_overview_data_row(new_row, r, seq=idx)
        tbl.append(new_row)

    tbl.set("rowCnt", str(1 + len(recipients)))

    # 공적분야(col 3) 셀이 좁아 합성어가 줄바뀜 시 글자 중간에서 잘리므로,
    # 공적개요(col 6) 너비를 줄여 공적분야 너비를 늘린다 (합성어가 한 줄에 들어가게).
    _WIDEN = 1700
    for tr in tbl.findall("hp:tr", NS):
        for cell in tr.findall("hp:tc", NS):
            addr = cell.find("hp:cellAddr", NS)
            sz = cell.find("hp:cellSz", NS)
            if addr is None or sz is None:
                continue
            col = addr.get("colAddr")
            try:
                w = int(sz.get("width"))
            except (TypeError, ValueError):
                continue
            if col == "3":
                sz.set("width", str(w + _WIDEN))
            elif col == "6":
                sz.set("width", str(w - _WIDEN))

    new_section = etree.tostring(
        root, xml_declaration=True, encoding="UTF-8", standalone=True
    )

    recommender = case.recommender_name or "추천자"
    out_name = f"01. 공적개요서({recommender} 의원).hwpx"
    out_path = GENERATED_DIR / out_name

    # 폰트를 경기천년체로 정규화 (PDF 미리보기 시 나눔고딕 대체 방지). 02 전용 레이아웃은 미적용.
    _save_hwpx(TEMPLATE_PATH, out_path, new_section, normalize_fonts=True)
    return out_path


def _normalize_header_fonts(header_bytes: bytes) -> bytes:
    """header.xml의 폰트 테이블을 경기천년체 2개로 깨끗하게 재구성한다.

    배경: 양식 템플릿은 언어블록당 7~8개 폰트(경기천년바탕·제목 + 굴림체/함초롬/한컴바탕
    등)를 갖고, 본문 텍스트는 함초롬돋움 등을 참조한다. 과거엔 정규식으로 모든 face를
    경기천년으로 바꿨는데, 그러면 '경기천년바탕 TTF' face가 6개 중복된다.
    - macOS 한컴은 관대해서 중복이 있어도 경기천년으로 렌더한다.
    - **그러나 Windows 한컴은 동일 face 이름이 여러 개면 폰트 매핑에 실패→경기천년
      미표시(시스템 기본 폴백)** 한다. (사용자 실제 환경=Windows. 정상 샘플은 폰트가
      3개로 깔끔해 Windows에서도 정상.)

    그래서 폰트 테이블을 정상 샘플처럼 깨끗한 2개로 재구성한다:
      id0=경기천년바탕(TTF, substFont 함초롬돋움), id1=경기천년제목(TTF, substFont 함초롬돋움).
    그리고 charPr의 fontRef를 재매핑한다: 원본 id1(경기천년제목)→1, 그 외 모든 id→0.
    (템플릿은 모든 언어블록에서 id0=경기천년바탕, id1=경기천년제목으로 일관됨.)
    substFont는 경기천년이 아닌 한컴 기본 글꼴(함초롬돋움)로 둬, 경기천년이 없는 환경에서도
    시스템 기본이 아니라 함초롬돋움으로 안전하게 폴백되게 한다.
    """
    HH = "{http://www.hancom.co.kr/hwpml/2011/head}"
    root = etree.fromstring(header_bytes)
    # 템플릿 폰트 테이블은 언어블록당 7~8개 폰트(경기천년바탕·제목 + 굴림체/함초롬 등)이고
    # id0=경기천년바탕, id1=경기천년제목으로 일관된다. 이를 전부 경기천년으로 바꾸면
    # '경기천년바탕 TTF'가 6개 중복되어 한컴이 폰트 매핑에 실패→경기천년 미표시 폴백한다.
    # 그래서 폰트 테이블을 깨끗한 2개(0=바탕, 1=제목)로 재구성하고 charPr 참조를 재매핑한다.
    # 재매핑: 원본 id1(경기천년제목)→1, 그 외 모든 id→0(경기천년바탕).
    for cp in root.iter(HH + "charPr"):
        fr = cp.find(HH + "fontRef")
        if fr is None:
            continue
        for attr in ("hangul", "latin", "hanja", "japanese", "other", "symbol", "user"):
            v = fr.get(attr)
            if v is not None:
                fr.set(attr, "1" if v == "1" else "0")
    for ff in root.iter(HH + "fontface"):
        for f in list(ff.findall(HH + "font")):
            ff.remove(f)
        for fid, face in (("0", "경기천년바탕"), ("1", "경기천년제목")):
            font = etree.SubElement(ff, HH + "font")
            font.set("id", fid)
            font.set("face", face)
            font.set("type", "TTF")
            font.set("isEmbedded", "0")
            sub = etree.SubElement(font, HH + "substFont")
            sub.set("face", "함초롬돋움")
            sub.set("type", "TTF")
            sub.set("isEmbedded", "0")
            sub.set("binaryItemIDRef", "")
        ff.set("fontCnt", "2")
    txt = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True).decode("utf-8")
    # 빨강(성품 강조)·파랑(본문표·공적요지·경력·공적사항 등 양식 sample) 글자색을 검정으로 통일
    for color in ("#FF0000", "#0000FF", "#2E74B5"):
        txt = txt.replace(color, "#000000")
    return txt.encode("utf-8")


def _fix_report_header(header_bytes: bytes) -> bytes:
    """02 공적조서 전용 header 보정.

    - 추천사유(paraPr 54)·공적요지(32)·공적사항(23)의 첫줄 내어쓰기(intent 음수)를 0으로
      → 모든 줄이 같은 세로선에 정렬.
    - 공적사항 글자(charPr 14)가 height 400(다른 셀 1300의 1/3)으로 작게 나오므로 1300으로 통일.
    각 ID는 해당 항목 전용이라 다른 곳에 영향 없음.
    """
    root = etree.fromstring(header_bytes)

    def ln(e):
        return etree.QName(e.tag).localname

    for e in root.iter():
        lname = ln(e)
        if lname == "paraPr" and e.get("id") in ("54", "32", "23"):
            for c in e.iter():
                if ln(c) == "intent":
                    c.set("value", "0")
        elif lname == "charPr" and e.get("id") == "14":
            e.set("height", "1300")
        elif lname == "charPr" and e.get("id") in ("37", "38"):
            # 경력 이력 — LibreOffice 행 높이가 약 2줄로 고정돼 긴 이력이 잘리므로
            # 글자를 약간 줄여(11pt) 2줄 안에 들어오게 한다.
            e.set("height", "1100")
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def _para_in_table(p) -> bool:
    par = p.getparent()
    while par is not None:
        if etree.QName(par.tag).localname == "tbl":
            return True
        par = par.getparent()
    return False


def _collect_body_para_ids(root) -> set:
    """단락 간격을 늘릴 본문 '항목' paragraph 전용 paraPrIDRef 집합.

    ○/- 로 시작하는 본문 항목(예: '○ 훈격', '○ 성명', '○ 성품')만 대상.
    제목·소제목(□/공적조서)·표·서명 등은 제외하여 제목과 표가 분리되거나
    빈 페이지가 생기지 않게 한다. 항목 paraPr가 제목 등에도 쓰이면 제외한다.
    """
    P = "{http://www.hancom.co.kr/hwpml/2011/paragraph}p"
    target, other = set(), set()
    for p in root.iter(P):
        pid = p.get("paraPrIDRef")
        if pid is None:
            continue
        if _para_in_table(p):
            other.add(pid)
            continue
        ts = p.findall(".//hp:t", NS)
        joined = "".join((t.text or "") for t in ts).strip()
        if joined.startswith("○") or joined.startswith("-") or joined.startswith("상기인"):
            target.add(pid)
        else:
            other.add(pid)
    return target - other


def _adjust_header_spacing(
    header_bytes: bytes, para_ids: set, prev: int, next_: int, min_line: int
) -> bytes:
    """본문 paraPr의 단락 위/아래 여백(margin)과 최소 행간을 늘려 서식을 여유롭게.

    para_ids에 속한 paraPr만 조정하므로 표 안 텍스트 줄간격에는 영향 없음.
    """
    root = etree.fromstring(header_bytes)

    def ln(e):
        return etree.QName(e.tag).localname

    for el in root.iter():
        if ln(el) != "paraPr" or el.get("id") not in para_ids:
            continue
        for sub in el.iter():
            t = ln(sub)
            if t == "margin":
                for c in sub:
                    ct = ln(c)
                    if ct == "prev":
                        c.set("value", str(prev))
                    elif ct == "next":
                        c.set("value", str(next_))
            elif t == "lineSpacing":
                try:
                    if int(c_val := sub.get("value", "0")) < min_line:
                        sub.set("value", str(min_line))
                except ValueError:
                    pass
    return etree.tostring(
        root, xml_declaration=True, encoding="UTF-8", standalone=True
    )


def _finalize_header_layout(header_bytes: bytes) -> bytes:
    """정렬용 신규 paraPr 추가 + 현지조사자 소속/직급/성명 paraPr(59) 정렬 변경.

    - paraPr 25(JUSTIFY)를 복제하여 73(RIGHT)·74(CENTER) 생성 (위기록·본문표 날짜용)
    - paraPr 59(소속/직급/성명) → 왼쪽 정렬 + 들여쓰기(margin left)로 세로 정렬 + 오른쪽 배치
    """
    import copy as _copy

    root = etree.fromstring(header_bytes)

    def ln(e):
        return etree.QName(e.tag).localname

    pp25 = container = None
    for el in root.iter():
        if ln(el) == "paraPr" and el.get("id") == "25":
            pp25 = el
            container = el.getparent()
            break

    if pp25 is not None and container is not None:
        for new_id, align in ((_ALIGN_RIGHT_PARA, "RIGHT"), (_ALIGN_CENTER_PARA, "CENTER")):
            new_pr = _copy.deepcopy(pp25)
            new_pr.set("id", new_id)
            for c in new_pr.iter():
                if ln(c) == "align":
                    c.set("horizontal", align)
            container.append(new_pr)
        try:
            container.set("itemCnt", str(int(container.get("itemCnt")) + 2))
        except (TypeError, ValueError):
            pass

    # 소속/직급/성명(paraPr 59)을 왼쪽 정렬 + 들여쓰기(intent)/여백 0으로 → 앞 공백만으로
    # 소/직/성 시작이 같은 세로선에 정렬되게. (현지조사자)(paraPr 58)는 원본 LEFT 유지.
    for el in root.iter():
        if ln(el) == "paraPr" and el.get("id") == "59":
            for c in el.iter():
                if ln(c) == "align":
                    c.set("horizontal", "LEFT")
                elif ln(c) in ("left", "right", "intent"):
                    c.set("value", "0")

    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def _charpr_heights(header_bytes: bytes) -> dict:
    """header.xml에서 charPr id → 글자 높이(HWPUNIT) 맵. lineseg 줄 수 계산용."""
    H = "{http://www.hancom.co.kr/hwpml/2011/head}"
    try:
        root = etree.fromstring(header_bytes)
    except Exception:
        return {}
    m = {}
    for cp in root.iter(H + "charPr"):
        try:
            m[cp.get("id")] = int(cp.get("height") or 1000)
        except ValueError:
            pass
    return m


def _needed_line_count(p, tc, text: str, charpr_heights: dict) -> int:
    """문단 text가 셀(tc) 폭에 들어가는 데 필요한 줄 수(rhwp measure식 근사).

    글자폭: 한글/한자/전각(비ASCII)=글자크기, ASCII=글자크기*0.55 (rhwp 렌더 shim과 동일).
    """
    if tc is None or not charpr_heights:
        return 999  # 정보가 없으면 '긴 셀'로 간주해 제거 쪽으로
    csz = tc.find("hp:cellSz", NS)
    if csz is None:
        return 999
    try:
        width = int(csz.get("width") or 0)
    except ValueError:
        return 999
    cm = tc.find("hp:cellMargin", NS)
    ml = int(cm.get("left") or 141) if cm is not None else 141
    mr = int(cm.get("right") or 141) if cm is not None else 141
    avail = max(1, width - ml - mr)
    run = p.find("hp:run", NS)
    fs = charpr_heights.get(run.get("charPrIDRef") if run is not None else None, 1000)
    w = 0.0
    for ch in text:
        w += fs if ord(ch) > 0x2000 else fs * 0.55  # 비ASCII(한글/한자/전각)=전각폭
    return max(1, -int(-w // avail))  # ceil


def _strip_linesegarray(section_bytes: bytes, charpr_heights: dict = None) -> bytes:
    """section0.xml에서 텍스트가 있는 문단의 linesegarray(줄 위치 캐시)를 제거.

    한컴 개발자포럼 권장: 텍스트 수정 문단의 hp:linesegarray는 stale 캐시가 되므로 제거한다.
    빈 문단 캐시는 빈 입력행 높이 유지를 위해 보존한다.
    """
    LSA = "{http://www.hancom.co.kr/hwpml/2011/paragraph}linesegarray"
    T = "{http://www.hancom.co.kr/hwpml/2011/paragraph}t"
    try:
        root = etree.fromstring(section_bytes)
    except Exception:
        return section_bytes
    removed = False
    for lsa in list(root.iter(LSA)):
        parent = lsa.getparent()  # <hp:p> 문단
        if parent is None:
            continue
        text = "".join(t.text or "" for t in parent.iter(T))
        if not text.strip():
            continue  # 빈 문단 보존
        parent.remove(lsa)
        removed = True
    if not removed:
        return section_bytes
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def _save_hwpx(
    template_path: Path,
    out_path: Path,
    new_section: bytes,
    normalize_fonts: bool = False,
    spacing_para_ids: set = None,
    apply_report_layout: bool = False,
    report_fix: bool = False,
    merit_detail_charprs: set = None,
) -> None:
    """원본 zip을 그대로 복사하되 Contents/section0.xml만 교체.
    mimetype은 STORED(비압축)로 저장하여 OWPML 규약을 유지.
    normalize_fonts=True이면 header.xml 폰트를 경기천년체로 정규화 (PDF 변환용).
    spacing_para_ids가 주어지면 해당 본문 paraPr의 단락 여백·행간을 늘려 서식을 여유롭게.
    apply_report_layout=True이면 02 공적조서 전용 정렬 paraPr(73/74) 생성·59 정렬 적용."""
    # 한컴 stale 줄 캐시 경고 방지 — 텍스트가 있는 문단의 linesegarray만 제거하고 빈 문단 캐시는 보존한다.
    with zipfile.ZipFile(template_path, "r") as ztmp:
        _hdr_bytes = ztmp.read("Contents/header.xml")
    new_section = _strip_linesegarray(new_section, _charpr_heights(_hdr_bytes))
    with zipfile.ZipFile(template_path, "r") as zin:
        with zipfile.ZipFile(out_path, "w") as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "Contents/section0.xml":
                    data = new_section
                elif item.filename == "Contents/header.xml" and normalize_fonts:
                    data = _normalize_header_fonts(data)
                    if spacing_para_ids:
                        data = _adjust_header_spacing(
                            data, spacing_para_ids, prev=140, next_=140, min_line=140
                        )
                    if apply_report_layout:
                        data = _finalize_header_layout(data)
                    if report_fix:
                        data = _fix_report_header(data)
                    if merit_detail_charprs:
                        data = _set_charpr_height(data, merit_detail_charprs, 1300)
                if item.filename == "mimetype":
                    zout.writestr(item, data, compress_type=zipfile.ZIP_STORED)
                else:
                    zout.writestr(item, data, compress_type=zipfile.ZIP_DEFLATED)


def _set_charpr_height(header_bytes: bytes, charpr_ids: set, height: int) -> bytes:
    """지정 charPr들의 글자 크기(height)를 변경. (29)공적사항 셀 전체 13pt 고정용."""
    HH = "{http://www.hancom.co.kr/hwpml/2011/head}"
    root = etree.fromstring(header_bytes)
    ids = {str(i) for i in charpr_ids}
    for cp in root.iter(HH + "charPr"):
        if cp.get("id") in ids:
            cp.set("height", str(height))
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


# === 02. 공적조서 (Merit Report) ===

# 양식 안의 sample data → 사용자 데이터 매핑.
# section0.xml 직렬화 결과 문자열에 대해 일괄 string replace 한다.
# 양식 안에서 동일한 텍스트가 여러 곳(표 #0 페이지1 표, 표 #1 공적조서 본문,
# 표 외 페이지5 현지조사 인적사항)에 등장하며, 모두 동일한 사용자 값으로
# 변경되는 것이 의도된 동작이다.
_REPORT_SAMPLE_MAP = {
    # 가장 긴 sample을 먼저 둠 — 짧은 키워드(자문위원 등)가 본문 안에 포함되어
    # 있으므로 순서가 중요하다.
    "recommendation_reason": (
        "성남 지역사회에 대한 깊은 애정을 바탕으로 약 8년 동안 재단의 주요 의사결정과 "
        "배분 정책 수립에 헌신해 왔습니다. 이사 임기 종료 후에도 자문위원으로서 재단의 "
        "나눔 철학을 계승하기 위해 변함없이 활동하고 있는바, 성남시의 기부 문화 확산과 "
        "사회 안전망 구축에 기여한 공적이 매우 높으므로 포상 대상자로 추천합니다."
    ),
    "name": "성진경",
    "chinese": "成進慶",
    "birth_dot": "1972.06.23.",  # (2)생년월일, 현지조사 인적사항
    "birth_dot_short": "1972.06.23",  # 표 #0 페이지1 표
    "address": "서울시 서초구 안골길 13, 2층 (내곡동)",
    "occupation": "기업인",
    "organization": "성남이로운재단",
    "position": "자문위원",
    "merit_category": "지역사회발전유공",
    "merit_period_nospace": "7년11개월",  # 표 #0 페이지1 표
    "merit_period_spaced": "7년 11개월",  # 표 #1 (11)공적기간
    "award_date_short": "26.04.29.",  # 표 #0 표창일
    "recommender_line": "보건복지위원회 000 의원",  # 페이지1 추천기관·의원
    "recommender_full": "경기도의회 보건복지위원회 의원   000    (인)",  # 페이지1 추천(의뢰)자
    "recommender_signoff": "추 천 관    경기도의회 보건복지위원회 의원   000    (인)",  # 표 #1 셀 41
    "confirm_date": "2026.   .   .",  # 페이지1 확인 날짜
    "merit_count": "1명",  # 추천대상자 N명
}


def _fmt_birth_dot(d) -> str:
    if not d:
        return ""
    if isinstance(d, date):
        return f"{d.year:04d}.{d.month:02d}.{d.day:02d}."
    return str(d)


def _fmt_birth_dot_short(d) -> str:
    if not d:
        return ""
    if isinstance(d, date):
        return f"{d.year:04d}.{d.month:02d}.{d.day:02d}"
    return str(d)


def _fmt_award_date_short(d) -> str:
    if not d:
        return ""
    if isinstance(d, date):
        return f"{d.year % 100:02d}.{d.month:02d}.{d.day:02d}."
    return str(d)


def _fmt_dot_date(d) -> str:
    """YYYY. M. D. 형식 (페이지1 확인 날짜). None이면 빈 칸."""
    if not d:
        return "    .   .   ."
    return f"{d.year}. {d.month}. {d.day}."


def _fmt_korean_date(d) -> str:
    """YYYY년 M월 D일 형식 (본문표/현지조사 확인서 날짜). None이면 빈 칸."""
    if not d:
        return "       년      월      일"
    return f"{d.year}년  {d.month}월  {d.day}일"


def generate_merit_report_hwpx(
    case: AwardCase, recipient: Recipient = None, investigator: dict = None
) -> Path:
    """02. 공적조서.hwpx — case별 1파일.

    대상자 N명이면:
    - 페이지1 표 (#0)에 N행 채움
    - 공적조서 본문 + 현지조사확인서 묶음을 N번 반복 (각 대상자별 1세트)

    recipient 인자는 deprecation 위해 유지 — 무시되고 case.recipients 사용.
    investigator(dict)가 주어지면 조사자 소속/직위/직급/성명을 설정값으로 채운다.
    None이면 양식 sample 그대로 둔다.
    """
    if not case.recipients:
        raise ValueError("대상자가 없습니다")
    recipients = list(case.recipients)
    award_grade = case.award_grade or "경기도의회 의장 표창"
    rec_name = case.recommender_name or ""
    rec_dept = case.recommender_department or "보건복지위원회"
    rec_full_base = case.recommender_full_title or ""
    if rec_name and rec_full_base.rstrip().endswith(rec_name):
        rec_full_base = rec_full_base.rstrip()[: -len(rec_name)].rstrip()
    confirm_date = _fmt_dot_date(case.created_at)
    survey_date = _fmt_korean_date(case.seal_applied_at)
    body_date = _fmt_korean_date(case.seal_applied_at)  # 본문표 추천관(인) 확인 날짜 = 도장일
    award_date_short = _fmt_award_date_short(case.award_date)
    signoff = (
        f"추 천 관    {rec_full_base}   {rec_name}    (인)"
        if rec_full_base
        else f"추 천 관    {rec_name}    (인)"
    )

    with zipfile.ZipFile(REPORT_TEMPLATE_PATH, "r") as zin:
        section_bytes = zin.read("Contents/section0.xml")
    root = etree.fromstring(section_bytes)
    tables = root.findall(".//hp:tbl", NS)
    if len(tables) < 3:
        raise RuntimeError(f"공적조서 양식 표 개수 비정상: {len(tables)}")

    # --- 페이지1 추천개요 텍스트 ---
    _replace_paragraph_starting_with(root, "○ 훈    격", f"○ 훈    격 : {award_grade}")
    _replace_paragraph_starting_with(
        root, "○ 추천기관", f"○ 추천기관 또는 의원 : {rec_dept} {rec_name} 의원"
    )
    _replace_paragraph_starting_with(root, "○ 추천대상자", f"○ 추천대상자({len(recipients)}명)")
    _replace_paragraph_starting_with(root, "추천(의뢰)자", _recommender_line(rec_full_base, rec_name))

    # --- 추천개요 표 (tbl#0, 14셀: 헤더 0~6, 데이터 7~13) ---
    _fill_report_overview_row(tables[0].findall(".//hp:tc", NS), recipients[0], award_date_short)
    if len(recipients) > 1:
        _duplicate_overview_rows(tables[0], recipients, award_date_short)

    # --- 첫 대상자: 본문표(tbl#1) + 경력표(tbl#2) + 현지조사(root paragraph) ---
    _fill_merit_main_table(
        tables[1].findall(".//hp:tc", NS), recipients[0], award_grade, signoff, investigator
    )
    _fill_career_table(tables[2].findall(".//hp:tc", NS), recipients[0])
    _fill_survey_paragraphs(root, recipients[0], investigator)
    # 추천사유 (페이지1) — 첫 대상자.
    # 템플릿 placeholder는 "○ 추천사유" 단락 다음의 "-" 단락(root 직속)이다.
    # 그 "-" 단락을 "- {추천사유}" 로 채운다. (과거 "- 상기인은" prefix 매칭은
    # 새 양식의 placeholder가 "-"뿐이라 실패했음.)
    mc0 = recipients[0].merit_content
    reason0 = (mc0.recommendation_reason if mc0 else "") or ""
    if reason0:
        _fill_paragraph_after(root, "○ 추천사유", f"- {reason0}")
    # 페이지1 확인일
    _replace_paragraph_starting_with(root, "2026.   .", confirm_date)

    # 묶음 끝 빈 paragraph 제거 → 대상자마다 빈 페이지가 끼는 것 방지
    _strip_trailing_empty_paragraphs(root)

    # --- 다중 대상자: 공적조서~현지조사 묶음 복제 ---
    # 새 양식 root 자식: 0~26 페이지1, 29~ 공적조서/경력/현지조사. 묶음 = 29 ~ 끝.
    if len(recipients) > 1:
        children = list(root)
        # 서식2(공적조서) 시작 paragraph 인덱스 찾기
        b_start = _find_child_index_startswith(children, "[서식2")
        if b_start is None:
            b_start = 29
        bundle = children[b_start:]
        for r in recipients[1:]:
            new_bundle = [copy.deepcopy(el) for el in bundle]
            # 묶음 첫 요소에 pageBreak로 새 대상자는 새 페이지에서 시작
            if etree.QName(new_bundle[0].tag).localname == "p":
                new_bundle[0].set("pageBreak", "1")
            _fill_report_bundle_for_recipient(new_bundle, case, r, award_grade, signoff, investigator)
            for el in new_bundle:
                root.append(el)

    # --- 날짜(본문표 위기록=작성일, 현지조사=도장일) ---
    _fill_report_dates(root, body_date, survey_date)
    # --- 경력표(공적사항 포함, 32셀)은 셀이 페이지를 넘어가도록 pageBreak=CELL ---
    # 또한 공적사항 셀(마지막 행)이 짧아도 페이지 한 쪽을 채우도록 최소 높이를 늘린다.
    # 경력표가 채울 수 있는 한컴 한글 실제 가용 본문 높이(표 상단~본문 하단).
    # hwp-mcp 렌더 실측값 ≈ 68598 HWPUNIT. 여백 계산값(84186-5668-4252=74266)보다
    # 약 5668 작은 것은 표 시작 오프셋·셀 여백 때문이다. 이 실측값을 채움 기준으로 쓴다.
    PAGE_BODY_HEIGHT = 68598

    def _row_height(row):
        hs = [
            int(cl.find("hp:cellSz", NS).get("height"))
            for cl in row.findall("hp:tc", NS)
            if cl.find("hp:cellSz", NS) is not None
        ]
        return max(hs) if hs else 0

    # === (29)공적사항: 한 표 유지 + '글자처럼 취급' 해제 ===
    # 표를 글자처럼 취급(treatAsChar=1)하면 인라인 객체가 되어 셀 높이가 내용을
    # 따라가지 못하고 페이지 분할이 막혀 내용이 셀 밖으로 넘친다. treatAsChar=0 으로
    # 바꾸면 표가 본문 객체가 되어 한글이 셀 높이를 내용에 맞춰 늘리고 페이지를 분할한다.
    #  - 짧은 공적사항: 셀 최소 높이를 페이지 잔여로 설정해 페이지를 채운다.
    #  - 긴 공적사항: 셀이 내용 따라 늘어 pageBreak=CELL 로 다음 페이지로 이어지며,
    #    repeatHeader + (29)제목행 header=1 로 (29)제목을 반복한다.
    SAFETY = 1500        # 렌더 엔진 간 미세 오차 버퍼(가용높이보다 약간 작게, 약 20px)
    for tbl in root.findall(".//hp:tbl", NS):
        if len(tbl.findall(".//hp:tc", NS)) != 32:
            continue
        # 주요경력 표는 공적조서 본문과 분리해 새 페이지에서 시작
        _tp = tbl.getparent()
        while _tp is not None and etree.QName(_tp.tag).localname != "p":
            _tp = _tp.getparent()
        if _tp is not None:
            _tp.set("pageBreak", "1")
        tbl.set("pageBreak", "CELL")
        pos = tbl.find("hp:pos", NS)
        if pos is not None:
            pos.set("treatAsChar", "0")  # 글자처럼 취급 해제 → 셀 높이 자동·페이지 분할
        rows = tbl.findall("hp:tr", NS)
        if len(rows) < 2:
            continue
        for tc in rows[-2].findall("hp:tc", NS):
            tc.set("header", "1")  # (29)제목행을 표 제목줄로 → 페이지마다 반복
        other = sum(_row_height(r) for r in rows[:-1])
        fill = max(0, PAGE_BODY_HEIGHT - other - SAFETY)
        for cl in rows[-1].findall("hp:tc", NS):
            sz = cl.find("hp:cellSz", NS)
            if sz is not None:
                sz.set("height", str(max(int(sz.get("height") or 0), fill)))
    # --- 현지조사 확인서([서식3])는 새 페이지에서 시작 ---
    P_TAG = "{http://www.hancom.co.kr/hwpml/2011/paragraph}p"
    for p in root.iter(P_TAG):
        ts = p.findall(".//hp:t", NS)
        if ts and "".join((t.text or "") for t in ts).strip().startswith("[서식3"):
            p.set("pageBreak", "1")
    # --- 새 페이지로 시작하는 [서식2]/[서식3] 앞의 빈 문단 제거 ---
    #     한글에서는 빈 문단이 직전 페이지를 넘겨 빈 페이지를 만든다(soffice는 무시).
    #     pageBreak로 어차피 새 페이지가 시작되므로 그 앞 빈 문단은 불필요하다.
    def _para_text(el):
        return "".join((t.text or "") for t in el.findall(".//hp:t", NS))

    for ch in list(root):
        if etree.QName(ch.tag).localname != "p":
            continue
        t = _para_text(ch).strip()
        if t.startswith("[서식2") or t.startswith("[서식3"):
            prev = ch.getprevious()
            while (
                prev is not None
                and etree.QName(prev.tag).localname == "p"
                and _para_text(prev).strip() == ""
                and not prev.findall(".//hp:tbl", NS)
            ):
                rm = prev
                prev = prev.getprevious()
                root.remove(rm)
    # --- 현지조사: 공적사항(내용과 일치여부)~날짜 사이 큰 빈 줄 2개 제거 ---
    #     이 사이의 빈 줄이 많아 한글에서 현지조사확인서가 1페이지를 넘긴다(soffice는 정상).
    #     항목 사이 작은 빈 줄(간격)은 두고 큰 빈 줄 2개만 줄여 한 페이지에 맞춘다.
    def _seg_height(el):
        return sum(int(s.get("vertsize", "0")) for s in el.findall(".//hp:lineseg", NS))

    for ch in list(root):
        if etree.QName(ch.tag).localname != "p":
            continue
        if not _para_text(ch).strip().startswith("○ 공적사항(내용과 일치여부)"):
            continue
        removed = 0
        nxt = ch.getnext()
        while nxt is not None and removed < 2:
            if etree.QName(nxt.tag).localname != "p":
                break
            if _para_text(nxt).strip() != "" or nxt.findall(".//hp:tbl", NS):
                break  # 연속된 빈 줄 구간의 끝(날짜 등)
            after = nxt.getnext()
            if _seg_height(nxt) >= 1000:  # 큰 빈 줄만 제거(작은 간격은 보존)
                root.remove(nxt)
                removed += 1
            nxt = after
    # --- 현지조사확인서 한 장 구성: 길면 빈 줄을 줄여 한 페이지에 맞춤(명세14) ---
    _fit_survey_to_one_page(root)
    # --- 정렬 ---
    _apply_paragraph_alignments(root)

    # --- (11)대외직명 각주 삭제 (표와 겹쳐 보임 — PDF미리보기/HWPX 모두 반영) ---
    _remove_external_title_footnote(root)

    # --- (29)공적사항 셀 글자 13pt 고정용 charPr id 수집 ---
    merit_detail_charprs = set()
    for _tbl in root.findall(".//hp:tbl", NS):
        _tcs = _tbl.findall("hp:tr/hp:tc", NS) or _tbl.findall(".//hp:tc", NS)
        if len(_tcs) == 32:
            for _run in _tcs[31].findall(".//hp:run", NS):
                _cid = _run.get("charPrIDRef")
                if _cid:
                    merit_detail_charprs.add(_cid)
            # 13pt로 키운 만큼 양식의 줄 위치 캐시(linesegarray, 작은 글자 기준)를 제거해
            # 렌더 엔진이 13pt 기준으로 줄을 다시 계산하게 한다(글자 겹침 방지)
            for _lsa in _tcs[31].findall(".//hp:linesegarray", NS):
                _lsa.getparent().remove(_lsa)

    # --- 저장 ---
    new_section = etree.tostring(
        root, xml_declaration=True, encoding="UTF-8", standalone=True
    )
    first_name = recipients[0].recipient_name or "대상자"
    suffix = f" 외 {len(recipients)-1}인" if len(recipients) > 1 else ""
    out_name = f"02. 공적조서({rec_name or '추천자'}_의원_{first_name}{suffix}).hwpx"
    out_path = GENERATED_DIR / out_name
    body_para_ids = _collect_body_para_ids(root)
    _save_hwpx(
        REPORT_TEMPLATE_PATH,
        out_path,
        new_section,
        normalize_fonts=True,
        spacing_para_ids=body_para_ids,
        apply_report_layout=False,
        report_fix=True,
        merit_detail_charprs=merit_detail_charprs,
    )
    # [하네스] 명세 불변 규칙 검증 — 위반 시 생성 중단
    _assert_merit_report_invariants(out_path, recipients, award_grade, investigator)
    return out_path


def _recommender_line(rec_full_base: str, rec_name: str) -> str:
    """페이지1 추천(의뢰)자 줄 텍스트."""
    if rec_full_base:
        return f"추천(의뢰)자 : {rec_full_base}   {rec_name}    (인)"
    return f"추천(의뢰)자 : {rec_name}    (인)"


def _assert_merit_report_invariants(out_path, recipients, award_grade, inv) -> None:
    """[하네스] 공적조서 HWPX가 명세 불변 규칙을 지키는지 생성 직후 검증.
    위반 시 RuntimeError로 생성을 중단해, 잘못된 문서가 만들어지지 않게 한다.

    검증:
    - 폰트: 본문 글꼴이 전부 경기천년체(경기천년바탕/제목)
    - 작성자 입력: (1)성명·(6)주소·(7)직업·(8)소속이 해당 셀에 정확히 들어감
    - 조사자: (17)소속=설정 부서명, (20)성명=조사자 이름
    """
    import re

    with zipfile.ZipFile(out_path) as z:
        header = z.read("Contents/header.xml").decode("utf-8")
        root = etree.fromstring(z.read("Contents/section0.xml"))
    # 1) 폰트 하네스 — 주 폰트(font face)가 전부 경기천년인지 검증.
    #    substFont(대체 글꼴=함초롬돋움/명조)는 한컴 폴백용이라 검사에서 제외한다.
    HH = "{http://www.hancom.co.kr/hwpml/2011/head}"
    hroot = etree.fromstring(header.encode("utf-8"))
    primary_faces = {
        f.get("face") for f in hroot.iter(HH + "font") if f.get("face")
    }
    bad = sorted(f for f in primary_faces if "경기천년" not in f)
    if bad:
        raise RuntimeError(f"[하네스] 비경기천년체 폰트 발견: {bad}")
    # substFont(대체 글꼴)가 경기천년으로 오염되면 한컴에서 경기천년 미표시 폴백이
    # 재발하므로, 대체 글꼴은 반드시 경기천년이 아니어야 한다(한컴 기본 글꼴 유지).
    polluted = sorted(
        s.get("face")
        for s in hroot.iter(HH + "substFont")
        if s.get("face") and "경기천년" in s.get("face")
    )
    if polluted:
        raise RuntimeError(f"[하네스] substFont가 경기천년으로 오염됨(폴백 깨짐): {polluted}")
    # 2) 본문표(44셀)에서 첫 대상자 입력 검증
    body = next(
        (t for t in root.findall(".//hp:tbl", NS) if len(t.findall(".//hp:tc", NS)) == 44),
        None,
    )
    if body is None:
        raise RuntimeError("[하네스] 공적조서 본문표(44셀)를 찾지 못함")
    cells = body.findall("hp:tr/hp:tc", NS) or body.findall(".//hp:tc", NS)

    def _ct(i):
        return "".join(t.text or "" for t in cells[i].findall(".//hp:t", NS)).strip()

    r0 = recipients[0]
    checks = [
        (1, r0.recipient_name, "(1)성명"),
        (12, r0.address, "(6)주소"),
        (14, r0.occupation, "(7)직업"),
        (16, r0.organization_name, "(8)소속"),
    ]
    if inv:
        checks.append((35, inv.get("department"), "(17)조사자 소속"))
        if inv.get("name"):
            checks.append((41, inv.get("name"), "(20)조사자 성명"))
    for i, expected, label in checks:
        exp = (expected or "").strip()
        if exp and exp not in _ct(i):
            raise RuntimeError(
                f"[하네스] {label} 입력 누락/불일치: 기대 '{exp}' 실제 '{_ct(i)}'"
            )
    # 3) (29)공적사항 셀 전체 글자 13pt 고정 검증
    HH = "{http://www.hancom.co.kr/hwpml/2011/head}"
    hdr_root = etree.fromstring(header.encode("utf-8"))
    career = next(
        (t for t in root.findall(".//hp:tbl", NS) if len(t.findall(".//hp:tc", NS)) == 32),
        None,
    )
    if career is not None:
        ccells = career.findall("hp:tr/hp:tc", NS) or career.findall(".//hp:tc", NS)
        detail_ids = {
            r.get("charPrIDRef")
            for r in ccells[31].findall(".//hp:run", NS)
            if r.get("charPrIDRef")
        }
        for cp in hdr_root.iter(HH + "charPr"):
            if cp.get("id") in detail_ids and cp.get("height") != "1300":
                raise RuntimeError(
                    f"[하네스] (29)공적사항 13pt 위반: charPr {cp.get('id')} "
                    f"height={cp.get('height')}"
                )
    # 4) 현지조사확인서 인적사항 검증 (명세 12) — 작성자 입력 그대로
    P_TAG = "{http://www.hancom.co.kr/hwpml/2011/paragraph}p"

    def _para_nospace_start(prefix_ns):
        for p in root.iter(P_TAG):
            txt = "".join(t.text or "" for t in p.findall(".//hp:t", NS))
            if txt.replace(" ", "").startswith(prefix_ns):
                return txt
        return ""

    for prefix_ns, expected, label in [
        ("○성명", r0.recipient_name, "현지조사 성명"),
        ("○직업", r0.occupation, "현지조사 직업"),
        ("○주소", r0.address, "현지조사 주소"),
    ]:
        exp = (expected or "").strip()
        if exp and exp not in _para_nospace_start(prefix_ns):
            raise RuntimeError(f"[하네스] {label} 입력 누락: 기대 '{exp}'")


def _remove_external_title_footnote(root) -> None:
    """(11)대외직명 각주('* 대외직명란에는 … 표창장에 표시할 내용')를 제거.
    표와 겹쳐 보여 삭제 요청됨. 표 셀의 '(11)대외직명*' 라벨은 보존한다."""
    keys = ("대외직명란에는", "운영지침(인혁처예규)", "기관별 대외직명을 표시")
    # 1) 표를 포함하지 않은 순수 각주 문단 제거
    for p in list(root):
        if etree.QName(p.tag).localname != "p":
            continue
        if p.findall(".//hp:tbl", NS):
            continue
        txt = "".join(t.text or "" for t in p.findall(".//hp:t", NS))
        if any(k in txt for k in keys):
            root.remove(p)
    # 2) 표 문단에 섞인 각주 텍스트는 해당 hp:t만 비움(표/라벨 구조는 유지)
    for t in root.iter(f"{{{NS['hp']}}}t"):
        if t.text and any(k in t.text for k in keys):
            t.text = ""


def _fill_report_overview_row(cells, r, award_date_short: str) -> None:
    """02 공적조서 페이지1 추천개요 표(tbl#0) 데이터 행(셀 7~13):
    이름/생년월일/소속/직위/공적분야/공적기간/표창일."""
    if len(cells) < 14:
        return
    _set_first_text(cells[7], r.recipient_name or "")
    _set_first_text(cells[8], _fmt_birth_dot_short(r.birth_date))
    _set_first_text(cells[9], r.organization_name or "")
    _set_first_text(cells[10], r.recipient_position_title or "")
    _set_first_text(cells[11], r.merit_category or "")
    _set_first_text(cells[12], (r.merit_period or "").strip().replace(" ", ""))
    _set_first_text(cells[13], award_date_short)


def _duplicate_overview_rows(t0, recipients, award_date_short: str) -> None:
    """추천개요 표에 2번째 대상자부터 데이터 행 복제 추가 (헤더+데이터 2행 구조)."""
    rows = t0.findall("hp:tr", NS)
    if len(rows) < 2:
        return
    data_row = rows[1]  # 첫 대상자 행
    for i, r in enumerate(recipients[1:], start=2):
        new_row = copy.deepcopy(data_row)
        for c in new_row.findall("hp:tc", NS):
            addr = c.find("hp:cellAddr", NS)
            if addr is not None:
                addr.set("rowAddr", str(i))
        nc = new_row.findall("hp:tc", NS)
        _set_first_text(nc[0], r.recipient_name or "")
        _set_first_text(nc[1], _fmt_birth_dot_short(r.birth_date))
        _set_first_text(nc[2], r.organization_name or "")
        _set_first_text(nc[3], r.recipient_position_title or "")
        _set_first_text(nc[4], r.merit_category or "")
        _set_first_text(nc[5], (r.merit_period or "").strip().replace(" ", ""))
        _set_first_text(nc[6], award_date_short)
        data_row.addnext(new_row)
    t0.set("rowCnt", str(1 + len(recipients)))


def _fill_merit_main_table(c, r, award_grade: str, signoff: str, inv: dict = None) -> None:
    """본문표(tbl#1, 44셀) 데이터 셀 채우기 (성별 셀 8 포함)."""
    if len(c) < 44:
        return
    mc = r.merit_content
    _set_first_text(c[1], r.recipient_name or "")
    _set_first_text(c[2], f"(한 자) {r.chinese_name}" if r.chinese_name else "(한 자) ")
    _set_first_text(c[4], _fmt_birth_dot(r.birth_date))
    _set_first_text(c[6], "-")  # 군번
    _set_first_text(c[8], getattr(r, "gender", None) or "")  # 성별
    _set_first_text(c[10], "-")  # 국적
    _set_long_text(c[12], r.address or "")
    _set_first_text(c[14], r.occupation or "")
    _set_first_text(c[16], r.organization_name or "")
    _set_first_text(c[18], r.rank_grade or "")
    _set_first_text(c[20], r.recipient_position_title or "")
    _set_first_text(c[22], r.external_title or "")
    _set_first_text(c[24], (r.merit_period or "").strip())
    _set_first_text(c[26], r.merit_category or "")
    # (7)직업·(8)소속·(9)직급·(10)직위·(11)대외직명 값 셀 → 가운데 정렬
    # ((2)생년월일·(5)성별과 동일한 center paraPr 25 적용)
    for ci in (14, 16, 18, 20, 22):
        for p in c[ci].findall(".//hp:p", NS):
            p.set("paraPrIDRef", _ALIGN_CENTER_PARA)
    _set_long_text(c[28], (mc.merit_short_summary if mc else "") or "")
    _set_first_text(c[30], award_grade)  # 추천훈격
    # c[32] 추천순위(1순위) = 양식 sample 유지
    # 조사자 c[35]소속/c[37]직위/c[39]직급/c[41]성명 — 설정값(inv) 있으면 채움
    if inv:
        _set_first_text(c[35], inv.get("department") or "")
        _set_first_text(c[37], inv.get("position") or "")
        _set_first_text(c[39], inv.get("rank") or "")
        name = inv.get("name") or ""
        _set_first_text(c[41], f"{name} (인)" if name else "")
        # 양식 조사자 셀에 빈 문단이 있어 값 뒤에 빈 줄(엔터)이 남는 것을 정리
        for ci in (35, 37, 39, 41):
            _collapse_to_first_paragraph(c[ci])
    _set_first_text(c[43], signoff)  # 추천관


def _set_text_expand(cell, text: str, chars_per_line: int = 9) -> None:
    """셀에 텍스트를 넣되, 내용이 길면 cellSz height를 늘려 줄바꿈된 줄이 잘리지 않게 한다.
    (경력·과거표창 이력 셀은 height가 1줄로 고정돼 있어 긴 내용이 잘림)"""
    _set_long_text(cell, text)
    if not text:
        return
    sz = cell.find("hp:cellSz", NS)
    if sz is None:
        return
    lines = max(1, (len(text) + chars_per_line - 1) // chars_per_line)
    cur = int(sz.get("height") or 0)
    sz.set("height", str(max(cur, lines * 1500)))


def _fill_merit_detail_cell(cell, text: str) -> None:
    """(29) 공적사항 셀 — 내용 길이에 맞춰 cellSz height를 늘린다.
    셀이 한 페이지를 넘으면 pageBreak=CELL과 함께 다음 페이지로 분할되도록 충분한 높이 확보."""
    _set_long_text(cell, text)
    sz = cell.find("hp:cellSz", NS)
    if sz is None:
        return
    cur = int(sz.get("height") or 0)
    if not text:
        return
    # 셀 너비가 넓어 약 33자/줄. 줄당 height ≈ 1400 HWPUNIT(실측 기준).
    lines = sum(max(1, (len(seg) + 32) // 33) for seg in text.split("\n"))
    needed = lines * 1400 + 1000
    sz.set("height", str(max(cur, needed)))


def _fill_career_table(c, r) -> None:
    """경력표(tbl#2, 32셀): 경력 6슬롯 + 과거표창 4슬롯 + 공적사항(31)."""
    if len(c) < 32:
        return
    mc = r.merit_content
    careers = list(r.career_records or [])
    for i, (di, ti) in enumerate([(5, 6), (7, 8), (9, 10), (11, 12), (13, 14), (15, 16)]):
        if i < len(careers):
            rec = careers[i]
            _set_first_text(c[di], str(rec.record_date) if rec.record_date else "")
            _set_text_expand(c[ti], rec.description or "")
        else:
            _set_first_text(c[di], "")
            _set_long_text(c[ti], "")
    awards = list(r.previous_awards or [])
    for i, (di, ti) in enumerate([(22, 23), (24, 25), (26, 27), (28, 29)]):
        if i < len(awards):
            rec = awards[i]
            _set_first_text(c[di], str(rec.award_date) if rec.award_date else "")
            _set_text_expand(c[ti], rec.description or "")
        else:
            _set_first_text(c[di], "")
            _set_long_text(c[ti], "")
    # (29) 공적사항 — 내용이 길면 셀 높이를 늘려(양식 기본 높이 이상) 페이지를 넘기게 한다.
    _fill_merit_detail_cell(c[31], (mc.full_merit_text if mc else "") or "")


def _survey_body(user_val: str, default_with_label: str) -> str:
    """현지조사 확인내용 본문 추출. 사용자 입력이 있으면 그대로, 없으면 default에서
    레이블(' : ' 앞)을 떼고 본문만 반환."""
    v = (user_val or "").strip()
    if v:
        return v
    return default_with_label.split(" : ", 1)[1].strip() if " : " in default_with_label else default_with_label.strip()


def _fill_survey_paragraphs(scope, r, inv: dict = None) -> None:
    """현지조사 인적사항/확인내용 paragraph 채우기 (scope = root 또는 element list).
    inv(설정 조사자)가 있으면 조사자 소속/직급/성명도 채운다."""
    mc = r.merit_content
    _set_para_in_scope(scope, "○ 성    명", f"○ 성    명 : {r.recipient_name or ''}")
    _set_para_in_scope(scope, "○ 생년월일", f"○ 생년월일 : {_fmt_birth_dot(r.birth_date)}")
    _set_para_in_scope(scope, "○ 직    업", f"○ 직    업 : {r.occupation or ''}")
    _set_para_in_scope(scope, "○ 주    소", f"○ 주    소 : {r.address or ''}")
    char_body = _survey_body(mc.character_assessment if mc else "", _SURVEY_DEFAULT_CHARACTER)
    rep_body = _survey_body(mc.local_reputation if mc else "", _local_reputation_default(r))
    cons_body = _survey_body(mc.merit_consistency if mc else "", _SURVEY_DEFAULT_CONSISTENCY)
    _set_para_in_scope(scope, "○ 성    품", f"○ 성    품 : {char_body}")
    _set_para_in_scope(scope, "○ 지역여론", f"○ 지역여론(公私生活 등) : {rep_body}")
    _set_para_in_scope(scope, "○ 공적사항(내용과 일치여부)", f"○ 공적사항(내용과 일치여부) : {cons_body}")
    # 현지조사자 소속(부서명)/직급(직위)/성명 — 설정값 있으면 채움
    if inv:
        dept_short = inv.get("dept_short") or inv.get("department") or ""
        _set_para_in_scope(scope, "소  속", f"소  속 : {dept_short}")
        _set_para_in_scope(scope, "직  급", f"직  급 : {inv.get('position') or ''}")
        name = inv.get("name") or ""
        _set_para_in_scope(scope, "성  명", f"성  명 : {name} (인)" if name else "성  명 : ")


def _iter_paragraphs(scope):
    """scope가 root element면 root.iter, element list면 각 element의 iter를 순회."""
    P = "{http://www.hancom.co.kr/hwpml/2011/paragraph}p"
    if isinstance(scope, (list, tuple)):
        for el in scope:
            yield from el.iter(P)
    else:
        yield from scope.iter(P)


def _set_para_in_scope(scope, prefix: str, new_text: str) -> bool:
    """scope(root 또는 element list) 안에서 prefix로 시작하는 paragraph 첫 매치 교체."""
    for p in _iter_paragraphs(scope):
        ts = p.findall(".//hp:t", NS)
        if not ts:
            continue
        if "".join((t.text or "") for t in ts).strip().startswith(prefix):
            ts[0].text = new_text
            for t in ts[1:]:
                t.text = ""
            return True
    return False


def _find_child_index_startswith(children, prefix: str):
    P = "{http://www.hancom.co.kr/hwpml/2011/paragraph}p"
    for i, el in enumerate(children):
        if etree.QName(el.tag).localname != "p":
            continue
        ts = el.findall(".//hp:t", NS)
        if "".join((t.text or "") for t in ts).strip().startswith(prefix):
            return i
    return None


def _strip_trailing_empty_paragraphs(root) -> None:
    """root 끝의 연속된 빈 paragraph를 제거 (대상자 묶음 끝 빈 페이지 방지)."""
    P = "{http://www.hancom.co.kr/hwpml/2011/paragraph}p"
    for el in reversed(list(root)):
        if etree.QName(el.tag).localname != "p":
            break
        s = "".join((t.text or "") for t in el.findall(".//hp:t", NS)).strip()
        if s == "":
            root.remove(el)
        else:
            break


def _fill_report_bundle_for_recipient(
    bundle_elements, case: AwardCase, recipient: Recipient, award_grade: str,
    signoff: str, inv: dict = None
) -> None:
    """공적조서~현지조사 묶음(element list)을 recipient 데이터로 채움(다중 대상자용).
    묶음 구조: tables[0]=본문표(44셀), tables[1]=경력표(32셀). 현지조사는 paragraph.
    """
    tables = []
    for el in bundle_elements:
        tables.extend(el.findall(".//hp:tbl", NS))
    if len(tables) >= 1:
        _fill_merit_main_table(tables[0].findall(".//hp:tc", NS), recipient, award_grade, signoff, inv)
    if len(tables) >= 2:
        _fill_career_table(tables[1].findall(".//hp:tc", NS), recipient)
    _fill_survey_paragraphs(bundle_elements, recipient, inv)


def _fill_report_dates(scope, body_date: str, survey_date: str) -> None:
    """날짜 paragraph 채움.
    - 현지조사 확인서 날짜(양식 sample '2026년  0월  00일') → survey_date(도장일)
    - 본문표 위기록 확인 날짜(양식 sample '   년   월   일') → body_date(도장일, 추천관 (인))"""
    for p in _iter_paragraphs(scope):
        ts = p.findall(".//hp:t", NS)
        if not ts:
            continue
        joined = "".join((t.text or "") for t in ts).strip()
        if joined.startswith("2026년"):
            ts[0].text = survey_date
            for t in ts[1:]:
                t.text = ""
        elif joined.startswith("년") and "월" in joined and "일" in joined:
            ts[0].text = body_date
            for t in ts[1:]:
                t.text = ""


def _fit_survey_to_one_page(root) -> None:
    """현지조사사실확인서([서식3])가 대상자당 한 페이지를 넘기지 않도록, 내용이 길면
    빈 단락을 우선순위대로 제거해 한 페이지에 맞춘다(명세14).

    - 짧은/기본 내용은 빈 줄을 그대로 두어 양식을 보존한다(넘칠 때만 작동).
    - 내용 높이는 hwp-mcp(한컴 렌더) 실측 상수로 추정한다: 내용 1줄≈32px,
      빈줄 segH<1000≈12.8px·≥1000≈43.2px, 한 페이지 본문 가용≈900px(표 상단 113px~하단 1028px).
    - 줄당 글자수(가중폭, 한글=1.0/그외=0.5) CPL=28은 실측 행수와 일치하도록 보정한 값.
    - 빈줄 제거 우선순위: 큰 빈줄(≥1000) 중 뒤쪽(날짜~조사자) 먼저 → 앞쪽(섹션) →
      작은 빈줄(600) 중 뒤쪽(확인내용) → 앞쪽(인적사항). 필요한 만큼만 제거한다.
    - 빈줄을 다 줄여도 못 맞추면(내용이 물리적으로 너무 긺) 경고만 남기고 진행한다.
    """
    import unicodedata

    P = "{http://www.hancom.co.kr/hwpml/2011/paragraph}p"
    ROW_PX = 32.0
    USABLE_PX = 900.0
    BIG_PX, SMALL_PX = 43.2, 12.8
    CPL = 28.0  # 줄당 글자수(가중폭 기준)

    def _wlen(s: str) -> float:
        return sum(
            1.0 if unicodedata.east_asian_width(c) in ("W", "F") else 0.5 for c in s
        )

    def _ptext(p) -> str:
        return "".join((t.text or "") for t in p.findall(".//hp:t", NS))

    def _rows(text: str) -> int:
        # 앞뒤 공백(라벨 줄의 들여쓰기 등)은 줄바꿈에 거의 영향 없으므로 제외하고 센다.
        n = 0
        for seg in text.split("\n"):
            n += max(1, -(-int(_wlen(seg.strip())) // int(CPL)))
        return n or 1

    def _segh(p) -> int:
        return sum(int(s.get("vertsize", "0")) for s in p.findall(".//hp:lineseg", NS))

    # root(sec) 직속 단락만 대상(현지조사는 표 밖 본문 단락).
    top = [c for c in root if etree.QName(c.tag).localname == "p"]
    # [서식3] 시작 인덱스들
    starts = [i for i, p in enumerate(top) if _ptext(p).strip().startswith("[서식3")]
    for si in starts:
        # 블록 끝 = 조사자 '성  명' 단락(없으면 다음 [서식3]/끝)
        ei = len(top)
        for j in range(si + 1, len(top)):
            t = _ptext(top[j]).strip()
            if t.startswith("성  명"):
                ei = j + 1
                break
            if t.startswith("[서식3"):
                ei = j
                break
        block = top[si:ei]
        content_rows = sum(_rows(_ptext(p)) for p in block if _ptext(p).strip())
        blanks = [p for p in block if not _ptext(p).strip()]
        blank_px = sum(BIG_PX if _segh(p) >= 1000 else SMALL_PX for p in blanks)

        def _cap(bpx: float) -> int:
            return int((USABLE_PX - bpx) // ROW_PX)

        if _cap(blank_px) >= content_rows:
            continue  # 넘치지 않음 → 양식 그대로 둠
        # 제거 우선순위: 큰빈줄(뒤→앞) → 작은빈줄(뒤→앞)
        big = [p for p in blanks if _segh(p) >= 1000][::-1]
        small = [p for p in blanks if _segh(p) < 1000][::-1]
        for p in big + small:
            if _cap(blank_px) >= content_rows:
                break
            blank_px -= BIG_PX if _segh(p) >= 1000 else SMALL_PX
            p.getparent().remove(p)
        if _cap(blank_px) < content_rows:
            print(
                "[경고] 현지조사 확인내용이 너무 길어 한 페이지에 담지 못할 수 있습니다 "
                f"(추정 {content_rows}줄). 성품/지역여론/공적사항 입력을 줄여 주세요."
            )


# 위기록 가운데정렬용. 새 양식 header의 기존 CENTER paraPr(25)를 재사용한다.
# (새 양식 header에 paraPr를 새로 append하면 H2Orestart 변환이 깨지므로 기존 ID 참조.)
_ALIGN_CENTER_PARA = "25"


def _apply_paragraph_alignments(root) -> None:
    """공적조서 본문표 안의 정렬 + 현지조사자 소속/직급/성명 정렬을 적용.

    - "위 기록이 틀림없음을 확인합니다." → 오른쪽 정렬(paraPr 73)
    - 그 아래 본문표 날짜("2026년 …월 …일") → 가운데 정렬(paraPr 74)
    - 소속/직급/성명 → 앞 공백 제거(paraPr 59가 왼쪽+들여쓰기로 세로 정렬 담당)
    """
    P = "{http://www.hancom.co.kr/hwpml/2011/paragraph}p"
    for p in root.iter(P):
        ts = p.findall(".//hp:t", NS)
        if not ts:
            continue
        joined = "".join((t.text or "") for t in ts)
        s = joined.strip()
        if not s:
            continue
        if s.startswith("위 기록이 틀림") and _para_in_table(p):
            # 본문표 "위 기록이 틀림없음을 확인합니다." 가운데 정렬
            p.set("paraPrIDRef", _ALIGN_CENTER_PARA)
        elif (
            len(s) >= 5
            and s[:4].isdigit()
            and s[4] == "년"
            and "월" in s
            and "일" in s
            and _para_in_table(p)
        ):
            # 본문표 위기록 밑 날짜(도장일) → 가운데 정렬. 연도 무관 매칭(도장일이
            # 2026년이 아닐 수도 있으므로). 현지조사 날짜는 표 밖이라 _para_in_table로 제외.
            p.set("paraPrIDRef", _ALIGN_CENTER_PARA)
        elif s.startswith("소  속") or s.startswith("직  급") or s.startswith("성  명"):
            # 소/직/성 들여쓰기 — 양식 원본과 동일하게 일반 공백 35개로 세로 정렬.
            # (이전엔 soffice 조판 보정용 전각 공백 18~19개를 썼으나, 미리보기를 rhwp로
            #  바꾸면서 그 보정이 원본보다 왼쪽으로 위치를 틀어 놓았다. 양식 원본의 일반
            #  공백 들여쓰기로 되돌려 rhwp 미리보기·한글 다운로드본 모두 원본과 같게 한다.)
            ts[0].text = (" " * 35) + s
            for t in ts[1:]:
                t.text = ""
        # (현지조사자)는 양식 원본(맨 왼쪽, paraPr 58 LEFT) 그대로 둔다.


def _add_blank_lines_before(scope, prefix: str, count: int = 2) -> None:
    """scope 안에서 prefix로 시작하는 모든 paragraph 앞에 빈 paragraph를 count개 삽입.

    빈 paragraph는 대상 paragraph를 deepcopy 후 텍스트를 비워 만든다(스타일 유지).
    """
    P = "{http://www.hancom.co.kr/hwpml/2011/paragraph}p"
    targets = []
    for p in scope.iter(P):
        ts = p.findall(".//hp:t", NS)
        joined = "".join((t.text or "") for t in ts).strip()
        if joined.startswith(prefix):
            targets.append(p)
    for p in targets:
        for _ in range(count):
            blank = copy.deepcopy(p)
            for t in blank.findall(".//hp:t", NS):
                t.text = ""
            p.addprevious(blank)


def _set_long_text(cell, text: str) -> None:
    """셀 안의 모든 hp:t 중 첫 번째에 전체 텍스트, 나머지는 빈 문자열."""
    _set_first_text(cell, text)


def _replace_paragraph_starting_with(root, prefix: str, new_text: str, keep_lead: bool = True) -> bool:
    """paragraph의 합쳐진 텍스트가 (앞 공백 무시) prefix로 시작하면 new_text로 교체.
    keep_lead=True면 기존 앞 들여쓰기(공백)를 보존('  ○ …' 항목 대응),
    keep_lead=False면 앞 공백 없이 — 추천사유처럼 줄바꿈 시 모든 줄을 같은 세로선에 정렬."""
    for p in root.iter("{http://www.hancom.co.kr/hwpml/2011/paragraph}p"):
        ts = p.findall(".//hp:t", NS)
        if not ts:
            continue
        joined = "".join((t.text or "") for t in ts)
        if joined.strip().startswith(prefix):
            lead = joined[: len(joined) - len(joined.lstrip())] if keep_lead else ""
            ts[0].text = lead + new_text
            for t in ts[1:]:
                t.text = ""
            return True
    return False


def _fill_paragraph_after(root, anchor_prefix: str, new_text: str) -> bool:
    """anchor_prefix로 시작하는 단락 다음의 첫 '비어있지 않은' 단락을 new_text로 채운다.
    (예: '○ 추천사유' 다음 '-' placeholder 단락을 추천사유 본문으로 채움.)
    anchor와 placeholder 사이에 빈 단락이 끼어 있어도 건너뛰어 placeholder를 채운다."""
    P = "{http://www.hancom.co.kr/hwpml/2011/paragraph}p"
    paras = list(root.iter(P))
    for i, p in enumerate(paras):
        joined = "".join((t.text or "") for t in p.findall(".//hp:t", NS))
        if joined.strip().startswith(anchor_prefix):
            for nxt in paras[i + 1 :]:
                nts = nxt.findall(".//hp:t", NS)
                if not nts:
                    continue
                if "".join((t.text or "") for t in nts).strip() == "":
                    continue  # 빈 단락은 건너뜀
                nts[0].text = new_text
                for t in nts[1:]:
                    t.text = ""
                return True
    return False


# 현지조사 확인내용 default 텍스트 (사용자 요청 — MeritContent 값이 있으면 그것을 우선 사용)
_SURVEY_DEFAULT_CHARACTER = (
    " ○ 성    품 : 포상 추천자는 온화한 성품으로 지역사회에 나눔과 봉사를 실천해 왔으며, "
    "특히 지역봉사 활동을 적극 펼쳐 지역민의 복지 향상에 기여함."
)
_SURVEY_DEFAULT_CONSISTENCY = " ○ 공적사항(공적내용과 일치여부) : 공적내용과 일치함."


def _local_reputation_default(recipient: Recipient) -> str:
    """지역여론 default — 주소에서 'OO시/군/구'를 자동 추출하여 채움. 추출 실패 시 'OO'."""
    from .xlsx_generator import _extract_region_from_address
    region = (recipient.region or _extract_region_from_address(recipient.address) or "OO").strip()
    return (
        f" ○ 지역여론(公私生活등) : 상기인은 {region}지역의 사회활동과 "
        "지역발전을 위한 문화 형성에 위해 힘써옴."
    )


# === 서식8: 의장 표창 체크리스트 ===

_CHECKLIST_OTHER_LABELS = {
    "investigation": "수사·기소",
    "criminal": "형사처분",
    "arrears": "체납",
    "misconduct": "비위·물의",
    "award_revoked": "표창 취소 이력",
}


def _format_check_result(status: str, note: str) -> str:
    """ok/issue 응답 → 양식의 '검토결과' 텍스트로 변환."""
    if status == "ok":
        return "해당 없음"
    if status == "issue":
        return f"해당 있음 — {note}" if (note or "").strip() else "해당 있음"
    return ""


def _format_election_law_result(status: str, note: str) -> str:
    """관리자 공직선거법 검토: lawful/violation → 양식의 '검토결과' 텍스트."""
    if status == "lawful":
        return f"적법 — {note}" if (note or "").strip() else "적법"
    if status == "violation":
        return f"위반 — {note}" if (note or "").strip() else "위반"
    return ""


def _format_other_result(cl) -> str:
    """'기타' 5개 항목 합산 결과."""
    statuses = [
        (k, getattr(cl, f"item_{k}", "") or "", getattr(cl, f"item_{k}_note", "") or "")
        for k in _CHECKLIST_OTHER_LABELS.keys()
    ]
    issues = [
        f"{_CHECKLIST_OTHER_LABELS[k]}: {note}" if note.strip() else _CHECKLIST_OTHER_LABELS[k]
        for k, st, note in statuses
        if st == "issue"
    ]
    if issues:
        return "해당 있음 — " + "; ".join(issues)
    if any(st == "ok" for _, st, _ in statuses):
        return "해당 없음"
    return ""


def generate_checklist_hwpx(case: AwardCase, recipient: Recipient) -> Path:
    """서식8: 의장 표창 체크리스트 HWPX 생성 (대상자별 1개)

    공직선거법 검토 부분은 관리자가 추후 입력하도록 빈 칸 유지.
    """
    cl = recipient.checklist
    if not cl or not cl.submitted_at:
        raise ValueError(
            f"체크리스트가 작성되지 않은 대상자({recipient.recipient_name})입니다."
        )

    service_period = _format_check_result(
        cl.item_service_period or "", cl.item_service_period_note or ""
    )
    prior_award = _format_check_result(
        cl.item_prior_award or "", cl.item_prior_award_note or ""
    )
    discipline = _format_check_result(
        cl.item_discipline or "", cl.item_discipline_note or ""
    )
    other_result = _format_other_result(cl)

    with zipfile.ZipFile(CHECKLIST_TEMPLATE_PATH, "r") as zin:
        section_bytes = zin.read("Contents/section0.xml")

    root = etree.fromstring(section_bytes)
    tables = root.findall(".//hp:tbl", NS)
    if len(tables) < 2:
        raise RuntimeError(f"체크리스트 양식 표 개수 비정상: {len(tables)}")

    # 표 #0: 결격여부 검토 (23셀)
    # 셀 5/7/9: 수공기간 (공무원/민간인/단체) 결과 — 사용자 응답으로 모두 동일하게
    # 셀 12/14/16: 기포상 (공무원/민간인/단체) 결과
    # 셀 19: 징계 결과
    # 셀 22: 기타 결과
    cells = tables[0].findall(".//hp:tc", NS)
    if len(cells) >= 23:
        for idx in (5, 7, 9):
            _set_long_text(cells[idx], service_period)
        for idx in (12, 14, 16):
            _set_long_text(cells[idx], prior_award)
        _set_long_text(cells[19], discipline)
        _set_long_text(cells[22], other_result)

    # 표 #1: 공직선거법 검토 — 관리자(전문위원실)가 입력한 결과 반영, 미입력 시 빈 칸.
    cells = tables[1].findall(".//hp:tc", NS)
    if len(cells) >= 8:
        _set_long_text(
            cells[3],
            _format_election_law_result(
                cl.admin_election_law_general or "",
                cl.admin_election_law_general_note or "",
            ),
        )
        _set_long_text(
            cells[5],
            _format_election_law_result(
                cl.admin_election_law_basis or "",
                cl.admin_election_law_basis_note or "",
            ),
        )
        _set_long_text(
            cells[7],
            _format_election_law_result(
                cl.admin_election_law_art112 or "",
                cl.admin_election_law_art112_note or "",
            ),
        )

    new_section = etree.tostring(
        root, xml_declaration=True, encoding="UTF-8", standalone=True
    )

    rec_name = case.recommender_name or "추천자"
    target = recipient.recipient_name or "대상자"
    out_name = f"체크리스트({rec_name} 의원_{target}).hwpx"
    out_path = GENERATED_DIR / out_name
    # normalize_fonts=True: 체크리스트도 01·02처럼 폰트를 경기천년체로 정규화.
    # (이게 없으면 템플릿의 '경기천년바탕 Regular' 등 접미사 붙은 face가 남아 한글/렌더
    #  엔진이 못 찾고 다른 폰트로 대체된다.)
    _save_hwpx(CHECKLIST_TEMPLATE_PATH, out_path, new_section, normalize_fonts=True)
    return out_path
