"use client";

import { ArrowLeft, ArrowRight, Expand, Grid2X2, Move, Pause, Play, RotateCcw, X } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { GalleryCanvas } from "./gallery-canvas";
import { ProductMotion } from "./product-motion";
import { clampScene, PRODUCT_SCENES } from "./scenes";
import styles from "./landing.module.css";

const WaterExhibit = dynamic(() => import("./water-exhibit"), { loading: () => <p>물결 장면을 준비하고 있습니다.</p> });
const CAPABILITY_QUERY = "(min-width: 900px) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
function subscribe(callback: () => void) {
  const query = matchMedia(CAPABILITY_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const getSnapshot = () => matchMedia(CAPABILITY_QUERY).matches;
const getServerSnapshot = () => false;
const MOTION_QUERY = "(prefers-reduced-motion: no-preference)";
function subscribeMotion(callback: () => void) {
  const query = matchMedia(MOTION_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const getMotionSnapshot = () => matchMedia(MOTION_QUERY).matches;

export function ProductLanding() {
  const capable = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const motionAvailable = useSyncExternalStore(subscribeMotion, getMotionSnapshot, getServerSnapshot);
  const [motionPaused, setMotionPaused] = useState(false);
  const [list, setList] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(-1);
  const [resetKey, setResetKey] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const space = capable && !list && !failed;
  const current = active < 0 ? null : PRODUCT_SCENES[active];
  const enlarged = selected === null ? null : PRODUCT_SCENES[selected];
  const isOpen = selected !== null;
  const navigate = useCallback((direction: number) => setActive(index => clampScene(index + direction)), []);
  const open = useCallback((index: number) => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActive(index); setSelected(index);
  }, []);
  const fallback = useCallback(() => setFailed(true), []);
  const close = useCallback(() => setSelected(null), []);
  const select = (index: number) => {
    setActive(index);
    if (!space) document.getElementById(`scene-${PRODUCT_SCENES[index].id}`)?.scrollIntoView({ block: "center", behavior: "instant" });
  };
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;
    dialog.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = oldOverflow;
      const target = returnFocusRef.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>('#product-explore button')?.focus({ preventScroll: true });
    };
  }, [isOpen]);
  useEffect(() => {
    if (space || !motionAvailable || isOpen || !listRef.current) return;
    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) ratios.set(Number((entry.target as HTMLElement).dataset.sceneIndex), entry.intersectionRatio);
      const candidates = [...ratios].filter(([, ratio]) => ratio > .15).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
      setActive(previous => {
        if (!candidates.length) return -1;
        return (ratios.get(previous) ?? 0) >= candidates[0][1] - .01 ? previous : candidates[0][0];
      });
    }, { threshold: [0, .15, .25, .5, .75, 1] });
    listRef.current.querySelectorAll("li[data-scene-index]").forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, [space, motionAvailable, isOpen]);

  return <main className={styles.landing} data-mode={space ? "space" : "list"}>
    <a className={styles.skip} href="#product-explore">제품 화면으로 건너뛰기</a>
    <header className={styles.header}>
      <Link className={styles.brand} href="/" aria-label="VIBE-HR 제품 소개"><Image src="/brand/vibehr-mark-color.svg" alt="" width={27} height={27} /><span>VIBE-HR</span></Link>
      <h1 id="product-title" className={styles.tagline}>사람과 일, <span>하나의 흐름으로.</span></h1>
      <Link className={styles.login} href="/login">로그인 <ArrowRight size={16} aria-hidden="true" /></Link>
    </header>

    <p id="product-description" className={styles.srOnly}>인사부터 근태, 결재와 급여까지. VIBE-HR의 실제 업무 화면을 17개 장면으로 둘러보세요.</p>

    <section id="product-explore" className={styles.explore} aria-label="VIBE-HR 제품 갤러리" aria-describedby="product-description">
      <div className={styles.viewBar}>
        <p id="gallery-instructions">{space ? "스크롤로 이동 / 드래그로 둘러보기 / 화면 클릭으로 확대" : "화면을 선택하면 크게 볼 수 있습니다."}<span className={styles.srOnly}> 방향키로 이동하고 Enter로 확대할 수 있습니다.</span></p>
        <div className={styles.viewActions}>
          {motionAvailable && <button type="button" onClick={() => setMotionPaused(value => !value)} aria-pressed={motionPaused}>{motionPaused ? <Play size={15} /> : <Pause size={15} />}{motionPaused ? "시연 재생" : "시연 일시 정지"}</button>}
          {capable && !failed && <button type="button" onClick={() => setList(value => !value)} aria-pressed={list}>{list ? <Move size={15} /> : <Grid2X2 size={15} />}{list ? "공간으로 보기" : "목록으로 보기"}</button>}
        </div>
      </div>
      {failed && <p className={styles.fallback} role="status">3D 대신 모든 제품 화면을 목록으로 보여드립니다.</p>}
      {space ? <div className={styles.stage}>
        <GalleryCanvas className={styles.canvas} active={active} resetKey={resetKey} paused={selected !== null} motionEnabled={motionAvailable && !motionPaused} onNavigate={navigate} onOpen={open} onFailure={fallback} />
      </div> : <ol ref={listRef} className={styles.sceneList}>
        {PRODUCT_SCENES.map((scene, index) => <li key={scene.id} id={`scene-${scene.id}`} data-scene-index={index}>
          <button type="button" className={styles.sceneButton} onClick={() => open(index)} aria-label={`${scene.id} ${scene.title} 확대`}>
            <div className={styles.poster}>{motionAvailable && active === index && !isOpen && scene.id !== "09" ? <ProductMotion scene={scene} playing={!motionPaused} /> : <Image src={scene.image} alt={`${scene.title} ${scene.id === "09" ? "물결 배경" : "제품 시연 화면"}`} width={1320} height={825} unoptimized loading={index < 2 ? "eager" : "lazy"} />}<span><Expand size={18} /></span></div>
            <div className={styles.sceneCaption}><span>{scene.id}</span><h2>{scene.title}</h2><span>{scene.category}</span></div>
            <p>{scene.description}</p>
          </button>
        </li>)}
      </ol>}

      <div className={styles.controlBar}>
        <div className={styles.current} aria-live="polite" aria-atomic="true"><span>{current?.id ?? "00"} <small>/ 17</small></span><div><strong>{current?.title ?? "모든 업무가 연결되는 공간"}</strong><p>{current?.description ?? "왼쪽 8개, 오른쪽 8개, 그리고 물결의 장면."}</p></div></div>
        <div className={styles.actions}>
          {space && <><button type="button" onClick={() => { setActive(-1); setResetKey(value => value + 1); }} aria-label="전체 공간 보기"><RotateCcw size={16} /></button><button type="button" aria-label="이전 장면" disabled={active < 0} onClick={() => navigate(-1)}><ArrowLeft size={18} /></button><button type="button" aria-label="다음 장면" disabled={active === 16} onClick={() => navigate(1)}><ArrowRight size={18} /></button><button type="button" className={styles.open} onClick={() => open(Math.max(0, active))}>화면 확대 <Expand size={15} /></button></>}
          <label className={styles.jump}><span className={styles.srOnly}>장면 바로 이동</span><select aria-label="장면 바로 이동" value={active < 0 ? "" : String(active)} onChange={event => select(Number(event.target.value))}><option value="" disabled>전체 장면</option>{PRODUCT_SCENES.map((scene, index) => <option key={scene.id} value={index}>{scene.id} {scene.title}</option>)}</select></label>
        </div>
      </div>
    </section>
    <footer className={styles.footer}><p>제품 화면의 이름, 인원과 금액은 시연용 합성 데이터입니다.</p></footer>

    {enlarged && <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="scene-title" aria-describedby="scene-description" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }} onKeyDown={event => {
      if (event.key === "ArrowLeft" && selected! > 0) { event.preventDefault(); setSelected(selected! - 1); setActive(selected! - 1); }
      if (event.key === "ArrowRight" && selected! < 16) { event.preventDefault(); setSelected(selected! + 1); setActive(selected! + 1); }
    }}>
      <div className={styles.dialogInner}>
        <header className={styles.dialogHeader}><div><span>{enlarged.id} / 17</span><h2 id="scene-title">{enlarged.title}</h2></div><button type="button" aria-label="확대 화면 닫기" onClick={close} autoFocus><X size={22} /></button></header>
        <div className={styles.detailMedia}>{enlarged.id === "09" ? <WaterExhibit /> : motionAvailable ? <ProductMotion key={enlarged.id} scene={enlarged} playing={!motionPaused} /> : <Image key={enlarged.id} src={enlarged.image} alt={`${enlarged.title} 시연 화면`} width={1320} height={825} unoptimized priority />}</div>
        <div className={styles.dialogFooter}><p id="scene-description">{enlarged.detail}<small>{enlarged.id === "09" ? "기존 VIBE-HR 배경" : "시연용 합성 데이터 / 업무 저장을 실행하지 않는 화면입니다."}</small></p><div>{enlarged.id !== "09" && motionAvailable && <button type="button" aria-label={motionPaused ? "시연 재생" : "시연 일시 정지"} aria-pressed={motionPaused} onClick={() => setMotionPaused(value => !value)}>{motionPaused ? <Play size={18} /> : <Pause size={18} />}</button>}<button type="button" aria-label="이전 확대 화면" disabled={selected === 0} onClick={() => { setSelected(selected! - 1); setActive(selected! - 1); }}><ArrowLeft size={18} /></button><button type="button" aria-label="다음 확대 화면" disabled={selected === 16} onClick={() => { setSelected(selected! + 1); setActive(selected! + 1); }}><ArrowRight size={18} /></button></div></div>
      </div>
    </dialog>}
  </main>;
}
