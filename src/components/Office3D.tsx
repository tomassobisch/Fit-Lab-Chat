import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Agente, Mensaje } from '../types';

// ---------------------------------------------------------------------------
// OFICINA 3D PIXEL — cada agente vive en su sección; el jefe navega y conversa.
// Controles: WASD / flechas para moverse, clic en el suelo para ir, arrastrar
// para girar la cámara, rueda para zoom, clic en un bot o tecla E para hablar.
// ---------------------------------------------------------------------------

interface Props {
  agentes: Agente[];
  mensajes: Mensaje[];
  typingNickname: string | null;
  isSending: boolean;
  onSend: (agent: Agente, text: string) => Promise<void>;
}

const PIXEL_SCALE = 3; // tamaño del "píxel" en pantalla
const SECTION = 8; // tamaño de cada sección
const GAP = 3.5; // pasillo entre secciones
const COLS = 4;
const NEON = 0xccff00;

type BotState = 'work' | 'walk' | 'idle';

interface Bot {
  agent: Agente;
  group: THREE.Group;
  head: THREE.Mesh;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  home: THREE.Vector3; // posición en la silla
  deskFacing: number; // rotación mirando al monitor
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  state: BotState;
  timer: number;
  target: THREE.Vector3;
  path: THREE.Vector3[]; // puntos intermedios para rodear el escritorio
  side: number; // lado por el que rodea (-1 / 1)
  center: THREE.Vector3;
  phase: number;
}

// Color estable por agente
const hueFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h / 360;
};

const lambert = (color: THREE.ColorRepresentation, emissive?: THREE.ColorRepresentation) =>
  new THREE.MeshLambertMaterial({ color, ...(emissive !== undefined ? { emissive, emissiveIntensity: 0.9 } : {}) });

function box(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Texto en una textura (carteles)
function textTexture(lines: { text: string; color: string; size: number }[], width = 256, height = 96, bg = '#0a0a0a') {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, width, height);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const total = lines.reduce((a, l) => a + l.size * 1.25, 0);
  let y = (height - total) / 2;
  for (const l of lines) {
    g.font = `bold ${l.size}px monospace`;
    g.fillStyle = l.color;
    y += l.size * 0.625;
    g.fillText(l.text, width / 2, y, width - 12);
    y += l.size * 0.625;
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Personaje de bloques estilo pixel/voxel
function buildCharacter(shirt: THREE.Color, faceUrl: string | undefined, loader: THREE.TextureLoader) {
  const group = new THREE.Group();
  const skin = lambert(0xf1c27d);
  const shirtMat = lambert(shirt);
  const pants = lambert(0x1f2937);
  const hair = lambert(0x2b1d14);

  const legL = new THREE.Object3D();
  legL.position.set(-0.13, 0.55, 0);
  legL.add(box(0.22, 0.55, 0.24, pants, 0, -0.275, 0));
  const legR = new THREE.Object3D();
  legR.position.set(0.13, 0.55, 0);
  legR.add(box(0.22, 0.55, 0.24, pants, 0, -0.275, 0));

  const body = box(0.56, 0.62, 0.32, shirtMat, 0, 0.86, 0);

  const armL = new THREE.Object3D();
  armL.position.set(-0.38, 1.12, 0);
  armL.add(box(0.18, 0.55, 0.2, shirtMat, 0, -0.25, 0));
  armL.add(box(0.16, 0.12, 0.18, skin, 0, -0.56, 0));
  const armR = new THREE.Object3D();
  armR.position.set(0.38, 1.12, 0);
  armR.add(box(0.18, 0.55, 0.2, shirtMat, 0, -0.25, 0));
  armR.add(box(0.16, 0.12, 0.18, skin, 0, -0.56, 0));

  // Cabeza: la cara frontal lleva el avatar del agente
  const faceMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  if (faceUrl) {
    loader.load(
      faceUrl,
      tex => {
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        faceMat.map = tex;
        faceMat.needsUpdate = true;
      },
      undefined,
      () => faceMat.color.set(0xf1c27d)
    );
  } else {
    faceMat.color.set(0xf1c27d);
  }
  // Orden de caras de BoxGeometry: +x, -x, +y, -y, +z (frente), -z
  const head = box(0.5, 0.5, 0.5, [skin, skin, hair, skin, faceMat, hair], 0, 1.45, 0);
  group.add(legL, legR, body, armL, armR, head);
  return { group, head, armL, armR, legL, legR };
}

export const Office3D: React.FC<Props> = ({ agentes, mensajes, typingNickname, isSending, onSend }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Agente | null>(null);
  const [nearby, setNearby] = useState<Agente | null>(null);
  const [draft, setDraft] = useState('');
  const [showHelp, setShowHelp] = useState(true);
  const helpVisibleRef = useRef(true);

  // Refs para que la escena lea el estado sin reconstruirse
  const typingRef = useRef(typingNickname);
  const mensajesRef = useRef(mensajes);
  const selectedRef = useRef<Agente | null>(null);
  const nearbyRef = useRef<Agente | null>(null);
  useEffect(() => { typingRef.current = typingNickname; }, [typingNickname]);
  useEffect(() => { mensajesRef.current = mensajes; }, [mensajes]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const agentKey = agentes.map(a => a.id).join('|');

  useEffect(() => {
    const mount = mountRef.current;
    const labelsLayer = labelsRef.current;
    if (!mount || !labelsLayer || agentes.length === 0) return;

    // --- Renderer pixelado ---
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.imageRendering = 'pixelated';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    mount.appendChild(canvas);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07070a);
    scene.fog = new THREE.Fog(0x07070a, 38, 75);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    const loader = new THREE.TextureLoader();

    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1a22, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(18, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.far = 90;
    scene.add(sun);

    // --- Distribución de secciones ---
    const rows = Math.ceil(agentes.length / COLS);
    const pitch = SECTION + GAP;
    const width = COLS * pitch;
    const sectionCenter = (i: number) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      return new THREE.Vector3((col - (COLS - 1) / 2) * pitch, 0, row * pitch + 6);
    };
    const lobbyZ = -6;
    const minX = -width / 2 - 1, maxX = width / 2 + 1;
    const minZ = lobbyZ - 16, maxZ = (rows - 1) * pitch + 6 + SECTION / 2 + 2;

    // Suelo general (clicable)
    const floorMat = lambert(0x16161c);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX + 6, maxZ - minZ + 6), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, (minZ + maxZ) / 2);
    floor.receiveShadow = true;
    scene.add(floor);
    // Retícula de baldosas
    const grid = new THREE.GridHelper(Math.max(maxX - minX, maxZ - minZ) + 6, Math.round((Math.max(maxX - minX, maxZ - minZ) + 6) / 2), 0x22222a, 0x1c1c22);
    grid.position.set(0, 0.01, (minZ + maxZ) / 2);
    scene.add(grid);

    const colliders: THREE.Box3[] = [];
    const addCollider = (m: THREE.Object3D) => { m.updateMatrixWorld(true); colliders.push(new THREE.Box3().setFromObject(m)); };

    // Paredes exteriores bajas
    const wallMat = lambert(0x2a2a33);
    const outer = [
      box(maxX - minX, 1.6, 0.4, wallMat, 0, 0.8, minZ),
      box(maxX - minX, 1.6, 0.4, wallMat, 0, 0.8, maxZ),
      box(0.4, 1.6, maxZ - minZ, wallMat, minX, 0.8, (minZ + maxZ) / 2),
      box(0.4, 1.6, maxZ - minZ, wallMat, maxX, 0.8, (minZ + maxZ) / 2)
    ];
    outer.forEach(w => { scene.add(w); addCollider(w); });

    // --- Lobby: recepción, cartel y zona gym ---
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 2.2),
      new THREE.MeshBasicMaterial({ map: textTexture([{ text: 'TJ FITLAB', color: '#CCFF00', size: 40 }, { text: 'OFICINA DE AGENTES IA', color: '#ffffff', size: 16 }], 384, 96) })
    );
    sign.position.set(0, 3.4, 1.2);
    sign.rotation.y = Math.PI;
    scene.add(sign);
    const signPosts = [-4.4, 4.4].map(x => box(0.15, 3.4, 0.15, lambert(0x333340), x, 1.7, 1.25));
    signPosts.forEach(sp => { scene.add(sp); addCollider(sp); });
    const reception = box(4, 1, 1.2, lambert(0x111111), width / 2 - 6, 0.5, lobbyZ + 1);
    const receptionStripe = box(4.02, 0.12, 1.22, lambert(NEON, NEON), width / 2 - 6, 0.85, lobbyZ + 1);
    scene.add(reception, receptionStripe);
    addCollider(reception);
    // Mancuernas y rack (decoración gym)
    const rack = box(2.4, 0.9, 0.7, lambert(0x333340), -width / 2 + 3, 0.45, lobbyZ - 2);
    scene.add(rack); addCollider(rack);
    for (let i = 0; i < 4; i++) {
      const db = new THREE.Group();
      db.add(box(0.5, 0.08, 0.08, lambert(0x999999)));
      db.add(box(0.12, 0.22, 0.22, lambert(0x111111), -0.25, 0, 0));
      db.add(box(0.12, 0.22, 0.22, lambert(0x111111), 0.25, 0, 0));
      db.position.set(-width / 2 + 2.1 + i * 0.6, 1.02, lobbyZ - 2);
      scene.add(db);
    }
    const kettle = new THREE.Group();
    kettle.add(box(0.5, 0.45, 0.5, lambert(NEON), 0, 0.22, 0));
    kettle.add(box(0.36, 0.12, 0.1, lambert(0x111111), 0, 0.55, 0));
    kettle.position.set(width / 2 - 3, 0, lobbyZ - 2);
    scene.add(kettle);

    // --- Secciones y bots ---
    const bots: Bot[] = [];
    const botMeshes: THREE.Object3D[] = [];

    agentes.forEach((agent, i) => {
      const c = sectionCenter(i);
      const hue = hueFor(agent.id);
      const accent = new THREE.Color().setHSL(hue, 0.65, 0.5);
      const carpet = new THREE.Color().setHSL(hue, 0.35, 0.16);

      const rug = box(SECTION, 0.04, SECTION, lambert(carpet), c.x, 0.02, c.z);
      rug.castShadow = false;
      scene.add(rug);
      // Paredes traseras y laterales (abiertas hacia el pasillo del lobby)
      const half = SECTION / 2;
      const back = box(SECTION, 1.3, 0.3, wallMat, c.x, 0.65, c.z + half);
      const left = box(0.3, 1.3, SECTION * 0.6, wallMat, c.x - half, 0.65, c.z + half * 0.4);
      const right = box(0.3, 1.3, SECTION * 0.6, wallMat, c.x + half, 0.65, c.z + half * 0.4);
      const stripe = box(SECTION, 0.1, 0.32, lambert(accent, accent), c.x, 1.32, c.z + half);
      [back, left, right].forEach(w => { scene.add(w); addCollider(w); });
      scene.add(stripe);

      // Escritorio, monitor y silla
      // El escritorio mira al pasillo: el bot se sienta detrás, de cara al jefe
      const deskZ = c.z - 0.6;
      const desk = box(2.6, 0.12, 1.1, lambert(0x6b4f35), c.x, 0.82, deskZ);
      const deskFront = box(2.6, 0.7, 0.08, lambert(0x5a412b), c.x, 0.45, deskZ - 0.5);
      const deskLegs = [[-1.2, -0.45], [1.2, -0.45], [-1.2, 0.45], [1.2, 0.45]].map(([dx, dz]) => box(0.1, 0.8, 0.1, lambert(0x3b2b1d), c.x + dx, 0.4, deskZ + dz));
      const monitor = box(1.1, 0.7, 0.08, lambert(0x0b0b0b), c.x - 0.3, 1.3, deskZ - 0.25);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.58), new THREE.MeshBasicMaterial({ color: accent.clone().lerp(new THREE.Color(0xffffff), 0.35) }));
      screen.position.set(c.x - 0.3, 1.3, deskZ - 0.2);
      const keyboard = box(0.7, 0.04, 0.25, lambert(0x222222), c.x, 0.9, deskZ + 0.25);
      const mug = box(0.14, 0.18, 0.14, lambert(accent), c.x + 0.9, 0.97, deskZ + 0.1);
      const chair = new THREE.Group();
      chair.add(box(0.6, 0.1, 0.6, lambert(0x111111), 0, 0.5, 0));
      chair.add(box(0.6, 0.7, 0.1, lambert(0x111111), 0, 0.9, 0.3));
      chair.add(box(0.08, 0.45, 0.08, lambert(0x444444), 0, 0.25, 0));
      chair.position.set(c.x, 0, c.z + 0.55);
      scene.add(desk, deskFront, ...deskLegs, monitor, screen, keyboard, mug, chair);
      addCollider(desk);

      // Planta y estantería
      const plant = new THREE.Group();
      plant.add(box(0.45, 0.45, 0.45, lambert(0x7c4a2d), 0, 0.22, 0));
      plant.add(box(0.6, 0.6, 0.6, lambert(0x2f8f3a), 0, 0.75, 0));
      plant.add(box(0.35, 0.35, 0.35, lambert(0x3fb34f), 0.05, 1.15, 0.05));
      plant.position.set(c.x + half - 0.8, 0, c.z + half - 0.8);
      scene.add(plant);
      const shelf = box(0.5, 1.4, 1.8, lambert(0x4a3626), c.x - half + 0.55, 0.7, c.z + 1.5);
      scene.add(shelf); addCollider(shelf);
      for (let b = 0; b < 4; b++) {
        scene.add(box(0.3, 0.32, 0.12, lambert(new THREE.Color().setHSL((hue + b * 0.17) % 1, 0.6, 0.45)), c.x - half + 0.55, 1.0 + (b % 2) * 0.38, c.z + 0.9 + b * 0.35));
      }

      // Bot
      const ch = buildCharacter(accent, agent.avatar_url || undefined, loader);
      const home = new THREE.Vector3(c.x, 0, c.z + 0.55);
      ch.group.position.copy(home);
      ch.group.userData.agentId = agent.id;
      ch.group.traverse(o => { o.userData.agentId = agent.id; });
      scene.add(ch.group);
      botMeshes.push(ch.group);
      bots.push({
        agent, ...ch, home, deskFacing: 0,
        bounds: { minX: c.x - half + 1.2, maxX: c.x + half - 1.2, minZ: c.z - half + 0.8, maxZ: c.z - 1.6 },
        state: 'work', timer: 3 + Math.random() * 8, target: home.clone(), path: [], side: Math.random() < 0.5 ? -1 : 1,
        center: c.clone(), phase: Math.random() * 10
      });
    });

    // --- Jefe (jugador) ---
    const player = buildCharacter(new THREE.Color(NEON), '/avatars/jefe.png', loader);
    player.group.position.set(0, 0, lobbyZ);
    scene.add(player.group);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 16), new THREE.MeshBasicMaterial({ color: NEON, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    player.group.add(ring);

    // Marcador de destino al hacer clic
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 12), new THREE.MeshBasicMaterial({ color: NEON, side: THREE.DoubleSide }));
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.04;
    marker.visible = false;
    scene.add(marker);

    // --- Etiquetas DOM (nombre + bocadillo) ---
    const labels = new Map<string, { root: HTMLDivElement; bubble: HTMLDivElement }>();
    labelsLayer.innerHTML = '';
    for (const b of bots) {
      const root = document.createElement('div');
      root.style.cssText = 'position:absolute;left:0;top:0;transform:translate(-50%,-100%);pointer-events:none;text-align:center;white-space:nowrap;';
      const bubble = document.createElement('div');
      bubble.style.cssText = 'display:none;max-width:220px;white-space:normal;margin-bottom:4px;padding:6px 8px;border-radius:8px;background:#0b0b0b;border:1px solid #CCFF00;color:#fff;font:600 10px/1.35 ui-monospace,monospace;box-shadow:0 0 12px #CCFF0033;';
      const name = document.createElement('div');
      name.textContent = `@${b.agent.nickname}`;
      name.style.cssText = 'display:inline-block;padding:2px 6px;border-radius:4px;background:#000c;color:#CCFF00;font:800 9px ui-monospace,monospace;letter-spacing:.05em;';
      root.append(bubble, name);
      labelsLayer.appendChild(root);
      labels.set(b.agent.id, { root, bubble });
    }

    // --- Entrada ---
    const keys = new Set<string>();
    let yaw = 0; // la cámara mira hacia las secciones (+z)
    let dist = 11;
    let moveTarget: THREE.Vector3 | null = null;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragging = false;
    let dragMoved = 0;
    let lastX = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e'].includes(k)) e.preventDefault();
      if (k === 'e' && nearbyRef.current) { setSelected(nearbyRef.current); return; }
      if (k === 'escape') { setSelected(null); return; }
      keys.add(k);
      moveTarget = null;
      marker.visible = false;
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());

    const setPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const onPointerDown = (e: PointerEvent) => { dragging = true; dragMoved = 0; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) {
        setPointer(e);
        raycaster.setFromCamera(pointer, camera);
        canvas.style.cursor = raycaster.intersectObjects(botMeshes, true).length ? 'pointer' : 'grab';
        return;
      }
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      dragMoved += Math.abs(dx);
      yaw -= dx * 0.008;
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      if (dragMoved > 6) return; // fue un arrastre de cámara
      setPointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hitBot = raycaster.intersectObjects(botMeshes, true)[0];
      if (hitBot) {
        const ag = agentes.find(a => a.id === hitBot.object.userData.agentId);
        if (ag) setSelected(ag);
        return;
      }
      const hitFloor = raycaster.intersectObject(floor)[0];
      if (hitFloor) {
        moveTarget = hitFloor.point.clone().setY(0);
        marker.position.set(moveTarget.x, 0.04, moveTarget.z);
        marker.visible = true;
        helpVisibleRef.current = false;
        setShowHelp(false);
      }
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); dist = THREE.MathUtils.clamp(dist + e.deltaY * 0.01, 5, 24); };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // --- Tamaño ---
    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(Math.ceil(w / PIXEL_SCALE), Math.ceil(h / PIXEL_SCALE), false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // --- Movimiento con colisiones simples ---
    const RADIUS = 0.35;
    const blocked = (x: number, z: number) => colliders.some(b => x > b.min.x - RADIUS && x < b.max.x + RADIUS && z > b.min.z - RADIUS && z < b.max.z + RADIUS);
    const tryMove = (obj: THREE.Object3D, dx: number, dz: number) => {
      const p = obj.position;
      if (!blocked(p.x + dx, p.z)) p.x += dx;
      if (!blocked(p.x, p.z + dz)) p.z += dz;
    };
    const walkAnim = (c: { armL: THREE.Object3D; armR: THREE.Object3D; legL: THREE.Object3D; legR: THREE.Object3D }, t: number, amount: number) => {
      const s = Math.sin(t * 10) * 0.7 * amount;
      c.legL.rotation.x = s; c.legR.rotation.x = -s;
      c.armL.rotation.x = -s; c.armR.rotation.x = s;
    };
    const faceTo = (obj: THREE.Object3D, tx: number, tz: number, k = 0.2) => {
      const target = Math.atan2(tx - obj.position.x, tz - obj.position.z);
      let d = target - obj.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      obj.rotation.y += d * k;
    };

    const clock = new THREE.Clock();
    const tmp = new THREE.Vector3();
    let raf = 0;
    let lastNearbyId: string | null = null;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

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
        dir.normalize().multiplyScalar(4.2 * dt);
        const before = player.group.position.clone();
        tryMove(player.group, dir.x, dir.z);
        faceTo(player.group, player.group.position.x + dir.x, player.group.position.z + dir.z, 0.3);
        if (moveTarget && before.distanceTo(player.group.position) < 0.001) { moveTarget = null; marker.visible = false; }
        if (helpVisibleRef.current) { helpVisibleRef.current = false; setShowHelp(false); }
      }
      walkAnim(player, t, moving ? 1 : 0);
      player.group.position.y = moving ? Math.abs(Math.sin(t * 10)) * 0.05 : 0;
      marker.rotation.z += dt * 2;

      // Bots
      let closest: Bot | null = null;
      let closestD = 3;
      for (const b of bots) {
        const g = b.group;
        const pd = g.position.distanceTo(player.group.position);
        if (pd < closestD) { closestD = pd; closest = b; }
        const isTyping = typingRef.current === b.agent.nickname;
        const isTalking = selectedRef.current?.id === b.agent.id;
        b.timer -= dt;

        // Rutas: para pasar entre la silla y la zona de delante se rodea el escritorio por un lateral
        const behindDesk = (v: THREE.Vector3) => v.z > b.center.z - 0.1;
        const sidePoint = () => new THREE.Vector3(b.center.x + b.side * 1.8, 0, b.center.z + 0.2);
        const planTo = (dest: THREE.Vector3) => {
          b.path = behindDesk(dest) !== behindDesk(g.position) ? [sidePoint(), dest.clone()] : [dest.clone()];
          b.target.copy(b.path[0]);
        };
        const goingHome = b.path.length > 0 && b.path[b.path.length - 1].distanceTo(b.home) < 0.01;
        if (isTyping) {
          if (b.state !== 'work' || (!goingHome && g.position.distanceTo(b.home) > 0.1)) { b.state = 'work'; planTo(b.home); }
        } else if (b.timer <= 0) {
          const r = Math.random();
          if (r < 0.45) { b.state = 'work'; planTo(b.home); b.timer = 6 + Math.random() * 10; }
          else if (r < 0.85) {
            b.state = 'walk';
            planTo(new THREE.Vector3(THREE.MathUtils.lerp(b.bounds.minX, b.bounds.maxX, Math.random()), 0, THREE.MathUtils.lerp(b.bounds.minZ, b.bounds.maxZ, Math.random())));
            b.timer = 6 + Math.random() * 5;
          } else { b.state = 'idle'; b.path = []; b.target.copy(g.position); b.timer = 2 + Math.random() * 3; }
        }
        // Avanzar al siguiente punto de la ruta
        if (b.path.length > 1 && g.position.distanceTo(b.path[0]) < 0.1) { b.path.shift(); b.target.copy(b.path[0]); }

        tmp.copy(b.target).sub(g.position).setY(0);
        const far = tmp.length() > 0.08;
        const speed = isTyping ? 3.2 : 1.4;
        if ((b.state === 'walk' || b.state === 'work') && far && !(isTalking && !isTyping)) {
          tmp.normalize().multiplyScalar(Math.min(speed * dt, tmp.length()));
          g.position.add(tmp);
          faceTo(g, g.position.x + tmp.x, g.position.z + tmp.z, 0.25);
          walkAnim(b, t + b.phase, 1);
          g.position.y = Math.abs(Math.sin((t + b.phase) * 10)) * 0.05;
        } else if (b.state === 'work' && !far && !isTalking) {
          // Sentado tecleando frente al monitor
          faceTo(g, g.position.x, g.position.z - 1, 0.2);
          g.position.y = -0.18;
          b.legL.rotation.x = b.legR.rotation.x = -1.35;
          const k = isTyping ? 22 : 9;
          b.armL.rotation.x = -1.1 + Math.sin((t + b.phase) * k) * 0.15;
          b.armR.rotation.x = -1.1 + Math.cos((t + b.phase) * k) * 0.15;
          b.head.rotation.x = Math.sin((t + b.phase) * 1.3) * 0.05;
        } else {
          // De pie: mira al jefe si está cerca o hablando con él, y saluda
          g.position.y = Math.sin((t + b.phase) * 2) * 0.02;
          b.legL.rotation.x = b.legR.rotation.x = 0;
          if (pd < 4 || isTalking) {
            faceTo(g, player.group.position.x, player.group.position.z, 0.15);
            b.armR.rotation.x = 0; b.armR.rotation.z = isTalking ? 0 : Math.PI * 0.85 + Math.sin(t * 8) * 0.25;
            b.armL.rotation.x = 0;
          } else {
            b.armR.rotation.z = 0;
            b.armL.rotation.x = b.armR.rotation.x = Math.sin((t + b.phase) * 2) * 0.05;
          }
        }
        if (b.state !== 'idle' || pd >= 4) b.armR.rotation.z *= 0.85;
        // Si el jefe se acerca a hablar, el bot se levanta y espera
        if (pd < 2.8 && b.state === 'work' && !isTyping && !far) { b.state = 'idle'; b.path = []; b.timer = 4; g.position.y = 0; b.armL.rotation.x = b.armR.rotation.x = 0; }
      }

      const nearId = closest?.agent.id ?? null;
      if (nearId !== lastNearbyId) {
        lastNearbyId = nearId;
        nearbyRef.current = closest?.agent ?? null;
        setNearby(closest?.agent ?? null);
      }

      // Cámara en tercera persona
      const p = player.group.position;
      camera.position.set(p.x - Math.sin(yaw) * dist, dist * 0.78 + 1.5, p.z - Math.cos(yaw) * dist);
      camera.lookAt(p.x, 1.1, p.z);

      // Etiquetas sobre los bots
      const rect = mount.getBoundingClientRect();
      const now = Date.now();
      for (const b of bots) {
        const lab = labels.get(b.agent.id)!;
        tmp.copy(b.group.position).setY(b.group.position.y + 2.05).project(camera);
        const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 && b.group.position.distanceTo(camera.position) < 34;
        lab.root.style.display = visible ? 'block' : 'none';
        if (!visible) continue;
        lab.root.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * rect.width}px, ${(-tmp.y * 0.5 + 0.5) * rect.height}px) translate(-50%, -100%)`;
        let bubbleText = '';
        if (typingRef.current === b.agent.nickname) bubbleText = '✍️ escribiendo...';
        else {
          const last = [...mensajesRef.current].reverse().find(m => m.remitente_tipo === 'agente' && m.remitente_id === b.agent.id);
          if (last && now - new Date(last.creado_en).getTime() < 120000) bubbleText = last.texto.replace(/[#*`_\[\]]/g, '').slice(0, 110) + (last.texto.length > 110 ? '…' : '');
        }
        if (lab.bubble.textContent !== bubbleText) lab.bubble.textContent = bubbleText;
        lab.bubble.style.display = bubbleText ? 'block' : 'none';
      }

      renderer.render(scene, camera);
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
        if (m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mat: any) => { mat.map?.dispose?.(); mat.dispose?.(); });
      });
      renderer.dispose();
      canvas.remove();
      labelsLayer.innerHTML = '';
    };
    // La escena se reconstruye solo si cambia la lista de agentes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey]);

  // Conversación con el agente seleccionado
  const conversation = useMemo(() => {
    if (!selected) return [];
    const nick = `@${selected.nickname}`.toLowerCase();
    return mensajes
      .filter(m => (m.remitente_tipo === 'agente' && m.remitente_id === selected.id) || (m.remitente_tipo === 'usuario' && m.texto.toLowerCase().includes(nick)))
      .slice(-12);
  }, [mensajes, selected]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conversation.length, typingNickname]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !draft.trim() || isSending) return;
    const text = draft.trim();
    setDraft('');
    await onSend(selected, text);
  };

  const selectedTyping = selected && typingNickname === selected.nickname;

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden bg-[#07070a] select-none">
      <div ref={mountRef} className="absolute inset-0" />
      <div ref={labelsRef} className="absolute inset-0 pointer-events-none overflow-hidden" />

      {/* Ayuda de controles */}
      {showHelp && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl bg-black/80 border border-[#CCFF00]/30 text-[10px] text-white/80 font-mono text-center pointer-events-none max-w-[92%]">
          <span className="text-[#CCFF00] font-black">OFICINA TJ FITLAB</span> · <b>WASD / flechas</b> o <b>clic en el suelo</b> para moverte · <b>arrastra</b> para girar · <b>rueda</b> zoom · <b>clic en un bot</b> o <b>E</b> para hablar
        </div>
      )}

      {/* Aviso de proximidad */}
      {nearby && !selected && (
        <button
          onClick={() => setSelected(nearby)}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-[#CCFF00] text-black text-[11px] font-black uppercase tracking-widest shadow-[0_0_20px_#CCFF0055]"
        >
          Hablar con @{nearby.nickname} <span className="opacity-60">(E)</span>
        </button>
      )}

      {/* Panel de conversación */}
      {selected && (
        <div className="absolute top-0 right-0 h-full w-full sm:w-[380px] bg-[#0a0a0a]/95 border-l border-white/10 flex flex-col backdrop-blur">
          <div className="p-4 border-b border-white/10 flex items-center gap-3">
            <img src={selected.avatar_url || '/avatars/programador.png'} alt="" className="w-11 h-11 rounded object-cover border border-[#CCFF00]/40" style={{ imageRendering: 'pixelated' }} />
            <div className="min-w-0 flex-1">
              <p className="text-[#CCFF00] font-black text-[13px] truncate">@{selected.nickname}</p>
              <p className="text-[9px] text-white/50 uppercase tracking-widest truncate">{selected.nombre} · {selected.rol}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-white/50 hover:text-white text-lg px-2" aria-label="Cerrar">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
            {conversation.length === 0 && !selectedTyping && (
              <p className="text-[11px] text-white/40 text-center mt-8">Pídele algo a @{selected.nickname}: puede buscar en internet, publicar en el foro, crear tareas o añadir leads.</p>
            )}
            {conversation.map(m => (
              <div key={m.id} className={`text-[11px] leading-relaxed whitespace-pre-wrap break-words rounded-lg p-3 ${m.remitente_tipo === 'agente' ? 'bg-white/5 border border-white/5 text-[#CCFF00]/90' : 'bg-[#CCFF00]/10 text-white/85 ml-6'}`}>
                {m.texto}
              </div>
            ))}
            {selectedTyping && <div className="text-[11px] text-white/50 animate-pulse">@{selected.nickname} está trabajando en ello…</div>}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={submit} className="p-3 border-t border-white/10 flex gap-2">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={`Escribe a @${selected.nickname}...`}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-[12px] text-white outline-none focus:border-[#CCFF00]/40"
              autoFocus
            />
            <button type="submit" disabled={isSending || !draft.trim()} className="px-4 rounded-lg bg-[#CCFF00] text-black text-[11px] font-black uppercase disabled:opacity-40">
              Enviar
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
