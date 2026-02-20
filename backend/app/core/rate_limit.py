"""간단한 인메모리 로그인 Rate Limiter.

IP 당 일정 시간 내 로그인 시도 횟수를 제한한다.
프로덕션에서는 Redis 기반으로 교체 권장.
"""

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request, status

# 설정값
MAX_ATTEMPTS = 10  # 윈도우 내 최대 시도 횟수
WINDOW_SECONDS = 300  # 5분 윈도우

_lock = Lock()
_attempts: dict[str, list[float]] = defaultdict(list)


def _cleanup(ip: str, now: float) -> None:
    """만료된 시도 기록을 제거한다."""
    cutoff = now - WINDOW_SECONDS
    _attempts[ip] = [t for t in _attempts[ip] if t > cutoff]


def check_login_rate_limit(request: Request) -> None:
    """로그인 요청의 IP 기반 Rate Limit을 확인한다.

    초과 시 429 Too Many Requests를 발생시킨다.
    """
    ip = request.client.host if request.client else "unknown"
    now = time.time()

    with _lock:
        _cleanup(ip, now)

        if len(_attempts[ip]) >= MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"로그인 시도가 너무 많습니다. {WINDOW_SECONDS // 60}분 후 다시 시도해 주세요.",
            )

        _attempts[ip].append(now)
