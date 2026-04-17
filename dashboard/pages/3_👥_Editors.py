"""Editors 탭 - 편집자별 성과 비교."""

import streamlit as st
import pandas as pd
import plotly.express as px
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from dashboard.components.db import get_supabase

st.header("👥 Editors")

sb = get_supabase()

# --- 편집자 목록 ---
editors_resp = sb.table("editors").select("*").execute()
editors_df = pd.DataFrame(editors_resp.data) if editors_resp.data else pd.DataFrame()

# --- 영상 + 최신 통계 ---
videos_resp = sb.table("videos").select("id, title, published_at, editor_id").execute()
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

# 병합
merged = videos_df.merge(latest_stats[["video_id", "views", "likes", "comments"]], left_on="id", right_on="video_id", how="left")
merged["editor_id"] = pd.to_numeric(merged["editor_id"], errors="coerce")
editors_df["id"] = pd.to_numeric(editors_df["id"], errors="coerce")
merged = merged.merge(editors_df[["id", "name"]], left_on="editor_id", right_on="id", how="left", suffixes=("", "_editor"))
merged["editor"] = merged["name"].fillna("미배정")

# --- 편집자별 요약 ---
st.subheader("편집자별 성과 요약")
summary = merged.groupby("editor").agg(
    영상수=("id", "count"),
    총조회수=("views", "sum"),
    평균조회수=("views", "mean"),
    총좋아요=("likes", "sum"),
    평균좋아요=("likes", "mean"),
    총댓글=("comments", "sum"),
).reset_index()

summary["평균조회수"] = summary["평균조회수"].round(0).astype(int)
summary["평균좋아요"] = summary["평균좋아요"].round(0).astype(int)
st.dataframe(summary, use_container_width=True, hide_index=True)

# --- 편집자 비교 차트 ---
if len(summary) > 1:
    st.subheader("편집자 비교")
    metric = st.selectbox("비교 지표", ["평균조회수", "총조회수", "평균좋아요", "총좋아요", "영상수"])
    fig = px.bar(summary, x="editor", y=metric, color="editor", labels={"editor": "편집자"})
    st.plotly_chart(fig, use_container_width=True)

# --- 특정 편집자 영상 리스트 ---
st.subheader("편집자별 영상 목록")
selected = st.selectbox("편집자 선택", merged["editor"].unique())
filtered = merged[merged["editor"] == selected][["title", "published_at", "views", "likes", "comments"]]
filtered.columns = ["제목", "업로드일", "조회수", "좋아요", "댓글"]
st.dataframe(filtered, use_container_width=True, hide_index=True)
