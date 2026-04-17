"""AI 주간 리포트 생성 스크립트.

매주 월요일 오전 9시 실행.
지난 7일간 영상 성과를 분석해서 weekly_reports 테이블에 저장.
"""

import sys
import os
import json
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lib.supabase_client import get_client
from lib.claude_client import generate


def get_week_range():
    """이번 주 월~일 범위를 반환."""
    today = datetime.now(timezone.utc).date()
    # 월요일 기준
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)
    week_start = monday - timedelta(days=7)  # 지난주 월요일
    week_end = monday - timedelta(days=1)    # 지난주 일요일
    return week_start, week_end


def fetch_week_data(week_start, week_end):
    """해당 주간의 영상 + 통계 데이터를 가져온다."""
    sb = get_client()

    # 해당 기간 영상
    videos_resp = (
        sb.table("videos")
        .select("id, title, video_type, published_at, tags")
        .gte("published_at", week_start.isoformat())
        .lte("published_at", week_end.isoformat() + "T23:59:59")
        .order("published_at", desc=True)
        .execute()
    )
    videos = videos_resp.data or []

    # 모든 영상의 최신 통계 (기간 무관 - 전체 영상 성과 비교용)
    all_videos_resp = sb.table("videos").select("id, title, video_type, published_at").execute()
    all_ids = [v["id"] for v in (all_videos_resp.data or [])]

    stats = []
    if all_ids:
        stats_resp = (
            sb.table("video_stats")
            .select("video_id, views, likes, comments, fetched_at")
            .in_("video_id", all_ids)
            .order("fetched_at", desc=True)
            .execute()
        )
        # 각 영상의 최신 통계만
        seen = set()
        for s in (stats_resp.data or []):
            if s["video_id"] not in seen:
                seen.add(s["video_id"])
                stats.append(s)

    return videos, all_videos_resp.data or [], stats


def build_prompt(videos, all_videos, stats, week_start, week_end):
    """Claude에게 보낼 프롬프트를 생성."""
    # 통계를 video_id로 인덱싱
    stats_map = {s["video_id"]: s for s in stats}

    # 이번 주 영상 + 통계
    week_data = []
    for v in videos:
        s = stats_map.get(v["id"], {})
        week_data.append({
            "title": v["title"],
            "type": v["video_type"],
            "views": s.get("views", 0),
            "likes": s.get("likes", 0),
            "comments": s.get("comments", 0),
        })

    # 전체 영상 통계 (비교용)
    all_data = []
    for v in all_videos:
        s = stats_map.get(v["id"], {})
        all_data.append({
            "title": v["title"],
            "type": v["video_type"],
            "views": s.get("views", 0),
            "likes": s.get("likes", 0),
        })
    all_data.sort(key=lambda x: x["views"], reverse=True)

    return f"""아래는 '{week_start} ~ {week_end}' 기간의 유튜브 채널 '양홍수 변호사' 성과 데이터입니다.

## 이번 주 업로드 영상 ({len(week_data)}개)
{json.dumps(week_data, ensure_ascii=False, indent=2)}

## 전체 영상 조회수 순위 (상위 20개)
{json.dumps(all_data[:20], ensure_ascii=False, indent=2)}

위 데이터를 분석해서 아래 형식의 주간 리포트를 작성해주세요.
기획 추천은 하지 마세요. 성과 분석과 패턴 도출까지만.

각 섹션은 ## 제목 형식으로, 번호 붙이지 마세요.

## 이번 주 TOP 3 영상 공통점
(주제, 제목 스타일, 길이 등)

## 성과 좋은 주제 패턴
(어떤 법률 주제가 조회수 높은지, 표로 정리)

## 성과 좋은 제목 패턴
(질문형/공분형/반전형 등 카테고리별 분석)

## 부진 영상 분석
(왜 안 됐는지, 주제·타이밍·제목 중 원인 분석)

## 숏폼 vs 롱폼 성과 비교
(유형별 평균 조회수, 어느 쪽이 효과적인지)

## 핵심 인사이트
(🔥/❄️ 이모지로 시작하는 한 줄 인사이트 3~5개)

한국어로, 실무적이고 간결하게 작성해주세요. 마크다운 형식. 코드블록 없이."""


def main():
    week_start, week_end = get_week_range()
    print(f"[weekly_report] 기간: {week_start} ~ {week_end}")

    videos, all_videos, stats = fetch_week_data(week_start, week_end)
    print(f"[weekly_report] 이번 주 영상: {len(videos)}개, 전체: {len(all_videos)}개")

    prompt = build_prompt(videos, all_videos, stats, week_start, week_end)

    system = "당신은 유튜브 채널 성과 분석 전문가입니다. 법률 유튜브 채널의 데이터를 분석하고, PD에게 실무적인 인사이트를 제공합니다."

    print("[weekly_report] Claude API 호출 중...")
    report_md = generate(system, prompt, max_tokens=2048)
    print(f"[weekly_report] 리포트 생성 완료 ({len(report_md)}자)")

    # TOP 3 영상 추출
    stats_map = {s["video_id"]: s for s in stats}
    week_with_stats = []
    for v in videos:
        s = stats_map.get(v["id"], {})
        week_with_stats.append({"id": v["id"], "title": v["title"], "views": s.get("views", 0)})
    week_with_stats.sort(key=lambda x: x["views"], reverse=True)
    top3 = week_with_stats[:3]

    # Supabase 저장
    sb = get_client()
    sb.table("weekly_reports").insert({
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "report_md": report_md,
        "top_videos": top3,
        "patterns": {"generated_at": datetime.now(timezone.utc).isoformat()},
        "recommendations": {"source": "claude-sonnet-4-6"},
    }).execute()

    print("[weekly_report] 저장 완료!")


if __name__ == "__main__":
    main()
