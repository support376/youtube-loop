"""Claude API 클라이언트 (주간 리포트/피드백 생성용)."""

import os
from dotenv import load_dotenv
from anthropic import Anthropic

load_dotenv()

_client: Anthropic | None = None

MODEL = "claude-sonnet-4-6"


def get_client() -> Anthropic:
    """Anthropic 클라이언트를 반환한다."""
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


def generate(system: str, user_message: str, max_tokens: int = 4096) -> str:
    """Claude에게 메시지를 보내고 응답 텍스트를 반환한다."""
    client = get_client()
    resp = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user_message}],
    )
    return resp.content[0].text
