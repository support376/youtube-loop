"""Videos 탭 - 영상별 성과 상세."""

import streamlit as st
import pandas as pd
import plotly.express as px
from datetime import datetime, timedelta
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from dashboard.components.db import get_supabase

st.header("🎬 Videos")

sb = get_supabase()

# --- 영상 + 최신 통계 ---
videos_resp = sb.table("videos").select("*").order("published_at", desc=True).execute()
videos_df = pd.DataFrame(videos_resp.data) if videos_resp.data else pd.DataFrame()

if videos_df.empty:
    st.info("영상 데이터가 없습니다.")
    st.stop()

video_ids = videos_df["id"].tolist()
stats_resp = sb.table("video_stats").select("*").in_("video_id", video_ids).order("fetched_at", desc=True).execute()
stats_df = pd.DataFrame(stats_resp.data) if stats_resp.data else pd.DataFrame()

if stats_df.empty:
    st.info("통계 데이터가 아직 없습니다.")
    st.stop()

latest_stats = stats_df.drop_duplicates(subset="video_id", keep="first")
merged = videos_df.merge(latest_stats[["video_id", "views", "likes", "comments"]], left_on="id", right_on="video_id", how="left")

# --- 기간 필터 ---
period = st.selectbox("기간", ["이번 주", "이번 달", "전체"], index=2)
now = datetime.utcnow()
if period == "이번 주":
    since = (now - timedelta(days=7)).isoformat()
elif period == "이번 달":
    since = (now - timedelta(days=30)).isoformat()
else:
    since = "2000-01-01T00:00:00"
merged["published_at"] = pd.to_datetime(merged["published_at"])
filtered = merged[merged["published_at"] >= since].copy()

# --- TOP 10 영상 ---
st.subheader(f"TOP 10 영상 ({period})")
top10 = filtered.nlargest(10, "views")[["title", "video_type", "published_at", "views", "likes", "comments"]]
top10.columns = ["제목", "유형", "업로드일", "조회수", "좋아요", "댓글"]
top10["업로드일"] = top10["업로드일"].dt.strftime("%Y-%m-%d")
top10["유형"] = top10["유형"].map({"short": "숏", "long": "롱"})
st.dataframe(top10, use_container_width=True, hide_index=True)

# --- 영상 유형별 성과 ---
st.subheader("숏폼 vs 롱폼")
type_summary = filtered.groupby("video_type").agg(
    영상수=("id", "count"),
    평균조회수=("views", "mean"),
    평균좋아요=("likes", "mean"),
).reset_index()
type_summary["video_type"] = type_summary["video_type"].map({"short": "숏폼", "long": "롱폼"})
type_summary["평균조회수"] = type_summary["평균조회수"].round(0).astype(int)
type_summary["평균좋아요"] = type_summary["평균좋아요"].round(0).astype(int)
type_summary.columns = ["유형", "영상수", "평균조회수", "평균좋아요"]
st.dataframe(type_summary, use_container_width=True, hide_index=True)

# --- 제목 패턴 분석 ---
st.subheader("제목 패턴 분석")
filtered["has_question"] = filtered["title"].str.contains(r"\?|일까|인가|할까|인지|나요", regex=True)
filtered["has_number"] = filtered["title"].str.contains(r"\d+", regex=True)
filtered["has_warning"] = filtered["title"].str.contains(r"주의|경고|위험|조심|충격|논란|폭로", regex=True)

patterns = {
    "질문형 (?)": filtered[filtered["has_question"]],
    "숫자 포함": filtered[filtered["has_number"]],
    "경고/논란형": filtered[filtered["has_warning"]],
}

rows = []
for name, df in patterns.items():
    if not df.empty:
        rows.append({
            "패턴": name,
            "영상수": len(df),
            "평균조회수": int(df["views"].mean()),
            "평균좋아요": int(df["likes"].mean()),
        })
if rows:
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
else:
    st.caption("분석할 데이터가 부족합니다.")

# --- 전체 영상 테이블 ---
st.subheader("전체 영상 목록")
all_videos = filtered[["title", "video_type", "published_at", "views", "likes", "comments"]].copy()
all_videos.columns = ["제목", "유형", "업로드일", "조회수", "좋아요", "댓글"]
all_videos["업로드일"] = all_videos["업로드일"].dt.strftime("%Y-%m-%d")
all_videos["유형"] = all_videos["유형"].map({"short": "숏", "long": "롱"})
st.dataframe(all_videos, use_container_width=True, hide_index=True)
