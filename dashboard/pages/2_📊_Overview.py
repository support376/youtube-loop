"""Overview 탭 - 전체 채널 성과 요약."""

import streamlit as st
import pandas as pd
import plotly.express as px
from datetime import datetime, timedelta
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from dashboard.components.db import get_supabase

st.header("📊 Overview")

# --- 기간 필터 ---
period = st.selectbox("기간", ["최근 7일", "최근 30일", "전체"], index=0)
now = datetime.utcnow()
if period == "최근 7일":
    since = (now - timedelta(days=7)).isoformat()
elif period == "최근 30일":
    since = (now - timedelta(days=30)).isoformat()
else:
    since = "2000-01-01T00:00:00"

sb = get_supabase()

# --- 영상 목록 ---
videos_resp = sb.table("videos").select("*").gte("published_at", since).order("published_at", desc=True).execute()
videos_df = pd.DataFrame(videos_resp.data) if videos_resp.data else pd.DataFrame()

if videos_df.empty:
    st.info("해당 기간에 영상이 없습니다.")
    st.stop()

video_ids = videos_df["id"].tolist()

# --- 최신 통계 (각 영상의 가장 최근 stats) ---
stats_resp = sb.table("video_stats").select("*").in_("video_id", video_ids).order("fetched_at", desc=True).execute()
stats_df = pd.DataFrame(stats_resp.data) if stats_resp.data else pd.DataFrame()

if stats_df.empty:
    st.info("통계 데이터가 아직 없습니다.")
    st.stop()

# 각 영상의 최신 통계만 추출
latest_stats = stats_df.drop_duplicates(subset="video_id", keep="first")

# --- 핵심 지표 ---
total_views = latest_stats["views"].sum()
total_likes = latest_stats["likes"].sum()
total_comments = latest_stats["comments"].sum()
video_count = len(videos_df)

col1, col2, col3, col4 = st.columns(4)
col1.metric("총 조회수", f"{total_views:,}")
col2.metric("총 좋아요", f"{total_likes:,}")
col3.metric("총 댓글", f"{total_comments:,}")
col4.metric("영상 수", f"{video_count}개")

# --- 영상별 조회수 바 차트 ---
st.subheader("영상별 조회수")
merged = videos_df[["id", "title", "published_at"]].merge(
    latest_stats[["video_id", "views", "likes", "comments"]],
    left_on="id", right_on="video_id", how="left",
)
merged = merged.sort_values("views", ascending=True)
merged["short_title"] = merged["title"].str[:30]

fig = px.bar(
    merged,
    x="views",
    y="short_title",
    orientation="h",
    labels={"views": "조회수", "short_title": ""},
    hover_data={"title": True, "likes": True, "comments": True},
)
fig.update_layout(height=max(300, len(merged) * 40), showlegend=False)
st.plotly_chart(fig, use_container_width=True)

# --- 일별 업로드 현황 ---
st.subheader("일별 업로드 현황")
videos_df["date"] = pd.to_datetime(videos_df["published_at"]).dt.date
daily = videos_df.groupby("date").size().reset_index(name="count")
fig2 = px.bar(daily, x="date", y="count", labels={"date": "날짜", "count": "업로드 수"})
st.plotly_chart(fig2, use_container_width=True)
