"""피드백 생성 스크립트.

매주 월요일 오전 9:30 실행.
2단계: 1) 구조화 JSON 생성 2) PD용 텍스트 생성
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
    # 첫 번째 완전한 JSON 객체만 추출 (중괄호 매칭)
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
    data_str = json.dumps(data, ensure_ascii=False, indent=2)

    # ── 1단계: 구조화 JSON (짧은 프롬프트 + 압축 데이터) ──
    # 데이터를 제목+조회수만 압축
    compact = [{"title": d["title"], "views": d["views"]} for d in data]
    compact_str = json.dumps(compact, ensure_ascii=False)

    json_prompt = (
        '분석 후 JSON으로만 응답. 줄바꿈 없이 한 줄로.\n\n'
        '{"keywords_boost":["주제3~6개"],"keywords_avoid":["부진주제1~3개"],'
        '"title_patterns":{"질문형":["예시2개"],"공분형":["예시2개"],"반전형":["예시2개"]},'
        '"principles":["원칙3~5개"],"top_formula":"공식1줄",'
        '"avoid_reasons":["이유1줄씩"],'
        '"recommendations":[{"title":"주제","desc":"설명","example":"제목예시"}]}\n\n'
        '데이터: ' + compact_str
    )

    system_json = "JSON만 출력. 다른 텍스트 금지."

    print("[feedback] 1단계: 구조화 JSON 생성...")
    raw_json = generate(system_json, json_prompt, max_tokens=1500)

    try:
        parsed = parse_json(raw_json)
        print("[feedback] JSON 파싱 성공!")
    except Exception as e:
        print(f"[feedback] JSON 파싱 실패: {e}")
        parsed = {}

    boost = list(dict.fromkeys(parsed.get("keywords_boost", [])))
    avoid = list(dict.fromkeys(parsed.get("keywords_avoid", [])))
    title_patterns = parsed.get("title_patterns", {})
    for cat in list(title_patterns.keys()):
        if isinstance(title_patterns[cat], list):
            title_patterns[cat] = list(dict.fromkeys(title_patterns[cat]))

    # 메타 정보 저장
    title_patterns["_top_formula"] = parsed.get("top_formula", "")
    title_patterns["_avoid_reasons"] = parsed.get("avoid_reasons", [])
    title_patterns["_principles"] = parsed.get("principles", [])
    title_patterns["_recommendations"] = parsed.get("recommendations", [])
    title_patterns["_generated_at"] = datetime.now(timezone.utc).isoformat()

    # ── 2단계: PD용 텍스트 ──
    text_prompt = f"""아래는 유튜브 채널 '양홍수 변호사'의 최근 2주 영상 성과입니다.

{data_str}

PD가 기획 회의에서 참고할 피드백을 작성해주세요.
코드블록 없이, 간결하게.
잘 된 주제, 부진한 주제, 제목 패턴, 다음 기획 추천 3건 포함."""

    system_text = "유튜브 채널 기획 어드바이저. PD에게 실무적이고 구체적인 피드백을 제공합니다."

    print("[feedback] 2단계: PD용 텍스트 생성...")
    content_md = generate(system_text, text_prompt, max_tokens=1024)
    # 코드블록 잔재물 제거
    content_md = content_md.replace("```", "").strip()

    # ── 저장 ──
    sb = get_client()
    sb.table("feedback").insert({
        "period": "weekly",
        "content_md": content_md,
        "keywords_boost": boost,
        "keywords_avoid": avoid,
        "title_patterns": title_patterns,
    }).execute()

    print(f"[feedback] 저장 완료!")
    print(f"  boost: {boost}")
    print(f"  avoid: {avoid}")
    print(f"  patterns: {[k for k in title_patterns if not k.startswith('_')]}")
    print(f"  principles: {len(parsed.get('principles', []))}개")
    print(f"  formula: {parsed.get('top_formula', '')}")


if __name__ == "__main__":
    main()
