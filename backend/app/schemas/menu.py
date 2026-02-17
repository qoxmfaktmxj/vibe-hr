from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class MenuNode(BaseModel):
    """단일 메뉴 노드 (트리 응답용)"""

    id: int
    code: str
    name: str
    path: Optional[str] = None
    icon: Optional[str] = None
    sort_order: int = 0
    children: List[MenuNode] = Field(default_factory=list)


class MenuTreeResponse(BaseModel):
    """메뉴 트리 전체 응답"""

    menus: List[MenuNode]


class MenuAdminItem(BaseModel):
    id: int
    code: str
    name: str
    parent_id: Optional[int] = None
    path: Optional[str] = None
    icon: Optional[str] = None
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    children: List[MenuAdminItem] = Field(default_factory=list)


class MenuAdminTreeResponse(BaseModel):
    menus: List[MenuAdminItem]


class MenuCreateRequest(BaseModel):
    code: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=1, max_length=100)
    parent_id: Optional[int] = None
    path: Optional[str] = Field(default=None, max_length=200)
    icon: Optional[str] = Field(default=None, max_length=60)
    sort_order: int = 0
    is_active: bool = True


class MenuUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    parent_id: Optional[int] = None
    path: Optional[str] = Field(default=None, max_length=200)
    icon: Optional[str] = Field(default=None, max_length=60)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class MenuRoleUpdateRequest(BaseModel):
    role_ids: List[int] = Field(default_factory=list)


class RoleItem(BaseModel):
    id: int
    code: str
    name: str


class MenuRoleMappingResponse(BaseModel):
    menu_id: int
    roles: List[RoleItem]


class MenuAdminDetailResponse(BaseModel):
    menu: MenuAdminItem


class RoleListResponse(BaseModel):
    roles: List[RoleItem]
