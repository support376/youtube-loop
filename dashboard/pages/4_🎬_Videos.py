"""Videos 탭 - 영상별 성과 상세."""

import streamlit as st
import pandas as pd
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
now = datetime.now(timezone.utc)
if period == "이번 주":
    since = (now - timedelta(days=7)).isoformat()
elif period == "이번 달":
    since = (now - timedelta(days=30)).isoformat()
else:
    since = "2000-01-01T00:00:00"
merged["published_at"] = pd.to_datetime(merged["published_at"])
filtered = merged[merged["published_at"] >= since].copy()

# --- TOP 10 영상 (TOP 3 강조) ---
st.subheader(f"TOP 10 영상 ({period})")
top10 = filtered.nlargest(10, "views").copy()

top3_ids = top10.head(3)["id"].tolist()
top10["색상"] = top10["id"].apply(lambda x: "#FF4B4B" if x in top3_ids else "#D3D3D3")
top10["short_title"] = top10["title"].str[:30]
top10_sorted = top10.sort_values("views", ascending=True)

fig = go.Figure()
fig.add_trace(go.Bar(
    x=top10_sorted["views"],
    y=top10_sorted["short_title"],
    orientation="h",
    marker_color=top10_sorted["색상"],
    hovertext=top10_sorted.apply(lambda r: f"{r['title']}<br>조회수: {r['views']:,}<br>좋아요: {r['likes']:,}<br>댓글: {r['comments']:,}", axis=1),
    hoverinfo="text",
))
fig.update_layout(
    height=max(300, len(top10_sorted) * 40),
    showlegend=False,
    xaxis_title="조회수",
    yaxis_title="",
    margin=dict(l=0, r=20, t=10, b=30),
    transition=dict(duration=800, easing="cubic-in-out"),
)
st.plotly_chart(fig, use_container_width=True)

# TOP 10 테이블
top10_table = top10[["title", "video_type", "published_at", "views", "likes", "comments"]].copy()
top10_table["published_at"] = top10_table["published_at"].dt.strftime("%Y.%m.%d")
top10_table["video_type"] = top10_table["video_type"].map({"short": "숏", "long": "롱"})
top10_table.columns = ["제목", "유형", "업로드일", "조회수", "좋아요", "댓글"]
st.dataframe(top10_table, use_container_width=True, hide_index=True)

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
    "질문형": filtered[filtered["has_question"]],
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
all_videos["published_at"] = all_videos["published_at"].dt.strftime("%Y.%m.%d")
all_videos["video_type"] = all_videos["video_type"].map({"short": "숏", "long": "롱"})
all_videos.columns = ["제목", "유형", "업로드일", "조회수", "좋아요", "댓글"]
st.dataframe(all_videos, use_container_width=True, hide_index=True)
