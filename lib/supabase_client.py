"""Supabase 클라이언트 싱글톤."""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_client: Client | None = None


def get_client() -> Client:
    """Supabase 클라이언트를 반환한다. 최초 호출 시 생성."""
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_ANON_KEY"]
        _client = create_client(url, key)
    return _client
