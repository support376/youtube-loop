"""Weekly Insights 탭 - AI 주간 리포트."""

import streamlit as st
import pandas as pd
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from dashboard.components.db import get_supabase

st.header("🤖 Weekly Insights")

sb = get_supabase()

reports_resp = (
    sb.table("weekly_reports")
    .select("*")
    .order("week_start", desc=True)
    .limit(20)
    .execute()
)
reports = reports_resp.data or []

if not reports:
    st.info("아직 주간 리포트가 없습니다. 매주 월요일 오전 9시에 자동 생성됩니다.")
    st.stop()

# --- 리포트 선택 ---
options = {f"{r['week_start']} ~ {r['week_end']}": r for r in reports}
selected_label = st.selectbox("기간 선택", list(options.keys()))
report = options[selected_label]

# --- 리포트 본문 ---
st.markdown("---")
st.markdown(report["report_md"])

# --- TOP 영상 ---
top_videos = report.get("top_videos")
if top_videos:
    st.markdown("---")
    st.subheader("TOP 영상")
    for i, v in enumerate(top_videos, 1):
        views = v.get("views", 0)
        st.markdown(f"**{i}.** {v.get('title', '')} — 조회수 {views:,}")

# --- 과거 리포트 아카이브 ---
st.markdown("---")
st.subheader("리포트 아카이브")
archive_df = pd.DataFrame([{
    "기간": f"{r['week_start']} ~ {r['week_end']}",
    "생성일": r["created_at"][:10] if r.get("created_at") else "",
} for r in reports])
st.dataframe(archive_df, use_container_width=True, hide_index=True)
