"""크롤링 필터: 블랙리스트, 예외룰, 중복 제거."""

# 블랙리스트 도메인/키워드 (기존 크롤러에서 이전 예정)
BLACKLIST_SOURCES: list[str] = []
BLACKLIST_KEYWORDS: list[str] = []


def is_blacklisted(title: str, source: str = "") -> bool:
    """블랙리스트에 해당하면 True."""
    title_lower = title.lower()
    for kw in BLACKLIST_KEYWORDS:
        if kw.lower() in title_lower:
            return True
    for src in BLACKLIST_SOURCES:
        if src.lower() in source.lower():
            return True
    return False


def deduplicate(items: list[dict], key: str = "title", threshold: float = 0.8) -> list[dict]:
    """제목 기반 단순 중복 제거. 동일 제목은 첫 번째만 남김."""
    seen: set[str] = set()
    result = []
    for item in items:
        val = item.get(key, "").strip()
        if val not in seen:
            seen.add(val)
            result.append(item)
    return result
