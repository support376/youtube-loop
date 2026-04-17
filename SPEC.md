# YouTube Loop — Project Specification

> Circle21 YouTube 채널 통합 분석 + 피드백 루프 대시보드
> 
> **작성일:** 2026-04-16
> **버전:** 1.0 (Phase 1 설계 확정)

---

## 1. 프로젝트 개요

### 1.1 이름
**YouTube Loop**

### 1.2 한 줄 요약
Circle21 유튜브 채널(양홍수 변호사 외)의 영상 성과 수집 + 편집자 성과 관리 + AI 주간 분석 + 기획 피드백을 통합한 **공유 가능한 클라우드 대시보드**.

### 1.3 핵심 가치
- **기획은 PD 주도** (코워크/프로젝트 채팅에서 수동)
- **그 외 모든 것 자동화** (크롤링 / 성과 수집 / 분석 / 대시보드)
- **대표님/이사님 실시간 공유**
- **피드백 루프**: 성과 데이터 → 다음 기획 방향 제안

### 1.4 왜 만드는가
1. 지금은 성과 데이터가 흩어져 있음 (YouTube Studio, 엑셀 X)
2. 편집자별 성과 비교 체계 없음 (지희/경민)
3. "어떤 기획이 먹히는지" 데이터 기반 판단 불가
4. 대표님/이사님 공유 시 매번 수작업 필요
5. PD PC 꺼져도 돌아가야 함 (출장/여행 중에도)

---

## 2. 범위 (Scope)

### 2.1 포함 (YouTube Loop 담당)

| 영역 | 자동화 수준 | 설명 |
|---|---|---|
| 📰 크롤링 | 100% 자동 | 뉴스 + 커뮤니티 매일 수집 |
| 📊 영상 성과 수집 | 100% 자동 | YouTube API로 매일 |
| 👥 편집자 성과 분석 | 100% 자동 | 폴더 기반 편집자 구분 |
| 🎬 주제별 성과 분석 | 100% 자동 | |
| 🤖 AI 주간 리포트 | 100% 자동 | Claude Sonnet 4.6, 주 1회 |
| 🔄 피드백 생성 | 100% 자동 | `feedback.md` 생성 |
| 🌐 대시보드 | 24/7 | Streamlit Cloud 공개 URL |

### 2.2 제외 (코워크/프로젝트 채팅 담당)

| 영역 | 이유 |
|---|---|
| 기획카드 생성 | 수정 자유 필요, Max 플랜으로 무료 |
| 크롤링 결과 분석 | 뉘앙스 파악 필요 |
| 변호사 소통 | PD 고유 영역 |

### 2.3 연결 고리
```
YouTube Loop (자동 분석)
  → feedback.md 생성
  → "이번 주 가장이혼 주제 2배 성과"
  → PD가 코워크에 복붙
  → 기획카드에 반영
  → 더 좋은 기획 → 순환
```

---

## 3. 시스템 아키텍처

```
┌─────────────────────────────────────────────────┐
│ GitHub Actions (클라우드 스케줄러)               │
├─────────────────────────────────────────────────┤
│ [매일 오후 1:40]  크롤링 + 성과 수집             │
│ [매일 밤 12시]    YouTube 성과 업데이트          │
│ [매주 월요일 9시] AI 주간 리포트 + 피드백        │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ Supabase (PostgreSQL 클라우드 DB)                │
├─────────────────────────────────────────────────┤
│ Tables:                                          │
│  - crawled_news       (뉴스 크롤링 결과)         │
│  - crawled_community  (커뮤니티 크롤링 결과)     │
│  - videos             (영상 메타)                │
│  - video_stats        (영상 성과 시계열)         │
│  - editors            (편집자 정보)              │
│  - weekly_reports     (AI 주간 리포트)           │
│  - feedback           (기획용 피드백)            │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ Streamlit Cloud (24/7 대시보드)                  │
│ URL: https://youtube-loop.streamlit.app          │
├─────────────────────────────────────────────────┤
│ 탭:                                              │
│  📋 오늘의 크롤링                                │
│  📊 Overview (전체 성과)                         │
│  👥 Editors (편집자별)                           │
│  🎬 Videos (영상별/주제별)                       │
│  🤖 Weekly Insights (AI 리포트)                  │
│  🔄 Feedback Loop (기획 피드백)                  │
└─────────────────────────────────────────────────┘
            ↑                          ↓
   [PD + 대표님 + 이사님]      [PD가 feedback 복사]
                                       ↓
                              [코워크에서 기획 반영]
```

### 3.1 데이터 흐름

**크롤링 흐름:**
```
네이버 뉴스/커뮤니티 → GitHub Actions → Supabase → 대시보드
```

**성과 수집 흐름:**
```
YouTube API → GitHub Actions → Supabase → 대시보드
```

**분석 흐름:**
```
Supabase → GitHub Actions → Claude API → Supabase → 대시보드
```

**피드백 흐름:**
```
Supabase → 대시보드 (feedback 탭)
  → PD 복사
  → 코워크 붙여넣기
  → 기획카드에 반영
```

---

## 4. 기능 명세 (Phase 1)

### 4.1 📋 오늘의 크롤링 탭
- 매일 오후 1:40 자동 크롤링 결과 표시
- 뉴스 인기 섹션 (사회 30, 경제 20, 생활/문화 10)
- 키워드 검색 (24개 키워드, 각 상위 3개)
- 커뮤니티 화제 (에펨코리아, 보배드림, 더쿠)
- 필터링 적용 (블랙리스트, 48시간 이내, 유사도 dedup)
- "코워크용 복사" 버튼: 크롤링 전문 + 피드백 클립보드 복사

### 4.2 📊 Overview 탭
- 전체 채널 성과 요약
- 주요 지표:
  - 이번 주 조회수 / 좋아요 / 댓글 / 구독자 증가
  - 전주 대비 변화율
  - 업로드 수
- 기간 필터 (최근 7일 / 30일 / 전체)
- 일별 조회수 추이 차트

### 4.3 👥 Editors 탭
- 편집자: 경민, 지희 (초기)
- 편집자별 영상 수
- 편집자별 평균 조회수 / 좋아요 / 댓글
- 편집자 간 성과 비교 차트
- 특정 편집자 선택 시 담당 영상 리스트
- 기간별 추이 (이번 주/월/분기)

### 4.4 🎬 Videos 탭
- 영상별 성과 상세 테이블
- 주제별 분석 (키워드 추출 → 주제 그룹핑)
- 제목 패턴 분석 (질문형/경고형/숫자형)
- 업로드 시간대별 성과
- TOP 10 영상 (이번 주 / 이번 달)

### 4.5 🤖 Weekly Insights 탭
- 매주 월요일 오전 9시 자동 생성
- AI 리포트 내용:
  - "이번 주 TOP 3 영상 공통점"
  - "성과 좋은 주제 패턴"
  - "성과 좋은 제목 패턴"
  - "다음 주 추천 기획 방향"
- 과거 리포트 아카이브

### 4.6 🔄 Feedback Loop 탭
- 기획에 반영할 피드백 (텍스트)
- 코워크에 복붙할 수 있는 형태로 정리
- 예시:
  ```
  [최근 2주 성과 분석 기반 추천]
  
  ✅ 잘 된 주제: 이혼, 회생, 전세사기
  ✅ 잘 된 제목 패턴: 숫자 포함 (30% CTR ↑)
  ⚠️ 부진한 주제: 일반 형사
  
  [다음 기획 추천]
  - 이혼 관련 + 숫자 포함 제목
  - 전세사기 피해자 보호 각도
  ```
- "전체 복사" 버튼

---

## 5. 데이터 모델 (Supabase 테이블)

### 5.1 crawled_news
```sql
id              UUID PRIMARY KEY
crawl_date      DATE       -- 크롤링 날짜
source_type     TEXT       -- '인기' or '키워드'
section         TEXT       -- '사회', '경제', ...
keyword         TEXT       -- 키워드 검색이면 해당 키워드
title           TEXT       -- 기사 제목
url             TEXT       -- 원문 URL
source          TEXT       -- 언론사
body            TEXT       -- 본문 전문
pub_date        TIMESTAMP  -- 기사 발행 시간
freshness       TEXT       -- '신선' or '24-48시간'
created_at      TIMESTAMP  -- 레코드 생성 시각
```

### 5.2 crawled_community
```sql
id              UUID PRIMARY KEY
crawl_date      DATE
platform        TEXT       -- '에펨코리아', '보배드림', '더쿠'
title           TEXT
url             TEXT
body            TEXT
post_date       TIMESTAMP
freshness       TEXT
created_at      TIMESTAMP
```

### 5.3 editors
```sql
id              SERIAL PRIMARY KEY
name            TEXT UNIQUE  -- '경민', '지희'
joined_at       DATE
notes           TEXT
```

초기 데이터:
- `(1, '경민', ...)`
- `(2, '지희', ...)`

### 5.4 videos
```sql
id              TEXT PRIMARY KEY  -- YouTube video ID
channel_id      TEXT              -- 'UC5u8YtYZNJdxw1-qObwISpw'
title           TEXT
description     TEXT
published_at    TIMESTAMP
editor_id       INTEGER REFERENCES editors(id)
duration_sec    INTEGER
video_type      TEXT              -- 'short' or 'long'
tags            TEXT[]
thumbnail_url   TEXT
created_at      TIMESTAMP
```

### 5.5 video_stats
```sql
id              UUID PRIMARY KEY
video_id        TEXT REFERENCES videos(id)
fetched_at      TIMESTAMP  -- 이 통계 수집 시각
views           INTEGER
likes           INTEGER
comments        INTEGER
created_at      TIMESTAMP
```

> 매일 수집해서 시계열로 쌓음. 특정 영상의 시간 흐름 따라 성과 변화 추적.

### 5.6 weekly_reports
```sql
id              UUID PRIMARY KEY
week_start      DATE       -- 그 주의 월요일
week_end        DATE       -- 그 주의 일요일
report_md       TEXT       -- AI 생성 리포트 (마크다운)
top_videos      JSON       -- TOP 3 영상 ID + 이유
patterns        JSON       -- 발견된 패턴
recommendations JSON       -- 다음 주 추천
created_at      TIMESTAMP
```

### 5.7 feedback
```sql
id              UUID PRIMARY KEY
created_at      TIMESTAMP
period          TEXT       -- 'weekly', 'monthly'
content_md      TEXT       -- 코워크에 복사할 피드백 전문
keywords_boost  TEXT[]     -- 성과 좋은 키워드
keywords_avoid  TEXT[]     -- 부진 키워드
title_patterns  JSON       -- 좋은 제목 패턴
```

---

## 6. 운영 방식 (자동 실행 스케줄)

### 6.1 GitHub Actions 스케줄

| 작업 | 실행 시간 | 주기 | 내용 |
|---|---|---|---|
| 크롤링 | 오후 1:40 | 매일 | 뉴스 + 커뮤니티 → Supabase |
| 영상 메타 수집 | 오후 2:00 | 매일 | 새 영상 감지 → videos 테이블 |
| 성과 수집 | 밤 11:00 | 매일 | YouTube API → video_stats |
| 주간 리포트 | 오전 9:00 | 매주 월 | Claude API → weekly_reports |
| 피드백 생성 | 오전 9:30 | 매주 월 | Claude API → feedback |

### 6.2 타임존
- 모든 스케줄 **한국 시간 기준 (KST)**
- GitHub Actions cron은 UTC이므로 변환 필요
  - KST 13:40 = UTC 04:40 → `40 4 * * *`

---

## 7. 기술 스택

### 7.1 백엔드 (데이터 수집 / 분석)
- **언어:** Python 3.12
- **주요 라이브러리:**
  - `requests`, `beautifulsoup4` (크롤링)
  - `google-api-python-client` (YouTube API)
  - `supabase-py` (DB 연동)
  - `anthropic` (Claude API)
  - `python-dotenv` (환경변수)

### 7.2 DB
- **Supabase (PostgreSQL)**
- Project URL: `https://xxzdlelawmnnrrybgiwq.supabase.co`
- Region: Northeast Asia (Seoul)
- Free Tier (500MB, 넘을 일 없음)

### 7.3 프론트엔드 (대시보드)
- **Streamlit**
- **시각화:** Plotly, Altair
- **배포:** Streamlit Cloud
- **URL:** `https://youtube-loop.streamlit.app` (확정 예정)

### 7.4 자동화 / 스케줄링
- **GitHub Actions** (월 2,000분 무료, 실제 사용 ~150분)

### 7.5 AI
- **Claude Sonnet 4.6** (`claude-sonnet-4-6`)
- 용도: 주간 리포트, 피드백 생성
- 주 1회 호출

---

## 8. 파일/폴더 구조

### 8.1 로컬 작업 폴더
```
C:\tools\youtube-loop\
├── .env                          # 환경변수 (Git 제외)
├── .gitignore                    # Python + .env
├── README.md
├── SPEC.md                       # 이 문서
├── requirements.txt              # Python 의존성
│
├── scripts\                      # GitHub Actions가 실행
│   ├── crawl_news.py             # 뉴스 크롤링
│   ├── crawl_community.py        # 커뮤니티 크롤링
│   ├── fetch_videos.py           # YouTube 영상 메타 수집
│   ├── fetch_stats.py            # 영상 성과 수집
│   ├── generate_weekly_report.py # AI 주간 리포트
│   └── generate_feedback.py      # 피드백 생성
│
├── dashboard\                    # Streamlit 앱
│   ├── app.py                    # 메인 앱
│   ├── pages\
│   │   ├── 1_📋_Crawling.py
│   │   ├── 2_📊_Overview.py
│   │   ├── 3_👥_Editors.py
│   │   ├── 4_🎬_Videos.py
│   │   ├── 5_🤖_Insights.py
│   │   └── 6_🔄_Feedback.py
│   └── components\
│       └── db.py                 # Supabase 클라이언트
│
├── lib\                          # 공통 유틸리티
│   ├── supabase_client.py
│   ├── youtube_client.py
│   ├── claude_client.py
│   └── filters.py                # 블랙리스트/예외룰
│
└── .github\
    └── workflows\
        ├── daily_crawl.yml       # 매일 오후 1:40
        ├── daily_stats.yml       # 매일 밤 11시
        └── weekly_report.yml     # 매주 월요일
```

### 8.2 양변 업로드 폴더 구조 (편집자 태깅)

**업로드 대기:**
```
C:\Users\User\Downloads\업로드대기\
├── 경민\
│   ├── 양변_001.mp4
│   └── 양변_001.srt
└── 지희\
    ├── 양변_002.mp4
    └── 양변_002.srt
```

**최종 아카이브 (양변 업로더가 자동 정리):**
```
C:\Users\User\Documents\유튜브\양홍수_변호사\최종본\
└── 2026-04-16\
    ├── 경민\
    │   ├── 양변_001.mp4
    │   └── 양변_001.srt
    └── 지희\
        ├── 양변_002.mp4
        └── 양변_002.srt
```

---

## 9. 편집자 관리 방식

### 9.1 구분 방식
**폴더 기반.** 파일명이 아닌 **상위 폴더명**으로 편집자 구분.

### 9.2 워크플로우
1. 편집자(경민/지희)가 편집 완료 → PD에게 파일 전달
2. PD가 `Downloads\업로드대기\{편집자}\`에 정리
3. 양변 업로더가 폴더명에서 편집자 추출 → Supabase `videos.editor_id`에 저장
4. YouTube Loop이 편집자별 성과 집계

### 9.3 양변 업로더 수정 필요 사항 (Phase 1)
- [ ] `--folder` 옵션 받을 때 편집자명 인식
- [ ] 업로드 시 Supabase `videos` 테이블에 `editor_id` 저장
- [ ] 최종 아카이브 경로에 편집자 폴더 포함

### 9.4 편집자 추가 방법
1. Supabase `editors` 테이블에 INSERT
2. `Downloads\업로드대기\{새이름}\` 폴더 만들기
3. 끝 (자동 인식)

---

## 10. 크롤러 마이그레이션 계획

### 10.1 현재 위치
- `C:\양홍수채널\code\daily_news_crawler.py`
- `C:\양홍수채널\code\daily_community_crawler.py`
- 로컬 PC에서 실행, 결과를 `C:\양홍수채널\01_raw\YYYY-MM-DD_news.md` 저장

### 10.2 YouTube Loop 이전 후
- GitHub 저장소 `scripts\crawl_news.py`로 이동
- 주요 변경:
  - `OUTPUT_DIR` MD 파일 생성 → **Supabase INSERT**
  - 로컬 폴더 경로 제거
  - 환경변수 로드 방식 변경 (.env → GitHub Secrets)
- **크롤링 로직은 그대로 유지** (블랙리스트, 예외룰, dedup 전부)

### 10.3 마이그레이션 체크리스트
- [ ] crawl_news.py 생성 (기존 로직 이전)
- [ ] Supabase 연동 코드 추가
- [ ] crawled_news 테이블 INSERT
- [ ] crawl_community.py 생성
- [ ] GitHub Actions 스케줄 설정
- [ ] 테스트 실행
- [ ] 기존 C:\양홍수채널\ 은 백업 용도로 유지

---

## 11. Phase 1 개발 순서

### 11.1 Day 1: 데이터 수집 파이프라인 (3~4시간)
1. YouTube Data API 발급 (Google Cloud)
2. Supabase 테이블 생성 (모든 테이블 SQL 실행)
3. 기존 크롤러를 scripts\ 로 이전
4. Supabase INSERT 로직 추가
5. 로컬에서 수동 테스트
6. GitHub Actions 스케줄 설정
7. GitHub Secrets 설정 (ANTHROPIC_API_KEY, SUPABASE_URL/KEY, YOUTUBE_API_KEY)
8. 첫 자동 실행 확인

### 11.2 Day 2: 대시보드 기본 (3~4시간)
1. Streamlit 로컬 설치 + 기본 레이아웃
2. Supabase 연동
3. 📋 오늘의 크롤링 탭
4. 📊 Overview 탭 (기본 차트)
5. 👥 Editors 탭
6. 🎬 Videos 탭
7. Streamlit Cloud 배포
8. 공개 URL 확인

### 11.3 Day 3: AI 분석 + 피드백 (2~3시간)
1. weekly_report.py 작성
2. Claude API 연동
3. 주간 리포트 자동 생성
4. feedback.py 작성
5. 🤖 Insights 탭 추가
6. 🔄 Feedback 탭 추가
7. 첫 주간 리포트 수동 실행 테스트

### 11.4 Day 4: 양변 업로더 통합 (1~2시간)
1. 양변 업로더 수정 (편집자 폴더 인식)
2. Supabase videos 테이블 연동
3. 테스트 업로드

---

## 12. 예상 비용

### 12.1 월 운영비

| 항목 | 비용 |
|---|---|
| Supabase | 0원 (Free tier) |
| Streamlit Cloud | 0원 (Community) |
| GitHub Actions | 0원 (무료 한도 내) |
| YouTube Data API | 0원 |
| Claude API (주간 리포트만) | 500~1,000원 |
| Claude API (예비 버퍼) | 500원 |
| **합계** | **약 월 1,000~1,500원** |

### 12.2 초기 설정 비용
- 전부 0원

### 12.3 비용 체크 포인트
- Claude API는 주 1회 호출 (월 4회)
- 각 호출: 입력 ~5K, 출력 ~2K 토큰
- 비용: 약 50~70원/회

---

## 13. 안전장치

### 13.1 과금 폭탄 방지
- **Anthropic Console 월 한도: $60** (이미 설정 완료)
- **알림: $30 (50%), $48 (80%)** (이미 설정 완료)
- **환경변수에 ANTHROPIC_API_KEY 절대 등록 금지**
- **키 저장은 오직 .env 파일 + GitHub Secrets**

### 13.2 API 키 분리
- `youtube-loop` 키: YouTube Loop 전용
- `yangbyun-uploader-v2`: 양변 업로더 전용
- 용도별로 분리해서 문제 추적 쉬움

### 13.3 데이터 백업
- Supabase 자동 백업 (Free tier에서도 일부 지원)
- GitHub에 코드 영구 보관
- 크롤링 원본은 Supabase에 누적 (지우지 않음)

### 13.4 접근 제어
- GitHub 저장소: Private
- Supabase: 서비스 키는 Secrets에만
- Streamlit 대시보드: **비밀번호 없음 (공개)**
  - PD 결정: 대표님/이사님 공유 편의성 우선
  - URL만 알면 누구나 접근 가능

### 13.5 모니터링
- GitHub Actions 실행 성공/실패 → 이메일 알림 자동
- Anthropic 사용량 → 월별 이메일 알림

---

## 14. 나중에 확장 (Phase 2+)

### 14.1 추가 예정 기능
- [ ] 편집 스타일 분석 (밈/효과음/자막 스타일)
  - 편집자 수동 태깅 방식
  - 스타일별 성과 비교
- [ ] 멀티 채널 지원 (클로저, 서클21)
- [ ] 경쟁 채널 비교 분석
- [ ] 트렌드 예측 (시계열 분석)
- [ ] 기획카드 자동 생성 (완전 자동화, 비용 증가)
- [ ] 카톡/슬랙 알림 (주간 리포트 푸시)

### 14.2 제외 (유지)
- 기획카드 자동 생성 (수정 자유도 위해 코워크 유지)
- 영상 프레임 분석 (비용 대비 효과 낮음)

---

## 15. 계정 / 리소스 정보

### 15.1 GitHub
- **저장소:** `support376/youtube-loop`
- **Visibility:** Private

### 15.2 Supabase
- **Organization:** DreamFrame
- **Project:** youtube-loop
- **URL:** `https://xxzdlelawmnnrrybgiwq.supabase.co`
- **Region:** Northeast Asia (Seoul)
- **DB Password:** 메모장에 별도 저장

### 15.3 Streamlit Cloud
- **Account:** support@dreamframe.org
- **Workspace:** support376

### 15.4 Anthropic
- **API Key 이름:** `youtube-loop`
- **월 한도:** $60
- **모델:** `claude-sonnet-4-6`

### 15.5 YouTube
- **채널:** 양홍수 변호사
- **채널 ID:** `UC5u8YtYZNJdxw1-qObwISpw`
- **YouTube Data API:** Phase 1 Day 1에 발급 예정

---

## 16. 다음 할 일 (내일)

### 16.1 준비물
- [ ] Google Cloud 계정 (YouTube Data API 발급용)
- [ ] 오늘 저장한 `.env` 파일
- [ ] 이 SPEC.md 문서

### 16.2 시작 지시
내일 Claude Code에서:
```
C:\tools\youtube-loop\SPEC.md 읽고 
Phase 1 Day 1 개발 시작해줘.
먼저 YouTube Data API 발급부터 안내.
```

---

**문서 끝. Phase 1 개발 준비 완료.**
