export type MotionStep = { image: string; label: string; pointer: { x: number; y: number }; action: string };
type MotionClip = { id: string; theme: string; steps: MotionStep[] };
type MotionStatus = { scene: string | null; playing: boolean; ready: boolean; failed: boolean; loading: boolean; phase: number };

const STEP_MS = 1800;
const WIDTH = 1320, HEIGHT = 825, BAR = 48;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Plays captured UI states, never a live business screen or a business API. */
export function createMotionPlayer(canvas: HTMLCanvasElement, onFrame: (scene: string) => void = () => {}, onStatus: (status: MotionStatus) => void = () => {}, fontFamily?: string) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");
  const ctx = context;
  canvas.width = WIDTH; canvas.height = HEIGHT;
  let scene: string | null = null, clip: MotionClip | null = null;
  let images: ImageBitmap[] = [];
  let request: AbortController | null = null;
  let desired = false, disposed = false, failed = false;
  let frame = 0, elapsed = 0, previous = 0, lastDraw = 0, phase = 0;
  let lastStatus = "";
  const font = fontFamily || getComputedStyle(canvas).fontFamily || "sans-serif";
  const ready = () => Boolean(clip && images.length === clip.steps.length);
  const canPlay = () => desired && ready() && !disposed && !document.hidden;

  function status() {
    const value = { scene, playing: canPlay(), ready: ready(), failed, loading: request !== null, phase };
    canvas.dataset.motionScene = scene ?? "";
    canvas.dataset.motionPlaying = String(value.playing);
    canvas.dataset.ready = String(value.ready);
    canvas.dataset.motionPhase = String(phase);
    canvas.dataset.motionFailed = String(failed);
    canvas.dataset.motionLoading = String(value.loading);
    const signature = JSON.stringify(value);
    if (signature !== lastStatus) { lastStatus = signature; onStatus(value); }
  }
  function draw() {
    if (!clip || !images.length || !scene || disposed) return;
    const duration = clip.steps.length * STEP_MS;
    const local = elapsed % duration;
    const targetPhase = Math.floor(local / STEP_MS);
    const progress = (local % STEP_MS) / STEP_MS;
    const from = targetPhase === 0 && elapsed < duration ? 0 : (targetPhase + images.length - 1) % images.length;
    phase = progress < .55 ? from : targetPhase;
    const step = clip.steps[targetPhase], previousStep = clip.steps[from];
    const dark = clip.theme === "dark";
    ctx.fillStyle = dark ? "#0e1b31" : "#ffffff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const imageHeight = HEIGHT - BAR, imageWidth = imageHeight * 1.6, left = (WIDTH - imageWidth) / 2;
    ctx.drawImage(images[from], left, 0, imageWidth, imageHeight);
    ctx.globalAlpha = from === targetPhase ? 1 : clamp((progress - .42) / .13);
    ctx.drawImage(images[targetPhase], left, 0, imageWidth, imageHeight);
    ctx.globalAlpha = 1;

    const move = 1 - Math.pow(1 - clamp(progress / .42), 3);
    const x = left + (previousStep.pointer.x + (step.pointer.x - previousStep.pointer.x) * move) * imageWidth;
    const y = (previousStep.pointer.y + (step.pointer.y - previousStep.pointer.y) * move) * imageHeight;
    const pulse = (progress - .4) / .22;
    if (step.action === "click" && pulse >= 0 && pulse <= 1) {
      ctx.beginPath(); ctx.arc(x, y, 12 + pulse * 28, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(60,109,238,${1 - pulse})`; ctx.lineWidth = 4; ctx.stroke();
    }
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(7, 32); ctx.lineTo(14, 23); ctx.lineTo(24, 22); ctx.closePath();
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#315fce"; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.fill(); ctx.stroke(); ctx.restore();

    ctx.fillStyle = dark ? "#0e1b31" : "#ffffff"; ctx.fillRect(0, HEIGHT - BAR, WIDTH, BAR);
    ctx.fillStyle = dark ? "#c5d5f7" : "#50617a"; ctx.font = `500 17px ${font}`; ctx.fillText(`시연 ${phase + 1}/${clip.steps.length}`, 24, HEIGHT - 16);
    ctx.fillStyle = dark ? "#ffffff" : "#202a38"; ctx.font = `600 20px ${font}`; ctx.fillText(clip.steps[phase].label, 130, HEIGHT - 15);
    const trackX = WIDTH - 220, trackY = HEIGHT - 25;
    ctx.fillStyle = dark ? "#354258" : "#e3e8f0"; ctx.fillRect(trackX, trackY, 190, 3);
    ctx.fillStyle = "#3c6dee"; ctx.fillRect(trackX, trackY, local / duration * 190, 3);
    canvas.dataset.motionTime = String(Math.round(elapsed));
    status(); onFrame(scene);
  }
  function tick(now: number) {
    frame = 0;
    if (!canPlay()) return;
    if (previous) elapsed += Math.min(now - previous, 80);
    previous = now;
    if (now - lastDraw >= 1000 / 30) { lastDraw = now; draw(); }
    frame = requestAnimationFrame(tick);
  }
  async function load() {
    if (!scene || request || ready() || disposed || failed) return;
    const controller = new AbortController(), requestedScene = scene;
    request = controller;
    status();
    let decoded: ImageBitmap[] = [];
    try {
      const response = await fetch(`/images/product/motion/${requestedScene}/motion.json`, { signal: controller.signal });
      if (!response.ok) throw new Error("Motion manifest unavailable");
      const nextClip = await response.json() as MotionClip;
      const results = await Promise.allSettled(nextClip.steps.map(async step => {
        const response = await fetch(step.image, { signal: controller.signal });
        if (!response.ok) throw new Error("Motion frame unavailable");
        return createImageBitmap(await response.blob());
      }));
      decoded = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
      if (disposed || controller.signal.aborted || requestedScene !== scene || decoded.length !== nextClip.steps.length || decoded.length < 2) {
        decoded.forEach(image => image.close()); decoded = [];
        if (!disposed && !controller.signal.aborted) throw new Error("Incomplete motion frames");
        return;
      }
      await document.fonts.ready;
      if (disposed || controller.signal.aborted) { decoded.forEach(image => image.close()); return; }
      clip = nextClip; images = decoded; decoded = [];
      draw(); sync();
    } catch {
      decoded.forEach(image => image.close());
      if (!disposed && !controller.signal.aborted) { failed = true; status(); }
    } finally {
      if (request === controller) request = null;
      if (!disposed) status();
    }
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; previous = 0; lastDraw = 0;
    if (desired && !document.hidden && !failed && !ready()) void load();
    if (canPlay()) frame = requestAnimationFrame(tick);
    status();
  }
  const visibility = () => sync();
  document.addEventListener("visibilitychange", visibility);
  return {
    setScene(id: string | null) {
      if (scene === id) return;
      request?.abort(); request = null;
      cancelAnimationFrame(frame); frame = 0;
      images.forEach(image => image.close()); images = []; clip = null;
      scene = id; failed = false; elapsed = 0; phase = 0;
      sync();
    },
    setPlaying(value: boolean) {
      if (desired === value) return;
      desired = value;
      if (value && failed) failed = false;
      sync();
    },
    dispose() {
      disposed = true; desired = false;
      cancelAnimationFrame(frame); request?.abort();
      images.forEach(image => image.close()); images = []; clip = null;
      document.removeEventListener("visibilitychange", visibility);
      status();
    },
  };
}
