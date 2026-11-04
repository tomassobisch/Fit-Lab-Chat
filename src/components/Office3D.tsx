import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Agente, Mensaje } from '../types';

// ---------------------------------------------------------------------------
// SEDE TJ FITLAB — oficina isométrica estilo pixel art. Un departamento por
// piso, sala de reuniones, ascensor y agentes animados con los que se habla.
// ---------------------------------------------------------------------------

interface Props {
  agentes: Agente[];
  mensajes: Mensaje[];
  typingNickname: string | null;
  isSending: boolean;
  onSend: (agent: Agente, text: string) => Promise<void>;
}

const PIXEL_SCALE = 2;
const FW = 26; // ancho del piso (x)
const FD = 20; // fondo del piso (z)
const WALL_H = 3.2;
const NEON = 0xccff00;
const LOGO_URL = '/logo-tjfitlab.png';
const MODERATOR = 'strategist';
const ISO_PITCH = Math.atan(1 / Math.SQRT2) * 0.95; // ~34°, vista isométrica clásica
const CHAR_SCALE = 1.28; // personajes más grandes y legibles

// Filtro pixel art: contorno oscuro por profundidad + paleta limitada con tramado Bayer 4x4
const PIXEL_ART_SHADER = {
  uniforms: {
    tColor: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    depthRange: { value: 400 },
    levels: { value: 20 }
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 resolution; uniform float depthRange; uniform float levels;
    varying vec2 vUv;
    float depthAt(vec2 uv) { return texture2D(tDepth, uv).x * depthRange; }
    float bayer4(vec2 p) {
      int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0)); int i = x + y * 4;
      float m[16];
      m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0; m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
      m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0; m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
      for (int k = 0; k < 16; k++) { if (k == i) return m[k] / 16.0; }
      return 0.0;
    }
    void main() {
      vec2 px = 1.0 / resolution;
      vec4 base = texture2D(tColor, vUv);
      float dc = depthAt(vUv);
      // Píxel de contorno si un vecino está claramente más lejos (borde del objeto que está delante)
      float edge = 0.0;
      float dn = max(max(depthAt(vUv + vec2(px.x, 0.0)), depthAt(vUv - vec2(px.x, 0.0))), max(depthAt(vUv + vec2(0.0, px.y)), depthAt(vUv - vec2(0.0, px.y))));
      if (dn - dc > 0.35) edge = 1.0;
      vec3 col = base.rgb;
      if (edge > 0.5) col = col * 0.32 + vec3(0.02, 0.02, 0.06);
      vec4 outCol = linearToOutputTexel(vec4(col, 1.0));
      // Paleta limitada con tramado ordenado
      float b = bayer4(gl_FragCoord.xy) - 0.5;
      outCol.rgb = floor(outCol.rgb * levels + 0.5 + b * 0.55) / levels;
      gl_FragColor = vec4(clamp(outCol.rgb, 0.0, 1.0), 1.0);
    }`
};

// --- Paleta luminosa (inspirada en oficinas pixel art isométricas) ---
const C = {
  bg: 0xeef0fb,
  tileA: '#bfc5ef', tileB: '#c9cef4', grout: '#aab1e3',
  wall: 0xeceef8, wallSide: 0xdfe2f3, baseboard: 0x8e96c9,
  window: 0x9fd8ff, windowFrame: 0xffffff,
  desk: 0xe9e3d3, deskSide: 0xd2cab5, deskLeg: 0x9a9fb5,
  partition: 0xc9cfe0, partitionGlass: 0xa9d6f5,
  chair: 0x2f52d6, chairDark: 0x1f3aa8, chairBase: 0x3b3f4e,
  monitor: 0xd9d6cc, screen: 0x1e3a8a, screenOn: 0x60a5fa,
  sofa: 0x2f5fe0, sofaDark: 0x2146b8, rug: 0x22a447, rugDark: 0x1b8a3b,
  wood: 0x8b5a3c, pot: 0xc0643a, leaf: 0x2f9e44, leafLight: 0x4cc35e,
  shelf: 0x3e63d8, metal: 0xb8bfd3, paper: 0xffffff
};

// --- Departamentos (pisos) ---
interface Dept { name: string; short: string; color: number; match: (a: Agente) => boolean; }
const DEPTS: Dept[] = [
  { name: 'LOBBY · RECEPCIÓN · SALA DE REUNIONES', short: 'Lobby', color: 0x84cc16, match: a => /secretari|asistente|chief of staff/i.test(`${a.nickname} ${a.rol} ${a.nombre}`) },
  { name: 'MARKETING & CONTENIDO', short: 'Marketing', color: 0xec4899, match: a => /marketing|community|insta|reel|guion|edit|contenido|growth/i.test(`${a.nickname} ${a.rol}`) },
  { name: 'TECNOLOGÍA & DATOS', short: 'Tech & Datos', color: 0x06b6d4, match: a => /program|software|dev|datos|ingenier/i.test(`${a.nickname} ${a.rol}`) || a.nickname.toLowerCase() === 'data' },
  { name: 'RENDIMIENTO DEPORTIVO', short: 'Rendimiento', color: 0xf97316, match: a => /deport|fitness|rendimiento|actividad f/i.test(`${a.nickname} ${a.rol} ${a.nombre}`) },
  { name: 'NEGOCIO · ESTRATEGIA · LEGAL', short: 'Negocio', color: 0x8b5cf6, match: () => true }
];
const deptIndexFor = (a: Agente) => {
  for (let i = 0; i < DEPTS.length; i++) if (DEPTS[i].match(a)) return i;
  return DEPTS.length - 1;
};

// --- Utilidades ---
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = <T,>(arr: readonly T[], seed: number) => arr[seed % arr.length];
const mat = (color: THREE.ColorRepresentation) => new THREE.MeshLambertMaterial({ color });
const flat = (color: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({ color });
const glassMat = () => new THREE.MeshLambertMaterial({ color: C.partitionGlass, transparent: true, opacity: 0.45, depthWrite: false });

function box(w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  return mesh;
}

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, nearest = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; }
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function labelTexture(text: string, sub: string, bg: string, fg = '#ffffff', w = 256, h = 64) {
  return canvasTexture(w, h, g => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, w, 4);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = fg;
    g.font = `900 ${Math.round(h * (sub ? 0.36 : 0.46))}px ui-monospace, monospace`;
    g.fillText(text, w / 2, sub ? h * 0.38 : h / 2, w - 10);
    if (sub) { g.font = `700 ${Math.round(h * 0.2)}px ui-monospace, monospace`; g.globalAlpha = 0.85; g.fillText(sub, w / 2, h * 0.76, w - 10); }
  }, false);
}

// Suelo de baldosas lavanda (1 baldosa = 1 unidad)
function floorTexture(accent: string, w: number, d: number) {
  const t = canvasTexture(32, 32, g => {
    g.fillStyle = C.grout; g.fillRect(0, 0, 32, 32);
    g.fillStyle = C.tileA; g.fillRect(1, 1, 15, 15); g.fillRect(17, 17, 14, 14);
    g.fillStyle = C.tileB; g.fillRect(17, 1, 14, 15); g.fillRect(1, 17, 15, 14);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(1, 1, 15, 1); g.fillRect(17, 17, 14, 1);
    g.fillStyle = accent; g.globalAlpha = 0.08; g.fillRect(0, 0, 32, 32);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(w / 2, d / 2);
  return t;
}

// Ventana: cielo con nubes pixeladas
function windowTexture() {
  return canvasTexture(24, 16, g => {
    const grd = g.createLinearGradient(0, 0, 0, 16);
    grd.addColorStop(0, '#7cc7ff'); grd.addColorStop(1, '#c5ebff');
    g.fillStyle = grd; g.fillRect(0, 0, 24, 16);
    g.fillStyle = '#ffffff'; g.fillRect(3, 4, 6, 2); g.fillRect(4, 3, 3, 1); g.fillRect(14, 8, 7, 2); g.fillRect(16, 7, 3, 1);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, 0, 2, 16); g.fillRect(12, 0, 1, 16);
  });
}

// --- Caras pixel art (12x12) con parpadeo ---
function faceTextures(skin: string, hair: string, seed: number, female: boolean) {
  const draw = (blink: boolean) => canvasTexture(12, 12, g => {
    g.fillStyle = skin; g.fillRect(0, 0, 12, 12);
    g.fillStyle = hair; g.fillRect(2, 3, 2, 1); g.fillRect(8, 3, 2, 1);
    if (blink) { g.fillStyle = '#20202a'; g.fillRect(2, 5, 2, 1); g.fillRect(8, 5, 2, 1); }
    else { g.fillStyle = '#20202a'; g.fillRect(3, 4, 1, 2); g.fillRect(8, 4, 1, 2); g.fillStyle = '#ffffff'; g.fillRect(2, 4, 1, 2); g.fillRect(9, 4, 1, 2); }
    if (female) { g.fillStyle = 'rgba(240,110,130,0.5)'; g.fillRect(1, 7, 2, 1); g.fillRect(9, 7, 2, 1); }
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(5, 6, 2, 1); // nariz
    g.fillStyle = female ? '#c2415b' : '#8a3b3b';
    if (seed % 2 === 0) { g.fillRect(4, 8, 4, 1); g.fillRect(3, 7, 1, 1); g.fillRect(8, 7, 1, 1); } else g.fillRect(4, 8, 4, 1);
    if (!female && seed % 5 === 0) { g.fillStyle = hair; g.fillRect(2, 8, 8, 3); g.fillStyle = '#8a3b3b'; g.fillRect(4, 8, 4, 1); }
  });
  return { open: draw(false), closed: draw(true) };
}

const SKINS = ['#f7d7bd', '#f0c6a1', '#e0ad82', '#c68a5f', '#9a6440', '#6b4430'] as const;
const HAIRS = ['#2a1d16', '#4a2f1d', '#7a4a26', '#b07a3c', '#e2c06a', '#d9d4cb', '#1f1f2b', '#8b2c2c'] as const;
const PANTS = [0x26315a, 0x2b2b33, 0x4b5563, 0x1e3a8a, 0x5b4636] as const;

interface CharParts {
  group: THREE.Group; body: THREE.Group; head: THREE.Group;
  armL: THREE.Object3D; armR: THREE.Object3D; legL: THREE.Object3D; legR: THREE.Object3D;
  faceMat: THREE.MeshLambertMaterial; faces: { open: THREE.Texture; closed: THREE.Texture };
}

// Persona pixel/voxel de proporciones realistas, con accesorios por rol
function buildCharacter(key: string, role: string, shirtColor: number, isBoss = false): CharParts {
  const seed = hash(key);
  const female = !isBoss && seed % 3 === 1;
  const skin = isBoss ? '#f0c6a1' : pick(SKINS, seed >> 2);
  const hair = isBoss ? '#2a1d16' : pick(HAIRS, seed >> 5);
  const style = isBoss ? 'short' : female ? pick(['long', 'bun', 'bob'] as const, seed >> 8) : pick(['short', 'short', 'spiky', 'bald', 'curly'] as const, seed >> 8);
  const r = role.toLowerCase();
  const skinM = mat(skin), hairM = mat(hair), shirt = mat(shirtColor);
  const pantsM = mat(isBoss ? 0x111827 : pick(PANTS, seed >> 11)), shoes = mat(0x1f2937);

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const mkLeg = (x: number) => {
    const o = new THREE.Object3D(); o.position.set(x, 0.72, 0);
    o.add(box(0.15, 0.66, 0.17, female && seed % 2 ? skinM : pantsM, 0, -0.33, 0), box(0.16, 0.08, 0.24, shoes, 0, -0.68, 0.03));
    return o;
  };
  const legL = mkLeg(-0.09), legR = mkLeg(0.09);
  const torso = box(0.44, 0.6, 0.24, shirt, 0, 1.03, 0);
  const extras: THREE.Object3D[] = [];
  if (female && seed % 2) extras.push(box(0.46, 0.26, 0.28, pantsM, 0, 0.66, 0)); // falda
  else extras.push(box(0.44, 0.12, 0.25, pantsM, 0, 0.73, 0)); // cintura
  extras.push(box(0.2, 0.06, 0.02, mat(0xffffff), 0, 1.3, 0.125, false)); // cuello camisa
  const mkArm = (x: number) => {
    const o = new THREE.Object3D(); o.position.set(x, 1.3, 0);
    o.add(box(0.12, 0.52, 0.15, shirt, 0, -0.25, 0), box(0.11, 0.1, 0.13, skinM, 0, -0.55, 0));
    return o;
  };
  const armL = mkArm(-0.29), armR = mkArm(0.29);

  const head = new THREE.Group();
  head.position.set(0, 1.4, 0);
  const faces = faceTextures(skin, hair, seed, female);
  const faceMat = new THREE.MeshLambertMaterial({ map: faces.open });
  head.add(box(0.1, 0.08, 0.1, skinM, 0, 0.04, 0)); // cuello
  head.add(box(0.4, 0.42, 0.38, [skinM, skinM, hairM, skinM, faceMat, style === 'bald' ? skinM : hairM], 0, 0.29, 0));
  if (style !== 'bald') head.add(box(0.44, 0.1, 0.42, hairM, 0, 0.53, -0.01));
  if (style === 'short' || style === 'curly' || style === 'spiky') head.add(box(0.44, 0.24, 0.07, hairM, 0, 0.4, -0.19));
  if (style === 'spiky') [-0.12, 0, 0.12].forEach(x => head.add(box(0.1, 0.1, 0.1, hairM, x, 0.62, 0)));
  if (style === 'curly') head.add(box(0.48, 0.12, 0.46, hairM, 0, 0.58, 0));
  if (style === 'long') head.add(box(0.46, 0.62, 0.1, hairM, 0, 0.2, -0.2), box(0.06, 0.4, 0.34, hairM, -0.22, 0.28, -0.02), box(0.06, 0.4, 0.34, hairM, 0.22, 0.28, -0.02));
  if (style === 'bob') head.add(box(0.46, 0.34, 0.1, hairM, 0, 0.36, -0.2), box(0.06, 0.28, 0.36, hairM, -0.22, 0.35, 0), box(0.06, 0.28, 0.36, hairM, 0.22, 0.35, 0));
  if (style === 'bun') head.add(box(0.44, 0.24, 0.07, hairM, 0, 0.4, -0.19), box(0.18, 0.16, 0.16, hairM, 0, 0.64, -0.1));

  // Accesorios por rol
  const dark = mat(0x111111);
  if (/program|data|insta|analista|métric/.test(r)) head.add(box(0.14, 0.08, 0.02, dark, -0.1, 0.34, 0.2, false), box(0.14, 0.08, 0.02, dark, 0.1, 0.34, 0.2, false));
  if (/community|marketing|secretari|asistente/.test(r)) head.add(box(0.48, 0.04, 0.08, dark, 0, 0.55, 0), box(0.04, 0.16, 0.14, dark, -0.22, 0.3, 0), box(0.04, 0.16, 0.14, dark, 0.22, 0.3, 0), box(0.03, 0.03, 0.18, dark, 0.2, 0.18, 0.1, false));
  if (/legal|estrategia|qa|chief|secretari/.test(r) || isBoss) extras.push(box(0.06, 0.34, 0.02, mat(isBoss ? 0x65a30d : 0x7f1d1d), 0, 1.1, 0.125, false)); // corbata
  if (/legal|estrategia|chief/.test(r) || isBoss) extras.push(box(0.46, 0.6, 0.26, mat(isBoss ? 0x111827 : 0x334155), 0, 1.03, -0.01)); // americana (se ve por los lados)
  if (/headhunter|b2b|coach/.test(r)) head.add(box(0.46, 0.12, 0.44, mat(0x84cc16), 0, 0.56, 0), box(0.4, 0.03, 0.2, mat(0x84cc16), 0, 0.51, 0.28));
  if (/guion|edit|director/.test(r)) head.add(box(0.48, 0.08, 0.48, mat(0x7f1d1d), 0.03, 0.57, 0));
  if (/investigacion|deporte|actividad/.test(r)) head.add(box(0.44, 0.06, 0.42, mat(0xf97316), 0, 0.46, 0));
  if (/auditor|rendimiento/.test(r)) armL.add(box(0.03, 0.26, 0.2, mat(0x8b5a2b), -0.04, -0.55, 0.12, false));

  body.add(legL, legR, torso, ...extras, armL, armR, head);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), new THREE.MeshBasicMaterial({ color: 0x3b3f6b, transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012;
  group.add(shadow);
  return { group, body, head, armL, armR, legL, legR, faceMat, faces };
}

type BotState = 'work' | 'walk' | 'idle' | 'meeting' | 'break';
type Activity = { kind: 'water' | 'copier' | 'chat' | 'sofa'; spot: THREE.Vector3; face: THREE.Vector3; partner?: Bot };
interface Bot extends CharParts {
  agent: Agente;
  floor: number; at: number;
  home: THREE.Vector3; homeFace: THREE.Vector3; pod: THREE.Vector3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  state: BotState; timer: number;
  path: THREE.Vector3[]; side: number; phase: number; blinkAt: number;
  seat?: { pos: THREE.Vector3; face: THREE.Vector3 };
  sitting: boolean;
  activity?: Activity;
  chattedBy?: Bot;
}
type Nearby = { kind: 'agent'; agent: Agente } | { kind: 'elevator' } | { kind: 'meeting' } | null;

export const Office3D: React.FC<Props> = ({ agentes, mensajes, typingNickname, isSending, onSend }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Agente | null>(null);
  const [nearby, setNearby] = useState<Nearby>(null);
  const [draft, setDraft] = useState('');
  const [showHelp, setShowHelp] = useState(true);
  const [floor, setFloor] = useState(0);
  const [meeting, setMeeting] = useState(false);
  const [meetingPanel, setMeetingPanel] = useState(false);
  const [elevatorOpen, setElevatorOpen] = useState(false);
  const [fading, setFading] = useState(false);

  const typingRef = useRef(typingNickname);
  const mensajesRef = useRef(mensajes);
  const selectedRef = useRef<Agente | null>(null);
  const nearbyRef = useRef<Nearby>(null);
  const helpRef = useRef(true);
  const goToFloorRef = useRef<(f: number) => void>(() => {});
  const setMeetingRef = useRef<(on: boolean) => void>(() => {});
  const rotateRef = useRef<(dir: number) => void>(() => {});
  useEffect(() => { typingRef.current = typingNickname; }, [typingNickname]);
  useEffect(() => { mensajesRef.current = mensajes; }, [mensajes]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const floorsInfo = useMemo(() => DEPTS.map((d, i) => ({ ...d, index: i, agents: agentes.filter(a => deptIndexFor(a) === i) })), [agentes]);
  const agentKey = agentes.map(a => a.id).join('|');
  const moderator = agentes.find(a => a.nickname.toLowerCase() === MODERATOR) || agentes[0];

  useEffect(() => {
    const mount = mountRef.current;
    const labelsLayer = labelsRef.current;
    if (!mount || !labelsLayer || agentes.length === 0) return;

    // --- Renderer pixelado ---
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    Object.assign(canvas.style, { width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block', touchAction: 'none' });
    mount.appendChild(canvas);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(C.bg);
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
    // Render a textura de baja resolución (con profundidad) y filtro pixel art a pantalla
    const rt = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: new THREE.DepthTexture(2, 2) });
    const postMat = new THREE.ShaderMaterial({ ...PIXEL_ART_SHADER, uniforms: THREE.UniformsUtils.clone(PIXEL_ART_SHADER.uniforms), depthTest: false, depthWrite: false });
    postMat.uniforms.tColor.value = rt.texture;
    postMat.uniforms.tDepth.value = rt.depthTexture;
    postMat.uniforms.depthRange.value = camera.far - camera.near;
    const postScene = new THREE.Scene();
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
    const postCam = new THREE.Camera();
    const loader = new THREE.TextureLoader();
    const logoTex = loader.load(LOGO_URL, t => { t.colorSpace = THREE.SRGBColorSpace; });
    const winTex = windowTexture();

    // --- Luces de día ---
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8bde6, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.position.set(-14, 26, -10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0008;
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -20; sc.right = 20; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 80;
    scene.add(sun, sun.target);

    // --- Pisos ---
    const halfW = FW / 2, halfD = FD / 2;
    const floors: { content: THREE.Group; colliders: THREE.Box3[]; walls: { mesh: THREE.Object3D; normal: THREE.Vector3 }[] }[] = [];
    const elevatorFront = new THREE.Vector3(-halfW + 2.5, 0, halfD - 1.8);
    const addTo = (f: number, ...objs: THREE.Object3D[]) => floors[f].content.add(...objs);
    const collide = (f: number, ...objs: THREE.Object3D[]) => {
      for (const o of objs) {
        floors[f].content.add(o);
        o.updateMatrixWorld(true);
        floors[f].colliders.push(new THREE.Box3().setFromObject(o));
      }
    };

    // --- Mobiliario reutilizable ---
    const plant = (f: number, x: number, z: number, big = false) => {
      const g = new THREE.Group();
      const s = big ? 1.25 : 1;
      g.add(box(0.42 * s, 0.36 * s, 0.42 * s, mat(C.pot), 0, 0.18 * s, 0), box(0.46 * s, 0.06, 0.46 * s, mat(0xa3502c), 0, 0.37 * s, 0));
      g.add(box(0.08, 0.5 * s, 0.08, mat(C.wood), 0, 0.6 * s, 0));
      g.add(box(0.8 * s, 0.5 * s, 0.8 * s, mat(C.leaf), 0, 1.0 * s, 0), box(0.6 * s, 0.4 * s, 0.6 * s, mat(C.leafLight), 0.05, 1.38 * s, 0.05), box(0.36 * s, 0.24 * s, 0.36 * s, mat(C.leaf), -0.05, 1.66 * s, 0));
      g.position.set(x, 0, z);
      collide(f, g);
    };
    const bin = (f: number, x: number, z: number) => addTo(f, box(0.3, 0.38, 0.3, mat(0x9ca3af), x, 0.19, z), box(0.24, 0.02, 0.24, mat(0x4b5563), x, 0.385, z, false));
    const chairAt = (f: number, x: number, z: number, rotY: number) => {
      const g = new THREE.Group();
      g.add(box(0.52, 0.1, 0.5, mat(C.chair), 0, 0.5, 0), box(0.5, 0.56, 0.1, mat(C.chair), 0, 0.84, 0.24), box(0.06, 0.36, 0.06, mat(C.chairBase), 0, 0.27, 0));
      [0, 1, 2, 3, 4].forEach(i => { const a = (i / 5) * Math.PI * 2; g.add(box(0.24, 0.04, 0.05, mat(C.chairBase), Math.cos(a) * 0.13, 0.05, Math.sin(a) * 0.13)); });
      g.add(box(0.06, 0.04, 0.38, mat(C.chairDark), -0.27, 0.66, 0), box(0.06, 0.04, 0.38, mat(C.chairDark), 0.27, 0.66, 0));
      g.position.set(x, 0, z); g.rotation.y = rotY;
      addTo(f, g);
    };
    const monitorAt = (f: number, x: number, z: number, accent: number) => {
      addTo(f, box(0.62, 0.46, 0.42, mat(C.monitor), x, 1.18, z), box(0.52, 0.36, 0.02, flat(C.screen), x, 1.2, z - 0.215, false));
      addTo(f, box(0.44, 0.04, 0.02, flat(accent), x, 1.28, z - 0.222, false), box(0.3, 0.03, 0.02, flat(C.screenOn), x, 1.18, z - 0.222, false), box(0.36, 0.03, 0.02, flat(C.screenOn), x, 1.12, z - 0.222, false));
      addTo(f, box(0.2, 0.06, 0.2, mat(C.monitor), x, 0.93, z));
    };
    const deskAt = (f: number, x: number, z: number, w = 1.9, accent = 0x60a5fa) => {
      collide(f, box(w, 0.08, 1.0, mat(C.desk), x, 0.86, z));
      addTo(f, box(0.5, 0.78, 0.9, mat(C.deskSide), x + w / 2 - 0.28, 0.42, z), box(0.04, 0.78, 0.04, mat(C.deskLeg), x - w / 2 + 0.08, 0.42, z - 0.42), box(0.04, 0.78, 0.04, mat(C.deskLeg), x - w / 2 + 0.08, 0.42, z + 0.42));
      [0.18, 0.44, 0.68].forEach(y => addTo(f, box(0.03, 0.02, 0.12, mat(0x6b7280), x + w / 2 - 0.28, y, z - 0.46, false)));
      monitorAt(f, x - 0.15, z - 0.1, accent);
      addTo(f, box(0.5, 0.03, 0.16, mat(0xf3f4f6), x - 0.15, 0.915, z + 0.25), box(0.1, 0.03, 0.14, mat(0xf3f4f6), x + 0.3, 0.915, z + 0.28));
      addTo(f, box(0.28, 0.02, 0.36, mat(C.paper), x + 0.62, 0.91, z + 0.05), box(0.1, 0.12, 0.1, mat(accent), x + 0.62, 0.96, z - 0.3));
    };
    const partitionAt = (f: number, x: number, z: number, w: number, d: number) => {
      const p = box(w, 1.25, d, mat(C.partition), x, 0.625, z);
      const top = box(w + 0.02, 0.32, d + 0.02, glassMat(), x, 1.41, z, false);
      const trim = box(w + 0.04, 0.05, d + 0.04, mat(0x9aa3c7), x, 1.59, z, false);
      collide(f, p); addTo(f, top, trim);
    };
    const bookshelf = (f: number, x: number, z: number, rotY = 0) => {
      const g = new THREE.Group();
      g.add(box(1.0, 2.1, 0.4, mat(C.shelf), 0, 1.05, 0));
      g.add(box(0.9, 1.96, 0.3, mat(0xdbe4ff), 0, 1.05, 0.06));
      [0.35, 0.85, 1.35, 1.8].forEach((y, row) => {
        g.add(box(0.92, 0.04, 0.32, mat(C.shelf), 0, y - 0.2, 0.05));
        for (let i = 0; i < 5; i++) g.add(box(0.13, 0.32 - (i % 2) * 0.06, 0.24, mat(new THREE.Color().setHSL(((i * 0.21 + row * 0.13) % 1), 0.65, 0.55)), -0.32 + i * 0.16, y, 0.06));
      });
      g.position.set(x, 0, z); g.rotation.y = rotY;
      collide(f, g);
    };
    const sofaAt = (f: number, x: number, z: number, rotY = 0, w = 2.2) => {
      const g = new THREE.Group();
      g.add(box(w, 0.42, 0.9, mat(C.sofa), 0, 0.24, 0), box(w, 0.6, 0.24, mat(C.sofaDark), 0, 0.55, 0.36), box(0.22, 0.55, 0.9, mat(C.sofaDark), -w / 2, 0.36, 0), box(0.22, 0.55, 0.9, mat(C.sofaDark), w / 2, 0.36, 0));
      g.add(box(0.36, 0.14, 0.36, mat(0xf59e0b), -w / 2 + 0.45, 0.52, 0.05), box(0.36, 0.14, 0.36, mat(0xf59e0b), w / 2 - 0.45, 0.52, 0.05));
      g.position.set(x, 0, z); g.rotation.y = rotY;
      collide(f, g);
    };
    const rugAt = (f: number, x: number, z: number, w: number, d: number, color = C.rug) => {
      addTo(f, box(w, 0.02, d, mat(color), x, 0.012, z, false), box(w - 0.3, 0.025, d - 0.3, mat(color === C.rug ? C.rugDark : color), x, 0.014, z, false));
    };
    const coffeeTable = (f: number, x: number, z: number) => {
      collide(f, box(1.2, 0.08, 0.7, mat(0x14532d), x, 0.38, z));
      addTo(f, box(0.06, 0.34, 0.06, mat(0x14532d), x - 0.5, 0.17, z - 0.28), box(0.06, 0.34, 0.06, mat(0x14532d), x + 0.5, 0.17, z + 0.28));
      addTo(f, box(0.4, 0.06, 0.4, mat(0xfbbf24), x, 0.45, z), box(0.12, 0.1, 0.12, mat(0xef4444), x - 0.08, 0.52, z), box(0.12, 0.1, 0.12, mat(0x84cc16), x + 0.1, 0.52, z + 0.05));
    };
    const copier = (f: number, x: number, z: number) => {
      collide(f, box(1.1, 0.95, 0.8, mat(0xe5e7eb), x, 0.48, z));
      addTo(f, box(1.0, 0.18, 0.7, mat(0xd1d5db), x, 1.05, z), box(0.5, 0.04, 0.3, mat(0x9ca3af), x - 0.15, 1.15, z), box(0.2, 0.08, 0.12, flat(0x22c55e), x + 0.3, 1.16, z - 0.2, false), box(0.7, 0.05, 0.35, mat(0xffffff), x, 0.62, z - 0.45));
    };
    const waterCooler = (f: number, x: number, z: number) => {
      collide(f, box(0.45, 1.0, 0.45, mat(0xf3f4f6), x, 0.5, z));
      addTo(f, box(0.36, 0.5, 0.36, new THREE.MeshLambertMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.75 }), x, 1.25, z), box(0.1, 0.06, 0.06, mat(0x3b82f6), x - 0.08, 0.75, z - 0.24, false), box(0.1, 0.06, 0.06, mat(0xef4444), x + 0.08, 0.75, z - 0.24, false));
    };
    const posterAt = (f: number, x: number, y: number, z: number, rotY: number, tex: THREE.Texture, w = 0.8, h = 1.0) => {
      const fr = box(w + 0.08, h + 0.08, 0.04, mat(0xffffff), x, y, z, false);
      fr.rotation.y = rotY;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
      p.position.set(x, y, z); p.rotation.y = rotY; p.translateZ(0.025);
      addTo(f, fr, p);
    };
    const clockTex = canvasTexture(16, 16, g => { g.fillStyle = '#fff'; g.beginPath(); g.arc(8, 8, 7, 0, 7); g.fill(); g.strokeStyle = '#1f2937'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = '#1f2937'; g.fillRect(7.5, 3, 1, 5.5); g.fillRect(8, 7.5, 4, 1); });
    const chartTex = canvasTexture(16, 20, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 16, 20); g.fillStyle = '#3b82f6'; g.fillRect(2, 12, 3, 6); g.fillStyle = '#22c55e'; g.fillRect(6, 8, 3, 10); g.fillStyle = '#f59e0b'; g.fillRect(10, 4, 3, 14); g.fillStyle = '#1f2937'; g.fillRect(2, 2, 10, 1); });

    // --- Estructura de cada piso ---
    DEPTS.forEach((dept, f) => {
      const content = new THREE.Group();
      scene.add(content);
      floors.push({ content, colliders: [], walls: [] });
      const accentHex = '#' + new THREE.Color(dept.color).getHexString();

      // Base del edificio (bloque bajo el suelo) y suelo de baldosas
      addTo(f, box(FW + 0.6, 1.2, FD + 0.6, mat(0xa5acd8), 0, -0.6, 0));
      addTo(f, box(FW + 0.62, 0.12, FD + 0.62, mat(dept.color), 0, -0.2, 0, false));
      const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(FW, FD), new THREE.MeshLambertMaterial({ map: floorTexture(accentHex, FW, FD) }));
      floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.y = 0.005; floorMesh.receiveShadow = true;
      floorMesh.name = 'floor';
      content.add(floorMesh);

      // Paredes perimetrales con ventanas; las que tapan la vista se ocultan
      const mkWall = (x: number, z: number, len: number, vertical: boolean, normal: THREE.Vector3) => {
        const g = new THREE.Group();
        g.add(box(vertical ? 0.3 : len, WALL_H, vertical ? len : 0.3, [mat(C.wallSide), mat(C.wallSide), mat(0xf8f9ff), mat(C.wall), mat(C.wall), mat(C.wall)], 0, WALL_H / 2, 0));
        g.add(box(vertical ? 0.34 : len, 0.18, vertical ? len : 0.34, mat(C.baseboard), 0, 0.09, 0, false));
        g.add(box(vertical ? 0.34 : len, 0.08, vertical ? len : 0.34, mat(dept.color), 0, WALL_H - 0.04, 0, false));
        const count = Math.floor(len / 3.2);
        for (let i = 0; i < count; i++) {
          const t = -len / 2 + (i + 0.5) * (len / count);
          const off = -normal.length() * 0.16;
          const wx = vertical ? normal.x * off : t, wz = vertical ? t : normal.z * off;
          const frame = box(vertical ? 0.06 : 1.7, 1.35, vertical ? 1.7 : 0.06, mat(C.windowFrame), wx, 1.75, wz, false);
          const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.2), new THREE.MeshBasicMaterial({ map: winTex }));
          pane.position.set(vertical ? wx - normal.x * 0.035 : wx, 1.75, vertical ? wz : wz - normal.z * 0.035);
          pane.rotation.y = Math.atan2(-normal.x, -normal.z);
          const sill = box(vertical ? 0.2 : 1.8, 0.06, vertical ? 1.8 : 0.2, mat(0xffffff), wx - normal.x * 0.08, 1.05, wz - normal.z * 0.08, false);
          const mid = box(vertical ? 0.07 : 0.06, 1.2, vertical ? 0.06 : 0.07, mat(C.windowFrame), wx - normal.x * 0.04, 1.75, wz - normal.z * 0.04, false);
          g.add(frame, pane, sill, mid);
        }
        g.position.set(x, 0, z);
        addTo(f, g);
        floors[f].walls.push({ mesh: g, normal });
      };
      mkWall(0, -halfD, FW, false, new THREE.Vector3(0, 0, -1));
      mkWall(0, halfD, FW, false, new THREE.Vector3(0, 0, 1));
      mkWall(-halfW, 0, FD, true, new THREE.Vector3(-1, 0, 0));
      mkWall(halfW, 0, FD, true, new THREE.Vector3(1, 0, 0));

      // Ascensor en la pared del fondo
      const ex = elevatorFront.x, ez = halfD - 0.25;
      collide(f, box(2.4, 2.9, 0.4, mat(0x9aa3c7), ex, 1.45, ez));
      addTo(f, box(0.9, 2.3, 0.05, mat(C.metal), ex - 0.47, 1.17, ez - 0.22), box(0.9, 2.3, 0.05, mat(C.metal), ex + 0.47, 1.17, ez - 0.22), box(0.04, 2.3, 0.06, mat(0x6b7280), ex, 1.17, ez - 0.23));
      addTo(f, box(0.18, 0.4, 0.04, mat(0x374151), ex + 1.35, 1.25, ez - 0.2), box(0.08, 0.08, 0.02, flat(0xf59e0b), ex + 1.35, 1.35, ez - 0.23, false), box(0.08, 0.08, 0.02, flat(0x22c55e), ex + 1.35, 1.17, ez - 0.23, false));
      const elevSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: labelTexture(`PISO ${f}`, 'ASCENSOR · E', '#1f2937', '#a3e635', 256, 64) }));
      elevSign.position.set(ex, 2.65, ez - 0.22); elevSign.rotation.y = Math.PI;
      addTo(f, elevSign);
      rugAt(f, ex, halfD - 1.4, 2.6, 1.4, 0x6b7280);

      // Cartel del departamento en la pared del fondo
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.9), new THREE.MeshBasicMaterial({ map: labelTexture(dept.short.toUpperCase(), dept.name, accentHex, '#ffffff', 384, 76) }));
      sign.position.set(2, 2.45, halfD - 0.17); sign.rotation.y = Math.PI;
      addTo(f, sign);
      posterAt(f, -halfW + 0.17, 2.4, -2, Math.PI / 2, clockTex, 0.5, 0.5);
    });

    // --- Piso 0: lobby, recepción y sala de reuniones ---
    const F0 = 0;
    // Pared de logo y recepción
    const logoPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: logoTex }));
    logoPlane.position.set(-4.5, 1.9, halfD - 0.17); logoPlane.rotation.y = Math.PI;
    addTo(F0, box(2.3, 2.3, 0.06, mat(0x111111), -4.5, 1.9, halfD - 0.16, false), logoPlane);
    collide(F0, box(3.6, 0.95, 0.8, mat(0x1f2937), -4.5, 0.48, 5.6));
    addTo(F0, box(3.8, 0.08, 1.0, mat(C.desk), -4.5, 0.99, 5.6), box(3.62, 0.1, 0.02, flat(0x84cc16), -4.5, 0.6, 5.19, false));
    monitorAt(F0, -5.2, 5.8, 0x84cc16);
    addTo(F0, box(0.3, 0.2, 0.2, mat(0xf9fafb), -3.6, 1.12, 5.7), box(0.24, 0.3, 0.24, mat(C.pot), -3.4, 1.18, 5.4), box(0.3, 0.3, 0.3, mat(C.leafLight), -3.4, 1.45, 5.4));
    chairAt(F0, -4.5, 6.6, 0);
    // Zona de espera
    rugAt(F0, -9, -5, 4.6, 3.4);
    sofaAt(F0, -9, -3.9, 0, 2.6);
    sofaAt(F0, -10.6, -5.6, -Math.PI / 2, 2.2);
    coffeeTable(F0, -8.6, -5.4);
    plant(F0, -12, -8.8, true); plant(F0, -1.2, 8.8); plant(F0, 0.8, -8.8, true); plant(F0, 12, -8.8);
    waterCooler(F0, -1, -8.9);
    // Logo en el suelo de la entrada
    const logoFloor = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), new THREE.MeshBasicMaterial({ map: logoTex }));
    logoFloor.rotation.set(-Math.PI / 2, 0, -3 * Math.PI / 4); logoFloor.position.set(-4.5, 0.02, 0.5);
    addTo(F0, logoFloor, (() => { const r = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.75, 32), flat(0x84cc16)); r.rotation.x = -Math.PI / 2; r.position.set(-4.5, 0.021, 0.5); return r; })());

    // Sala de reuniones (esquina del fondo derecho) con mamparas de cristal y puerta
    const MR = { x0: 2, x1: halfW, z0: 0.6, z1: halfD };
    const mrMid = new THREE.Vector3((MR.x0 + MR.x1) / 2 + 0.2, 0, (MR.z0 + MR.z1) / 2 + 0.2);
    const doorX0 = 5.6, doorX1 = 7.4;
    partitionAt(F0, (MR.x0 + doorX0) / 2, MR.z0, doorX0 - MR.x0, 0.12);
    partitionAt(F0, (doorX1 + MR.x1) / 2, MR.z0, MR.x1 - doorX1, 0.12);
    partitionAt(F0, MR.x0, (MR.z0 + MR.z1) / 2, 0.12, MR.z1 - MR.z0);
    const mrSign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.36), new THREE.MeshBasicMaterial({ map: labelTexture('SALA DE REUNIONES', '', '#1f2937', '#a3e635', 256, 52) }));
    mrSign.position.set((doorX0 + doorX1) / 2, 1.9, MR.z0 - 0.08); mrSign.rotation.y = Math.PI;
    addTo(F0, mrSign, box(doorX1 - doorX0 + 0.2, 0.1, 0.14, mat(0x9aa3c7), (doorX0 + doorX1) / 2, 1.62, MR.z0, false));
    rugAt(F0, mrMid.x, mrMid.z, 8, 4.6, 0x334155);
    collide(F0, box(6.2, 0.1, 1.7, mat(0xf3f4f6), mrMid.x, 0.86, mrMid.z));
    addTo(F0, box(6.0, 0.06, 1.5, mat(0xd1d5db), mrMid.x, 0.8, mrMid.z), box(0.5, 0.78, 0.5, mat(0x6b7280), mrMid.x - 2.2, 0.4, mrMid.z), box(0.5, 0.78, 0.5, mat(0x6b7280), mrMid.x + 2.2, 0.4, mrMid.z));
    [-2.3, -0.8, 0.8, 2.3].forEach(dx => addTo(F0, box(0.3, 0.02, 0.4, mat(C.paper), mrMid.x + dx, 0.92, mrMid.z - 0.4, false), box(0.3, 0.02, 0.4, mat(C.paper), mrMid.x + dx, 0.92, mrMid.z + 0.4, false)));
    addTo(F0, box(0.4, 0.04, 0.3, mat(0x111827), mrMid.x, 0.93, mrMid.z), box(0.4, 0.26, 0.02, flat(0x1e3a8a), mrMid.x, 1.06, mrMid.z + 0.15, false));
    // Pantalla con el logo en la pared del fondo de la sala
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: logoTex }));
    screen.position.set(mrMid.x + 1.6, 1.85, halfD - 0.18); screen.rotation.y = Math.PI;
    addTo(F0, box(2.9, 1.95, 0.06, mat(0x111827), mrMid.x + 1.6, 1.85, halfD - 0.17, false), screen);
    posterAt(F0, mrMid.x - 1.8, 1.85, halfD - 0.16, Math.PI, chartTex, 1.2, 1.4);
    plant(F0, MR.x1 - 0.8, MR.z1 - 0.8);
    const seats: { pos: THREE.Vector3; face: THREE.Vector3 }[] = [];
    for (let i = 0; i < 5; i++) {
      const x = mrMid.x - 2.4 + i * 1.2;
      for (const side of [-1, 1]) {
        const z = mrMid.z + side * 1.25;
        chairAt(F0, x, z, side < 0 ? Math.PI : 0);
        seats.push({ pos: new THREE.Vector3(x, 0, z), face: new THREE.Vector3(x, 0, mrMid.z) });
      }
    }
    [-1, 1].forEach(side => {
      const x = mrMid.x + side * 3.6;
      chairAt(F0, x, mrMid.z, side < 0 ? -Math.PI / 2 : Math.PI / 2);
      seats.push({ pos: new THREE.Vector3(x, 0, mrMid.z), face: new THREE.Vector3(mrMid.x, 0, mrMid.z) });
    });

    // --- Pisos de departamentos: cubículos y zonas comunes ---
    const bots: Bot[] = [];
    const deptAgents = DEPTS.map((_, i) => agentes.filter(a => deptIndexFor(a) === i));
    const POD_Z = 3.8;
    const podX = (f: number, i: number) => {
      const n = Math.max(deptAgents[f].length, 1);
      const spacing = Math.min(5.6, (FW - 8) / n);
      return (i - (n - 1) / 2) * spacing + 1.5;
    };

    for (let f = 1; f < DEPTS.length; f++) {
      const accent = DEPTS[f].color;
      const n = deptAgents[f].length;
      deptAgents[f].forEach((_, i) => {
        const px = podX(f, i);
        // Cubículo: mampara trasera + laterales, escritorio, silla y papelera
        partitionAt(f, px, POD_Z + 1.5, 5.0, 0.12);
        if (i === 0) partitionAt(f, px - 2.5, POD_Z + 0.45, 0.12, 2.2);
        partitionAt(f, px + 2.5, POD_Z + 0.45, 0.12, 2.2);
        deskAt(f, px, POD_Z - 0.55, 1.9, accent);
        chairAt(f, px, POD_Z + 0.5, 0);
        bin(f, px + 1.4, POD_Z + 0.9);
        // Tablón con notas en la mampara
        addTo(f, box(0.7, 0.45, 0.02, mat(0xfef3c7), px - 1.2, 1.05, POD_Z + 1.43, false), box(0.15, 0.15, 0.01, flat(0xfde047), px - 1.4, 1.1, POD_Z + 1.42, false), box(0.15, 0.15, 0.01, flat(0xf9a8d4), px - 1.05, 1.0, POD_Z + 1.42, false));
        addTo(f, box(4.9, 0.05, 0.14, flat(accent), px, 1.62, POD_Z + 1.5, false));
      });
      if (n === 0) partitionAt(f, 1.5, POD_Z + 1.5, 5, 0.12);

      // Zona lounge (sofá, alfombra, mesita) — como en las oficinas pixel art clásicas
      rugAt(f, -8.6, -5.6, 4.4, 3.2);
      sofaAt(f, -8.6, -4.6, 0, 2.6);
      sofaAt(f, -10.3, -6.3, -Math.PI / 2, 2.0);
      coffeeTable(f, -8.3, -6.1);
      bookshelf(f, 4.5, halfD - 0.5, Math.PI);
      bookshelf(f, 5.6, halfD - 0.5, Math.PI);
      waterCooler(f, 7.2, halfD - 0.6);
      copier(f, halfW - 0.9, -3.5);
      plant(f, halfW - 1, -8.8, true); plant(f, -halfW + 1, -8.8); plant(f, -2.8, halfD - 0.8);
      posterAt(f, halfW - 0.17, 1.9, 2, -Math.PI / 2, chartTex, 0.8, 1.0);

      // Decoración temática del departamento
      if (f === 1) { // Marketing: set de grabación
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 18), flat(0xffffff));
        ring.position.set(3.5, 1.8, -6.2); ring.rotation.y = 0.5;
        addTo(f, ring, box(0.05, 1.8, 0.05, mat(0x374151), 3.5, 0.9, -6.2));
        addTo(f, box(0.42, 0.3, 0.26, mat(0x111827), 5.0, 1.4, -6.8), box(0.15, 0.15, 0.16, mat(0x374151), 5.0, 1.4, -6.6), box(0.05, 1.25, 0.05, mat(0x374151), 5.0, 0.62, -6.8));
        collide(f, box(3.2, 2.4, 0.08, mat(0xfbcfe8), 4.2, 1.2, -8.4));
        posterAt(f, 4.2, 1.6, -8.33, 0, labelTexture('TJ', 'FITLAB REELS', '#ec4899', '#fff', 128, 64), 1.1, 0.55);
      }
      if (f === 2) { // Tecnología: racks de servidores
        for (let i = 0; i < 3; i++) {
          collide(f, box(0.9, 2.1, 0.9, mat(0x1f2937), 2.6 + i * 1.0, 1.05, -8.3));
          for (let l = 0; l < 6; l++) addTo(f, box(0.6, 0.04, 0.02, flat(l % 2 ? 0x22d3ee : 0x22c55e), 2.6 + i * 1.0, 0.4 + l * 0.28, -7.84, false));
        }
        bin(f, 6.2, -8.4);
      }
      if (f === 3) { // Rendimiento: cinta, mancuernas, kettlebells
        collide(f, box(0.9, 0.22, 2.2, mat(0x1f2937), 3.2, 0.13, -6.6));
        addTo(f, box(0.72, 0.03, 1.9, mat(0x111111), 3.2, 0.26, -6.6), box(0.9, 1.1, 0.1, mat(0x4b5563), 3.2, 0.8, -7.75), box(0.6, 0.2, 0.08, flat(0xf97316), 3.2, 1.3, -7.7, false));
        collide(f, box(2.4, 0.8, 0.6, mat(0x4b5563), 6.2, 0.4, -8.4));
        for (let i = 0; i < 4; i++) {
          const db = new THREE.Group();
          db.add(box(0.36, 0.05, 0.05, mat(0xd1d5db)), box(0.08, 0.16, 0.16, mat(0x111827), -0.17, 0, 0), box(0.08, 0.16, 0.16, mat(0x111827), 0.17, 0, 0));
          db.position.set(5.3 + i * 0.6, 0.9, -8.4); addTo(f, db);
        }
        [[8.2, -7.6], [8.8, -7.9]].forEach(([x, z]) => addTo(f, box(0.36, 0.32, 0.36, mat(0xf97316), x, 0.16, z), box(0.24, 0.1, 0.06, mat(0x111827), x, 0.4, z)));
        rugAt(f, 6, -7.2, 6.4, 2.6, 0x374151);
      }
      if (f === 4) { // Negocio: pizarra y mesa de trabajo
        collide(f, box(2.6, 1.5, 0.08, mat(0xffffff), 4.2, 1.35, -8.9));
        addTo(f, box(2.7, 1.6, 0.04, mat(0x9ca3af), 4.2, 1.35, -8.95), box(0.8, 0.05, 0.1, mat(0x9ca3af), 4.2, 0.55, -8.85));
        posterAt(f, 4.2, 1.4, -8.85, 0, chartTex, 1.6, 1.1);
        collide(f, box(2.0, 0.08, 1.1, mat(C.desk), 4.2, 0.78, -6.6));
        addTo(f, box(0.08, 0.74, 0.9, mat(C.deskLeg), 3.3, 0.38, -6.6), box(0.08, 0.74, 0.9, mat(C.deskLeg), 5.1, 0.38, -6.6), box(0.4, 0.02, 0.3, mat(C.paper), 4.0, 0.83, -6.6, false));
      }
    }

    // Puntos de interés para las rutinas de los agentes
    const poiFor = (f: number) => {
      const lastPodX = Math.max(...deptAgents[f].map((_, i) => podX(f, i)), 1.5) + 3.1;
      if (f === 0) return {
        water: { spot: new THREE.Vector3(-1, 0, -8.1), face: new THREE.Vector3(-1, 0, -8.9) },
        copier: null,
        sofa: { spot: new THREE.Vector3(-8.6, 0, -6.2), face: new THREE.Vector3(-8.6, 0, -6.6) },
        detourX: 0
      };
      return {
        water: { spot: new THREE.Vector3(7.2, 0, halfD - 1.4), face: new THREE.Vector3(7.2, 0, halfD - 0.6) },
        copier: { spot: new THREE.Vector3(halfW - 2.1, 0, -3.5), face: new THREE.Vector3(halfW - 0.9, 0, -3.5) },
        sofa: { spot: new THREE.Vector3(-8.0, 0, -5.4), face: new THREE.Vector3(-8.0, 0, -6.4) },
        detourX: lastPodX
      };
    };

    // --- Agentes ---
    agentes.forEach(agent => {
      const f = deptIndexFor(agent);
      const base = new THREE.Color(DEPTS[f].color);
      const shirtCol = f === 0 ? 0xffffff : base.clone().lerp(new THREE.Color(0xffffff), (hash(agent.id) % 3) * 0.18).getHex();
      const ch = buildCharacter(agent.id, `${agent.rol} ${agent.nickname} ${agent.nombre}`, shirtCol);
      let home: THREE.Vector3, homeFace: THREE.Vector3, pod: THREE.Vector3, bounds: Bot['bounds'];
      if (f === 0) {
        home = new THREE.Vector3(-4.5, 0, 6.6); homeFace = new THREE.Vector3(-4.5, 0, 0); pod = home.clone();
        bounds = { minX: -8, maxX: -1.5, minZ: -2.5, maxZ: 3.5 };
      } else {
        const px = podX(f, deptAgents[f].indexOf(agent));
        pod = new THREE.Vector3(px, 0, POD_Z);
        home = new THREE.Vector3(px, 0, POD_Z + 0.5); homeFace = new THREE.Vector3(px, 0, 0);
        bounds = { minX: px - 2, maxX: px + 2, minZ: -2.5, maxZ: 2.2 };
      }
      ch.group.position.copy(home);
      ch.group.scale.setScalar(CHAR_SCALE);
      ch.group.traverse(o => { o.userData.agentId = agent.id; });
      floors[f].content.add(ch.group);
      bots.push({
        ...ch, agent, floor: f, at: f, home, homeFace, pod, bounds,
        state: 'work', timer: 2 + Math.random() * 8, path: [], side: hash(agent.id) % 2 ? 1 : -1,
        phase: Math.random() * 10, blinkAt: 1 + Math.random() * 4, sitting: true
      });
    });
    seats.forEach((s, i) => { if (bots[i]) bots[i].seat = s; });

    // --- Jefe (jugador) ---
    const player = buildCharacter('jefe-tj', 'jefe', 0xffffff, true);
    player.group.scale.setScalar(CHAR_SCALE);
    const playerRing = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 20), new THREE.MeshBasicMaterial({ color: NEON, side: THREE.DoubleSide }));
    playerRing.rotation.x = -Math.PI / 2; playerRing.position.y = 0.02;
    player.group.add(playerRing);
    let playerFloor = 0;
    player.group.position.set(-4.5, 0, -2);
    floors[0].content.add(player.group);
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.26, 14), new THREE.MeshBasicMaterial({ color: NEON, side: THREE.DoubleSide }));
    marker.rotation.x = -Math.PI / 2; marker.position.y = 0.03; marker.visible = false;
    floors[0].content.add(marker);

    const applyFloorVisibility = () => floors.forEach((fl, i) => { fl.content.visible = i === playerFloor; });
    applyFloorVisibility();

    // --- Etiquetas DOM ---
    const labels = new Map<string, { root: HTMLDivElement; bubble: HTMLDivElement; emote: HTMLDivElement }>();
    labelsLayer.innerHTML = '';
    for (const b of bots) {
      const color = '#' + new THREE.Color(DEPTS[b.floor].color).getHexString();
      const root = document.createElement('div');
      root.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;text-align:center;white-space:nowrap;display:none;';
      const bubble = document.createElement('div');
      bubble.style.cssText = `display:none;max-width:220px;white-space:normal;margin:0 auto 5px;padding:6px 8px;border-radius:8px;background:#ffffff;border:2px solid ${color};color:#1f2937;font:700 10px/1.35 ui-monospace,monospace;box-shadow:3px 3px 0 ${color}55;text-align:left;`;
      const name = document.createElement('div');
      name.style.cssText = `display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:4px;background:${color};color:#fff;font:800 9px ui-monospace,monospace;letter-spacing:.03em;box-shadow:2px 2px 0 rgba(0,0,0,.18);`;
      name.textContent = `@${b.agent.nickname}`;
      const emote = document.createElement('div');
      emote.style.cssText = 'display:none;width:22px;height:22px;margin:0 auto 3px;border-radius:5px;background:#fff;border:2px solid #1f2937;box-shadow:2px 2px 0 rgba(31,41,55,.25);font:13px/18px sans-serif;text-align:center;';
      root.append(bubble, emote, name);
      labelsLayer.appendChild(root);
      labels.set(b.agent.id, { root, bubble, emote });
    }

    // --- Rutas, pisos y reuniones ---
    const moveBotToFloor = (b: Bot, f: number, pos: THREE.Vector3) => {
      floors[f].content.add(b.group);
      b.at = f; b.group.position.copy(pos); b.path = [];
    };
    const doorMid = (doorX0 + doorX1) / 2;
    const inMeetingRoom = (v: THREE.Vector3) => v.x > MR.x0 && v.z > MR.z0;
    const planTo = (b: Bot, dest: THREE.Vector3) => {
      const g = b.group.position;
      const pts: THREE.Vector3[] = [];
      if (b.state === 'meeting' && b.at === 0) {
        if (!inMeetingRoom(g)) pts.push(new THREE.Vector3(doorMid, 0, MR.z0 - 0.9), new THREE.Vector3(doorMid, 0, MR.z0 + 0.9));
        const sideZ = dest.z === mrMid.z ? mrMid.z : mrMid.z + Math.sign(dest.z - mrMid.z) * 2.1;
        pts.push(new THREE.Vector3(dest.x === mrMid.x ? dest.x : Math.max(Math.min(dest.x, MR.x1 - 0.6), MR.x0 + 0.6), 0, sideZ), dest.clone());
      } else if (b.floor === 0) {
        if (inMeetingRoom(g)) pts.push(new THREE.Vector3(doorMid, 0, MR.z0 + 0.9), new THREE.Vector3(doorMid, 0, MR.z0 - 0.9));
        const behind = (v: THREE.Vector3) => v.z > 5.1 && v.x > -6.5 && v.x < -2.5;
        if (behind(dest) !== behind(g)) pts.push(new THREE.Vector3(-4.5 + b.side * 2.3, 0, 5.6));
        pts.push(dest.clone());
      } else {
        const behind = (v: THREE.Vector3) => v.z > b.pod.z - 0.1 && v.z < POD_Z + 1.4;
        const pastPartitions = (v: THREE.Vector3) => v.z >= POD_Z + 1.4;
        const detourX = poiFor(b.floor).detourX;
        const front = new THREE.Vector3(b.pod.x + b.side * 1.35, 0, b.pod.z - 1.4);
        if (behind(g)) pts.push(new THREE.Vector3(b.pod.x + b.side * 1.35, 0, b.pod.z + 0.4), front);
        if (pastPartitions(g)) pts.push(new THREE.Vector3(detourX, 0, g.z), new THREE.Vector3(detourX, 0, POD_Z - 1.6));
        if (pastPartitions(dest)) pts.push(new THREE.Vector3(detourX, 0, POD_Z - 1.6), new THREE.Vector3(detourX, 0, dest.z));
        if (behind(dest)) pts.push(new THREE.Vector3(b.pod.x + b.side * 1.35, 0, b.pod.z - 1.4), new THREE.Vector3(b.pod.x + b.side * 1.35, 0, b.pod.z + 0.4));
        pts.push(dest.clone());
      }
      b.path = pts;
      b.sitting = false;
    };
    setMeetingRef.current = (on: boolean) => {
      for (const b of bots) {
        b.activity = undefined; b.chattedBy = undefined;
        if (on && b.seat) {
          b.state = 'meeting';
          if (b.at !== 0) moveBotToFloor(b, 0, elevatorFront.clone().add(new THREE.Vector3(Math.random() * 1.2 - 0.6, 0, -Math.random() * 0.8)));
          planTo(b, b.seat.pos);
        } else if (!on) {
          b.state = 'work';
          if (b.at !== b.floor) moveBotToFloor(b, b.floor, elevatorFront.clone());
          planTo(b, b.home);
          b.timer = 8 + Math.random() * 6;
        }
      }
    };

    let moveTarget: THREE.Vector3 | null = null;
    let lastNearKey = '';
    goToFloorRef.current = (f: number) => {
      if (f === playerFloor) return;
      playerFloor = f;
      floors[f].content.add(player.group, marker);
      player.group.position.copy(elevatorFront).add(new THREE.Vector3(0, 0, -0.6));
      marker.visible = false; moveTarget = null;
      applyFloorVisibility();
      lastNearKey = '';
    };

    // --- Cámara isométrica: rotación en pasos de 90° ---
    let yaw = Math.PI / 4, yawTarget = yaw, zoom = 1;
    rotateRef.current = (dir: number) => { yawTarget += dir * Math.PI / 2; };

    if (import.meta.env.DEV) {
      (window as any).__tjOffice = {
        teleport: (x: number, z: number) => { player.group.position.set(x, 0, z); moveTarget = null; },
        rotate: (d: number) => { yawTarget += d * Math.PI / 2; },
        bots: () => bots.map(b => ({ nick: b.agent.nickname, floor: b.floor, at: b.at, state: b.state, sitting: b.sitting }))
      };
    }

    // --- Entrada ---
    const keys = new Set<string>();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragging = false, dragMoved = 0, lastX = 0, dragAccum = 0;
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'escape') { setSelected(null); setElevatorOpen(false); setMeetingPanel(false); (document.activeElement as HTMLElement)?.blur?.(); return; }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e', 'q', 'r'].includes(k)) e.preventDefault();
      if (k === 'e') {
        const n = nearbyRef.current;
        if (n?.kind === 'agent') setSelected(n.agent);
        else if (n?.kind === 'elevator') setElevatorOpen(true);
        else if (n?.kind === 'meeting') setMeetingPanel(true);
        return;
      }
      if (k === 'q') { yawTarget -= Math.PI / 2; return; }
      if (k === 'r') { yawTarget += Math.PI / 2; return; }
      keys.add(k); moveTarget = null; marker.visible = false;
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const setPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const visibleBots = () => bots.filter(b => b.at === playerFloor).map(b => b.group);
    const onPointerDown = (e: PointerEvent) => { dragging = true; dragMoved = 0; dragAccum = 0; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) {
        setPointer(e); raycaster.setFromCamera(pointer, camera);
        canvas.style.cursor = raycaster.intersectObjects(visibleBots(), true).length ? 'pointer' : 'default';
        return;
      }
      const dx = e.clientX - lastX; lastX = e.clientX; dragMoved += Math.abs(dx); dragAccum += dx;
      if (Math.abs(dragAccum) > 90) { yawTarget -= Math.sign(dragAccum) * Math.PI / 2; dragAccum = 0; }
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      if (dragMoved > 6) return;
      setPointer(e); raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(visibleBots(), true)[0];
      if (hit) { const ag = agentes.find(a => a.id === hit.object.userData.agentId); if (ag) setSelected(ag); return; }
      const fh = raycaster.intersectObject(floors[playerFloor].content.getObjectByName('floor')!)[0];
      if (fh) {
        moveTarget = fh.point.clone().setY(0);
        marker.position.set(moveTarget.x, 0.03, moveTarget.z); marker.visible = true;
        if (helpRef.current) { helpRef.current = false; setShowHelp(false); }
      }
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoom = THREE.MathUtils.clamp(zoom * (1 + e.deltaY * 0.001), 0.55, 1.8); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    let aspect = 1;
    const resize = () => {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1;
      const rw = Math.ceil(w / PIXEL_SCALE), rh = Math.ceil(h / PIXEL_SCALE);
      renderer.setSize(rw, rh, false);
      rt.setSize(rw, rh);
      postMat.uniforms.resolution.value.set(rw, rh);
      aspect = w / h;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // --- Animación ---
    const RADIUS = 0.28;
    const blocked = (x: number, z: number) => {
      if (Math.abs(x) > halfW - 0.5 || Math.abs(z) > halfD - 0.5) return true;
      return floors[playerFloor].colliders.some(b => x > b.min.x - RADIUS && x < b.max.x + RADIUS && z > b.min.z - RADIUS && z < b.max.z + RADIUS);
    };
    const tryMove = (o: THREE.Object3D, dx: number, dz: number) => {
      if (!blocked(o.position.x + dx, o.position.z)) o.position.x += dx;
      if (!blocked(o.position.x, o.position.z + dz)) o.position.z += dz;
    };
    const faceTo = (o: THREE.Object3D, tx: number, tz: number, k = 0.2) => {
      let d = Math.atan2(tx - o.position.x, tz - o.position.z) - o.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      o.rotation.y += d * k;
    };
    const walkAnim = (c: CharParts, t: number) => {
      const s = Math.sin(t * 10) * 0.6;
      c.legL.rotation.x = s; c.legR.rotation.x = -s; c.armL.rotation.x = -s; c.armR.rotation.x = s;
      c.armR.rotation.z = c.armL.rotation.z = 0;
      c.body.position.y = Math.abs(Math.sin(t * 10)) * 0.04;
      c.head.rotation.set(0, 0, 0);
    };
    const sitPose = (c: CharParts, t: number, fast: boolean) => {
      c.body.position.y = -0.22;
      c.legL.rotation.x = c.legR.rotation.x = -1.5;
      const k = fast ? 24 : 9;
      c.armL.rotation.x = -1.2 + Math.sin(t * k) * 0.12;
      c.armR.rotation.x = -1.2 + Math.cos(t * k) * 0.12;
      c.armL.rotation.z = c.armR.rotation.z = 0;
      c.head.rotation.x = Math.sin(t * 1.3) * 0.05;
    };
    const standPose = (c: CharParts, t: number) => {
      c.body.position.y = 0;
      c.legL.rotation.x = c.legR.rotation.x = 0;
      c.armL.rotation.x = c.armR.rotation.x = Math.sin(t * 2) * 0.04;
      c.head.rotation.set(0, 0, 0);
    };

    const clock = new THREE.Clock();
    const tmp = new THREE.Vector3(), wp = new THREE.Vector3(), camDir = new THREE.Vector3();
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      yaw += (yawTarget - yaw) * Math.min(1, dt * 8);

      // Movimiento relativo a la cámara (arriba en pantalla = hacia el fondo)
      const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const dir = new THREE.Vector3();
      if (keys.has('w') || keys.has('arrowup')) dir.add(fwd);
      if (keys.has('s') || keys.has('arrowdown')) dir.sub(fwd);
      if (keys.has('d') || keys.has('arrowright')) dir.add(right);
      if (keys.has('a') || keys.has('arrowleft')) dir.sub(right);
      if (moveTarget && dir.lengthSq() === 0) {
        tmp.copy(moveTarget).sub(player.group.position).setY(0);
        if (tmp.length() < 0.12) { moveTarget = null; marker.visible = false; } else dir.copy(tmp);
      }
      const moving = dir.lengthSq() > 0;
      if (moving) {
        dir.normalize().multiplyScalar(3.6 * dt);
        const before = player.group.position.clone();
        tryMove(player.group, dir.x, dir.z);
        faceTo(player.group, player.group.position.x + dir.x, player.group.position.z + dir.z, 0.3);
        if (moveTarget && before.distanceTo(player.group.position) < 0.001) { moveTarget = null; marker.visible = false; }
        if (helpRef.current) { helpRef.current = false; setShowHelp(false); }
        walkAnim(player, t);
      } else standPose(player, t);
      marker.rotation.z += dt * 2;

      // Bots
      let near: Bot | null = null, nearD = 2.2;
      for (const b of bots) {
        const g = b.group;
        const pd = b.at === playerFloor ? g.position.distanceTo(player.group.position) : 99;
        if (pd < nearD) { nearD = pd; near = b; }
        const isTyping = typingRef.current === b.agent.nickname;
        const isTalking = selectedRef.current?.id === b.agent.id;
        b.timer -= dt;
        b.blinkAt -= dt;
        if (b.blinkAt <= 0 && b.faceMat.map !== b.faces.closed) { b.faceMat.map = b.faces.closed; b.faceMat.needsUpdate = true; }
        if (b.blinkAt < -0.13) { b.faceMat.map = b.faces.open; b.faceMat.needsUpdate = true; b.blinkAt = 2 + Math.random() * 4; }

        if (b.state !== 'meeting') {
          if (isTyping && b.at === b.floor) {
            if (b.state !== 'work') { b.state = 'work'; planTo(b, b.home); }
          } else if (b.timer <= 0 && !isTalking) {
            const r = Math.random();
            if (b.activity?.partner && b.activity.partner.chattedBy === b) b.activity.partner.chattedBy = undefined;
            const poi = poiFor(b.floor);
            const mates = bots.filter(o => o !== b && o.at === b.at && o.floor === b.floor && o.state === 'work' && o.sitting && !o.chattedBy);
            b.activity = undefined;
            if (b.chattedBy) { b.timer = 2; }
            else if (r < 0.42) { b.state = 'work'; planTo(b, b.home); b.timer = 10 + Math.random() * 10; }
            else if (r < 0.54) { b.state = 'break'; b.activity = { kind: 'water', ...poi.water }; planTo(b, poi.water.spot); b.timer = 9 + Math.random() * 4; }
            else if (r < 0.63 && poi.copier) { b.state = 'break'; b.activity = { kind: 'copier', ...poi.copier }; planTo(b, poi.copier.spot); b.timer = 8 + Math.random() * 4; }
            else if (r < 0.74 && mates.length) {
              const partner = mates[Math.floor(Math.random() * mates.length)];
              const spot = new THREE.Vector3(partner.pod.x + 0.6, 0, partner.pod.z - 1.6);
              b.state = 'break'; b.activity = { kind: 'chat', spot, face: partner.group.position.clone(), partner };
              partner.chattedBy = b;
              planTo(b, spot); b.timer = 10 + Math.random() * 4;
            }
            else if (r < 0.8) { b.state = 'break'; b.activity = { kind: 'sofa', ...poi.sofa }; planTo(b, poi.sofa.spot); b.timer = 10 + Math.random() * 6; }
            else if (r < 0.88) {
              b.state = 'walk';
              planTo(b, new THREE.Vector3(THREE.MathUtils.lerp(b.bounds.minX, b.bounds.maxX, Math.random()), 0, THREE.MathUtils.lerp(b.bounds.minZ, b.bounds.maxZ, Math.random())));
              b.timer = 6 + Math.random() * 5;
            } else { b.state = 'idle'; b.path = []; b.sitting = false; b.timer = 2 + Math.random() * 3; }
          }
        }

        const paused = isTalking && !isTyping && b.state !== 'meeting';
        if (b.path.length && !paused) {
          tmp.copy(b.path[0]).sub(g.position).setY(0);
          const d = tmp.length();
          if (d < 0.06) b.path.shift();
          else {
            const speed = isTyping || b.state === 'meeting' ? 2.8 : 1.3;
            tmp.normalize().multiplyScalar(Math.min(speed * dt, d));
            g.position.add(tmp);
            faceTo(g, g.position.x + tmp.x, g.position.z + tmp.z, 0.25);
            walkAnim(b, t + b.phase);
          }
          if (!b.path.length && (b.state === 'work' || b.state === 'meeting')) b.sitting = true;
        } else if (b.sitting && b.state === 'work' && !(pd < 2 && !isTyping)) {
          const visitor = b.chattedBy && !b.chattedBy.path.length && b.chattedBy.activity?.partner === b ? b.chattedBy : null;
          faceTo(g, visitor ? visitor.group.position.x : b.homeFace.x, visitor ? visitor.group.position.z : b.homeFace.z, 0.2);
          sitPose(b, t + b.phase, isTyping);
          if (visitor) { b.armL.rotation.x = -0.6; b.armR.rotation.x = -0.4 + Math.sin(t * 4) * 0.3; }
        } else if (b.sitting && b.state === 'meeting' && b.seat) {
          faceTo(g, b.seat.face.x, b.seat.face.z, 0.2);
          sitPose(b, t + b.phase, false);
          b.armL.rotation.x = b.armR.rotation.x = -0.95;
          b.head.rotation.y = Math.sin(t * 0.7 + b.phase) * 0.35;
        } else if (b.state === 'break' && b.activity && !b.path.length && !isTalking) {
          faceTo(g, b.activity.face.x, b.activity.face.z, 0.15);
          if (b.activity.kind === 'sofa') { sitPose(b, t + b.phase, false); b.armL.rotation.x = b.armR.rotation.x = -0.3; b.body.position.y = -0.3; }
          else {
            standPose(b, t + b.phase);
            if (b.activity.kind === 'water') b.armR.rotation.x = Math.sin(t * 0.8 + b.phase) > 0.6 ? -2.1 : -0.4; // bebe agua
            if (b.activity.kind === 'copier') b.armR.rotation.x = -0.9 + Math.sin(t * 3) * 0.1;
            if (b.activity.kind === 'chat') { b.armR.rotation.x = -0.5 + Math.sin(t * 4 + b.phase) * 0.35; b.head.rotation.y = Math.sin(t * 1.5) * 0.15; }
          }
        } else {
          standPose(b, t + b.phase);
          if (pd < 3.2 || isTalking) {
            faceTo(g, player.group.position.x, player.group.position.z, 0.15);
            b.armR.rotation.z = !isTalking && pd < 3.2 ? Math.PI * 0.85 + Math.sin(t * 8) * 0.25 : 0;
          } else b.armR.rotation.z = 0;
        }
      }

      // Elemento cercano
      let nearKey = '', nearVal: Nearby = null;
      const pp = player.group.position;
      if (near) { nearKey = 'a:' + near.agent.id; nearVal = { kind: 'agent', agent: near.agent }; }
      else if (pp.distanceTo(elevatorFront) < 1.8) { nearKey = 'elev'; nearVal = { kind: 'elevator' }; }
      else if (playerFloor === 0 && inMeetingRoom(pp)) { nearKey = 'meet'; nearVal = { kind: 'meeting' }; }
      if (nearKey !== lastNearKey) { lastNearKey = nearKey; nearbyRef.current = nearVal; setNearby(nearVal); }

      // Cámara ortográfica isométrica que sigue al jefe
      const viewH = 15 * zoom;
      camera.left = -viewH * aspect / 2; camera.right = viewH * aspect / 2; camera.top = viewH / 2; camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();
      camDir.set(-Math.sin(yaw) * Math.cos(ISO_PITCH), Math.sin(ISO_PITCH), -Math.cos(yaw) * Math.cos(ISO_PITCH));
      camera.position.copy(pp).addScaledVector(camDir, 60).setY(pp.y + camDir.y * 60);
      camera.lookAt(pp.x, 1, pp.z);
      sun.position.set(pp.x - 14, 26, pp.z - 10); sun.target.position.set(pp.x, 0, pp.z);

      // Ocultar las paredes que quedan entre la cámara y el interior
      const horiz = new THREE.Vector3(camDir.x, 0, camDir.z).normalize();
      floors[playerFloor].walls.forEach(w => { w.mesh.visible = w.normal.dot(horiz) < 0.2; });

      // Etiquetas
      const rect = mount.getBoundingClientRect();
      const now = Date.now();
      for (const b of bots) {
        const lab = labels.get(b.agent.id)!;
        if (b.at !== playerFloor) { lab.root.style.display = 'none'; continue; }
        b.group.getWorldPosition(wp); wp.y += b.sitting ? 2.45 : 2.75;
        tmp.copy(wp).project(camera);
        const visible = Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
        let bubble = '';
        if (typingRef.current === b.agent.nickname) bubble = '✍️ trabajando en ello...';
        else {
          const last = [...mensajesRef.current].reverse().find(m => m.remitente_tipo === 'agente' && m.remitente_id === b.agent.id);
          if (last && now - new Date(last.creado_en).getTime() < 120000) bubble = last.texto.replace(/[#*`_\[\]]/g, '').slice(0, 120) + (last.texto.length > 120 ? '…' : '');
        }
        const crowded = b.state === 'meeting' && b.sitting && !bubble && b.group.position.distanceTo(pp) > 2.2;
        lab.root.style.display = visible && !crowded ? 'block' : 'none';
        if (!visible || crowded) continue;
        lab.root.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * rect.width}px, ${(-tmp.y * 0.5 + 0.5) * rect.height}px) translate(-50%, -100%)`;
        if (lab.bubble.textContent !== bubble) lab.bubble.textContent = bubble;
        lab.bubble.style.display = bubble ? 'block' : 'none';
        // Icono de actividad
        let icon = '';
        const arrived = !b.path.length;
        if (typingRef.current === b.agent.nickname) icon = '💡';
        else if (b.state === 'break' && b.activity && arrived) icon = { water: '☕', copier: '📄', chat: '💬', sofa: '🛋️' }[b.activity.kind];
        else if (b.chattedBy && !b.chattedBy.path.length) icon = '💬';
        else if (b.state === 'meeting' && arrived) icon = '';
        else if (b.state === 'work' && b.sitting && Math.sin(t * 0.21 + b.phase * 3) > 0.93) icon = '📞';
        if (bubble) icon = '';
        if (lab.emote.textContent !== icon) lab.emote.textContent = icon;
        lab.emote.style.display = icon ? 'block' : 'none';
      }

      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      scene.traverse(o => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mm: any) => { mm.map?.dispose?.(); mm.dispose?.(); });
      });
      rt.dispose(); postMat.dispose();
      renderer.dispose();
      canvas.remove();
      labelsLayer.innerHTML = '';
      if (import.meta.env.DEV) delete (window as any).__tjOffice;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey]);

  // --- UI ---
  const changeFloor = (f: number) => {
    setElevatorOpen(false);
    if (f === floor) return;
    setFading(true);
    setTimeout(() => { goToFloorRef.current(f); setFloor(f); setTimeout(() => setFading(false), 60); }, 240);
  };
  const toggleMeeting = () => {
    const on = !meeting;
    setMeeting(on);
    setMeetingRef.current(on);
    if (on) { changeFloor(0); setSelected(null); setMeetingPanel(true); } else setMeetingPanel(false);
  };

  const panelAgent = meetingPanel ? moderator : selected;
  const conversation = useMemo(() => {
    if (!panelAgent) return [];
    const nick = `@${panelAgent.nickname}`.toLowerCase();
    return mensajes.filter(m => (m.remitente_tipo === 'agente' && m.remitente_id === panelAgent.id) || (m.remitente_tipo === 'usuario' && m.texto.toLowerCase().includes(nick))).slice(-12);
  }, [mensajes, panelAgent]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conversation.length, typingNickname]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!panelAgent || !draft.trim() || isSending) return;
    const text = draft.trim();
    setDraft('');
    if (meetingPanel) {
      const equipo = agentes.map(a => `@${a.nickname} (${a.rol})`).join(', ');
      await onSend(panelAgent, `[REUNIÓN DE EQUIPO en la sala de reuniones. Moderas tú y respondes en nombre de todo el equipo, aportando la visión de cada departamento cuando sea útil. Participantes: ${equipo}] ${text}`);
    } else await onSend(panelAgent, text);
  };
  const panelTyping = panelAgent && typingNickname === panelAgent.nickname;
  const hex = (n: number) => '#' + new THREE.Color(n).getHexString();
  const deptColor = (a: Agente) => hex(DEPTS[deptIndexFor(a)].color);

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden bg-[#eef0fb] select-none">
      <div ref={mountRef} className="absolute inset-0" />
      <div ref={labelsRef} className="absolute inset-0 pointer-events-none overflow-hidden" />
      <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-300 ${fading ? 'opacity-100' : 'opacity-0'}`} />

      {/* Selector de pisos */}
      <div className="absolute top-3 left-3 w-[200px] rounded-lg bg-white/95 border-2 border-[#1f2937] shadow-[4px_4px_0_rgba(31,41,55,0.25)] p-2 space-y-1 font-mono">
        <div className="flex items-center gap-2 px-1 pb-1.5 border-b-2 border-[#1f2937]/10">
          <img src={LOGO_URL} alt="TJ FitLab" className="w-7 h-7 rounded" />
          <div className="leading-tight">
            <p className="text-[10px] font-black text-[#1f2937] tracking-widest">TJ FITLAB HQ</p>
            <p className="text-[8px] text-[#6b7280] uppercase tracking-wider">Oficinas</p>
          </div>
        </div>
        {[...floorsInfo].reverse().map(fi => (
          <button key={fi.index} onClick={() => changeFloor(fi.index)}
            className={`w-full text-left px-2 py-1.5 rounded transition-all flex items-center gap-2 ${floor === fi.index ? 'bg-[#eef0fb]' : 'hover:bg-[#f3f4f6]'}`}>
            <span className="w-5 h-5 rounded-sm text-[9px] font-black flex items-center justify-center shrink-0 text-white" style={{ background: hex(fi.color), opacity: floor === fi.index ? 1 : 0.55 }}>{fi.index}</span>
            <span className="min-w-0">
              <span className="block text-[9.5px] font-bold text-[#1f2937] truncate">{fi.short}</span>
              <span className="block text-[8px] text-[#6b7280] truncate">{fi.index === 0 ? 'Recepción · Reuniones' : fi.agents.map(a => '@' + a.nickname).join(' ')}</span>
            </span>
          </button>
        ))}
        <button onClick={toggleMeeting}
          className={`w-full mt-1 py-2 rounded text-[9px] font-black uppercase tracking-widest transition-all border-2 ${meeting ? 'bg-red-50 text-red-600 border-red-300' : 'bg-[#a3e635] text-[#1f2937] border-[#1f2937]'}`}>
          {meeting ? 'Terminar reunión' : '📣 Convocar reunión'}
        </button>
        <div className="flex gap-1 pt-1">
          <button onClick={() => rotateRef.current(-1)} className="flex-1 py-1 rounded border border-[#1f2937]/20 text-[9px] font-bold text-[#1f2937] hover:bg-[#f3f4f6]">⟲ Girar (Q)</button>
          <button onClick={() => rotateRef.current(1)} className="flex-1 py-1 rounded border border-[#1f2937]/20 text-[9px] font-bold text-[#1f2937] hover:bg-[#f3f4f6]">Girar (R) ⟳</button>
        </div>
      </div>

      {showHelp && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-white/95 border-2 border-[#1f2937] text-[10px] text-[#1f2937] font-mono text-center pointer-events-none max-w-[55%] hidden md:block shadow-[3px_3px_0_rgba(31,41,55,0.2)]">
          <b>WASD / flechas</b> o <b>clic en el suelo</b> · <b>Q/R</b> o arrastrar para girar · <b>rueda</b> zoom · <b>clic en un agente</b> o <b>E</b> para hablar · <b>ascensor</b> para cambiar de piso
        </div>
      )}

      {nearby && !selected && !elevatorOpen && !meetingPanel && (
        <button
          onClick={() => nearby.kind === 'agent' ? setSelected(nearby.agent) : nearby.kind === 'elevator' ? setElevatorOpen(true) : setMeetingPanel(true)}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded bg-[#a3e635] text-[#1f2937] border-2 border-[#1f2937] text-[11px] font-black uppercase tracking-widest font-mono shadow-[3px_3px_0_rgba(31,41,55,0.3)]">
          {nearby.kind === 'agent' ? `Hablar con @${nearby.agent.nickname}` : nearby.kind === 'elevator' ? 'Usar ascensor' : meeting ? 'Hablar con el equipo' : 'Sala de reuniones'} <span className="opacity-60">(E)</span>
        </button>
      )}

      {elevatorOpen && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1f2937]/30" onClick={() => setElevatorOpen(false)}>
          <div className="w-[300px] rounded-lg bg-white border-2 border-[#1f2937] p-4 shadow-[5px_5px_0_rgba(31,41,55,0.3)] font-mono" onClick={e => e.stopPropagation()}>
            <p className="text-[10px] font-black text-[#1f2937] tracking-[0.25em] mb-3 text-center">ASCENSOR · ELIGE PISO</p>
            <div className="space-y-1.5">
              {[...floorsInfo].reverse().map(fi => (
                <button key={fi.index} onClick={() => changeFloor(fi.index)} disabled={fi.index === floor}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded bg-[#f3f4f6] hover:bg-[#e5e7eb] disabled:opacity-40 text-left">
                  <span className="w-7 h-7 rounded-sm text-[11px] font-black flex items-center justify-center text-white shrink-0" style={{ background: hex(fi.color) }}>{fi.index}</span>
                  <span className="text-[10px] font-bold text-[#1f2937]">{fi.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {panelAgent && (selected || meetingPanel) && (
        <div className="absolute top-0 right-0 h-full w-full sm:w-[390px] bg-white border-l-2 border-[#1f2937] flex flex-col font-mono">
          <div className="p-4 border-b-2 border-[#1f2937]/10 flex items-center gap-3">
            {meetingPanel ? (
              <img src={LOGO_URL} alt="" className="w-11 h-11 rounded border-2 border-[#1f2937]" />
            ) : (
              <img src={panelAgent.avatar_url || LOGO_URL} alt="" className="w-11 h-11 rounded object-cover border-2" style={{ borderColor: deptColor(panelAgent) }} onError={e => { (e.target as HTMLImageElement).src = LOGO_URL; }} />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-black text-[13px] truncate" style={{ color: meetingPanel ? '#1f2937' : deptColor(panelAgent) }}>{meetingPanel ? 'Reunión de equipo' : `@${panelAgent.nickname}`}</p>
              <p className="text-[9px] text-[#6b7280] uppercase tracking-widest truncate">
                {meetingPanel ? `Modera @${panelAgent.nickname} · ${agentes.length} agentes` : `${panelAgent.rol} · Piso ${deptIndexFor(panelAgent)} ${DEPTS[deptIndexFor(panelAgent)].short}`}
              </p>
            </div>
            <button onClick={() => { setSelected(null); setMeetingPanel(false); }} className="text-[#6b7280] hover:text-[#1f2937] text-lg px-2" aria-label="Cerrar">✕</button>
          </div>
          {meetingPanel && !meeting && (
            <button onClick={toggleMeeting} className="m-3 mb-0 py-2 rounded bg-[#a3e635] text-[#1f2937] border-2 border-[#1f2937] text-[10px] font-black uppercase tracking-widest">📣 Convocar a todo el equipo</button>
          )}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide bg-[#f8f9ff]">
            {conversation.length === 0 && !panelTyping && (
              <p className="text-[11px] text-[#6b7280] text-center mt-8">
                {meetingPanel ? `Plantea un tema y el equipo lo debatirá. @${panelAgent.nickname} modera y responde por todos.` : `Pídele algo a @${panelAgent.nickname}: buscar en internet, publicar en el foro, crear tareas o añadir leads.`}
              </p>
            )}
            {conversation.map(m => (
              <div key={m.id} className={`text-[11px] leading-relaxed whitespace-pre-wrap break-words rounded p-3 border-2 ${m.remitente_tipo === 'agente' ? 'bg-white border-[#1f2937]/10 text-[#1f2937]' : 'bg-[#ecfccb] border-[#a3e635] text-[#1f2937] ml-6'}`}>
                {m.texto.replace(/^@\S+\s+\[REUNIÓN DE EQUIPO[^\]]*\]\s*/, '📣 ')}
              </div>
            ))}
            {panelTyping && <div className="text-[11px] text-[#6b7280] animate-pulse">@{panelAgent.nickname} está trabajando en ello…</div>}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={submit} className="p-3 border-t-2 border-[#1f2937]/10 flex gap-2">
            <input value={draft} onChange={e => setDraft(e.target.value)} autoFocus
              placeholder={meetingPanel ? 'Tema para el equipo...' : `Escribe a @${panelAgent.nickname}...`}
              className="flex-1 bg-white border-2 border-[#1f2937]/20 rounded px-3 py-2.5 text-[12px] text-[#1f2937] outline-none focus:border-[#84cc16]" />
            <button type="submit" disabled={isSending || !draft.trim()} className="px-4 rounded bg-[#a3e635] text-[#1f2937] border-2 border-[#1f2937] text-[11px] font-black uppercase disabled:opacity-40">Enviar</button>
          </form>
        </div>
      )}
    </div>
  );
};
