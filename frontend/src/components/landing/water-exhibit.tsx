"use client";

import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createFrameQualityController } from "@/components/auth/conservatory/frame-quality";
import styles from "./landing.module.css";

export default function WaterExhibit() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(() => typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const canvas = canvasRef.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let world: ReturnType<typeof import("@/components/auth/conservatory-scene").createConservatoryScene> | undefined;
    let disposed = false, frame = 0, previous = 0, time = 0, scale = 1;
    const quality = createFrameQualityController();
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      world?.resize(rect.width, rect.height, Math.min(devicePixelRatio, 1.25) * scale);
    };
    const tick = (now: number) => {
      frame = 0;
      if (disposed || document.hidden || reduced.matches || !world) return;
      const delta = previous ? Math.min((now - previous) / 1000, .05) : 0;
      previous = now; time += delta;
      const action = quality.next(now, world.vegetationCount, scale > .45);
      if (action === "reduce-vegetation") world.reduceVegetation();
      if (action === "reduce-resolution") { scale = Math.max(.45, scale * .75); resize(); }
      world.render(time, delta);
      canvas.dataset.ready = "true";
      canvas.dataset.frame = String(time);
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame); frame = 0; previous = 0; quality.reset();
      if (world && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
    };
    const fail = () => {
      if (disposed) return;
      setFailed(true); setPlaying(false);
    };
    const lost = (event: Event) => { event.preventDefault(); fail(); };
    const move = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      world?.setPointer((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2, true);
    };
    const leave = () => world?.setPointer(0, 0, false);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("webglcontextlost", lost);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    void import("@/components/auth/conservatory-scene").then(async ({ createConservatoryScene }) => {
      if (disposed) return;
      world = createConservatoryScene(canvas);
      await world.ready;
      if (disposed) return;
      resize(); sync();
    }).catch(fail);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("webglcontextlost", lost);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
      world?.dispose();
    };
  }, [playing]);

  return <div className={styles.water}>
    <Image src="/images/conservatory-login-desktop.webp" alt="물결과 진주, 분홍빛 정원으로 이루어진 기존 VIBE-HR 배경" fill sizes="94vw" priority />
    {playing && <canvas ref={canvasRef} className={styles.waterCanvas} data-testid="water-exhibit" data-ready="false" />}
    <button className={styles.waterToggle} type="button" onClick={() => { setFailed(false); setPlaying(value => !value); }} aria-pressed={playing}>
      {playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "장면 정지" : failed ? "장면 다시 재생" : "물결 장면 재생"}
    </button>
    {failed && <p role="status" className={styles.waterStatus}>현재 환경에서는 정지 화면을 보여드립니다.</p>}
  </div>;
}
