"use client";

import { Pause, Play } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import styles from "./login.module.css";

export function LoginScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const shell = canvas.closest("main");
    if (!shell) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let world: ReturnType<typeof import("./conservatory-scene").createConservatoryScene> | undefined;
    let title: ReturnType<typeof import("./liquid-title").createLiquidTitle> | undefined;
    let disposed = false;
    let lost = false;
    let loading = false;
    let sceneReady = false;
    let idleCallback: number | undefined;
    let loadTimer: number | undefined;
    let visible = true;
    let frame = 0;
    let previous = 0;
    let time = 0;
    let slowFrames = 0;
    let resolutionScale = 1;
    let bounds = canvas.getBoundingClientRect();

    const canAnimate = () => !disposed && !lost && visible && !document.hidden && !reduced.matches && !pausedRef.current;
    const draw = (delta: number) => {
      if (!sceneReady || !world || !title || lost || disposed) return;
      world.render(time, delta);
      title.render(time, delta);
      world.renderOverlay(title.scene, title.camera);
      canvas.dataset.frame = String(time);
      canvas.dataset.motion = canAnimate() ? "playing" : "paused";
    };
    const tick = (now: number) => {
      frame = 0;
      if (!canAnimate()) return;
      const delta = previous ? Math.min((now - previous) / 1000, .05) : 0;
      if (previous && now - previous > 36) slowFrames++;
      else slowFrames = Math.max(0, slowFrames - 1);
      if (slowFrames >= 24 && resolutionScale > .45) {
        resolutionScale = Math.max(.45, resolutionScale * .75);
        slowFrames = 0;
        world?.resize(bounds.width, bounds.height, Math.min(window.devicePixelRatio, 1.25) * resolutionScale);
      }
      previous = now;
      time += delta;
      draw(delta);
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      if (!sceneReady) {
        scheduleLoad();
        return;
      }
      title?.setReducedMotion(reduced.matches);
      draw(0);
      if (world && canAnimate()) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      bounds = canvas.getBoundingClientRect();
      world?.resize(bounds.width, bounds.height, Math.min(window.devicePixelRatio, 1.25) * resolutionScale);
      title?.resize(bounds.width, bounds.height);
      sync();
    };
    const move = (event: PointerEvent) => {
      if (!canAnimate()) return;
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const overForm = event.target instanceof Element && Boolean(event.target.closest(`.${styles.formWrap}, button, a, input, select`));
      const active = !overForm && x >= 0 && y >= 0 && x <= bounds.width && y <= bounds.height;
      world?.setPointer(x / bounds.width * 2 - 1, 1 - y / bounds.height * 2, active);
      title?.setPointer(x, y, active);
    };
    const leave = () => {
      world?.setPointer(0, 0, false);
      title?.setPointer(0, 0, false);
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      cancelAnimationFrame(frame);
      canvas.dataset.ready = "false";
      canvas.dataset.motion = "paused";
      setReady(false);
    };

    const sizeObserver = new ResizeObserver(resize);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    sizeObserver.observe(canvas);
    visibilityObserver.observe(canvas);
    shell.addEventListener("pointermove", move);
    shell.addEventListener("pointerleave", leave);
    canvas.addEventListener("scene-motion", sync);
    canvas.addEventListener("webglcontextlost", contextLost);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);

    function scheduleLoad() {
      if (loading || idleCallback !== undefined || loadTimer !== undefined || !canAnimate()) return;
      const load = () => {
        idleCallback = undefined;
        loadTimer = undefined;
        if (!canAnimate()) return;
        loading = true;
        void Promise.all([import("./conservatory-scene"), import("./liquid-title"), document.fonts.ready]).then(async ([sceneModule, titleModule]) => {
          if (!canAnimate()) { loading = false; return; }
          world = sceneModule.createConservatoryScene(canvas!);
          title = titleModule.createLiquidTitle(getComputedStyle(shell!).fontFamily);
          await world.ready;
          if (disposed || lost) return;
          sceneReady = true;
          resize();
          canvas!.dataset.ready = "true";
          setReady(true);
        }).catch(() => {
          if (disposed) return;
          cancelAnimationFrame(frame);
          world?.dispose();
          title?.dispose();
          world = undefined;
          title = undefined;
          sceneReady = false;
          canvas!.dataset.ready = "false";
          canvas!.dataset.motion = "paused";
          setReady(false);
        });
      };
      if (typeof window.requestIdleCallback === "function") {
        idleCallback = window.requestIdleCallback(load, { timeout: 1500 });
      } else {
        loadTimer = window.setTimeout(load, 250);
      }
    }
    scheduleLoad();

    return () => {
      disposed = true;
      if (idleCallback !== undefined) window.cancelIdleCallback(idleCallback);
      if (loadTimer !== undefined) window.clearTimeout(loadTimer);
      cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      visibilityObserver.disconnect();
      shell.removeEventListener("pointermove", move);
      shell.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("scene-motion", sync);
      canvas.removeEventListener("webglcontextlost", contextLost);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
      world?.dispose();
      title?.dispose();
    };
  }, []);

  return (
    <>
      <div className={styles.scene} aria-hidden="true">
        <Image src="/images/conservatory-login.webp" fill priority sizes="100vw" alt="" className={styles.sceneImage} />
        <canvas ref={canvasRef} className={styles.sceneCanvas} data-testid="login-scene" data-ready="false" data-motion="paused" />
      </div>
      <div className={`${styles.sceneHeading} ${ready ? styles.sceneHeadingReady : ""}`}>
        <p>사람이 중심이 되는</p>
        <p>VIBE-HR</p>
      </div>
      {ready ? <button type="button" className={styles.motionToggle} aria-label={paused ? "배경 재생" : "배경 일시 정지"} aria-pressed={paused} onClick={() => {
        pausedRef.current = !pausedRef.current;
        setPaused(pausedRef.current);
        canvasRef.current?.dispatchEvent(new Event("scene-motion"));
      }}>
        {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
        <span>{paused ? "배경 재생" : "배경 일시 정지"}</span>
      </button> : null}
    </>
  );
}
