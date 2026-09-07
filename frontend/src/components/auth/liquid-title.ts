import * as THREE from "three";

export function createLiquidTitle(fontFamily: string) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 2;
  const artwork = document.createElement("canvas");
  artwork.width = 1280;
  artwork.height = 512;
  const context = artwork.getContext("2d");
  if (!context) throw new Error("Text canvas unavailable");
  context.textAlign = "center";
  context.fillStyle = "#ffffff";
  context.font = `400 54px ${fontFamily}`;
  context.fillText("사람이 중심이 되는", 640, 130);
  context.font = `500 216px ${fontFamily}`;
  context.fillText("VIBE-HR", 640, 348);
  const texture = new THREE.CanvasTexture(artwork);
  texture.minFilter = THREE.LinearFilter;
  const pointer = new THREE.Vector2(-3, -3);
  const previous = pointer.clone();
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      textMap: { value: texture },
      pointer: { value: pointer },
      time: { value: 0 },
      impulse: { value: 0 },
      motion: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      uniform float time, motion;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.y += sin(uv.x * 6.0 - time * .7) * .003 * motion;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D textMap;
      uniform vec2 pointer;
      uniform float time, impulse, motion;
      void main() {
        vec2 delta = vUv - pointer;
        float distance = length(delta * vec2(1., .65));
        float local = exp(-distance * distance * 26.) * impulse;
        vec2 shift = vec2(
          sin(vUv.y * 16. + time * 2.1),
          cos(vUv.x * 14. - time * 1.7)
        ) * local * .014;
        shift.y += sin(vUv.x * 7. - time * .75) * .003 * motion;
        float alpha = texture2D(textMap, vUv + shift).a;
        vec3 ink = mix(vec3(.105, .105, .1), vec3(.48, .44, .5), local * .65);
        gl_FragColor = vec4(ink, alpha * (1. - local * .2));
      }
    `,
  });
  const geometry = new THREE.PlaneGeometry(1, 1, 64, 16);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  const bounds = { x: 0, y: 0, width: 1, height: 1 };
  let energy = 0;
  let reduced = false;
  let active = false;

  return {
    scene,
    camera,
    resize(width: number, height: number) {
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      const mobile = width < 1000;
      bounds.width = mobile ? Math.min(width - 24, 460) : Math.min(width * .48, 690);
      bounds.height = bounds.width * .4;
      bounds.x = mobile ? (width - bounds.width) / 2 : width * .35 - bounds.width / 2;
      bounds.y = mobile ? 40 : Math.min(height * .37, 440);
      mesh.scale.set(bounds.width, bounds.height, 1);
      mesh.position.set(bounds.x + bounds.width / 2 - width / 2, height / 2 - bounds.y - bounds.height / 2, 0);
    },
    setPointer(x: number, y: number, isActive: boolean) {
      active = isActive && x >= bounds.x - 80 && x <= bounds.x + bounds.width + 80 && y >= bounds.y - 50 && y <= bounds.y + bounds.height + 50;
      if (!active || reduced) return;
      pointer.set((x - bounds.x) / bounds.width, 1 - (y - bounds.y) / bounds.height);
      const distance = previous.x < -1 ? 0 : pointer.distanceTo(previous);
      energy = Math.min(1, energy + distance * 7 + .05);
      previous.copy(pointer);
    },
    setReducedMotion(value: boolean) {
      reduced = value;
      material.uniforms.motion.value = value ? 0 : 1;
      if (value) energy = 0;
    },
    render(time: number, delta: number) {
      energy *= Math.exp(-delta * (active ? 1.1 : 3));
      material.uniforms.time.value = time;
      material.uniforms.impulse.value = reduced ? 0 : energy;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
