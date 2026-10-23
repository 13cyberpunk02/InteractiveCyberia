// @ts-nocheck
/*
 * Neo-Eden - the whole 3D city in one factory.
 *
 * This file is a port of the standalone demo (three r147 UMD) to three r186 ES modules.
 * It is deliberately framework-free: Angular only talks to it through the small API returned at the bottom
 * (see CityEngine in city-engine.ts). Type checking is off here because the code is large, mostly
 * numeric and was written untyped; the public API is typed in city-engine.ts.
 *
 * Sections, in order: renderer and scene · sky · wet streets with planar reflections · GLB buildings
 * (instanced, interior-mapped windows, kitbash cladding) · cables, bridges, monorail · holographic billboards ·
 * landmarks · traffic · streets, cars and citizens · clouds and searchlights · rain and atmosphere ·
 * hologram fauna · post-processing · hangar and driving · quality presets · camera, flights and the frame loop.
 */
import * as THREE0 from 'three';
import gsap from 'gsap';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { LOC as LOCS_BY_KEY } from './config';

// the demo code expects these helpers on the THREE namespace (as the old UMD build had them)
const THREE = {
  ...THREE0,
  BufferGeometryUtils: { mergeBufferGeometries: mergeGeometries },
  EffectComposer, RenderPass, ShaderPass, UnrealBloomPass,
};

export function createWorld(canvas, OPTS) {
  const AUDIO = OPTS.audio, HOOKS = OPTS.hooks || {}, ASSETS = OPTS.assets || 'models/';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const LOC = LOCS_BY_KEY;
  const ORDER = ['hub', 'about', 'projects', 'contact', 'fly'];
  const SFX = { hover: () => AUDIO.hover(), click: () => AUDIO.click(), whoosh: d => AUDIO.whoosh(d), bump: () => AUDIO.bump(), arrive: () => AUDIO.arrive() };
  let SPEED = 0, ALT = 0, elapsed = 0;

  /* ================= Renderer & scene ================= */
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
  // colours and shaders are tuned as raw values: no colour management, no output conversion
  THREE.ColorManagement.enabled = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  let DPRnow = Math.min(devicePixelRatio||1, 1.75);
  renderer.setPixelRatio(DPRnow);
  const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const scene = new THREE.Scene();
  const FOG = new THREE.Color(0x101a2a);
  const FOG_D = 0.0052;
  scene.fog = new THREE.FogExp2(FOG, FOG_D);
  scene.background = FOG;
  const camera = new THREE.PerspectiveCamera(58, 1, 1.5, 3300);

  let seed = 1337;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd()*a.length)];
  const U = { time:{value:0}, bass:{value:0} };
  const anim = [];
  const BM = (hex,o) => new THREE.MeshBasicMaterial(Object.assign({color:hex}, o||{}));
  const box = (w,h,d,x=0,y=0,z=0) => { const g=new THREE.BoxGeometry(w,h,d); g.translate(x,y,z); return g; };
  const col = new THREE.Color();

  const NOISE = `
    float h13(vec3 p){ p = fract(p*.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y)*p.z); }
    vec3 h33(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx)*p.zyx); }
    float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x), mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x), f.y),
                 mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x), mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),f.x), f.y), f.z); }
    float fbm(vec3 p){ float a = .5, s = 0.0; for(int i=0;i<6;i++){ s += a*vnoise(p); p = p*2.03 + vec3(1.7,9.2,3.4); a *= .5; } return s; }
  `;

  /* ================= Reflections: a small neon "studio" turned into an environment map ================= */
  {
    const env = new THREE.Scene(); env.background = new THREE.Color(0x07040f);
    const panel = (w,h,hex,x,y,z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w,h), BM(hex,{side:THREE.DoubleSide})); m.position.set(x,y,z); m.lookAt(0,0,0); env.add(m); };
    panel(14,4, 0xd0307e, -9,1,2);
    panel(14,4, 0x2fb8cc, 9,2,-3);
    panel(12,12,0x6a5aa8, 0,9,0);
    panel(8,3,  0xc89040, 2,-1,9);
    panel(30,30,0x0d0820, 0,-9,0);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture;
    pm.dispose();
  }
  scene.add(new THREE.HemisphereLight(0x8aa0ff, 0x30183a, .9*Math.PI));
  const sun = new THREE.DirectionalLight(0xc0d0ff, .8*Math.PI); sun.position.set(.6,.35,.7); scene.add(sun);

  /* ================= Sky: Hubble-style deep field, baked once into a cube map ================= */
  function buildSky(){
    const big = renderer.capabilities.maxTextureSize >= 8192;
    const W = big ? 4096 : 2048, H = W/2;
    const rt = new THREE.WebGLRenderTarget(W, H, {depthBuffer:false});
    const stars = [];
    for(let i=0;i<18;i++){ const az = rnd()*Math.PI*2, el = .08 + rnd()*.85; stars.push(new THREE.Vector3(Math.cos(el)*Math.sin(az), Math.sin(el), Math.cos(el)*Math.cos(az))); }
    const mat = new THREE.ShaderMaterial({
      uniforms:{ uFog:{value:FOG}, uStars:{value:stars} },
      vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader:`precision highp float; varying vec2 vUv; uniform vec3 uFog; uniform vec3 uStars[18];
        ${NOISE}
        float starLayer(vec3 d, float s, float thr){
          vec3 p = d*s; vec3 c = floor(p); vec3 r = h33(c + 17.0);
          if(r.x < thr) return 0.0;
          vec3 sp = normalize(c + 0.15 + 0.7*h33(c + 3.1));
          float dist = length(cross(sp, d))*s;
          float pr = 0.0011*s;
          return exp(-dist*dist/(pr*pr)) * (0.06 + pow(r.y,6.0)*1.3);
        }
        void main(){
          float lon = (vUv.x-0.5)*6.28318530718, lat = (vUv.y-0.5)*3.14159265359;
          vec3 d = vec3(cos(lat)*sin(lon), sin(lat), cos(lat)*cos(lon));
          vec3 col = vec3(0.004,0.005,0.016);
          // galactic band
          vec3 bn = normalize(vec3(0.35,0.6,0.72)); float bd = dot(d,bn);
          float band = exp(-bd*bd*14.0);
          col += vec3(0.13,0.12,0.2)*band*(0.3 + fbm(d*6.0 + 2.0)*0.9);
          // nebula regions
          float reg = smoothstep(0.45,0.97,dot(d, normalize(vec3(-0.5,0.42,-0.78))))
                    + 0.8*smoothstep(0.62,0.97,dot(d, normalize(vec3(0.62,0.5,-0.55))))
                    + 0.7*smoothstep(0.66,0.97,dot(d, normalize(vec3(-0.85,0.35,0.35))))
                    + 0.5*smoothstep(0.7,0.97,dot(d, normalize(vec3(0.3,0.55,0.8))));
          vec3 q = d*2.6;
          vec3 w = vec3(fbm(q+vec3(1.7,9.2,3.1)), fbm(q+vec3(8.3,2.8,5.5)), fbm(q+vec3(4.1,6.6,1.2)));
          float n1 = fbm(q + w*2.4);
          float n2 = fbm(q*1.9 - w*1.6 + 4.0);
          float n3 = fbm(q*4.5 + w*3.0 + 9.0);
          vec3 teal = vec3(0.04,0.30,0.42), pink = vec3(0.70,0.15,0.42), gold = vec3(0.92,0.56,0.22);
          vec3 neb = teal*smoothstep(0.32,0.85,n1)*1.05
                   + pink*pow(smoothstep(0.38,0.9,n2),1.4)*1.15
                   + gold*pow(smoothstep(0.5,0.9,n1*n2*1.9),2.0)*1.05;
          float dust = smoothstep(0.5,0.74,n3);
          neb *= mix(1.0, 0.1, dust);
          neb = neb/(1.0 + neb*1.3);
          col = col*mix(1.0, 0.35, dust*min(reg,1.0)) + neb*reg;
          // star fields
          float st = starLayer(d,90.0,0.9) + starLayer(d,180.0,0.955) + starLayer(d,300.0,0.975);
          vec3 sc = mix(vec3(0.7,0.8,1.0), vec3(1.0,0.86,0.68), h13(floor(d*160.0)));
          col += sc*st*(1.0 + reg*0.6);
          // bright stars with diffraction spikes
          for(int i=0;i<18;i++){
            vec3 s = uStars[i]; if(dot(d,s) < 0.985) continue;
            vec3 T = normalize(cross(s, vec3(0.0,1.0,0.001))); vec3 B = cross(T, s);
            vec2 l = vec2(dot(d,T), dot(d,B)); float r = length(l);
            float core = exp(-r*r/(0.0021*0.0021));
            float halo = exp(-r/0.007)*0.22;
            float sp = exp(-abs(l.x)/0.0006)*exp(-abs(l.y)/0.022) + exp(-abs(l.y)/0.0006)*exp(-abs(l.x)/0.022);
            vec3 c = mix(vec3(0.72,0.84,1.0), vec3(1.0,0.84,0.62), fract(float(i)*0.37));
            col += c*(core*1.3 + halo + sp*0.5);
          }
          float h = d.y;
          // thin rain haze low over the city: wisps that thin out with height, so space stays clear above
          vec2 cp = d.xz/(max(h, 0.0) + 0.12);
          float m1 = fbm(vec3(cp*0.9, 1.3)), m2 = fbm(vec3(cp*2.7 + m1*1.5, 4.1));
          float wisp = smoothstep(0.45, 0.85, m1*0.7 + m2*0.4)*(1.0 - smoothstep(0.04, 0.3, h));
          col = mix(col, vec3(0.1,0.08,0.18) + vec3(0.2,0.05,0.18)*m2, wisp*0.6);
          col += vec3(0.5,0.08,0.35)*exp(-max(h,0.0)*9.0)*0.4 + vec3(0.03,0.14,0.2)*exp(-max(h,0.0)*4.0)*0.35;
          col = mix(uFog, col, smoothstep(-0.03, 0.12, h));
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthTest:false, depthWrite:false
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2), mat);
    const bs = new THREE.Scene(); bs.add(quad);
    renderer.setRenderTarget(rt); renderer.render(bs, new THREE.OrthographicCamera(-1,1,1,-1,0,1)); renderer.setRenderTarget(null);
    const cube = new THREE.WebGLCubeRenderTarget(W/4, {generateMipmaps:true, minFilter:THREE.LinearMipmapLinearFilter});
    cube.fromEquirectangularTexture(renderer, rt.texture);
    scene.background = cube.texture;
    FACADE_U.uSky.value = cube.texture;
    rt.dispose(); mat.dispose(); quad.geometry.dispose();
    buildSkyPlanet();
  }

  /* Sky set-piece (GLB): ringed gas giant, two moons and the orbital habitat ring - the utopia's halo */
  const halo = new THREE.Group();
  const SKYP = {};
  function buildSkyPlanet(){
    halo.position.set(-471, 802, -1341); halo.scale.setScalar(3.3); scene.add(halo);
    const L = new THREE.Vector3(.8, .35, .3).normalize();
    const vs = `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`;
    loadModel('sky_planet').then(root=>{
      halo.add(root);
      root.traverse(o=>{
        if(/^(halo|moon_\d|rings)$/.test(o.name)) SKYP[o.name] = o;
        if(!o.isMesh) return;
        const m = o.material, n = m.name;
        if(n === 'planet_surface') o.material = new THREE.ShaderMaterial({ fog:false, uniforms:{ map:{value:m.map}, L:{value:L} }, vertexShader:vs,
          fragmentShader:`uniform sampler2D map; uniform vec3 L; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
            void main(){ vec3 N = normalize(vN); vec3 base = texture2D(map, vUv).rgb;
              float d = smoothstep(-0.12, 0.65, dot(N, L));
              float rim = pow(1.0 - max(dot(N, normalize(vV)), 0.0), 3.0);
              gl_FragColor = vec4(base*(0.03 + d*0.6) + vec3(0.3,0.7,1.0)*rim*(0.1 + d*0.35), 1.0); }` });
        else if(n === 'planet_atmo') o.material = new THREE.ShaderMaterial({ fog:false, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, uniforms:{ L:{value:L} }, vertexShader:vs,
          fragmentShader:`uniform vec3 L; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
            void main(){ vec3 N = normalize(vN); float f = pow(1.0 - max(dot(N, normalize(vV)), 0.0), 4.0);
              float d = smoothstep(-0.3, 0.6, dot(N, L)); gl_FragColor = vec4(vec3(0.35,0.75,1.0)*f*(0.15 + d)*0.7, 1.0); }` });
        else if(n === 'planet_rings') o.material = new THREE.MeshBasicMaterial({ map:m.map, color:0x9a90a8, fog:false, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide });
        else m.fog = false;
      });
    }).catch(e=>console.warn('sky planet', e));
  }

  /* ================= Wet streets: asphalt, markings, lamp pools and planar neon reflections ================= */
  const GLSL_UTIL = `
    float hash2(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
    float band(float x, float a, float b, float h){ return clamp((min(b, x+h) - max(a, x-h))/(2.0*h), 0.0, 1.0); }
  `;
  const HAZE = new THREE.Color(0x2a2c52);
  const REFL = { rt:null, cam:new THREE.PerspectiveCamera(), tm:new THREE.Matrix4(), on:true, scale:.5, hide:[] };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.ShaderMaterial({
    uniforms:{ uFog:{value:FOG}, uD:{value:FOG_D}, uHaze:{value:HAZE}, bass:U.bass, time:U.time, tRefl:{value:null}, uTM:{value:REFL.tm}, uRefl:{value:0} },
    extensions:{derivatives:true},
    vertexShader:`uniform mat4 uTM; varying vec3 vW; varying float vDepth; varying vec4 vRefl;
      void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vRefl = uTM*w; vec4 mv = viewMatrix*w; vDepth = -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader:`varying vec3 vW; varying float vDepth; varying vec4 vRefl;
      uniform vec3 uFog; uniform float uD; uniform vec3 uHaze; uniform float bass; uniform float time; uniform sampler2D tRefl; uniform float uRefl;
      ${GLSL_UTIL}
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hash2(i),hash2(i+vec2(1,0)),f.x), mix(hash2(i+vec2(0,1)),hash2(i+vec2(1,1)),f.x), f.y); }
      vec3 lampCol(float k){ float m = mod(k, 3.0); return m < 0.5 ? vec3(0.24,0.95,1.0) : (m < 1.5 ? vec3(1.0,0.24,0.65) : vec3(1.0,0.77,0.42)); }
      void main(){
        vec2 p = vW.xz;
        vec2 cell = floor(p/45.0 + 0.5);
        vec2 q = p - 45.0*cell; vec2 aq = abs(q);
        vec2 fw = fwidth(p); float h = max(max(fw.x, fw.y), 1e-3)*0.5;
        float far = smoothstep(0.04, 0.3, h);
        const float ROAD = 3.0; const float WALK = 4.6;
        float rA = band(aq.x, -1.0, ROAD, h), rB = band(aq.y, -1.0, ROAD, h);
        float road = max(rA, rB);
        float walk = max(band(aq.x, ROAD, WALK, h), band(aq.y, ROAD, WALK, h))*(1.0 - road);
        vec3 col = vec3(0.012,0.008,0.022);
        col = mix(col, vec3(0.022,0.02,0.034), road);
        vec2 tg = abs(fract(p/1.5) - 0.5);
        float tile = mix(smoothstep(0.44, 0.5, max(tg.x, tg.y)), 0.15, far);
        col = mix(col, vec3(0.05,0.042,0.07) - tile*0.02, walk);
        float curb = max(band(aq.x, ROAD-0.07, ROAD+0.07, h)*(1.0-rB), band(aq.y, ROAD-0.07, ROAD+0.07, h)*(1.0-rA));
        col += vec3(0.3,0.95,0.9)*curb*(0.35 + bass*0.4);
        float onlyA = rA*(1.0 - band(aq.y, -1.0, WALK, h));
        float onlyB = rB*(1.0 - band(aq.x, -1.0, WALK, h));
        float mark = band(aq.x, -1.0, 0.08, h)*mix(step(0.5, fract(p.y/5.0)), 0.5, far)*onlyA
                   + band(aq.y, -1.0, 0.08, h)*mix(step(0.5, fract(p.x/5.0)), 0.5, far)*onlyB;
        mark += rA*band(aq.y, ROAD+0.15, WALK-0.1, h)*mix(step(0.5, fract(q.x/0.8)), 0.5, far);
        mark += rB*band(aq.x, ROAD+0.15, WALK-0.1, h)*mix(step(0.5, fract(q.y/0.8)), 0.5, far);
        col += vec3(0.62,0.64,0.74)*clamp(mark, 0.0, 1.0)*0.22;
        float idA = floor((p.y-7.5)/15.0 + 0.5), idB = floor((p.x-7.5)/15.0 + 0.5);
        float alA = p.y - (idA*15.0 + 7.5), alB = p.x - (idB*15.0 + 7.5);
        float poolA = exp(-((aq.x-2.7)*(aq.x-2.7) + alA*alA)/6.0);
        float poolB = exp(-((aq.y-2.7)*(aq.y-2.7) + alB*alB)/6.0);
        vec3 lightC = lampCol(abs(cell.x*7.0 + idA*3.0 + (q.x > 0.0 ? 1.0 : 0.0)))*poolA
                    + lampCol(abs(cell.y*5.0 + idB*2.0 + (q.y > 0.0 ? 1.0 : 0.0) + 1.0))*poolB;
        // puddles: big soft patches, blended to their average far away so they never shimmer
        float pud = mix(smoothstep(0.5, 0.68, vn(p*0.16) * 0.7 + vn(p*0.55) * 0.3), 0.3, smoothstep(0.3, 1.5, h));
        float wetArea = road + walk;
        col += lightC*(0.16 + pud*0.3)*(wetArea + 0.25);
        // planar reflection with rain ripples and a vertical streak blur
        vec3 refl = vec3(0.0);
        if(uRefl > 0.5){
          vec2 rip = vec2(vn(p*2.3 + vec2(0.0, time*1.7)), vn(p*2.1 + vec2(time*1.5, 0.0))) - 0.5;
          rip *= mix(1.0, 0.25, far);
          vec4 pr = vRefl;
          pr.xy += rip*mix(0.016, 0.005, pud)*pr.w;
          float st = mix(0.009, 0.002, pud)*pr.w;
          for(int k = -3; k <= 3; k++){ vec4 qq = pr; qq.y += float(k)*st; refl += texture2DProj(tRefl, qq).rgb; }
          refl /= 7.0;
        }
        vec3 V = normalize(cameraPosition - vW);
        float fres = 0.18 + 0.82*pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
        float rk = clamp(wetArea, 0.0, 1.0)*mix(0.42, 1.0, pud)*fres;
        col = col*(1.0 - rk*0.5) + refl*rk*1.1;
        float f = 1.0 - exp(-uD*uD*vDepth*vDepth);
        float hz = (1.0 - exp(-vDepth*0.009))*0.72;
        col = mix(col, uHaze, hz);
        gl_FragColor = vec4(mix(col, uFog, f), 1.0);
      }`
  }));
  ground.rotation.x = -Math.PI/2; scene.add(ground);
  REFL.hide.push(ground);
  const _cw = new THREE.Vector3(), _rot = new THREE.Matrix4(), _lk = new THREE.Vector3();
  function renderReflection(){
    const u = ground.material.uniforms;
    if(!REFL.on){ u.uRefl.value = 0; return; }
    camera.updateMatrixWorld();
    _cw.setFromMatrixPosition(camera.matrixWorld);
    if(_cw.y < 0.2){ u.uRefl.value = 0; return; }
    _rot.extractRotation(camera.matrixWorld);
    _lk.set(0,0,-1).applyMatrix4(_rot).add(_cw);
    const vc = REFL.cam;
    vc.position.set(_cw.x, -_cw.y, _cw.z);
    vc.up.set(0,1,0).applyMatrix4(_rot); vc.up.y = -vc.up.y;
    vc.lookAt(_lk.x, -_lk.y, _lk.z);
    vc.near = camera.near; vc.far = camera.far;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);
    REFL.tm.set(0.5,0,0,0.5, 0,0.5,0,0.5, 0,0,0.5,0.5, 0,0,0,1).multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);
    const vis = REFL.hide.map(o=>o.visible); REFL.hide.forEach(o=>o.visible = false);
    const fog = scene.fog;
    renderer.setRenderTarget(REFL.rt); renderer.clear(); renderer.render(scene, vc); renderer.setRenderTarget(null);
    REFL.hide.forEach((o,i)=>o.visible = vis[i]);
    u.tRefl.value = REFL.rt.texture; u.uRefl.value = 1;
  }
  function sizeReflection(){
    const w = Math.max(64, Math.round(W*DPRnow*REFL.scale)), h = Math.max(64, Math.round(H*DPRnow*REFL.scale));
    if(!REFL.rt) REFL.rt = new THREE.WebGLRenderTarget(w, h);
    else REFL.rt.setSize(w, h);
  }


  /* ================= Buildings ================= */
  const near = (x,z) => Object.values(LOC).some(l => Math.hypot(x-l.obj[0], z-l.obj[2]) < (l===LOC.hub?26:22));
  const blocked = (x,z) => Object.values(LOC).some(l=>{
    const bx=l.obj[0], bz=l.obj[2]; let dx=l.cam[0]-bx, dz=l.cam[2]-bz; const len=Math.hypot(dx,dz); dx/=len; dz/=len;
    const ax=l.cam[0]+dx*25, az=l.cam[2]+dz*25, vx=ax-bx, vz=az-bz;
    const t=Math.max(0,Math.min(1,((x-bx)*vx+(z-bz)*vz)/(vx*vx+vz*vz)));
    return Math.hypot(x-(bx+vx*t), z-(bz+vz*t)) < 11 + 12*t || Math.hypot(x-l.cam[0], z-l.cam[2]) < 24;
  });
  /* ---- Building catalogue: detailed GLB models (garage/src/archetypes.js), arranged block by block ---- */
  const BLD = [], TOPS = [], SOLID = new Map(), PLACE = [];
  /* the monorail loop: straight runs over the avenues joined by wide curves (radius MONO.R) */
  const MONO = { Y:27, X0:135, Z0:90, R:20 };
  const monoHit = (x, z, hw, hd) => {
    // any point of a corner curve within the footprint (plus clearance for the train) blocks the slot
    for(const [sx, sz] of [[1,1],[-1,1],[-1,-1],[1,-1]]){
      const cx = sx*(MONO.X0 - MONO.R), cz = sz*(MONO.Z0 - MONO.R);
      for(let i=0;i<=16;i++){ const a = i/16*Math.PI/2, px = cx + sx*Math.cos(a)*MONO.R, pz = cz + sz*Math.sin(a)*MONO.R;
        if(Math.abs(px - x) < hw + 3.2 && Math.abs(pz - z) < hd + 3.2) return true; }
    }
    return false;
  };
  const FACADE_U = { uSky:{value:null}, uDbg:{value:0} };
  const BMETA = {"arcology": {"h": 110.7, "top": 131.2}, "blade_a": {"h": 200, "top": 222.1}, "blade_b": {"h": 150, "top": 172.1}, "bunker": {"h": 46, "top": 55.5}, "capsule": {"h": 70, "top": 87.1}, "capsule_slab": {"h": 96, "top": 113.3}, "exo_a": {"h": 224, "top": 235.9}, "exo_b": {"h": 174, "top": 184.9}, "industrial": {"h": 17.7, "top": 70.6}, "industrial_slab": {"h": 16.5, "top": 86.2}, "k_block_a": {"h": 213.3, "top": 236}, "k_block_b": {"h": 243.9, "top": 254.1}, "k_block_c": {"h": 277.9, "top": 298.8}, "k_block_d": {"h": 189.4, "top": 214.4}, "k_slab_a": {"h": 149.2, "top": 167.8}, "k_slab_b": {"h": 184.5, "top": 205.9}, "k_tower_a": {"h": 121.7, "top": 126.5}, "k_tower_b": {"h": 106.8, "top": 121.5}, "k_tower_c": {"h": 91.9, "top": 110.2}, "k_tower_d": {"h": 76.7, "top": 86.6}, "k_tower_e": {"h": 141.8, "top": 160.7}, "k_tower_f": {"h": 62, "top": 80.1}, "k_tower_g": {"h": 116.8, "top": 126}, "k_tower_h": {"h": 96.6, "top": 112}, "k_tower_i": {"h": 56.5, "top": 80.2}, "k_tower_j": {"h": 161.9, "top": 174.5}, "kowloon": {"h": 65, "top": 65.2}, "mega_a": {"h": 230, "top": 254.3}, "mega_b": {"h": 190, "top": 205.3}, "mega_c": {"h": 160, "top": 183.1}, "mega_d": {"h": 250, "top": 274}, "needle": {"h": 95, "top": 112.2}, "neonslim_a": {"h": 130, "top": 135.4}, "neonslim_b": {"h": 95, "top": 100.4}, "nexus": {"h": 180, "top": 187.2}, "octo": {"h": 115, "top": 137.1}, "pagoda": {"h": 94.6, "top": 120}, "rotunda": {"h": 193.2, "top": 232.7}, "slab_a": {"h": 82, "top": 99}, "slab_b": {"h": 64, "top": 78.7}, "slab_tower": {"h": 135, "top": 163.3}, "spire_a": {"h": 250, "top": 276.8}, "spire_b": {"h": 200, "top": 233.4}, "stack": {"h": 175, "top": 198.8}, "twins": {"h": 72, "top": 89.6}, "twist": {"h": 122.4, "top": 144.4}, "walkup_a": {"h": 28, "top": 33.7}, "walkup_b": {"h": 38, "top": 43.7}, "ziggurat": {"h": 120, "top": 142.4}};
  {
    // footprint classes: big = whole block, slab = half a block, small = a quarter
    const CLS = { big:{w:34, d:34}, slab:{w:33, d:15}, small:{w:15, d:15} };
    const KIT = {
      big:   { tall:['k_block_a','k_block_b','k_block_c','k_block_d','spire_a','k_block_b'], mid:['k_block_a','k_block_d','k_block_c','kowloon'], low:['k_block_d','kowloon','industrial'] },
      slab:  { tall:['k_slab_a','k_slab_b'], mid:['k_slab_a','k_slab_b','capsule_slab'], low:['k_slab_a','capsule_slab'] },
      small: { tall:['k_tower_a','k_tower_e','k_tower_j','k_tower_g','k_tower_b'], mid:['k_tower_c','k_tower_h','k_tower_b','k_tower_g','k_tower_d','pagoda'], low:['k_tower_d','k_tower_f','k_tower_i','k_tower_i','walkup_b'] },
    };
    const clsOf = id => Object.keys(KIT).find(c => Object.values(KIT[c]).some(l => l.includes(id)));
    const probe = [[0,0],[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1],[.5,.5],[.5,-.5],[-.5,.5],[-.5,-.5]];
    const free = (x,z,hw,hd) => !monoHit(x,z,hw,hd) && !probe.some(([a,b])=>{ const px = x + a*hw, pz = z + b*hd; return near(px,pz) || blocked(px,pz); });
    let sid = 1;
    const put = (id, x, z, rot, sy) => {
      const c = CLS[clsOf(id)], m = BMETA[id];
      const w = rot % 2 ? c.d : c.w, d = rot % 2 ? c.w : c.d, h = m.h*sy;
      PLACE.push({id, x, z, rot, sy, acc: Math.floor(rnd()*4), sid: sid++});
      const big = c === CLS.big;
      BLD.push({x, z, w, d, h, mega: big && h > 120, round: id === 'rotunda', noSign: big, type: 0});
      TOPS.push({x, z, top: h, w: w*.6, d: d*.6, h, mega: big && h > 120, round: id === 'rotunda'});
      const s = {x, z, hw: w/2, hd: d/2, top: h};
      for(let i = Math.ceil((x - w/2 - 1)/9); i <= Math.floor((x + w/2 + 1)/9); i++)
        for(let j = Math.ceil((z - d/2 - 1)/9); j <= Math.floor((z + d/2 + 1)/9); j++) SOLID.set(i + ',' + j, s);
    };
    const tierPick = (cls, tier) => pick(KIT[cls][tier]);
    for(let bi = -6; bi <= 5; bi++) for(let bj = -6; bj <= 5; bj++){
      const cx = bi*45 + 22.5, cz = bj*45 + 22.5, dist = Math.hypot(cx, cz);
      const f = 1 - Math.min(dist/330, 1);
      const edge = Math.max(Math.abs(bi + .5), Math.abs(bj + .5)) > 5;
      const tier = () => { const t = rnd()*(0.35 + f*1.05); return edge ? (t > .7 ? 'mid' : 'low') : t > .62 ? 'tall' : t > .3 ? 'mid' : 'low'; };
      const sy = t => (t === 'tall' ? .85 + rnd()*.3 : t === 'mid' ? .8 + rnd()*.4 : .8 + rnd()*.35)*(0.8 + f*0.3);
      const tb = tier();
      // a whole-block tower where the block is clear
      if((tb === 'tall' || (tb === 'mid' && rnd() < .5)) && rnd() < .75 && free(cx, cz, 17, 17)){
        put(tierPick('big', tb), cx, cz, Math.floor(rnd()*4), sy(tb));
        continue;
      }
      const r = rnd();
      if(r < .3){
        // two slabs
        const alongX = rnd() < .5;
        for(const s of [-1, 1]){
          const x = alongX ? cx : cx + s*9.5, z = alongX ? cz + s*9.5 : cz;
          const t = tier();
          if(free(x, z, alongX ? 16.5 : 7.5, alongX ? 7.5 : 16.5)) put(tierPick('slab', t), x, z, (alongX ? 0 : 1) + (s > 0 ? 2 : 0), sy(t));
          else for(const k of [-1, 1]){ const x2 = alongX ? cx + k*9.5 : x, z2 = alongX ? z : cz + k*9.5; const t2 = tier(); if(free(x2, z2, 7.5, 7.5)) put(tierPick('small', t2), x2, z2, Math.floor(rnd()*4), sy(t2)); }
        }
      } else if(r < .55){
        // a slab and two small towers
        const alongX = rnd() < .5, s = rnd() < .5 ? -1 : 1;
        const x = alongX ? cx : cx + s*9.5, z = alongX ? cz + s*9.5 : cz, t = tier();
        if(free(x, z, alongX ? 16.5 : 7.5, alongX ? 7.5 : 16.5)) put(tierPick('slab', t), x, z, (alongX ? 0 : 1) + (s > 0 ? 2 : 0), sy(t));
        for(const k of [-1, 1]){
          const x2 = alongX ? cx + k*9.5 : cx - s*9.5, z2 = alongX ? cz - s*9.5 : cz + k*9.5, t2 = tier();
          if(free(x2, z2, 7.5, 7.5)) put(tierPick('small', t2), x2, z2, Math.floor(rnd()*4), sy(t2));
        }
      } else {
        // four small towers
        for(const a of [-1, 1]) for(const b of [-1, 1]){
          const x = cx + a*9.5, z = cz + b*9.5, t = tier();
          if(free(x, z, 7.5, 7.5)) put(tierPick('small', t), x, z, Math.floor(rnd()*4), sy(t));
        }
      }
    }
  }

  let buildingsReady = Promise.resolve();
  let _lib = null;
  const GLBLIB = () => _lib || (_lib = fetch(ASSETS + 'city/index.json').then(r=>{ if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(ids=>Object.fromEntries(ids.map(id=>[id, ASSETS + 'city/' + id + '.glb']))));
  function parseGLB(url){
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    return loader.loadAsync(url).then(g=>g.scene);
  }
  /** Loads one GLB from the city library and restores its authored colours (the scene has no colour management). */
  const MODELS = {};
  function loadModel(id){
    if(!MODELS[id]) MODELS[id] = GLBLIB().then(lib=>{ if(!lib[id]) throw new Error('no model ' + id); return parseGLB(lib[id]); }).then(root=>{
      const seen = new Set();
      root.traverse(o=>{ if(!o.isMesh) return; o.frustumCulled = false; const m = o.material; if(seen.has(m)) return; seen.add(m);
        if(m.color) m.color.convertLinearToSRGB(); if(m.emissive) m.emissive.convertLinearToSRGB();
        if(m.emissiveMap) m.emissiveMap.colorSpace = THREE.NoColorSpace; if(m.map) m.map.colorSpace = THREE.NoColorSpace; });
      return root;
    });
    return MODELS[id];
  }
  function buildGLBCity(){
    const vert = `
        attribute vec4 aInfo; attribute vec2 aFace;
        varying vec3 vN; varying vec3 vW; varying float vDepth; varying float vU; varying vec4 vInfo; varying float vFace;
        void main(){
          mat4 m = modelMatrix*instanceMatrix;
          vN = normalize(mat3(m)*normal);
          vU = uv.x; vFace = aFace.x; vInfo = aInfo;
          vec4 w = m*vec4(position,1.0);
          vW = w.xyz;
          vec4 mv = viewMatrix*w; vDepth = -mv.z; gl_Position = projectionMatrix*mv;
        }`;
    const frag = `
        varying vec3 vN; varying vec3 vW; varying float vDepth; varying float vU; varying vec4 vInfo; varying float vFace;
        uniform vec3 uFog; uniform float uD; uniform vec3 uHaze; uniform float bass; uniform samplerCube uSky; uniform float uDbg; uniform float time;
        float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
        vec3 accent(float k){ return k < 0.5 ? vec3(0.24,0.95,1.0) : k < 1.5 ? vec3(1.0,0.24,0.65) : k < 2.5 ? vec3(1.0,0.62,0.3) : vec3(0.6,0.36,1.0); }
        vec3 envRefl(vec3 R){
          // blurred mip: glass reflects the nebula glow, not individual stars (they would streak into dashes)
          vec3 sky = textureCube(uSky, R, 5.0).rgb;
          // below the horizon the glass sees the lit city, not the sky
          vec3 city = mix(vec3(0.04,0.03,0.07), vec3(0.24,0.08,0.24), smoothstep(-0.5, 0.0, R.y));
          return mix(city, sky, smoothstep(-0.02, 0.08, R.y));
        }
        // interior mapping: fake room behind each window
        vec3 room(vec2 p, vec3 d, vec3 L, float s){
          vec3 tt;
          tt.x = (d.x > 0.0 ? 1.0 - p.x : -p.x)/(abs(d.x) < 1e-4 ? 1e-4 : d.x);
          tt.y = (d.y > 0.0 ? 1.0 - p.y : -p.y)/(abs(d.y) < 1e-4 ? 1e-4 : d.y);
          tt.z = -1.0/min(d.z, -1e-4);
          float t = min(min(tt.x, tt.y), tt.z);
          vec3 h = vec3(p, 0.0) + d*t;
          float depth = clamp(-h.z, 0.0, 1.0);
          vec3 c;
          if(t == tt.z){
            c = L*0.5;
            float fx = fract(s*7.31)*0.55;
            c *= 1.0 - 0.75*step(h.y, 0.3 + fract(s*3.7)*0.15)*step(fx, h.x)*step(h.x, fx + 0.38);
            c += L*0.25*step(0.6, fract(s*11.0))*step(0.45, h.y)*step(h.y, 0.75)*step(0.15, h.x)*step(h.x, 0.4);
          } else if(t == tt.x){
            c = L*0.34*(1.0 - depth*0.4);
          } else if(d.y < 0.0){
            c = L*0.18*(1.0 - depth*0.5);
          } else {
            c = L*0.62;
            c += L*1.4*smoothstep(0.22, 0.0, length(vec2(h.x - 0.5, (h.z + 0.5)*1.6)));
          }
          return c*(1.0 - depth*0.35);
        }
        void main(){
          float type = TYPE; float vBase = 0.0; float vTop = vInfo.z;
          // interpolated ids drift by a hair (4.0 -> 3.99999): snap them before hashing
          float sid = floor(vInfo.y + 0.5); vec2 bid = vec2(sid, floor(sid/7.0));
          vec3 acc = accent(floor(vInfo.x + 0.5));
          float seed = fract(sid*0.618034);
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vW);
          float vdist = vDepth;
          vec3 col;
          bool side = abs(N.y) < 0.5;
          if(side){
            vec3 T = normalize(cross(vec3(0.0,1.0,0.0), N));
            float u = vU;
            float y = vW.y;
            // facade layout per type: cell size, glass rectangle inside the cell
            vec2 cs; vec4 gr; vec3 alb; float litTh;
            if(type < 0.5){ cs = vec2(1.5, 3.6); gr = vec4(0.04, 0.96, 0.18, 0.97); alb = vec3(0.04,0.05,0.056); litTh = 0.74; }
            else if(type < 1.5){ cs = vec2(1.8, 3.4); gr = vec4(0.24, 0.76, 0.3, 0.8); alb = vec3(0.1,0.115,0.12); litTh = 0.8; }
            else if(type < 2.5){ cs = vec2(1.3, 3.6); gr = vec4(0.0, 1.0, 0.42, 0.66); alb = vec3(0.07,0.085,0.09); litTh = 0.48; }
            else if(type < 3.5){ cs = vec2(1.9, 3.2); gr = vec4(0.28, 0.72, 0.26, 0.78); alb = vec3(0.12,0.08,0.07); litTh = 0.76; }
            else { cs = vec2(3.0, 3.6); gr = vec4(0.06, 0.94, 0.4, 0.62); alb = vec3(0.05,0.055,0.068); litTh = 0.62; }
            vec2 g = vec2(u, y)/cs;
            vec2 cell = floor(g), f = fract(g);
            vec2 fw = fwidth(g);
            float far = smoothstep(0.05, 0.26, max(fw.x, fw.y));
            vec2 e = fw*0.8 + 0.001;
            float win = smoothstep(gr.x - e.x, gr.x + e.x, f.x)*(1.0 - smoothstep(gr.y - e.x, gr.y + e.x, f.x))
                      * smoothstep(gr.z - e.y, gr.z + e.y, f.y)*(1.0 - smoothstep(gr.w - e.y, gr.w + e.y, f.y));
            // ground-floor shops: wide glass with deep bright interiors
            bool shopRow = vBase < 0.5 && y < 3.2;
            if(shopRow){ g = vec2(u/3.2, y/3.2); cell = floor(g); f = fract(g); fw = fwidth(g); e = fw*0.8 + 0.001;
              win = smoothstep(0.06 - e.x, 0.06 + e.x, f.x)*(1.0 - smoothstep(0.94 - e.x, 0.94 + e.x, f.x))*smoothstep(0.05 - e.y, 0.05 + e.y, f.y)*(1.0 - smoothstep(0.82 - e.y, 0.82 + e.y, f.y)); }
            float faceId = floor(vFace + 0.5);
            // ribbon offices light whole runs of a floor: from a distance they read as glowing horizontal lines
            vec2 hcell = (type > 1.5 && type < 2.5 && !shopRow) ? vec2(floor(u/10.4)*8.0, cell.y) : cell;
            float hc = hash(hcell + bid*vec2(37.0, 91.0) + faceId*13.0 + 500.0);
            float lit = shopRow ? step(0.2, hc) : step(litTh, hc);
            vec3 warm = vec3(1.0,0.74,0.48), cool = vec3(0.72,0.9,1.0);
            float pick = fract(hc*7.77);
            vec3 L = (shopRow ? pick < 0.45 : pick < 0.12) ? acc*0.9 : (pick < 0.62 ? warm : cool);
            L *= (shopRow ? 0.95 : 0.75 + fract(hc*3.3)*0.6)*lit;
            // wall: panels or bricks, rain streaks, seams
            float pv = hash(floor(vec2(u/(type > 2.5 && type < 3.5 ? 0.45 : 2.4), y/(type > 2.5 && type < 3.5 ? 0.22 : 3.4))) + bid*3.1);
            bool brick = type > 2.5 && type < 3.5;
            vec2 pg = vec2(u/(brick ? 0.45 : 2.4), y/(brick ? 0.22 : 3.4));
            float fB = smoothstep(0.25, 0.8, max(fwidth(pg.x), fwidth(pg.y)));
            alb *= mix(0.82 + 0.36*pv, 1.0, max(far, fB));
            float su = u*1.6 + seed*40.0;
            float fS = smoothstep(0.25, 0.8, fwidth(su));
            float streak = vn(vec2(su, y*0.07));
            alb *= mix(mix(0.5, 1.0, smoothstep(0.15, 0.75, streak)), 0.8, fS);
            float seam = 1.0 - smoothstep(0.0, fw.y*1.5 + 0.004, min(f.y, 1.0 - f.y));
            alb *= 1.0 - seam*0.35*(1.0 - far);
            // light on the wall: sky, city glow from below, neon spill near the street, uplights at the crown
            float spU = u*0.18 + seed*17.0;
            float spill = mix(smoothstep(0.35, 0.75, vn(vec2(spU, 0.5))), 0.35, smoothstep(0.25, 0.8, fwidth(spU)));
            vec3 light = vec3(0.11,0.11,0.19) + vec3(0.36,0.13,0.32)*exp(-y/30.0) + acc*1.3*exp(-y/9.0)*spill;
            // a cool key from the sky glow and a magenta fill from the opposite side give the masses volume
            light += vec3(0.12,0.2,0.32)*max(dot(N, normalize(vec3(0.55, 0.3, 0.78))), 0.0) + vec3(0.18,0.05,0.15)*max(dot(N, normalize(vec3(-0.7, 0.1, -0.5))), 0.0);
            float crown = exp(-max(vTop - y, 0.0)/4.0)*step(0.5, fract(seed*5.0))*step(24.0, vTop);
            light += acc*0.9*crown;
            vec3 wall = alb*light;
            // circuit traces of cyan light climbing some towers
            float trace = 0.0;
            if(fract(seed*3.7) < 0.42 && (type < 2.5 || type > 3.5)){
              vec2 tq = vec2(u/4.2, y/22.0);
              float col0 = floor(tq.x), seg0 = floor(tq.y);
              float on = step(0.62, hash(vec2(col0, seg0) + bid*1.7));
              float lw = fwidth(u)*0.9 + 0.04;
              float vline = 1.0 - smoothstep(0.06, 0.06 + lw, abs(fract(tq.x) - 0.5)*4.2);
              float gap = smoothstep(0.0, 0.04, fract(tq.y))*(1.0 - smoothstep(0.86, 0.9, fract(tq.y)));
              float jog = step(0.5, hash(vec2(col0, seg0 + 9.0) + bid));
              float hy = fwidth(y)*0.9 + 0.04;
              float hline = (1.0 - smoothstep(0.06, 0.06 + hy, abs(fract(tq.y) - 0.88)*22.0))*step(0.5, fract(tq.x))*jog;
              float pad = (1.0 - smoothstep(0.18, 0.18 + lw, length(vec2((fract(tq.x) - 0.5)*4.2, (fract(tq.y) - 0.9)*22.0))*0.5));
              float pulse = exp(-pow((fract(y/70.0 - time*0.12 + hash(vec2(col0, 3.0) + bid)) - 0.5)*9.0, 2.0));
              trace = on*clamp(vline*gap + hline + pad*0.6, 0.0, 1.0)*(0.55 + 1.6*pulse);
              trace = mix(trace, on*0.05, smoothstep(0.08, 0.3, fwidth(tq.x)));
            }
            float fres = 0.04 + 0.96*pow(1.0 - clamp(dot(V, N), 0.0, 1.0), 5.0);
            vec3 R = reflect(-V, N);
            wall += envRefl(R)*fres*0.25;
            // glass: interior + reflection
            vec3 d = vec3(dot(-V, T), dot(-V, vec3(0.0,1.0,0.0)), dot(-V, N));
            vec2 wp = vec2((f.x - gr.x)/(gr.y - gr.x), (f.y - gr.z)/(gr.w - gr.z));
            float roomDepth = shopRow ? 6.0 : 4.0;
            vec2 wsz = shopRow ? vec2(3.2*0.88, 3.2*0.77) : vec2(cs.x*(gr.y - gr.x), cs.y*(gr.w - gr.z));
            vec3 rd = vec3(d.x/wsz.x, d.y/wsz.y, d.z/roomDepth);
            vec3 inside = room(clamp(wp, 0.0, 1.0), rd, L, hc);
            // blinds on some lit windows
            float bl = step(0.55, fract(hc*13.1))*smoothstep(1.0 - fract(hc*5.3)*0.7, 1.0 - fract(hc*5.3)*0.7 + 0.02, wp.y);
            inside = mix(inside, L*0.42 + vec3(0.01), bl*(shopRow ? 0.0 : 0.9));
            float gf = 0.06 + 0.94*pow(1.0 - clamp(dot(V, N), 0.0, 1.0), 4.0);
            vec3 glassTint = type < 0.5 ? vec3(0.55,0.75,0.85) : vec3(0.75,0.8,0.85);
            vec3 glass = inside*0.9*(1.0 - gf*0.6) + envRefl(R)*glassTint*(0.12 + gf*0.75) + vec3(0.004,0.006,0.012);
            // mullion in the middle of wide windows
            float mul = (type < 0.5 || shopRow) ? 1.0 - smoothstep(0.0, fw.x*1.2 + 0.01, abs(wp.x - 0.5)*(gr.y - gr.x)) : 0.0;
            glass = mix(glass, alb*light*0.6, mul*(1.0 - far));
            vec3 nearCol = mix(wall, glass, win);
            // far away: windows average out so nothing shimmers
            float area = (gr.y - gr.x)*(gr.w - gr.z);
            vec3 avgRoom = mix(warm, cool, 0.45)*0.42*(1.0 - litTh)*1.1;
            vec3 farCol = mix(alb*light + envRefl(R)*fres*0.25, avgRoom + envRefl(R)*glassTint*0.25, clamp(area, 0.0, 1.0));
            col = mix(nearCol, farCol, far);
            // metal panels: glowing seams on some panels, like a circuit board
            if(type > 3.5){
              float sx = 1.0 - smoothstep(0.0, fw.x*1.2 + 0.006, min(f.x, 1.0 - f.x));
              float sy = 1.0 - smoothstep(0.0, fw.y*1.2 + 0.006, min(f.y, 1.0 - f.y));
              float glowP = step(0.78, hash(floor(cell/vec2(2.0, 3.0)) + bid*5.3));
              col += acc*max(sx, sy)*glowP*0.55*(1.0 - far) + acc*glowP*0.04*far;
            }
            col += mix(vec3(0.25,1.0,0.92), acc, step(0.6, fract(seed*7.1)))*trace*1.2;
            // shop awning light strip
            if(vBase < 0.5 && type < 3.9){ float hy = max(fwidth(y), 1e-4)*0.5; col += acc*clamp((min(3.32, y+hy) - max(3.2, y-hy))/(2.0*hy), 0.0, 1.0)*0.9; }
          } else {
            // roofs: dark membrane with puddle sheen
            vec3 R = reflect(-V, N);
            col = vec3(0.03,0.026,0.04)*(0.8 + 0.4*vn(vW.xz*0.5)) + envRefl(R)*0.08;
            if(type > 3.5) col = vec3(0.06,0.055,0.065);
          }
          float fog = 1.0 - exp(-uD*uD*vdist*vdist);
          float hz = (1.0 - exp(-vdist*0.009))*exp(-max(vW.y, 0.0)/48.0)*0.75;
          col = mix(col, uHaze, hz);
          gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
        }`;
    const FT = { facade_glass:0, facade_concrete:1, facade_ribbon:2, facade_brick:3, facade_panel:4 };
    const facadeMat = {};
    Object.entries(FT).forEach(([k,t])=>facadeMat[k] = new THREE.ShaderMaterial({
      uniforms:{ uFog:{value:FOG}, uD:{value:FOG_D}, bass:U.bass, time:U.time, uHaze:{value:HAZE}, uSky:FACADE_U.uSky, uDbg:FACADE_U.uDbg },
      defines:{ TYPE: t.toFixed(1) }, extensions:{derivatives:true}, vertexShader:vert, fragmentShader:frag,
    }));
    // everything that is not a facade: concrete, metal, glass, plants. Albedo and surface kind come per vertex.
    const dressMat = new THREE.ShaderMaterial({
      uniforms:{ uFog:{value:FOG}, uD:{value:FOG_D}, uHaze:{value:HAZE}, uSky:FACADE_U.uSky },
      vertexShader:`attribute vec4 aCol; attribute vec4 aInfo;
        varying vec3 vN; varying vec3 vW; varying vec4 vCol; varying float vDepth; varying float vAcc;
        void main(){ mat4 m = modelMatrix*instanceMatrix; vN = normalize(mat3(m)*normal); vCol = aCol; vAcc = aInfo.x;
          vec4 w = m*vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix*w; vDepth = -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader:`uniform vec3 uFog; uniform float uD; uniform vec3 uHaze; uniform samplerCube uSky;
        varying vec3 vN; varying vec3 vW; varying vec4 vCol; varying float vDepth; varying float vAcc;
        vec3 accent(float k){ return k < 0.5 ? vec3(0.24,0.95,1.0) : k < 1.5 ? vec3(1.0,0.24,0.65) : k < 2.5 ? vec3(1.0,0.62,0.3) : vec3(0.6,0.36,1.0); }
        vec3 envRefl(vec3 R){ vec3 sky = textureCube(uSky, R, 5.0).rgb; vec3 city = mix(vec3(0.04,0.03,0.07), vec3(0.24,0.08,0.24), smoothstep(-0.5, 0.0, R.y)); return mix(city, sky, smoothstep(-0.02, 0.08, R.y)); }
        void main(){
          vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
          float kind = floor(vCol.a + 0.5);
          vec3 alb = vCol.rgb*0.55;
          vec3 acc = accent(floor(vAcc + 0.5));
          float up = N.y*0.5 + 0.5;
          vec3 light = vec3(0.12,0.12,0.2)*(0.6 + 0.8*up) + vec3(0.36,0.13,0.32)*exp(-vW.y/30.0)*(1.0 - up*0.6) + acc*0.9*exp(-vW.y/8.0)*(1.0 - up);
          light += vec3(0.22,0.34,0.55)*max(dot(N, normalize(vec3(0.55, 0.3, 0.78))), 0.0) + vec3(0.32,0.1,0.28)*max(dot(N, normalize(vec3(-0.7, 0.1, -0.5))), 0.0);
          float fres = 0.04 + 0.96*pow(1.0 - clamp(dot(V, N), 0.0, 1.0), 5.0);
          vec3 R = reflect(-V, N);
          vec3 col = alb*light;
          if(kind > 0.5 && kind < 1.5) col = alb*light*0.7 + envRefl(R)*(0.1 + fres*0.45)*(alb*1.4 + 0.15);
          else if(kind > 1.5) col = alb*light*0.3 + envRefl(R)*(0.025 + fres*0.32) + vec3(0.003,0.005,0.01);
          float fog = 1.0 - exp(-uD*uD*vDepth*vDepth);
          float hz = (1.0 - exp(-vDepth*0.009))*exp(-max(vW.y, 0.0)/48.0)*0.75;
          col = mix(col, uHaze, hz);
          gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
        }`,
    });
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors:true });
    // kitbash cladding: shared panel textures (albedo, lights, normals) tiled in metres
    const KT = {};
    const ktex = (url, srgbish, clamp) => { const t = new THREE.TextureLoader().load(url); t.wrapS = t.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.anisotropy = ANISO; return t; };
    const kitFrag = `uniform sampler2D tA; uniform sampler2D tE; uniform sampler2D tN; uniform float uEmi; uniform vec3 uFog; uniform float uD; uniform vec3 uHaze; uniform samplerCube uSky; uniform float time;
        varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vDepth; varying vec4 vInfo;
        vec3 accent(float k){ return k < 0.5 ? vec3(0.24,0.95,1.0) : k < 1.5 ? vec3(1.0,0.24,0.65) : k < 2.5 ? vec3(1.0,0.62,0.3) : vec3(0.6,0.36,1.0); }
        vec3 envRefl(vec3 R){ vec3 sky = textureCube(uSky, R, 5.0).rgb; vec3 city = mix(vec3(0.04,0.03,0.07), vec3(0.24,0.08,0.24), smoothstep(-0.5, 0.0, R.y)); return mix(city, sky, smoothstep(-0.02, 0.08, R.y)); }
        void main(){
          vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
          vec3 T = abs(N.y) < 0.5 ? normalize(cross(vec3(0.0,1.0,0.0), N)) : vec3(1.0,0.0,0.0);
          vec3 B = normalize(cross(N, T));
          vec3 nt = texture2D(tN, vUv).xyz*2.0 - 1.0;
          vec3 Np = normalize(T*nt.x + B*nt.y + N*max(nt.z, 0.2));
          vec3 alb = texture2D(tA, vUv).rgb; alb = alb*alb*1.15;
          vec3 acc = accent(floor(vInfo.x + 0.5));
          float up = Np.y*0.5 + 0.5;
          vec3 light = vec3(0.16,0.16,0.26)*(0.6 + 0.8*up) + vec3(0.4,0.14,0.36)*exp(-vW.y/30.0)*(1.0 - up*0.6) + acc*1.1*exp(-vW.y/9.0)*(1.0 - up);
          light += vec3(0.34,0.46,0.7)*max(dot(Np, normalize(vec3(0.55, 0.3, 0.78))), 0.0) + vec3(0.42,0.13,0.36)*max(dot(Np, normalize(vec3(-0.7, 0.1, -0.5))), 0.0);
          float fres = 0.04 + 0.96*pow(1.0 - clamp(dot(V, Np), 0.0, 1.0), 5.0);
          vec3 col = alb*light*1.5 + envRefl(reflect(-V, Np))*(0.05 + fres*0.35)*(0.4 + alb*2.0);
          vec3 e = texture2D(tE, vUv).rgb;
          col += e*e*uEmi*(1.0 + 0.25*sin(time*0.7 + vInfo.y));
          float fog = 1.0 - exp(-uD*uD*vDepth*vDepth);
          float hz = (1.0 - exp(-vDepth*0.009))*exp(-max(vW.y, 0.0)/48.0)*0.75;
          col = mix(col, uHaze, hz);
          gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
        }`;
    const kitVert = `attribute vec4 aInfo; uniform float uRep; varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vDepth; varying vec4 vInfo;
        void main(){ mat4 m = modelMatrix*instanceMatrix; vN = normalize(mat3(m)*normal); vInfo = aInfo;
          vUv = uv*uRep + vec2(fract(aInfo.y*0.137), fract(aInfo.y*0.311));
          vec4 w = m*vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix*w; vDepth = -mv.z; gl_Position = projectionMatrix*mv; }`;
    const kitMat = (set, rep, emi) => new THREE.ShaderMaterial({
      uniforms:{ tA:{value:set.a}, tE:{value:set.e}, tN:{value:set.n}, uRep:{value:rep}, uEmi:{value:emi}, uFog:{value:FOG}, uD:{value:FOG_D}, uHaze:{value:HAZE}, uSky:FACADE_U.uSky, time:U.time },
      vertexShader:kitVert, fragmentShader:kitFrag });
    // LED screens: one atlas for every billboard, poster and sign
    const ledMat = () => new THREE.ShaderMaterial({
      uniforms:{ map:{value:KT.atlas}, time:U.time, uFog:{value:FOG}, uD:{value:FOG_D} },
      extensions:{derivatives:true},
      vertexShader:`attribute vec4 aInfo; varying vec2 vUv; varying float vDepth; varying float vSeed; void main(){ vUv = uv; vSeed = aInfo.y; mat4 m = modelMatrix*instanceMatrix; vec4 mv = viewMatrix*m*vec4(position,1.0); vDepth = -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader:`uniform sampler2D map; uniform float time; uniform vec3 uFog; uniform float uD; varying vec2 vUv; varying float vDepth; varying float vSeed;
        void main(){
          vec3 c = texture2D(map, vUv).rgb;
          // LED pixel grid that fades out before it could shimmer, plus a slow refresh sweep
          vec2 px = vUv*vec2(2048.0, 2048.0)/3.0; vec2 fw = fwidth(px);
          vec2 gp = abs(fract(px) - 0.5);
          float grid = mix(1.0 - 0.35*smoothstep(0.32, 0.5, max(gp.x, gp.y)), 0.88, smoothstep(0.3, 0.8, max(fw.x, fw.y)));
          float sweep = 1.0 + 0.18*exp(-pow(fract(vUv.y*1.5 - time*0.15 + vSeed*0.37) - 0.5, 2.0)*120.0);
          c = min(c*0.8*grid*sweep, vec3(0.9));
          float fog = 1.0 - exp(-uD*uD*vDepth*vDepth);
          gl_FragColor = vec4(mix(c, uFog, fog*0.9), 1.0);
        }` });
    let ledShared = null;

    // copy any (quantized, interleaved) attribute into plain floats and bake the node transform
    const flat = (geo, mtx, keep) => {
      const g = new THREE.BufferGeometry();
      for(const k of keep){
        const a = geo.attributes[k]; if(!a) continue;
        const out = new Float32Array(a.count*a.itemSize);
        for(let i=0;i<a.count;i++){ out[i*a.itemSize] = a.getX(i); if(a.itemSize > 1) out[i*a.itemSize+1] = a.getY(i); if(a.itemSize > 2) out[i*a.itemSize+2] = a.getZ(i); if(a.itemSize > 3) out[i*a.itemSize+3] = a.getW(i); }
        g.setAttribute(k === 'uv2' ? 'aFace' : k, new THREE.BufferAttribute(out, a.itemSize));
      }
      g.setIndex(geo.index ? new THREE.BufferAttribute(Uint32Array.from(geo.index.array), 1) : null);
      if(!g.index) g.setIndex(Array.from({length: g.attributes.position.count}, (_,i)=>i));
      g.applyMatrix4(mtx);
      return g;
    };
    const vcol = (g, name, arr) => { const n = g.attributes.position.count, k = arr.length, out = new Float32Array(n*k); for(let i=0;i<n;i++) out.set(arr, i*k); g.setAttribute(name, new THREE.BufferAttribute(out, k)); return g; };
    const merge = gs => gs.length === 1 ? gs[0] : THREE.BufferGeometryUtils.mergeBufferGeometries(gs);
    const dm = new THREE.Object3D();
    let tris = 0, draws = 0;
    const instance = (root, list) => {
      root.updateMatrixWorld(true);
      const fac = {}, dress = [], glow = [], screens = [], kit = {}, leds = [];
      root.traverse(o=>{
        if(!o.isMesh) return;
        const m = o.material, name = m.name || '';
        if(FT[name] !== undefined){ (fac[name] = fac[name] || []).push(flat(o.geometry, o.matrixWorld, ['position','normal','uv','uv2'])); }
        else if(name.startsWith('kit_')) (kit[name] = kit[name] || []).push(flat(o.geometry, o.matrixWorld, ['position','normal','uv']));
        else if(name === 'screen_atlas') leds.push(flat(o.geometry, o.matrixWorld, ['position','normal','uv']));
        else if(name.startsWith('screen')) screens.push({ g: flat(o.geometry, o.matrixWorld, ['position','normal','uv']), map: m.emissiveMap });
        else if(/^(neon|light|water)/.test(name)){
          const c = m.emissive.clone().convertLinearToSRGB().multiplyScalar(Math.min(1.2, (m.emissiveIntensity || 1)/3.6));
          glow.push(vcol(flat(o.geometry, o.matrixWorld, ['position','normal']), 'color', [c.r, c.g, c.b]));
        } else {
          const c = m.color.clone().convertLinearToSRGB();
          const kind = m.metalness > 0.5 && m.roughness < 0.2 ? 2 : m.metalness > 0.5 ? 1 : 0;
          dress.push(vcol(flat(o.geometry, o.matrixWorld, ['position','normal']), 'aCol', [c.r, c.g, c.b, kind]));
        }
      });
      const info = new Float32Array(list.length*4);
      list.forEach((p,i)=>info.set([p.acc, p.sid, BMETA[p.id].h*p.sy, 0], i*4));
      const make = (geo, mat, order) => {
        geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4));
        const im = new THREE.InstancedMesh(geo, mat, list.length); im.frustumCulled = false;
        if(order) im.renderOrder = order;
        list.forEach((p,i)=>{ dm.position.set(p.x, 0, p.z); dm.rotation.set(0, p.rot*Math.PI/2, 0); dm.scale.set(1, p.sy, 1); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); });
        scene.add(im); draws++; tris += geo.index.count/3*list.length;
        return im;
      };
      Object.entries(fac).forEach(([k, gs])=>make(merge(gs), facadeMat[k]));
      Object.entries(kit).forEach(([k, gs])=>{ const mat = KT.mats && KT.mats[k]; if(mat) make(merge(gs), mat); });
      if(leds.length && KT.atlas){ ledShared = ledShared || ledMat(); make(merge(leds), ledShared, 3); }
      if(dress.length) make(merge(dress), dressMat);
      if(glow.length) make(merge(glow), glowMat);
      // every ad screen on the towers is a hologram
      screens.forEach(s=>{ if(!s.map) return; s.map.colorSpace = THREE.NoColorSpace; s.map.anisotropy = ANISO; s.map.needsUpdate = true; make(s.g, holoMat(s.map), 4); });
    };
    const parse = parseGLB;
    const loadKit = fetch(ASSETS + 'kit/kittex.json').then(r=>r.ok ? r.json() : null).then(j=>{
      if(j) j = JSON.parse(JSON.stringify(j).replace(/"([a-z_]+\.jpg)"/g, (m, f)=>JSON.stringify(ASSETS + 'kit/' + f)));
      if(!j) return;
      const set = o => ({ a: ktex(o.a), e: ktex(o.e), n: ktex(o.n) });
      const D = set(j.dark), Mi = set(j.mid), G = set(j.grey), Hx = set(j.hex);
      KT.atlas = ktex(j.atlas, true, true);
      KT.mats = { kit_dark: kitMat(D, 1/8, 2.6), kit_mid: kitMat(Mi, 1/8, 2.2), kit_grey: kitMat(G, 1/8, 2.0), kit_hex: kitMat(Hx, 1/3, 2.2) };
    }).catch(e=>console.warn('kit textures', e));
    return Promise.all([GLBLIB(), loadKit]).then(async ([lib])=>{
      for(const id of Object.keys(lib)){
        const list = PLACE.filter(p=>p.id === id);
        if(!list.length) continue;
        instance(await parse(lib[id]), list);
      }
      {
        const pts = [];
        PLACE.forEach(p=>{
          if(p.id.startsWith('k_')) return;
          const m = BMETA[p.id], top = m.h*p.sy, c = p.rot % 2 ? [7.5, 16.5] : [16.5, 7.5];
          const hw = BLD.find(b=>b.x === p.x && b.z === p.z) || {w:15, d:15};
          const ex = hw.w/2 + .15, ez = hw.d/2 + .15;
          [[1,1],[-1,1],[1,-1],[-1,-1]].forEach(([a,b],k)=>{
            pts.push([p.x + a*ex, top + .4, p.z + b*ez]);
            if(top > 60 && k < 2) for(let y = 40; y < top - 10; y += 38 + (p.sid % 3)*6) pts.push([p.x + a*ex, y, p.z + b*ez]);
          });
        });
        const red = new THREE.InstancedMesh(new THREE.SphereGeometry(.3, 8, 6), BM(0xff2a34), pts.length);
        pts.forEach(([x,y,z],i)=>{ dm.position.set(x,y,z); dm.rotation.set(0,0,0); dm.scale.set(1,1,1); dm.updateMatrix(); red.setMatrixAt(i, dm.matrix); });
        red.frustumCulled = false; scene.add(red);
      }
      console.log('buildings', PLACE.length, 'instances,', draws, 'draws,', Math.round(tris/1000) + 'k tris');
    });
  }

  /* ================= Street canyons: cables, lantern strings, sky bridges; elevated monorail ================= */
  let monorail = () => {};
  function buildCityExtras(){
    const merge = gs => THREE.BufferGeometryUtils.mergeBufferGeometries(gs.map(g => g.index ? g.toNonIndexed() : g).map(g => { for(const k of Object.keys(g.attributes)) if(!['position','normal'].includes(k)) g.deleteAttribute(k); return g; }));
    const cableGs = [], beads = [], bridges = [];
    const dm = new THREE.Object3D();
    const span = (A, B, axis) => {
      // A, B: solids on opposite sides of a street; axis 'x' = street runs along z
      const topMin = Math.min(A.top, B.top);
      if(topMin < 10) return;
      const faceA = axis === 'x' ? A.x + A.hw : A.z + A.hd, faceB = axis === 'x' ? B.x - B.hw : B.z - B.hd;
      const alongA = axis === 'x' ? A.z : A.x, ext = Math.min(axis === 'x' ? A.hd : A.hw, axis === 'x' ? B.hd : B.hw)*0.8;
      const r = rnd();
      if(r < .34){
        const n = 1 + Math.floor(rnd()*3);
        for(let k=0;k<n;k++){
          const al = alongA + (rnd()-.5)*2*ext, y = 6 + rnd()*Math.min(28, topMin - 8), sag = .5 + rnd()*1.5;
          const pts = [];
          for(let s=0;s<=14;s++){ const u = s/14, c = faceA - .3 + (faceB - faceA + .6)*u, yy = y - sag*4*u*(1-u); pts.push(axis === 'x' ? new THREE.Vector3(c, yy, al + (rnd()-.5)*.02) : new THREE.Vector3(al, yy, c)); }
          cableGs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, .03, 3, false));
          if(rnd() < .35){
            const hue = pick([0xff3a50, 0xffa02a, 0xff3ea5, 0x3ef2ff]);
            for(let s=1;s<14;s++){ const p = pts[s]; beads.push([p.x, p.y - .12, p.z, hue]); }
          }
        }
      } else if(r < .44 && topMin > 36){
        const al = alongA + (rnd()-.5)*ext, y = 18 + rnd()*Math.min(40, topMin - 26);
        bridges.push({ x: axis === 'x' ? (faceA + faceB)/2 : al, z: axis === 'x' ? al : (faceA + faceB)/2, y, len: Math.abs(faceB - faceA) + .6, axis, c: pick([0x3ef2ff,0xff3ea5,0xffc46b]) });
      }
    };
    for(let k=-5;k<=5;k++) for(let j=-29;j<=29;j++){
      if(j%5===0) continue;
      let A = SOLID.get((5*k-1)+','+j), B = SOLID.get((5*k+1)+','+j);
      if(A && B) span(A, B, 'x');
      A = SOLID.get(j+','+(5*k-1)); B = SOLID.get(j+','+(5*k+1));
      if(A && B) span(A, B, 'z');
    }
    if(cableGs.length){ const m = new THREE.Mesh(merge(cableGs), new THREE.MeshBasicMaterial({color:0x07050c})); scene.add(m); }
    if(beads.length){
      const m = new THREE.InstancedMesh(new THREE.SphereGeometry(.13, 8, 6), BM(0xffffff), beads.length);
      beads.forEach(([x,y,z,c],i)=>{ dm.position.set(x,y,z); dm.updateMatrix(); m.setMatrixAt(i, dm.matrix); m.setColorAt(i, col.setHex(c)); });
      m.frustumCulled = false; scene.add(m);
    }
    if(bridges.length){
      const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({color:0x15111f, metalness:.6, roughness:.45}), bridges.length);
      const band = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), BM(0xffffff), bridges.length);
      bridges.forEach((b,i)=>{
        const sx = b.axis === 'x' ? b.len : 3.2, sz = b.axis === 'x' ? 3.2 : b.len;
        dm.position.set(b.x, b.y, b.z); dm.scale.set(sx, 2.8, sz); dm.updateMatrix(); body.setMatrixAt(i, dm.matrix);
        dm.scale.set(b.axis === 'x' ? b.len - .4 : 3.26, .55, b.axis === 'x' ? 3.26 : b.len - .4); dm.position.y = b.y + .25; dm.updateMatrix(); band.setMatrixAt(i, dm.matrix);
        band.setColorAt(i, col.setHex(b.c).multiplyScalar(.75));
      });
      body.frustumCulled = band.frustumCulled = false; scene.add(body, band);
    }

    /* monorail: a rounded loop over the avenues with a lit train */
    const Y = MONO.Y, X0 = MONO.X0, Z0 = MONO.Z0, RC = MONO.R;
    // dense points along straight runs and true circular corners, so the curve has no bulges and arc length is even
    const pts = [];
    const corner = (cx, cz, a0) => { for(let i=0;i<=30;i++){ const a = a0 + (Math.PI/2)*i/30; pts.push(new THREE.Vector3(cx + Math.cos(a)*RC, Y, cz + Math.sin(a)*RC)); } };
    const straight = (ax, az, bx, bz) => { const n = Math.ceil(Math.hypot(bx-ax, bz-az)/3); for(let i=1;i<n;i++) pts.push(new THREE.Vector3(ax + (bx-ax)*i/n, Y, az + (bz-az)*i/n)); };
    corner( X0-RC,  Z0-RC, 0);            straight( X0-RC, Z0,  -X0+RC,  Z0);
    corner(-X0+RC,  Z0-RC, Math.PI/2);    straight(-X0, Z0-RC, -X0, -Z0+RC);
    corner(-X0+RC, -Z0+RC, Math.PI);      straight(-X0+RC, -Z0,  X0-RC, -Z0);
    corner( X0-RC, -Z0+RC, Math.PI*1.5);  straight( X0, -Z0+RC,  X0,  Z0-RC);
    const path = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    path.arcLengthDivisions = 3000;
    const L = path.getLength();
    const beamShape = new THREE.Shape(); beamShape.moveTo(-.7,-.35); beamShape.lineTo(.7,-.35); beamShape.lineTo(.7,.35); beamShape.lineTo(-.7,.35); beamShape.lineTo(-.7,-.35);
    const beam = new THREE.Mesh(new THREE.ExtrudeGeometry(beamShape, { steps: 900, extrudePath: path, bevelEnabled: false }), new THREE.MeshStandardMaterial({color:0x221c30, metalness:.75, roughness:.35}));
    scene.add(beam);
    const off = (d, dy) => new THREE.CatmullRomCurve3(Array.from({length:240}, (_,i)=>{ const u = i/240, p = path.getPointAt(u), t = path.getTangentAt(u); return p.add(new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(d)).add(new THREE.Vector3(0, dy, 0)); }), true);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(off( .72, .2), 480, .045, 4, true), BM(0x3ef2ff)));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(off(-.72, .2), 480, .045, 4, true), BM(0xff3ea5)));
    const nP = Math.floor(L/22.5);
    const pil = new THREE.InstancedMesh(new THREE.CylinderGeometry(.45,.6,1,12).translate(0,.5,0), new THREE.MeshStandardMaterial({color:0x1b1626, metalness:.7, roughness:.4}), nP);
    const cap = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2,.5,2.2), new THREE.MeshStandardMaterial({color:0x1b1626, metalness:.7, roughness:.4}), nP);
    for(let i=0;i<nP;i++){ const p = path.getPointAt(i/nP); dm.position.set(p.x, 0, p.z); dm.scale.set(1, Y - .5, 1); dm.updateMatrix(); pil.setMatrixAt(i, dm.matrix); dm.position.y = Y - .6; dm.scale.set(1,1,1); dm.updateMatrix(); cap.setMatrixAt(i, dm.matrix); }
    pil.frustumCulled = cap.frustumCulled = false; scene.add(pil, cap);
    // train: GLB maglev cars. Each car rides on two bogies on the beam; the body follows the chord between them,
    // gangways line up and the train banks a little in the curves.
    const consist = ['train_head', 'train_mid', 'train_mid', 'train_mid', 'train_head'];
    const LEN = { train_head: 14, train_mid: 13 }, GAP = .5;
    const train = [];
    Promise.all([loadModel('train_head'), loadModel('train_mid')]).then(([headM, midM])=>{
      consist.forEach((id, i)=>{
        const g = (id === 'train_head' ? headM : midM).clone();
        const tail = i === consist.length - 1;
        const holder = new THREE.Group(); holder.add(g);
        if(tail) g.rotation.y = Math.PI;             // the last car is a head car facing backwards
        // the nose marker reads white at the front and red at the back
        g.traverse(o=>{ if(o.isMesh && o.material.name === 'light_tail'){ o.material = o.material.clone(); o.material.emissive.setHex(tail ? 0xff2a3c : 0xf2f8ff); } });
        scene.add(holder); train.push({ g: holder, len: LEN[id] });
      });
    }).catch(e=>console.warn('train', e));
    const tp = new THREE.Vector3(), pa = new THREE.Vector3(), pb = new THREE.Vector3(), ta = new THREE.Vector3(), tb = new THREE.Vector3();
    const at = (s, out) => path.getPointAt((((s % L) + L) % L)/L, out);
    const tan = (s, out) => path.getTangentAt((((s % L) + L) % L)/L, out);
    monorail = t => {
      if(!train.length) return;
      let s = t*14;                                    // arc position of the front of the train
      train.forEach(c=>{
        const mid = s - c.len/2, half = c.len*.36;     // bogies sit at 36% of the length from the centre
        at(mid + half, pa); at(mid - half, pb);
        c.g.position.set((pa.x + pb.x)/2, Y + .35, (pa.z + pb.z)/2);
        const yaw = Math.atan2(pa.x - pb.x, pa.z - pb.z);
        tan(mid + half, ta); tan(mid - half, tb);
        const turn = Math.atan2(ta.x*tb.z - ta.z*tb.x, ta.x*tb.x + ta.z*tb.z);   // how much the track turns under this car
        c.g.rotation.set(0, yaw, -turn*.12, 'YXZ');
        s -= c.len + GAP;
      });
    };
  }

  /* ================= Hologram material for every sign ================= */
  function holoMat(map){
    return new THREE.ShaderMaterial({
      uniforms:{ map:{value:map}, time:U.time, uD:{value:FOG_D}, off:{value:0} },
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
      extensions:{derivatives:true},
      vertexShader:`varying vec2 vUv; varying float vDepth; varying float vFacing;
        void main(){ vUv = uv;
          #ifdef USE_INSTANCING
            mat4 m = modelMatrix*instanceMatrix;
          #else
            mat4 m = modelMatrix;
          #endif
          vec4 w = m*vec4(position,1.0);
          vec3 n = normalize(mat3(m)*vec3(0.0,0.0,1.0));
          vFacing = abs(dot(n, normalize(cameraPosition - w.xyz)));
          vec4 mv = viewMatrix*w; vDepth = -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader:`uniform sampler2D map; uniform float time; uniform float uD; uniform float off; varying vec2 vUv; varying float vDepth; varying float vFacing;
        void main(){
          vec3 c = texture2D(map, vec2(vUv.x + off, vUv.y)).rgb;
          float lum = dot(c, vec3(.3,.59,.11));
          vec3 col = c*(0.14 + 0.72*smoothstep(0.06, 0.55, lum));
          // scanlines: fade to their average where they get smaller than a pixel
          float sl = vUv.y*110.0; float w = fwidth(sl);
          float scan = 0.8 + 0.2*smoothstep(0.15, 0.85, abs(fract(sl - time*0.4) - 0.5)*2.0);
          col *= mix(scan, 0.9, smoothstep(0.25, 0.9, w));
          // slow light sweep and a projected frame
          col *= 1.0 + exp(-pow((fract(vUv.y*0.6 - time*0.06) - 0.5)*10.0, 2.0))*0.22;
          vec2 e = min(vUv, 1.0 - vUv); float ew = max(fwidth(vUv.x), fwidth(vUv.y))*1.5;
          col += vec3(0.24,0.95,1.0)*(1.0 - smoothstep(0.012, 0.012 + ew, min(e.x, e.y)))*0.45;
          col += vec3(0.02,0.05,0.07);
          float fog = 1.0 - exp(-uD*uD*vDepth*vDepth);
          // seen almost edge-on the text would alias: let the projection fade out instead
          col *= smoothstep(0.1, 0.35, vFacing);
          gl_FragColor = vec4(col*(1.0 - fog)*0.95, 1.0);
        }`
    });
  }
  const EMIT = [];

  /* ================= Billboards ================= */
  const FJP = '"Noto Sans JP","Hiragino Sans","Yu Gothic","Meiryo",sans-serif';
  const FD = 'Unbounded, "Arial Black", sans-serif', FB = '"Golos Text", system-ui, sans-serif', FM = '"IBM Plex Mono", monospace';
  function canvasTex(w,h,draw,repeat){
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); draw(x,w,h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = ANISO;
    if(repeat){ t.wrapS = THREE.RepeatWrapping; }
    return t;
  }
  const glowText = (x, txt, px, py, font, fill, glow, blur=18) => { x.font = font; x.fillStyle = fill; x.shadowColor = glow; x.shadowBlur = blur; x.fillText(txt, px, py); x.shadowBlur = 0; };
  const lin = (x,x0,y0,x1,y1,stops) => { const g = x.createLinearGradient(x0,y0,x1,y1); stops.forEach((s,i)=>g.addColorStop(i/(stops.length-1), s)); return g; };
  const AD = {
    synth: (x,w,h)=>{ x.fillStyle = lin(x,0,0,w,h,['#14042a','#4a0a42','#7a0f4f']); x.fillRect(0,0,w,h);
      for(let r=40;r<260;r+=26){ x.strokeStyle=`rgba(62,242,255,${0.65-r/420})`; x.lineWidth=3; x.beginPath(); x.arc(790,256,r,0,Math.PI*2); x.stroke(); }
      x.strokeStyle='#ffffff'; x.lineWidth=5; x.beginPath(); x.ellipse(790,256,110,46,0,0,Math.PI*2); x.stroke();
      x.fillStyle='#3ef2ff'; x.beginPath(); x.arc(790,256,30,0,Math.PI*2); x.fill(); x.fillStyle='#07030f'; x.beginPath(); x.arc(790,256,12,0,Math.PI*2); x.fill();
      glowText(x,'СИНТЕКС',56,200,`800 104px ${FD}`,'#ffffff','#ff3ea5',24);
      x.font=`500 34px ${FB}`; x.fillStyle='#ffd1ee'; x.fillText('память, которая не стареет',60,262);
      x.font=`500 22px ${FM}`; x.fillStyle='#3ef2ff'; x.fillText('ИМПЛАНТЫ НЕЙРОСВЯЗИ · КЛИНИКА 24/7',60,440); },
    orbit: (x,w,h)=>{ x.fillStyle = lin(x,0,0,0,h,['#020a1e','#06264a','#0c4766']); x.fillRect(0,0,w,h);
      const g = x.createRadialGradient(820,560,40,820,560,330); g.addColorStop(0,'#ffd08a'); g.addColorStop(.55,'#b0563a'); g.addColorStop(1,'rgba(40,10,40,0)');
      x.fillStyle=g; x.beginPath(); x.arc(820,560,300,0,Math.PI*2); x.fill();
      x.strokeStyle='#ffc46b'; x.lineWidth=5; x.beginPath(); x.ellipse(820,520,380,70,-.2,0,Math.PI*2); x.stroke();
      glowText(x,'ОРБИТА',56,190,`800 118px ${FD}`,'#ffc46b','#ff8a3c',22);
      x.font=`500 34px ${FB}`; x.fillStyle='#e9f6ff'; x.fillText('рейсы на Кольцо каждые 15 минут',60,252);
      x.font=`500 22px ${FM}`; x.fillStyle='#8fe9ff'; x.fillText('ТЕРМИНАЛ S-27 · ПОСАДКА ОТКРЫТА',60,450); },
    nocturne: (x,w,h)=>{ x.fillStyle='#06020c'; x.fillRect(0,0,w,h);
      for(let i=0;i<64;i++){ const bh = 30 + Math.abs(Math.sin(i*0.55)*Math.cos(i*0.17))*170; x.fillStyle = lin(x,0,h,0,h-200,['#ff3ea5','#3ef2ff']); x.fillRect(16+i*15.7, h-30-bh, 9, bh); }
      glowText(x,'НОКТЮРН',56,170,`800 120px ${FD}`,'#ffffff','#ff3ea5',28);
      x.font=`500 34px ${FB}`; x.fillStyle='#3ef2ff'; x.fillText('darkwave радио · 88.3 FM',60,232); },
    garden: (x,w,h)=>{ x.fillStyle = lin(x,0,0,w,h,['#021710','#063a22','#0b4a2a']); x.fillRect(0,0,w,h);
      x.strokeStyle='#5dff9e'; x.lineWidth=4;
      for(let i=0;i<9;i++){ x.save(); x.translate(700+ (i%3)*95, 120+Math.floor(i/3)*120); x.rotate(-.6+i*.25); x.beginPath(); x.ellipse(0,0,70,26,0,0,Math.PI*2); x.stroke(); x.beginPath(); x.moveTo(-70,0); x.lineTo(70,0); x.stroke(); x.restore(); }
      glowText(x,'КИБЕРСАД',56,190,`800 104px ${FD}`,'#d6ffe3','#2bff86',20);
      x.font=`500 34px ${FB}`; x.fillStyle='#b8ffcf'; x.fillText('свежая зелень со 140-го этажа',60,252);
      x.font=`500 22px ${FM}`; x.fillStyle='#5dff9e'; x.fillText('ВЕРТИКАЛЬНЫЕ ФЕРМЫ · СЕКТОР S-14',60,450); },
    taxi: (x,w,h)=>{ x.fillStyle='#ffbf1f'; x.fillRect(0,0,w,h);
      x.fillStyle='#14100a'; for(let i=0;i<4;i++){ x.beginPath(); const ox=690+i*80; x.moveTo(ox,150); x.lineTo(ox+50,256); x.lineTo(ox,362); x.lineTo(ox+28,362); x.lineTo(ox+78,256); x.lineTo(ox+28,150); x.fill(); }
      x.font=`800 128px ${FD}`; x.fillStyle='#14100a'; x.fillText('ВЕКТОР',50,210);
      x.font=`600 34px ${FB}`; x.fillText('аэротакси · 3 минуты до любой крыши',56,276);
      x.font=`500 22px ${FM}`; x.fillText('ВЫЗОВ: ТАПНИ ПО НЕБУ',56,450); },
    neo: (x,w,h)=>{ x.fillStyle = lin(x,0,0,w,0,['#c4002f','#6a0020']); x.fillRect(0,0,w,h);
      x.fillStyle='rgba(255,255,255,.08)'; for(let i=0;i<h;i+=8) x.fillRect(0,i,w,2);
      glowText(x,'ネオ・エデン',50,200,`700 120px ${FJP}`,'#ffffff','#ff98b0',20);
      x.font=`700 64px ${FJP}`; x.fillStyle='#ffd1d9'; x.fillText('未来はここ',56,300);
      x.font=`500 24px ${FM}`; x.fillStyle='#ffe3ea'; x.fillText('CYBERIUS · БУДУЩЕЕ УЖЕ ЗДЕСЬ',56,450); },
  };
  const vstack = (x, chars, cx, y0, step, font, fill, glow) => { x.textAlign='center'; chars.forEach((c,i)=>glowText(x,c,cx,y0+i*step,font,fill,glow,22)); x.textAlign='left'; };
  const VAD = {
    ramen: (x,w,h)=>{ x.fillStyle='#a8001a'; x.fillRect(0,0,w,h); x.strokeStyle='#ffd1d1'; x.lineWidth=6; x.strokeRect(10,10,w-20,h-20);
      vstack(x,['ラ','ー','メ','ン'],w/2,170,170,`700 150px ${FJP}`,'#ffffff','#ff8a8a');
      x.textAlign='center'; x.font=`800 34px ${FD}`; x.fillStyle='#ffe0a0'; x.fillText('ЛАПША',w/2,900); x.font=`500 26px ${FM}`; x.fillText('24/7',w/2,950); x.textAlign='left'; },
    dream: (x,w,h)=>{ x.fillStyle = lin(x,0,0,0,h,['#120a3a','#2a0e5a']); x.fillRect(0,0,w,h);
      vstack(x,['夢'],w/2,250,0,`700 210px ${FJP}`,'#c9b8ff','#9b5bff');
      vstack(x,['С','О','Н'],w/2,420,90,`800 76px ${FD}`,'#ffffff','#9b5bff');
      x.textAlign='center'; x.font=`500 26px ${FM}`; x.fillStyle='#c9b8ff'; x.fillText('КАПСУЛЫ',w/2,760); x.fillText('ОТ 2 ЧАСОВ',w/2,800); x.textAlign='left'; },
    hotel: (x,w,h)=>{ x.fillStyle='#03161f'; x.fillRect(0,0,w,h);
      vstack(x,['О','Т','Е','Л','Ь'],w/2,170,170,`800 130px ${FD}`,'#3ef2ff','#3ef2ff');
      x.textAlign='center'; x.font=`500 40px ${FB}`; x.fillStyle='#ffc46b'; x.fillText('★★★★',w/2,990); x.textAlign='left'; },
    bar: (x,w,h)=>{ x.fillStyle='#1c0016'; x.fillRect(0,0,w,h);
      vstack(x,['バ','ー'],w/2,190,180,`700 170px ${FJP}`,'#ff3ea5','#ff3ea5');
      vstack(x,['Б','А','Р'],w/2,560,110,`800 92px ${FD}`,'#ffffff','#ff3ea5');
      x.textAlign='center'; x.font=`800 60px ${FD}`; x.fillStyle='#ffc46b'; x.fillText('24',w/2,960); x.textAlign='left'; },
  };
  function buildBillboards(){
    const hTex = Object.values(AD).map(f=>canvasTex(1024,512,f));
    const vTex = Object.values(VAD).map(f=>canvasTex(256,1024,f));
    const slots = hTex.map(()=>[]).concat(vTex.map(()=>[]));
    const dm = new THREE.Object3D();
    const faces = [[1,0,Math.PI/2],[-1,0,-Math.PI/2],[0,1,0],[0,-1,Math.PI]];
    const cams = Object.values(LOC).map(l=>[l.cam[0], l.cam[2]]);
    // never hang a sign between a location's camera and its landmark
    const blocksView = (x, z, bw) => Object.values(LOC).some(l=>{
      const ax = l.cam[0], az = l.cam[2], bx = l.obj[0], bz = l.obj[2], dx = bx-ax, dz = bz-az, L2 = dx*dx + dz*dz;
      const t = ((x-ax)*dx + (z-az)*dz)/L2; if(t < .1 || t > 1.05) return false;
      return Math.hypot(x - (ax + dx*t), z - (az + dz*t)) < 9 + bw/2 + 14*t;
    });
    const pushSign = (slot, x, y, z, ry, bw, bh) => { if(blocksView(x, z, bw)) return; dm.position.set(x,y,z); dm.rotation.set(0,ry,0); dm.scale.set(bw,bh,1); dm.updateMatrix(); slots[slot].push(dm.matrix.clone()); EMIT.push({x, y:y-bh/2-.2, z, ry, bw}); };
    const roadSide = (b,[fx,fz]) => { const c = fx ? b.x + fx*b.w/2 : b.z + fz*b.d/2, m = ((c % 45) + 45) % 45; return Math.min(m, 45 - m) < 8; };
    BLD.forEach(b=>{
      if(b.h < 20 || b.noSign) return;
      if(rnd() > (b.h>45 ? .85 : b.h>30 ? .6 : .35)) return;
      let face;
      if(rnd() < .7){ // face the nearest viewpoint, so signs are seen
        let best = cams[0], bd = 1e9; cams.forEach(c=>{ const d = Math.hypot(c[0]-b.x, c[1]-b.z); if(d<bd){ bd=d; best=c; } });
        const vx = best[0]-b.x, vz = best[1]-b.z;
        face = Math.abs(vx) > Math.abs(vz) ? (vx>0?faces[0]:faces[1]) : (vz>0?faces[2]:faces[3]);
      } else face = pick(faces);
      const [fx,fz,ry] = face;
      const fw = fx ? b.d : b.w;
      const horiz = rnd() < (b.h>45 ? .6 : .45);
      if(horiz){
        const big = b.h > 40 && roadSide(b,face) && rnd() < .6;
        const bw = big ? 11 + rnd()*7 : fw*(1.0+rnd()*.3), bh = bw/2;
        const out = big ? 2.4 : .6;
        const y = Math.min(b.h - bh/2 - 1.5, b.h*(.5+rnd()*.3));
        if(y - bh/2 < 4) return;
        pushSign(Math.floor(rnd()*hTex.length), b.x + fx*(b.w/2+out), y, b.z + fz*(b.d/2+out), ry, bw, bh);
      } else {
        const bw = 2.2 + rnd()*1.2, bh = bw*4, side = (rnd()<.5?-1:1)*Math.max(0, fw/2 - bw/2 - .2);
        const y = Math.min(b.h - bh/2 - 1, b.h*(.4+rnd()*.3));
        if(y - bh/2 < 3) return;
        pushSign(hTex.length + Math.floor(rnd()*vTex.length), b.x + fx*(b.w/2+.6) + (fz?side:0), y, b.z + fz*(b.d/2+.6) + (fx?side:0), ry, bw, bh);
      }
    });
    // small signs at street level: blade signs sticking out over the sidewalk and flat shop signs
    BLD.forEach(b=>{
      if(b.h < 9 || rnd() > .6) return;
      const opts = faces.filter(f=>roadSide(b,f)); if(!opts.length) return;
      const [fx,fz,ry] = pick(opts), fw = fx ? b.d : b.w;
      const n = 1 + (rnd() < .45 ? 1 : 0);
      for(let k=0;k<n;k++){
        const side = (rnd()-.5)*Math.max(0, fw-2);
        if(rnd() < .6){
          const bw = 1.0 + rnd()*.5, bh = bw*4, y = 3.8 + bh/2 + rnd()*5;
          if(y + bh/2 > b.h - .5) continue;
          const out = b.w/2*Math.abs(fx) + b.d/2*Math.abs(fz) + bw/2 + .25;
          pushSign(hTex.length + Math.floor(rnd()*vTex.length), b.x + fx*out + (fz?side:0), y, b.z + fz*out + (fx?side:0), ry + Math.PI/2, bw, bh);
        } else {
          const bw = 2.4 + rnd()*1.8, bh = bw/2, y = 4.2 + bh/2 + rnd()*4;
          if(y + bh/2 > b.h - .5) continue;
          pushSign(Math.floor(rnd()*hTex.length), b.x + fx*(b.w/2+.45) + (fz?side:0), y, b.z + fz*(b.d/2+.45) + (fx?side:0), ry, bw, bh);
        }
      }
    });
    // hero billboards: big signs placed inside each viewpoint's frame
    Object.values(LOC).forEach(l=>{
      const vx = l.look[0]-l.cam[0], vz = l.look[2]-l.cam[2], va = Math.atan2(vx, vz);
      const cand = BLD.filter(b=>{
        if(b.h < 26 || b.noSign) return false;
        const dx = b.x-l.cam[0], dz = b.z-l.cam[2], d = Math.hypot(dx,dz);
        let da = Math.atan2(dx,dz) - va; da = Math.atan2(Math.sin(da), Math.cos(da));
        b._s = Math.abs(da); b._d = d; b._side = Math.sign(da);
        return d > 30 && d < 150 && Math.abs(da) < .5;
      }).sort((a,b)=>a._d-b._d);
      const used = {}; let placed = 0;
      for(const b of cand){
        if(placed >= 4) break;
        const key = b._side + ':' + Math.floor(b._d/30); if(used[key]) continue; used[key] = 1;
        const tx = l.cam[0]-b.x, tz = l.cam[2]-b.z;
        const [fx,fz,ry] = Math.abs(tx) > Math.abs(tz) ? (tx>0?faces[0]:faces[1]) : (tz>0?faces[2]:faces[3]);
        const vertical = placed % 2 === 1;
        const bw = vertical ? 3.4 : 13 + rnd()*5, bh = vertical ? 13.6 : bw/2;
        const y = Math.max(bh/2 + 4, Math.min(b.h - bh/2 - 1, l.look[1] + (rnd()-.3)*12));
        if(y + bh/2 > b.h) continue;
        const out = vertical ? .7 : 1.8;
        pushSign(vertical ? hTex.length + Math.floor(rnd()*vTex.length) : Math.floor(rnd()*hTex.length), b.x + fx*(b.w/2+out), y, b.z + fz*(b.d/2+out), ry, bw, bh);
        placed++;
      }
    });
    const plane = new THREE.PlaneGeometry(1,1);
    const all = hTex.concat(vTex);
    slots.forEach((list,i)=>{
      if(!list.length) return;
      const m = new THREE.InstancedMesh(plane, holoMat(all[i]), list.length); m.frustumCulled = false; m.renderOrder = 4;
      list.forEach((mx,k)=>m.setMatrixAt(k,mx));
      scene.add(m);
    });
    // projector bars under each hologram
    const housing = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), MAT.dark, EMIT.length);
    const lens = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), BM(0x3ef2ff), EMIT.length);
    housing.frustumCulled = lens.frustumCulled = false;
    EMIT.forEach((e,i)=>{
      dm.position.set(e.x, e.y, e.z); dm.rotation.set(0,e.ry,0); dm.scale.set(e.bw*.9, .24, .45); dm.updateMatrix(); housing.setMatrixAt(i, dm.matrix);
      dm.position.y = e.y + .13; dm.scale.set(e.bw*.86, .05, .08); dm.updateMatrix(); lens.setMatrixAt(i, dm.matrix);
    });
    scene.add(housing, lens);
    return all;
  }

  /* ================= Landmarks ================= */
  const lineMat = (hex,op=1) => new THREE.LineBasicMaterial({color:hex, transparent:op<1, opacity:op});
  const metal = new THREE.MeshStandardMaterial({color:0x1a1430, metalness:.85, roughness:.3});
  { // HUB: the utopia spire (GLB): twisting glass blades round a luminous core, sky gardens, halo crown
    const g = new THREE.Group(); g.position.set(...LOC.hub.obj); g.scale.setScalar(.85); scene.add(g);
    const parts = {};
    loadModel('landmark_spire').then(root=>{
      g.add(root);
      root.traverse(o=>{ if(/^(halo_\d|orb|core)$/.test(o.name)) parts[o.name] = o; });
      parts.core && parts.core.traverse(o=>{ if(o.isMesh){ o.material = o.material.clone(); parts.coreMat = o.material; } });
    }).catch(e=>console.warn('spire', e));
    // a soft light column above the orb
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.3, 2.2, 140, 16, 1, true).translate(0, 70, 0),
      BM(0x3ef2ff, {transparent:true, opacity:.1, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
    beam.position.y = 99; g.add(beam);
    anim.push((t,b)=>{
      if(parts.halo_1) parts.halo_1.rotation.y = t*.4;
      if(parts.halo_2) parts.halo_2.rotation.y = -t*.65;
      if(parts.orb){ parts.orb.position.y = 99 + Math.sin(t*.8)*.7; parts.orb.rotation.y = t*.5; parts.orb.scale.setScalar(1 + b*.35 + Math.sin(t*2.4)*.05); }
      if(parts.coreMat) parts.coreMat.emissiveIntensity = .7 + Math.sin(t*1.3)*.08 + b*.45;
      beam.material.opacity = .07 + b*.1;
    });
  }
  { // ABOUT: the Archive data spire (GLB) with orbiting data rings, a floating crystal and holo panels
    const g = new THREE.Group(); g.position.set(...LOC.about.obj); scene.add(g);
    const parts = {};
    loadModel('landmark_archive').then(root=>{
      g.add(root);
      root.traverse(o=>{ if(/^(crystal|orbit_\d|drums)$/.test(o.name)) parts[o.name] = o; });
      // the drums pulse with the music
      parts.drums && parts.drums.traverse(o=>{ if(o.isMesh && o.material.name === 'drum'){ o.material = o.material.clone(); parts.drumMat = o.material; } });
    }).catch(e=>console.warn('archive', e));
    // a beam from the crystal into the clouds
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.25, 1.6, 120, 16, 1, true).translate(0, 60, 0),
      BM(0xff3ea5, {transparent:true, opacity:.14, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
    beam.position.y = 40; g.add(beam);
    // three holo panels orbiting at mid height
    const panelTex = (title, sub, c) => canvasTex(512, 256, (x,w,h)=>{
      x.fillStyle = '#02060a'; x.fillRect(0,0,w,h);
      x.strokeStyle = c; x.lineWidth = 3; x.strokeRect(8,8,w-16,h-16);
      x.fillStyle = c; x.font = `800 64px ${FD}`; x.fillText(title, 30, 110);
      x.font = `500 28px ${FB}`; x.fillStyle = '#e8f6ff'; x.fillText(sub, 32, 160);
      for(let i=0;i<12;i++){ x.fillStyle = c; x.globalAlpha = .5; x.fillRect(32 + i*36, 196, 24, 6 + (i*37 % 5)*4); } x.globalAlpha = 1;
    });
    const holo = [['АРХИВ', 'память города · S-14', '#3ef2ff'], ['ОПЫТ', 'проекты · навыки · путь', '#ff3ea5'], ['ДАННЫЕ', 'сектор открыт · доступ 1', '#ffc46b']].map(([a, b, c], i)=>{
      const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5), holoMat(panelTex(a, b, c))); m.renderOrder = 4; g.add(m); return m;
    });
    anim.push((t,b)=>{
      if(parts.crystal){ parts.crystal.rotation.y = t*.6; parts.crystal.position.y = 38 + Math.sin(t*.9)*.8; parts.crystal.scale.setScalar(1 + b*.25); }
      if(parts.orbit_1) parts.orbit_1.rotation.y = t*.35;
      if(parts.orbit_2) parts.orbit_2.rotation.y = -t*.5;
      if(parts.orbit_3) parts.orbit_3.rotation.y = t*.8;
      if(parts.drumMat) parts.drumMat.emissiveIntensity = 1.3 + Math.sin(t*2)*.25 + b*1.2;
      holo.forEach((m,i)=>{ const a = t*.18 + i*Math.PI*2/3; m.position.set(Math.cos(a)*13, 15 + i*3.5 + Math.sin(t*.7 + i)*.6, Math.sin(a)*13); m.rotation.y = -a + Math.PI/2; });
      beam.material.opacity = .1 + b*.12;
    });
  }
  const projGroup = new THREE.Group(); projGroup.position.set(...LOC.projects.obj); scene.add(projGroup);
  const DEFAULT_PROJECTS = [
    {code:'PRJ-01', name:'Cyberius', status:'в работе', what:'Этот сайт: 3D-город на Angular и Three.js', stack:['Angular','Three.js','GLSL'], color:'#3ef2ff'},
    {code:'PRJ-02', name:'Пет-проект', status:'прототип', what:'Опиши, что он делает', stack:['C#','ASP.NET Core'], color:'#ff3ea5'},
    {code:'PRJ-03', name:'Пет-проект', status:'готов', what:'Опиши, что он делает', stack:['Angular','PostgreSQL'], color:'#ffc46b'},
  ];
  function buildProjects(){
    const list = ((typeof OPTS !== 'undefined' && OPTS.projects) || DEFAULT_PROJECTS).slice(0, 5);
    const pal = ['#3ef2ff','#ff3ea5','#ffc46b','#9b5bff','#5dff9e'];
    const CW = 512, CH = 716;                                  // card texture, aspect of the 9 x 12.6 m hologram
    const wrap = (x, text, maxW, n) => { const out = []; let line = ''; String(text).split(' ').forEach(w=>{ const t = line ? line + ' ' + w : w; if(x.measureText(t).width > maxW && line){ out.push(line); line = w; } else line = t; }); if(line) out.push(line); return out.slice(0, n); };
    const rgba = (hex, a) => { const c = new THREE.Color(hex); return `rgba(${c.r*255|0},${c.g*255|0},${c.b*255|0},${a})`; };
    const cardTex = (p, c, i) => canvasTex(CW, CH, x=>{
      // body: faint tinted glass with a hex grid
      x.fillStyle = '#000'; x.fillRect(0,0,CW,CH);
      x.fillStyle = rgba(c, .07); x.fillRect(0,0,CW,CH);
      x.strokeStyle = rgba(c, .07); x.lineWidth = 1;
      for(let row=0; row<26; row++) for(let col=0; col<12; col++){ const hx = col*46 + (row%2)*23, hy = row*28; x.beginPath(); for(let k=0;k<6;k++){ const an = k*Math.PI/3; x.lineTo(hx + Math.cos(an)*14, hy + Math.sin(an)*14); } x.closePath(); x.stroke(); }
      // frame: thin outline and bright corner brackets
      x.strokeStyle = rgba(c, .45); x.lineWidth = 2; x.strokeRect(10,10,CW-20,CH-20);
      x.strokeStyle = c; x.lineWidth = 5; x.shadowColor = c; x.shadowBlur = 12;
      [[10,10,1,1],[CW-10,10,-1,1],[10,CH-10,1,-1],[CW-10,CH-10,-1,-1]].forEach(([px,py,sx,sy])=>{ x.beginPath(); x.moveTo(px, py + sy*48); x.lineTo(px, py); x.lineTo(px + sx*48, py); x.stroke(); });
      x.shadowBlur = 0;
      // header: code and status pill
      glowText(x, p.code, 34, 62, `500 22px ${FM}`, c, c, 8);
      if(p.status){ x.font = `500 17px ${FM}`; const st = String(p.status).toUpperCase(), w = x.measureText(st).width + 40;
        x.strokeStyle = c; x.lineWidth = 1.5; x.strokeRect(CW - 34 - w, 40, w, 30);
        x.fillStyle = c; x.beginPath(); x.arc(CW - 34 - w + 15, 55, 5, 0, 7); x.fill();
        x.fillStyle = '#eaf6ff'; x.fillText(st, CW - 34 - w + 28, 61); }
      x.fillStyle = rgba(c, .6); x.fillRect(34, 90, CW-68, 2);
      // name
      let fs = 50; x.font = `800 ${fs}px ${FD}`; while(x.measureText(p.name.toUpperCase()).width > CW-68 && fs > 26){ fs -= 2; x.font = `800 ${fs}px ${FD}`; }
      glowText(x, p.name.toUpperCase(), 34, 158, x.font, 'rgba(232,242,252,.9)', rgba(c, .45), 5);
      // what it does
      x.font = `400 24px ${FB}`; x.fillStyle = 'rgba(236,246,255,.92)';
      wrap(x, p.what || '', CW-68, 4).forEach((l,k)=>x.fillText(l, 34, 210 + k*33));
      // telemetry: a waveform over little bars
      const gy = 380; x.strokeStyle = rgba(c, .25); x.lineWidth = 1; x.strokeRect(34, gy, CW-68, 110);
      for(let k=0;k<22;k++){ const h = 14 + ((k*37 + i*53) % 70); x.fillStyle = rgba(c, k%4 ? .3 : .6); x.fillRect(44 + k*19.5, gy + 100 - h, 11, h); }
      x.strokeStyle = '#ffffff'; x.lineWidth = 2.5; x.shadowColor = c; x.shadowBlur = 10; x.beginPath();
      for(let k=0;k<=88;k++){ const px = 34 + k*(CW-68)/88, py = gy + 55 + Math.sin(k*.28 + i)*18*Math.sin(k*.05 + 1) + Math.sin(k*.9 + i*2)*5; k ? x.lineTo(px,py) : x.moveTo(px,py); }
      x.stroke(); x.shadowBlur = 0;
      // stack chips
      glowText(x, 'СТЕК', 34, 530, `500 16px ${FM}`, rgba(c, .9), c, 0);
      let cx = 34, cy = 548; x.font = `500 19px ${FM}`;
      (p.stack || []).slice(0, 6).forEach(t=>{ const w = x.measureText(t).width + 22; if(cx + w > CW - 34){ cx = 34; cy += 44; } if(cy > 600) return;
        x.fillStyle = rgba(c, .14); x.fillRect(cx, cy, w, 34); x.strokeStyle = c; x.lineWidth = 1.5; x.strokeRect(cx, cy, w, 34);
        x.fillStyle = '#f1f8ff'; x.fillText(t, cx + 11, cy + 24); cx += w + 10; });
      // footer: barcode and node label
      for(let k=0;k<34;k++){ const w = 1 + ((k*7 + i*3) % 4); x.fillStyle = rgba(c, .55); x.fillRect(34 + k*7, 652, w, 26); }
      glowText(x, 'CYBERIUS · NODE ' + String(i+1).padStart(2,'0'), 290, 672, `500 15px ${FM}`, rgba('#eaf6ff', .7), c, 0);
    });
    const holoCard = (map, tint, seed) => new THREE.ShaderMaterial({
      uniforms:{ map:{value:map}, tint:{value:new THREE.Color(tint)}, time:U.time, seed:{value:seed}, uD:{value:FOG_D} },
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, extensions:{derivatives:true},
      vertexShader:`varying vec2 vUv; varying float vDepth; varying float vFacing;
        void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0);
          vec3 n = normalize(mat3(modelMatrix)*vec3(0.0,0.0,1.0)); vFacing = abs(dot(n, normalize(cameraPosition - w.xyz)));
          vec4 mv = viewMatrix*w; vDepth = -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader:`uniform sampler2D map; uniform vec3 tint; uniform float time; uniform float seed; uniform float uD;
        varying vec2 vUv; varying float vDepth; varying float vFacing;
        void main(){
          vec2 uv = vUv;
          // a soft travelling distortion band (continuous, never strobes)
          float bp = fract(time*0.05 + seed*0.37);
          float band = exp(-pow((uv.y - bp)*28.0, 2.0));
          uv.x += band*0.006*sin(uv.y*90.0 + time*3.0);
          // chromatic split
          float ca = 0.0012 + band*0.002;
          vec3 c = vec3(texture2D(map, uv + vec2(ca, 0.0)).r, texture2D(map, uv).g, texture2D(map, uv - vec2(ca, 0.0)).b);
          vec3 col = c*mix(vec3(1.0), tint*1.25, 0.22);
          // scanlines, averaged out where they would be smaller than a pixel
          float sl = vUv.y*180.0; float w = fwidth(sl);
          float scan = 0.82 + 0.18*smoothstep(0.2, 0.8, abs(fract(sl - time*0.6) - 0.5)*2.0);
          col *= mix(scan, 0.91, smoothstep(0.25, 0.9, w));
          // edge glow and the light sweep
          float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
          col += tint*(exp(-e*60.0)*0.3 + band*0.05);
          float sw = exp(-pow((vUv.y + vUv.x*0.25 - fract(time*0.09 + seed) * 1.6 + 0.2)*7.0, 2.0));
          col += tint*sw*0.06;
          // projected from below: slightly denser at the base
          col *= 0.82 + 0.25*(1.0 - vUv.y);
          col *= smoothstep(0.08, 0.45, vFacing);
          col *= exp(-pow(vDepth*uD*0.6, 2.0));
          // soft cap below the bloom threshold, so text never smears into a glare
          col = col*0.78/(1.0 + max(col.r, max(col.g, col.b))*0.3);
          gl_FragColor = vec4(min(col, vec3(0.66)), 1.0);
        }`
    });
    const beamMat = tint => new THREE.ShaderMaterial({
      uniforms:{ tint:{value:new THREE.Color(tint)}, time:U.time },
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
      vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader:`uniform vec3 tint; uniform float time; varying vec2 vUv;
        void main(){ float side = sin(fract(vUv.x*4.0)*3.14159);
          float streak = 0.75 + 0.25*sin(vUv.y*26.0 - time*2.2);
          float a = (0.05 + 0.2*pow(1.0 - vUv.y, 1.6))*(0.35 + 0.65*side)*streak*smoothstep(0.0, 0.08, vUv.y)*smoothstep(1.0, 0.85, vUv.y);
          gl_FragColor = vec4(tint*a, 1.0); }`
    });
    const moteMat = tint => new THREE.ShaderMaterial({
      uniforms:{ tint:{value:new THREE.Color(tint)}, time:U.time, H:{value:4.6} },
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      vertexShader:`attribute vec3 seed; uniform float time; uniform float H; varying float vA;
        void main(){ float k = fract(seed.x + time*(0.08 + seed.y*0.07));
          float r = mix(0.15, 1.0, k);
          vec3 p = vec3((seed.z*2.0 - 1.0)*4.3*r, k*H, sin(seed.y*40.0 + time)*0.18*r);
          vA = sin(k*3.14159);
          vec4 mv = modelViewMatrix*vec4(p,1.0); gl_PointSize = clamp(70.0/-mv.z, 1.5, 5.0); gl_Position = projectionMatrix*mv; }`,
      fragmentShader:`uniform vec3 tint; varying float vA;
        void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(d))*vA; gl_FragColor = vec4((tint + 0.35)*a*0.8, 1.0); }`
    });
    const iconMat = tint => new THREE.ShaderMaterial({
      uniforms:{ tint:{value:new THREE.Color(tint)} },
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
      vertexShader:`varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader:`uniform vec3 tint; varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(1.0 - abs(dot(normalize(vN), vV)), 2.0); gl_FragColor = vec4(tint*(0.12 + f*0.85), 1.0); }`
    });

    // crescent dais and one projector per project
    const dais = new THREE.Group(); dais.position.set(0, 0, 12); projGroup.add(dais);
    loadModel('gallery_dais').then(r=>dais.add(r)).catch(e=>console.warn('dais', e));
    const cards = [];
    const icons = [new THREE.OctahedronGeometry(.85, 0), new THREE.IcosahedronGeometry(.85, 0), new THREE.TorusKnotGeometry(.5, .14, 64, 8), new THREE.TetrahedronGeometry(1, 0), new THREE.DodecahedronGeometry(.8, 0)];
    list.forEach((p,i)=>{
      const c = p.color || pal[i % pal.length];
      const step = list.length > 1 ? Math.min(.64, 2.5/(list.length-1)) : 0, a = (i-(list.length-1)/2)*step;
      const g = new THREE.Group(); g.position.set(Math.sin(a)*16, .47, -Math.cos(a)*16+12); g.rotation.y = -a; projGroup.add(g);
      loadModel('holo_projector').then(r=>{ const pr = r.clone(); pr.traverse(o=>{ if(o.isMesh && o.material.name === 'emit'){ o.material = o.material.clone(); o.material.color.set(c).multiplyScalar(.15); o.material.emissive.set(c); } }); g.add(pr); }).catch(e=>console.warn('projector', e));
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(6.2, .3, 4.5, 4, 1, true).rotateY(Math.PI/4).scale(1, 1, .06).translate(0, 2.2 + 2.25, 0), beamMat(c));
      beam.renderOrder = 3; g.add(beam);
      const seeds = new Float32Array(60*3); for(let k=0;k<seeds.length;k++) seeds[k] = rnd();
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60*3), 3)); mg.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
      const motes = new THREE.Points(mg, moteMat(c)); motes.position.y = 2.2; motes.frustumCulled = false; motes.renderOrder = 3; g.add(motes);
      const card = new THREE.Mesh(new THREE.PlaneGeometry(9, 12.6), holoCard(cardTex(p, c, i), c, i*.23)); card.position.y = 12.55; card.renderOrder = 4; g.add(card);
      // a faint smoked-glass backing so the city behind does not show through the text
      const back = new THREE.Mesh(new THREE.PlaneGeometry(8.7, 12.3), new THREE.MeshBasicMaterial({color:0x020308, transparent:true, opacity:.76, depthWrite:true, side:THREE.DoubleSide, fog:false}));
      back.position.z = -.04; back.renderOrder = 3; card.add(back);
      const icon = new THREE.Mesh(icons[i % icons.length], iconMat(c)); icon.position.y = 20.4; icon.renderOrder = 4; g.add(icon);
      cards.push({card, icon, i});
    });
    anim.push((t,b)=>{ cards.forEach(({card, icon, i})=>{
      card.position.y = 12.55 + Math.sin(t*.9 + i*1.7)*.3; card.rotation.y = Math.sin(t*.4 + i)*.035;
      icon.position.y = 20.4 + Math.sin(t*1.2 + i)*.35; icon.rotation.set(t*.4 + i, t*.7, 0); icon.scale.setScalar(1 + b*.25);
    }); });
  }
  { // CONTACT: the signal tower (GLB) - dish crown, radar array, emitter rings and a beacon; signal waves roll out over the plaza
    const g = new THREE.Group(); g.position.set(...LOC.contact.obj); scene.add(g);
    const parts = {};
    loadModel('landmark_signal').then(root=>{
      g.add(root);
      const dim = new Set();
      root.traverse(o=>{ if(/^(dishes|radar|emit|beacon)$/.test(o.name)) parts[o.name] = o;
        if(o.isMesh && /^(neon|neon2|light_white|neon_amber)$/.test(o.material.name) && !dim.has(o.material)){ dim.add(o.material); o.material.emissiveIntensity *= .55; } });
      parts.beacon && parts.beacon.traverse(o=>{ if(o.isMesh){ o.material = o.material.clone(); parts.beaconMat = o.material; } });
    }).catch(e=>console.warn('signal', e));
    const waves = [];
    for(let i=0;i<3;i++){ const w = new THREE.Mesh(new THREE.RingGeometry(.96,1,96), BM(0x3ef2ff,{side:THREE.DoubleSide,transparent:true})); w.rotation.x=-Math.PI/2; w.position.y=.5; g.add(w); waves.push(w); }
    const sky = [];
    for(let i=0;i<2;i++){ const w = new THREE.Mesh(new THREE.RingGeometry(.97,1,96), BM(0xff3ea5,{side:THREE.DoubleSide,transparent:true,depthWrite:false})); w.rotation.x=-Math.PI/2; w.position.y=54; g.add(w); sky.push(w); }
    anim.push((t,b)=>{
      if(parts.dishes) parts.dishes.rotation.y = t*.12;
      if(parts.radar) parts.radar.rotation.y = -t*.8;
      if(parts.emit){ parts.emit.rotation.y = t*.3; parts.emit.scale.setScalar(1 + b*.12 + Math.sin(t*2.2)*.03); }
      if(parts.beaconMat) parts.beaconMat.emissiveIntensity = 1 + Math.pow(Math.max(0, Math.sin(t*3)), 8)*7 + b*3;
      waves.forEach((w,i)=>{ const k = (t*.35+i/3)%1; w.scale.setScalar(9+k*36); w.material.opacity = (1-k)*.8; });
      sky.forEach((w,i)=>{ const k = (t*.5+i/2)%1; w.scale.setScalar(4.5+k*16); w.material.opacity = (1-k)*.6*(.6+b); });
    });
  }

  /* ================= Vehicle models ================= */
  const MAT = {
    paint:  new THREE.MeshStandardMaterial({color:0xffffff, metalness:.75, roughness:.32}),
    dark:   new THREE.MeshStandardMaterial({color:0x16121e, metalness:.7, roughness:.42}),
    chrome: new THREE.MeshStandardMaterial({color:0xb9bfd0, metalness:1, roughness:.18}),
    glass:  new THREE.MeshStandardMaterial({color:0x0a1828, metalness:.95, roughness:.06, envMapIntensity:1.4}),
    cargo:  new THREE.MeshStandardMaterial({color:0x6b4a2a, metalness:.05, roughness:.9}),
    head:   BM(0xffffff),
    tail:   BM(0xff3a6a),
    neon:   BM(0xffffff),
    glow:   BM(0xffffff,{transparent:true, opacity:.5, depthWrite:false, side:THREE.DoubleSide}),
    thrust: BM(0x3ef2ff),
    thrustM:BM(0xff3ea5),
    amber:  BM(0xffb35c),
    rotor:  BM(0xb8c6ff,{transparent:true, opacity:.18, depthWrite:false, side:THREE.DoubleSide}),
    led:    BM(0xffffff),
    trim:   new THREE.MeshStandardMaterial({color:0x22242c, metalness:.6, roughness:.55}),
  };
  const TAG = new Map([[MAT.paint,'paint'],[MAT.neon,'glow'],[MAT.glow,'glow'],[MAT.led,'led']]);
  const add = (g, geo, m) => { g.add(new THREE.Mesh(geo, m)); };
  function profile(pts){ // pts: array of commands on a side profile (x = length axis, y = height)
    const s = new THREE.Shape(); pts.forEach(p=>{ const [c,...a] = p; s[c](...a); }); return s;
  }
  function hull(shape, width, bevel, segs=4){
    const g = new THREE.ExtrudeGeometry(shape, {depth:width, bevelEnabled:true, bevelThickness:bevel, bevelSize:bevel*.65, bevelSegments:segs, curveSegments:14});
    g.translate(0,0,-width/2); g.rotateY(-Math.PI/2); return g; // profile x -> world +z (forward)
  }
  const cyl = (r1,r2,len,seg=16) => new THREE.CylinderGeometry(r1,r2,len,seg);
  const alongZ = g => { g.rotateX(Math.PI/2); return g; };

  function modelCoupe(){
    const g = new THREE.Group();
    add(g, hull(profile([['moveTo',-2.1,.18],['lineTo',-2.12,.52],['quadraticCurveTo',-1.7,.74,-.9,.76],['lineTo',1.0,.62],['quadraticCurveTo',2.0,.5,2.2,.26],['quadraticCurveTo',2.15,.04,1.7,0],['lineTo',-1.7,0],['quadraticCurveTo',-2.08,.02,-2.1,.18]]), 1.3, .22), MAT.paint);
    const can = new THREE.SphereGeometry(1,28,14,0,Math.PI*2,0,Math.PI/2); can.scale(.6,.42,1.25); can.translate(0,.82,-.15); add(g, can, MAT.glass);
    [-1,1].forEach(s=>{
      add(g, alongZ(cyl(.27,.31,1.6)).translate(s*1.03,.3,-1.0), MAT.dark);
      add(g, new THREE.TorusGeometry(.25,.05,8,20).translate(s*1.03,.3,-1.8), MAT.chrome);
      add(g, new THREE.CircleGeometry(.21,16).rotateY(Math.PI).translate(s*1.03,.3,-1.81), MAT.thrust);
      add(g, box(.42,.07,.06, s*.5,.32,2.33), MAT.head);
      add(g, box(.04,.05,3.0, s*.89,.24,.1), MAT.neon);
    });
    add(g, box(1.55,.08,.05, 0,.48,-2.27), MAT.tail);
    add(g, new THREE.PlaneGeometry(1.5,3.6).rotateX(-Math.PI/2).translate(0,-.16,0), MAT.glow);
    return g;
  }
  function modelWedge(){
    const g = new THREE.Group();
    add(g, hull(profile([['moveTo',-2.2,.12],['lineTo',-2.2,.62],['lineTo',-1.3,.7],['lineTo',.1,.6],['lineTo',2.35,.16],['lineTo',2.25,0],['lineTo',-2.0,0],['lineTo',-2.2,.12]]), 1.4, .12, 2), MAT.paint);
    const ck = new THREE.ExtrudeGeometry(profile([['moveTo',-1.0,0],['lineTo',-.7,.38],['lineTo',.35,.38],['lineTo',1.15,0],['lineTo',-1.0,0]]), {depth:.9, bevelEnabled:true, bevelThickness:.06, bevelSize:.05, bevelSegments:2});
    ck.translate(0,0,-.45); ck.rotateY(-Math.PI/2); ck.translate(0,.62,-.15); add(g, ck, MAT.glass);
    add(g, box(2.0,.06,.5, 0,1.02,-1.95), MAT.dark);
    [-1,1].forEach(s=>{
      add(g, box(.06,.36,.22, s*.62,.84,-1.92), MAT.dark);
      add(g, alongZ(cyl(.2,.24,1.0)).translate(s*.5,.36,-2.1), MAT.chrome);
      add(g, new THREE.CircleGeometry(.17,16).rotateY(Math.PI).translate(s*.5,.36,-2.61), MAT.thrustM);
      add(g, box(.04,.04,3.4, s*.85,.22,0), MAT.neon);
    });
    add(g, box(1.3,.05,.05, 0,.17,2.42), MAT.head);
    add(g, box(1.45,.08,.05, 0,.52,-2.33), MAT.tail);
    add(g, new THREE.PlaneGeometry(1.5,3.8).rotateX(-Math.PI/2).translate(0,-.14,0), MAT.glow);
    return g;
  }
  function modelTaxi(){
    const g = new THREE.Group();
    add(g, hull(profile([['moveTo',-2.3,.12],['lineTo',-2.3,1.25],['quadraticCurveTo',-2.3,1.5,-2.0,1.5],['lineTo',.9,1.5],['quadraticCurveTo',1.8,1.45,2.25,.85],['lineTo',2.3,.25],['quadraticCurveTo',2.3,0,2.05,0],['lineTo',-2.05,0],['quadraticCurveTo',-2.3,0,-2.3,.12]]), 1.7, .1, 3), MAT.paint);
    add(g, box(1.94,.42,3.0, 0,1.12,-.35), MAT.glass);
    add(g, box(1.0,.06,.42, 0,1.63,-.2), MAT.dark);
    add(g, box(.9,.28,.3, 0,1.8,-.2), MAT.amber);
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{
      add(g, new THREE.TorusGeometry(.36,.08,8,20).rotateX(Math.PI/2).translate(sx*1.12,.18,sz*1.45), MAT.dark);
      add(g, new THREE.CircleGeometry(.3,16).rotateX(Math.PI/2).translate(sx*1.12,.1,sz*1.45), MAT.thrust);
    });
    [-1,1].forEach(s=>{ add(g, box(.5,.1,.05, s*.56,.5,2.38), MAT.head); add(g, box(.04,.06,4.0, s*.96,.4,0), MAT.neon); });
    add(g, box(1.6,.1,.05, 0,.95,-2.42), MAT.tail);
    return g;
  }
  function modelQuad(cargo){
    const g = new THREE.Group();
    add(g, alongZ(new THREE.CapsuleGeometry(.3,.7,6,14)), MAT.dark);
    const top = new THREE.SphereGeometry(1,20,10,0,Math.PI*2,0,Math.PI/2); top.scale(.33,.2,.6); top.translate(0,.08,0); add(g, top, MAT.paint);
    [[.85,.85],[-.85,.85],[.85,-.85],[-.85,-.85]].forEach(([x,z])=>{
      const arm = cyl(.045,.045,1.2,8); arm.rotateZ(Math.PI/2); arm.rotateY(-Math.atan2(z,x)); arm.translate(x/2,.02,z/2); add(g, arm, MAT.dark);
      add(g, new THREE.TorusGeometry(.42,.06,8,24).rotateX(Math.PI/2).translate(x,.05,z), MAT.chrome);
      add(g, new THREE.CircleGeometry(.38,20).rotateX(-Math.PI/2).translate(x,.07,z), MAT.rotor);
      add(g, cyl(.06,.06,.14,8).translate(x,.05,z), MAT.dark);
    });
    add(g, new THREE.SphereGeometry(.15,12,8).translate(0,-.2,.42), MAT.glass);
    add(g, new THREE.SphereGeometry(.07,8,6).translate(0,.06,-.62), MAT.led);
    if(cargo){
      add(g, box(.72,.5,.72, 0,-.66,0), MAT.cargo);
      add(g, box(.74,.06,.74, 0,-.44,0), MAT.amber);
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>add(g, cyl(.03,.03,.5,6).translate(sx*.32,-.4,sz*.32), MAT.dark));
    }
    return g;
  }
  function modelHauler(){
    const g = new THREE.Group();
    add(g, hull(profile([['moveTo',-4,.2],['lineTo',-4,1.6],['lineTo',2.6,1.6],['quadraticCurveTo',3.8,1.5,4.1,.8],['lineTo',4.1,.3],['quadraticCurveTo',4,0,3.6,0],['lineTo',-3.7,0],['quadraticCurveTo',-4,0,-4,.2]]), 2.2, .12, 3), MAT.dark);
    add(g, box(2.46,.4,1.0, 0,1.12,3.15), MAT.glass);
    add(g, box(2.2,1.0,2.6, 0,2.2,-.3), MAT.paint);
    add(g, box(2.2,1.0,2.6, 0,2.2,-3.0), MAT.paint);
    add(g, box(2.24,.16,2.4, 0,2.35,-.3), MAT.neon);
    add(g, box(2.24,.16,2.4, 0,2.35,-3.0), MAT.neon);
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{
      add(g, new THREE.TorusGeometry(.6,.12,8,24).rotateX(Math.PI/2).translate(sx*1.25,-.02,sz*2.4), MAT.chrome);
      add(g, new THREE.CircleGeometry(.5,20).rotateX(Math.PI/2).translate(sx*1.25,-.06,sz*2.4), MAT.thrust);
    });
    add(g, box(1.8,.1,.05, 0,.45,4.25), MAT.head);
    add(g, box(2.0,.12,.05, 0,1.3,-4.15), MAT.tail);
    return g;
  }

  /* merge every model into one geometry per material, then instance it */
  function compact(group){
    group.updateMatrixWorld(true);
    const by = new Map();
    group.traverse(o=>{
      if(!o.isMesh) return;
      let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      if(g.index) g = g.toNonIndexed();
      for(const k of Object.keys(g.attributes)) if(!['position','normal','uv'].includes(k)) g.deleteAttribute(k);
      if(!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
      g.clearGroups();
      if(!by.has(o.material)) by.set(o.material, []);
      by.get(o.material).push(g);
    });
    const U = THREE.BufferGeometryUtils;
    const out = [];
    by.forEach((gs,m)=>{
      if(U && gs.length > 1){ const merged = U.mergeBufferGeometries(gs); if(merged){ out.push({m,g:merged}); return; } }
      gs.forEach(g=>out.push({m,g}));
    });
    return out;
  }
  function fleet(n, model, colors){
    const ms = compact(model).map(p=>{
      const m = new THREE.InstancedMesh(p.g, p.m, n); m.frustumCulled = false;
      const tag = TAG.get(p.m);
      if(tag) for(let i=0;i<n;i++) m.setColorAt(i, col.setHex(colors && colors[tag] ? colors[tag](i) : 0x888888));
      scene.add(m); return m;
    });
    return { ms, set(i,mx){ for(const m of ms) m.setMatrixAt(i,mx); }, flush(){ for(const m of ms) m.instanceMatrix.needsUpdate = true; } };
  }

  /* city traffic GLBs (traffic.js): material names map onto the shared instanced materials */
  const TRF_MAT = () => ({paint:MAT.paint, paint2:MAT.dark, trim:MAT.trim, rubber:MAT.trim, cargo:MAT.cargo, glass:MAT.glass, chrome:MAT.chrome,
    neon:MAT.neon, light_head:MAT.head, light_tail:MAT.tail, light_amber:MAT.amber, thrust:MAT.thrust, rotor_disc:MAT.rotor});
  function fleetGLB(n, id, colors){
    const f = { ms:[], set(i,mx){ for(const m of f.ms) m.setMatrixAt(i,mx); }, flush(){ for(const m of f.ms) m.instanceMatrix.needsUpdate = true; } };
    const map = TRF_MAT();
    loadModel(id).then(root=>{
      const g = new THREE.Group(); root.updateMatrixWorld(true);
      root.traverse(o=>{
        if(!o.isMesh) return;
        const src = o.geometry, geo = new THREE.BufferGeometry();
        ['position','normal','uv'].forEach(k=>{ const a = src.attributes[k]; if(!a) return; const arr = new Float32Array(a.count*a.itemSize);
          for(let i=0;i<a.count;i++){ arr[i*a.itemSize] = a.getX(i); arr[i*a.itemSize+1] = a.getY(i); if(a.itemSize > 2) arr[i*a.itemSize+2] = a.getZ(i); }
          geo.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize)); });
        if(src.index) geo.setIndex(Array.from(src.index.array));
        geo.applyMatrix4(o.matrixWorld);
        g.add(new THREE.Mesh(geo, map[o.material.name] || MAT.dark));
      });
      f.ms = fleet(n, g, colors).ms;
    }).catch(e=>console.warn('traffic', id, e));
    return f;
  }
  let traffic = () => {};
  function buildVehicles(){
    const laneK = () => { let k; do{ k = Math.floor(rnd()*13)-6; }while(k===0); return k; };
    const lane = (y0, ys, v0, vs, off) => { const dir = rnd()<.5?1:-1; return {axis:rnd()<.5?'x':'z', dir, lane:laneK()*45 + dir*off, y:y0 + rnd()*ys, v:v0 + rnd()*vs, o:rnd()*640, ph:rnd()*6}; };
    const corridor = () => [15,22,29,36][Math.floor(rnd()*4)];
    const glowC = [0x3ef2ff,0xff3ea5,0xffc46b,0x9b5bff];
    const mk = (n, f) => Array.from({length:n}, f);

    const coupes = mk(50, ()=>Object.assign(lane(0,1.2,16,20,1.9), {paint:pick([0x7a0f2a,0x18245e,0x111016,0x2c2c36,0x3b1458,0x0f4a4e,0xc9ccd8]), glow:pick(glowC)}));
    coupes.forEach(c=>c.y += corridor());
    const wedges = mk(36, ()=>Object.assign(lane(0,1.2,22,22,1.9), {paint:pick([0xa01236,0x101015,0x2a1b6a,0xd06a12,0x116a52]), glow:pick(glowC)}));
    wedges.forEach(c=>c.y += corridor());
    const taxis = mk(30, ()=>Object.assign(lane(0,1.2,14,14,1.9), {paint:pick([0xd6a21e,0xe0b030,0xc58a18]), glow:pick([0xffc46b,0x3ef2ff])}));
    taxis.forEach(c=>c.y += corridor());
    const dels = mk(40, ()=>lane(7,6,6,6,(rnd()-.5)*5));
    const haul = mk(14, ()=>Object.assign(lane(46,14,8,5,2.6), {paint:pick([0x2a3a5a,0x4a2032,0x3a3a42,0x1e4a40]), glow:pick(glowC)}));
    const scouts = mk(40, (_,i)=>{
      let cx, cz, r, cy;
      if(i<18){ const L = LOC[ORDER[i%4]], hub = L===LOC.hub; cx=L.obj[0]; cz=L.obj[2]; r=(hub?22:15)+rnd()*6; cy=8+rnd()*(hub?60:30); }
      else { let kx,kz; do{ kx=Math.floor(rnd()*11)-5; kz=Math.floor(rnd()*11)-5; }while(kx===0&&kz===0); cx=kx*45; cz=kz*45; r=1.5+rnd()*2.5; cy=8+rnd()*40; }
      return {cx,cz,cy,r, w:(.25+rnd()*.35)*(rnd()<.5?1:-1), ph:rnd()*6.28, led:pick([0x3ef2ff,0xff3ea5])};
    });

    const F = {
      coupe: fleetGLB(coupes.length, 'tr_aircar',  {paint:i=>coupes[i].paint, glow:i=>coupes[i].glow}),
      wedge: fleetGLB(wedges.length, 'tr_glider',  {paint:i=>wedges[i].paint, glow:i=>wedges[i].glow}),
      taxi:  fleetGLB(taxis.length,  'tr_aircab',  {paint:i=>taxis[i].paint,  glow:i=>taxis[i].glow}),
      del:   fleetGLB(dels.length,   'tr_drone',   {paint:()=>0xb4b8c8, glow:()=>0x39ff9c}),
      scout: fleetGLB(scouts.length, 'tr_scout',   {paint:()=>0x2b2340, glow:i=>scouts[i].led}),
      haul:  fleetGLB(haul.length,   'tr_shuttle', {paint:i=>haul[i].paint, glow:i=>haul[i].glow}),
    };
    const D = new THREE.Object3D(); D.rotation.order = 'YXZ';
    const along = (c,t) => ((((c.o + c.v*t*c.dir) % 640) + 640) % 640) - 320;
    const onLane = (c, y, pitch, t) => {
      const p = along(c,t);
      if(c.axis==='x'){ D.position.set(p,y,c.lane); D.rotation.set(pitch, c.dir>0?Math.PI/2:-Math.PI/2, 0); }
      else { D.position.set(c.lane,y,p); D.rotation.set(pitch, c.dir>0?0:Math.PI, 0); }
      D.updateMatrix(); return D.matrix;
    };
    traffic = t => {
      coupes.forEach((c,i)=>F.coupe.set(i, onLane(c, c.y+Math.sin(t*1.3+c.ph)*.25, 0, t)));
      wedges.forEach((c,i)=>F.wedge.set(i, onLane(c, c.y+Math.sin(t*1.1+c.ph)*.2, 0, t)));
      taxis.forEach((c,i)=>F.taxi.set(i, onLane(c, c.y+Math.sin(t*1.2+c.ph)*.25, 0, t)));
      dels.forEach((c,i)=>F.del.set(i, onLane(c, c.y+Math.sin(t*2+c.ph)*.3, .12, t)));
      haul.forEach((c,i)=>F.haul.set(i, onLane(c, c.y+Math.sin(t*.6+c.ph)*.5, 0, t)));
      scouts.forEach((s,i)=>{
        const a = s.ph + s.w*t;
        D.position.set(s.cx+Math.cos(a)*s.r, s.cy+Math.sin(t*.9+s.ph)*.7, s.cz+Math.sin(a)*s.r);
        D.rotation.set(.16, Math.atan2(-Math.sin(a)*s.w, Math.cos(a)*s.w), 0);
        D.updateMatrix(); F.scout.set(i, D.matrix);
      });
      Object.values(F).forEach(f=>f.flush());
    };
  }

  /* Airships with scrolling holo-ads and searchlights */
  function buildAirships(){
    const banners = [
      ['CYBERIUS', 'ЧИСТЫЙ ВОЗДУХ · 24/7', '#ff3ea5', '#3ef2ff'],
      ['НОКТЮРН', 'DARKWAVE · 88.3 FM', '#3ef2ff', '#ff3ea5'],
      ['ОРБИТА', 'РЕЙСЫ НА КОЛЬЦО', '#ffc46b', '#3ef2ff'],
    ].map(([a,b,c1,c2]) => canvasTex(1024,160,(x,w,h)=>{
      x.fillStyle='#0b0418'; x.fillRect(0,0,w,h);
      x.textBaseline='middle';
      glowText(x,a,30,84,`800 70px ${FD}`,c1,c1,16);
      x.font=`500 30px ${FM}`; x.fillStyle=c2; x.fillText(b, 560, 84);
    }, true));
    const hullPts = [];
    for(let i=0;i<=24;i++){ const t=i/24; let r = 6.5*Math.pow(Math.sin(Math.PI*t), .7); if(t<.5) r *= .78 + .22*(t/.5); hullPts.push(new THREE.Vector2(Math.max(r,.001), (t-.5)*48)); }
    const hullGeo = new THREE.LatheGeometry(hullPts, 40).rotateX(Math.PI/2);
    const hullMat = new THREE.MeshStandardMaterial({color:0x2a2440, metalness:.6, roughness:.38});
    const finShape = profile([['moveTo',-16,2],['lineTo',-23.5,.8],['lineTo',-25,6.5],['lineTo',-20.5,6.5],['lineTo',-16,2]]);
    const finGeo = new THREE.ExtrudeGeometry(finShape,{depth:.35, bevelEnabled:false}); finGeo.translate(0,0,-.175); finGeo.rotateY(-Math.PI/2);
    const ships = [];
    for(let i=0;i<3;i++){
      const g = new THREE.Group();
      g.add(new THREE.Mesh(hullGeo, hullMat));
      for(let k=0;k<4;k++){ const f = new THREE.Mesh(finGeo, hullMat); f.rotation.z = k*Math.PI/2; g.add(f); }
      const tex = banners[i];
      const hm = holoMat(tex); [-1,1].forEach(s=>{ const p = new THREE.Mesh(new THREE.PlaneGeometry(20,3.2), hm); p.position.set(s*6.9,.8,0); p.rotation.y = s*Math.PI/2; p.renderOrder = 4; g.add(p); });
      g.add(new THREE.Mesh(box(3.2,1.8,8, 0,-7.2,2), MAT.dark));
      g.add(new THREE.Mesh(box(3.26,.4,6.4, 0,-7.0,2), MAT.amber));
      g.add(new THREE.Mesh(box(.3,1.6,.3, -1,-5.8,0), MAT.dark), new THREE.Mesh(box(.3,1.6,.3, 1,-5.8,4), MAT.dark));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(.35,8,6).translate(-6.4,0,6), BM(0xff3a5a)));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(.35,8,6).translate(6.4,0,6), BM(0x39ff9c)));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(16,110,32,1,true).translate(0,-55,0),
        BM(0x8fe9ff,{transparent:true, opacity:.045, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
      cone.position.set(0,-8.2,2); g.add(cone);
      g.userData = {r:170+i*38, y:96+i*12, w:(.02+i*.006)*(i%2?-1:1), ph:i*2.1, cone, hm};
      scene.add(g); ships.push(g);
    }
    anim.push(t=>{ ships.forEach((g,i)=>{ const u = g.userData, a = u.ph + u.w*t;
      g.position.set(Math.cos(a)*u.r, u.y+Math.sin(t*.3+u.ph)*1.5, Math.sin(a)*u.r);
      g.rotation.y = Math.atan2(-Math.sin(a)*u.w, Math.cos(a)*u.w);
      u.cone.rotation.x = .28 + Math.sin(t*.25+i)*.12; u.cone.rotation.z = Math.sin(t*.18+i*2)*.15;
      u.hm.uniforms.off.value = (t*.02) % 1; }); });
  }

  /* ================= Street life: lamps, traffic lights, ground cars, pedestrians ================= */
  const LAMP_HEX = [0x3ef2ff, 0xff3ea5, 0xffc46b];
  const CYCLE = 16;
  const LIGHT_HEX = {g:0x2bff8a, y:0xffc030, r:0xff2a40};
  // axis 'A' = cars moving along z, 'B' = cars moving along x
  function lightState(it, t, axis){
    const ph = (t + it.off) % CYCLE;
    if(axis === 'A') return ph < 7 ? 'g' : ph < 8.5 ? 'y' : 'r';
    return ph < 8.5 ? 'r' : ph < 15 ? 'g' : 'y';
  }
  const INTER = new Map();
  let streets = () => {};
  function buildStreets(){
    const R = 6;
    const nearLoc = (x,z,r) => Object.values(LOC).some(l => Math.hypot(x-l.obj[0], z-l.obj[2]) < r);

    /* street lamps: pole + arm + glowing head, matching the light pools painted on the ground */
    const lamps = [];
    for(let k=-R;k<=R;k++) for(let id=-20; id<=19; id++){
      const al = id*15 + 7.5;
      for(const side of [0,1]){
        const s = side ? 1 : -1;
        lamps.push({x:k*45 + s*3.9, z:al, ax:-s, az:0, c:Math.abs(k*7 + id*3 + side) % 3});
        lamps.push({x:al, z:k*45 + s*3.9, ax:0, az:-s, c:Math.abs(k*5 + id*2 + side + 1) % 3});
      }
    }
    const lampModel = new THREE.Group();
    add(lampModel, cyl(.07,.1,5.2,8).translate(0,2.6,0), MAT.dark);
    add(lampModel, box(1.35,.07,.07, .62,5.15,0), MAT.dark);
    add(lampModel, box(.9,.07,.26, 1.2,5.08,0), MAT.led);
    add(lampModel, box(.12,.5,.12, 0,3.4,0), MAT.led);
    const lampF = fleet(lamps.length, lampModel, {led:i=>LAMP_HEX[lamps[i].c]});
    const D = new THREE.Object3D();
    lamps.forEach((l,i)=>{ D.position.set(l.x,0,l.z); D.rotation.set(0, Math.atan2(-l.az, l.ax), 0); D.updateMatrix(); lampF.set(i, D.matrix); });
    lampF.flush();

    /* traffic lights: two per crossing, one for each direction of traffic */
    for(let kx=-R;kx<=R;kx++) for(let kz=-R;kz<=R;kz++){
      const x = kx*45, z = kz*45;
      if(nearLoc(x,z,12)) continue;
      INTER.set(kx+','+kz, {x, z, kx, kz, off:((kx*37 + kz*61) % CYCLE + CYCLE) % CYCLE});
    }
    const inter = [...INTER.values()];
    const tlModel = new THREE.Group();
    add(tlModel, cyl(.09,.11,5.4,8).translate(0,2.7,0), MAT.dark);
    add(tlModel, box(2.7,.09,.09, 1.35,5.3,0), MAT.dark);
    add(tlModel, box(.34,1.0,.34, 2.55,4.85,0), MAT.dark);
    const tlLamp = new THREE.Group();
    add(tlLamp, new THREE.SphereGeometry(.16,10,8).translate(2.55,4.85,0), MAT.led);
    const poles = [];
    inter.forEach(it=>{ poles.push({it, axis:'A', x:it.x+3.9, z:it.z+3.9, ax:-1, az:0}); poles.push({it, axis:'B', x:it.x-3.9, z:it.z-3.9, ax:0, az:1}); });
    const tlF = fleet(poles.length, tlModel, {});
    const tlL = fleet(poles.length, tlLamp, {led:()=>0x2bff8a});
    poles.forEach((p,i)=>{ D.position.set(p.x,0,p.z); D.rotation.set(0, Math.atan2(-p.az, p.ax), 0); D.updateMatrix(); tlF.set(i, D.matrix); tlL.set(i, D.matrix); });
    tlF.flush(); tlL.flush();
    const lampMesh = tlL.ms[0];

    /* ground traffic that obeys the lights */
    const gcars = [];
    const roadK = () => { let k; do{ k = Math.floor(rnd()*11)-5; }while(k===0); return k; };
    const types = ['coupe','taxi','wedge'];
    for(let i=0;i<96;i++){
      const axis = rnd()<.5 ? 'x' : 'z', dir = rnd()<.5 ? 1 : -1, k = roadK();
      gcars.push({axis, dir, k, lane: k*45 + (axis==='x' ? dir*1.5 : -dir*1.5), p: rnd()*540-270, v: 6, vmax: 8+rnd()*5, type: types[i%3], ph: rnd()*6,
        paint: pick([0x7a0f2a,0x18245e,0x111016,0x2c2c36,0x3b1458,0xd6a21e,0xc9ccd8]), glow: pick([0x3ef2ff,0xff3ea5,0xffc46b])});
    }
    const byType = {coupe:[], taxi:[], wedge:[]};
    gcars.forEach(c=>{ c.idx = byType[c.type].length; byType[c.type].push(c); });
    const gF = {
      coupe: fleetGLB(byType.coupe.length, 'tr_sedan', {paint:i=>byType.coupe[i].paint, glow:i=>byType.coupe[i].glow}),
      taxi:  fleetGLB(byType.taxi.length,  'tr_cab',   {paint:()=>0xd6a21e, glow:i=>byType.taxi[i].glow}),
      wedge: fleetGLB(byType.wedge.length, 'tr_van',   {paint:i=>byType.wedge[i].paint, glow:i=>byType.wedge[i].glow}),
    };
    const lanes = {};
    gcars.forEach(c=>{ const key = c.axis + c.k + ':' + c.dir; (lanes[key] = lanes[key] || []).push(c); });

    /* pedestrians on the sidewalks, some with glowing umbrellas */
    const peds = [];
    const coats = [0x2a2236,0x3a2a2a,0x1d2a3a,0x4a3a2e,0x2e2e34,0x5a2440,0x1f3a34,0x6a6a72];
    const umbC = [0x3ef2ff,0xff3ea5,0xffc46b,0x9b5bff,0x5dff9e];
    for(let i=0;i<560;i++){
      const axis = rnd()<.5 ? 'x' : 'z';
      let k; do{ k = Math.floor(rnd()*9)-4; }while(k===0);
      const side = rnd()<.5 ? -1 : 1;
      peds.push({axis, k, line: k*45 + side*(3.3 + rnd()*1.0), p: rnd()*320-160, dir: rnd()<.5 ? 1 : -1, sp: .9 + rnd()*.7, ph: rnd()*6.28,
        s: .92 + rnd()*.16, coat: pick(coats), umb: rnd() < .33 ? pick(umbC) : 0, walking: 1});
    }
    /* citizens: six detailed GLB models; legs, knees and arms swing in the vertex shader so hundreds stay instanced */
    const cc = new THREE.Color();
    const UMB_MODELS = ['person_trench_lo', 'person_visor_lo'], WALK_MODELS = ['person_hoodie_lo', 'person_tech_lo', 'person_cyborg_lo', 'person_rain_lo'];
    const PED = { ready:false, groups:{} };
    peds.forEach((p,i)=>{ p.model = p.umb ? UMB_MODELS[i % 2] : WALK_MODELS[i % 4]; });
    const pedVert = `attribute vec4 aCol; attribute float aPart; attribute vec3 aPiv; attribute vec3 aPiv2; attribute vec2 aWalk; attribute vec3 aTint;
      varying vec3 vN; varying vec3 vW; varying vec4 vCol; varying float vDepth;
      mat3 rx(float a){ float c = cos(a), s = sin(a); return mat3(1.0,0.0,0.0, 0.0,c,s, 0.0,-s,c); }
      void main(){
        float ph = aWalk.x, w = aWalk.y, sw = sin(ph);
        vec3 p = position, n = normal;
        float part = floor(aPart + 0.5);
        if(part > 0.5 && part < 4.5){
          bool left = mod(part, 2.0) > 0.5;           // 1,3 left; 2,4 right
          float s = left ? 1.0 : -1.0;
          float hip = -s*sw*0.48*w;
          if(part > 2.5){                              // shin: bend the knee first, then swing with the thigh
            float knee = max(0.0, sin(ph*s + (left ? -1.1 : 2.04)))*0.9*w;
            mat3 K = rx(knee); p = K*(p - aPiv) + aPiv; n = K*n;
            mat3 Hh = rx(hip); p = Hh*(p - aPiv2) + aPiv2; n = Hh*n;
          } else { mat3 Hh = rx(hip); p = Hh*(p - aPiv) + aPiv; n = Hh*n; }
        } else if(part > 4.5 && part < 6.5){
          float s = part < 5.5 ? 1.0 : -1.0;
          mat3 A = rx(s*sw*0.4*w); p = A*(p - aPiv) + aPiv; n = A*n;
        }
        vCol = aCol; if(aCol.a > 2.5) vCol.rgb = aTint;
        mat4 m = modelMatrix*instanceMatrix;
        vN = normalize(mat3(m)*n);
        vec4 wp = m*vec4(p, 1.0); vW = wp.xyz;
        vec4 mv = viewMatrix*wp; vDepth = -mv.z; gl_Position = projectionMatrix*mv;
      }`;
    const pedFrag = `uniform vec3 uFog; uniform float uD; uniform vec3 uHaze; varying vec3 vN; varying vec3 vW; varying vec4 vCol; varying float vDepth;
      void main(){
        vec3 N = normalize(vN); float kind = floor(vCol.a + 0.5);
        vec3 col;
        if(kind > 3.5) col = vCol.rgb;                 // glowing trims, visors, umbrella rims
        else {
          vec3 V = normalize(cameraPosition - vW);
          float up = N.y*0.5 + 0.5;
          vec3 light = vec3(0.2,0.2,0.32)*(0.5 + up) + vec3(0.55,0.22,0.5)*(1.0 - up)*0.6 + vec3(0.3,0.6,0.75)*pow(1.0 - max(dot(N, V), 0.0), 3.0)*0.8;
          col = vCol.rgb*light*1.4;
          if(kind > 0.5 && kind < 1.5) col += vec3(0.25,0.3,0.45)*pow(1.0 - max(dot(N, V), 0.0), 2.0)*0.5;
        }
        float fog = 1.0 - exp(-uD*uD*vDepth*vDepth);
        float hz = (1.0 - exp(-vDepth*0.009))*0.6;
        col = mix(col, uHaze, hz);
        gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
      }`;
    const pedMat = new THREE.ShaderMaterial({ uniforms:{ uFog:{value:FOG}, uD:{value:FOG_D}, uHaze:{value:HAZE} }, vertexShader:pedVert, fragmentShader:pedFrag });
    const canopyMat = new THREE.ShaderMaterial({ uniforms:{ uFog:{value:FOG}, uD:{value:FOG_D} }, transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending,
      vertexShader:`attribute vec3 aTint; attribute vec4 aCol; varying vec3 vC; varying float vDepth; void main(){ vC = aCol.a > 2.5 ? aTint : aCol.rgb; vec4 mv = viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.0); vDepth = -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader:`uniform vec3 uFog; uniform float uD; varying vec3 vC; varying float vDepth; void main(){ float fog = 1.0 - exp(-uD*uD*vDepth*vDepth); gl_FragColor = vec4(vC*0.42*(1.0 - fog), 1.0); }` });
    const PART = n => /thigh_L/.test(n) ? 1 : /thigh_R/.test(n) ? 2 : /shin_L/.test(n) ? 3 : /shin_R/.test(n) ? 4 : /arm_L/.test(n) ? 5 : /arm_R/.test(n) ? 6 : /hold_/.test(n) ? 7 : 0;
    const buildPed = (id, root) => {
      const list = peds.filter(p=>p.model === id); if(!list.length) return;
      root.updateMatrixWorld(true);
      const solid = [], clear = [];
      root.traverse(o=>{
        if(!o.isMesh) return;
        // which limb is this mesh on, and where are its joints?
        let node = o, part = 0, joint = null, hipNode = null;
        while(node && node !== root){ const k = PART(node.name || ''); if(k && !part){ part = k; joint = node; } if(/thigh_/.test(node.name || '') && part > 2 && part < 5) hipNode = node; node = node.parent; }
        const piv = joint ? new THREE.Vector3().setFromMatrixPosition(joint.matrixWorld) : new THREE.Vector3();
        const piv2 = hipNode ? new THREE.Vector3().setFromMatrixPosition(hipNode.matrixWorld) : piv;
        const src = o.geometry, gg = new THREE.BufferGeometry();
        ['position','normal'].forEach(k=>{ const at = src.attributes[k]; const arr = new Float32Array(at.count*3); for(let i=0;i<at.count;i++){ arr[i*3] = at.getX(i); arr[i*3+1] = at.getY(i); arr[i*3+2] = at.getZ(i); } gg.setAttribute(k, new THREE.BufferAttribute(arr, 3)); });
        gg.setIndex(src.index ? Array.from(src.index.array) : Array.from({length:src.attributes.position.count}, (_,i)=>i));
        gg.applyMatrix4(o.matrixWorld);
        const m = o.material, name = m.name || '', n = gg.attributes.position.count;
        const glowing = /^(neon|light)/.test(name);
        const c = (glowing ? m.emissive.clone().multiplyScalar(1.4) : m.color.clone()).convertLinearToSRGB();
        const kind = glowing ? 4 : name === 'cloth_a' ? 3 : (m.metalness > 0.5 ? 1 : 0);
        const fill = (k, arr) => { const out = new Float32Array(n*arr.length); for(let i=0;i<n;i++) out.set(arr, i*arr.length); gg.setAttribute(k, new THREE.BufferAttribute(out, arr.length)); };
        fill('aCol', [c.r, c.g, c.b, kind]); fill('aPart', [part]); fill('aPiv', [piv.x, piv.y, piv.z]); fill('aPiv2', [piv2.x, piv2.y, piv2.z]);
        if(name === 'umbrella' || name === 'raincoat'){ if(name === 'umbrella') clear.push(gg); } else solid.push(gg);
      });
      const walk = new THREE.InstancedBufferAttribute(new Float32Array(list.length*2), 2); walk.setUsage(THREE.DynamicDrawUsage);
      const tint = new Float32Array(list.length*3);
      list.forEach((p,i)=>{ cc.setHex(p.umb && false ? p.umb : p.coat); tint.set([cc.r*1.6, cc.g*1.6, cc.b*1.6], i*3); p.slot = i; });
      const mk = (gs, mat) => {
        const geo = THREE.BufferGeometryUtils.mergeBufferGeometries(gs);
        geo.setAttribute('aWalk', walk); geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
        const im = new THREE.InstancedMesh(geo, mat, list.length); im.frustumCulled = false; scene.add(im); return im;
      };
      const g = { body: mk(solid, pedMat), canopy: clear.length ? mk(clear, canopyMat) : null, walk };
      if(g.canopy){ const ut = new Float32Array(list.length*3); list.forEach((p,i)=>{ cc.setHex(p.umb || 0x3ef2ff); ut.set([cc.r, cc.g, cc.b], i*3); }); g.canopy.geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(ut, 3)); }
      PED.groups[id] = g;
    };
    GLBLIB().then(async lib=>{
      for(const id of UMB_MODELS.concat(WALK_MODELS)) if(lib[id]) buildPed(id, await parseGLB(lib[id]));
      PED.ready = true;
    }).catch(e=>console.warn('people', e));

    const M = new THREE.Matrix4(), L = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0,1,0);
    let lightT = -1;
    streets = (t, dt) => {
      // signal heads
      if(t - lightT > .25){
        lightT = t;
        poles.forEach((p,i)=>lampMesh.setColorAt(i, cc.setHex(LIGHT_HEX[lightState(p.it, t, p.axis)])));
        lampMesh.instanceColor.needsUpdate = true;
      }
      // cars: follow the car ahead, stop at red
      for(const key in lanes){
        const list = lanes[key]; const dir = list[0].dir;
        list.sort((a,b)=>(a.p - b.p)*dir);
        list.forEach((c,i)=>{
          let tv = c.vmax;
          const ahead = list[i+1];
          if(ahead){ const gap = (ahead.p - c.p)*dir; tv = Math.min(tv, Math.max(0, gap - 6)*1.4); }
          let stop, m;
          if(dir > 0){ m = Math.ceil((c.p + 5.2 + .01)/45); stop = m*45 - 5.2; } else { m = Math.floor((c.p - 5.2 - .01)/45); stop = m*45 + 5.2; }
          const dist = (stop - c.p)*dir;
          const it = c.axis === 'x' ? INTER.get(m+','+c.k) : INTER.get(c.k+','+m);
          if(it && dist < 16){
            const st = lightState(it, t, c.axis === 'x' ? 'B' : 'A');
            if(st === 'r' || (st === 'y' && dist > 4)) tv = Math.min(tv, Math.max(0, dist - .4)*.9);
          }
          c.v += (tv - c.v)*Math.min(1, dt*2.2);
          c.p += dir*c.v*dt;
          if(c.p > 270) c.p -= 540; else if(c.p < -270) c.p += 540;
          const y = .02;
          if(c.axis === 'x'){ D.position.set(c.p, y, c.lane); D.rotation.set(0, dir>0 ? Math.PI/2 : -Math.PI/2, 0); }
          else { D.position.set(c.lane, y, c.p); D.rotation.set(0, dir>0 ? 0 : Math.PI, 0); }
          D.updateMatrix(); gF[c.type].set(c.idx, D.matrix);
        });
      }
      gF.coupe.flush(); gF.taxi.flush(); gF.wedge.flush();
      // pedestrians: wait at the kerb while cars on the crossing road have green
      peds.forEach((p,i)=>{
        let go = 1;
        let m, edge;
        if(p.dir > 0){ m = Math.ceil((p.p + 3.4)/45); edge = m*45 - 3.4; } else { m = Math.floor((p.p - 3.4)/45); edge = m*45 + 3.4; }
        const dist = (edge - p.p)*p.dir;
        if(dist < .6 && dist > -.05){
          const it = p.axis === 'x' ? INTER.get(m+','+p.k) : INTER.get(p.k+','+m);
          if(it){ const st = lightState(it, t, p.axis === 'x' ? 'A' : 'B'); if(st !== 'r') go = 0; }
        }
        p.walking += (go - p.walking)*Math.min(1, dt*6);
        p.p += p.dir*p.sp*p.walking*dt;
        if(p.p > 160) p.p -= 320; else if(p.p < -160) p.p += 320;
        p.ph += p.sp*3.6*p.walking*dt;
        const bob = Math.abs(Math.sin(p.ph))*.04*p.walking;
        if(p.axis === 'x') V.set(p.p, bob, p.line); else V.set(p.line, bob, p.p);
        const yaw = p.axis === 'x' ? (p.dir>0 ? Math.PI/2 : -Math.PI/2) : (p.dir>0 ? 0 : Math.PI);
        Q.setFromAxisAngle(Y, yaw); S.setScalar(p.s);
        M.compose(V, Q, S);
        const G = PED.groups[p.model];
        if(G){ G.body.setMatrixAt(p.slot, M); if(G.canopy) G.canopy.setMatrixAt(p.slot, M); G.walk.setXY(p.slot, p.ph, p.walking); }
      });
      for(const id in PED.groups){ const G = PED.groups[id]; G.body.instanceMatrix.needsUpdate = true; if(G.canopy) G.canopy.instanceMatrix.needsUpdate = true; G.walk.needsUpdate = true; }
    };
  }

  /* ================= Clouds and rooftop searchlights projecting city emblems ================= */
  const CLOUD_Y = 178;
  let skyFx = () => {};
  function buildCloudsAndBeams(){
    // pick a handful of tall, well separated towers
    const chosen = [];
    TOPS.filter(t=>t.top > 50).sort((a,b)=>b.top-a.top).forEach(t=>{
      if(chosen.length >= 7) return;
      if(chosen.some(c=>Math.hypot(c.x-t.x, c.z-t.z) < 70)) return;
      if(Object.values(LOC).some(l=>Math.hypot(l.obj[0]-t.x, l.obj[2]-t.z) < 20)) return;
      chosen.push(t);
    });
    const beamCols = [0xbfe9ff, 0xffd6ec, 0xfff0c8];
    const spots = [], spotCols = [], kinds = [];
    for(let i=0;i<8;i++){ spots.push(new THREE.Vector3(1e5,1e5,0)); spotCols.push(new THREE.Color(0,0,0)); kinds.push(i%2); }

    const cloud = new THREE.Mesh(new THREE.PlaneGeometry(3600,3600).rotateX(Math.PI/2), new THREE.ShaderMaterial({
      uniforms:{ time:U.time, uFog:{value:FOG}, uSpots:{value:spots}, uSpotCols:{value:spotCols}, uKinds:{value:kinds} },
      transparent:true, depthWrite:false, side:THREE.DoubleSide,
      extensions:{derivatives:true},
      vertexShader:`varying vec3 vW; varying float vDepth; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix*w; vDepth = -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader:`varying vec3 vW; varying float vDepth; uniform float time; uniform vec3 uFog;
        uniform vec3 uSpots[8]; uniform vec3 uSpotCols[8]; uniform float uKinds[8];
        ${NOISE}
        float aas(float e, float x, float w){ return smoothstep(e - w, e + w, x); }
        float emblem(vec2 r, float kind, float w){
          if(kind < 0.5){ // city eye
            float lens = aas(0.0, 0.36*(1.0 - r.x*r.x/0.5) - abs(r.y), w) * aas(0.0, 0.7 - abs(r.x), w);
            float iris = 1.0 - aas(0.21, length(r), w);
            float pupil = 1.0 - aas(0.085, length(r), w);
            return clamp(lens - iris + pupil, 0.0, 1.0);
          }
          // planet inside the orbital ring
          float planet = 1.0 - aas(0.3, length(r), w);
          vec2 e = vec2(r.x, (r.y + r.x*0.28)*3.0);
          float ring = 1.0 - aas(0.075, abs(length(e) - 0.66), w*3.0);
          float front = step(0.0, r.y + r.x*0.28);
          return clamp(planet*(1.0 - ring*front) + ring*(1.0 - planet*(1.0-front)), 0.0, 1.0);
        }
        void main(){
          vec2 p = vW.xz;
          float px = length(fwidth(p));
          vec3 s = vec3(p*0.0042 + vec2(time*0.006, time*0.003), time*0.008);
          float n = fbm(s);
          float n2 = fbm(vec3(p*0.011 - time*0.004, 3.0));
          float dens = smoothstep(0.5, 0.74, n*0.72 + n2*0.38);
          float city = exp(-length(p)/340.0);
          vec3 col = (vec3(0.06,0.06,0.12) + vec3(0.42,0.12,0.36)*city*0.8 + vec3(0.04,0.2,0.26)*city*n)*(0.65 + 0.7*n2);
          float alpha = dens*0.9;
          // searchlight spots
          vec3 spot = vec3(0.0); float spotA = 0.0;
          for(int i=0;i<8;i++){
            vec2 r = (p - uSpots[i].xy)/24.0; float rr = length(r);
            if(rr > 1.6) continue;
            float w = length(fwidth(r))*0.8 + 0.004;
            float disk = 1.0 - aas(0.92, rr, w*2.0);
            float glow = exp(-rr*rr*1.6)*0.3;
            float lit = disk*(1.0 - emblem(r, uKinds[i], w)*0.92) + glow;
            spot += uSpotCols[i]*lit;
            spotA = max(spotA, disk*0.5 + glow);
          }
          col += spot*(0.8 + 1.1*dens);
          alpha = max(alpha, spotA*(0.35 + 0.5*dens));
          // fade into the horizon and wherever the noise would alias
          float hd = length(vW.xz - cameraPosition.xz);
          alpha *= (1.0 - smoothstep(550.0, 1300.0, hd)) * (1.0 - smoothstep(4.0, 14.0, px));
          col = mix(col, uFog, smoothstep(300.0, 1200.0, hd)*0.6);
          gl_FragColor = vec4(col, alpha);
        }`
    }));
    cloud.position.y = CLOUD_Y; cloud.renderOrder = 2; scene.add(cloud);

    const beamMat = hex => new THREE.ShaderMaterial({
      uniforms:{ col:{value:new THREE.Color(hex)}, uD:{value:FOG_D} },
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
      vertexShader:`varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vDepth;
        void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vDepth = -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader:`uniform vec3 col; uniform float uD; varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vDepth;
        void main(){
          float edge = pow(abs(dot(vN, vV)), 1.6);
          float a = (0.3*pow(1.0 - vUv.y, 1.6) + 0.07)*edge;
          float fog = exp(-uD*uD*vDepth*vDepth*0.35);
          gl_FragColor = vec4(col*a*fog, 1.0);
        }`
    });
    const beamGeo = new THREE.CylinderGeometry(1, .035, 1, 40, 1, true).translate(0,.5,0);
    const lamps = chosen.map((t,i)=>{
      const base = new THREE.Vector3(t.x, t.top + 1.4, t.z);
      const housing = new THREE.Group(); housing.position.copy(base);
      housing.add(new THREE.Mesh(cyl(1.1,1.3,.6,16).translate(0,-1.1,0), MAT.dark));
      const head = new THREE.Group();
      head.add(new THREE.Mesh(cyl(.85,.95,1.4,20), MAT.chrome));
      head.add(new THREE.Mesh(new THREE.CircleGeometry(.8,24).rotateX(-Math.PI/2).translate(0,.71,0), BM(0xffffff)));
      housing.add(head); scene.add(housing);
      const beam = new THREE.Mesh(beamGeo, beamMat(beamCols[i % 3])); beam.renderOrder = 3; scene.add(beam);
      spotCols[i].setHex(beamCols[i % 3]);
      return {base, head, beam, a0: rnd()*Math.PI*2, ph: rnd()*6.28, sp: .05 + rnd()*.05, i};
    });
    const dir = new THREE.Vector3(), up = new THREE.Vector3(0,1,0), q = new THREE.Quaternion();
    skyFx = t => {
      lamps.forEach(L=>{
        const a = L.a0 + Math.sin(t*L.sp + L.ph)*1.1;
        const tilt = .32 + .14*Math.sin(t*.07 + L.ph*2.0);
        dir.set(Math.sin(a)*tilt, 1, Math.cos(a)*tilt).normalize();
        const len = (CLOUD_Y - L.base.y)/dir.y;
        q.setFromUnitVectors(up, dir);
        L.beam.position.copy(L.base); L.beam.quaternion.copy(q); L.beam.scale.set(24, len, 24);
        L.head.quaternion.copy(q);
        spots[L.i].set(L.base.x + dir.x*len, L.base.z + dir.z*len, 0);
      });
    };
  }

  /* ================= Weather and atmosphere: rain, splashes, lamp light cones, neon haze, steam ================= */
  const ATM = { rain:null, splash:null, cones:null, haze:null, steam:null, sheets:null };
  const quadGeo = (instances, seeds) => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-.5,0,0, .5,0,0, .5,1,0, -.5,1,0], 3));
    g.setIndex([0,1,2, 0,2,3]);
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    g.instanceCount = instances;
    return g;
  };
  const seeds4 = n => { const a = new Float32Array(n*4); for(let i=0;i<a.length;i++) a[i] = rnd(); return a; };
  const RAIN_MAX = 34000;
  function buildAtmos(){
    /* rain: two layers of streaks in boxes that travel with the camera */
    {
      const mat = new THREE.ShaderMaterial({
        uniforms:{ time:U.time, uCam:{value:new THREE.Vector3()}, uBox:{value:new THREE.Vector3(64, 56, 64)}, uWind:{value:new THREE.Vector2(3.5, 1.5)} },
        transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
        vertexShader:`attribute vec4 aSeed; uniform float time; uniform vec3 uCam; uniform vec3 uBox; uniform vec2 uWind;
          varying float vA; varying float vX; varying float vY; varying vec3 vTint;
          void main(){
            float layer = step(0.5, aSeed.w), nearL = step(aSeed.w, 0.1);
            vec3 box = uBox*mix(mix(vec3(1.0), vec3(2.6, 2.2, 2.6), layer), vec3(0.28, 0.4, 0.28), nearL);
            float r2 = fract(aSeed.w*7.31), r3 = fract(aSeed.w*13.7 + aSeed.x*3.1);
            float sp = 26.0 + r2*12.0;
            vec3 p = aSeed.xyz*box + vec3(uWind.x, -sp, uWind.y)*time;
            vec3 lo = uCam - box*0.5;
            vec3 w = mod(p - lo, box) + lo;
            vec3 dir = normalize(vec3(uWind.x, -sp, uWind.y));
            vec3 toCam = cameraPosition - w; float dist = length(toCam);
            vec3 side = normalize(cross(dir, toCam/dist));
            float wid = max(0.03, dist*0.0032)*mix(1.0, 3.2, nearL);
            float len = mix(1.3, 3.0, r3)*mix(1.0, 1.6, layer)*mix(1.0, 0.7, nearL);
            vec3 pos = w + side*position.x*wid - dir*position.y*len;
            vA = smoothstep(0.0, 2.0, w.y)*(1.0 - smoothstep(box.x*0.32, box.x*0.5, dist))*smoothstep(0.5, 2.0, dist)*mix(1.0, 0.75, layer)*mix(1.0, 0.45, nearL);
            // the city lights the rain from below; high up it only catches the sky glow
            vA *= 0.8 + 0.6*exp(-max(w.y, 0.0)/34.0);
            vX = position.x; vY = position.y;
            float k = fract(aSeed.x*7.13 + aSeed.z*3.7);
            vTint = k < 0.12 ? vec3(0.55,0.95,1.0) : (k < 0.18 ? vec3(1.0,0.6,0.85) : vec3(0.82,0.92,0.96));
            gl_Position = projectionMatrix*viewMatrix*vec4(pos, 1.0);
          }`,
        fragmentShader:`varying float vA; varying float vX; varying float vY; varying vec3 vTint;
          void main(){
            float x = 1.0 - abs(vX)*2.0;
            float a = vA*x*(0.2 + 0.8*vY)*1.05;
            gl_FragColor = vec4(vTint*a, 1.0);
          }`
      });
      ATM.rain = new THREE.Mesh(quadGeo(RAIN_MAX, seeds4(RAIN_MAX)), mat);
      ATM.rain.frustumCulled = false; ATM.rain.renderOrder = 6; scene.add(ATM.rain); REFL.hide.push(ATM.rain);
    }
    /* rain curtains: tall veils between the towers that make the downpour readable at any distance */
    {
      const n = 90, g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-.5,0,0, .5,0,0, .5,1,0, -.5,1,0], 3));
      g.setIndex([0,1,2, 0,2,3]);
      const c = new Float32Array(n*4);
      for(let i=0;i<n;i++){ const a = rnd()*Math.PI*2, r = 30 + Math.sqrt(rnd())*300; c.set([Math.cos(a)*r, Math.sin(a)*r, 50 + rnd()*60, rnd()], i*4); }
      g.setAttribute('aC', new THREE.InstancedBufferAttribute(c, 4)); g.instanceCount = n;
      const mat = new THREE.ShaderMaterial({
        uniforms:{ time:U.time, uFog:{value:FOG}, uD:{value:FOG_D}, uTint:{value:new THREE.Color(0x9aa8e0)} },
        transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
        extensions:{derivatives:true},
        vertexShader:`attribute vec4 aC; uniform float time; varying vec2 vUv; varying vec2 vQ; varying float vA; varying float vY; varying float vDepth;
          void main(){
            vec3 c = vec3(aC.x, 0.0, aC.y);
            vec3 toCam = cameraPosition - c; toCam.y = 0.0;
            vec3 sx = normalize(vec3(-toCam.z, 0.0, toCam.x) + 1e-4);
            float H = 230.0;
            vec3 w = c + sx*position.x*aC.z + vec3(0.0, position.y*H, 0.0);
            w.x += position.y*H*0.09; w.z += position.y*H*0.04;
            vUv = position.xy + vec2(0.5, 0.0);
            vQ = vec2(position.x*aC.z, position.y*H);
            float dist = length(cameraPosition - w);
            vA = smoothstep(35.0, 90.0, dist);
            vY = w.y;
            vec4 mv = viewMatrix*vec4(w, 1.0); vDepth = -mv.z;
            gl_Position = projectionMatrix*mv;
          }`,
        fragmentShader:`uniform float time; uniform vec3 uFog; uniform float uD; uniform vec3 uTint; varying vec2 vUv; varying vec2 vQ; varying float vA; varying float vY; varying float vDepth;
          float h1(float n){ return fract(sin(n*12.9898)*43758.5453); }
          void main(){
            // soft vertical streaks that slide down; they blur into an even veil before they could alias
            vec2 q = vec2(vQ.x/0.9, vQ.y/14.0 + time*1.9);
            float id = floor(q.x), r = h1(id);
            float fx = abs(fract(q.x) - 0.5)*2.0;
            float fy = fract(q.y + r*7.0);
            float streak = (1.0 - smoothstep(0.2, 1.0, fx))*smoothstep(0.0, 0.5, fy)*(1.0 - smoothstep(0.6, 1.0, fy))*(0.4 + 0.6*r);
            float lod = smoothstep(0.25, 0.7, fwidth(q.x));
            float v = mix(streak, 0.22, lod);
            float edge = smoothstep(0.0, 0.25, vUv.x)*smoothstep(1.0, 0.75, vUv.x)*smoothstep(0.0, 6.0, vY)*(1.0 - smoothstep(110.0, 200.0, vY));
            float glow = 0.35 + 1.1*exp(-vY/40.0);
            float fog = 1.0 - exp(-uD*uD*vDepth*vDepth);
            float a = v*edge*glow*vA*0.11*(1.0 - fog*0.7);
            gl_FragColor = vec4(uTint*a, 1.0);
          }`
      });
      ATM.sheets = new THREE.Mesh(g, mat); ATM.sheets.frustumCulled = false; ATM.sheets.renderOrder = 5; scene.add(ATM.sheets); REFL.hide.push(ATM.sheets);
    }
    /* splashes: tiny rings that bloom and fade on the wet ground near the camera */
    {
      const n = 2400;
      const mat = new THREE.ShaderMaterial({
        uniforms:{ time:U.time, uCam:{value:new THREE.Vector3()} },
        transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
        vertexShader:`attribute vec4 aSeed; uniform float time; uniform vec3 uCam; varying vec2 vUv; varying float vPh; varying float vA;
          void main(){
            float S = 56.0;
            float ph = fract(time*(1.4 + aSeed.w) + aSeed.z*13.0);
            float cyc = floor(time*(1.4 + aSeed.w) + aSeed.z*13.0);
            vec2 base = fract(aSeed.xy + vec2(cyc*0.618, cyc*0.382))*S;
            vec2 lo = uCam.xz - S*0.5;
            vec2 xz = mod(base - lo, S) + lo;
            float r = 0.06 + ph*0.22;
            vec3 pos = vec3(xz.x + position.x*r*2.0, 0.03, xz.y + (position.y - 0.5)*r*2.0);
            vUv = vec2(position.x, position.y - 0.5)*2.0; vPh = ph;
            vA = (1.0 - smoothstep(14.0, 28.0, distance(xz, uCam.xz))) * (1.0 - smoothstep(25.0, 50.0, uCam.y));
            gl_Position = projectionMatrix*viewMatrix*vec4(pos, 1.0);
          }`,
        fragmentShader:`varying vec2 vUv; varying float vPh; varying float vA;
          void main(){
            float d = length(vUv);
            float ring = smoothstep(0.62, 0.86, d)*(1.0 - smoothstep(0.86, 1.0, d));
            float a = ring*(1.0 - vPh)*vA*0.5;
            gl_FragColor = vec4(vec3(0.7,0.8,1.0)*a, 1.0);
          }`
      });
      ATM.splash = new THREE.Mesh(quadGeo(n, seeds4(n)), mat);
      ATM.splash.frustumCulled = false; ATM.splash.renderOrder = 5; scene.add(ATM.splash); REFL.hide.push(ATM.splash);
    }
    /* light cones under every street lamp, with rain glinting inside */
    {
      const R = 6, list = [];
      for(let k=-R;k<=R;k++) for(let id=-20; id<=19; id++){
        const al = id*15 + 7.5;
        for(const side of [0,1]){
          const s = side ? 1 : -1;
          list.push([k*45 + s*3.9 - s*1.2, al, Math.abs(k*7 + id*3 + side) % 3]);
          list.push([al, k*45 + s*3.9 - s*1.2, Math.abs(k*5 + id*2 + side + 1) % 3]);
        }
      }
      const geo = new THREE.ConeGeometry(2.5, 5.0, 24, 1, true).translate(0, -2.5, 0);
      const mat = new THREE.ShaderMaterial({
        uniforms:{ time:U.time, uD:{value:FOG_D} },
        transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
        vertexShader:`varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vH; varying float vDepth;
          void main(){
            vec4 w = modelMatrix*instanceMatrix*vec4(position,1.0); vW = w.xyz;
            vN = normalize(mat3(modelMatrix*instanceMatrix)*normal);
            vH = clamp(-position.y/5.0, 0.0, 1.0);
            #ifdef USE_INSTANCING_COLOR
              vC = instanceColor;
            #else
              vC = vec3(1.0);
            #endif
            vec4 mv = viewMatrix*w; vDepth = -mv.z; gl_Position = projectionMatrix*mv;
          }`,
        fragmentShader:`varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vH; varying float vDepth; uniform float time; uniform float uD;
          float h1(vec2 p){ return fract(sin(dot(floor(p), vec2(12.9898, 78.233)))*43758.5453); }
          void main(){
            vec3 V = normalize(cameraPosition - vW);
            float edge = pow(abs(dot(normalize(vN), V)), 2.0);
            float a = edge*smoothstep(0.0, 0.15, vH)*(1.0 - vH)*(1.0 - vH)*0.075;
            // falling glints: a column grid that scrolls down; widened far away to avoid shimmer
            vec2 g = vec2((vW.x + vW.z)*9.0, vW.y*1.6 + time*14.0);
            float glint = step(0.93, h1(g))*smoothstep(0.0, 0.25, fract(g.y))*(1.0 - smoothstep(25.0, 60.0, vDepth));
            a += glint*edge*0.25*(1.0 - vH*0.5);
            a *= exp(-uD*uD*vDepth*vDepth*0.6)*smoothstep(3.0, 11.0, vDepth);
            gl_FragColor = vec4(vC*a, 1.0);
          }`
      });
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      const dm = new THREE.Object3D(), c = new THREE.Color();
      list.forEach(([x,z,ci],i)=>{ dm.position.set(x, 5.05, z); dm.updateMatrix(); m.setMatrixAt(i, dm.matrix); m.setColorAt(i, c.setHex([0x3ef2ff,0xff3ea5,0xffc46b][ci])); });
      m.frustumCulled = false; m.renderOrder = 4; scene.add(m); ATM.cones = m; REFL.hide.push(m);
    }
    /* neon haze: big soft glows hanging in the street canyons */
    {
      const n = 220, s = new Float32Array(n*4), col = new Float32Array(n*3);
      const pal = [[0.24,0.95,1.0],[1.0,0.24,0.65],[1.0,0.62,0.3],[0.6,0.36,1.0]];
      for(let i=0;i<n;i++){
        let k; do{ k = Math.floor(rnd()*11)-5; }while(k===0);
        const along = (rnd()-.5)*420, axis = rnd()<.5;
        s[i*4] = axis ? k*45 + (rnd()-.5)*6 : along; s[i*4+1] = 3 + rnd()*22; s[i*4+2] = axis ? along : k*45 + (rnd()-.5)*6; s[i*4+3] = 10 + rnd()*22;
        col.set(pal[Math.floor(rnd()*pal.length)], i*3);
      }
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-.5,-.5,0, .5,-.5,0, .5,.5,0, -.5,.5,0], 3)); g.setIndex([0,1,2,0,2,3]);
      g.setAttribute('aP', new THREE.InstancedBufferAttribute(s, 4)); g.setAttribute('aC', new THREE.InstancedBufferAttribute(col, 3)); g.instanceCount = n;
      const mat = new THREE.ShaderMaterial({
        uniforms:{ time:U.time, uD:{value:FOG_D} },
        transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
        vertexShader:`attribute vec4 aP; attribute vec3 aC; uniform float time; varying vec2 vUv; varying vec3 vC; varying float vF;
          void main(){
            vec4 mv = viewMatrix*vec4(aP.xyz + vec3(sin(time*0.05 + aP.x)*2.0, 0.0, cos(time*0.04 + aP.z)*2.0), 1.0);
            mv.xy += position.xy*aP.w;
            vUv = position.xy*2.0; vC = aC;
            vF = smoothstep(4.0, 18.0, -mv.z);
            gl_Position = projectionMatrix*mv;
          }`,
        fragmentShader:`varying vec2 vUv; varying vec3 vC; varying float vF; uniform float uD;
          void main(){ float d = dot(vUv, vUv); float a = exp(-d*3.0)*0.07*vF; gl_FragColor = vec4(vC*a, 1.0); }`
      });
      ATM.haze = new THREE.Mesh(g, mat); ATM.haze.frustumCulled = false; ATM.haze.renderOrder = 3; scene.add(ATM.haze); REFL.hide.push(ATM.haze);
    }
    /* steam rising from street vents */
    {
      const vents = [];
      for(let i=0;i<46;i++){ let k; do{ k = Math.floor(rnd()*11)-5; }while(k===0); const along = (rnd()-.5)*420; vents.push(rnd()<.5 ? [k*45 + (rnd()-.5)*3, along] : [along, k*45 + (rnd()-.5)*3]); }
      const per = 14, n = vents.length*per, s = new Float32Array(n*4);
      vents.forEach(([x,z],v)=>{ for(let j=0;j<per;j++){ const i = v*per + j; s[i*4] = x; s[i*4+1] = z; s[i*4+2] = j/per; s[i*4+3] = rnd(); } });
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-.5,-.5,0, .5,-.5,0, .5,.5,0, -.5,.5,0], 3)); g.setIndex([0,1,2,0,2,3]);
      g.setAttribute('aS', new THREE.InstancedBufferAttribute(s, 4)); g.instanceCount = n;
      const mat = new THREE.ShaderMaterial({
        uniforms:{ time:U.time },
        transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
        vertexShader:`attribute vec4 aS; uniform float time; varying vec2 vUv; varying float vA;
          void main(){
            float ph = fract(aS.z + time*0.12 + aS.w*0.1);
            vec3 c = vec3(aS.x + sin(ph*5.0 + aS.w*6.0)*0.6 + ph*1.5, 0.3 + ph*9.0, aS.y + cos(ph*4.0 + aS.w*5.0)*0.6);
            vec4 mv = viewMatrix*vec4(c, 1.0);
            float sz = 1.2 + ph*5.5;
            mv.xy += position.xy*sz;
            vUv = position.xy*2.0;
            vA = smoothstep(0.0, 0.12, ph)*(1.0 - ph)*smoothstep(3.0, 9.0, -mv.z)*(1.0 - smoothstep(80.0, 160.0, -mv.z));
            gl_Position = projectionMatrix*mv;
          }`,
        fragmentShader:`varying vec2 vUv; varying float vA;
          void main(){ float a = exp(-dot(vUv, vUv)*2.6)*vA*0.09; gl_FragColor = vec4(vec3(0.75,0.72,0.95)*a, 1.0); }`
      });
      ATM.steam = new THREE.Mesh(g, mat); ATM.steam.frustumCulled = false; ATM.steam.renderOrder = 3; scene.add(ATM.steam); REFL.hide.push(ATM.steam);
    }
  }
  function updateAtmos(){
    if(!ATM.rain) return;
    ATM.rain.material.uniforms.uCam.value.copy(camera.position);
    ATM.splash.material.uniforms.uCam.value.copy(camera.position);
  }

  /* final colour pass: split-tone, gentle contrast, edge fringing, vignette */
  const GradeShader = {
    uniforms:{ tDiffuse:{value:null}, time:U.time, uAspect:{value:1}, uRain:{value:1} },
    vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform sampler2D tDiffuse; uniform float time; uniform float uAspect; uniform float uRain; varying vec2 vUv;
      float h1(float n){ return fract(sin(n*12.9898)*43758.5453); }
      float rainLayer(vec2 uv, float cols, float speed, float len, float seed){
        vec2 q = vec2((uv.x*uAspect + uv.y*0.09)*cols, uv.y);
        float id = floor(q.x), fx = fract(q.x);
        float r = h1(id + seed);
        float x = abs(fx - 0.5);
        float line = 1.0 - smoothstep(0.08, 0.22, x);
        float y = fract(q.y*(1.4 + r) + time*speed*(0.8 + r*0.4) + r*10.0);
        float seg = smoothstep(0.0, 0.05, y)*(1.0 - smoothstep(len*0.6, len, y));
        return line*seg*step(0.55, r);
      }
      void main(){
        vec2 d = vUv - 0.5; float r2 = dot(d, d);
        float ca = 0.011*r2 + 0.0004;
        vec3 c = vec3(texture2D(tDiffuse, vUv + d*ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d*ca).b);
        float l = dot(c, vec3(0.3, 0.59, 0.11));
        c = mix(c, c*vec3(0.88, 0.97, 1.15) + vec3(0.004, 0.004, 0.016), 1.0 - smoothstep(0.0, 0.3, l));
        c = mix(c, c*vec3(1.05, 0.98, 1.0), smoothstep(0.45, 1.0, l));
        c = max((c - 0.5)*1.05 + 0.5, 0.0) + vec3(0.004, 0.006, 0.012);
        float rn = rainLayer(vUv, 180.0, 1.9, 0.18, 1.0)*0.5 + rainLayer(vUv, 95.0, 1.3, 0.12, 7.0)*0.35;
        c += vec3(0.75, 0.85, 0.9)*rn*0.16*uRain;
        c *= mix(1.0, 0.58, smoothstep(0.12, 0.62, r2*2.0));
        gl_FragColor = vec4(c, 1.0);
      }`
  };

  /* ================= Hologram fauna: whale sharks and koi (detailed GLB models) swimming over the towers ================= */
  function buildKoi(){
    const mats = {};
    const holo = (key, map, colA, colB, part, len, z0, ph) => new THREE.ShaderMaterial({
      uniforms:{ time:U.time, map:{value:map}, uA:{value:new THREE.Color(colA)}, uB:{value:new THREE.Color(colB)}, uLen:{value:len}, uZ0:{value:z0}, uPh:{value:ph}, uD:{value:FOG_D}, bass:U.bass },
      defines:{ PART: part.toFixed(1), HASMAP: map ? 1 : 0 },
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
      vertexShader:`uniform float time; uniform float uLen; uniform float uZ0; uniform float uPh;
        varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vU; varying vec3 vP; varying float vDepth;
        void main(){
          vec3 p = position;
          // 0 at the tail, 1 at the nose; the body bends more towards the tail
          float u = clamp((p.z - uZ0)/uLen, 0.0, 1.0);
          float k = pow(1.0 - u, 1.6);
          float wave = sin(u*5.2 - time*1.7 + uPh);
          p.x += wave*k*uLen*0.11;
          vec3 n = normal; n.x -= cos(u*5.2 - time*1.7 + uPh)*k*0.5*n.z;
          vU = u; vP = position; vUv = uv;
          vec4 w = modelMatrix*vec4(p, 1.0);
          vN = normalize(mat3(modelMatrix)*n); vV = normalize(cameraPosition - w.xyz);
          vec4 mv = viewMatrix*w; vDepth = -mv.z;
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader:`uniform vec3 uA; uniform vec3 uB; uniform float time; uniform sampler2D map; uniform float uD; uniform float bass;
        varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vU; varying vec3 vP; varying float vDepth;
        void main(){
          float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
          vec3 c = mix(uB, uA, smoothstep(0.1, 0.9, vU));
          float pat = 0.5;
          #if HASMAP == 1
            pat = dot(texture2D(map, vUv).rgb, vec3(0.3, 0.59, 0.11));
          #endif
          float scan = 0.75 + 0.25*sin(vP.y*9.0 - time*3.0);
          float sweep = exp(-pow((fract(vU*0.8 - time*0.12) - 0.5)*9.0, 2.0));
          vec3 col;
          if(PART < 0.5){        // skin: pattern from the model's texture, bright rim
            col = c*(0.04 + fr*0.85) + c*smoothstep(0.3, 0.95, pat)*0.16 + mix(c, vec3(1.0), 0.4)*smoothstep(0.85, 1.0, pat)*0.07;
          } else if(PART < 1.5){ // fins: faint, with the texture's rays and spots
            col = c*(0.04 + 0.16*pat + fr*0.35);
          } else if(PART < 2.5){ // glowing details: gills, eyes
            col = mix(c, vec3(1.0), 0.6)*1.2;
          } else {               // ridges and lips
            col = c*0.35;
          }
          col *= scan*(1.0 + sweep*0.5 + bass*0.4);
          float fog = 1.0 - exp(-uD*uD*vDepth*vDepth*0.5);
          gl_FragColor = vec4(col*(1.0 - fog), 1.0);
        }`
    });
    const fish = [];
    const PARTS = { skin:0, fin:1, gill:2, eye:2, ridge:3, mouth:3 };
    const add = (id, scale, colA, colB, path) => GLBLIB().then(lib => lib[id] ? parseGLB(lib[id]) : null).then(root=>{
      if(!root) return;
      const bb = new THREE.Box3().setFromObject(root);
      const len = bb.max.z - bb.min.z;
      const g = new THREE.Group();
      root.updateMatrixWorld(true);
      root.traverse(o=>{
        if(!o.isMesh) return;
        const geo = o.geometry.clone();
        // bake quantization / node transforms so the swim bend runs in model metres
        const keep = ['position','normal','uv'];
        const out = new THREE.BufferGeometry();
        keep.forEach(k=>{ const a = geo.attributes[k]; if(!a) return; const arr = new Float32Array(a.count*a.itemSize); for(let i=0;i<a.count;i++){ arr[i*a.itemSize] = a.getX(i); arr[i*a.itemSize+1] = a.getY(i); if(a.itemSize > 2) arr[i*a.itemSize+2] = a.getZ(i); } out.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize)); });
        out.setIndex(geo.index ? Array.from(geo.index.array) : null);
        out.applyMatrix4(o.matrixWorld);
        const part = PARTS[o.material.name] ?? 3;
        const map = o.material.map || null;
        if(map){ map.colorSpace = THREE.NoColorSpace; map.needsUpdate = true; }
        const m = new THREE.Mesh(out, holo(id, map, colA, colB, part, len, bb.min.z, path.ph));
        m.frustumCulled = false; m.renderOrder = 7;
        g.add(m);
      });
      g.scale.setScalar(scale);
      scene.add(g); REFL.hide.push(g);
      fish.push({g, ...path});
    });
    add('whale_shark', 4.2, 0x7ad8ff, 0x6a5cff, {r:150, y:150, w:.022, ph:0, bob:9});
    add('whale_shark', 3.4, 0x3ef2ff, 0xb46bff, {r:230, y:118, w:-.016, ph:2.8, bob:7});
    add('koi_kohaku', 8.5, 0xff8a4d, 0xff3ea5, {r:62, y:62, w:.05, ph:1.2, bob:6});
    add('koi_showa', 9.5, 0xffb05a, 0x3ef2ff, {r:104, y:94, w:-.034, ph:4.0, bob:6});
    anim.push(t=>fish.forEach(f=>{
      const a = f.ph + f.w*t;
      f.g.position.set(Math.cos(a)*f.r, f.y + Math.sin(t*.3 + f.ph)*f.bob, Math.sin(a)*f.r);
      // head (+Z) along the direction of travel, banking into the turn
      f.g.rotation.set(Math.cos(t*.3 + f.ph)*.08, Math.atan2(-Math.sin(a)*f.w, Math.cos(a)*f.w), -Math.sign(f.w)*.14);
    }));
  }

  /* ================= Post-processing ================= */
  let composer = null, bloom = null, gradePass = null;
  if(THREE.EffectComposer && THREE.UnrealBloomPass){
    const rt = new THREE.WebGLRenderTarget(2, 2, {samples:4});
    composer = new THREE.EffectComposer(renderer, rt);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256,256), .7, .42, .74);
    composer.addPass(bloom);
    gradePass = new THREE.ShaderPass(GradeShader); composer.addPass(gradePass);
  }


  /* ================= Hangar, player vehicle, chase camera ================= */
  const CARS = {
    ten:     {name:'Тень',    kind:'ground', desc:'Широкое купе. Едет по улицам, держит дорогу.',  glow:0x3ef2ff, max:48, acc:20, turn:1.6, sv:.75, tv:.8,  R:.37},
    bastion: {name:'Бастион', kind:'ground', desc:'Броневик. Медленный разгон, но неудержим.',     glow:0xffa02a, max:36, acc:12, turn:1.1, sv:.5,  tv:.45, R:.5},
    iskra:   {name:'Искра',   kind:'ground', desc:'Мотоцикл. Самый резкий на земле.',              glow:0xff3ea5, max:56, acc:26, turn:2.0, sv:.9,  tv:1,   R:.34},
    korona:  {name:'Корона',  kind:'air',    desc:'Ховер-купе. Плавное и послушное.',              glow:0x3ef2ff, max:55, acc:18, turn:1.3, sv:.7,  tv:.65},
    skat:    {name:'Скат',    kind:'air',    desc:'Самый быстрый в небе.',                         glow:0xff3ea5, max:78, acc:26, turn:1.5, sv:1,   tv:.8},
    vektor:  {name:'Вектор',  kind:'air',    desc:'Аэротакси. Тяжёлое, но устойчивое.',           glow:0xffc46b, max:42, acc:12, turn:1.0, sv:.5,  tv:.45},
  };
  const GLB = {};
  function loadCar(id){
    if(!GLB[id]){
      const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
      GLB[id] = loader.loadAsync(ASSETS + 'cars/' + id + '.glb').then(g=>{
        const root = g.scene;
        // the city renders without colour management: bring glTF colours back to their authored values
        const seen = new Set();
        root.traverse(o=>{ if(!o.isMesh) return; o.frustumCulled = false; const m = o.material; if(seen.has(m)) return; seen.add(m);
          if(m.color) m.color.convertLinearToSRGB(); if(m.emissive) m.emissive.convertLinearToSRGB(); });
        return root;
      });
    }
    return GLB[id];
  }
  let driving = false, sel = 'ten', player = null, showModel = null, starting = false;
  const showcase = new THREE.Group(); showcase.position.set(...LOC.fly.look); scene.add(showcase);
  function fitScale(obj){ const s = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()); return Math.min(1.45, 6.2/Math.max(s.x, s.z)); }
  function setShowcase(k){
    loadCar(k).then(root=>{
      if(sel !== k) return;
      if(showModel) showcase.remove(showModel);
      showModel = root.clone(); showModel.scale.setScalar(1); showModel.scale.setScalar(fitScale(showModel));
      showModel.userData.parts = collectParts(showModel);
      showModel.userData.base = CARS[k].kind === 'ground' ? -1.55 : -0.7;
      showcase.add(showModel);
    }).catch(()=>{});
  }
  function buildShowcase(){
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.4,.12,8,64).rotateX(Math.PI/2), BM(0x3ef2ff)); ring.position.y = -1.6;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(5.2,.05,6,64).rotateX(Math.PI/2), BM(0xff3ea5)); ring2.position.y = -1.6;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(4.3,48).rotateX(-Math.PI/2), BM(0x3ef2ff,{transparent:true, opacity:.12, depthWrite:false})); disc.position.y = -1.62;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(4.3,4.3,30,48,1,true).translate(0,-16.6,0), BM(0x3ef2ff,{transparent:true, opacity:.05, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
    showcase.add(ring, ring2, disc, beam);
    setShowcase(sel);
    anim.push(t=>{
      if(showModel){
        showModel.rotation.y = t*.45; showModel.position.y = showModel.userData.base + (CARS[sel].kind === 'air' ? Math.sin(t*1.3)*.25 : 0);
        // the hangar shows off the mechanics: wheels steer, nozzles and fans swivel on their own
        if(showModel.userData.parts) animateParts(showModel.userData.parts, sel, Math.sin(t*.9), Math.sin(t*.55), Math.sin(t*.4)*.7, 6, 1/60);
      }
      ring2.rotation.y = -t*.3;
    });
  }



  const ENG = { start: () => AUDIO.engineStart(), update: (s, thr) => AUDIO.engineUpdate(s, thr), stop: () => AUDIO.engineStop() };

  const P = new THREE.Vector3(), FWD = new THREE.Vector3(), prev = new THREE.Vector3(), desired = new THREE.Vector3(), aim = new THREE.Vector3();
  let yaw = 0, yawRate = 0, v = 0, vy = 0, roll = 0, pitch = 0, shake = 0, hudT = 0;
  const K = { fwd:false, back:false, left:false, right:false, up:false, down:false, boost:false }, T = {x:0, y:0};
  const onBlur = () => { for(const k in K) K[k] = false; };
  addEventListener('blur', onBlur);

  /* tail-light streaks: each rear light leaves a short glowing smear, like a long exposure.
     Every light gets two crossed ribbons (flat and upright), so the streak reads from the chase camera right behind it too. */
  const trail = (()=>{
    const N = 56, LIFE = .65, MAXE = 2, RIB = MAXE*2;
    const pos = new Float32Array(RIB*N*2*3), age = new Float32Array(RIB*N*2), across = new Float32Array(RIB*N*2);
    const pts = Array.from({length:MAXE}, ()=>Array.from({length:N}, ()=>new THREE.Vector3()));
    const ups = Array.from({length:N}, ()=>new THREE.Vector3(0,1,0));
    const born = new Float32Array(N);
    for(let k=0;k<RIB*N;k++){ across[k*2] = 0; across[k*2+1] = 1; }
    const idx = [];
    for(let r=0;r<RIB;r++) for(let i=0;i<N-1;i++){ const a = (r*N + i)*2; idx.push(a, a+1, a+2, a+1, a+3, a+2); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAge', new THREE.BufferAttribute(age,1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aV', new THREE.BufferAttribute(across,1));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms:{ uCol:{value:new THREE.Color(0xff2a3c)}, uLife:{value:LIFE} },
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
      vertexShader:`attribute float aAge; attribute float aV; varying float vAge; varying float vV;
        void main(){ vV = aV; vAge = aAge; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader:`uniform vec3 uCol; uniform float uLife; varying float vAge; varying float vV;
        void main(){
          float k = clamp(vAge/uLife, 0.0, 1.0);
          float a = pow(1.0 - k, 2.0);
          float x = abs(vV - 0.5)*2.0;
          float core = exp(-x*x*8.0), halo = exp(-x*x*2.0)*0.3;
          vec3 c = uCol*(core + halo) + vec3(1.0, 0.8, 0.75)*core*core*0.3*(1.0 - k);
          gl_FragColor = vec4(c*a*0.55, 1.0);
        }`
    });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.visible = false; scene.add(mesh);
    let on = true, emit = [], count = 0;
    const dir = new THREE.Vector3(), side = new THREE.Vector3(), inv = new THREE.Matrix4();
    /** rear lights of the car, in its local space (lights on the wheel arches are skipped) */
    function findLights(obj){
      obj.updateMatrixWorld(true); inv.copy(obj.matrixWorld).invert();
      const box = new THREE.Box3(), b = new THREE.Box3(); let col = null;
      obj.traverse(o=>{
        if(!o.isMesh || o.material.name !== 'light_tail') return;
        for(let p = o.parent; p && p !== obj; p = p.parent) if(/^wheel_/.test(p.name)) return;
        if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).applyMatrix4(inv); box.union(b);
        if(!col && o.material.emissive) col = o.material.emissive.clone();
      });
      if(box.isEmpty()) return { pts:[new THREE.Vector3(0, .6, -2.2)], col };
      const c = box.getCenter(new THREE.Vector3()), w = box.max.x - box.min.x;
      const z = box.min.z + .02;
      return { pts: w > .6 ? [new THREE.Vector3(box.min.x + w*.14, c.y, z), new THREE.Vector3(box.max.x - w*.14, c.y, z)] : [new THREE.Vector3(c.x, c.y, z)], col };
    }
    function write(t){
      for(let r=0;r<RIB;r++){
        const e = r >> 1, upright = r & 1, P = pts[e];
        for(let i=0;i<N;i++){
          const o = (r*N + i)*2, live = e < emit.length && i < count;
          const p = P[i];
          if(live){
            const w = .085*(1 - i/N*.75);
            if(upright) side.copy(ups[i]).multiplyScalar(w);
            else {
              dir.subVectors(P[Math.max(0, i-1)], P[Math.min(count-1, i+1)]);
              if(dir.lengthSq() < 1e-8) dir.set(0,0,1);
              side.crossVectors(dir, ups[i]).normalize().multiplyScalar(w);
            }
          } else side.set(0,0,0);
          pos[o*3] = p.x - side.x; pos[o*3+1] = p.y - side.y; pos[o*3+2] = p.z - side.z;
          pos[o*3+3] = p.x + side.x; pos[o*3+4] = p.y + side.y; pos[o*3+5] = p.z + side.z;
          age[o] = age[o+1] = live ? t - born[i] : 99;
        }
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aAge.needsUpdate = true;
    }
    return {
      get on(){ return on; },
      toggle(){ on = !on; if(!on){ mesh.visible = false; count = 0; } },
      reset(obj, fwd, color, t){
        const L = findLights(obj); emit = L.pts.slice(0, MAXE);
        mat.uniforms.uCol.value.copy(L.col || new THREE.Color(0xff2a3c));
        count = 0; mesh.visible = false;
      },
      hide(){ mesh.visible = false; count = 0; },
      update(obj, fwd, t){
        if(!on || !emit.length) return;
        // shift every frame: the streak length follows the speed, like a camera shutter
        for(let e=0;e<emit.length;e++){
          const P = pts[e], last = P[N-1];
          for(let i=N-1;i>0;i--) P[i] = P[i-1];
          P[0] = last.copy(emit[e]).applyMatrix4(obj.matrixWorld);
        }
        const lu = ups[N-1]; for(let i=N-1;i>0;i--) ups[i] = ups[i-1]; ups[0] = lu.set(0,1,0).applyQuaternion(obj.quaternion);
        born.copyWithin(1, 0, N-1); born[0] = t;
        count = Math.min(N, count + 1);
        write(t);
        mesh.visible = count > 2;
      }
    };
  })();
  /* moving parts: steering wheels, vectoring nozzles, tilting fans - driven by the same inputs as the car */
  function collectParts(root){
    const R = { wheels:[], rotors:[], fans:[], thrusters:[], s:{ steer:0, gas:0, climb:0 } };
    root.traverse(o=>{
      const side = o.position.x >= 0 ? 1 : -1, front = o.position.z >= 0 ? 1 : -1;
      if(/^wheel_/.test(o.name)) R.wheels.push({o, front:/^wheel_F/.test(o.name), spin:0});
      else if(/^rotor_/.test(o.name)) R.rotors.push({o, side, front, spin:Math.random()*6});
      else if(/^fan_/.test(o.name)) R.fans.push({o, side, front});
      else if(/^thruster_/.test(o.name)) R.thrusters.push({o, side, front, x:o.rotation.x, y:o.rotation.y, z:o.rotation.z});
    });
    return R;
  }
  function animateParts(R, id, steer, gas, climb, v, dt){
    const s = R.s, k = Math.min(1, dt*5);
    s.steer += (steer - s.steer)*k; s.gas += (gas - s.gas)*k; s.climb += (climb - s.climb)*k;
    const c = CARS[id];
    const lock = id === 'iskra' ? .32 : id === 'bastion' ? .38 : .45;
    R.wheels.forEach(w=>{ w.spin += v*dt/(c.R || .4); w.o.rotation.set(w.spin, w.front ? s.steer*lock : 0, 0, 'YXZ'); });
    // air taxi: the whole fan assemblies tilt forward/back with throttle and bank into turns, rotors spin inside them
    const tx = (side) => s.gas*.42 + s.steer*.16*side, tz = -s.steer*.34;
    R.fans.forEach(f=>f.o.rotation.set(tx(f.side), 0, tz, 'XZY'));
    R.rotors.forEach(r=>{ r.spin += dt*(16 + Math.abs(v)*.45); r.o.rotation.set(R.fans.length ? tx(r.side) : 0, r.spin, R.fans.length ? tz : 0, 'XZY'); });
    // jets: nozzles swivel against the turn and pitch with throttle and climb, like thrust vectoring
    R.thrusters.forEach(p=>{
      let rx, ry;
      if(R.thrusters.length > 2){ // Корона: four pods, front and rear swing in opposite directions for a coordinated turn
        ry = s.steer*.5*p.front; rx = -s.gas*.38 + s.climb*.42;
      } else {                    // Скат: twin rear nozzles
        ry = s.steer*.36; rx = -s.gas*.22 + s.climb*.38 + s.steer*.14*p.side;
      }
      p.o.rotation.set(p.x + rx, p.y + ry, p.z, 'YXZ');
    });
  }
  let PARTS = collectParts(new THREE.Group());
  function takeoff(){
    if(driving || flying || starting) return Promise.resolve(false);
    starting = true;
    return loadCar(sel).then(root=>{
      starting = false;
      if(driving || current !== 'fly') return false;
      const c = CARS[sel], ground = c.kind === 'ground';
      driving = true; shiftGoal = 0;
      HOOKS.drive && HOOKS.drive(true, sel);
      showcase.visible = false;
      player = root.clone(); scene.add(player);
      PARTS = collectParts(player);
      if(ground){ P.set(-45, 0, 46.5); yaw = -Math.PI/2; v = 4; vy = 0; }
      else { P.copy(showcase.position); yaw = Math.atan2(LOC.fly.look[0]-LOC.fly.cam[0], LOC.fly.look[2]-LOC.fly.cam[2]); v = 10; vy = 3; }
      yawRate = 0; roll = pitch = 0; fov = 60;
      player.position.copy(P); player.rotation.set(0, yaw, 0, 'YXZ'); FWD.set(Math.sin(yaw), 0, Math.cos(yaw));
      trail.reset(player, FWD, c.glow, elapsed);
      ENG.start(); SFX.whoosh(1.2);
      return true;
    }).catch(e=>{ console.warn('car', e); starting = false; return false; });
  }
  function land(){
    if(!driving) return;
    driving = false; HOOKS.drive && HOOKS.drive(false, sel);
    scene.remove(player); player = null; trail.hide();
    for(const k in K) K[k] = false; T.x = T.y = 0;
    ENG.stop();
    showcase.visible = true; current = null;
    flyTo('fly');
  }
  function solidAt(p){
    const i = Math.round(p.x/9), j = Math.round(p.z/9);
    for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++){
      const s = SOLID.get((i+a)+','+(j+b));
      if(s && Math.abs(p.x-s.x) < s.hw+1.3 && Math.abs(p.z-s.z) < s.hd+1.3 && p.y < s.top+1.2) return true;
    }
    { const r = Math.hypot(p.x, p.z); if((r < 7.5 && p.y < 86) || (r < 13.5 && p.y < 6)) return true; }
    { const r = Math.hypot(p.x-LOC.contact.obj[0], p.z-LOC.contact.obj[2]); if((r < 2.4 && p.y < 73) || (r < 5 && p.y < 57 && p.y > 48) || (r < 6.6 && p.y < 26 - r*3.6) || (r < 9.4 && p.y < 2)) return true; }
    return false;
  }
  function drive(dt, t){
    const c = CARS[sel], ground = c.kind === 'ground';
    const maxNow = c.max*(K.boost ? 1.45 : 1);
    const gas = K.fwd ? 1 : 0;
    const v0 = v;
    if(gas) v += c.acc*(K.boost ? 1.6 : 1)*dt;
    else if(K.back) v -= c.acc*1.5*dt;
    else v -= Math.sign(v)*Math.min(Math.abs(v), (ground ? 8 : 5)*dt);
    if(v > maxNow) v = Math.max(maxNow, v - 25*dt);
    v = Math.max(v, -12);
    const steer = (K.left?1:0) - (K.right?1:0) - T.x;
    const grip = ground ? Math.min(1, Math.abs(v)/6) * Math.sign(v || 1) : .35 + .65*Math.min(1, Math.abs(v)/18);
    yawRate += (steer*c.turn*grip - yawRate)*Math.min(1, dt*6);
    yaw += yawRate*dt;
    if(ground) vy = 0;
    else { const climb = (K.up?1:0) - (K.down?1:0) - T.y; vy += (climb*16 - vy)*Math.min(1, dt*3); }
    FWD.set(Math.sin(yaw), 0, Math.cos(yaw));
    prev.copy(P);
    P.addScaledVector(FWD, v*dt);
    P.y = ground ? 0 : Math.min(240, Math.max(2.2, P.y + vy*dt));
    const lim = 320;
    if(Math.abs(P.x) > lim || Math.abs(P.z) > lim){ P.x = Math.max(-lim, Math.min(lim, P.x)); P.z = Math.max(-lim, Math.min(lim, P.z)); v *= .96; }
    if(solidAt(ground ? new THREE.Vector3(P.x, 1, P.z) : P)){
      P.copy(prev); v *= -.25; vy *= -.3;
      if(shake < .2) SFX.bump();
      shake = reduce ? 0 : .6;
    }
    const acc = (v - v0)/Math.max(dt, 1e-3);
    if(ground){
      const lean = sel === 'iskra' ? .55 : .06;
      roll += (-yawRate*lean*Math.min(1, Math.abs(v)/12) - roll)*Math.min(1, dt*6);
      pitch += (-acc*.0035 - pitch)*Math.min(1, dt*4);
    } else {
      roll += (-yawRate*.38*Math.min(1, Math.abs(v)/15) - roll)*Math.min(1, dt*5);
      pitch += (-vy*.022 - pitch)*Math.min(1, dt*5);
    }
    player.position.copy(P); if(!ground) player.position.y += Math.sin(t*2.2)*.08;
    player.rotation.set(pitch, yaw, roll, 'YXZ');
    animateParts(PARTS, sel, steer, (K.fwd ? 1 : 0) - (K.back ? 1 : 0), ground ? 0 : Math.max(-1, Math.min(1, vy/16)), v, dt);
    player.updateMatrixWorld();
    trail.update(player, FWD, t);
    // chase camera: low and close on the road, higher in the air
    const back = ground ? 6.2 + Math.abs(v)*.04 : 9 + Math.abs(v)*.03, up = ground ? 2.1 : 3.4 + Math.max(0, -vy*.1);
    desired.copy(P).addScaledVector(FWD, -back); desired.y += up;
    camPos.lerp(desired, 1 - Math.exp(-dt*8));
    aim.copy(P).addScaledVector(FWD, 8); aim.y += ground ? 1.1 : 1;
    camTarget.lerp(aim, 1 - Math.exp(-dt*9));
    if(shake > 0){ shake = Math.max(0, shake - dt*1.5); camPos.x += (Math.random()-.5)*shake; camPos.y += (Math.random()-.5)*shake; }
    fov += ((60 + Math.min(1, Math.abs(v)/c.max)*12 + (K.boost && v > c.max*.9 ? 6 : 0)) - fov)*Math.min(1, dt*3);
    ENG.update(Math.min(1.4, Math.abs(v)/c.max), gas);
    hudT += dt;
    if(hudT > .1){ hudT = 0; SPEED = Math.abs(v)*3.6; ALT = P.y; }
  }


  /* ================= Graphics quality ================= */
  const QUALITY = {
    high: {label:'Высокая', dpr:1.75, refl:.5,  rain:34000, cones:true,  steam:true},
    mid:  {label:'Средняя', dpr:1.25, refl:.34, rain:22000, cones:true,  steam:true},
    low:  {label:'Низкая',  dpr:1.0,  refl:0,   rain:9000,  cones:false, steam:false},
  };
  let qKey = QUALITY[OPTS.quality] ? OPTS.quality : (coarse ? 'low' : 'mid');
  function applyQuality(){
    const q = QUALITY[qKey];
    DPRnow = Math.min(devicePixelRatio||1, q.dpr);
    renderer.setPixelRatio(DPRnow);
    REFL.on = q.refl > 0; REFL.scale = q.refl || .25;
    if(ATM.rain){ ATM.rain.geometry.instanceCount = q.rain; ATM.cones.visible = q.cones; ATM.steam.visible = q.steam; }
    resize();
  }

  /* ================= Camera rig ================= */
  const camPos = new THREE.Vector3(0, 200, 380);
  const camTarget = new THREE.Vector3(0, 10, 0);
  let fov = 58, shift = 0, shiftGoal = 0;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onPointer = e => { pointer.x = e.clientX / innerWidth * 2 - 1; pointer.y = e.clientY / innerHeight * 2 - 1; };
  addEventListener('pointermove', onPointer);
  let W = 1, H = 1, narrow = false;
  function resize() {
    W = innerWidth; H = innerHeight; narrow = W < 760;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    if (composer) { composer.setPixelRatio(DPRnow); composer.setSize(W, H); }
    sizeReflection();
    if (gradePass) gradePass.uniforms.uAspect.value = W / H;
  }
  addEventListener('resize', resize); resize();

  /* ================= Camera flights between locations ================= */
  let current = null, flying = false, tween = null;
  function flyTo(k, intro) {
    const L = LOC[k];
    if (!L || driving) return;
    if (k === current && !flying) return;
    if (tween) tween.kill();
    flying = true; shiftGoal = 0;
    HOOKS.depart && HOOKS.depart(k, !!intro);
    const d = reduce ? .9 : (intro ? 3.6 : 2.2);
    const from = camPos.clone(), fromT = camTarget.clone();
    const to = new THREE.Vector3(...L.cam), toT = new THREE.Vector3(...L.look);
    const mid = from.clone().lerp(to, .5); mid.y = Math.max(from.y, to.y) + (intro ? 10 : 42);
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    const st = { t: 0 };
    SFX.whoosh(d);
    tween = gsap.to(st, {
      t: 1, duration: d, ease: 'power2.inOut',
      onUpdate() { curve.getPoint(st.t, camPos); camTarget.lerpVectors(fromT, toT, Math.min(1, st.t * 1.15)); fov = 58 + Math.sin(st.t * Math.PI) * (reduce ? 0 : 16); },
      onComplete() { flying = false; current = k; HOOKS.arrive && HOOKS.arrive(k); SFX.arrive(); },
    });
  }
  // camera flights follow real time: after a slow frame the camera catches up instead of crawling
  gsap.ticker.lagSmoothing(0);

  /* ================= Frame loop ================= */
  const timer = new THREE.Timer();
  const tmp = new THREE.Vector3(), look = new THREE.Vector3();
  const tags = new Map();
  let lastTick = 0, bassS = 0, lastT = 0, raf = 0, started = false;
  function frame(now) {
    timer.update(now);
    const t = elapsed = timer.getElapsed(); const dt = Math.min(.05, t - lastT); lastT = t;
    U.time.value = t;
    bassS += (AUDIO.bass(t) - bassS) * .2; U.bass.value = bassS;
    traffic(t); streets(t, dt); skyFx(t); monorail(t);
    anim.forEach(f => f(t, bassS));
    if (driving && player) drive(dt, t);
    halo.rotation.z = .1 + t * .01;
    if (bloom) bloom.strength = .8 + bassS * .3;

    pointer.sx += (pointer.x - pointer.sx) * .04; pointer.sy += (pointer.y - pointer.sy) * .04;
    const par = (reduce || driving) ? 0 : 1;
    camera.position.copy(camPos).add(tmp.set(pointer.sx * 1.2 * par, -pointer.sy * .8 * par, 0));
    look.copy(camTarget); look.y += Math.sin(t * .4) * .15 * par;
    camera.lookAt(look);
    camera.fov = fov;
    shift += (shiftGoal - shift) * .06;
    if (shift > .002) { if (narrow) camera.setViewOffset(W, H, 0, H * .2 * shift, W, H); else camera.setViewOffset(W, H, -W * .17 * shift, 0, W, H); }
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();

    // floating labels over the landmarks (Angular renders them, the engine moves them)
    tags.forEach((el, k) => {
      const L = LOC[k]; tmp.set(L.obj[0], L.tagY, L.obj[2]).project(camera);
      const vis = started && tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 && k !== current && !driving;
      el.style.opacity = vis ? '1' : '0'; el.style.pointerEvents = vis ? 'auto' : 'none';
      el.style.transform = `translate(${(tmp.x * .5 + .5) * W}px, ${(-tmp.y * .5 + .5) * H}px) translate(-50%,-100%)`;
    });
    if (t - lastTick > .1) {
      lastTick = t;
      const p = camera.position;
      HOOKS.tick && HOOKS.tick({ x: p.x, y: p.y, z: p.z, speed: SPEED, altitude: ALT });
    }
    updateAtmos(); renderReflection();
    if (composer) composer.render(); else renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  /* ================= Public API ================= */
  return {
    /** Builds the city step by step; resolves when it is ready to enter. */
    async init(progress) {
      const JP = 'ネオ・エデン未来はここラーメン夢バー';
      await Promise.race([
        Promise.all([document.fonts.load('800 30px Unbounded', 'СИНТЕКС'), document.fonts.load('500 22px "IBM Plex Mono"', 'ЛАПША'),
          document.fonts.load('500 22px "Golos Text"', 'память'), document.fonts.load('700 40px "Noto Sans JP"', JP)]),
        new Promise(r => setTimeout(r, 3000)),
      ]).catch(() => {});
      const steps = [buildSky, buildGLBCity, buildCityExtras, buildCloudsAndBeams, buildBillboards, buildProjects, buildVehicles, buildStreets, buildAirships, buildShowcase, buildAtmos, buildKoi, applyQuality];
      for (let i = 0; i < steps.length; i++) {
        try { await steps[i](); } catch (err) { console.error(err); }
        progress((i + 1) / steps.length);
        await new Promise(r => setTimeout(r, 16));
      }
      raf = requestAnimationFrame(frame);
    },
    start() { started = true; },
    flyTo,
    setPanelOpen(open) { shiftGoal = open && !driving ? 1 : 0; },
    registerTag(k, el) { tags.set(k, el); },
    /* hangar and driving */
    cars: CARS,
    get selected() { return sel; },
    select(k) { if (!CARS[k]) return; sel = k; setShowcase(k); },
    takeoff,
    land,
    get driving() { return driving; },
    get flying() { return flying; },
    get current() { return current; },
    keys: K,
    stick: T,
    toggleTrail() { trail.toggle(); return trail.on; },
    /* graphics */
    get quality() { return qKey; },
    setQuality(q) { if (!QUALITY[q]) return; qKey = q; applyQuality(); },
    qualities: QUALITY,
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize); removeEventListener('pointermove', onPointer); removeEventListener('blur', onBlur);
      if (tween) tween.kill();
      AUDIO.engineStop();
      renderer.dispose();
    },
  };
}
