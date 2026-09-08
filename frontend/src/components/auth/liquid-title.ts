import * as THREE from "three";
import { createTitleFluid } from "./conservatory/title-fluid";

export function createLiquidTitle(fontFamily: string, renderer: THREE.WebGLRenderer) {
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
  const fluid = createTitleFluid(renderer);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      textMap: { value: texture },
      flowMap: { value: fluid.texture },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D textMap;
      uniform sampler2D flowMap;
      void main() {
        vec2 flow=texture2D(flowMap,vUv).xy;
        vec2 shift=clamp(flow*.004,vec2(-.028),vec2(.028));
        float alpha=texture2D(textMap,vUv-shift).a;
        float sheen=clamp(length(flow)*.045,0.,.32);
        vec3 ink=mix(vec3(.105,.105,.1),vec3(.40,.35,.39),sheen);
        gl_FragColor=vec4(ink,alpha);
      }
    `,
  });
  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  const bounds = { x: 0, y: 0, width: 1, height: 1 };
  let reduced = false;

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
      const active = !reduced && isActive && x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
      fluid.setPointer((x - bounds.x) / bounds.width, 1 - (y - bounds.y) / bounds.height, active);
    },
    setReducedMotion(value: boolean) {
      reduced = value;
      if (value) fluid.reset();
    },
    render(delta: number) {
      if (!reduced) fluid.update(delta);
      material.uniforms.flowMap.value = fluid.texture;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      texture.dispose();
      fluid.dispose();
    },
  };
}
