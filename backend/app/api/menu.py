from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.auth import get_current_user
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.menu import MenuTreeResponse
from app.services.menu_service import get_menu_tree_for_user

router = APIRouter(prefix="/menus", tags=["menus"])


@router.get("/tree", response_model=MenuTreeResponse)
def menu_tree(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> MenuTreeResponse:
    """현재 로그인 사용자의 역할 기반으로 접근 가능한 메뉴 트리를 반환한다."""
    tree = get_menu_tree_for_user(session, current_user.id)
    return MenuTreeResponse(menus=tree)
