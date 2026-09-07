import * as THREE from "three";

/** Fixed-camera GI on the exact static geometry, with a depth mask for newly exposed faces. */
export function createArchitectureLighting(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  baseCamera: THREE.PerspectiveCamera,
  wallMaterial: THREE.MeshStandardMaterial,
  stairMaterial: THREE.MeshStandardMaterial,
  onInvalidate?: () => void,
) {
  let disposed = false;
  const projector = baseCamera.clone();
  projector.aspect = 10 / 7;
  projector.fov = 52;
  projector.near = .1;
  projector.far = 200;
  projector.updateProjectionMatrix();
  projector.updateMatrixWorld();
  scene.updateMatrixWorld(true);

  const depthMaterial = new THREE.MeshDepthMaterial({ side: THREE.DoubleSide });
  const depthScene = new THREE.Scene();
  const architectureNames = new Set([
    "architecture-left-wall", "architecture-rear-wall", "architecture-platform", "architecture-stairs",
  ]);
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !architectureNames.has(object.name)) return;
    const mesh = new THREE.Mesh(object.geometry, depthMaterial);
    mesh.matrix.copy(object.matrixWorld);
    mesh.matrixAutoUpdate = false;
    depthScene.add(mesh);
  });
  const depthTexture = new THREE.DepthTexture(2240, 1568, THREE.UnsignedIntType);
  const depthTarget = new THREE.WebGLRenderTarget(2240, 1568, { depthTexture, depthBuffer: true });
  const previousTarget = renderer.getRenderTarget();
  const previousAutoClear = renderer.autoClear;
  renderer.autoClear = true;
  renderer.setRenderTarget(depthTarget);
  renderer.render(depthScene, projector);
  renderer.setRenderTarget(previousTarget);
  renderer.autoClear = previousAutoClear;
  depthScene.clear();
  depthMaterial.dispose();

  const uniforms = {
    architectureGi: { value: null as THREE.Texture | null },
    architectureDepth: { value: depthTexture },
    architectureProjector: { value: projector.projectionMatrix.clone().multiply(projector.matrixWorldInverse) },
    architectureCamera: { value: projector.position.clone() },
    architectureStrength: { value: 0 },
    architectureExposure: { value: renderer.toneMappingExposure },
    inverseAcesInput: { value: new THREE.Matrix3().set(.59719,.35458,.04823,.076,.90834,.01566,.0284,.13383,.83777).invert() },
    inverseAcesOutput: { value: new THREE.Matrix3().set(1.60475,-.53108,-.07367,-.10208,1.10813,-.00605,-.00327,-.07276,1.07602).invert() },
  };
  const texture = new THREE.TextureLoader().load("/images/conservatory/architecture-gi.webp", (loaded) => {
    if (disposed) return;
    // The bake is display RGB; grading precedes the explicit sRGB transfer below.
    loaded.colorSpace = THREE.NoColorSpace;
    loaded.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    uniforms.architectureGi.value = loaded;
    uniforms.architectureStrength.value = .93;
    onInvalidate?.();
  });

  for (const material of [wallMaterial, stairMaterial]) {
    const stairs = material === stairMaterial;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.uniforms.architectureGradeGain = { value: new THREE.Vector3(...(stairs ? [1.60,1.38,1.17] as const : [1.457,1.043,.913] as const)) };
      shader.uniforms.architectureGradeOffset = { value: new THREE.Vector3(...(stairs ? [-.40,-.243,-.061] as const : [-.214,.098,.185] as const)) };
      shader.uniforms.architectureStairs = { value: stairs ? 1 : 0 };
      shader.vertexShader = `
        uniform mat4 architectureProjector;
        varying vec4 vArchitectureProjection;
        varying vec3 vArchitecturePosition;
        varying vec3 vArchitectureNormal;
        ${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `
        #include <begin_vertex>
        vec4 architectureWorld=modelMatrix*vec4(transformed,1.);
        vArchitecturePosition=architectureWorld.xyz;
        vArchitectureNormal=normalize(mat3(modelMatrix)*normal);
        vArchitectureProjection=architectureProjector*architectureWorld;
      `);
      shader.fragmentShader = `
        uniform sampler2D architectureGi;
        uniform sampler2D architectureDepth;
        uniform vec3 architectureCamera;
        uniform vec3 architectureGradeGain;
        uniform vec3 architectureGradeOffset;
        uniform float architectureStrength;
        uniform float architectureStairs;
        uniform float architectureExposure;
        uniform mat3 inverseAcesInput;
        uniform mat3 inverseAcesOutput;
        varying vec4 vArchitectureProjection;
        varying vec3 vArchitecturePosition;
        varying vec3 vArchitectureNormal;
        float architectureVisibleAt(vec2 sampledUv,vec2 receiverUv,float receiverDistance,vec2 receiverSlope) {
          float depth=texture2D(architectureDepth,sampledUv).r;
          float capturedDistance=20./(200.-depth*199.9);
          float correctedDistance=receiverDistance+dot(receiverSlope,sampledUv-receiverUv);
          return 1.-smoothstep(.015,.055,correctedDistance-capturedDistance);
        }
        vec3 architectureRadiance(vec3 displayColor) {
          vec3 linearColor=mix(pow((displayColor+.055)/1.055,vec3(2.4)),displayColor/12.92,step(displayColor,vec3(.04045)));
          vec3 v=clamp(inverseAcesOutput*linearColor,0.,.985);
          vec3 a=v*.983729-1.;
          vec3 b=v*.432951-.0245786;
          vec3 c=v*.238081+.000090537;
          vec3 fitted=(-b-sqrt(max(b*b-4.*a*c,vec3(0.))))/(2.*a);
          return max(inverseAcesInput*fitted,vec3(0.))*.6/architectureExposure;
        }
        ${shader.fragmentShader}`;
      shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `
        vec2 bakeUv=vArchitectureProjection.xy/vArchitectureProjection.w*.5+.5;
        float inBake=smoothstep(0.,.004,bakeUv.x)*smoothstep(0.,.004,1.-bakeUv.x)*smoothstep(0.,.004,bakeUv.y)*smoothstep(0.,.004,1.-bakeUv.y);
        inBake*=step(.1,vArchitectureProjection.w)*step(vArchitectureProjection.w,200.);
        if(architectureStrength>0. && inBake>0.) {
          vec2 uvDx=dFdx(bakeUv),uvDy=dFdy(bakeUv);
          vec2 distanceDerivative=vec2(dFdx(vArchitectureProjection.w),dFdy(vArchitectureProjection.w));
          float determinant=uvDx.x*uvDy.y-uvDx.y*uvDy.x;
          vec2 receiverSlope=abs(determinant)>1e-12?vec2(uvDy.y*distanceDerivative.x-uvDx.y*distanceDerivative.y,uvDx.x*distanceDerivative.y-uvDy.x*distanceDerivative.x)/determinant:vec2(0.);
          vec2 depthPixel=bakeUv*vec2(2240.,1568.)-.5;
          vec2 fraction=fract(depthPixel);
          vec2 sampleOrigin=(floor(depthPixel)+.5)/vec2(2240.,1568.);
          vec2 depthTexel=1./vec2(2240.,1568.);
          float a=architectureVisibleAt(sampleOrigin,bakeUv,vArchitectureProjection.w,receiverSlope);
          float b=architectureVisibleAt(sampleOrigin+vec2(depthTexel.x,0.),bakeUv,vArchitectureProjection.w,receiverSlope);
          float c=architectureVisibleAt(sampleOrigin+vec2(0.,depthTexel.y),bakeUv,vArchitectureProjection.w,receiverSlope);
          float d=architectureVisibleAt(sampleOrigin+depthTexel,bakeUv,vArchitectureProjection.w,receiverSlope);
          float visible=mix(mix(a,b,fraction.x),mix(c,d,fraction.x),fraction.y);
          float facing=smoothstep(.0005,.008,dot(normalize(vArchitectureNormal),normalize(architectureCamera-vArchitecturePosition)));
          vec3 displayColor=texture2D(architectureGi,bakeUv).rgb*architectureGradeGain+architectureGradeOffset;
          bool smallReveal=vArchitecturePosition.x> -10.83&&vArchitecturePosition.x< -9.56&&vArchitecturePosition.y>2.51&&vArchitecturePosition.y<6.72;
          bool tallReveal=vArchitecturePosition.x> -8.33&&vArchitecturePosition.x< -6.52&&vArchitecturePosition.y>4.08&&vArchitecturePosition.y<9.37;
          if(architectureStairs<.5&&abs(vArchitectureNormal.z)<.5&&vArchitecturePosition.z< -13.70&&vArchitecturePosition.z> -14.95&&(smallReveal||tallReveal)) {
            displayColor+=vec3(.12,.055,.012);
          }
          if(architectureStairs>.5) {
            vec3 shadowFloor=vec3(.34,.32,.36);
            vec3 shadowDelta=displayColor-shadowFloor;
            displayColor=.5*(displayColor+shadowFloor+sqrt(shadowDelta*shadowDelta+.001225));
          }
          displayColor=clamp(displayColor,0.,1.);
          outgoingLight=mix(outgoingLight,architectureRadiance(displayColor),architectureStrength*inBake*visible*facing);
        }
        #include <opaque_fragment>
      `);
    };
    material.customProgramCacheKey = () => "conservatory-registered-architecture-gi";
    material.needsUpdate = true;
  }

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      texture.dispose();
      depthTarget.dispose();
    },
  };
}
