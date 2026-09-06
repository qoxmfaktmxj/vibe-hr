"use client";

import { ChevronDown, HelpCircle, Palette, UserRound, X } from "lucide-react";
import { useRef, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { LogoutButton } from "@/components/auth/logout-button";
import { EmployeeProfileDialog } from "@/components/dashboard/employee-profile-dialog";
import { ThemeSettingsPopover } from "@/components/layout/theme-settings-popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const actionClass = "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AccountMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const name = user?.display_name || "사용자";
  const initials = name.split(/\s+/).map((word) => word[0]).join("").toUpperCase().slice(0, 2);

  function closeProfile(nextOpen: boolean) {
    setProfileOpen(nextOpen);
    if (!nextOpen) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button ref={triggerRef} type="button" aria-label="내 계정 메뉴" className="flex min-h-11 items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/12 text-sm font-bold text-[color:var(--vibe-nav-text-strong)]">{initials}</AvatarFallback></Avatar>
            <span className="hidden max-w-24 truncate text-sm font-semibold xl:block">{name}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={10} aria-label="내 계정" className="w-72 max-w-[calc(100vw-2rem)] bg-card p-2 motion-reduce:animate-none!">
          <div className="mb-1 border-b border-border px-3 pb-4 pt-3">
            <p className="truncate text-base font-bold">{name}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{user?.email || "내 계정"}</p>
          </div>
          <button type="button" className={actionClass} onClick={() => { setOpen(false); setProfileOpen(true); }}><UserRound className="h-4 w-4" aria-hidden="true" />내 정보</button>
          <ThemeSettingsPopover trigger={<button type="button" className={actionClass}><Palette className="h-4 w-4" aria-hidden="true" />화면 설정</button>} />
          <button type="button" className={actionClass} onClick={() => { setOpen(false); setHelpOpen(true); }}><HelpCircle className="h-4 w-4" aria-hidden="true" />이용 안내</button>
          <div className="mt-1 border-t border-border pt-1"><LogoutButton showLabel /></div>
        </PopoverContent>
      </Popover>
      <EmployeeProfileDialog open={profileOpen} onOpenChange={closeProfile} returnFocusRef={triggerRef} />
      <Dialog open={helpOpen} onOpenChange={(nextOpen) => { setHelpOpen(nextOpen); if (!nextOpen) requestAnimationFrame(() => triggerRef.current?.focus()); }}>
        <DialogContent showClose={false} className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto bg-card p-6 motion-reduce:animate-none!">
          <DialogClose asChild><Button size="icon" variant="ghost" aria-label="이용 안내 닫기" className="absolute right-3 top-3 h-11 w-11"><X className="h-4 w-4" /></Button></DialogClose>
          <DialogTitle className="pr-12 text-xl">VIBE-HR 이용 안내</DialogTitle>
          <DialogDescription className="mt-2">자주 사용하는 기능을 빠르게 찾아보세요.</DialogDescription>
          <dl className="mt-6 space-y-5 text-sm">
            <div><dt className="font-semibold">업무 이동</dt><dd className="mt-1 leading-6 text-muted-foreground">왼쪽에서 업무 영역을 선택한 뒤 세부 메뉴로 이동하세요. 작은 화면에서는 하단의 메뉴 버튼을 사용하세요.</dd></div>
            <div><dt className="font-semibold">열린 업무 탭</dt><dd className="mt-1 leading-6 text-muted-foreground">최근에 연 업무를 상단 탭에서 다시 찾을 수 있습니다. 탭에서 마우스 오른쪽 버튼이나 Shift + F10을 누르면 여러 탭을 정리할 수 있습니다. 작은 화면에서는 탭 옆 더보기 버튼으로 같은 메뉴를 여세요.</dd></div>
            <div><dt className="font-semibold">로그인 시간 연장</dt><dd className="mt-1 leading-6 text-muted-foreground">상단의 남은 시간 버튼을 누르면 로그인 시간을 연장합니다. 종료 전에 작업을 저장해 주세요.</dd></div>
            <div><dt className="font-semibold">내 정보와 화면 설정</dt><dd className="mt-1 leading-6 text-muted-foreground">내 계정 메뉴에서 프로필을 확인하고 테마를 바꿀 수 있습니다. 계정이나 인사 정보의 수정이 필요하면 사내 담당자에게 문의해 주세요.</dd></div>
          </dl>
        </DialogContent>
      </Dialog>
    </>
  );
}
