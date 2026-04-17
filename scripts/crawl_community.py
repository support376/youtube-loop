"""
양홍수 변호사 유튜브 채널 - 커뮤니티 크롤러
에펨코리아 / 디시인사이드 / 더쿠 / 인스티즈 → Supabase INSERT
뉴스 크롤러(daily_news_crawler.py)의 블랙리스트/예외룰/dedup 알고리즘 재사용
"""

import os
import sys
import re
import time
from datetime import datetime, timedelta
from difflib import SequenceMatcher

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from lib.supabase_client import get_client
from dotenv import load_dotenv
load_dotenv()

import requests
from bs4 import BeautifulSoup
from lib.http_client import safe_get, fail_log, reset_fail_log

# ── 설정 ──────────────────────────────────────────────

BODY_MAX_LEN = 1000  # 본문 최대 길이

# ── 블랙리스트 / 예외 룰 (뉴스 크롤러와 동일 + 커뮤니티 추가) ──

BLACKLIST = [
    # 스포츠/연예
    "축구", "야구", "골프", "손흥민", "김민재", "류현진", "메시",
    "콘서트", "앨범", "컴백", "뮤직비디오", "신곡",
    # 생활/일상 (커뮤니티 추가분 포함)
    "맛집", "레시피", "후기", "일상", "다이어트", "운동",
    "데이트", "짤", "짤방", "움짤", "gif",
    # 국제정치/외교
    "이란", "호르무즈", "트럼프", "이스라엘", "우크라이나", "푸틴",
    "시진핑", "美·이란", "NATO", "백악관", "펜타곤",
    # 북한
    "김정은", "평양", "노동당", "북한 요원",
    # 정치 정쟁
    "표심", "정계진출", "출마", "공천", "당협", "대선 후보", "의원 발언",
    # 명소/관광
    "명소", "관광지", "핫플레이스", "핫플", "데이트 코스",
    "봄꽃", "단풍 명소", "벚꽃 명소",
    # 의료/식품 낚시
    "암세포", "의사 경고", "의사가 알려주", "이런 거 버리",
    "면역력", "영양제", "보양식", "건강식품",
    # 소비/가격 낚시
    "그때 그냥 살걸", "갑자기 30만원", "보고 깜짝", "깜짝 인상",
]

OBITUARY_KEYWORDS = [
    "[부고]", "부고", "별세", "부친상", "모친상", "빙부상", "빙모상", "영결식", "발인",
]

EXCEPTION_KEYWORDS = [
    "사기", "고소", "처벌", "검거", "구속", "판결", "소송", "협박",
    "횡령", "폭행", "음주운전", "마약", "명예훼손", "모욕", "스토킹",
    "변호사", "법원", "법적", "손해배상",
]

# ── 유틸리티 ──────────────────────────────────────────

filter_stats = {"blacklist": 0, "empty_title": 0, "similar_dedup": 0}


# ── 날짜 파싱 ─────────────────────────────────────────

def parse_datetime_text(text: str) -> datetime | None:
    """커뮤니티 사이트의 다양한 날짜 형식 파싱"""
    text = text.strip()
    now = datetime.now()

    # "N분 전", "N시간 전", "N일 전"
    m = re.search(r"(\d+)분\s*전", text)
    if m:
        return now - timedelta(minutes=int(m.group(1)))
    m = re.search(r"(\d+)시간\s*전", text)
    if m:
        return now - timedelta(hours=int(m.group(1)))
    m = re.search(r"(\d+)일\s*전", text)
    if m:
        return now - timedelta(days=int(m.group(1)))

    # "N초 전"
    m = re.search(r"(\d+)초\s*전", text)
    if m:
        return now - timedelta(seconds=int(m.group(1)))

    # "2026.04.08 10:30" / "2026.04.08. 10:30"
    m = re.search(r"(\d{4})\.(\d{2})\.(\d{2})\.?\s*(\d{2}):(\d{2})", text)
    if m:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)),
                        int(m.group(4)), int(m.group(5)))

    # "2026-04-08 10:30"
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})", text)
    if m:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)),
                        int(m.group(4)), int(m.group(5)))

    # "04.08 10:30" (올해)
    m = re.search(r"(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})", text)
    if m:
        return datetime(now.year, int(m.group(1)), int(m.group(2)),
                        int(m.group(3)), int(m.group(4)))

    # "04-08 10:30" (올해)
    m = re.search(r"(\d{2})-(\d{2})\s+(\d{2}):(\d{2})", text)
    if m:
        return datetime(now.year, int(m.group(1)), int(m.group(2)),
                        int(m.group(3)), int(m.group(4)))

    # "04/08 10:30" (올해)
    m = re.search(r"(\d{2})/(\d{2})\s+(\d{2}):(\d{2})", text)
    if m:
        return datetime(now.year, int(m.group(1)), int(m.group(2)),
                        int(m.group(3)), int(m.group(4)))

    # "10:30" (오늘)
    m = re.fullmatch(r"(\d{2}):(\d{2})", text)
    if m:
        return now.replace(hour=int(m.group(1)), minute=int(m.group(2)),
                           second=0, microsecond=0)

    return None


def is_within_48h(dt: datetime | None) -> bool:
    if dt is None:
        return True
    return (datetime.now() - dt).total_seconds() <= 48 * 3600


def freshness_tag(dt: datetime | None) -> str:
    if dt is None:
        return "시간불명"
    hours = (datetime.now() - dt).total_seconds() / 3600
    if hours <= 24:
        return "신선"
    return "24-48시간"


# ── 필터링 (뉴스 크롤러 패턴 재사용) ─────────────────

def passes_filter(title: str) -> bool:
    # 부고 (예외 룰 무시, 무조건 제외)
    if any(ob in title for ob in OBITUARY_KEYWORDS):
        return False
    # 블랙리스트 체크 (예외 룰 적용)
    has_blacklist = any(bw in title for bw in BLACKLIST)
    if not has_blacklist:
        return True
    has_exception = any(ew in title for ew in EXCEPTION_KEYWORDS)
    return has_exception


# ── 본문 정제 ─────────────────────────────────────────

# 인사말/노이즈: 줄 시작에 한정, 해당 줄만 제거
_BODY_NOISE_PATTERNS = re.compile(
    r"^(?:안녕하세요|처음 글 써봐요|눈팅만 하다가|글 첫 작성|제 첫 글"
    r"|긴 글 죄송합니다|두서없이|글 보시는 분"
    r"|구독 부탁|좋아요 부탁)[^\n]*",
    re.MULTILINE,
)

# 이모지 유니코드 범위 (한글 U+AC00-D7AF 절대 포함하지 않음)
_EMOJI_RE = re.compile(
    "["
    "\U0001F600-\U0001F64F"
    "\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FA6F"
    "\U0001FA70-\U0001FAFF"
    "\U00002702-\U000027B0"
    "\U00002600-\U000026FF"
    "\U0000FE00-\U0000FE0F"
    "\U0000200D"
    "\U000024C2-\U0000257F"  # 기호 (한글 앞까지만)
    "]+",
    flags=re.UNICODE,
)


def clean_body(text: str) -> str:
    """커뮤니티 본문 정제"""
    # 노이즈 패턴 제거
    text = _BODY_NOISE_PATTERNS.sub("", text)
    # 이모지 제거
    text = _EMOJI_RE.sub("", text)
    # 연속 줄바꿈 압축
    text = re.sub(r"\n{3,}", "\n", text)
    text = text.strip()
    # 1000자 제한
    if len(text) > BODY_MAX_LEN:
        text = text[:BODY_MAX_LEN] + "…"
    return text


# ── dedup v2 (뉴스 크롤러에서 그대로 가져옴) ─────────

_KO_SUFFIXES = [
    "에서는", "으로는", "에게는", "부터는",
    "에서", "으로", "에게", "부터", "까지", "처럼", "만큼", "에는",
    "이가", "에도", "와의", "과의", "이나", "이는", "라는", "한테",
    "는", "은", "이", "가", "을", "를", "의", "에", "로", "와", "과",
    "도", "만", "서", "며", "고", "면", "랑", "든",
]

_NUM_UNIT_RE = re.compile(
    r"\d+(?:천|백|십)?(?:만|억)?\s*"
    r"(?:대|명|층|원|건|개|곳|살|세|조|억|만|천|년|월|일|시간|분|kg|cm)"
)


def _extract_keywords(title: str) -> set[str]:
    keywords = set()
    for m in _NUM_UNIT_RE.finditer(title):
        keywords.add(re.sub(r"\s+", "", m.group()))
    text = re.sub(r"\[.*?\]", "", title)
    text = re.sub(r"['\"\u201c\u201d\u2018\u2019`].*?['\"\u201c\u201d\u2018\u2019`]", "", text)
    text = re.sub(r"[^가-힣a-zA-Z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    for word in text.split():
        if re.match(r"^\d+$", word):
            continue
        stem = word
        for suf in _KO_SUFFIXES:
            if stem.endswith(suf) and len(stem) > len(suf) + 1:
                stem = stem[:-len(suf)]
                break
        if len(stem) >= 2:
            keywords.add(stem)
    return keywords


def _is_specific(word: str) -> bool:
    if _NUM_UNIT_RE.fullmatch(word):
        return True
    if re.match(r"\d+", word):
        return True
    if re.fullmatch(r"[가-힣]{3,}", word):
        return True
    if re.fullmatch(r"[a-zA-Z]{2,}", word):
        return True
    return False


def _fuzzy_overlap(kw_a: set[str], kw_b: set[str]) -> set[str]:
    matched = kw_a & kw_b
    remaining_a = kw_a - matched
    remaining_b = kw_b - matched
    for wa in remaining_a:
        if len(wa) < 2:
            continue
        for wb in remaining_b:
            if len(wb) < 2:
                continue
            if (len(wa) >= 4 and wb in wa) or (len(wb) >= 4 and wa in wb):
                matched.add(min(wa, wb, key=len))
    return matched


def _is_same_event(title_a: str, title_b: str) -> bool:
    kw_a = _extract_keywords(title_a)
    kw_b = _extract_keywords(title_b)
    if not kw_a or not kw_b:
        return False
    overlap = _fuzzy_overlap(kw_a, kw_b)

    # 신호 1: Jaccard ≥ 0.30
    if len(overlap) / len(kw_a | kw_b) >= 0.30:
        return True
    # 신호 2a: 겹치는 키워드 3개 이상
    if len(overlap) >= 3:
        return True
    # 신호 2b: 겹치는 키워드 2개 + 고유명사/숫자단위
    if len(overlap) >= 2 and any(_is_specific(w) for w in overlap):
        return True
    # 신호 3: SequenceMatcher ≥ 0.40
    def _strip(t):
        t = re.sub(r"\[.*?\]", "", t)
        t = re.sub(r"['\"\u201c\u201d\u2018\u2019`]", "", t)
        return t.strip()
    if SequenceMatcher(None, _strip(title_a), _strip(title_b)).ratio() >= 0.40:
        return True
    return False


def _dedup_by_similarity(articles: list[dict]) -> list[dict]:
    keep = []
    for art in articles:
        title = art.get("title", "")
        is_dup = False
        for kept in keep:
            if _is_same_event(title, kept.get("title", "")):
                is_dup = True
                filter_stats["similar_dedup"] += 1
                break
        if not is_dup:
            keep.append(art)
    return keep


# ── 필터링 & 중복 제거 ───────────────────────────────

def filter_and_deduplicate(articles: list[dict]) -> list[dict]:
    seen_urls = set()
    filtered = []
    for art in articles:
        url = art.get("url", "")
        title = art.get("title", "").strip()

        if url in seen_urls:
            continue
        seen_urls.add(url)

        if len(title) < 5:
            filter_stats["empty_title"] += 1
            continue

        if not is_within_48h(art.get("pub_date")):
            continue

        if not passes_filter(title):
            filter_stats["blacklist"] += 1
            continue

        art["freshness"] = freshness_tag(art.get("pub_date"))
        filtered.append(art)

    filtered = _dedup_by_similarity(filtered)

    def sort_key(a):
        f = 0 if a.get("freshness") == "신선" else 1
        dt = a.get("pub_date") or datetime.min
        return (f, -dt.timestamp() if dt != datetime.min else 0)

    filtered.sort(key=sort_key)
    return filtered


# ── 사이트별 크롤러 ──────────────────────────────────

def _fetch_post_body(url: str, selectors: list[str], encoding: str | None = None) -> str:
    """게시글 본문 추출. selectors 리스트를 순서대로 시도."""
    resp = safe_get(url)
    if resp is None:
        return "(본문 수집 실패)"
    if encoding:
        resp.encoding = encoding
    soup = BeautifulSoup(resp.text, "html.parser")
    for sel in selectors:
        body_el = soup.select_one(sel)
        if body_el:
            for tag in body_el.select("script, style, iframe, .ad_area, .og-div"):
                tag.decompose()
            text = body_el.get_text(separator="\n", strip=True)
            return clean_body(text)
    return "(본문 영역을 찾을 수 없음)"


# ── 에펨코리아 ────────────────────────────────────────

_FM_SKIP_CATS = {"정치", "축구", "야구", "농구", "스포츠", "해외축구", "국내축구"}
_FM_SKIP_MIDS = {"politics", "soccer", "baseball", "basketball", "football_news"}


def crawl_fmkorea(count: int = 15) -> list[dict]:
    """에펨코리아 포텐 터짐 게시판 (리스트 모드 + 웹진 모드 폴백)"""
    results = []

    # 방법 1: 리스트 모드 (테이블 형태, 파싱 쉬움)
    url = "https://www.fmkorea.com/index.php?mid=best&listStyle=list"
    resp = safe_get(url)
    if resp is not None:
        soup = BeautifulSoup(resp.text, "html.parser")
        rows = soup.select("table.bd_lst tbody tr")
        for row in rows[:count * 3]:
            # 공지 건너뛰기
            if "notice" in row.get("class", []):
                continue

            # 게시판 카테고리 체크
            cat_el = row.select_one("td:first-child a")
            if cat_el:
                cat = cat_el.get_text(strip=True)
                cat_href = cat_el.get("href", "")
                if cat in _FM_SKIP_CATS:
                    continue
                if any(m in cat_href for m in _FM_SKIP_MIDS):
                    continue

            # 제목 + 링크
            a_tag = row.select_one("td.title a.hx")
            if not a_tag:
                continue
            title = a_tag.get_text(strip=True)
            href = a_tag.get("href", "")
            if not href:
                continue
            if href.startswith("/"):
                href = "https://www.fmkorea.com" + href

            # 시간
            time_el = row.select_one("td.time")
            pub_date = parse_datetime_text(time_el.get_text()) if time_el else None

            # 추천
            vote_el = row.select_one("td.m_no.m_no_voted")
            vote = vote_el.get_text(strip=True) if vote_el else ""

            # 댓글
            comment_el = row.select_one("a.replyNum")
            comment = comment_el.get_text(strip=True) if comment_el else ""

            results.append({
                "title": title, "url": href, "pub_date": pub_date,
                "source": "에펨", "vote": vote, "comment": comment, "body": "",
            })
            if len(results) >= count:
                break

    # 방법 2: 웹진 모드 폴백
    if not results:
        url2 = "https://www.fmkorea.com/index.php?mid=best"
        resp2 = safe_get(url2)
        if resp2 is not None:
            soup2 = BeautifulSoup(resp2.text, "html.parser")
            items = soup2.select("div.fm_best_widget li.li")
            for item in items[:count * 3]:
                # 카테고리 체크
                cat_el = item.select_one("span.category a")
                if cat_el:
                    cat = cat_el.get_text(strip=True)
                    if cat in _FM_SKIP_CATS:
                        continue

                a_tag = item.select_one("h3.title a")
                if not a_tag:
                    continue
                title_span = a_tag.select_one("span.ellipsis-target")
                title = title_span.get_text(strip=True) if title_span else a_tag.get_text(strip=True)
                href = a_tag.get("href", "")
                if not href:
                    continue
                if href.startswith("/"):
                    href = "https://www.fmkorea.com" + href

                vote_el = item.select_one("a.pc_voted_count span.count")
                vote = vote_el.get_text(strip=True) if vote_el else ""

                time_el = item.select_one("span.regdate")
                pub_date = parse_datetime_text(time_el.get_text()) if time_el else None

                comment_el = item.select_one("span.comment_count")
                comment = comment_el.get_text(strip=True).strip("[]") if comment_el else ""

                results.append({
                    "title": title, "url": href, "pub_date": pub_date,
                    "source": "에펨", "vote": vote, "comment": comment, "body": "",
                })
                if len(results) >= count:
                    break

    # 본문 수집
    body_sels = ["div.xe_content", "div.rd_body article", "article"]
    for i, art in enumerate(results):
        art["body"] = _fetch_post_body(art["url"], body_sels)
        print(f"  [에펨] {i+1}/{len(results)}", end="\r")

    print(f"  [에펨] 수집 완료: {len(results)}개")
    return results


# ── 디시인사이드 ──────────────────────────────────────

def crawl_dcinside(count: int = 15) -> list[dict]:
    """디시인사이드 실시간 베스트"""
    url = "https://gall.dcinside.com/board/lists/?id=dcbest"
    resp = safe_get(url)
    if resp is None:
        return []
    resp.encoding = "utf-8"

    soup = BeautifulSoup(resp.text, "html.parser")
    results = []

    # us-post 클래스가 있는 것만 (공지/설문 제외)
    rows = soup.select("table.gall_list > tbody > tr.ub-content.us-post")

    for row in rows[:count * 2]:
        # 제목 + 링크
        a_tag = row.select_one('td.gall_tit a[href*="/board/view/"]')
        if not a_tag:
            continue

        # 제목 텍스트 (strong 태그 내 갤러리명 제거)
        title_text = a_tag.get_text(strip=True)
        # [갤러리명] 접두사 제거
        title_text = re.sub(r"^\[.+?\]\s*", "", title_text)

        href = a_tag.get("href", "")
        if not href:
            continue
        if href.startswith("/"):
            href = "https://gall.dcinside.com" + href

        # 시간 (title 속성에 전체 날짜/시간)
        time_el = row.select_one("td.gall_date")
        pub_date = None
        if time_el:
            full_dt = time_el.get("title", "") or time_el.get_text(strip=True)
            pub_date = parse_datetime_text(full_dt)

        # 추천
        vote_el = row.select_one("td.gall_recommend")
        vote = vote_el.get_text(strip=True) if vote_el else ""

        # 댓글
        comment_el = row.select_one("span.reply_num")
        comment = ""
        if comment_el:
            comment = re.sub(r"[\[\]]", "", comment_el.get_text(strip=True))

        results.append({
            "title": title_text, "url": href, "pub_date": pub_date,
            "source": "디시", "vote": vote, "comment": comment, "body": "",
        })
        if len(results) >= count:
            break

    body_sels = ["div.writing_view_box", "div.write_div"]
    for i, art in enumerate(results):
        art["body"] = _fetch_post_body(art["url"], body_sels, encoding="utf-8")
        print(f"  [디시] {i+1}/{len(results)}", end="\r")

    print(f"  [디시] 수집 완료: {len(results)}개")
    return results


# ── 인스티즈 ──────────────────────────────────────────

def crawl_instiz(count: int = 10) -> list[dict]:
    """인스티즈 이슈 게시판"""
    url = "https://www.instiz.net/pt"
    resp = safe_get(url)
    if resp is None:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    results = []

    # 일반 글 (tr[id^="list"])
    rows = soup.select('tr[id^="list"]')

    for row in rows[:count * 2]:
        # detour (초록글 영역)은 스킵
        if row.get("id") == "detour":
            continue

        a_tag = row.select_one("td.listsubject > a")
        if not a_tag:
            continue

        # 제목
        sbj_el = a_tag.select_one("div.sbj")
        if not sbj_el:
            continue
        # cmt 태그 제거 후 텍스트
        for cmt in sbj_el.select("span.cmt2, span.cmt3"):
            cmt.decompose()
        title = sbj_el.get_text(strip=True)

        href = a_tag.get("href", "")
        if not href:
            continue
        if href.startswith("/"):
            href = "https://www.instiz.net" + href

        # 시간/조회/추천 파싱 (div.listno.regdate 텍스트)
        info_el = row.select_one("div.listno.regdate")
        pub_date = None
        vote = ""
        if info_el:
            info_text = info_el.get_text(strip=True)
            # 시간 추출
            time_m = re.search(r"(\d{1,2}:\d{2})", info_text)
            if time_m:
                pub_date = parse_datetime_text(time_m.group(1))
            else:
                date_m = re.search(r"(\d{2}\.\d{2}\s+\d{2}:\d{2})", info_text)
                if date_m:
                    pub_date = parse_datetime_text(date_m.group(1))
            # 추천 추출
            rec_m = re.search(r"추천\s*(\d+)", info_text)
            if rec_m:
                vote = rec_m.group(1)

        # 댓글
        comment_el = row.select_one("span.cmt2, span.cmt3")
        comment = comment_el.get_text(strip=True) if comment_el else ""

        results.append({
            "title": title, "url": href, "pub_date": pub_date,
            "source": "인스티즈", "vote": vote, "comment": comment, "body": "",
        })
        if len(results) >= count:
            break

    body_sels = ["div.memo_content", "div.xe_content"]
    for i, art in enumerate(results):
        art["body"] = _fetch_post_body(art["url"], body_sels)
        print(f"  [인스티즈] {i+1}/{len(results)}", end="\r")

    print(f"  [인스티즈] 수집 완료: {len(results)}개")
    return results


# ── 더쿠 ──────────────────────────────────────────────

def crawl_theqoo(count: int = 15) -> list[dict]:
    """더쿠 핫이슈 게시판"""
    url = "https://theqoo.net/hot"
    resp = safe_get(url)
    if resp is None:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    results = []

    # 공지/이벤트 제외: tr:not(.notice):not(.notice_expand)
    rows = soup.select(
        "table.theqoo_board_table > tbody > tr:not(.notice):not(.notice_expand)"
    )

    for row in rows[:count * 2]:
        # td.no에 숫자가 있는 것만 (공지는 "공지" 텍스트)
        no_el = row.select_one("td.no")
        if no_el and not no_el.get_text(strip=True).isdigit():
            continue

        # 제목 + 링크 (첫 번째 a만, replyNum 제외)
        a_tag = row.select_one("td.title > a:first-child")
        if not a_tag:
            continue
        # replyNum 클래스면 건너뛰기
        if "replyNum" in a_tag.get("class", []):
            continue

        title = a_tag.get_text(strip=True)
        href = a_tag.get("href", "")
        if not href:
            continue
        if href.startswith("/"):
            href = "https://theqoo.net" + href

        # 시간
        time_el = row.select_one("td.time")
        pub_date = parse_datetime_text(time_el.get_text()) if time_el else None

        # 조회수 (더쿠 목록에는 추천 없음, 조회수만)
        view_el = row.select_one("td.m_no")
        vote = view_el.get_text(strip=True) if view_el else ""

        # 댓글
        comment_el = row.select_one("a.replyNum")
        comment = comment_el.get_text(strip=True) if comment_el else ""

        results.append({
            "title": title, "url": href, "pub_date": pub_date,
            "source": "더쿠", "vote": vote, "comment": comment, "body": "",
        })
        if len(results) >= count:
            break

    body_sels = ["div.rhymix_content.xe_content", "div.xe_content",
                 "div.rd_body article", "article"]
    for i, art in enumerate(results):
        art["body"] = _fetch_post_body(art["url"], body_sels)
        print(f"  [더쿠] {i+1}/{len(results)}", end="\r")

    print(f"  [더쿠] 수집 완료: {len(results)}개")
    return results


# ── Supabase INSERT ───────────────────────────────────

PLATFORM_MAP = {
    "에펨": "에펨코리아",
    "디시": "디시인사이드",
    "더쿠": "더쿠",
    "인스티즈": "인스티즈",
}

BATCH_SIZE = 50


def insert_to_supabase(articles_by_source: dict[str, list[dict]], crawl_date: str) -> int:
    """필터링된 기사를 Supabase crawled_community 테이블에 배치 INSERT. URL 중복 제거."""
    supabase = get_client()

    # 이미 저장된 URL 조회 → 중복 제거
    existing_resp = supabase.table("crawled_community").select("url").eq("crawl_date", crawl_date).execute()
    existing_urls = {r["url"] for r in (existing_resp.data or [])}

    rows = []
    for source_key, arts in articles_by_source.items():
        platform = PLATFORM_MAP.get(source_key, source_key)
        for art in arts:
            if art.get("url", "") in existing_urls:
                continue
            pub_date: datetime | None = art.get("pub_date")
            rows.append({
                "crawl_date": crawl_date,
                "platform": platform,
                "title": art.get("title", ""),
                "url": art.get("url", ""),
                "body": art.get("body", ""),
                "post_date": pub_date.isoformat() if pub_date is not None else None,
                "freshness": art.get("freshness", "시간불명"),
            })

    total_inserted = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        result = supabase.table("crawled_community").insert(batch).execute()
        inserted = len(result.data) if result.data else 0
        total_inserted += inserted
        print(f"  [Supabase] 배치 INSERT {i + 1}~{i + len(batch)}: {inserted}건 완료")

    return total_inserted


# ── 메인 ──────────────────────────────────────────────

def main():
    start_time = datetime.now()
    print(f"=== 커뮤니티 크롤링 시작: {start_time.strftime('%Y-%m-%d %H:%M:%S')} ===")

    # 1) 사이트별 크롤링
    print("\n[1/4] 에펨코리아...")
    raw_fm = crawl_fmkorea(15)

    print("[2/4] 디시인사이드...")
    raw_dc = crawl_dcinside(15)

    print("[3/3] 더쿠...")
    raw_tq = crawl_theqoo(15)

    # 인스티즈 제거 (403 영구 차단)

    # 2) 사이트별 필터링 & dedup
    print("\n[필터링] 블랙리스트 + 빈 제목 + 유사도 dedup...")
    filter_stats["blacklist"] = 0
    filter_stats["empty_title"] = 0
    filter_stats["similar_dedup"] = 0

    filtered_fm = filter_and_deduplicate(raw_fm)
    filtered_dc = filter_and_deduplicate(raw_dc)
    filtered_tq = filter_and_deduplicate(raw_tq)

    # 3) 전체 합쳐서 cross-site dedup
    combined = filtered_fm + filtered_dc + filtered_tq
    deduped = _dedup_by_similarity(combined)

    articles_by_source = {
        "에펨": [a for a in deduped if a.get("source") == "에펨"],
        "디시": [a for a in deduped if a.get("source") == "디시"],
        "더쿠": [a for a in deduped if a.get("source") == "더쿠"],
    }

    total = sum(len(v) for v in articles_by_source.values())
    for src, arts in articles_by_source.items():
        print(f"  → {src}: {len(arts)}개")
    print(f"  → 합계: {total}개")
    print(f"  → [필터] 블랙리스트 제외: {filter_stats['blacklist']}개")
    print(f"  → [필터] 빈 제목 제외: {filter_stats['empty_title']}개")
    print(f"  → [필터] 유사도 dedup 제외: {filter_stats['similar_dedup']}개")

    # 4) Supabase INSERT
    crawl_date = datetime.now().strftime("%Y-%m-%d")
    print(f"\n[Supabase INSERT] crawled_community 테이블 (crawl_date={crawl_date})...")
    total_inserted = insert_to_supabase(articles_by_source, crawl_date)

    end_time = datetime.now()
    elapsed = (end_time - start_time).total_seconds()
    print(f"\n=== 크롤링 완료: {end_time.strftime('%Y-%m-%d %H:%M:%S')} ===")
    print(f"  소요 시간: {elapsed:.1f}초")
    print(f"  INSERT 완료: {total_inserted}건")
    if fail_log:
        print(f"  실패 항목: {len(fail_log)}개")
        for entry in fail_log:
            print(f"    {entry}")


if __name__ == "__main__":
    main()
