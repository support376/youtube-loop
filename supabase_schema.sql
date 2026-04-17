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
