"""영상 성과 수집 스크립트.

매일 밤 11:00 실행 → 모든 영상의 현재 통계 → video_stats 테이블에 INSERT.
시계열로 쌓아서 성과 변화를 추적한다.
"""

import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lib.youtube_client import fetch_video_stats
from lib.supabase_client import get_client


def get_all_video_ids() -> list[str]:
    """videos 테이블의 모든 video_id를 반환."""
    sb = get_client()
    resp = sb.table("videos").select("id").execute()
    return [row["id"] for row in (resp.data or [])]


def insert_stats(stats: list[dict]) -> int:
    """video_stats 테이블에 INSERT. 삽입 건수 반환."""
    if not stats:
        return 0

    sb = get_client()
    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for s in stats:
        rows.append({
            "video_id": s["video_id"],
            "fetched_at": now,
            "views": s["views"],
            "likes": s["likes"],
            "comments": s["comments"],
        })

    resp = sb.table("video_stats").insert(rows).execute()
    return len(resp.data) if resp.data else 0


def main():
    video_ids = get_all_video_ids()
    print(f"[fetch_stats] 총 {len(video_ids)}개 영상 통계 수집")

    if not video_ids:
        print("[fetch_stats] 수집할 영상 없음. 먼저 fetch_videos.py 실행 필요.")
        return

    stats = fetch_video_stats(video_ids)
    print(f"[fetch_stats] API에서 {len(stats)}개 통계 수신")

    count = insert_stats(stats)
    print(f"[fetch_stats] {count}개 통계 저장 완료")


if __name__ == "__main__":
    main()
