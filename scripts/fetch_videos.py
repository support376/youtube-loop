"""YouTube 영상 메타 수집 스크립트.

매일 오후 2:00 실행 → 새 영상 감지 → videos 테이블에 INSERT.
"""

import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lib.youtube_client import fetch_channel_videos
from lib.supabase_client import get_client

CHANNEL_ID = os.environ.get("CHANNEL_ID", "UC5u8YtYZNJdxw1-qObwISpw")


def get_latest_published_at() -> str | None:
    """DB에 저장된 가장 최근 영상의 published_at을 반환."""
    sb = get_client()
    resp = (
        sb.table("videos")
        .select("published_at")
        .eq("channel_id", CHANNEL_ID)
        .order("published_at", desc=True)
        .limit(1)
        .execute()
    )
    if resp.data:
        return resp.data[0]["published_at"]
    return None


def upsert_videos(videos: list[dict]) -> int:
    """영상 메타를 videos 테이블에 upsert. 삽입 건수 반환."""
    if not videos:
        return 0

    sb = get_client()
    rows = []
    for v in videos:
        rows.append({
            "id": v["id"],
            "channel_id": v["channel_id"],
            "title": v["title"],
            "description": v["description"],
            "published_at": v["published_at"],
            "duration_sec": v["duration_sec"],
            "video_type": v["video_type"],
            "tags": v["tags"],
            "thumbnail_url": v["thumbnail_url"],
        })

    resp = sb.table("videos").upsert(rows, on_conflict="id").execute()
    return len(resp.data) if resp.data else 0


def main():
    print(f"[fetch_videos] 채널: {CHANNEL_ID}")

    # 마지막 수집 이후 영상만 가져오기
    last = get_latest_published_at()
    if last:
        print(f"[fetch_videos] 마지막 영상: {last}")
        videos = fetch_channel_videos(CHANNEL_ID, published_after=last)
    else:
        print("[fetch_videos] 첫 수집 - 최근 50개 영상 가져오기")
        videos = fetch_channel_videos(CHANNEL_ID, max_results=50)

    print(f"[fetch_videos] API에서 {len(videos)}개 영상 발견")

    count = upsert_videos(videos)
    print(f"[fetch_videos] {count}개 영상 저장 완료")


if __name__ == "__main__":
    main()
