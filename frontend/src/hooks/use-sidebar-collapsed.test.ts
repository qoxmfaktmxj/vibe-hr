import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";

describe("useSidebarCollapsed", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("기본값은 false (expanded)", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(false);
  });

  it("toggle로 상태 변경 + localStorage 저장", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem("vibe-sidebar-collapsed")).toBe("true");
  });

  it("setCollapsed로 명시적 값 설정 + localStorage 저장", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current.setCollapsed(true));
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem("vibe-sidebar-collapsed")).toBe("true");

    act(() => result.current.setCollapsed(false));
    expect(result.current.collapsed).toBe(false);
    expect(localStorage.getItem("vibe-sidebar-collapsed")).toBe("false");
  });

  it("localStorage에서 초기값 복원 (true)", () => {
    localStorage.setItem("vibe-sidebar-collapsed", "true");
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(true);
  });

  it("localStorage에 없으면 false 유지", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(false);
  });
});
