import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { overview, verses } from './poem';
import type { View } from './poem';

type Block = { x: number; y: number; z: number; sx: number; sy: number; sz: number; color: THREE.ColorRepresentation };
type Traveler = { group: THREE.Group; legs: THREE.Object3D[]; offset: number };
const CELL = 2;
const WATER = 0.65;
const clamp = THREE.MathUtils.clamp;
const clearViews = verses.filter(view => ['bamboo', 'lotus', 'stream', 'home', 'flowers', 'autumn'].includes(view.id));

function seededRandom(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const random = seededRandom(1309);
function noise(x: number, z: number) {
  return Math.sin(x * .17 + z * .11) * .6 + Math.cos(z * .27 - x * .09) * .35 + Math.sin(x * .57 + z * .32) * .16;
}
function riverX(z: number) { return -7 + Math.sin(z * .11) * 3.3 + Math.max(0, z - 5) * .43; }
function isLake(x: number, z: number) { return ((x - 12) / 15.5) ** 2 + ((z - 19) / 10.7) ** 2 < 1; }
function isRiver(x: number, z: number) { return z < 20 && z > -50 && Math.abs(x - riverX(z)) < (z < -18 ? 2.3 : 3.1); }
function isWater(x: number, z: number) { return isLake(x, z) || isRiver(x, z); }
function waterLevel(z: number) { return WATER + Math.max(0, Math.floor((-z - 15) / 7)) * 1.15; }
function surface(x: number, z: number): number {
  x = Math.round(x / CELL) * CELL; z = Math.round(z / CELL) * CELL;
  if (isWater(x, z)) return waterLevel(z) - .45;
  const westHill = 15 * Math.exp(-(((x + 30) / 14) ** 2) - ((z + 25) / 21) ** 2);
  const eastHill = 10.5 * Math.exp(-(((x - 29) / 17) ** 2) - ((z + 26) / 21) ** 2);
  const autumnHill = 3.8 * Math.exp(-(((x + 24) / 18) ** 2) - ((z - 15) / 19) ** 2);
  const back = Math.max(0, -z - 25) * .14;
  let h = 1.1 + westHill + eastHill + autumnHill + back + noise(x, z) * .7;
  // A level clearing holds the house and its porch.
  if (Math.abs(x - 26) < 6 && Math.abs(z + 22) < 5) h = 8.4;
  const bankDistance = Math.abs(x - riverX(z));
  if (z < -12 && bankDistance < 7) h = Math.min(h, waterLevel(z) + .75 + (bankDistance - 2) * .27);
  return Math.max(.8, Math.round(h / .8) * .8);
}

function cameraClearing(x: number, z: number) {
  return clearViews.some(view => {
    const [ax, , az] = view.position, [bx, , bz] = view.target;
    const dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - (ax + t * dx), z - (az + t * dz)) < 5;
  });
}

function bambooSightline(x: number, z: number) {
  const ax = 39, az = 16, dx = -18, dz = -23;
  const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(x - ax - t * dx, z - az - t * dz) < 3;
}

class Blocks {
  private data: Block[] = [];
  constructor(private scene: THREE.Scene | THREE.Group, private material: THREE.Material, private shadow = true) {}
  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: THREE.ColorRepresentation) {
    this.data.push({ x, y, z, sx, sy, sz, color });
  }
  finish() {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.material, this.data.length);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < this.data.length; i++) {
      const b = this.data[i];
      matrix.makeScale(b.sx, b.sy, b.sz); matrix.setPosition(b.x, b.y, b.z);
      mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color.set(b.color));
    }
    mesh.castShadow = this.shadow; mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    this.scene.add(mesh);
    this.data = [];
    return mesh;
  }
}

function pixelTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const rnd = seededRandom(77);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const value = Math.round(208 + rnd() * 47);
    ctx.fillStyle = `rgb(${value},${value},${value})`; ctx.fillRect(x, y, 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function glowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,239,184,.65)');
  gradient.addColorStop(.15, 'rgba(255,239,184,.22)'); gradient.addColorStop(1, 'rgba(255,239,184,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export class MountainWorld {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(43, 1, .15, 400);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  private material = new THREE.MeshStandardMaterial({ roughness: .94, metalness: 0, map: pixelTexture() });
  private leaves: Blocks;
  private wood: Blocks;
  private plants: Blocks;
  private boat = new THREE.Group();
  private travelers: Traveler[] = [];
  private reeds: { group: THREE.Group; phase: number }[] = [];
  private fireflies: THREE.Points | null = null;
  private fireflyBase: Float32Array = new Float32Array();
  private waterGlints: THREE.InstancedMesh | null = null;
  private glintBase: { x: number; y: number; z: number; phase: number; length: number }[] = [];
  private droplets: THREE.InstancedMesh | null = null;
  private dropBase: { x: number; y: number; z: number; span: number; phase: number }[] = [];
  private transition: { start: number; fromPosition: THREE.Vector3; fromTarget: THREE.Vector3; destination: View; arc: number } | null = null;
  private frame = 0;
  private disposed = false;
  private time = 0;
  private lastTime = 0;
  private mobile: boolean;
  private observer: ResizeObserver;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  private activeView = overview;
  private shadowLight: THREE.DirectionalLight;
  private contextLost = false;
  paused = false;
  ready = false;

  constructor(private container: HTMLElement, progress: (value: number) => void, private onError: (message: string) => void) {
    this.mobile = window.innerWidth <= 900;
    this.paused = this.reducedMotion.matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.mobile, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1.35 : 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.scene.background = new THREE.Color('#476568');
    this.scene.fog = new THREE.FogExp2('#69817b', .0065);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = .07;
    this.controls.enablePan = false; this.controls.rotateSpeed = .42; this.controls.zoomSpeed = .65;
    this.controls.minPolarAngle = .3; this.controls.maxPolarAngle = Math.PI * .47;
    this.controls.addEventListener('start', this.cancelFlight);
    this.scene.add(new THREE.HemisphereLight('#bbcfc2', '#364e3a', 2.2));
    this.shadowLight = new THREE.DirectionalLight('#f3ddb3', 3.1);
    this.shadowLight.position.set(-35, 65, 15); this.shadowLight.castShadow = true;
    this.shadowLight.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048);
    Object.assign(this.shadowLight.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 1, far: 160 });
    this.shadowLight.shadow.bias = -.0005; this.shadowLight.shadow.normalBias = .18;
    this.shadowLight.shadow.radius = 3;
    this.scene.add(this.shadowLight);
    const moonLight = new THREE.DirectionalLight('#9fcad7', 1.0); moonLight.position.set(-25, 40, -50); this.scene.add(moonLight);
    this.leaves = new Blocks(this.scene, this.material);
    this.wood = new Blocks(this.scene, this.material);
    this.plants = new Blocks(this.scene, this.material);
    progress(12);
    this.buildSky(); this.buildTerrain(); progress(35);
    this.buildForest(); this.buildBamboo(); progress(61);
    this.buildHouse(); this.buildPeople(); this.buildBoat(); this.buildLotus(); progress(80);
    this.buildDetails();
    this.leaves.finish(); this.wood.finish(); this.plants.finish();
    this.buildAtmosphere(); progress(95);
    this.setView(overview, true);
    this.observer = new ResizeObserver(this.resize); this.observer.observe(container);
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.reducedMotion.addEventListener('change', this.handleMotionPreference);
    this.resize();
    this.frame = requestAnimationFrame(this.animate);
  }

  private handleContextLost = (event: Event) => {
    event.preventDefault(); this.contextLost = true; this.ready = false; cancelAnimationFrame(this.frame);
    this.onError('图形连接已中断，请重新加载页面，继续游览秋山。');
  };
  private handleMotionPreference = () => {
    if (this.reducedMotion.matches) {
      this.paused = true;
      if (this.transition) this.setView(this.transition.destination, true);
      window.dispatchEvent(new Event('world-motion-change'));
    }
  };
  private handleVisibility = () => {
    cancelAnimationFrame(this.frame); this.lastTime = 0;
    if (!document.hidden && !this.disposed && !this.contextLost) this.frame = requestAnimationFrame(this.animate);
  };
  private cancelFlight = () => {
    this.transition = null;
    this.controls.maxPolarAngle = Math.PI * (this.activeView.id === 'moon' ? .6 : .47);
    this.controls.minDistance = this.activeView.distance[0];
    this.controls.maxDistance = this.activeView.distance[1];
  };

  private buildSky() {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(220, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color('#1c3c50') }, horizon: { value: new THREE.Color('#a5aca0') } },
      vertexShader: 'varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform vec3 top;uniform vec3 horizon;varying vec3 vPosition;void main(){float h=clamp(vPosition.y/150.0,0.0,1.0);gl_FragColor=vec4(mix(horizon,top,pow(h,.55)),1.0);}',
    })); this.scene.add(sky);
    const moon = new THREE.Group(); moon.position.set(-26, 38, -62);
    const moonBlocks = new Blocks(moon, new THREE.MeshBasicMaterial({ color: '#fff0ca', fog: false }), false);
    for (let x = -5; x <= 5; x++) for (let y = -5; y <= 5; y++) {
      if (x * x + y * y > 27) continue;
      const crater = (x === -2 && y === 1) || (x === 1 && y === -2) || (x === -1 && y === 2);
      moonBlocks.add(x * .74, y * .74, 0, .76, .76, .3, crater ? '#d8d6b4' : '#fff0ca');
    }
    moonBlocks.finish(); this.scene.add(moon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#f8edcd', transparent: true, opacity: .32, depthWrite: false, fog: false }));
    halo.position.copy(moon.position); halo.scale.set(27, 27, 1); this.scene.add(halo);
    const starPositions: number[] = [];
    for (let i = 0; i < 85; i++) starPositions.push((random() - .5) * 240, 43 + random() * 85, -100 - random() * 30);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    this.scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#d1d7c8', size: .24, transparent: true, opacity: .5, fog: false })));
  }

  private buildTerrain() {
    const earth = new Blocks(this.scene, this.material);
    const grass = new Blocks(this.scene, this.material);
    const stonePalette = ['#697366', '#78806c', '#626e60', '#818371', '#667669'];
    const grassPalette = ['#627759', '#6e815b', '#74855d', '#5e7555', '#7d8960'];
    for (let x = -46; x <= 46; x += CELL) for (let z = -48; z <= 44; z += CELL) {
      const h = surface(x, z); const wet = isWater(x, z);
      earth.add(x, (h - 6) / 2, z, CELL + .015, h + 6, CELL + .015, stonePalette[Math.floor(random() * stonePalette.length)]);
      if (!wet) {
        const autumn = x < -10 && z > 4;
        grass.add(x, h + .12, z, CELL + .02, .25, CELL + .02, autumn && random() > .55 ? '#8d9061' : grassPalette[Math.floor(random() * grassPalette.length)]);
      }
    }
    // Rounded mountain masses descend in voxel terraces toward the valley.
    const ridge = new Blocks(this.scene, this.material);
    for (let x = -90; x <= 90; x += 3) for (let z = -51; z >= -120; z -= 3) {
      const peaks = 24 * Math.exp(-(((x + 44) / 26) ** 2) - ((z + 76) / 24) ** 2)
        + 32 * Math.exp(-(((x - 9) / 23) ** 2) - ((z + 92) / 28) ** 2)
        + 28 * Math.exp(-(((x - 60) / 28) ** 2) - ((z + 78) / 25) ** 2);
      const h = Math.round((5 + peaks + noise(x * .8, z) * 2 + Math.max(0, -z - 98) * .22) / 1.6) * 1.6;
      const color = new THREE.Color(z > -69 ? '#64766a' : z > -87 ? '#627c73' : '#78918a');
      for (let bottom = -6; bottom < h; bottom += 3.2) {
        const blockHeight = Math.min(3.2, h - bottom);
        const shade = color.clone().multiplyScalar(.94 + random() * .12);
        ridge.add(x, bottom + blockHeight / 2, z, 3.02, blockHeight, 3.02, shade);
      }
      grass.add(x, h + .13, z, 3.02, .25, 3.02, z > -75 ? '#738268' : '#758c79');
    }
    earth.finish(); grass.finish(); ridge.finish();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(350, 350), new THREE.MeshStandardMaterial({ color: '#526e60', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -6.05; floor.receiveShadow = true; this.scene.add(floor);
    const waterMaterial = new THREE.MeshStandardMaterial({ color: '#c8e4da', roughness: .28, metalness: .28, transparent: true, opacity: .88 });
    const water = new Blocks(this.scene, waterMaterial, false);
    for (let x = -46; x <= 46; x += CELL) for (let z = -48; z <= 44; z += CELL) if (isWater(x, z)) {
      water.add(x, waterLevel(z), z, CELL + .025, .19, CELL + .025, ['#407c7a', '#518884', '#609590', '#497e7b'][Math.floor(random() * 4)]);
    }
    water.finish();
    const falls = new Blocks(this.scene, new THREE.MeshStandardMaterial({ color: '#8cbab3', transparent: true, opacity: .8, roughness: .2 }), false);
    for (const z of [-22, -29, -36, -43]) {
      const x = riverX(z);
      const bottom = waterLevel(z + 1);
      for (let n = 0; n < 5; n++) {
        falls.add(x + (n - 2) * .7, bottom + .7, z + .6, .55, 1.25, .18, n % 2 ? '#a0c8be' : '#6baba7');
        this.dropBase.push({ x: x + (n - 2) * .68, y: bottom, z: z + .8, span: 1.4, phase: random() });
      }
    }
    falls.finish();
    this.droplets = new THREE.InstancedMesh(new THREE.BoxGeometry(.16, .24, .16), new THREE.MeshBasicMaterial({ color: '#d9e8d3', transparent: true, opacity: .7 }), this.dropBase.length);
    this.droplets.frustumCulled = false; this.scene.add(this.droplets);
    const glintsMaterial = new THREE.MeshBasicMaterial({ color: '#d4debc', transparent: true, opacity: .36, depthWrite: false });
    for (let i = 0; i < (this.mobile ? 70 : 130); i++) {
      const x = -14 + random() * 41, z = -43 + random() * 70;
      if (!isWater(x, z)) continue;
      this.glintBase.push({ x, z, y: waterLevel(Math.round(z / 2) * 2) + .13, phase: random() * Math.PI * 2, length: .4 + random() * 1.3 });
    }
    this.waterGlints = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .025, .12), glintsMaterial, this.glintBase.length);
    this.waterGlints.frustumCulled = false; this.scene.add(this.waterGlints);
  }

  private pine(x: number, z: number, scale: number) {
    const y = surface(x, z) + .25;
    const height = 6.8 * scale;
    this.wood.add(x, y + height / 2, z, .6 * scale, height, .6 * scale, '#625747');
    const levels = 5;
    for (let i = 0; i < levels; i++) {
      const size = (4.6 - i * .78) * scale;
      const layerY = y + height * .42 + i * 1.05 * scale;
      this.leaves.add(x, layerY, z, size, .9 * scale, size, ['#355b46', '#3b634a', '#426e50', '#4d7957', '#62825b'][i]);
      if (i < 3) {
        const side = i % 2 ? 1 : -1;
        this.leaves.add(x + side * size * .36, layerY + .42 * scale, z + size * .12, size * .5, .48 * scale, size * .56, '#547653');
      }
    }
    this.leaves.add(x, y + height * 1.12, z, .65 * scale, .65 * scale, .65 * scale, '#69885d');
  }

  private maple(x: number, z: number, scale: number, autumn = true) {
    const y = surface(x, z) + .25;
    const height = 3.8 * scale;
    this.wood.add(x, y + height / 2, z, .45 * scale, height, .45 * scale, '#78644d');
    this.wood.add(x + .6 * scale, y + height * .76, z, 1.4 * scale, .35 * scale, .35 * scale, '#78644d');
    const palette = autumn ? ['#a59757', '#b5a263', '#968b4e', '#b6a86d', '#9e784f', '#c5ad74'] : ['#668361', '#78966b', '#5e7b55'];
    const clusters = [[0, 0, 0, 3], [-1.1, -.7, .5, 2.3], [1.25, -.45, -.2, 2.4], [.1, -.5, 1.25, 2.2], [-.4, .75, -.25, 1.8]];
    for (const [dx, dy, dz, size] of clusters) {
      this.leaves.add(x + dx * scale, y + height + dy * scale, z + dz * scale, size * scale, size * .62 * scale, size * scale, palette[Math.floor(random() * palette.length)]);
    }
  }

  private buildForest() {
    const treeCount = this.mobile ? 135 : 205;
    for (let i = 0; i < treeCount; i++) {
      const x = -43 + random() * 83, z = -46 + random() * 82;
      if (isWater(x, z) || cameraClearing(x, z) || Math.abs(x - riverX(z)) < 5.3 || (x > 16 && z > -30 && z < 9) || (x > -33 && x < -15 && z > 10 && z < 21)) continue;
      const density = z < -20 || x < -12 || x > 29;
      if (!density && random() < .75) continue;
      if (z > 0 && random() < .62) this.maple(x, z, .7 + random() * .7);
      else this.pine(x, z, .75 + random() * .65);
    }
    // The moon viewpoint looks through these deliberately spaced pines.
    for (const [x, z, s] of [[-20, -12, 1.45], [-26, -16, 1.35], [-16, -20, 1.15], [-29, -4, 1.4], [-15, -3, 1.15], [-35, -15, 1.3]]) this.pine(x, z, s);
    for (const [x, z, s] of [[-28, 14, 1.4], [-18, 20, 1], [-34, 21, 1.2], [-23, 8, 1.1], [-11, 27, 1], [35, 25, 1.35]]) this.maple(x, z, s);
  }

  private buildBamboo() {
    for (let i = 0; i < (this.mobile ? 42 : 65); i++) {
      const x = 18 + random() * 14, z = -10 + random() * 20;
      if (Math.abs(x - this.pathX(z)) < 1.8 || bambooSightline(x, z)) continue;
      const y = surface(x, z) + .25, height = 5.3 + random() * 3.6;
      this.wood.add(x, y + height / 2, z, .19, height, .19, '#647b45');
      for (let joint = .8; joint < height; joint += .9) this.wood.add(x, y + joint, z, .26, .1, .26, '#a2a56b');
      for (let l = 0; l < 4; l++) {
        const leafY = y + height * .48 + l * .8;
        const sign = l % 2 ? 1 : -1;
        this.leaves.add(x + sign * .66, leafY, z, 1.5, .15, .42, ['#719353', '#8ba965', '#537940'][l % 3]);
        this.leaves.add(x + sign * 1.16, leafY - .21, z + .13, .65, .15, .36, '#698849');
        this.leaves.add(x - sign * .48, leafY + .18, z - .3, 1, .14, .33, '#819957');
      }
      if (i % 7 === 0) {
        const group = new THREE.Group(); group.position.set(x, y + height - .8, z);
        const tips = new Blocks(group, this.material);
        tips.add(.7, 0, 0, 1.6, .12, .5, '#93a96b'); tips.add(-.4, .3, .2, 1.2, .12, .42, '#769251');
        tips.finish(); this.scene.add(group); this.reeds.push({ group, phase: random() * 6.28 });
      }
    }
    const path = new Blocks(this.scene, this.material);
    for (let z = 10; z >= -21; z -= 1.5) {
      const x = this.pathX(z);
      const y = surface(x, z) + .27;
      path.add(x, y, z, 1.5, .16, 1.25, random() > .5 ? '#bbb39a' : '#a5a18b');
      if (z > -8) path.add(x + 1.4, y - .05, z, .8, .1, .7, '#8c9376');
    }
    path.finish();
  }

  private pathX(z: number) { return 23 + Math.sin(z * .12) * 2.5; }

  private buildHouse() {
    const house = new THREE.Group(); const base = 8.8; house.position.set(26, base, -22);
    const blocks = new Blocks(house, this.material);
    blocks.add(0, -.15, 0, 8, .55, 6.5, '#979783');
    blocks.add(0, 1.75, 0, 6.4, 3.5, 4.7, '#c3bca1');
    for (const x of [-3.2, 0, 3.2]) for (const z of [-2.4, 2.4]) blocks.add(x, 1.9, z, .34, 3.9, .34, '#665846');
    blocks.add(0, 3.4, 2.5, 7.3, .3, .35, '#665846');
    blocks.add(0, 1.05, 2.46, 1.3, 2.1, .14, '#554f40');
    blocks.add(.4, 1, 2.58, .12, .12, .12, '#d4ba74');
    const roofColors = ['#4a6260', '#536c67', '#4c6461', '#667b71', '#718473'];
    for (let layer = 0; layer < 6; layer++) {
      const width = 9.1 - layer * 1.12, depth = 7.3 - layer * .95;
      blocks.add(0, 3.7 + layer * .42, 0, width, .43, depth, roofColors[layer % roofColors.length]);
      for (let x = -width / 2 + .2; x < width / 2; x += .62) {
        blocks.add(x, 3.95 + layer * .42, depth / 2 - .15, .28, .12, .33, '#7d8a78');
        blocks.add(x, 3.95 + layer * .42, -depth / 2 + .15, .28, .12, .33, '#7d8a78');
      }
    }
    blocks.add(0, 6.2, 0, 3.7, .3, .5, '#87937e');
    for (const x of [-4.4, 4.4]) for (const z of [-3.5, 3.5]) blocks.add(x, 4.0, z, .7, .4, .7, '#687b71');
    // Porch, railing and steps descend toward the bamboo path.
    blocks.add(0, .05, 4, 8, .4, 2.1, '#85775e');
    for (const x of [-3.6, 3.6]) {
      blocks.add(x, .75, 4.8, .22, 1.6, .22, '#78664c');
      blocks.add(x, .75, 3.5, .22, 1.6, .22, '#78664c');
      blocks.add(x, 1.25, 4.1, .2, .2, 1.8, '#78664c');
    }
    for (let i = 0; i < 4; i++) blocks.add(0, -.18 - i * .33, 5.1 + i * .65, 2.6, .38, .7, '#aaa58c');
    blocks.finish();
    const warm = new THREE.MeshStandardMaterial({ color: '#e4bc73', emissive: '#ffb654', emissiveIntensity: 1.65, roughness: 1 });
    for (const x of [-1.9, 1.9]) {
      const window = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.25, .1), warm); window.position.set(x, 2.05, 2.41); house.add(window);
      const lattice = new Blocks(house, this.material, false);
      for (const dx of [-.34, 0, .34]) lattice.add(x + dx, 2.05, 2.48, .055, 1.3, .08, '#756044');
      lattice.add(x, 2.05, 2.49, 1.1, .07, .08, '#756044'); lattice.finish();
    }
    const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.3, 1.4), warm); sideWindow.position.set(3.22, 2.1, 0); house.add(sideWindow);
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(.45, .7, .45), warm); lantern.position.set(2.9, 2.6, 3.1); house.add(lantern);
    const light = new THREE.PointLight('#ffc879', 28, 15, 2); light.position.set(1, 2.1, 3.3); house.add(light);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffc26d', transparent: true, opacity: .48, depthWrite: false }));
    glow.position.set(1, 2.3, 2.7); glow.scale.set(7, 5, 1); house.add(glow);
    this.scene.add(house);
    // A stone lantern marks the clearing.
    const lanternBlocks = new Blocks(this.scene, this.material);
    const x = 32, z = -16, y = surface(x, z);
    lanternBlocks.add(x, y + .6, z, .5, 1.3, .5, '#909783');
    lanternBlocks.add(x, y + 1.3, z, 1.1, .2, 1.1, '#86917e');
    lanternBlocks.add(x, y + 1.9, z, 1.4, .3, 1.4, '#728273'); lanternBlocks.finish();
    const lanternCore = new THREE.Mesh(new THREE.BoxGeometry(.65, .55, .65), warm); lanternCore.position.set(x, y + 1.6, z); this.scene.add(lanternCore);
  }

  private person(color: string, basket = false): { group: THREE.Group; legs: THREE.Object3D[] } {
    const group = new THREE.Group();
    const blocks = new Blocks(group, this.material);
    blocks.add(0, 1.55, 0, .63, .93, .43, color);
    blocks.add(0, 2.33, 0, .5, .56, .48, '#c9ab81');
    blocks.add(0, 2.58, -.02, .54, .19, .5, '#49483b');
    blocks.add(0, 2.65, -.18, .28, .24, .28, '#49483b');
    blocks.add(-.42, 1.47, 0, .23, .8, .28, color);
    blocks.add(.42, 1.47, 0, .23, .8, .28, color);
    if (basket) {
      blocks.add(.7, 1.0, .08, .7, .47, .62, '#ae9469');
      blocks.add(.7, 1.28, .08, .55, .12, .5, '#d0c9ae');
      blocks.add(.7, 1.53, .08, .07, .38, .08, '#958057');
    }
    blocks.finish();
    const legs: THREE.Object3D[] = [];
    for (const x of [-.17, .17]) {
      const pivot = new THREE.Group(); pivot.position.set(x, 1.09, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.23, .86, .26), new THREE.MeshStandardMaterial({ color: '#535c50', roughness: 1 }));
      leg.position.y = -.43; leg.castShadow = true; pivot.add(leg); group.add(pivot); legs.push(pivot);
    }
    return { group, legs };
  }

  private buildPeople() {
    for (let i = 0; i < 2; i++) {
      const person = this.person(i === 0 ? '#c3a086' : '#799b9b', true);
      person.group.scale.setScalar(1.05);
      this.scene.add(person.group); this.travelers.push({ ...person, offset: i * 2.3 });
    }
  }

  private buildBoat() {
    const hull = new Blocks(this.boat, this.material);
    hull.add(0, .08, 0, 1.8, .28, 4.7, '#786045');
    hull.add(0, -.08, 0, 1.3, .25, 3.8, '#65543f');
    for (const x of [-.88, .88]) hull.add(x, .37, 0, .21, .5, 4.2, '#a08659');
    for (const z of [-2.2, 2.2]) {
      hull.add(0, .32, z, 1.6, .4, .5, '#9b7b4e');
      hull.add(0, .48, z * 1.14, 1.05, .35, .55, '#aa8e5c');
      hull.add(0, .62, z * 1.27, .58, .25, .4, '#af9363');
    }
    for (let z = -1.6; z <= 1.6; z += .65) hull.add(0, .24, z, 1.6, .1, .08, '#b1966c');
    hull.add(0, .51, .8, 1.7, .2, .55, '#a88c5f'); hull.finish();
    const fisher = this.person('#8e987a'); fisher.group.position.set(0, .27, -1.0); fisher.group.scale.setScalar(.77);
    const hat = new THREE.Mesh(new THREE.BoxGeometry(1.2, .16, 1.1), new THREE.MeshStandardMaterial({ color: '#bea36f', roughness: 1 }));
    hat.position.set(0, 2.57, 0); fisher.group.add(hat); this.boat.add(fisher.group);
    const oar = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, 3.6), new THREE.MeshStandardMaterial({ color: '#93754b' }));
    oar.position.set(1.25, .8, -1.1); oar.rotation.set(-.2, -.55, .2); this.boat.add(oar);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(.4, .09, .85), new THREE.MeshStandardMaterial({ color: '#9c8057' }));
    blade.position.set(2.2, .3, -2.55); this.boat.add(blade);
    this.boat.position.set(12, WATER + .27, 18); this.boat.rotation.y = -.46;
    this.scene.add(this.boat);
  }

  private buildLotus() {
    const pads = new Blocks(this.scene, this.material, false);
    const petals = new Blocks(this.scene, new THREE.MeshStandardMaterial({ roughness: .7, emissive: '#805b48', emissiveIntensity: .1 }), false);
    for (let i = 0; i < (this.mobile ? 40 : 66); i++) {
      const x = -1 + random() * 29, z = 10 + random() * 20;
      if (!isLake(x, z) || (x > 7 && x < 19 && z > 15 && z < 23)) continue;
      const size = .5 + random() * .7;
      const leaf = new THREE.Group(); leaf.position.set(x, WATER + .21, z);
      const leafBlocks = new Blocks(leaf, this.material, false);
      leafBlocks.add(0, 0, 0, size, .09, size * .74, '#63875b');
      leafBlocks.add(-size * .14, 0, -.1 * size, size * .74, .1, size, '#7a9965');
      leafBlocks.add(-size * .22, .06, .06, .13, .015, size * .64, '#a5b080'); leafBlocks.finish();
      this.scene.add(leaf); this.reeds.push({ group: leaf, phase: random() * 6.28 });
      if (i % 4 === 0) {
        pads.add(x, WATER + .38, z, .065, .55, .065, '#84976b');
        for (const [dx, dz] of [[-.16, 0], [.16, 0], [0, -.16], [0, .16]]) petals.add(x + dx, WATER + .65, z + dz, .25, .22, .25, '#c5b3a3');
        petals.add(x, WATER + .73, z, .18, .2, .18, '#e1c69a');
      }
    }
    pads.finish(); petals.finish();
    const pier = new Blocks(this.scene, this.material);
    for (let z = 27; z <= 31; z += .7) pier.add(13, 1.1, z, 3.1, .25, .62, '#9f8c68');
    for (const x of [11.5, 14.5]) for (const z of [27.1, 30.7]) pier.add(x, .5, z, .23, 2, .23, '#77684c');
    pier.finish();
  }

  private buildDetails() {
    const rocks = new Blocks(this.scene, this.material);
    for (let i = 0; i < 95; i++) {
      const z = -43 + random() * 78;
      const x = riverX(z) + (random() > .5 ? 1 : -1) * (3.5 + random() * 2.3);
      if (isWater(x, z)) continue;
      const y = surface(x, z), s = .5 + random() * 1.8;
      rocks.add(x, y + s * .25, z, s, s * .75, s * .85, ['#9eaa97', '#879683', '#a3ad9a', '#7e8e7b'][i % 4]);
      if (i % 3 === 0) this.plants.add(x, y + s * .67, z, s * .8, .1, s * .6, '#7d915e');
    }
    for (let i = 0; i < (this.mobile ? 260 : 470); i++) {
      const x = -43 + random() * 85, z = -35 + random() * 74;
      if (isWater(x, z) || (x > 19 && x < 33 && z > -29 && z < -15)) continue;
      const y = surface(x, z) + .35;
      this.plants.add(x, y + .16, z, .11, .45 + random() * .3, .13, random() > .5 ? '#9aa36b' : '#668359');
      this.plants.add(x + .18, y + .08, z + .06, .12, .3, .12, '#879965');
      if (z > 5 && x < -10 && i % 4 === 0) this.plants.add(x, y + .5, z, .22, .18, .22, '#d6c6a3');
    }
    for (let i = 0; i < 55; i++) {
      const x = -31 + random() * 16, z = 10 + random() * 13, y = surface(x, z) + .3;
      this.plants.add(x, y, z, .2 + random() * .3, .035, .3, ['#b7a368', '#9e8050', '#c2b080'][i % 3]);
    }
    // A few late flowers remain among the autumn grass in the close viewpoint.
    for (let i = 0; i < 14; i++) {
      const x = -27 + random() * 9, z = 13 + random() * 7, y = surface(x, z) + .27;
      this.plants.add(x, y + .25, z, .06, .5, .06, '#798755');
      this.plants.add(x, y + .53, z, .2, .15, .2, i % 3 ? '#cfc4a1' : '#b7b1a0');
      this.plants.add(x + .1, y + .15, z, .3, .07, .13, '#9d9f64');
    }
    // A quiet stepping-stone crossing connects both banks.
    for (let x = -16; x <= 2; x += 1.8) rocks.add(x, Math.max(WATER + .24, surface(x, 5) + .2), 5, 1.3, .35, 1.5, '#a4ab93');
    rocks.finish();
    // A low bench anchors the autumn clearing.
    const y = surface(-23, 17);
    this.wood.add(-23, y + .72, 17, 2.5, .2, .7, '#9b8960');
    this.wood.add(-23.8, y + .3, 17, .25, .6, .5, '#776a4b');
    this.wood.add(-22.2, y + .3, 17, .25, .6, .5, '#776a4b');
  }

  private buildAtmosphere() {
    const count = this.mobile ? 35 : 65;
    this.fireflyBase = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const x = -30 + random() * 60, z = -7 + random() * 39;
      this.fireflyBase[i * 3] = x; this.fireflyBase[i * 3 + 1] = (isWater(x, z) ? WATER : surface(x, z)) + 1 + random() * 2.4; this.fireflyBase[i * 3 + 2] = z;
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.fireflyBase.slice(), 3));
    this.fireflies = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#efdf9f', size: .085, transparent: true, opacity: .75, depthWrite: false }));
    this.scene.add(this.fireflies);
    // Thin banks of mist, built from soft procedural sprites.
    const fogMap = glowTexture();
    for (let i = 0; i < 11; i++) {
      const fog = new THREE.Sprite(new THREE.SpriteMaterial({ map: fogMap, color: '#b5c9b5', transparent: true, opacity: .09, depthWrite: false }));
      fog.position.set(-35 + random() * 70, 5 + random() * 9, -25 - random() * 35); fog.scale.set(25 + random() * 30, 5 + random() * 5, 1); this.scene.add(fog);
    }
  }

  setView(view: View, instant = false) {
    this.activeView = view;
    this.controls.update();
    if (instant || this.reducedMotion.matches) {
      this.transition = null;
      this.controls.maxPolarAngle = Math.PI * (view.id === 'moon' ? .6 : .47);
      this.camera.position.fromArray(view.position); this.controls.target.fromArray(view.target);
      this.controls.minDistance = view.distance[0]; this.controls.maxDistance = view.distance[1];
      this.controls.update(); return;
    }
    // Clear damping left over from a user's gesture before flying.
    this.controls.maxPolarAngle = Math.PI * .6;
    this.controls.enableDamping = false; this.controls.update(); this.controls.enableDamping = true;
    this.controls.minDistance = 1; this.controls.maxDistance = 160;
    const distance = this.camera.position.distanceTo(new THREE.Vector3(...view.position));
    this.transition = {
      start: performance.now(), fromPosition: this.camera.position.clone(), fromTarget: this.controls.target.clone(),
      destination: view, arc: Math.min(16, distance * .25),
    };
  }

  private resize = () => {
    const width = this.container.clientWidth, height = this.container.clientHeight;
    if (!width || !height) return;
    const mobile = window.innerWidth <= 900;
    if (mobile !== this.mobile) {
      this.mobile = mobile;
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.35 : 1.8));
    }
    this.renderer.setSize(width, height); this.camera.aspect = width / height;
    this.camera.fov = this.camera.aspect < .9 ? 59 : 43;
    this.camera.updateProjectionMatrix();
  };

  private animate = (now: number) => {
    if (this.disposed || this.contextLost) return;
    const delta = this.lastTime ? Math.min((now - this.lastTime) / 1000, .05) : 0;
    this.lastTime = now;
    if (!this.paused) this.time += delta;
    const t = this.time;
    if (this.transition) {
      const flight = this.transition;
      const progress = clamp((now - flight.start) / 2300, 0, 1);
      const ease = progress * progress * (3 - 2 * progress);
      this.camera.position.copy(flight.fromPosition).lerp(new THREE.Vector3(...flight.destination.position), ease);
      this.camera.position.y += Math.sin(Math.PI * progress) * flight.arc;
      this.controls.target.copy(flight.fromTarget).lerp(new THREE.Vector3(...flight.destination.target), ease);
      if (progress === 1) {
        this.transition = null;
        this.controls.maxPolarAngle = Math.PI * (flight.destination.id === 'moon' ? .6 : .47);
        this.controls.minDistance = flight.destination.distance[0]; this.controls.maxDistance = flight.destination.distance[1];
      }
    }
    this.controls.update();
    // Keep manual orbiting above the stepped terrain, including tall hillside banks.
    const p = this.camera.position;
    if (Math.abs(p.x) < 46 && p.z > -48 && p.z < 44) {
      const minimumY = (isWater(p.x, p.z) ? waterLevel(p.z) : surface(p.x, p.z)) + 2.0;
      if (p.y < minimumY) { p.y = minimumY; this.camera.lookAt(this.controls.target); }
    }
    this.boat.position.set(12 + Math.sin(t * .095) * 2.1, WATER + .27 + Math.sin(t * 1.15) * .055, 18 + Math.sin(t * .075) * 1.3);
    this.boat.rotation.z = Math.sin(t * .85) * .017; this.boat.rotation.y = -.46 + Math.sin(t * .09) * .16;
    for (const traveler of this.travelers) {
      const z = 3 - ((t * .32 + traveler.offset) % 7);
      const x = this.pathX(z);
      traveler.group.position.set(x, surface(x, z) + .36, z);
      traveler.group.rotation.y = Math.PI - Math.atan(Math.cos(z * .12) * .3);
      traveler.legs[0].rotation.x = Math.sin(t * 3 + traveler.offset) * .3;
      traveler.legs[1].rotation.x = -Math.sin(t * 3 + traveler.offset) * .3;
    }
    for (const reed of this.reeds) reed.group.rotation.z = Math.sin(t * .85 + reed.phase) * .018;
    const matrix = new THREE.Matrix4();
    if (this.waterGlints) {
      for (let i = 0; i < this.glintBase.length; i++) {
        const b = this.glintBase[i];
        const shimmer = .45 + Math.sin(t * .65 + b.phase) * .4;
        matrix.makeScale(b.length * shimmer, 1, 1); matrix.setPosition(b.x + Math.sin(t * .25 + b.phase) * .14, b.y, b.z); this.waterGlints.setMatrixAt(i, matrix);
      }
      this.waterGlints.instanceMatrix.needsUpdate = true;
    }
    if (this.droplets) {
      for (let i = 0; i < this.dropBase.length; i++) {
        const b = this.dropBase[i]; matrix.makeTranslation(b.x, b.y + b.span * (1 - ((t * .7 + b.phase) % 1)), b.z);
        this.droplets.setMatrixAt(i, matrix);
      }
      this.droplets.instanceMatrix.needsUpdate = true;
    }
    if (this.fireflies) {
      const positions = this.fireflies.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        positions.setXYZ(i, this.fireflyBase[i * 3] + Math.sin(t * .3 + i * 2) * .35, this.fireflyBase[i * 3 + 1] + Math.sin(t * .6 + i) * .28, this.fireflyBase[i * 3 + 2] + Math.cos(t * .4 + i) * .35);
      }
      positions.needsUpdate = true;
    }
    try {
      this.renderer.render(this.scene, this.camera);
      if (!this.ready) { this.ready = true; window.dispatchEvent(new Event('world-ready')); }
    } catch (error) {
      this.ready = false;
      this.onError(error instanceof Error ? error.message : '景观未能完成绘制，请重新加载。'); return;
    }
    this.frame = requestAnimationFrame(this.animate);
  };

  get state() {
    return { ready: this.ready, view: this.activeView.id, transitioning: !!this.transition, paused: this.paused, camera: this.camera.position.toArray(), target: this.controls.target.toArray(), drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles };
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect(); this.controls.dispose();
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.reducedMotion.removeEventListener('change', this.handleMotionPreference);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>(); const textures = new Set<THREE.Texture>();
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Sprite) {
        if ('geometry' in object) geometries.add(object.geometry);
        const list = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of list) {
          materials.add(material);
          if ('map' in material && material.map instanceof THREE.Texture) textures.add(material.map);
        }
      }
    });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
    this.shadowLight.shadow.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
