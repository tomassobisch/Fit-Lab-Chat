import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Agente, Mensaje } from '../types';

// ---------------------------------------------------------------------------
// SEDE TJ FITLAB — torre futurista en el espacio, un departamento por piso,
// sala de reuniones y agentes pixel/voxel animados con los que se puede hablar.
// ---------------------------------------------------------------------------

interface Props {
  agentes: Agente[];
  mensajes: Mensaje[];
  typingNickname: string | null;
  isSending: boolean;
  onSend: (agent: Agente, text: string) => Promise<void>;
}

const PIXEL_SCALE = 2.5;
const FLOOR_H = 7;
const FW = 30; // ancho del piso (x)
const FD = 22; // fondo del piso (z)
const NEON = 0xccff00;
const LOGO_URL = '/logo-tjfitlab.png';
const MODERATOR = 'strategist';

// --- Departamentos (pisos) ---
interface Dept { name: string; short: string; color: number; match: (a: Agente) => boolean; }
const DEPTS: Dept[] = [
  { name: 'LOBBY · RECEPCIÓN · SALA DE REUNIONES', short: 'Lobby', color: NEON, match: a => /secretari|asistente|chief of staff/i.test(`${a.nickname} ${a.rol} ${a.nombre}`) },
  { name: 'MARKETING & CONTENIDO', short: 'Marketing', color: 0xff3d9a, match: a => /marketing|community|insta|reel|guion|edit|contenido|growth/i.test(`${a.nickname} ${a.rol}`) },
  { name: 'TECNOLOGÍA & DATOS', short: 'Tech & Datos', color: 0x22d3ee, match: a => /program|software|dev|datos|ingenier/i.test(`${a.nickname} ${a.rol}`) || a.nickname.toLowerCase() === 'data' },
  { name: 'RENDIMIENTO DEPORTIVO', short: 'Rendimiento', color: 0xff9f1c, match: a => /deport|fitness|rendimiento|actividad f/i.test(`${a.nickname} ${a.rol} ${a.nombre}`) },
  { name: 'NEGOCIO · ESTRATEGIA · LEGAL', short: 'Negocio', color: 0xa78bfa, match: () => true }
];
const deptIndexFor = (a: Agente) => {
  for (let i = 0; i < DEPTS.length; i++) if (DEPTS[i].match(a)) return i;
  return DEPTS.length - 1;
};

// --- Utilidades ---
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = <T,>(arr: readonly T[], seed: number) => arr[seed % arr.length];

const mat = (color: THREE.ColorRepresentation, emissive?: THREE.ColorRepresentation, emissiveIntensity = 1.2) =>
  new THREE.MeshLambertMaterial({ color, ...(emissive !== undefined ? { emissive, emissiveIntensity } : {}) });
const glow = (color: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
const glass = () => new THREE.MeshLambertMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.12, depthWrite: false });

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

function textTexture(text: string, sub: string, color: string, w = 512, h = 128) {
  return canvasTexture(w, h, g => {
    g.clearRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 12;
    g.font = `900 ${Math.round(h * 0.42)}px ui-monospace, monospace`;
    g.fillStyle = color;
    g.fillText(text, w / 2, sub ? h * 0.38 : h / 2, w - 16);
    if (sub) {
      g.shadowBlur = 0;
      g.font = `700 ${Math.round(h * 0.17)}px ui-monospace, monospace`;
      g.fillStyle = '#e5e7eb';
      g.fillText(sub, w / 2, h * 0.78, w - 16);
    }
  }, false);
}

// Suelo metálico con retícula luminosa
function floorTexture(accent: string) {
  const t = canvasTexture(128, 128, g => {
    g.fillStyle = '#161a23'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#1d222d'; g.fillRect(2, 2, 60, 60); g.fillRect(66, 66, 60, 60);
    g.fillStyle = '#1a1e28'; g.fillRect(66, 2, 60, 60); g.fillRect(2, 66, 60, 60);
    g.fillStyle = accent; g.globalAlpha = 0.22;
    g.fillRect(0, 0, 128, 1); g.fillRect(0, 0, 1, 128);
    g.globalAlpha = 1;
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(FW / 4, FD / 4);
  return t;
}

// --- Caras pixel art (16x16) con parpadeo ---
function faceTextures(skin: string, hair: string, seed: number) {
  const draw = (blink: boolean) => canvasTexture(16, 16, g => {
    g.fillStyle = skin; g.fillRect(0, 0, 16, 16);
    g.fillStyle = hair; g.fillRect(3, 4, 3, 1); g.fillRect(10, 4, 3, 1); // cejas
    if (blink) { g.fillStyle = '#1b1b1b'; g.fillRect(4, 7, 2, 1); g.fillRect(10, 7, 2, 1); }
    else {
      g.fillStyle = '#ffffff'; g.fillRect(3, 6, 3, 3); g.fillRect(10, 6, 3, 3);
      g.fillStyle = '#1b1b1b'; g.fillRect(4, 6, 2, 3); g.fillRect(11, 6, 2, 3);
      g.fillStyle = '#ffffff'; g.fillRect(4, 6, 1, 1); g.fillRect(11, 6, 1, 1);
    }
    g.fillStyle = 'rgba(255,120,120,0.45)'; g.fillRect(2, 10, 2, 1); g.fillRect(12, 10, 2, 1); // mejillas
    g.fillStyle = '#7a2e2e';
    if (seed % 3 === 0) { g.fillRect(6, 11, 4, 1); g.fillRect(5, 10, 1, 1); g.fillRect(10, 10, 1, 1); }
    else if (seed % 3 === 1) { g.fillRect(6, 11, 4, 2); g.fillStyle = '#fff'; g.fillRect(6, 11, 4, 1); }
    else { g.fillRect(6, 11, 4, 1); }
    if (seed % 5 === 0) { g.fillStyle = hair; g.fillRect(4, 12, 8, 3); g.fillStyle = '#7a2e2e'; g.fillRect(6, 12, 4, 1); } // barba
  });
  return { open: draw(false), closed: draw(true) };
}

const SKINS = ['#f6d3b3', '#eac39f', '#d9a679', '#b97f55', '#8d5a3b', '#5c3a26'] as const;
const HAIRS = ['#1d1612', '#3b2618', '#6b4226', '#a0682f', '#d8b25a', '#e8e1d6', '#2c2c38', '#7a1f2b'] as const;
const HAIR_STYLES = ['short', 'long', 'mohawk', 'bun', 'short', 'bald', 'curly'] as const;

interface CharParts {
  group: THREE.Group; body: THREE.Group; head: THREE.Group;
  armL: THREE.Object3D; armR: THREE.Object3D; legL: THREE.Object3D; legR: THREE.Object3D;
  faceMat: THREE.MeshLambertMaterial; faces: { open: THREE.Texture; closed: THREE.Texture };
}

// Personaje voxel: proporciones chibi, ropa del departamento y accesorios por rol
function buildCharacter(key: string, role: string, shirtColor: number, isBoss = false): CharParts {
  const seed = hash(key);
  const skin = isBoss ? '#eac39f' : pick(SKINS, seed);
  const hair = isBoss ? '#1d1612' : pick(HAIRS, seed >> 3);
  const style = isBoss ? 'short' : pick(HAIR_STYLES, seed >> 6);
  const r = role.toLowerCase();

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const skinM = mat(skin), hairM = mat(hair);
  const shirt = mat(shirtColor);
  const pants = mat(0x1a1d26), shoes = mat(0xf3f4f6);
  const trim = glow(isBoss ? NEON : shirtColor);

  const mkLeg = (x: number) => {
    const o = new THREE.Object3D(); o.position.set(x, 0.62, 0);
    o.add(box(0.2, 0.5, 0.22, pants, 0, -0.27, 0), box(0.22, 0.12, 0.3, shoes, 0, -0.56, 0.04));
    return o;
  };
  const legL = mkLeg(-0.12), legR = mkLeg(0.12);
  const torso = box(0.54, 0.58, 0.32, shirt, 0, 0.92, 0);
  const belt = box(0.56, 0.06, 0.34, trim, 0, 0.64, 0, false);
  const chest = box(0.12, 0.12, 0.02, glow(isBoss ? NEON : 0xffffff), 0.14, 1.05, 0.17, false);
  const mkArm = (x: number) => {
    const o = new THREE.Object3D(); o.position.set(x, 1.16, 0);
    o.add(box(0.17, 0.5, 0.2, shirt, 0, -0.22, 0), box(0.16, 0.12, 0.18, skinM, 0, -0.52, 0));
    return o;
  };
  const armL = mkArm(-0.36), armR = mkArm(0.36);

  const head = new THREE.Group();
  head.position.set(0, 1.5, 0);
  const faces = faceTextures(skin, hair, seed);
  const faceMat = new THREE.MeshLambertMaterial({ map: faces.open });
  const sideM = style === 'long' ? hairM : skinM;
  head.add(box(0.62, 0.6, 0.6, [sideM, sideM, hairM, skinM, faceMat, hairM], 0, 0.3, 0));

  if (style !== 'bald') head.add(box(0.66, 0.14, 0.64, hairM, 0, 0.64, -0.01));
  if (style === 'short' || style === 'curly') head.add(box(0.66, 0.3, 0.1, hairM, 0, 0.48, -0.29));
  if (style === 'curly') head.add(box(0.7, 0.18, 0.68, hairM, 0, 0.7, 0));
  if (style === 'long') head.add(box(0.68, 0.75, 0.14, hairM, 0, 0.22, -0.3), box(0.1, 0.5, 0.5, hairM, -0.34, 0.3, 0), box(0.1, 0.5, 0.5, hairM, 0.34, 0.3, 0));
  if (style === 'mohawk') head.add(box(0.14, 0.26, 0.62, hairM, 0, 0.76, 0));
  if (style === 'bun') head.add(box(0.26, 0.24, 0.26, hairM, 0, 0.8, -0.14));

  // Accesorios por rol
  const dark = mat(0x111111);
  if (/program|data|insta|analista|métric/.test(r)) {
    head.add(box(0.2, 0.12, 0.02, dark, -0.15, 0.36, 0.31, false), box(0.2, 0.12, 0.02, dark, 0.15, 0.36, 0.31, false), box(0.12, 0.03, 0.02, dark, 0, 0.38, 0.31, false));
  }
  if (/community|marketing|secretari|asistente/.test(r)) {
    head.add(box(0.72, 0.06, 0.12, dark, 0, 0.66, 0), box(0.06, 0.22, 0.2, dark, -0.35, 0.34, 0), box(0.06, 0.22, 0.2, dark, 0.35, 0.34, 0));
    head.add(box(0.04, 0.04, 0.26, dark, 0.3, 0.18, 0.18, false), box(0.06, 0.06, 0.06, glow(shirtColor), 0.26, 0.16, 0.32, false));
  }
  if (/legal|estrategia|qa|chief|secretari/.test(r)) body.add(box(0.08, 0.36, 0.02, mat(0x0b0b0b), 0, 0.94, 0.17, false));
  if (/headhunter|b2b|coach/.test(r)) head.add(box(0.68, 0.16, 0.66, mat(NEON), 0, 0.68, 0), box(0.6, 0.04, 0.3, mat(NEON), 0, 0.62, 0.42));
  if (/guion|edit|director/.test(r)) head.add(box(0.7, 0.12, 0.7, mat(0x7a1f2b), 0.04, 0.68, 0), box(0.06, 0.08, 0.06, mat(0x7a1f2b), 0.04, 0.78, 0));
  if (/investigacion|deporte|actividad/.test(r)) head.add(box(0.66, 0.08, 0.64, glow(0xff9f1c), 0, 0.52, 0));
  if (/auditor|rendimiento/.test(r)) armL.add(box(0.04, 0.34, 0.26, mat(0x8b5a2b), -0.05, -0.55, 0.16, false));
  if (isBoss) [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]].forEach(([x, z]) => head.add(box(0.1, 0.16, 0.1, glow(NEON), x, 0.79, z, false)));

  body.add(legL, legR, torso, belt, chest, armL, armR, head);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015;
  group.add(shadow);
  return { group, body, head, armL, armR, legL, legR, faceMat, faces };
}

type BotState = 'work' | 'walk' | 'idle' | 'meeting';
interface Bot extends CharParts {
  agent: Agente;
  floor: number; at: number;
  home: THREE.Vector3; homeFace: THREE.Vector3; pod: THREE.Vector3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  state: BotState; timer: number;
  path: THREE.Vector3[]; side: number; phase: number; blinkAt: number;
  seat?: { pos: THREE.Vector3; face: THREE.Vector3 };
  sitting: boolean;
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

    // --- Renderer pixelado + bloom ---
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    Object.assign(canvas.style, { width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block', touchAction: 'none' });
    mount.appendChild(canvas);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020309);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 900);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.2, 0.88);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const loader = new THREE.TextureLoader();
    const logoTex = loader.load(LOGO_URL, t => { t.colorSpace = THREE.SRGBColorSpace; });

    // --- Espacio exterior ---
    const starGeo = new THREE.BufferGeometry();
    const starPos: number[] = [], starCol: number[] = [];
    for (let i = 0; i < 2600; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(320 + Math.random() * 200);
      starPos.push(v.x, v.y, v.z);
      const c = new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 0.4, 0.75 + Math.random() * 0.25);
      starCol.push(c.r, c.g, c.b);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.Float32BufferAttribute(starCol, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, vertexColors: true, toneMapped: false }));
    scene.add(stars);

    const nebulaTex = canvasTexture(128, 128, g => {
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.25)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    }, false);
    ([[0x5b21b6, -180, 60, 260, 260], [0x0e7490, 220, -20, 300, 220], [0x65a30d, 40, 120, -320, 200], [0xbe185d, -260, -60, -120, 180]] as const).forEach(([c, x, y, z, s]) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebulaTex, color: c, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.position.set(x, y, z); sp.scale.setScalar(s);
      scene.add(sp);
    });
    const planet = new THREE.Mesh(new THREE.IcosahedronGeometry(55, 2), new THREE.MeshLambertMaterial({ color: 0x1f6f5c, emissive: 0x0b2a22, flatShading: true }));
    planet.position.set(150, -40, 230);
    scene.add(planet);
    const ringMesh = new THREE.Mesh(new THREE.RingGeometry(70, 92, 48), new THREE.MeshBasicMaterial({ color: NEON, transparent: true, opacity: 0.18, side: THREE.DoubleSide, toneMapped: false }));
    ringMesh.position.copy(planet.position); ringMesh.rotation.set(-1.2, 0.3, 0.2);
    scene.add(ringMesh);
    const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(9, 1), new THREE.MeshLambertMaterial({ color: 0x9aa3b2, flatShading: true }));
    moon.position.set(-170, 70, 200);
    scene.add(moon);

    // --- Luces ---
    scene.add(new THREE.HemisphereLight(0xb8d0ff, 0x1a1a26, 1.15), new THREE.AmbientLight(0xffffff, 0.25));
    const sun = new THREE.DirectionalLight(0xfff3e0, 1.25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -24; sc.right = 24; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 80;
    scene.add(sun, sun.target);

    // --- Torre: un grupo por piso ---
    const floors: { group: THREE.Group; content: THREE.Group; colliders: THREE.Box3[]; y: number }[] = [];
    const halfW = FW / 2, halfD = FD / 2;
    const elevatorPos = new THREE.Vector3(-halfW + 3, 0, -halfD + 3.2);

    const addTo = (f: number, ...objs: THREE.Object3D[]) => floors[f].content.add(...objs);
    const collide = (f: number, ...objs: THREE.Object3D[]) => {
      for (const o of objs) {
        floors[f].content.add(o);
        o.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(o);
        b.translate(new THREE.Vector3(0, -floors[f].y, 0));
        floors[f].colliders.push(b);
      }
    };
    const plant = (f: number, x: number, z: number, s = 1) => {
      const g = new THREE.Group();
      g.add(box(0.55 * s, 0.55 * s, 0.55 * s, mat(0x0f1218), 0, 0.27 * s, 0), box(0.6 * s, 0.05, 0.6 * s, glow(NEON), 0, 0.56 * s, 0, false));
      g.add(box(0.75 * s, 0.75 * s, 0.75 * s, mat(0x1f7a3a), 0, 0.98 * s, 0), box(0.45 * s, 0.45 * s, 0.45 * s, mat(0x2fb350), 0.12 * s, 1.5 * s, 0.05 * s));
      g.position.set(x, 0, z); addTo(f, g);
    };

    DEPTS.forEach((dept, f) => {
      const y = f * FLOOR_H;
      const group = new THREE.Group(); group.position.y = y;
      const content = new THREE.Group();
      group.add(content);
      scene.add(group);
      floors.push({ group, content, colliders: [], y });
      group.updateMatrixWorld(true);
      const accentHex = '#' + new THREE.Color(dept.color).getHexString();

      // Losa (se ve también desde los pisos superiores) + borde neón
      group.add(box(FW + 1, 0.5, FD + 1, mat(0x0a0c12), 0, -0.25, 0));
      const edge = new THREE.Mesh(new THREE.BoxGeometry(FW + 1.1, 0.08, FD + 1.1), glow(dept.color));
      edge.position.y = -0.05; group.add(edge);
      group.add(box(FW + 0.6, 0.12, FD + 0.6, glow(0x0f172a), 0, -0.55, 0, false));

      const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(FW, FD), new THREE.MeshLambertMaterial({ map: floorTexture(accentHex) }));
      floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.y = 0.01; floorMesh.receiveShadow = true;
      floorMesh.name = 'floor';
      content.add(floorMesh);

      // Ventanales
      const frame = mat(0x1c2230);
      const walls: [number, number, number, number][] = [[0, -halfD, FW, 0], [0, halfD, FW, 0], [-halfW, 0, FD, 1], [halfW, 0, FD, 1]];
      walls.forEach(([x, z, len, vert]) => {
        addTo(f, box(vert ? 0.4 : len, 0.5, vert ? len : 0.4, frame, x, 0.25, z));
        addTo(f, box(vert ? 0.06 : len, 2.6, vert ? len : 0.06, glass(), x, 1.8, z, false));
        addTo(f, box(vert ? 0.12 : len, 0.08, vert ? len : 0.12, glow(dept.color), x, 3.1, z, false));
        const posts = Math.round(len / 4);
        for (let i = 0; i <= posts; i++) {
          const t = -len / 2 + (i * len) / posts;
          addTo(f, box(0.14, 2.6, 0.14, frame, vert ? x : t, 1.8, vert ? t : z));
        }
      });

      // Ascensor de cristal
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.2, 20, 1, true), new THREE.MeshLambertMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
      tube.position.set(elevatorPos.x, 1.6, elevatorPos.z);
      addTo(f, tube, box(2.8, 0.12, 2.8, mat(0x141822), elevatorPos.x, 3.25, elevatorPos.z));
      [0.08, 1.6, 3.15].forEach(yy => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.05, 6, 24), glow(NEON));
        ring.rotation.x = Math.PI / 2; ring.position.set(elevatorPos.x, yy, elevatorPos.z);
        addTo(f, ring);
      });
      const elevSign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: textTexture(`PISO ${f}`, 'ASCENSOR · E', '#CCFF00', 256, 64), transparent: true, toneMapped: false }));
      elevSign.position.set(elevatorPos.x, 3.8, elevatorPos.z);
      elevSign.name = 'billboard';
      addTo(f, elevSign);

      // Holograma del departamento
      const holo = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: textTexture(dept.short.toUpperCase(), dept.name, accentHex), transparent: true, toneMapped: false, side: THREE.DoubleSide }));
      holo.position.set(0, 4.2, halfD - 1.2);
      holo.rotation.y = Math.PI;
      addTo(f, holo, box(6, 0.15, 0.6, glow(dept.color), 0, 2.6, halfD - 1.2, false));
    });

    // --- Piso 0: lobby, recepción y sala de reuniones ---
    const F0 = 0;
    const logoFloor = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), new THREE.MeshLambertMaterial({ map: logoTex, emissive: 0x223300, emissiveIntensity: 0.4 }));
    logoFloor.rotation.set(-Math.PI / 2, 0, Math.PI); logoFloor.position.set(-5, 0.03, -3.5);
    const logoRing = new THREE.Mesh(new THREE.RingGeometry(3.25, 3.45, 48), glow(NEON));
    logoRing.rotation.x = -Math.PI / 2; logoRing.position.set(-5, 0.035, -3.5);
    addTo(F0, logoFloor, logoRing);

    const logoPanel = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: logoTex, toneMapped: false }));
    logoPanel.position.set(-6, 2, 7.24); logoPanel.rotation.y = Math.PI;
    collide(F0, box(7, 3.6, 0.3, mat(0x0b0d12), -6, 1.8, 7.4)); addTo(F0, logoPanel);
    collide(F0, box(5, 1.05, 1.1, mat(0x0f1218), -6, 0.52, 3.6));
    addTo(F0, box(5.2, 0.08, 1.3, mat(0xe5e7eb), -6, 1.08, 3.6), box(5.02, 0.06, 1.12, glow(NEON), -6, 0.2, 3.6, false));

    const sofaM = mat(0x2b2f3a);
    [[-12.6, 0.5], [-12.6, 4]].forEach(([x, z]) => { collide(F0, box(1.4, 0.6, 2.6, sofaM, x, 0.3, z)); addTo(F0, box(0.4, 0.9, 2.6, sofaM, x - 0.55, 0.75, z)); });
    plant(F0, -13.8, -9.6); plant(F0, -1.5, 9.4); plant(F0, 13.8, -9.6); plant(F0, -13.8, 9.4);

    // Sala de reuniones acristalada (puerta en x 8..10)
    const MR = { x0: 2.5, x1: 14.2, z0: -1, z1: 10.4 };
    const mrMid = new THREE.Vector3((MR.x0 + MR.x1) / 2, 0, (MR.z0 + MR.z1) / 2);
    const gwall = (x: number, z: number, w: number, d: number) => {
      collide(F0, box(w, 2.6, d, glass(), x, 1.3, z, false));
      addTo(F0, box(w, 0.1, d, glow(NEON), x, 0.05, z, false));
    };
    gwall((MR.x0 + 8) / 2, MR.z0, 8 - MR.x0, 0.08);
    gwall((10 + MR.x1) / 2, MR.z0, MR.x1 - 10, 0.08);
    gwall(MR.x0, (MR.z0 + MR.z1) / 2, 0.08, MR.z1 - MR.z0);
    addTo(F0, box(2.2, 0.12, 0.2, glow(NEON), 9, 2.65, MR.z0, false));
    const mrSign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.8), new THREE.MeshBasicMaterial({ map: textTexture('SALA DE REUNIONES', '', '#CCFF00', 512, 96), transparent: true, toneMapped: false }));
    mrSign.position.set(9, 3.2, MR.z0 - 0.05); mrSign.rotation.y = Math.PI;
    addTo(F0, mrSign);
    collide(F0, box(8, 0.14, 2.4, mat(0x11141b), mrMid.x, 0.86, mrMid.z));
    addTo(F0, box(8.06, 0.05, 2.46, glow(NEON), mrMid.x, 0.79, mrMid.z, false), box(6, 0.75, 0.6, mat(0x0b0d12), mrMid.x, 0.4, mrMid.z));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: logoTex, toneMapped: false }));
    screen.position.set(mrMid.x, 2.1, MR.z1 - 0.32); screen.rotation.y = Math.PI;
    addTo(F0, box(3.8, 3.8, 0.12, mat(0x05060a), mrMid.x, 2.1, MR.z1 - 0.22), screen);
    const seats: { pos: THREE.Vector3; face: THREE.Vector3 }[] = [];
    for (let i = 0; i < 6; i++) {
      const x = mrMid.x - 3.2 + i * 1.28;
      for (const side of [-1, 1]) {
        const z = mrMid.z + side * 1.75;
        const chair = new THREE.Group();
        chair.add(box(0.55, 0.1, 0.55, mat(0x1b1f29), 0, 0.5, 0), box(0.55, 0.65, 0.08, mat(0x1b1f29), 0, 0.85, side * 0.27), box(0.06, 0.45, 0.06, mat(0x3a3f4b), 0, 0.25, 0));
        chair.position.set(x, 0, z); addTo(F0, chair);
        seats.push({ pos: new THREE.Vector3(x, 0, z), face: new THREE.Vector3(x, 0, mrMid.z) });
      }
    }

    // --- Pisos de departamentos ---
    const bots: Bot[] = [];
    const deptAgents = DEPTS.map((_, i) => agentes.filter(a => deptIndexFor(a) === i));
    const podX = (f: number, i: number) => {
      const n = Math.max(deptAgents[f].length, 1);
      const spacing = Math.min(9.5, (FW - 8) / n);
      return (i - (n - 1) / 2) * spacing + 2;
    };

    const workstation = (f: number, px: number, pz: number, accent: THREE.Color) => {
      const deskZ = pz - 0.7;
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 6.6), new THREE.MeshLambertMaterial({ color: accent.clone().multiplyScalar(0.12) }));
      pad.rotation.x = -Math.PI / 2; pad.position.set(px, 0.02, pz - 1); addTo(f, pad);
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6.8, 0.01, 6.6)), new THREE.LineBasicMaterial({ color: accent, toneMapped: false }));
      outline.position.set(px, 0.03, pz - 1); addTo(f, outline);
      collide(f, box(2.8, 0.1, 1.15, mat(0xe5e7eb), px, 0.85, deskZ));
      addTo(f, box(2.7, 0.78, 1.0, mat(0x161a23), px, 0.42, deskZ), box(2.72, 0.05, 1.02, glow(accent), px, 0.05, deskZ, false));
      [-0.55, 0.55].forEach(dx => {
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.5), glow(accent.clone().lerp(new THREE.Color(0xffffff), 0.25)));
        scr.position.set(px + dx, 1.35, deskZ - 0.26);
        addTo(f, box(0.95, 0.6, 0.06, mat(0x0a0a0a), px + dx, 1.35, deskZ - 0.3), scr, box(0.06, 0.4, 0.06, mat(0x333333), px + dx, 1.05, deskZ - 0.3));
      });
      addTo(f, box(0.75, 0.04, 0.26, mat(0x1f2937), px, 0.92, deskZ + 0.25), box(0.13, 0.17, 0.13, mat(accent), px + 1.05, 0.98, deskZ + 0.1));
      const chair = new THREE.Group();
      chair.add(box(0.62, 0.12, 0.62, mat(0x111318), 0, 0.5, 0), box(0.62, 0.8, 0.1, mat(0x111318), 0, 0.95, 0.3), box(0.62, 0.05, 0.12, glow(accent), 0, 1.36, 0.3, false), box(0.08, 0.45, 0.08, mat(0x444444), 0, 0.25, 0));
      chair.position.set(px, 0, pz + 0.5); addTo(f, chair);
      [-1, 1].forEach(s => collide(f, box(0.06, 1.5, 3.2, glass(), px + s * 3.4, 0.75, pz + 0.4, false)));
      plant(f, px + 2.7, pz + 1.6, 0.8);
    };

    for (let f = 1; f < DEPTS.length; f++) {
      const accent = new THREE.Color(DEPTS[f].color);
      deptAgents[f].forEach((_, i) => workstation(f, podX(f, i), 4, accent));
      if (f === 1) { // Marketing: set de grabación
        const ringLight = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 6, 20), glow(0xd9d9d9));
        ringLight.position.set(-11, 2.1, -5); ringLight.rotation.y = 0.6;
        addTo(f, ringLight, box(0.06, 2, 0.06, mat(0x222222), -11, 1, -5));
        addTo(f, box(0.5, 0.35, 0.3, mat(0x111111), -9, 1.6, -6.2), box(0.18, 0.18, 0.2, mat(0x333333), -9, 1.6, -6.0), box(0.06, 1.45, 0.06, mat(0x222222), -9, 0.72, -6.2));
        collide(f, box(4, 3, 0.1, mat(0xff3d9a), -12, 1.5, -2.8));
      }
      if (f === 2) { // Tecnología: servidores
        for (let i = 0; i < 4; i++) {
          collide(f, box(1, 2.4, 1.1, mat(0x0d1017), -13 + i * 1.3, 1.2, -6));
          for (let l = 0; l < 6; l++) addTo(f, box(0.7, 0.05, 0.02, glow(l % 2 ? 0x22d3ee : 0x22c55e), -13 + i * 1.3, 0.5 + l * 0.32, -5.43, false));
        }
      }
      if (f === 3) { // Rendimiento: cinta, mancuernas, kettlebells
        collide(f, box(1.1, 0.25, 2.6, mat(0x15181f), -11, 0.15, -5));
        addTo(f, box(0.9, 0.04, 2.2, mat(0x050505), -11, 0.3, -5), box(1.1, 1.3, 0.12, mat(0x2a2f3a), -11, 0.9, -6.2), box(0.8, 0.25, 0.1, glow(0xff9f1c), -11, 1.45, -6.15, false));
        collide(f, box(3, 0.9, 0.7, mat(0x2a2f3a), -6.5, 0.45, -6.5));
        for (let i = 0; i < 5; i++) {
          const db = new THREE.Group();
          db.add(box(0.45, 0.07, 0.07, mat(0xbbbbbb)), box(0.1, 0.2, 0.2, mat(0x111111), -0.22, 0, 0), box(0.1, 0.2, 0.2, mat(0x111111), 0.22, 0, 0));
          db.position.set(-7.7 + i * 0.6, 1.02, -6.5); addTo(f, db);
        }
        [[-3, -6], [-2.2, -6.2]].forEach(([x, z]) => addTo(f, box(0.45, 0.4, 0.45, mat(0xff9f1c), x, 0.2, z), box(0.3, 0.12, 0.08, mat(0x111111), x, 0.5, z)));
      }
      if (f === 4) { // Negocio: pizarra y librería
        collide(f, box(3.6, 2, 0.1, mat(0xf3f4f6), -11, 1.5, -6.5));
        const chart = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: canvasTexture(64, 32, g => {
          g.fillStyle = '#f3f4f6'; g.fillRect(0, 0, 64, 32);
          g.strokeStyle = '#7c3aed'; g.lineWidth = 2; g.beginPath(); g.moveTo(4, 26); g.lineTo(18, 20); g.lineTo(30, 22); g.lineTo(44, 12); g.lineTo(60, 5); g.stroke();
          g.fillStyle = '#16a34a'; [10, 22, 34, 46].forEach((x, i) => g.fillRect(x, 28 - i * 4 - 4, 6, i * 4 + 4));
        }) }));
        chart.position.set(-11, 1.5, -6.44); addTo(f, chart);
        collide(f, box(3, 2.2, 0.6, mat(0x3b2a1e), -6.5, 1.1, -6.6));
        for (let i = 0; i < 8; i++) addTo(f, box(0.25, 0.4, 0.3, mat(new THREE.Color().setHSL(i / 8, 0.6, 0.45)), -7.7 + (i % 4) * 0.7, 0.6 + Math.floor(i / 4) * 0.8, -6.25));
      }
      plant(f, 13.6, -9.4); plant(f, -13.6, 9.4);
      collide(f, box(2.6, 0.5, 1.2, mat(0x2b2f3a), 10, 0.25, -8));
      addTo(f, box(2.6, 0.8, 0.35, mat(0x2b2f3a), 10, 0.65, -8.55), box(1.2, 0.4, 0.8, mat(0x11141b), 10, 0.2, -6.3));
    }

    // --- Agentes ---
    agentes.forEach(agent => {
      const f = deptIndexFor(agent);
      const accent = new THREE.Color(DEPTS[f].color);
      const ch = buildCharacter(agent.id, `${agent.rol} ${agent.nickname} ${agent.nombre}`, f === 0 ? 0x2b2f3a : accent.clone().multiplyScalar(0.75).getHex());
      let home: THREE.Vector3, homeFace: THREE.Vector3, pod: THREE.Vector3, bounds: Bot['bounds'];
      if (f === 0) {
        home = new THREE.Vector3(-6, 0, 4.7); homeFace = new THREE.Vector3(-6, 0, 0); pod = home.clone();
        bounds = { minX: -11, maxX: -1, minZ: -2, maxZ: 1.5 };
      } else {
        const px = podX(f, deptAgents[f].indexOf(agent));
        pod = new THREE.Vector3(px, 0, 4);
        home = new THREE.Vector3(px, 0, 4.5); homeFace = new THREE.Vector3(px, 0, 0);
        bounds = { minX: px - 2.6, maxX: px + 2.6, minZ: 0.2, maxZ: 2 };
      }
      ch.group.position.copy(home);
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
    const player = buildCharacter('jefe-tj', 'jefe', 0x111318, true);
    const playerRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 20), new THREE.MeshBasicMaterial({ color: NEON, side: THREE.DoubleSide, toneMapped: false }));
    playerRing.rotation.x = -Math.PI / 2; playerRing.position.y = 0.03;
    player.group.add(playerRing);
    let playerFloor = 0;
    player.group.position.set(-5, 0, -7);
    floors[0].content.add(player.group);
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.34, 14), new THREE.MeshBasicMaterial({ color: NEON, side: THREE.DoubleSide, toneMapped: false }));
    marker.rotation.x = -Math.PI / 2; marker.position.y = 0.04; marker.visible = false;
    floors[0].content.add(marker);

    const applyFloorVisibility = () => {
      floors.forEach((fl, i) => { fl.group.visible = i <= playerFloor; fl.content.visible = i === playerFloor; });
      sun.position.set(18, floors[playerFloor].y + 26, -14);
      sun.target.position.set(0, floors[playerFloor].y, 0);
    };
    applyFloorVisibility();

    // --- Etiquetas DOM ---
    const labels = new Map<string, { root: HTMLDivElement; bubble: HTMLDivElement }>();
    labelsLayer.innerHTML = '';
    for (const b of bots) {
      const color = '#' + new THREE.Color(DEPTS[b.floor].color).getHexString();
      const root = document.createElement('div');
      root.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;text-align:center;white-space:nowrap;display:none;';
      const bubble = document.createElement('div');
      bubble.style.cssText = `display:none;max-width:230px;white-space:normal;margin:0 auto 5px;padding:7px 9px;border-radius:10px;background:rgba(5,6,10,.92);border:1px solid ${color};color:#f3f4f6;font:600 10px/1.4 ui-monospace,monospace;box-shadow:0 0 16px ${color}44;text-align:left;`;
      const name = document.createElement('div');
      name.style.cssText = `display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;background:rgba(0,0,0,.75);border:1px solid ${color}66;color:#fff;font:800 9px ui-monospace,monospace;letter-spacing:.04em;`;
      const dot = document.createElement('span');
      dot.style.cssText = `width:6px;height:6px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color};`;
      const txt = document.createElement('span');
      txt.textContent = `@${b.agent.nickname}`;
      name.append(dot, txt);
      root.append(bubble, name);
      labelsLayer.appendChild(root);
      labels.set(b.agent.id, { root, bubble });
    }

    // --- Rutas, pisos y reuniones ---
    const moveBotToFloor = (b: Bot, f: number, pos: THREE.Vector3) => {
      floors[f].content.add(b.group);
      b.at = f; b.group.position.copy(pos); b.path = [];
    };
    const planTo = (b: Bot, dest: THREE.Vector3) => {
      const g = b.group.position;
      const pts: THREE.Vector3[] = [];
      if (b.state === 'meeting' && b.at === 0) {
        if (g.z < MR.z0 + 0.3) pts.push(new THREE.Vector3(9, 0, MR.z0 - 0.9), new THREE.Vector3(9, 0, MR.z0 + 0.9));
        pts.push(new THREE.Vector3(dest.x, 0, mrMid.z + Math.sign(dest.z - mrMid.z) * 2.6), dest.clone());
      } else if (b.floor === 0) {
        const behind = (v: THREE.Vector3) => v.z > 4.1 && v.x > -9 && v.x < -3;
        if (g.x > MR.x0 && g.z > MR.z0) pts.push(new THREE.Vector3(9, 0, MR.z0 + 0.9), new THREE.Vector3(9, 0, MR.z0 - 0.9));
        if (behind(dest) !== behind(g)) pts.push(new THREE.Vector3(-6 + b.side * 3.1, 0, 4.4));
        pts.push(dest.clone());
      } else {
        const behind = (v: THREE.Vector3) => v.z > b.pod.z - 0.1;
        if (behind(dest) !== behind(g)) pts.push(new THREE.Vector3(b.pod.x + b.side * 1.9, 0, b.pod.z + 0.2));
        pts.push(dest.clone());
      }
      b.path = pts;
      b.sitting = false;
    };
    const startMeeting = (on: boolean) => {
      for (const b of bots) {
        if (on && b.seat) {
          b.state = 'meeting';
          if (b.at !== 0) moveBotToFloor(b, 0, elevatorPos.clone().add(new THREE.Vector3(1.6 + Math.random(), 0, 1.6 + Math.random())));
          planTo(b, b.seat.pos);
        } else if (!on) {
          b.state = 'work';
          if (b.at !== b.floor) moveBotToFloor(b, b.floor, elevatorPos.clone().add(new THREE.Vector3(1.8, 0, 1.8)));
          planTo(b, b.home);
          b.timer = 8 + Math.random() * 6;
        }
      }
    };
    setMeetingRef.current = startMeeting;

    let moveTarget: THREE.Vector3 | null = null;
    let lastNearKey = '';
    const goToFloor = (f: number) => {
      if (f === playerFloor) return;
      playerFloor = f;
      floors[f].content.add(player.group, marker);
      player.group.position.set(elevatorPos.x + 2.2, 0, elevatorPos.z + 2.2);
      marker.visible = false; moveTarget = null;
      applyFloorVisibility();
      lastNearKey = '';
    };
    goToFloorRef.current = goToFloor;

    // Acceso de depuración solo en desarrollo (pruebas automáticas)
    if (import.meta.env.DEV) {
      (window as any).__tjOffice = {
        teleport: (x: number, z: number, y?: number) => { player.group.position.set(x, 0, z); moveTarget = null; if (y !== undefined) yaw = y; },
        bots: () => bots.map(b => ({ nick: b.agent.nickname, floor: b.floor, at: b.at, state: b.state, sitting: b.sitting, x: +b.group.position.x.toFixed(1), z: +b.group.position.z.toFixed(1) }))
      };
    }

    // --- Entrada ---
    const keys = new Set<string>();
    let yaw = 0.2, dist = 18;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragging = false, dragMoved = 0, lastX = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'escape') { setSelected(null); setElevatorOpen(false); setMeetingPanel(false); (document.activeElement as HTMLElement)?.blur?.(); return; }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e', 'q'].includes(k)) e.preventDefault();
      if (k === 'e') {
        const n = nearbyRef.current;
        if (n?.kind === 'agent') setSelected(n.agent);
        else if (n?.kind === 'elevator') setElevatorOpen(true);
        else if (n?.kind === 'meeting') setMeetingPanel(true);
        return;
      }
      keys.add(k); moveTarget = null; marker.visible = false;
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const setPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const visibleBots = () => bots.filter(b => b.at === playerFloor).map(b => b.group);
    const onPointerDown = (e: PointerEvent) => { dragging = true; dragMoved = 0; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) {
        setPointer(e); raycaster.setFromCamera(pointer, camera);
        canvas.style.cursor = raycaster.intersectObjects(visibleBots(), true).length ? 'pointer' : 'grab';
        return;
      }
      const dx = e.clientX - lastX; lastX = e.clientX; dragMoved += Math.abs(dx);
      yaw -= dx * 0.008;
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      if (dragMoved > 6) return;
      setPointer(e); raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(visibleBots(), true)[0];
      if (hit) { const ag = agentes.find(a => a.id === hit.object.userData.agentId); if (ag) setSelected(ag); return; }
      const floorMesh = floors[playerFloor].content.getObjectByName('floor')!;
      const fh = raycaster.intersectObject(floorMesh)[0];
      if (fh) {
        moveTarget = floors[playerFloor].content.worldToLocal(fh.point.clone()).setY(0);
        marker.position.set(moveTarget.x, 0.04, moveTarget.z); marker.visible = true;
        if (helpRef.current) { helpRef.current = false; setShowHelp(false); }
      }
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); dist = THREE.MathUtils.clamp(dist + e.deltaY * 0.012, 7, 28); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const resize = () => {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1;
      const rw = Math.ceil(w / PIXEL_SCALE), rh = Math.ceil(h / PIXEL_SCALE);
      renderer.setSize(rw, rh, false);
      composer.setSize(rw, rh);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // --- Animación ---
    const RADIUS = 0.35;
    const blocked = (x: number, z: number) => {
      if (Math.abs(x) > halfW - 0.7 || Math.abs(z) > halfD - 0.7) return true;
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
      const s = Math.sin(t * 10) * 0.75;
      c.legL.rotation.x = s; c.legR.rotation.x = -s; c.armL.rotation.x = -s; c.armR.rotation.x = s;
      c.armR.rotation.z = c.armL.rotation.z = 0;
      c.body.position.y = Math.abs(Math.sin(t * 10)) * 0.05;
      c.head.rotation.set(0, 0, 0);
    };
    const sitPose = (c: CharParts, t: number, fast: boolean) => {
      c.body.position.y = -0.2;
      c.legL.rotation.x = c.legR.rotation.x = -1.45;
      const k = fast ? 24 : 9;
      c.armL.rotation.x = -1.15 + Math.sin(t * k) * 0.14;
      c.armR.rotation.x = -1.15 + Math.cos(t * k) * 0.14;
      c.armL.rotation.z = c.armR.rotation.z = 0;
      c.head.rotation.x = Math.sin(t * 1.3) * 0.05;
    };
    const standPose = (c: CharParts, t: number) => {
      c.body.position.y = Math.sin(t * 2) * 0.015;
      c.legL.rotation.x = c.legR.rotation.x = 0;
      c.armL.rotation.x = c.armR.rotation.x = Math.sin(t * 2) * 0.05;
      c.head.rotation.set(0, 0, 0);
    };

    const clock = new THREE.Clock();
    const tmp = new THREE.Vector3(), wp = new THREE.Vector3();
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      stars.rotation.y += dt * 0.004;
      planet.rotation.y += dt * 0.03;

      // Jugador
      const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const dir = new THREE.Vector3();
      if (keys.has('w') || keys.has('arrowup')) dir.add(fwd);
      if (keys.has('s') || keys.has('arrowdown')) dir.sub(fwd);
      if (keys.has('d') || keys.has('arrowright')) dir.add(right);
      if (keys.has('a') || keys.has('arrowleft')) dir.sub(right);
      if (keys.has('q')) yaw += dt * 1.8;
      if (moveTarget && dir.lengthSq() === 0) {
        tmp.copy(moveTarget).sub(player.group.position).setY(0);
        if (tmp.length() < 0.15) { moveTarget = null; marker.visible = false; } else dir.copy(tmp);
      }
      const moving = dir.lengthSq() > 0;
      if (moving) {
        dir.normalize().multiplyScalar(4.4 * dt);
        const before = player.group.position.clone();
        tryMove(player.group, dir.x, dir.z);
        faceTo(player.group, player.group.position.x + dir.x, player.group.position.z + dir.z, 0.3);
        if (moveTarget && before.distanceTo(player.group.position) < 0.001) { moveTarget = null; marker.visible = false; }
        if (helpRef.current) { helpRef.current = false; setShowHelp(false); }
        walkAnim(player, t);
      } else standPose(player, t);
      marker.rotation.z += dt * 2;

      // Bots
      let near: Bot | null = null, nearD = 2.8;
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
            if (r < 0.5) { b.state = 'work'; planTo(b, b.home); b.timer = 8 + Math.random() * 10; }
            else if (r < 0.85) {
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
          if (d < 0.08) b.path.shift();
          else {
            const speed = isTyping || b.state === 'meeting' ? 3.4 : 1.5;
            tmp.normalize().multiplyScalar(Math.min(speed * dt, d));
            g.position.add(tmp);
            faceTo(g, g.position.x + tmp.x, g.position.z + tmp.z, 0.25);
            walkAnim(b, t + b.phase);
          }
          if (!b.path.length && (b.state === 'work' || b.state === 'meeting')) b.sitting = true;
        } else if (b.sitting && b.state === 'work' && !(pd < 2.6 && !isTyping)) {
          faceTo(g, b.homeFace.x, b.homeFace.z, 0.2);
          sitPose(b, t + b.phase, isTyping);
        } else if (b.sitting && b.state === 'meeting' && b.seat) {
          faceTo(g, b.seat.face.x, b.seat.face.z, 0.2);
          sitPose(b, t + b.phase, false);
          b.armL.rotation.x = b.armR.rotation.x = -0.9;
          b.head.rotation.y = Math.sin(t * 0.7 + b.phase) * 0.35;
        } else {
          standPose(b, t + b.phase);
          if (pd < 4 || isTalking) {
            faceTo(g, player.group.position.x, player.group.position.z, 0.15);
            if (!isTalking) { b.armR.rotation.z = Math.PI * 0.85 + Math.sin(t * 8) * 0.25; b.armR.rotation.x = 0; }
            else b.armR.rotation.z = 0;
          } else b.armR.rotation.z = 0;
        }
      }

      // Elemento cercano: agente, ascensor o sala de reuniones
      let nearKey = '', nearVal: Nearby = null;
      const pp = player.group.position;
      if (near) { nearKey = 'a:' + near.agent.id; nearVal = { kind: 'agent', agent: near.agent }; }
      else if (pp.distanceTo(elevatorPos) < 2.6) { nearKey = 'elev'; nearVal = { kind: 'elevator' }; }
      else if (playerFloor === 0 && pp.x > MR.x0 && pp.x < MR.x1 && pp.z > MR.z0 && pp.z < MR.z1) { nearKey = 'meet'; nearVal = { kind: 'meeting' }; }
      if (nearKey !== lastNearKey) { lastNearKey = nearKey; nearbyRef.current = nearVal; setNearby(nearVal); }

      // Cámara
      const fy = floors[playerFloor].y;
      camera.position.set(pp.x - Math.sin(yaw) * dist * 0.62, fy + dist * 0.95 + 1, pp.z - Math.cos(yaw) * dist * 0.62);
      camera.lookAt(pp.x, fy + 1.1, pp.z);
      floors[playerFloor].content.traverse(o => { if (o.name === 'billboard') { o.getWorldPosition(wp); o.lookAt(camera.position.x, wp.y, camera.position.z); } });

      // Etiquetas
      const rect = mount.getBoundingClientRect();
      const now = Date.now();
      for (const b of bots) {
        const lab = labels.get(b.agent.id)!;
        if (b.at !== playerFloor) { lab.root.style.display = 'none'; continue; }
        b.group.getWorldPosition(wp); wp.y += 2.45;
        tmp.copy(wp).project(camera);
        const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
        lab.root.style.display = visible ? 'block' : 'none';
        if (!visible) continue;
        lab.root.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * rect.width}px, ${(-tmp.y * 0.5 + 0.5) * rect.height}px) translate(-50%, -100%)`;
        let bubble = '';
        if (typingRef.current === b.agent.nickname) bubble = '✍️ trabajando en ello...';
        else {
          const last = [...mensajesRef.current].reverse().find(m => m.remitente_tipo === 'agente' && m.remitente_id === b.agent.id);
          if (last && now - new Date(last.creado_en).getTime() < 120000) bubble = last.texto.replace(/[#*`_\[\]]/g, '').slice(0, 120) + (last.texto.length > 120 ? '…' : '');
        }
        if (lab.bubble.textContent !== bubble) lab.bubble.textContent = bubble;
        lab.bubble.style.display = bubble ? 'block' : 'none';
        // En la reunión, para no amontonar nombres: solo quien habla o quien está cerca del jefe
        if (b.state === 'meeting' && b.sitting && !bubble && b.group.position.distanceTo(player.group.position) > 2.4) lab.root.style.display = 'none';
      }

      composer.render();
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
      composer.dispose();
      renderer.dispose();
      canvas.remove();
      labelsLayer.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey]);

  // --- UI ---
  const changeFloor = (f: number) => {
    setElevatorOpen(false);
    if (f === floor) return;
    setFading(true);
    setTimeout(() => { goToFloorRef.current(f); setFloor(f); setTimeout(() => setFading(false), 60); }, 260);
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
    <div className="relative flex-1 min-h-0 overflow-hidden bg-[#020309] select-none">
      <div ref={mountRef} className="absolute inset-0" />
      <div ref={labelsRef} className="absolute inset-0 pointer-events-none overflow-hidden" />
      <div className={`absolute inset-0 bg-black pointer-events-none transition-opacity duration-300 ${fading ? 'opacity-100' : 'opacity-0'}`} />

      {/* Selector de pisos */}
      <div className="absolute top-3 left-3 w-[200px] rounded-xl bg-black/75 border border-white/10 backdrop-blur p-2.5 space-y-1">
        <div className="flex items-center gap-2 px-1 pb-1.5 border-b border-white/10">
          <img src={LOGO_URL} alt="TJ FitLab" className="w-7 h-7 rounded" />
          <div className="leading-tight">
            <p className="text-[10px] font-black text-[#CCFF00] tracking-widest">TJ FITLAB HQ</p>
            <p className="text-[8px] text-white/40 uppercase tracking-wider">Estación orbital</p>
          </div>
        </div>
        {[...floorsInfo].reverse().map(fi => (
          <button key={fi.index} onClick={() => changeFloor(fi.index)}
            className={`w-full text-left px-2 py-1.5 rounded-lg transition-all flex items-center gap-2 ${floor === fi.index ? 'bg-white/10' : 'hover:bg-white/5'}`}>
            <span className="w-5 h-5 rounded text-[9px] font-black flex items-center justify-center shrink-0" style={{ background: floor === fi.index ? hex(fi.color) : '#1f2430', color: floor === fi.index ? '#000' : '#fff' }}>{fi.index}</span>
            <span className="min-w-0">
              <span className="block text-[9.5px] font-bold text-white truncate">{fi.short}</span>
              <span className="block text-[8px] text-white/40 truncate">{fi.index === 0 ? 'Recepción · Reuniones' : fi.agents.map(a => '@' + a.nickname).join(' ')}</span>
            </span>
          </button>
        ))}
        <button onClick={toggleMeeting}
          className={`w-full mt-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${meeting ? 'bg-red-500/15 text-red-300 border border-red-500/30' : 'bg-[#CCFF00] text-black shadow-[0_0_14px_#CCFF0044]'}`}>
          {meeting ? 'Terminar reunión' : '📣 Convocar reunión'}
        </button>
      </div>

      {showHelp && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl bg-black/80 border border-[#CCFF00]/30 text-[10px] text-white/80 font-mono text-center pointer-events-none max-w-[55%] hidden md:block">
          <b>WASD / flechas</b> o <b>clic en el suelo</b> · <b>arrastra</b> para girar · <b>rueda</b> zoom · <b>clic en un agente</b> o <b>E</b> para hablar · cambia de piso con el <b>ascensor</b> o el panel
        </div>
      )}

      {nearby && !selected && !elevatorOpen && !meetingPanel && (
        <button
          onClick={() => nearby.kind === 'agent' ? setSelected(nearby.agent) : nearby.kind === 'elevator' ? setElevatorOpen(true) : setMeetingPanel(true)}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-[#CCFF00] text-black text-[11px] font-black uppercase tracking-widest shadow-[0_0_20px_#CCFF0055]">
          {nearby.kind === 'agent' ? `Hablar con @${nearby.agent.nickname}` : nearby.kind === 'elevator' ? 'Usar ascensor' : meeting ? 'Hablar con el equipo' : 'Sala de reuniones'} <span className="opacity-60">(E)</span>
        </button>
      )}

      {elevatorOpen && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50" onClick={() => setElevatorOpen(false)}>
          <div className="w-[300px] rounded-2xl bg-[#07080d] border border-[#CCFF00]/30 p-4 shadow-[0_0_40px_#CCFF0022]" onClick={e => e.stopPropagation()}>
            <p className="text-[10px] font-black text-[#CCFF00] tracking-[0.25em] mb-3 text-center">ASCENSOR · ELIGE PISO</p>
            <div className="space-y-1.5">
              {[...floorsInfo].reverse().map(fi => (
                <button key={fi.index} onClick={() => changeFloor(fi.index)} disabled={fi.index === floor}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 text-left">
                  <span className="w-7 h-7 rounded-md text-[11px] font-black flex items-center justify-center text-black shrink-0" style={{ background: hex(fi.color) }}>{fi.index}</span>
                  <span className="text-[10px] font-bold text-white">{fi.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {panelAgent && (selected || meetingPanel) && (
        <div className="absolute top-0 right-0 h-full w-full sm:w-[390px] bg-[#07080d]/95 border-l border-white/10 flex flex-col backdrop-blur">
          <div className="p-4 border-b border-white/10 flex items-center gap-3">
            {meetingPanel ? (
              <img src={LOGO_URL} alt="" className="w-11 h-11 rounded border border-[#CCFF00]/40" />
            ) : (
              <img src={panelAgent.avatar_url || LOGO_URL} alt="" className="w-11 h-11 rounded object-cover border" style={{ borderColor: deptColor(panelAgent) }} onError={e => { (e.target as HTMLImageElement).src = LOGO_URL; }} />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-black text-[13px] truncate" style={{ color: meetingPanel ? '#CCFF00' : deptColor(panelAgent) }}>{meetingPanel ? 'Reunión de equipo' : `@${panelAgent.nickname}`}</p>
              <p className="text-[9px] text-white/50 uppercase tracking-widest truncate">
                {meetingPanel ? `Modera @${panelAgent.nickname} · ${agentes.length} agentes` : `${panelAgent.rol} · Piso ${deptIndexFor(panelAgent)} ${DEPTS[deptIndexFor(panelAgent)].short}`}
              </p>
            </div>
            <button onClick={() => { setSelected(null); setMeetingPanel(false); }} className="text-white/50 hover:text-white text-lg px-2" aria-label="Cerrar">✕</button>
          </div>
          {meetingPanel && !meeting && (
            <button onClick={toggleMeeting} className="m-3 mb-0 py-2 rounded-lg bg-[#CCFF00] text-black text-[10px] font-black uppercase tracking-widest">📣 Convocar a todo el equipo</button>
          )}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
            {conversation.length === 0 && !panelTyping && (
              <p className="text-[11px] text-white/40 text-center mt-8">
                {meetingPanel ? `Plantea un tema y el equipo lo debatirá. @${panelAgent.nickname} modera y responde por todos.` : `Pídele algo a @${panelAgent.nickname}: buscar en internet, publicar en el foro, crear tareas o añadir leads.`}
              </p>
            )}
            {conversation.map(m => (
              <div key={m.id} className={`text-[11px] leading-relaxed whitespace-pre-wrap break-words rounded-lg p-3 ${m.remitente_tipo === 'agente' ? 'bg-white/5 border border-white/5 text-white/90' : 'bg-[#CCFF00]/10 text-white/85 ml-6'}`}>
                {m.texto.replace(/^@\S+\s+\[REUNIÓN DE EQUIPO[^\]]*\]\s*/, '📣 ')}
              </div>
            ))}
            {panelTyping && <div className="text-[11px] text-white/50 animate-pulse">@{panelAgent.nickname} está trabajando en ello…</div>}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={submit} className="p-3 border-t border-white/10 flex gap-2">
            <input value={draft} onChange={e => setDraft(e.target.value)} autoFocus
              placeholder={meetingPanel ? 'Tema para el equipo...' : `Escribe a @${panelAgent.nickname}...`}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-[12px] text-white outline-none focus:border-[#CCFF00]/40" />
            <button type="submit" disabled={isSending || !draft.trim()} className="px-4 rounded-lg bg-[#CCFF00] text-black text-[11px] font-black uppercase disabled:opacity-40">Enviar</button>
          </form>
        </div>
      )}
    </div>
  );
};
