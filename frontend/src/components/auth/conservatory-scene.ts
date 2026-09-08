import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createArchitectureLighting } from "./conservatory/architecture-lighting";
import { LOW_VEGETATION_COUNT, selectVegetationCount } from "./conservatory/vegetation-quality";

export interface ConservatoryScene {
  readonly ready: Promise<void>;
  readonly renderer: THREE.WebGLRenderer;
  readonly vegetationCount: number;
  reduceVegetation(): boolean;
  resize(width: number, height: number, pixelRatio: number): void;
  render(timeSeconds: number, deltaSeconds: number): void;
  renderOverlay(scene: THREE.Scene, camera: THREE.Camera): void;
  setPointer(normalizedX: number, normalizedY: number, active: boolean): void;
  readonly diagnostics: {
    camera: THREE.Vector3;
    rippleEnergy: number;
    pointerHits: number;
    waterPoint: THREE.Vector3;
  };
  dispose(): void;
}

const FIELD_SIZE = 128;
const WATER_WIDTH = 50;
const WATER_DEPTH = 50;
const WATER_X = -11.93;
const WATER_Z = 4.8929;
const WATER_Y = 0.7851;

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function reliefNoise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const tx = fx * fx * (3 - 2 * fx), ty = fy * fy * (3 - 2 * fy);
  const hash = (a: number, b: number) => {
    const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), tx),
    THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), tx), ty,
  );
}

function exteriorSurface(z: number, v: number, point: THREE.Vector3) {
  const crest = THREE.MathUtils.clamp(5.65 + z * .125, 2.5, 7.2)
    + Math.sin(z * .7) * .08 + Math.sin(z * 2.1 + 1) * .04;
  const ridge = 1 - Math.abs(reliefNoise(z * .65, v * 2.6) * 2 - 1);
  const relief = (ridge - .5) * .95 + (reliefNoise(z * 2.1, v * 9.5) - .5) * .34
    + (reliefNoise(z * 6.8, v * 19) - .5) * .10;
  const ledge = Math.floor(v * 4.5 + reliefNoise(z * .35, 8) * .8) * .095;
  return point.set(-25 + relief + ledge, .4 + v * (crest - .4), z);
}

function surfaceTexture(rock: boolean) {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const random = seededRandom(rock ? 419 : 139);
  const grid = Float32Array.from({ length: size * size }, random);
  const noise = (x: number, y: number, scale: number) => {
    const sx = x / scale;
    const sy = y / scale;
    const ix = Math.floor(sx);
    const iy = Math.floor(sy);
    const fx = sx - ix;
    const fy = sy - iy;
    const tx = fx * fx * (3 - 2 * fx);
    const ty = fy * fy * (3 - 2 * fy);
    const at = (gx: number, gy: number) => grid[(gy % size) * size + (gx % size)];
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(at(ix, iy), at(ix + 1, iy), tx),
      THREE.MathUtils.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx),
      ty,
    );
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = noise(x, y, 32) * 0.42 + noise(x, y, 12) * 0.25 + noise(x, y, 4) * 0.19 + noise(x, y, 1) * 0.14;
      const vein = rock ? Math.pow(Math.abs(Math.sin(x * 0.042 + y * 0.018 + value * 9)), 18) * 0.18 : 0;
      const c = Math.round((0.72 + value * 0.28 - vein) * 255);
      const index = (y * size + x) * 4;
      data[index] = c;
      data[index + 1] = rock ? c - 6 : c;
      data[index + 2] = rock ? c - 10 : c;
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.repeat.set(rock ? 2 : 5, rock ? 2 : 5);
  texture.needsUpdate = true;
  return texture;
}

function rectangle(left: number, bottom: number, right: number, top: number) {
  const shape = new THREE.Shape();
  shape.moveTo(left, bottom);
  shape.lineTo(right, bottom);
  shape.lineTo(right, top);
  shape.lineTo(left, top);
  shape.closePath();
  return shape;
}

function archHole(center: number, width: number, spring: number, crown = width / 2) {
  const path = new THREE.Path();
  const radius = width / 2;
  path.moveTo(center - radius, -0.0302);
  path.lineTo(center - radius, spring);
  path.absellipse(center, spring, radius, crown, Math.PI, 0, true, 0);
  path.lineTo(center + radius, -0.0302);
  path.closePath();
  return path;
}

function rectangleHole(left: number, bottom: number, width: number, height: number) {
  const path = new THREE.Path();
  path.moveTo(left, bottom);
  path.lineTo(left, bottom + height);
  path.lineTo(left + width, bottom + height);
  path.lineTo(left + width, bottom);
  path.closePath();
  return path;
}

const waterShader = {
  name: "Conservatory reflective water",
  uniforms: {
    color: { value: new THREE.Color("#b3a1b8") },
    tDiffuse: { value: null },
    textureMatrix: { value: new THREE.Matrix4() },
    refraction: { value: null },
    heightField: { value: null },
    time: { value: 0 },
    viewport: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 mirrorUv;
    varying vec4 screenPosition;
    varying vec3 worldPosition;
    void main() {
      mirrorUv = textureMatrix * vec4(position, 1.);
      worldPosition = (modelMatrix * vec4(position, 1.)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      screenPosition = gl_Position;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D refraction;
    uniform sampler2D heightField;
    uniform vec3 color;
    uniform float time;
    uniform vec2 viewport;
    varying vec4 mirrorUv;
    varying vec4 screenPosition;
    varying vec3 worldPosition;
    float waterHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float waterNoise(vec2 p) {
      vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(waterHash(i),waterHash(i+vec2(1.,0.)),f.x),mix(waterHash(i+vec2(0.,1.)),waterHash(i+vec2(1.,1.)),f.x),f.y);
    }
    void main() {
      vec2 fieldUv = vec2((worldPosition.x + 11.93) / 50. + .5, (worldPosition.z - 4.8929) / 50. + .5);
      vec2 texel = vec2(1. / 128.);
      float l = texture2D(heightField, fieldUv - vec2(texel.x, 0.)).r;
      float r = texture2D(heightField, fieldUv + vec2(texel.x, 0.)).r;
      float b = texture2D(heightField, fieldUv - vec2(0., texel.y)).r;
      float t = texture2D(heightField, fieldUv + vec2(0., texel.y)).r;
      vec2 gradient = vec2(l-r, b-t);
      float broadNoise=waterNoise(worldPosition.xz*.65+vec2(time*.07,-time*.045));
      float fineNoise=waterNoise(worldPosition.xz*4.2+vec2(-time*.11,time*.085))-.5;
      float wind=sin(worldPosition.z*4.3+time*.7+broadNoise*4.)*.6;
      wind+=sin(worldPosition.z*9.7+worldPosition.x*1.3-time*.42+broadNoise*2.)*.3;
      float swell=sin(worldPosition.z*.95+time*.25+waterNoise(worldPosition.xz*.18)*4.)*.65;
      swell+=sin(worldPosition.x*.55+worldPosition.z*1.3-time*.17)*.35;
      vec2 distortion=vec2(wind*.006+fineNoise*.002,(broadNoise-.5)*.003+sin(worldPosition.z*7.+worldPosition.x*2.+time*.35)*.0014);
      distortion+=vec2(swell*.004,sin(worldPosition.z*.8+worldPosition.x*.3+time*.21)*.003);
      vec2 rockOffset = (worldPosition.xz - vec2(-5.6129, -8.8177)) / vec2(1.1847,1.5960);
      float rockDistance = length(rockOffset);
      distortion += normalize(rockOffset + .001) * sin((rockDistance-1.)*24.-time*1.6) * exp(-abs(rockDistance-1.)*6.) * .0017;
      distortion += gradient * .10;
      vec2 projected = mirrorUv.xy / mirrorUv.w;
      float softness=.0007+.0013*smoothstep(-.6,.7,swell);
      vec3 reflected=texture2D(tDiffuse,projected+distortion).rgb*.36;
      reflected+=texture2D(tDiffuse,projected+distortion+vec2(softness,softness*.45)).rgb*.16;
      reflected+=texture2D(tDiffuse,projected+distortion-vec2(softness,softness*.45)).rgb*.16;
      reflected+=texture2D(tDiffuse,projected+distortion+vec2(softness*.5,-softness*.9)).rgb*.16;
      reflected+=texture2D(tDiffuse,projected+distortion-vec2(softness*.5,-softness*.9)).rgb*.16;
      float reflectedLuma=dot(reflected,vec3(.21,.72,.07));
      float blueReflection=smoothstep(.02,.25,reflected.b-reflected.r);
      reflected=mix(reflected,vec3(reflectedLuma*.96,reflectedLuma*.97,reflectedLuma*1.05),.14+blueReflection*.22);
      vec2 screenUv = screenPosition.xy / screenPosition.w * .5 + .5;
      vec3 refracted = texture2D(refraction, screenUv + distortion * .4).rgb;
      vec3 viewDirection = normalize(cameraPosition-worldPosition);
      vec3 surfaceNormal = normalize(vec3(gradient.x*2.+sin(worldPosition.z*7.+time*.8)*.055, 1., gradient.y*2.+sin(worldPosition.z*10.+time*.6)*.05));
      float fresnel = .55 + .4 * pow(1.-max(dot(viewDirection,surfaceNormal),0.),3.);
      vec3 water = mix(refracted * vec3(.81, .79, .88), reflected, fresnel);
      water = mix(water, color, .10) * .83;
      water += vec3(.30, .33, .38) * pow(max(wind * .5 + .5, 0.), 10.) * .09;
      water += min(length(gradient), .35) * vec3(.18, .19, .23);
      gl_FragColor = vec4(water, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

/** An independently authored room, terrain and water simulation, with no downloaded site models. */
export function createConservatoryScene(canvas: HTMLCanvasElement): ConservatoryScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#c3c7ee");
  scene.fog = new THREE.Fog("#e0cee2", 34, 95);
  const camera = new THREE.PerspectiveCamera(34, 1.6, 0.1, 200);
  const baseCamera = new THREE.Vector3(-2.5776012, 2.8385067, 7.5180285);
  const target = new THREE.Vector3(-8.3081424, 2.8385067, -5.6805063);
  camera.position.copy(baseCamera);
  camera.lookAt(target);
  camera.setFocalLength(36);
  const pointer = new THREE.Vector2();
  const smoothPointer = new THREE.Vector2();
  const slowPointer = new THREE.Vector2();
  const pointerRotation = new THREE.Euler();
  const pointerQuaternion = new THREE.Quaternion();
  const raycaster = new THREE.Raycaster();
  const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y);
  const hit = new THREE.Vector3();
  const lastHit = new THREE.Vector3(1000, 1000, 1000);
  let pointerActive = false;
  let pointerDirty = false;
  let disposed = false;
  const resources: Array<{ dispose(): void }> = [];
  const keep = <T extends { dispose(): void }>(resource: T) => { resources.push(resource); return resource; };
  const environmentScene = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmrem.fromScene(environmentScene, 0.03);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 0.20;
  environmentScene.dispose();
  pmrem.dispose();
  keep(environmentTarget);

  const plasterTexture = keep(surfaceTexture(false));
  plasterTexture.repeat.set(.22, .22);
  const stoneTexture = keep(surfaceTexture(true));
  const plaster = keep(new THREE.MeshStandardMaterial({ color: "#dcb2a8", roughness: 0.91, map: plasterTexture, bumpMap: plasterTexture, bumpScale: 0.025 }));
  const stepMaterial = keep(new THREE.MeshStandardMaterial({ color: "#edddd4", roughness: 0.79, map: plasterTexture, bumpMap: plasterTexture, bumpScale: 0.009 }));
  const stoneMaterial = keep(new THREE.MeshStandardMaterial({ color: "#e4c9c0", roughness: 0.86, map: stoneTexture, bumpMap: stoneTexture, bumpScale: 0.04, emissive: "#bfa09b", emissiveIntensity: .025 }));
  const loadingManager = new THREE.LoadingManager();
  const ready = new Promise<void>((resolve, reject) => {
    loadingManager.onLoad = () => resolve();
    loadingManager.onError = () => reject(new Error("Scene texture unavailable"));
  });
  const loader = new THREE.TextureLoader(loadingManager);
  keep(loader.load("/images/conservatory/rock-color.webp", (texture) => {
    if (disposed) return;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.8, 1.1);
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    stoneMaterial.map = texture;
    stoneMaterial.bumpMap = null;
    stoneMaterial.color.set("#ffe9e1");
    stoneMaterial.needsUpdate = true;
    const landscapeTexture = keep(texture.clone());
    landscapeTexture.repeat.set(16, 6);
    landscapeMaterial.map = landscapeTexture;
    landscapeMaterial.needsUpdate = true;
  }));
  keep(loader.load("/images/conservatory/rock-normal.webp", (texture) => {
    if (disposed) return;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.8, 1.1);
    stoneMaterial.normalMap = texture;
    stoneMaterial.normalScale.set(0.85, 0.85);
    stoneMaterial.needsUpdate = true;
    const landscapeNormal = keep(texture.clone());
    landscapeNormal.repeat.set(16, 6);
    landscapeMaterial.normalMap = landscapeNormal;
    landscapeMaterial.normalScale.set(.90, .90);
    landscapeMaterial.bumpMap = null;
    landscapeMaterial.needsUpdate = true;
  }));
  stoneMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec3 vStonePosition;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vStonePosition=position;");
    shader.fragmentShader = `varying vec3 vStonePosition;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
      #include <map_fragment>
      float stoneLuma = dot(diffuseColor.rgb, vec3(.21,.72,.07));
      diffuseColor.rgb = mix(vec3(stoneLuma), diffuseColor.rgb, .30) * .90 + vec3(.065,.05,.04);
      float mineralPhase=vStonePosition.x*2.5+vStonePosition.y*4.+sin(vStonePosition.z*3.)*.45+sin(vStonePosition.x*8.+vStonePosition.y*5.)*.12;
      float vein=1.-smoothstep(.03,.16,abs(sin(mineralPhase)));
      vein*=smoothstep(.1,.7,sin(vStonePosition.z*2.1+vStonePosition.y*3.7)*.5+.5);
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.06,.80,.70),vein*.46);
    `);
  };
  const addMesh = (geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(keep(geometry), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material = plaster) => addMesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);

  // Independently reconstructed primitive geometry from coarse measurements, uniformly scaled100x.
  const sideWall = rectangle(-16.2413, -0.0303, 13.7168, 13.3451);
  sideWall.holes.push(
    archHole(5.13895, 2.4459, 4.5417, 1.2696),
    archHole(1.93545, 2.4383, 4.5417, 1.2696),
    archHole(-1.26515, 2.4402, 4.5417, 1.2696),
  );
  const wall = addMesh(new THREE.ExtrudeGeometry(sideWall, { depth: 0.4302, bevelEnabled: false, curveSegments: 48 }), plaster, -13.9953, 0, 0);
  wall.rotation.y = Math.PI / 2;
  wall.name = "architecture-left-wall";
  const rearWall = rectangle(-13.5651, 2.5164, 16.0295, 13.3451);
  rearWall.holes.push(rectangleHole(-10.8051, 2.5374, 1.2201, 4.1609), rectangleHole(-8.3097, 4.1020, 1.7626, 5.2421));
  addMesh(new THREE.ExtrudeGeometry(rearWall, { depth: 1.2048, bevelEnabled: false }), plaster, 0, 0, -14.9216).name = "architecture-rear-wall";
  const platform = addMesh(new RoundedBoxGeometry(29.6136, 2.5467, 4.0125, 2, 0.01905), plaster, 1.2417, 1.24305, -12.93445);
  platform.name = "architecture-platform";
  const stairTops = [0.2247, 0.4798, 0.7329, 0.9880, 1.2431, 1.4981, 1.7532, 2.0082, 2.2614];
  const stairFronts = [6.34285, 6.85295, 7.36305, 7.87135, 8.38145, 8.89155, 9.39975, 9.90985, 10.41805];
  const stairProfile = new THREE.Shape();
  stairProfile.moveTo(stairFronts[0], -0.0303);
  stairProfile.lineTo(10.9282, -0.0303);
  stairProfile.lineTo(10.9282, stairTops[8]);
  for (let i = 8; i >= 0; i--) {
    stairProfile.lineTo(stairFronts[i], stairTops[i]);
    stairProfile.lineTo(stairFronts[i], i > 0 ? stairTops[i - 1] : -0.0303);
  }
  stairProfile.closePath();
  const stairs = addMesh(new THREE.ExtrudeGeometry(stairProfile, { depth: 5.0936, bevelEnabled: false }), stepMaterial, -13.5651, 0, 0);
  stairs.rotation.y = Math.PI / 2;
  stairs.name = "architecture-stairs";
  box(70, 0.15, 75, -11.93, -0.1053, 4.8929, keep(new THREE.MeshStandardMaterial({ color: "#aea4b5", roughness: 0.78 }))).name = "architecture-pool-floor";

  const pearlMaterial = keep(new THREE.MeshMatcapMaterial({ color: new THREE.Color(1.15, 1.15, 1.15) }));
  pearlMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `
      vec2 nacrePoint=(uv-.5)*2.;
      float nacreRim=smoothstep(.25,.8,length(nacrePoint));
      vec2 cyanOffset=nacrePoint+vec2(.58,-.48);
      vec2 goldOffset=nacrePoint+vec2(.78,-.05);
      vec2 violetOffset=nacrePoint+vec2(-.75,.10);
      float cyanBand=exp(-dot(cyanOffset*cyanOffset,1./vec2(.28,.20)));
      float goldBand=exp(-dot(goldOffset*goldOffset,1./vec2(.14,.55)));
      float violetBand=exp(-dot(violetOffset*violetOffset,1./vec2(.19,.58)));
      vec3 nacreTint=cyanBand*vec3(-.18,.06,.17)+goldBand*vec3(.14,.07,-.18)+violetBand*vec3(.07,-.13,.17);
      outgoingLight*=1.+nacreTint*nacreRim*1.9;
      #include <opaque_fragment>
    `);
  };
  keep(loader.load("/images/conservatory/pearl-matcap.webp", (texture) => {
    if (disposed) return;
    texture.colorSpace = THREE.SRGBColorSpace;
    pearlMaterial.matcap = texture;
    pearlMaterial.needsUpdate = true;
  }));
  const pearl = addMesh(new THREE.SphereGeometry(1, 64, 48), pearlMaterial, -8.0474332, 3.5038119, -12.1320441);
  pearl.name = "live-pearl";
  // 구의 그림자는 구운 조명 위에 해석적으로 적용한다.
  pearl.castShadow = false;

  const rock = (x: number, y: number, z: number, width: number, height: number, depth: number, seed: number) => {
    const rawGeometry = new THREE.IcosahedronGeometry(1, 5);
    rawGeometry.deleteAttribute("normal");
    rawGeometry.deleteAttribute("uv");
    const geometry = mergeVertices(rawGeometry);
    rawGeometry.dispose();
    const positions = geometry.attributes.position;
    const uvs = new Float32Array(positions.count * 2);
    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i), py = positions.getY(i), pz = positions.getZ(i);
      const broad = Math.sin(px * 4.5 + seed) * Math.sin(py * 3.7 + seed * 0.4) * Math.sin(pz * 3.9 + seed * 0.7);
      const fine = Math.sin(px * 16 + py * 5 + seed) * Math.sin(pz * 13 + py * 8);
      const strata = (reliefNoise(px * 5 + pz, py * 6 + seed) - .5) * .12;
      const fissure = Math.pow(1 - Math.abs(Math.sin(px * 6 + pz * 4 + seed)), 5) * .065;
      const radius = 1 + broad * .16 + fine * .035 + strata - fissure;
      positions.setXYZ(i, px * radius, py * radius, pz * radius);
      uvs[i * 2] = Math.atan2(pz, px) / (Math.PI * 2) + 0.5;
      uvs[i * 2 + 1] = Math.asin(THREE.MathUtils.clamp(py, -1, 1)) / Math.PI + 0.5;
    }
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    for (let i = 0; i < positions.count; i++) {
      positions.setXYZ(i,
        ((positions.getX(i) - bounds.min.x) / (bounds.max.x - bounds.min.x) - .5) * width,
        ((positions.getY(i) - bounds.min.y) / (bounds.max.y - bounds.min.y) - .5) * height,
        ((positions.getZ(i) - bounds.min.z) / (bounds.max.z - bounds.min.z) - .5) * depth,
      );
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    const mesh = addMesh(geometry, stoneMaterial, x, y, z);
    mesh.name = "live-rock";
  };
  rock(-5.612875, 1.081544, -8.817657, 2.369443, 1.450882, 3.192035, 1.4);
  rock(-1.144877, .974466, -6.725248, 4.184818, 1.137446, 5.932117, 3.5);

  // The outdoor view is genuine distant geometry and remains spatially stable through the arches.
  const landscapeMaterial = keep(new THREE.MeshStandardMaterial({ color: "#e3bccb", roughness: 1, map: stoneTexture, bumpMap: stoneTexture, bumpScale: 0.06, emissive: "#c59caf", emissiveIntensity: .16 }));
  landscapeMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
      #include <map_fragment>
      float cliffLuma = dot(diffuseColor.rgb, vec3(.21,.72,.07));
      diffuseColor.rgb = vec3(.57,.32,.40) * (.85 + cliffLuma * .70);
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `
      float exteriorHaze=smoothstep(24.,42.,length(vViewPosition))*.68;
      outgoingLight=mix(outgoingLight,vec3(.88,.48,.68),exteriorHaze);
      #include <opaque_fragment>
    `);
  };
  const terrain = new THREE.PlaneGeometry(100, 100, 72, 72);
  terrain.rotateX(-Math.PI / 2);
  const terrainPositions = terrain.attributes.position;
  for (let i = 0; i < terrainPositions.count; i++) {
    const x = terrainPositions.getX(i), z = terrainPositions.getZ(i);
    const cliff = (1 - THREE.MathUtils.smoothstep(x - 48, -18, -8)) * 2.2;
    const y = cliff + Math.sin(x * 0.19) * 1.0 + Math.sin(z * 0.13 + x * 0.06) * 0.8 + Math.sin(x * 0.7 + z * 0.15) * 0.21;
    terrainPositions.setY(i, y);
  }
  terrain.computeVertexNormals();
  addMesh(terrain, landscapeMaterial, -65, -1.0, -10);
  const cliff = new THREE.PlaneGeometry(45, 1, 256, 64);
  const cliffPositions = cliff.attributes.position;
  const fieldPoint = new THREE.Vector3();
  for (let i = 0; i < cliffPositions.count; i++) {
    exteriorSurface(cliffPositions.getX(i) - 5, cliffPositions.getY(i) + .5, fieldPoint);
    cliffPositions.setXYZ(i, fieldPoint.x, fieldPoint.y, fieldPoint.z);
  }
  cliff.computeVertexNormals();
  landscapeMaterial.side = THREE.DoubleSide;
  addMesh(cliff, landscapeMaterial, 0, 0, 0);
  const grassGeometry = keep(new THREE.PlaneGeometry(.045, .12, 1, 2));
  grassGeometry.translate(0, .06, 0);
  const grassTime = { value: 0 };
  const grassMaterial = keep(new THREE.MeshBasicMaterial({ color: "#c893ab", side: THREE.DoubleSide }));
  grassMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.grassTime = grassTime;
    shader.vertexShader = `uniform float grassTime; varying vec2 vGrassUv;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `
      #include <begin_vertex>
      vGrassUv=uv;
      transformed.x*=1.-uv.y*.9;
      transformed.x+=sin(grassTime*.6+instanceMatrix[3].z*2.1+instanceMatrix[3].x)*.004*uv.y;
    `);
    shader.fragmentShader = `varying vec2 vGrassUv;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
      #include <color_fragment>
      diffuseColor.rgb*=mix(.76,1.04,smoothstep(0.,1.,vGrassUv.y));
    `);
  };
  const gl = renderer.getContext();
  const gpuInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const vegetationCount = selectVegetationCount({
    mobile: window.innerWidth < 1000 || navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches,
    renderer: gpuInfo ? String(gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL) ?? "") : "",
    logicalCores: navigator.hardwareConcurrency,
    memoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  });
  const grass = keep(new THREE.InstancedMesh(grassGeometry, grassMaterial, vegetationCount));
  canvas.dataset.grassCount = String(grass.count);
  const reduceVegetation = () => {
    if (grass.count <= LOW_VEGETATION_COUNT) return false;
    grass.count = LOW_VEGETATION_COUNT;
    canvas.dataset.grassCount = String(grass.count);
    return true;
  };
  const grassRandom = seededRandom(824);
  const grassDummy = new THREE.Object3D();
  const grassColor = new THREE.Color();
  for (let i = 0; i < grass.count; i++) {
    const z = -27.5 + grassRandom() * 45;
    const v = .16 + grassRandom() * .84;
    const cluster = reliefNoise(z * .55, v * 12);
    if (grassRandom() > .35 + cluster * .65) { i--; continue; }
    exteriorSurface(z, v, grassDummy.position);
    grassDummy.position.x += .055;
    grassDummy.rotation.set((grassRandom() - .5) * .3, grassRandom() * Math.PI, (grassRandom() - .5) * .25);
    grassDummy.scale.setScalar(.65 + cluster * .85 + grassRandom() * .55);
    grassDummy.updateMatrix();
    grass.setMatrixAt(i, grassDummy.matrix);
    grassColor.setHSL(.94 + grassRandom() * .045, .16 + cluster * .10, .66 + cluster * .10 + grassRandom() * .07);
    grass.setColorAt(i, grassColor);
  }
  grass.instanceMatrix.needsUpdate = true;
  grass.computeBoundingSphere();
  grass.name = "live-pink-field";
  scene.add(grass);
  const sky = keep(new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: "varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "varying vec3 vPosition;void main(){float t=smoothstep(0.,.24,normalize(vPosition).y);vec3 c=mix(vec3(.99,.70,.89),vec3(.22,.35,.79),t);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
  }));
  const skyMesh = addMesh(new THREE.SphereGeometry(110, 24, 16), sky, 0, 0, 0);
  skyMesh.castShadow = false;
  skyMesh.receiveShadow = false;
  const hemisphere = new THREE.HemisphereLight("#e6e8ff", "#bea0a2", 0.45);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight("#fff4e8", 3.2);
  sun.position.set(-20, 25, 0);
  sun.target.position.set(-8, 1, -10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -15;
  sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -10;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.0001;
  sun.shadow.radius = 12;
  sun.shadow.blurSamples = 12;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight("#ffe2de", 0.2);
  fill.position.set(-2, 8, 9);
  scene.add(fill);
  keep(createArchitectureLighting(renderer, scene, camera, plaster, stepMaterial, loadingManager, {
    center: pearl.position,
    radius: 1,
    lightDirection: sun.position.clone().sub(pearl.position).normalize(),
  }));

  const heightA = new Float32Array(FIELD_SIZE * FIELD_SIZE);
  const heightB = new Float32Array(heightA.length);
  const velocity = new Float32Array(heightA.length);
  const heightTexture = keep(new THREE.DataTexture(heightA, FIELD_SIZE, FIELD_SIZE, THREE.RedFormat, THREE.FloatType));
  heightTexture.magFilter = heightTexture.minFilter = THREE.LinearFilter;
  heightTexture.needsUpdate = true;
  const refractionTarget = keep(new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 }));
  const mainTarget = keep(new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 }));
  const water = new Reflector(keep(new THREE.PlaneGeometry(WATER_WIDTH, WATER_DEPTH)), { textureWidth: 1024, textureHeight: 768, clipBias: 0.002, multisample: 0, shader: waterShader });
  const waterMaterial = water.material as THREE.ShaderMaterial;
  water.rotation.x = -Math.PI / 2;
  water.position.set(WATER_X, WATER_Y, WATER_Z);
  water.name = "live-water";
  waterMaterial.uniforms.heightField.value = heightTexture;
  waterMaterial.uniforms.refraction.value = refractionTarget.texture;
  scene.add(water);

  const postScene = new THREE.Scene();
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMaterial = keep(new THREE.ShaderMaterial({
    uniforms: { sceneTexture: { value: mainTarget.texture }, time: { value: 0 } },
    depthTest: false,
    depthWrite: false,
    vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader: /* glsl */ `
      uniform sampler2D sceneTexture;
      uniform float time;
      varying vec2 vUv;
      void main(){
        vec3 c=texture2D(sceneTexture,vUv).rgb;
        float grain=fract(sin(dot(gl_FragCoord.xy+floor(time*24.),vec2(12.9898,78.233)))*43758.5453)-.5;
        float vignette=1.-.035*dot((vUv-.5)*1.4,(vUv-.5)*1.4);
        gl_FragColor=vec4(c*vignette+grain*.009,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }));
  postScene.add(new THREE.Mesh(keep(new THREE.PlaneGeometry(2, 2)), postMaterial));
  const diagnostics = { camera: camera.position, rippleEnergy: 0, pointerHits: 0, waterPoint: new THREE.Vector3() };
  let accumulator = 0;

  function exciteWater() {
    if (!pointerActive || !pointerDirty) return;
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(waterPlane, hit) || Math.abs(hit.z - WATER_Z) > WATER_DEPTH / 2 || Math.abs(hit.x - WATER_X) > WATER_WIDTH / 2) return;
    const distance = lastHit.distanceTo(hit);
    if (distance < 0.035) return;
    const fx = ((hit.x - WATER_X) / WATER_WIDTH + 0.5) * (FIELD_SIZE - 1);
    const fy = ((hit.z - WATER_Z) / WATER_DEPTH + 0.5) * (FIELD_SIZE - 1);
    const strength = Math.min(distance, 0.7) * 0.14 + 0.01;
    for (let oy = -4; oy <= 4; oy++) {
      for (let ox = -4; ox <= 4; ox++) {
        const x = Math.round(fx) + ox, y = Math.round(fy) + oy;
        if (x <= 0 || x >= FIELD_SIZE - 1 || y <= 0 || y >= FIELD_SIZE - 1) continue;
        const falloff = Math.exp(-(ox * ox + oy * oy) / 4.5);
        velocity[y * FIELD_SIZE + x] -= falloff * strength;
      }
    }
    lastHit.copy(hit);
    diagnostics.waterPoint.copy(hit);
    diagnostics.pointerHits++;
    pointerDirty = false;
  }

  function simulate(delta: number) {
    accumulator = Math.min(accumulator + delta, 0.05);
    while (accumulator >= 1 / 60) {
      let energy = 0;
      for (let y = 1; y < FIELD_SIZE - 1; y++) {
        for (let x = 1; x < FIELD_SIZE - 1; x++) {
          const i = y * FIELD_SIZE + x;
          const laplacian = heightA[i - 1] + heightA[i + 1] + heightA[i - FIELD_SIZE] + heightA[i + FIELD_SIZE] - 4 * heightA[i];
          velocity[i] = (velocity[i] + laplacian * 0.24) * 0.981;
          heightB[i] = (heightA[i] + velocity[i]) * 0.999;
          energy += Math.abs(velocity[i]);
        }
      }
      heightA.set(heightB);
      diagnostics.rippleEnergy = energy;
      accumulator -= 1 / 60;
    }
    heightTexture.needsUpdate = true;
  }

  return {
    ready,
    renderer,
    get vegetationCount() { return grass.count; },
    reduceVegetation,
    diagnostics,
    resize(width, height, pixelRatio) {
      if (width < 1000) reduceVegetation();
      const dpr = Math.min(pixelRatio, 1.25);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.setFocalLength(width >= 768 ? 36 : 42);
      const w = Math.max(1, Math.round(width * dpr)), h = Math.max(1, Math.round(height * dpr));
      const samples = width >= 768 && dpr >= 1 ? Math.min(2, renderer.capabilities.maxSamples) : 0;
      if (mainTarget.samples !== samples) {
        mainTarget.dispose();
        mainTarget.samples = samples;
      }
      mainTarget.setSize(w, h);
      refractionTarget.setSize(Math.max(1, Math.round(w * 0.5)), Math.max(1, Math.round(h * 0.5)));
      water.getRenderTarget().setSize(Math.min(w, 1024), Math.min(h, 768));
      waterMaterial.uniforms.viewport.value.set(w, h);
    },
    setPointer(x, y, active) {
      pointer.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
      pointerDirty = true;
      pointerActive = active;
      if (!active) { pointer.set(0, 0); lastHit.set(1000, 1000, 1000); }
    },
    render(time, delta) {
      if (disposed) return;
      const dt = Math.min(Math.max(delta, 0), 0.05);
      smoothPointer.lerp(pointer, 1 - Math.pow(1 - .075, dt * 60));
      slowPointer.lerp(pointer, 1 - Math.pow(1 - .02, dt * 60));
      camera.position.copy(baseCamera);
      camera.lookAt(target);
      camera.translateZ(-10);
      pointerRotation.set(smoothPointer.y * .035, -smoothPointer.x * .135, 0);
      camera.quaternion.multiply(pointerQuaternion.setFromEuler(pointerRotation));
      pointerRotation.set(0, 0, -.05 * (smoothPointer.x - slowPointer.x));
      camera.quaternion.multiply(pointerQuaternion.setFromEuler(pointerRotation));
      camera.translateZ(10);
      exciteWater();
      simulate(dt);
      waterMaterial.uniforms.time.value = time;
      grassTime.value = time;
      pearl.rotation.y = time * 0.018;
      water.visible = false;
      renderer.setRenderTarget(refractionTarget);
      renderer.render(scene, camera);
      renderer.shadowMap.autoUpdate = false;
      water.visible = true;
      renderer.setRenderTarget(mainTarget);
      renderer.render(scene, camera);
      postMaterial.uniforms.time.value = time;
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
    },
    renderOverlay(overlay, overlayCamera) {
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(overlay, overlayCamera);
      renderer.autoClear = autoClear;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      water.dispose();
      sun.shadow.dispose();
      for (const resource of resources) resource.dispose();
      scene.clear();
      postScene.clear();
      renderer.dispose();
    },
  };
}
