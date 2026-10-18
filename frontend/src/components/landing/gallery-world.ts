import * as THREE from "three";
import { PRODUCT_SCENES } from "./scenes";
import { createMotionPlayer } from "./motion-player";

// This module is imported only after desktop/motion capability checks.
export function createGalleryWorld(canvas: HTMLCanvasElement, onFailure: () => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#ffffff");
  const camera = new THREE.PerspectiveCamera(56, 1, .1, 100);
  camera.position.set(0, .2, 17);
  const targetPosition = camera.position.clone();
  const targetLook = new THREE.Vector3(0, 0, -12);
  const look = targetLook.clone();
  const frames: THREE.Mesh[] = [];
  const resources: Array<{ dispose: () => void }> = [];
  const textures: THREE.Texture[] = [];
  const posters: Array<THREE.Texture | undefined> = [];
  const raycaster = new THREE.Raycaster();
  let disposed = false;
  let paused = false;
  let raf = 0;
  let lastTime = 0;
  let yaw = 0;
  let pitch = 0;
  let dirty = true;
  let selected = -1;
  let motionEnabled = true, visible = true;
  const overviewDepth = () => Math.max(17, 8 + 25 / camera.aspect);

  function plane(width: number, height: number, color: string) {
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    resources.push(geometry, material);
    return new THREE.Mesh(geometry, material);
  }
  PRODUCT_SCENES.forEach((item, index) => {
    const center = index === 8;
    const side = index < 8 ? -1 : 1;
    const slot = index < 8 ? index : index - 9;
    const group = new THREE.Group();
    if (center) group.position.set(0, .2, -27.7);
    else {
      const depth = index < 8 ? 5 - Math.floor(slot / 2) * 8 : -19 + Math.floor(slot / 2) * 8;
      group.position.set(side * 11.35, slot % 2 === 0 ? 2.8 : -1.8, depth);
      group.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    const width = center ? 10 : item.id === "02" || item.id === "10" ? 5.6 : item.id === "05" ? 6.8 : 6.3;
    const height = width / 1.6;
    const frame = plane(width + .08, height + .08, "#dce1e8");
    frame.position.z = -.03;
    group.add(frame);
    const picture = plane(width, height, "#ffffff");
    picture.userData.index = index;
    group.add(picture);
    frames.push(picture);

    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 1024; labelCanvas.height = 72;
    const ctx = labelCanvas.getContext("2d")!;
    ctx.fillStyle = "#444a52";
    ctx.font = `500 27px ${getComputedStyle(canvas).fontFamily}`;
    ctx.fillText(`${item.id}   ${item.title}`, 0, 42);
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    labelTexture.colorSpace = THREE.SRGBColorSpace;
    textures.push(labelTexture);
    const label = plane(width, width * 72 / 1024, "#ffffff");
    label.material.map = labelTexture;
    label.material.transparent = true;
    label.position.set(0, -height / 2 - .37, .02);
    group.add(label);
    scene.add(group);
  });

  const motionCanvas = document.createElement("canvas");
  const motionTexture = new THREE.CanvasTexture(motionCanvas);
  motionTexture.colorSpace = THREE.SRGBColorSpace;
  textures.push(motionTexture);
  const motion = createMotionPlayer(motionCanvas, id => {
    if (disposed || selected < 0 || PRODUCT_SCENES[selected].id !== id) return;
    const material = frames[selected].material as THREE.MeshBasicMaterial;
    if (material.map !== motionTexture) { material.map = motionTexture; material.needsUpdate = true; }
    motionTexture.needsUpdate = true;
    canvas.dataset.motionTime = motionCanvas.dataset.motionTime;
    invalidate();
  }, state => {
    canvas.dataset.motionPlaying = String(state.playing);
    canvas.dataset.motionScene = state.scene ?? "";
    canvas.dataset.motionPhase = String(state.phase);
    canvas.dataset.motionFailed = String(state.failed);
  }, getComputedStyle(canvas).fontFamily);
  const projected = new THREE.Vector3();
  function syncMotion() {
    let inView = false;
    if (selected >= 0 && selected !== 8) {
      camera.updateMatrixWorld();
      frames[selected].getWorldPosition(projected).project(camera);
      inView = Math.abs(projected.x) < .9 && Math.abs(projected.y) < .9 && projected.z >= -1 && projected.z <= 1;
    }
    motion.setPlaying(inView && motionEnabled && !paused && visible);
  }
  const loader = new THREE.TextureLoader();
  // Limit concurrent decoding; posters remain the only gallery textures.
  let nextTexture = 0;
  const loadNext = () => {
    if (disposed || nextTexture >= PRODUCT_SCENES.length) return;
    const index = nextTexture++;
    loader.load(PRODUCT_SCENES[index].image, texture => {
      if (disposed) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      textures.push(texture);
      posters[index] = texture;
      const material = frames[index].material as THREE.MeshBasicMaterial;
      if (material.map !== motionTexture) material.map = texture;
      material.needsUpdate = true;
      invalidate();
      loadNext();
    }, undefined, () => { if (!disposed) onFailure(); });
  };

  function tick(now: number) {
    raf = 0;
    if (disposed || paused || document.hidden || !visible) return;
    const delta = lastTime ? Math.min((now - lastTime) / 1000, .05) : 1 / 60;
    lastTime = now;
    const amount = 1 - Math.exp(-7 * delta);
    camera.position.lerp(targetPosition, amount);
    look.lerp(targetLook, amount);
    camera.lookAt(look);
    camera.rotateY(yaw);
    camera.rotateX(pitch);
    syncMotion();
    renderer.render(scene, camera);
    canvas.dataset.ready = "true";
    canvas.dataset.view = `${camera.position.x.toFixed(3)},${camera.position.z.toFixed(3)},${yaw.toFixed(3)},${pitch.toFixed(3)}`;
    dirty = camera.position.distanceToSquared(targetPosition) > .00001 || look.distanceToSquared(targetLook) > .00001;
    if (dirty) raf = requestAnimationFrame(tick);
  }
  function invalidate() {
    dirty = true;
    if (!raf && !paused && !disposed && !document.hidden && visible) raf = requestAnimationFrame(tick);
  }
  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (selected < 0) {
      targetPosition.set(0, .2, overviewDepth());
      if (canvas.dataset.ready !== "true") camera.position.copy(targetPosition);
    }
    invalidate();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) { cancelAnimationFrame(raf); raf = 0; motion.setPlaying(false); }
    else invalidate();
  });
  visibilityObserver.observe(canvas);
  const visibility = () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else { lastTime = 0; invalidate(); }
  };
  const contextLost = (event: Event) => { event.preventDefault(); if (!disposed) onFailure(); };
  document.addEventListener("visibilitychange", visibility);
  canvas.addEventListener("webglcontextlost", contextLost);
  resize();
  for (let i = 0; i < 3; i++) loadNext();

  return {
    select(index: number) {
      if (selected >= 0) {
        const material = frames[selected].material as THREE.MeshBasicMaterial;
        material.map = posters[selected] ?? null;
        material.needsUpdate = true;
      }
      motion.setPlaying(false);
      selected = index;
      motion.setScene(index >= 0 && index !== 8 ? PRODUCT_SCENES[index].id : null);
      yaw = 0; pitch = 0;
      if (index < 0) {
        targetPosition.set(0, .2, overviewDepth());
        targetLook.set(0, 0, -12);
      } else {
        const framePosition = frames[index].getWorldPosition(new THREE.Vector3());
        targetLook.copy(framePosition);
        if (index === 8) targetPosition.set(0, .2, -14);
        else targetPosition.set(index < 8 ? -4.8 : 4.8, framePosition.y, framePosition.z + 2.8);
      }
      invalidate();
    },
    turn(dx: number, dy: number) {
      yaw = THREE.MathUtils.clamp(yaw + dx * .0025, -.65, .65);
      pitch = THREE.MathUtils.clamp(pitch + dy * .0025, -.3, .3);
      invalidate();
    },
    pick(x: number, y: number) {
      const rect = canvas.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2), camera);
      return raycaster.intersectObjects(frames)[0]?.object.userData.index as number | undefined;
    },
    pause(value: boolean) {
      paused = value;
      if (paused) { cancelAnimationFrame(raf); raf = 0; motion.setPlaying(false); }
      else { lastTime = 0; invalidate(); }
    },
    setMotionEnabled(value: boolean) {
      motionEnabled = value;
      if (!value) motion.setPlaying(false);
      invalidate();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      visibilityObserver.disconnect();
      motion.dispose();
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("webglcontextlost", contextLost);
      resources.forEach(resource => resource.dispose());
      textures.forEach(texture => texture.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
