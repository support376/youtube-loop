"""Streamlit용 Supabase 클라이언트."""

import os
import streamlit as st
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()


def _get_config(key: str) -> str:
    """환경변수 → st.secrets 순서로 값을 찾는다."""
    val = os.environ.get(key)
    if val:
        return val
    try:
        return st.secrets[key]
    except (KeyError, FileNotFoundError):
        return ""


@st.cache_resource
def get_supabase() -> Client:
    """Supabase 클라이언트를 캐싱하여 반환."""
    url = _get_config("SUPABASE_URL")
    key = _get_config("SUPABASE_SERVICE_ROLE_KEY") or _get_config("SUPABASE_ANON_KEY")
    return create_client(url, key)
