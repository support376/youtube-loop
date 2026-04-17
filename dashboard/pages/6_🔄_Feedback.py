"""Feedback Loop 탭 - 기획용 피드백."""

import streamlit as st
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from dashboard.components.db import get_supabase

st.header("🔄 Feedback Loop")

sb = get_supabase()

feedback_resp = (
    sb.table("feedback")
    .select("*")
    .order("created_at", desc=True)
    .limit(10)
    .execute()
)
feedbacks = feedback_resp.data or []

if not feedbacks:
    st.info("아직 피드백이 없습니다. 매주 월요일 오전 9:30에 자동 생성됩니다.")
    st.stop()

latest = feedbacks[0]

# --- 최신 피드백 ---
st.subheader("최신 피드백")
st.caption(f"생성일: {latest['created_at'][:10] if latest.get('created_at') else ''}")
st.markdown(latest.get("content_md", ""))
st.caption("위 텍스트를 선택 → 복사 → 코워���에 붙여넣기")

# --- 성과 키워드 ---
boost = latest.get("keywords_boost") or []
avoid = latest.get("keywords_avoid") or []

if boost:
    st.markdown("---")
    st.subheader("성과 좋은 키워드")
    st.write(", ".join(boost))

if avoid:
    st.subheader("부진 키워드")
    st.write(", ".join(avoid))

# --- 과거 피드백 ---
if len(feedbacks) > 1:
    st.markdown("---")
    st.subheader("과거 피드백")
    for fb in feedbacks[1:]:
        date = fb["created_at"][:10] if fb.get("created_at") else ""
        with st.expander(f"{date} ({fb.get('period', '')})"):
            st.markdown(fb.get("content_md", ""))
