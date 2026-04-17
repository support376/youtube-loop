"""크롤러용 HTTP 클라이언트 — 재시도, UA 로테이션, 안정성 강화."""

import random
import time
import requests

# User-Agent 로테이션 풀
_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]

# 요청 간 딜레이 (초)
REQUEST_DELAY = 1.5

# 재시도 설정
MAX_RETRIES = 3
BACKOFF_BASE = 2  # 2초, 4초, 8초

fail_log: list[str] = []

session = requests.Session()


def _random_headers() -> dict:
    return {
        "User-Agent": random.choice(_USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    }


def safe_get(url: str, params=None, timeout=15) -> requests.Response | None:
    """HTTP GET with retry + backoff + UA rotation."""
    for attempt in range(MAX_RETRIES):
        try:
            session.headers.update(_random_headers())
            resp = session.get(url, params=params, timeout=timeout)
            resp.raise_for_status()
            time.sleep(REQUEST_DELAY + random.uniform(0, 0.5))
            return resp
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else 0
            if status == 403:
                # 403은 재시도해도 안 됨 — 바로 포기
                fail_log.append(f"[403 차단] {url}")
                return None
            if status == 429:
                # Rate limit — 길게 대기 후 재시도
                wait = BACKOFF_BASE ** (attempt + 2)
                print(f"  [429 Rate Limit] {wait}초 대기 후 재시도...")
                time.sleep(wait)
                continue
            fail_log.append(f"[HTTP {status}] {url}")
            return None
        except (requests.exceptions.ConnectTimeout, requests.exceptions.ConnectionError) as e:
            wait = BACKOFF_BASE ** (attempt + 1)
            if attempt < MAX_RETRIES - 1:
                print(f"  [연결 실패] {attempt + 1}/{MAX_RETRIES} — {wait}초 후 재시도")
                time.sleep(wait)
            else:
                fail_log.append(f"[연결 실패 {MAX_RETRIES}회] {url} → {type(e).__name__}")
                return None
        except Exception as e:
            fail_log.append(f"[GET 실패] {url} → {e}")
            return None
    return None


def reset_fail_log():
    """fail_log 초기화."""
    fail_log.clear()


def get_fail_log() -> list[str]:
    return fail_log
