"""Overview 탭 - 전체 채널 성과 요약."""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta, timezone
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from dashboard.components.db import get_supabase

# --- 사이드바 로고 ---
st.sidebar.markdown(
    "<h1 style='text-align:center; font-size:2rem; margin-bottom:0;'>📊 YouTube Loop</h1>"
    "<p style='text-align:center; color:gray; font-size:0.85rem; margin-top:0;'>Circle21 채널 분석</p>",
    unsafe_allow_html=True,
)
st.sidebar.markdown("---")

st.header("📊 Overview")

# --- 기간 필터 ---
period = st.selectbox("기간", ["최근 7일", "최근 30일", "전체"], index=0)
now = datetime.now(timezone.utc)
if period == "최근 7일":
    since = (now - timedelta(days=7)).isoformat()
    prev_since = (now - timedelta(days=14)).isoformat()
    prev_until = (now - timedelta(days=7)).isoformat()
elif period == "최근 30일":
    since = (now - timedelta(days=30)).isoformat()
    prev_since = (now - timedelta(days=60)).isoformat()
    prev_until = (now - timedelta(days=30)).isoformat()
else:
    since = "2000-01-01T00:00:00"
    prev_since = None
    prev_until = None

sb = get_supabase()

# --- 영상 목록 ---
videos_resp = sb.table("videos").select("*").gte("published_at", since).order("published_at", desc=True).execute()
videos_df = pd.DataFrame(videos_resp.data) if videos_resp.data else pd.DataFrame()

if videos_df.empty:
    st.info("해당 기간에 영상이 없습니다.")
    st.stop()

video_ids = videos_df["id"].tolist()

# --- 최신 통계 ---
stats_resp = sb.table("video_stats").select("*").in_("video_id", video_ids).order("fetched_at", desc=True).execute()
stats_df = pd.DataFrame(stats_resp.data) if stats_resp.data else pd.DataFrame()

if stats_df.empty:
    st.info("통계 데이터가 아직 없습니다.")
    st.stop()

latest_stats = stats_df.drop_duplicates(subset="video_id", keep="first")

# --- 전주 데이터 (비교용) ---
pw_views, pw_likes, pw_comments, pw_count = 0, 0, 0, 0
if prev_since and prev_until:
    prev_resp = sb.table("videos").select("id").gte("published_at", prev_since).lt("published_at", prev_until).execute()
    prev_ids = [r["id"] for r in (prev_resp.data or [])]
    pw_count = len(prev_ids)
    if prev_ids:
        prev_stats_resp = sb.table("video_stats").select("*").in_("video_id", prev_ids).order("fetched_at", desc=True).execute()
        if prev_stats_resp.data:
            prev_stats = pd.DataFrame(prev_stats_resp.data).drop_duplicates(subset="video_id", keep="first")
            pw_views = int(prev_stats["views"].sum())
            pw_likes = int(prev_stats["likes"].sum())
            pw_comments = int(prev_stats["comments"].sum())

# --- 핵심 지표 ---
tw_views = int(latest_stats["views"].sum())
tw_likes = int(latest_stats["likes"].sum())
tw_comments = int(latest_stats["comments"].sum())
tw_count = len(videos_df)

def delta_str(current, previous):
    diff = current - previous
    if diff > 0:
        return f"▲ {diff:,}"
    elif diff < 0:
        return f"▼ {abs(diff):,}"
    return "—"

col1, col2, col3, col4 = st.columns(4)
col1.metric("총 조회수", f"{tw_views:,}", delta_str(tw_views, pw_views) if prev_since else None)
col2.metric("총 좋아요", f"{tw_likes:,}", delta_str(tw_likes, pw_likes) if prev_since else None)
col3.metric("총 댓글", f"{tw_comments:,}", delta_str(tw_comments, pw_comments) if prev_since else None)
col4.metric("영상 수", f"{tw_count}개", delta_str(tw_count, pw_count) if prev_since else None)

# --- 영상별 조회수 바 차트 (TOP 3 강조) ---
st.subheader("영상별 조회수")
merged = videos_df[["id", "title", "published_at"]].merge(
    latest_stats[["video_id", "views", "likes", "comments"]],
    left_on="id", right_on="video_id", how="left",
)
merged = merged.sort_values("views", ascending=True)
merged["short_title"] = merged["title"].str[:30]

# TOP 3 강조 색상
top3_ids = merged.nlargest(3, "views")["id"].tolist()
merged["color"] = merged["id"].apply(lambda x: "#FF4B4B" if x in top3_ids else "#D3D3D3")

fig = go.Figure()
fig.add_trace(go.Bar(
    x=merged["views"],
    y=merged["short_title"],
    orientation="h",
    marker_color=merged["color"],
    hovertext=merged.apply(lambda r: f"{r['title']}<br>조회수: {r['views']:,}<br>좋아요: {r['likes']:,}<br>댓글: {r['comments']:,}", axis=1),
    hoverinfo="text",
))
fig.update_layout(
    height=max(300, len(merged) * 40),
    showlegend=False,
    xaxis_title="조회수",
    yaxis_title="",
    margin=dict(l=0, r=20, t=10, b=30),
    transition=dict(duration=800, easing="cubic-in-out"),
)
st.plotly_chart(fig, use_container_width=True)

# --- 일별 업로드 현황 ---
st.subheader("일별 업로드 현황")
videos_df["date"] = pd.to_datetime(videos_df["published_at"]).dt.date
daily = videos_df.groupby("date").size().reset_index(name="count")
daily["date_str"] = pd.to_datetime(daily["date"]).dt.strftime("%Y.%m.%d")
fig2 = px.bar(daily, x="date_str", y="count", labels={"date_str": "날짜", "count": "업로드 수"})
st.plotly_chart(fig2, use_container_width=True)
