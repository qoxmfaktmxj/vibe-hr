import * as THREE from "three";

const SIZE = 128;
const vertexShader = "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}";

/** 작은 속도장을 이류, 압력 보정하여 커서가 지나간 경로를 남긴다. */
export function createTitleFluid(renderer: THREE.WebGLRenderer) {
  const targets = Array.from({ length: 5 }, () => new THREE.WebGLRenderTarget(SIZE, SIZE, {
    type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: false, stencilBuffer: false,
  }));
  let [velocity, nextVelocity, pressure, nextPressure] = targets;
  const divergence = targets[4];
  const point = new THREE.Vector2(-2, -2);
  const previous = point.clone();
  const force = new THREE.Vector2();
  const uniforms = {
    velocity: { value: velocity.texture }, pressure: { value: pressure.texture },
    divergence: { value: divergence.texture }, cell: { value: new THREE.Vector2(1 / SIZE, 1 / SIZE) },
    point: { value: point }, previous: { value: previous }, force: { value: force }, delta: { value: 0 },
  };
  const material = (body: string) => new THREE.ShaderMaterial({
    uniforms, vertexShader, depthTest: false, depthWrite: false, toneMapped: false,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D velocity, pressure, divergence;
      uniform vec2 cell, point, previous, force;
      uniform float delta;
      ${body}
    `,
  });
  const advect = material(`
    void main(){
      vec2 speed=texture2D(velocity,vUv).xy;
      vec2 back=clamp(vUv-speed*cell*delta*60.,cell,1.-cell);
      speed=texture2D(velocity,back).xy*exp(-delta*2.4);
      vec2 aspect=vec2(1.,.4);
      vec2 segment=(point-previous)*aspect;
      vec2 offset=(vUv-previous)*aspect;
      float t=clamp(dot(offset,segment)/max(dot(segment,segment),.000001),0.,1.);
      float distance=length(offset-segment*t);
      speed+=force*exp(-distance*distance/0.004);
      float edge=smoothstep(0.,.025,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
      gl_FragColor=vec4(clamp(speed,vec2(-18.),vec2(18.))*edge,0.,1.);
    }
  `);
  const measureDivergence = material(`
    void main(){
      float l=texture2D(velocity,vUv-vec2(cell.x,0.)).x;
      float r=texture2D(velocity,vUv+vec2(cell.x,0.)).x;
      float b=texture2D(velocity,vUv-vec2(0.,cell.y)).y;
      float t=texture2D(velocity,vUv+vec2(0.,cell.y)).y;
      gl_FragColor=vec4(.5*(r-l+t-b),0.,0.,1.);
    }
  `);
  const solvePressure = material(`
    void main(){
      float l=texture2D(pressure,vUv-vec2(cell.x,0.)).r;
      float r=texture2D(pressure,vUv+vec2(cell.x,0.)).r;
      float b=texture2D(pressure,vUv-vec2(0.,cell.y)).r;
      float t=texture2D(pressure,vUv+vec2(0.,cell.y)).r;
      float d=texture2D(divergence,vUv).r;
      gl_FragColor=vec4((l+r+b+t-d)*.25,0.,0.,1.);
    }
  `);
  const project = material(`
    void main(){
      float l=texture2D(pressure,vUv-vec2(cell.x,0.)).r;
      float r=texture2D(pressure,vUv+vec2(cell.x,0.)).r;
      float b=texture2D(pressure,vUv-vec2(0.,cell.y)).r;
      float t=texture2D(pressure,vUv+vec2(0.,cell.y)).r;
      vec2 speed=texture2D(velocity,vUv).xy-.5*vec2(r-l,t-b);
      gl_FragColor=vec4(speed,0.,1.);
    }
  `);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(geometry, advect);
  scene.add(quad);
  let remaining = 0;

  const clear = () => {
    const savedTarget = renderer.getRenderTarget();
    const savedColor = renderer.getClearColor(new THREE.Color());
    const savedAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    for (const target of targets) { renderer.setRenderTarget(target); renderer.clear(); }
    renderer.setClearColor(savedColor, savedAlpha);
    renderer.setRenderTarget(savedTarget);
    force.set(0, 0);
    previous.set(-2, -2);
    remaining = 0;
  };
  const pass = (shader: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget) => {
    quad.material = shader;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  };
  clear();

  return {
    get texture() { return velocity.texture; },
    setPointer(x: number, y: number, active: boolean) {
      if (!active) { previous.set(-2, -2); force.set(0, 0); return; }
      if (previous.x < -1) { previous.set(x, y); point.set(x, y); }
      force.x += (x - point.x) * SIZE * 2.2;
      force.y += (y - point.y) * SIZE * 2.2;
      point.set(x, y);
      force.clampLength(0, 12);
      if (force.lengthSq() > .0001) remaining = 4;
    },
    update(delta: number) {
      if (remaining <= 0 || delta <= 0) return;
      remaining -= delta;
      if (remaining <= 0) { clear(); return; }
      const savedTarget = renderer.getRenderTarget();
      uniforms.delta.value = Math.min(delta, 1 / 30);
      uniforms.velocity.value = velocity.texture;
      pass(advect, nextVelocity);
      [velocity, nextVelocity] = [nextVelocity, velocity];
      force.set(0, 0);
      if (previous.x >= -1) previous.copy(point);
      uniforms.velocity.value = velocity.texture;
      pass(measureDivergence, divergence);
      for (let i = 0; i < 4; i++) {
        uniforms.pressure.value = pressure.texture;
        pass(solvePressure, nextPressure);
        [pressure, nextPressure] = [nextPressure, pressure];
      }
      uniforms.pressure.value = pressure.texture;
      pass(project, nextVelocity);
      [velocity, nextVelocity] = [nextVelocity, velocity];
      renderer.setRenderTarget(savedTarget);
    },
    reset: clear,
    dispose() {
      for (const target of targets) target.dispose();
      for (const shader of [advect, measureDivergence, solvePressure, project]) shader.dispose();
      geometry.dispose();
      scene.clear();
    },
  };
}
