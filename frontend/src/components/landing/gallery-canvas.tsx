"use client";

import { useEffect, useRef } from "react";
import type { createGalleryWorld } from "./gallery-world";

type Props = {
  active: number;
  resetKey: number;
  paused: boolean;
  motionEnabled: boolean;
  onNavigate: (direction: number) => void;
  onOpen: (index: number) => void;
  onFailure: () => void;
  className: string;
};

export function GalleryCanvas({ active, resetKey, paused, motionEnabled, onNavigate, onOpen, onFailure, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<ReturnType<typeof createGalleryWorld> | null>(null);
  const propsRef = useRef({ active, paused, motionEnabled, onNavigate, onOpen, onFailure });
  useEffect(() => { propsRef.current = { active, paused, motionEnabled, onNavigate, onOpen, onFailure }; });
  useEffect(() => {
    const canvas = canvasRef.current!;
    let disposed = false;
    let gesture: { id: number; x: number; y: number; distance: number } | null = null;
    let wheel = 0;
    let lastWheel = 0;
    let lastStep = 0;
    void import("./gallery-world").then(({ createGalleryWorld }) => {
      if (disposed) return;
      const world = createGalleryWorld(canvas, () => propsRef.current.onFailure());
      worldRef.current = world;
      world.select(propsRef.current.active);
      world.pause(propsRef.current.paused);
      world.setMotionEnabled(propsRef.current.motionEnabled);
    }).catch(() => { if (!disposed) propsRef.current.onFailure(); });
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary) return;
      canvas.focus({ preventScroll: true });
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0 };
      canvas.setPointerCapture(event.pointerId);
      canvas.dataset.dragging = "true";
    };
    const move = (event: PointerEvent) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      gesture.distance += Math.hypot(dx, dy);
      gesture.x = event.clientX; gesture.y = event.clientY;
      if (gesture.distance > 6) worldRef.current?.turn(dx, dy);
    };
    const finish = (event: PointerEvent) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const click = gesture.distance <= 6 && event.type === "pointerup";
      gesture = null;
      canvas.dataset.dragging = "false";
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (click) {
        const index = worldRef.current?.pick(event.clientX, event.clientY);
        if (index !== undefined) propsRef.current.onOpen(index);
      }
    };
    const scroll = (event: WheelEvent) => {
      if (event.ctrlKey || propsRef.current.paused) return;
      if ((propsRef.current.active < 0 && event.deltaY < 0) || (propsRef.current.active === 16 && event.deltaY > 0)) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheel > 180) wheel = 0;
      lastWheel = now;
      if (now - lastStep < 500) return;
      wheel += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
      if (Math.abs(wheel) >= 55) {
        propsRef.current.onNavigate(Math.sign(wheel));
        lastStep = now; wheel = 0;
      }
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
    canvas.addEventListener("lostpointercapture", finish);
    canvas.addEventListener("wheel", scroll, { passive: false });
    return () => {
      disposed = true;
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", finish);
      canvas.removeEventListener("pointercancel", finish);
      canvas.removeEventListener("lostpointercapture", finish);
      canvas.removeEventListener("wheel", scroll);
      worldRef.current?.dispose();
      worldRef.current = null;
    };
  }, []);
  useEffect(() => worldRef.current?.select(active), [active, resetKey]);
  useEffect(() => worldRef.current?.pause(paused), [paused]);
  useEffect(() => worldRef.current?.setMotionEnabled(motionEnabled), [motionEnabled]);

  return <canvas ref={canvasRef} className={className} tabIndex={0} role="region" aria-label="제품 화면 3D 공간" aria-describedby="gallery-instructions" data-testid="product-gallery" data-ready="false" onKeyDown={event => {
    if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Enter", " "].includes(event.key)) event.preventDefault();
    if (["ArrowRight", "ArrowDown"].includes(event.key)) onNavigate(1);
    if (["ArrowLeft", "ArrowUp"].includes(event.key)) onNavigate(-1);
    if (event.key === "Enter" || event.key === " ") onOpen(Math.max(0, active));
  }} />;
}
