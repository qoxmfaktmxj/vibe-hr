"""
업무 기준 날짜/시간 유틸리티

- DB 타임스탬프 저장: UTC (now_utc)
- 업무 날짜 계산: KST (business_today, now_local)

date.today() 는 서버 로컬 TZ에 의존하므로 직접 사용하지 않습니다.
"""

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

APP_TZ = ZoneInfo("Asia/Seoul")


def now_utc() -> datetime:
    """UTC 기준 현재 시각. DB 저장용 타임스탬프에 사용."""
    return datetime.now(timezone.utc)


def now_local() -> datetime:
    """업무 기준 타임존(KST) 현재 시각."""
    return now_utc().astimezone(APP_TZ)


def business_today() -> date:
    """업무 기준 '오늘' 날짜 (KST).

    서버 TZ 설정에 무관하게 항상 Asia/Seoul 기준 날짜를 반환합니다.
    date.today() 대신 이 함수를 사용하세요.
    """
    return now_local().date()
