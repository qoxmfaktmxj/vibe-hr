from __future__ import annotations

from math import ceil
from typing import TypeVar

from sqlmodel import Session, func, select
from sqlmodel.sql.expression import SelectOfScalar

T = TypeVar("T")


def count_query(session: Session, base_stmt) -> int:
    """SELECT COUNT(*) 를 이용해 전체 건수를 반환한다.

    base_stmt 는 where 조건까지만 포함된 select 문이어야 하며,
    order_by / offset / limit 는 호출 전에 적용하지 않는다.

    Usage example::

        base = (
            select(HrEmployee)
            .where(HrEmployee.is_active == True)
        )
        total = count_query(session, base)
        rows  = session.exec(base.order_by(...).offset(offset).limit(limit)).all()
    """
    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    return session.exec(count_stmt).one()


def calc_total_pages(total_count: int, limit: int) -> int:
    """전체 건수와 페이지 크기로 총 페이지 수를 계산한다."""
    if limit <= 0:
        return 1
    return max(1, ceil(total_count / limit))
