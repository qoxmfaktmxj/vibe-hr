from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class MenuNode(BaseModel):
    """단일 메뉴 노드 (트리 응답용)"""

    id: int
    code: str
    name: str
    path: Optional[str] = None
    icon: Optional[str] = None
    sort_order: int = 0
    children: List[MenuNode] = []


class MenuTreeResponse(BaseModel):
    """메뉴 트리 전체 응답"""

    menus: List[MenuNode]
