"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { ProductScene } from "./scenes";
import type { createMotionPlayer } from "./motion-player";
import styles from "./landing.module.css";

export function ProductMotion({ scene, playing }: { scene: ProductScene; playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<ReturnType<typeof createMotionPlayer> | null>(null);
  const desired = useRef(playing);
  const visible = useRef(false);
  useEffect(() => { desired.current = playing; playerRef.current?.setPlaying(playing && visible.current); }, [playing]);
  useEffect(() => {
    const canvas = canvasRef.current!;
    let disposed = false;
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      playerRef.current?.setPlaying(desired.current && visible.current);
    }, { threshold: .01 });
    observer.observe(canvas);
    void import("./motion-player").then(({ createMotionPlayer }) => {
      if (disposed) return;
      const player = createMotionPlayer(canvas);
      playerRef.current = player;
      player.setScene(scene.id);
      player.setPlaying(desired.current && visible.current);
    }).catch(() => { canvas.dataset.ready = "false"; });
    return () => { disposed = true; observer.disconnect(); playerRef.current?.dispose(); playerRef.current = null; };
  }, [scene.id]);

  return <div className={styles.motionMedia}>
    <Image src={scene.image} alt="" width={1320} height={825} unoptimized />
    <canvas ref={canvasRef} className={styles.motionCanvas} role="img" aria-label={`${scene.title} ${scene.id === "09" ? "물결과 VIBE-HR 자동 시연" : "업무 흐름 시연"}`} data-testid="product-motion" data-ready="false" data-motion-playing="false" />
    <span className={styles.motionLoading}>시연을 준비하고 있습니다.</span>
    <span className={styles.motionError}>시연을 불러오지 못했습니다. 화면을 다시 열어 주세요.</span>
  </div>;
}
