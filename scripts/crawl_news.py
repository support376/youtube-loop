"""
양홍수 변호사 유튜브 채널 - 법률 뉴스 크롤러
네이버 뉴스 인기 섹션 + 키워드 검색 → Supabase crawled_news 테이블 INSERT
"""

import os
import sys
import re
import time
import urllib.parse
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from lib.supabase_client import get_client
from dotenv import load_dotenv

load_dotenv()

import requests
from bs4 import BeautifulSoup

# ── 설정 ──────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

REQUEST_DELAY = 1  # 초

# 인기 섹션 설정: (섹션ID, 섹션명, 수집 개수)
POPULAR_SECTIONS = [
    (102, "사회", 30),
    (101, "경제", 20),
    (103, "생활/문화", 10),
]

# 키워드 검색 설정
SEARCH_KEYWORDS = [
    "사기", "처벌", "판결", "검거", "구속", "고소", "소송", "변호사",
    "증여세", "상속세", "이혼", "회생", "파산", "음주운전",
    "전세사기", "보이스피싱", "횡령", "명의도용",
    "마약", "폭행", "명예훼손", "스토킹", "임금체불", "양육비", "부동산 사기",
]
SEARCH_TOP_N = 3

# 블랙리스트 / 예외
BLACKLIST = [
    # 스포츠/연예
    "축구", "야구", "골프", "손흥민", "김민재", "류현진", "메시",
    "콘서트", "앨범", "컴백", "뮤직비디오", "신곡",
    "맛집", "레시피", "후기", "일상", "다이어트", "운동",
    # 국제정치/외교
    "이란", "호르무즈", "트럼프", "이스라엘", "우크라이나", "푸틴",
    "시진핑", "美·이란", "美국방", "합참", "NATO", "백악관", "펜타곤",
    # 북한
    "김정은", "평양", "노동당", "북한 요원",
    # 정치 정쟁
    "표심", "정계진출", "정계 진출",
    # 광고/홍보
    "분양", "디에트르", "모델하우스", "입주민", "청약", "견본주택", "분양가", "분양권",
    # 칼럼/오피니언
    "칼럼", "시론", "사설", "포럼", "오피니언",
    # 정치 이벤트 (선거/공천)
    "출마", "공천", "후보 확정", "당협", "공천관련", "공천 관련",
    # 명소/관광
    "명소", "관광지", "핫플레이스", "핫플", "데이트 코스",
    "봄꽃", "단풍 명소", "벚꽃 명소",
    # 의료/식품 낚시 제목
    "암세포", "의사 경고", "의사가 알려주", "이런 거 버리",
    "면역력", "영양제", "보양식", "건강식품", "버리세요",
    # 소비/가격 낚시 제목
    "그때 그냥 살걸", "갑자기 30만원", "갑자기 50만원", "보고 깜짝", "깜짝 인상",
]

# 제목 내 대괄호 코너명 블랙리스트 (예외 룰 무시, 무조건 제외)
CORNER_BLACKLIST = [
    "샷!", "흑백요리봇", "뉴스속오늘", "시크한 분석",
    "e글중심", "한입뉴스", "뉴스쏙", "클릭스타워즈",
    "연예뒤통령", "스브스뉴스", "뉴스Pick", "핫클립",
    "정치",
]

# 정치 코너 대괄호 정규식 ([○○의 뉴스IN], [○○ 인터뷰] 등)
CORNER_REGEX = re.compile(r"\[[가-힣]+의\s*뉴스|\[[가-힣]+\s*인터뷰\]")

# 부고 키워드 (예외 룰 무시, 무조건 제외)
OBITUARY_KEYWORDS = [
    "[부고]", "부고", "별세", "부친상", "모친상", "빙부상", "빙모상", "영결식", "발인",
]

EXCEPTION_KEYWORDS = [
    "사기", "고소", "처벌", "검거", "구속", "판결", "소송", "협박",
    "횡령", "폭행", "음주운전", "마약", "명예훼손", "모욕", "스토킹",
]

# 지자체 + 행사/홍보 패턴
_LOCAL_GOV_RE = re.compile(r"[가-힣]{1,4}(?:시|군|구|도|청)")
_LOCAL_GOV_PROMO = [
    "진행", "가동", "도입", "지원서비스", "격려", "방문", "훈련",
    "개막", "개최", "정조준", "발족", "출범", "선포",
]

# 시리즈물/진단/분석 코너 정규식
_SERIES_RE = re.compile(
    r"\[[A-Za-z]+&[A-Za-z]+\]"           # [Invest&Law], [Tech&Bio]
    r"|\[[가-힣]+\s*(?:진단|분석|시리즈)\]"  # [밸류업 진단], [경제 분석]
    r"|[①②③④⑤⑥⑦⑧⑨⑩]"                    # 시리즈 회차 동그라미 숫자
)

# ── 유틸리티 ──────────────────────────────────────────

session = requests.Session()
session.headers.update(HEADERS)
fail_log: list[str] = []


def safe_get(url: str, params=None, timeout=15) -> requests.Response | None:
    try:
        resp = session.get(url, params=params, timeout=timeout)
        resp.raise_for_status()
        time.sleep(REQUEST_DELAY)
        return resp
    except Exception as e:
        fail_log.append(f"[GET 실패] {url} → {e}")
        return None


def parse_datetime_text(text: str) -> datetime | None:
    """네이버 뉴스의 다양한 날짜 형식 파싱"""
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

    # "2026.04.08. 오전 10:30" / "2026.04.08. 오후 3:30"
    m = re.search(r"(\d{4})\.(\d{2})\.(\d{2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2})", text)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        ampm, h, mi = m.group(4), int(m.group(5)), int(m.group(6))
        if ampm == "오후" and h != 12:
            h += 12
        if ampm == "오전" and h == 12:
            h = 0
        return datetime(y, mo, d, h, mi)

    # "2026.04.08 10:30"
    m = re.search(r"(\d{4})\.(\d{2})\.(\d{2})\.?\s*(\d{2}):(\d{2})", text)
    if m:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)),
                        int(m.group(4)), int(m.group(5)))

    # "2026-04-08 10:30:00"
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})", text)
    if m:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)),
                        int(m.group(4)), int(m.group(5)))

    return None


def is_within_48h(dt: datetime | None) -> bool:
    if dt is None:
        return True  # 시간 파싱 실패 시 포함
    return (datetime.now() - dt).total_seconds() <= 48 * 3600


def freshness_tag(dt: datetime | None) -> str:
    if dt is None:
        return "시간불명"
    hours = (datetime.now() - dt).total_seconds() / 3600
    if hours <= 24:
        return "신선"
    return "24-48시간"


def passes_filter(title: str) -> bool:
    # 부고 (예외 룰 무시, 무조건 제외)
    if any(ob in title for ob in OBITUARY_KEYWORDS):
        return False
    # 대괄호 코너명 체크 (예외 룰 무시, 무조건 제외)
    brackets = re.findall(r"\[([^\]]+)\]", title)
    for b in brackets:
        if any(c in b for c in CORNER_BLACKLIST):
            return False
    # 정치 코너 정규식 체크 (예외 룰 무시, 무조건 제외)
    if CORNER_REGEX.search(title):
        return False
    # 시리즈물/진단/분석 코너 체크 (예외 룰 적용)
    if _SERIES_RE.search(title):
        if not any(ew in title for ew in EXCEPTION_KEYWORDS):
            return False

    # 지자체 + 행사/홍보 동시 매칭 체크 (예외 룰 적용)
    if _LOCAL_GOV_RE.search(title):
        if any(pw in title for pw in _LOCAL_GOV_PROMO):
            if not any(ew in title for ew in EXCEPTION_KEYWORDS):
                return False

    # 블랙리스트 체크 (예외 룰 적용)
    has_blacklist = any(bw in title for bw in BLACKLIST)
    if not has_blacklist:
        return True
    has_exception = any(ew in title for ew in EXCEPTION_KEYWORDS)
    return has_exception


# ── 본문 추출 ─────────────────────────────────────────

def fetch_article_body(url: str) -> str:
    """네이버 뉴스 기사 본문 추출"""
    resp = safe_get(url)
    if resp is None:
        return "(본문 수집 실패)"
    soup = BeautifulSoup(resp.text, "html.parser")

    # 네이버 뉴스 본문 영역
    body_el = (
        soup.select_one("#dic_area")
        or soup.select_one("#newsct_article")
        or soup.select_one("#articeBody")
        or soup.select_one("#article_body")
        or soup.select_one(".news_end._article_body_contents")
        or soup.select_one("div.newsct_body")
    )
    if body_el:
        for tag in body_el.select("script, style, iframe, .ad_area, .reporter_area"):
            tag.decompose()
        text = body_el.get_text(separator="\n", strip=True)
        # 여러 빈 줄 정리
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    return "(본문 영역을 찾을 수 없음)"


# ── 기사 메타 추출 ────────────────────────────────────

def fetch_article_meta(url: str) -> dict | None:
    """네이버 뉴스 기사 페이지에서 메타 정보 + 본문 추출"""
    resp = safe_get(url)
    if resp is None:
        return None
    soup = BeautifulSoup(resp.text, "html.parser")

    title = ""
    pub_date = None
    source = ""

    # 제목
    title_el = soup.select_one("#ct > div.media_end_head.go_trans > div.media_end_head_title > h2")
    if not title_el:
        title_el = soup.select_one("h2.media_end_head_headline") or soup.select_one("h2#title_area")
    if title_el:
        title = title_el.get_text(strip=True)

    # og:title 폴백
    if not title:
        og = soup.select_one('meta[property="og:title"]')
        if og:
            title = og.get("content", "")

    # 시간
    time_el = soup.select_one("span.media_end_head_info_datestamp_time[data-date-time]")
    if time_el:
        pub_date = parse_datetime_text(time_el["data-date-time"])
    if pub_date is None:
        time_el = soup.select_one("span._ARTICLE_DATE_TIME")
        if time_el:
            raw = time_el.get("data-date-time") or time_el.get_text()
            pub_date = parse_datetime_text(raw)
    # meta article:published_time 폴백
    if pub_date is None:
        meta_time = soup.select_one('meta[property="article:published_time"]')
        if meta_time:
            pub_date = parse_datetime_text(meta_time.get("content", ""))

    # 출처
    source_el = soup.select_one("a.media_end_head_top_logo img")
    if source_el:
        source = source_el.get("alt", "") or source_el.get("title", "")
    if not source:
        source_el = soup.select_one('meta[property="og:article:author"]')
        if source_el:
            source = source_el.get("content", "")

    # 본문
    body_el = (
        soup.select_one("#dic_area")
        or soup.select_one("#newsct_article")
        or soup.select_one("#articeBody")
        or soup.select_one("#article_body")
        or soup.select_one(".news_end._article_body_contents")
        or soup.select_one("div.newsct_body")
    )
    body = "(본문 영역을 찾을 수 없음)"
    if body_el:
        for tag in body_el.select("script, style, iframe, .ad_area, .reporter_area"):
            tag.decompose()
        body = body_el.get_text(separator="\n", strip=True)
        body = re.sub(r"\n{3,}", "\n\n", body).strip()

    return {
        "title": title,
        "url": url,
        "pub_date": pub_date,
        "source": source,
        "body": body,
    }


# ── 인기 섹션 크롤링 ─────────────────────────────────

def crawl_popular_section(sid: int, section_name: str, count: int) -> list[dict]:
    """네이버 뉴스 섹션별 많이 본 뉴스"""
    articles: list[str] = []
    seen = set()

    def _add_links(link_elements, limit):
        for a in link_elements:
            href = a.get("href", "")
            if "news.naver.com" in href and "/article/" in href and href not in seen:
                seen.add(href)
                articles.append(href)
                if len(articles) >= limit:
                    break

    # 방법 1: 섹션 페이지의 랭킹 영역 (div.rankingnews a.rl_coverlink)
    url = f"https://news.naver.com/section/{sid}"
    resp = safe_get(url)
    if resp is not None:
        soup = BeautifulSoup(resp.text, "html.parser")
        ranking_links = soup.select("div.rankingnews a.rl_coverlink")
        _add_links(ranking_links, count)

    # 방법 2: 폴백 - popularDay 페이지
    if len(articles) < count:
        fallback_url = f"https://news.naver.com/main/ranking/popularDay.naver?mid=etc&sid1={sid}"
        resp2 = safe_get(fallback_url)
        if resp2 is not None:
            soup2 = BeautifulSoup(resp2.text, "html.parser")
            fallback_links = soup2.select(".rankingnews_box a.list_title, .rankingnews_box a")
            _add_links(fallback_links, count)

    # 기사 상세 수집
    results = []
    for article_url in articles[:count]:
        meta = fetch_article_meta(article_url)
        if meta:
            meta["section"] = section_name
            meta["source_type"] = "인기"
            results.append(meta)
        print(f"  [{section_name}] {len(results)}/{count}", end="\r")

    print(f"  [{section_name}] 수집 완료: {len(results)}개")
    return results


# ── 키워드 검색 크롤링 ────────────────────────────────

def crawl_keyword_search(keyword: str, top_n: int = 3) -> list[dict]:
    """네이버 뉴스 키워드 검색 (최신순, 48시간 이내)"""
    now = datetime.now()
    ds = (now - timedelta(hours=48)).strftime("%Y.%m.%d")
    de = now.strftime("%Y.%m.%d")

    params = {
        "where": "news",
        "query": keyword,
        "sort": "1",  # 최신순
        "ds": ds,
        "de": de,
        "nso": f"so:dd,p:from{ds.replace('.', '')}to{de.replace('.', '')}",
    }
    url = "https://search.naver.com/search.naver"
    resp = safe_get(url, params=params)
    if resp is None:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")

    # 뉴스 검색 결과 링크 수집 (네이버 뉴스 링크만)
    naver_links = []
    for a in soup.select("a.info"):
        href = a.get("href", "")
        if "news.naver.com" in href:
            naver_links.append(href)

    # 대안 셀렉터
    if not naver_links:
        for a in soup.select("div.news_area a"):
            href = a.get("href", "")
            if "news.naver.com" in href and "/article/" in href:
                if href not in naver_links:
                    naver_links.append(href)

    # 네이버 뉴스 링크 없으면 다른 패턴 시도
    if not naver_links:
        for a in soup.select("a[href*='news.naver.com']"):
            href = a.get("href", "")
            if href not in naver_links:
                naver_links.append(href)

    results = []
    for article_url in naver_links[:top_n]:
        meta = fetch_article_meta(article_url)
        if meta:
            meta["keyword"] = keyword
            meta["source_type"] = "키워드"
            results.append(meta)

    return results


# ── 필터링 & 중복 제거 ───────────────────────────────

# 필터링 통계 (콘솔 리포트용)
filter_stats = {"blacklist": 0, "empty_title": 0, "similar_dedup": 0}


# ── 제목 유사도 기반 중복 제거 (dedup v2) ─────────────

# 한국어 조사/어미 (긴 것부터 매칭)
_KO_SUFFIXES = [
    "에서는", "으로는", "에게는", "부터는",
    "에서", "으로", "에게", "부터", "까지", "처럼", "만큼", "에는",
    "이가", "에도", "와의", "과의", "이나", "이는", "라는", "한테",
    "는", "은", "이", "가", "을", "를", "의", "에", "로", "와", "과",
    "도", "만", "서", "며", "고", "면", "랑", "든",
]

# 숫자+단위 패턴 (핵심 숫자 보존용)
_NUM_UNIT_RE = re.compile(
    r"\d+(?:천|백|십)?(?:만|억)?\s*"
    r"(?:대|명|층|원|건|개|곳|살|세|조|억|만|천|년|월|일|시간|분|kg|cm)"
)
# 한자 숫자 변환
_HANJA_NUMS = {"천": "1000", "백": "100", "십": "10", "만": "10000", "억": "100000000"}


def _extract_keywords(title: str) -> set[str]:
    """제목에서 핵심 키워드 집합 추출 (dedup v2)"""
    keywords = set()

    # 1) 숫자+단위 패턴 먼저 추출 (예: "20대", "7층", "50대", "7000명")
    for m in _NUM_UNIT_RE.finditer(title):
        token = re.sub(r"\s+", "", m.group())  # 공백 제거
        keywords.add(token)

    # 2) 대괄호/따옴표 안 텍스트 제거
    text = re.sub(r"\[.*?\]", "", title)
    text = re.sub(r"['\"""''`].*?['\"""''`]", "", text)

    # 3) 특수문자 제거 (한글, 영문, 숫자, 공백만 남김)
    text = re.sub(r"[^가-힣a-zA-Z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    # 4) 단어별 조사 제거 → 키워드 추출
    for word in text.split():
        # 이미 숫자+단위로 추출된 것은 스킵
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
    """고유명사/핵심 식별자 여부 판정"""
    # 숫자+단위 (20대, 7층, 50대, 7000명 등)
    if _NUM_UNIT_RE.fullmatch(word):
        return True
    if re.match(r"\d+", word):
        return True
    # 3음절 이상 한글 단어 = 고유명사/복합명사 가능성 높음
    if re.fullmatch(r"[가-힣]{3,}", word):
        return True
    # 영문 (브랜드명/인명)
    if re.fullmatch(r"[a-zA-Z]{2,}", word):
        return True
    return False


def _fuzzy_overlap(kw_a: set[str], kw_b: set[str]) -> set[str]:
    """정확 일치 + 포함 관계 일치 (택시기사⊃택시, 요금지불⊃요금 등)"""
    matched = kw_a & kw_b  # 정확 일치
    remaining_a = kw_a - matched
    remaining_b = kw_b - matched
    # A의 키워드가 B의 키워드를 포함하거나 그 반대
    for wa in remaining_a:
        if len(wa) < 2:
            continue
        for wb in remaining_b:
            if len(wb) < 2:
                continue
            if (len(wa) >= 4 and wb in wa) or (len(wb) >= 4 and wa in wb):
                # 포함되는 짧은 쪽을 매칭된 것으로 추가
                matched.add(min(wa, wb, key=len))
    return matched


def _is_same_event(title_a: str, title_b: str) -> bool:
    """두 제목이 같은 사건인지 판정 (다중 신호)"""
    from difflib import SequenceMatcher

    kw_a = _extract_keywords(title_a)
    kw_b = _extract_keywords(title_b)

    if not kw_a or not kw_b:
        return False

    overlap = _fuzzy_overlap(kw_a, kw_b)

    # 신호 1: Jaccard ≥ 0.30
    jaccard = len(overlap) / len(kw_a | kw_b)
    if jaccard >= 0.30:
        return True

    # 신호 2a: 겹치는 키워드 3개 이상 → 무조건 같은 사건
    if len(overlap) >= 3:
        return True

    # 신호 2b: 겹치는 키워드 2개 + 그 중 1개가 고유명사/숫자단위
    if len(overlap) >= 2:
        has_specific = any(_is_specific(w) for w in overlap)
        if has_specific:
            return True

    # 신호 3: SequenceMatcher ≥ 0.40 (제목 원문 기준, 대괄호/따옴표 제거)
    def _strip_noise(t):
        t = re.sub(r"\[.*?\]", "", t)
        t = re.sub(r"['\"""''`]", "", t)
        return t.strip()
    seq = SequenceMatcher(None, _strip_noise(title_a), _strip_noise(title_b)).ratio()
    if seq >= 0.40:
        return True

    return False


def _dedup_by_similarity(articles: list[dict]) -> list[dict]:
    """제목 유사도 기반 중복 제거. 같은 사건 그룹 중 첫 번째만 남김."""
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


def filter_and_deduplicate(articles: list[dict]) -> list[dict]:
    seen_urls = set()
    filtered = []
    for art in articles:
        url = art.get("url", "")
        title = art.get("title", "").strip()

        # URL 중복 제거
        if url in seen_urls:
            continue
        seen_urls.add(url)

        # 빈 제목 / 5글자 미만 제외
        if len(title) < 5:
            filter_stats["empty_title"] += 1
            continue

        # 48시간 필터
        if not is_within_48h(art.get("pub_date")):
            continue

        # 블랙리스트 필터
        if not passes_filter(title):
            filter_stats["blacklist"] += 1
            continue

        # 신선도 태그
        art["freshness"] = freshness_tag(art.get("pub_date"))
        filtered.append(art)

    # 제목 유사도 기반 추가 중복 제거
    filtered = _dedup_by_similarity(filtered)

    # 정렬: 신선 우선, 그 다음 시간 역순
    def sort_key(a):
        f = 0 if a.get("freshness") == "신선" else 1
        dt = a.get("pub_date") or datetime.min
        return (f, -dt.timestamp() if dt != datetime.min else 0)

    filtered.sort(key=sort_key)
    return filtered


# ── Supabase INSERT ───────────────────────────────────

def insert_articles(articles: list[dict], crawl_date: str, batch_size: int = 50) -> int:
    """기사 목록을 Supabase crawled_news 테이블에 배치 INSERT. 삽입된 행 수 반환."""
    if not articles:
        return 0

    supabase = get_client()
    rows = []
    for art in articles:
        pub_date = art.get("pub_date")
        pub_date_iso = pub_date.isoformat() if isinstance(pub_date, datetime) else None

        rows.append({
            "crawl_date": crawl_date,
            "source_type": art.get("source_type", ""),
            "section": art.get("section", ""),
            "keyword": art.get("keyword", ""),
            "title": art.get("title", ""),
            "url": art.get("url", ""),
            "source": art.get("source", ""),
            "body": art.get("body", ""),
            "pub_date": pub_date_iso,
            "freshness": art.get("freshness", ""),
        })

    inserted = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        supabase.table("crawled_news").insert(batch).execute()
        inserted += len(batch)
        print(f"  → INSERT {inserted}/{len(rows)}건 완료", end="\r")

    print(f"  → INSERT 완료: {inserted}건")
    return inserted


# ── 메인 ──────────────────────────────────────────────

def main():
    start_time = datetime.now()
    print(f"=== 뉴스 크롤링 시작: {start_time.strftime('%Y-%m-%d %H:%M:%S')} ===")

    # 1) 인기 섹션
    print("\n[1/2] 인기 섹션 크롤링...")
    all_popular = []
    for sid, name, count in POPULAR_SECTIONS:
        print(f"  → {name} 섹션 (상위 {count}개)")
        articles = crawl_popular_section(sid, name, count)
        all_popular.extend(articles)

    # 2) 키워드 검색
    print(f"\n[2/2] 키워드 검색 크롤링 ({len(SEARCH_KEYWORDS)}개 키워드)...")
    all_keyword = []
    for i, kw in enumerate(SEARCH_KEYWORDS, 1):
        print(f"  → [{i}/{len(SEARCH_KEYWORDS)}] '{kw}'", end="\r")
        articles = crawl_keyword_search(kw, SEARCH_TOP_N)
        all_keyword.extend(articles)
    print(f"  → 키워드 검색 완료: {len(all_keyword)}개 수집")

    # 3) 필터링 & 중복 제거
    print("\n[필터링] 블랙리스트 + 빈 제목 + 유사도 dedup...")
    filter_stats["blacklist"] = 0
    filter_stats["empty_title"] = 0
    filter_stats["similar_dedup"] = 0

    popular_filtered = filter_and_deduplicate(all_popular)
    keyword_filtered = filter_and_deduplicate(all_keyword)

    # 키워드 결과에서 인기 섹션과 URL 중복 제거
    popular_urls = {a["url"] for a in popular_filtered}
    keyword_filtered = [a for a in keyword_filtered if a["url"] not in popular_urls]

    # 전체 합친 후 유사도 dedup 한 번 더 (인기↔키워드 간 중복 제거)
    combined = popular_filtered + keyword_filtered
    deduped = _dedup_by_similarity(combined)
    # dedup 결과를 다시 인기/키워드로 분리
    popular_filtered = [a for a in deduped if a.get("source_type") == "인기"]
    keyword_filtered = [a for a in deduped if a.get("source_type") == "키워드"]

    total = len(popular_filtered) + len(keyword_filtered)
    print(f"  → 인기 섹션: {len(popular_filtered)}개")
    print(f"  → 키워드 검색: {len(keyword_filtered)}개")
    print(f"  → 합계: {total}개")
    print(f"  → [필터] 블랙리스트 제외: {filter_stats['blacklist']}개")
    print(f"  → [필터] 빈 제목 제외: {filter_stats['empty_title']}개")
    print(f"  → [필터] 유사도 dedup 제외: {filter_stats['similar_dedup']}개")

    # 4) Supabase INSERT
    crawl_date = datetime.now().strftime("%Y-%m-%d")
    all_filtered = popular_filtered + keyword_filtered
    print(f"\n[Supabase] crawled_news 테이블에 {len(all_filtered)}건 INSERT 중...")
    inserted = insert_articles(all_filtered, crawl_date)

    end_time = datetime.now()
    elapsed = (end_time - start_time).total_seconds()
    print(f"\n=== 크롤링 완료: {end_time.strftime('%Y-%m-%d %H:%M:%S')} ===")
    print(f"  소요 시간: {elapsed:.1f}초")
    print(f"  INSERT 완료: {inserted}건")
    if fail_log:
        print(f"  실패 항목: {len(fail_log)}개")
        for entry in fail_log:
            print(f"    {entry}")


if __name__ == "__main__":
    main()
