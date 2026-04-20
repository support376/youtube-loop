-- ===== YouTube Loop - Supabase Schema =====
-- Supabase SQL Editor에서 실행하세요.
-- 순서대로 전체 복사 → 붙여넣기 → Run

-- 1. 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. crawled_news (뉴스 크롤링 결과)
CREATE TABLE IF NOT EXISTS crawled_news (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crawl_date      DATE NOT NULL,
    source_type     TEXT NOT NULL,          -- '인기' or '키워드'
    section         TEXT,                    -- '사회', '경제', ...
    keyword         TEXT,                    -- 키워드 검색이면 해당 키워드
    title           TEXT NOT NULL,
    url             TEXT NOT NULL,
    source          TEXT,                    -- 언론사
    body            TEXT,
    pub_date        TIMESTAMPTZ,
    freshness       TEXT,                    -- '신선' or '24-48시간'
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. crawled_community (커뮤니티 크롤링 결과)
CREATE TABLE IF NOT EXISTS crawled_community (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crawl_date      DATE NOT NULL,
    platform        TEXT NOT NULL,           -- '에펨코리아', '보배드림', '더쿠'
    title           TEXT NOT NULL,
    url             TEXT NOT NULL,
    body            TEXT,
    post_date       TIMESTAMPTZ,
    freshness       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. editors (편집자 정보)
CREATE TABLE IF NOT EXISTS editors (
    id              SERIAL PRIMARY KEY,
    name            TEXT UNIQUE NOT NULL,
    joined_at       DATE,
    notes           TEXT
);

-- 초기 편집자 데이터
INSERT INTO editors (name, joined_at) VALUES
    ('경민', CURRENT_DATE),
    ('지희', CURRENT_DATE)
ON CONFLICT (name) DO NOTHING;

-- 5. videos (영상 메타)
CREATE TABLE IF NOT EXISTS videos (
    id              TEXT PRIMARY KEY,         -- YouTube video ID
    channel_id      TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    published_at    TIMESTAMPTZ NOT NULL,
    editor_id       INTEGER REFERENCES editors(id),
    duration_sec    INTEGER,
    video_type      TEXT,                     -- 'short' or 'long'
    tags            TEXT[],
    thumbnail_url   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 6. video_stats (영상 성과 시계열)
CREATE TABLE IF NOT EXISTS video_stats (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id        TEXT NOT NULL REFERENCES videos(id),
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    views           INTEGER DEFAULT 0,
    likes           INTEGER DEFAULT 0,
    comments        INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- video_stats 조회 성능용 인덱스
CREATE INDEX IF NOT EXISTS idx_video_stats_video_id ON video_stats(video_id);
CREATE INDEX IF NOT EXISTS idx_video_stats_fetched_at ON video_stats(fetched_at);

-- 7. weekly_reports (AI 주간 리포트)
CREATE TABLE IF NOT EXISTS weekly_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    week_start      DATE NOT NULL,
    week_end        DATE NOT NULL,
    report_md       TEXT,
    top_videos      JSONB,
    patterns        JSONB,
    recommendations JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 8. feedback (기획용 피드백)
CREATE TABLE IF NOT EXISTS feedback (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    period          TEXT,                     -- 'weekly', 'monthly'
    content_md      TEXT,
    keywords_boost  TEXT[],
    keywords_avoid  TEXT[],
    title_patterns  JSONB
);

-- 인덱스: 크롤링 날짜 조회용
CREATE INDEX IF NOT EXISTS idx_crawled_news_date ON crawled_news(crawl_date);
CREATE INDEX IF NOT EXISTS idx_crawled_community_date ON crawled_community(crawl_date);
CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(published_at);

-- ===== Phase 2: 탭 구조 확장용 테이블 =====

-- 9. topics (영상/크롤링 주제 태그)
CREATE TABLE IF NOT EXISTS topics (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type    TEXT NOT NULL,                                -- 'video' | 'news' | 'community'
    content_id      TEXT NOT NULL,
    issue_tags      TEXT[] DEFAULT ARRAY[]::TEXT[],
    legal_tags      TEXT[] DEFAULT ARRAY[]::TEXT[],
    tagged_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_topics_content ON topics(content_type, content_id);

-- 10. leads (리드 추적)
CREATE TABLE IF NOT EXISTS leads (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone           TEXT,
    name            TEXT,
    source_content  TEXT,
    channel         TEXT,
    status          TEXT DEFAULT '리드',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 11. planning_cards (기획안)
CREATE TABLE IF NOT EXISTS planning_cards (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title                   TEXT NOT NULL,
    topic_summary           TEXT,
    recommendation_reason   TEXT,
    shorts_fit              INTEGER DEFAULT 0,                    -- 0~5 별점
    score_total             REAL,
    score_detail            JSONB,                                -- { 화제성, 법률연결성, ... }
    source_crawl_id         UUID,
    status                  TEXT DEFAULT '초안',                  -- 초안/승인/수정중/보류/폐기
    linked_video_id         TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_planning_cards_status ON planning_cards(status);

-- 12. score_weights (스코어링 가중치 프리셋)
CREATE TABLE IF NOT EXISTS score_weights (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    preset_name     TEXT NOT NULL,
    weights         JSONB NOT NULL,
    is_active       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- score_weights 기본 프리셋 3개
INSERT INTO score_weights (preset_name, weights, is_active) VALUES
    ('바이럴 모드',
     '{"화제성":40,"법률연결성":20,"시청자실익":10,"수익성":10,"경쟁도":10,"지속성":10}'::jsonb,
     FALSE),
    ('수임 모드',
     '{"화제성":15,"법률연결성":25,"시청자실익":10,"수익성":30,"경쟁도":10,"지속성":10}'::jsonb,
     FALSE),
    ('기본',
     '{"화제성":30,"법률연결성":25,"시청자실익":10,"수익성":15,"경쟁도":10,"지속성":10}'::jsonb,
     TRUE)
ON CONFLICT DO NOTHING;
