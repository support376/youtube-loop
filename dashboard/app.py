"""YouTube Loop - 메인 대시보드."""

import streamlit as st

st.set_page_config(
    page_title="YouTube Loop",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("YouTube Loop")
st.caption("Circle21 유튜브 채널 통합 분석 대시보드")

st.markdown("""
### 메뉴 안내
- **Overview** — 전체 채널 성과 요약
- **Editors** — 편집자별 성과 비교
- **Videos** — 영상별 성과 상세

👈 왼쪽 사이드바에서 탭을 선택하세요.
""")
