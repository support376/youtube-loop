"""YouTube Data API v3 클라이언트."""

import os
import re
from datetime import datetime, timezone
from dotenv import load_dotenv
from googleapiclient.discovery import build

load_dotenv()

_service = None


def get_service():
    """YouTube API 서비스 객체를 반환한다."""
    global _service
    if _service is None:
        api_key = os.environ["YOUTUBE_API_KEY"]
        _service = build("youtube", "v3", developerKey=api_key)
    return _service


def parse_duration(iso_duration: str) -> int:
    """ISO 8601 duration(PT#H#M#S)을 초 단위로 변환."""
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso_duration or "")
    if not match:
        return 0
    h = int(match.group(1) or 0)
    m = int(match.group(2) or 0)
    s = int(match.group(3) or 0)
    return h * 3600 + m * 60 + s


def fetch_channel_videos(channel_id: str, published_after: str | None = None, max_results: int = 50) -> list[dict]:
    """채널의 영상 목록을 가져온다.

    Args:
        channel_id: YouTube 채널 ID
        published_after: ISO 8601 날짜 (이후 영상만 조회)
        max_results: 최대 결과 수

    Returns:
        영상 정보 dict 리스트
    """
    yt = get_service()

    # 1) search.list로 영상 ID 목록 가져오기
    search_params = {
        "channelId": channel_id,
        "part": "id",
        "type": "video",
        "order": "date",
        "maxResults": min(max_results, 50),
    }
    if published_after:
        search_params["publishedAfter"] = published_after

    video_ids = []
    next_page = None

    while len(video_ids) < max_results:
        if next_page:
            search_params["pageToken"] = next_page
        resp = yt.search().list(**search_params).execute()
        for item in resp.get("items", []):
            video_ids.append(item["id"]["videoId"])
        next_page = resp.get("nextPageToken")
        if not next_page:
            break

    if not video_ids:
        return []

    # 2) videos.list로 상세 정보
    videos = []
    # API는 한 번에 50개까지
    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i:i + 50]
        resp = yt.videos().list(
            part="snippet,contentDetails,statistics",
            id=",".join(chunk),
        ).execute()

        for item in resp.get("items", []):
            snippet = item["snippet"]
            details = item["contentDetails"]
            stats = item.get("statistics", {})
            duration_sec = parse_duration(details.get("duration", ""))

            videos.append({
                "id": item["id"],
                "channel_id": channel_id,
                "title": snippet["title"],
                "description": snippet.get("description", ""),
                "published_at": snippet["publishedAt"],
                "duration_sec": duration_sec,
                "video_type": "short" if duration_sec <= 60 else "long",
                "tags": snippet.get("tags", []),
                "thumbnail_url": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
                "views": int(stats.get("viewCount", 0)),
                "likes": int(stats.get("likeCount", 0)),
                "comments": int(stats.get("commentCount", 0)),
            })

    return videos


def fetch_video_stats(video_ids: list[str]) -> list[dict]:
    """영상 ID 목록에 대한 현재 통계를 가져온다."""
    yt = get_service()
    stats = []

    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i:i + 50]
        resp = yt.videos().list(
            part="statistics",
            id=",".join(chunk),
        ).execute()

        for item in resp.get("items", []):
            s = item["statistics"]
            stats.append({
                "video_id": item["id"],
                "views": int(s.get("viewCount", 0)),
                "likes": int(s.get("likeCount", 0)),
                "comments": int(s.get("commentCount", 0)),
            })

    return stats
