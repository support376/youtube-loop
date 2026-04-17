"""피드백 생성 스크립트.

매주 월요일 오전 9:30 실행.
2단계: 1) 구조화 JSON 생성 2) PD용 텍스트 생성
keywords_avoid에 이유 포함, principles 구조화 저장, 샘플 수 기록.
"""

import sys
import os
import json
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lib.supabase_client import get_client
from lib.claude_client import generate


def fetch_recent_data(days=14):
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


def build_data(videos, stats):
    stats_map = {s["video_id"]: s for s in stats}
    data = []
    for v in videos:
        s = stats_map.get(v["id"], {})
        data.append({
            "title": v["title"],
            "type": v["video_type"],
            "views": s.get("views", 0),
            "likes": s.get("likes", 0),
        })
    data.sort(key=lambda x: x["views"], reverse=True)
    return data


def parse_json(text):
    text = text.strip()
    if "```" in text:
        for part in text.split("```"):
            part = part.strip().removeprefix("json").strip()
            if part.startswith("{"):
                text = part
                break
    start = text.find("{")
    if start < 0:
        return json.loads(text)
    depth = 0
    end = start
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    return json.loads(text[start:end])


def main():
    print("[feedback] 최근 2주 데이터 수집...")
    videos, stats = fetch_recent_data(14)
    print(f"[feedback] 영상 {len(videos)}개, 통계 {len(stats)}개")

    if not videos:
        print("[feedback] 데이터 없음. 종료.")
        return

    data = build_data(videos, stats)
    sample_count = len(data)

    # 압축 데이터
    compact = [{"title": d["title"], "views": d["views"]} for d in data]
    compact_str = json.dumps(compact, ensure_ascii=False)

    # ── 1단계: 구조화 JSON (성과 분석 + 규칙 도출만, 기획 추천 없음) ──
    json_prompt = (
        '분석 후 JSON으로만 응답. 줄바꿈 없이 한 줄로.\n'
        '기획 추천은 하지 마. 성과 분석과 규칙 도출까지만.\n\n'
        '{"keywords_boost":[{"keyword":"주제","views":"대표영상 조회수","video":"대표영상제목"}],'
        '"keywords_avoid":[{"keyword":"주제","views":"조회수","reason":"부진이유 1줄"}],'
        '"title_patterns":{"질문형":["예시2개"],"공분형":["예시2개"],"반전형":["예시2개"]},'
        '"principles":["데이터 기반 운영원칙 5~7개, 구체적으로"],'
        '"top_formula":"[주제]+[패턴]=조회수N+ 형태 공식1줄"}\n\n'
        '데이터: ' + compact_str
    )

    print("[feedback] 1단계: 구조화 JSON 생성...")
    raw_json = generate("JSON만 출력. 다른 텍스트 금지.", json_prompt, max_tokens=1500)

    try:
        parsed = parse_json(raw_json)
        print("[feedback] JSON 파싱 성공!")
    except Exception as e:
        print(f"[feedback] JSON 파싱 실패: {e}")
        parsed = {}

    # boost: [{keyword, views, video}] → keywords_boost에는 keyword만, 상세는 title_patterns에 저장
    boost_raw = parsed.get("keywords_boost", [])
    if boost_raw and isinstance(boost_raw[0], dict):
        boost_keywords = list(dict.fromkeys(b["keyword"] for b in boost_raw))
        boost_details = boost_raw
    else:
        # 폴백: 문자열 배열
        boost_keywords = list(dict.fromkeys(boost_raw))
        boost_details = [{"keyword": k, "views": "", "video": ""} for k in boost_keywords]

    # avoid: [{keyword, views, reason}]
    avoid_raw = parsed.get("keywords_avoid", [])
    if avoid_raw and isinstance(avoid_raw[0], dict):
        avoid_keywords = list(dict.fromkeys(a["keyword"] for a in avoid_raw))
        avoid_details = avoid_raw
    else:
        avoid_keywords = list(dict.fromkeys(avoid_raw))
        avoid_details = [{"keyword": k, "views": "", "reason": ""} for k in avoid_keywords]

    # title_patterns
    title_patterns = parsed.get("title_patterns", {})
    for cat in list(title_patterns.keys()):
        if isinstance(title_patterns[cat], list):
            title_patterns[cat] = list(dict.fromkeys(title_patterns[cat]))

    # 메타 정보 저장
    title_patterns["_top_formula"] = parsed.get("top_formula", "")
    title_patterns["_boost_details"] = boost_details
    title_patterns["_avoid_details"] = avoid_details
    title_patterns["_principles"] = parsed.get("principles", [])
    title_patterns["_sample_count"] = sample_count
    title_patterns["_generated_at"] = datetime.now(timezone.utc).isoformat()

    # ── 2단계: PD용 텍스트 (성과 분석만, 기획 추천 없음) ──
    data_str = json.dumps(data, ensure_ascii=False, indent=2)
    text_prompt = f"""아래는 유튜브 채널 '양홍수 변호사'의 최근 2주 영상 성과입니다.

{data_str}

PD가 기획 회의에서 참고할 성과 분석 피드백을 작성해주세요.
코드블록 없이, 마크다운으로, 간결하게.
포함할 내용: 잘 된 주제 분석, 부진한 주제 분석, 제목 패턴 분석, 운영 원칙.
기획 추천이나 제목 예시는 넣지 마세요. 성과 분석과 규칙 도출까지만."""

    print("[feedback] 2단계: PD용 텍스트 생성...")
    content_md = generate(
        "유튜브 채널 성과 분석가. 데이터 기반 분석과 규칙 도출만 수행. 기획 추천은 하지 않음.",
        text_prompt,
        max_tokens=3000,
    )
    content_md = content_md.replace("```", "").strip()

    # ── 저장 ──
    sb = get_client()
    sb.table("feedback").insert({
        "period": "weekly",
        "content_md": content_md,
        "keywords_boost": boost_keywords,
        "keywords_avoid": avoid_keywords,
        "title_patterns": title_patterns,
    }).execute()

    print(f"[feedback] 저장 완료!")
    print(f"  샘플: {sample_count}개 영상")
    print(f"  boost: {boost_keywords}")
    print(f"  avoid: {[a.get('keyword','') + ' — ' + a.get('reason','') for a in avoid_details]}")
    print(f"  patterns: {[k for k in title_patterns if not k.startswith('_')]}")
    print(f"  principles: {len(parsed.get('principles', []))}개")
    print(f"  formula: {parsed.get('top_formula', '')}")


if __name__ == "__main__":
    main()
