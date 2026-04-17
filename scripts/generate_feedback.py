"""피드백 생성 스크립트.

매주 월요일 오전 9:30 실행.
최근 2주 성과 데이터를 기반으로 기획용 피드백을 생성.
"""

import sys
import os
import json
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lib.supabase_client import get_client
from lib.claude_client import generate


def fetch_recent_data(days=14):
    """최근 N일간 영상 + 통계 데이터."""
    sb = get_client()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    videos_resp = (
        sb.table("videos")
        .select("id, title, video_type, published_at, tags")
        .gte("published_at", since)
        .order("published_at", desc=True)
        .execute()
    )
    videos = videos_resp.data or []

    video_ids = [v["id"] for v in videos]
    stats = []
    if video_ids:
        stats_resp = (
            sb.table("video_stats")
            .select("video_id, views, likes, comments, fetched_at")
            .in_("video_id", video_ids)
            .order("fetched_at", desc=True)
            .execute()
        )
        seen = set()
        for s in (stats_resp.data or []):
            if s["video_id"] not in seen:
                seen.add(s["video_id"])
                stats.append(s)

    return videos, stats


def build_prompt(videos, stats):
    """피드백 생성 프롬프트."""
    stats_map = {s["video_id"]: s for s in stats}

    data = []
    for v in videos:
        s = stats_map.get(v["id"], {})
        data.append({
            "title": v["title"],
            "type": v["video_type"],
            "views": s.get("views", 0),
            "likes": s.get("likes", 0),
            "comments": s.get("comments", 0),
        })
    data.sort(key=lambda x: x["views"], reverse=True)

    return f"""아래는 '양홍수 변호사' 유튜브 채널의 최근 2주 영상 성과입니다.

{json.dumps(data, ensure_ascii=False, indent=2)}

이 데이터를 분석해서 PD가 코워크(기획 회의)에 바로 복붙할 수 있는 피드백을 작성해주세요.

형식:
```
[최근 2주 성과 분석 기반 추천]

잘 된 주제: (구체적 법률 주제 나열)
잘 된 제목 패턴: (어떤 패턴이 효과적이었는지)
부진한 주제: (있으면)

[다음 기획 추천]
- 추천 1: 구체적 주제 + 제목 예시
- 추천 2: 구체적 주제 + 제목 예시
- 추천 3: 구체적 주제 + 제목 예시
```

한국어로, 간결하고 실무적으로 작성. 이모지 사용 OK."""


def extract_keywords(report_text, videos, stats):
    """리포트에서 키워드 추출 (간단 버전)."""
    stats_map = {s["video_id"]: s for s in stats}
    sorted_videos = sorted(videos, key=lambda v: stats_map.get(v["id"], {}).get("views", 0), reverse=True)

    boost = []
    avoid = []
    mid = len(sorted_videos) // 2

    # 상위 절반에서 자주 나오는 키워드
    for v in sorted_videos[:max(mid, 1)]:
        for tag in (v.get("tags") or []):
            if tag not in boost:
                boost.append(tag)

    return boost[:10], avoid[:5]


def main():
    print("[feedback] 최근 2주 데이터 수집...")
    videos, stats = fetch_recent_data(14)
    print(f"[feedback] 영상 {len(videos)}개, 통계 {len(stats)}개")

    if not videos:
        print("[feedback] 데이터 없음. 종료.")
        return

    prompt = build_prompt(videos, stats)

    system = "당신은 유튜브 채널 기획 어드바이저입니다. 성과 데이터를 기반으로 PD에게 다음 기획 방향을 제안합니다. 실무적이고 구체적인 피드백을 제공합니다."

    print("[feedback] Claude API 호출 중...")
    content_md = generate(system, prompt, max_tokens=1024)
    print(f"[feedback] 피드백 생성 완료 ({len(content_md)}자)")

    boost, avoid = extract_keywords(content_md, videos, stats)

    sb = get_client()
    sb.table("feedback").insert({
        "period": "weekly",
        "content_md": content_md,
        "keywords_boost": boost,
        "keywords_avoid": avoid,
        "title_patterns": {"generated_at": datetime.now(timezone.utc).isoformat()},
    }).execute()

    print("[feedback] 저장 완료!")


if __name__ == "__main__":
    main()
