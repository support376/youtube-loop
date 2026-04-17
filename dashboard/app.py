"""YouTube Loop - 메인 대시보드."""

import streamlit as st
import pandas as pd
from datetime import datetime, timedelta, timezone
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dashboard.components.db import get_supabase

st.set_page_config(
    page_title="YouTube Loop",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- 사이드바 로고 ---
st.sidebar.markdown(
    "<h1 style='text-align:center; font-size:2rem; margin-bottom:0;'>📊 YouTube Loop</h1>"
    "<p style='text-align:center; color:gray; font-size:0.85rem; margin-top:0;'>Circle21 채널 분석</p>",
    unsafe_allow_html=True,
)
st.sidebar.markdown("---")

st.title("YouTube Loop")
st.caption("Circle21 유튜브 채널 통합 분석 대시보드")

sb = get_supabase()

# --- 데이터 로딩 ---
videos_resp = sb.table("videos").select("id, title, published_at, video_type").order("published_at", desc=True).execute()
videos_df = pd.DataFrame(videos_resp.data) if videos_resp.data else pd.DataFrame()

if videos_df.empty:
    st.info("아직 영상 데이터가 없습니다.")
    st.stop()

videos_df["published_at"] = pd.to_datetime(videos_df["published_at"])
video_ids = videos_df["id"].tolist()

stats_resp = sb.table("video_stats").select("video_id, views, likes, comments, fetched_at").in_("video_id", video_ids).order("fetched_at", desc=True).execute()
stats_df = pd.DataFrame(stats_resp.data) if stats_resp.data else pd.DataFrame()

if stats_df.empty:
    st.info("통계 데이터가 아직 없습니다.")
    st.stop()

latest_stats = stats_df.drop_duplicates(subset="video_id", keep="first")
merged = videos_df.merge(latest_stats[["video_id", "views", "likes", "comments"]], left_on="id", right_on="video_id", how="left")

# --- 이번 주 / 전주 구분 ---
now = datetime.now(timezone.utc)
this_week_start = now - timedelta(days=7)
prev_week_start = now - timedelta(days=14)

this_week = merged[merged["published_at"] >= this_week_start]
prev_week = merged[(merged["published_at"] >= prev_week_start) & (merged["published_at"] < this_week_start)]

tw_views = int(this_week["views"].sum())
pw_views = int(prev_week["views"].sum())
tw_likes = int(this_week["likes"].sum())
pw_likes = int(prev_week["likes"].sum())
tw_comments = int(this_week["comments"].sum())
pw_comments = int(prev_week["comments"].sum())
tw_count = len(this_week)
pw_count = len(prev_week)

# --- 핵심 지표 카드 (전주 대비) ---
st.markdown("### 이번 주 핵심 지표")
col1, col2, col3, col4 = st.columns(4)

def delta_str(current, previous):
    diff = current - previous
    if diff > 0:
        return f"▲ {diff:,}"
    elif diff < 0:
        return f"▼ {abs(diff):,}"
    return "—"

col1.metric("조회수", f"{tw_views:,}", delta_str(tw_views, pw_views))
col2.metric("좋아요", f"{tw_likes:,}", delta_str(tw_likes, pw_likes))
col3.metric("댓글", f"{tw_comments:,}", delta_str(tw_comments, pw_comments))
col4.metric("영상 수", f"{tw_count}개", delta_str(tw_count, pw_count))

st.markdown("---")

# --- TOP 5 영상 ---
st.markdown("### TOP 5 영상")
top5 = merged.nlargest(5, "views")[["title", "published_at", "views", "likes"]].copy()
top5["published_at"] = top5["published_at"].dt.strftime("%Y.%m.%d")
top5.columns = ["제목", "업로드일", "조회수", "좋아요"]
st.dataframe(top5, use_container_width=True, hide_index=True)

st.markdown("---")
st.caption("👈 왼쪽 사이드바에서 상세 탭을 선택하세요.")
