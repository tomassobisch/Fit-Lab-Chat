import { Resvg } from '@resvg/resvg-js';
import jpeg from 'jpeg-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Diseña las imágenes de los posts de Instagram con la marca TJ FitLab.
// GET /api/render?d=<spec base64url>&i=<n.º de diapositiva>
// spec = { f: 'post' | 'carrusel' | 'story', s: [{ t: título, x: texto }], k?: etiqueta }
// Devuelve JPEG (Instagram solo acepta JPEG para publicar).

export interface PostSpec { f: 'post' | 'carrusel' | 'story'; s: { t: string; x?: string }[]; k?: string; }

const NEON = '#CCFF00';
const HANDLE = '@tomassobisch.coach';

const assetsDir = join(process.cwd(), 'api', '_assets');
let cache: { fonts: string[]; logo: string } | null = null;
const assets = () => {
  if (!cache) {
    cache = {
      fonts: ['Anton-Regular.ttf', 'Poppins-Medium.ttf', 'Poppins-Bold.ttf'].map(f => join(assetsDir, f)),
      logo: 'data:image/png;base64,' + readFileSync(join(assetsDir, 'logo.png')).toString('base64')
    };
  }
  return cache;
};

export const decodeSpec = (d: string): PostSpec | null => {
  try {
    const spec = JSON.parse(Buffer.from(d, 'base64url').toString('utf8'));
    if (!spec || !['post', 'carrusel', 'story'].includes(spec.f) || !Array.isArray(spec.s) || !spec.s.length) return null;
    spec.s = spec.s.slice(0, 10).map((x: any) => ({ t: String(x?.t || '').slice(0, 90), x: String(x?.x || '').slice(0, 360) }));
    spec.k = spec.k ? String(spec.k).slice(0, 32) : undefined;
    return spec;
  } catch { return null; }
};
export const encodeSpec = (spec: PostSpec) => Buffer.from(JSON.stringify(spec), 'utf8').toString('base64url');

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Ajuste de línea aproximado según el ancho medio de los caracteres de cada fuente
function wrap(text: string, fontSize: number, maxWidth: number, charW: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  const fits = (s: string) => s.length * fontSize * charW <= maxWidth;
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (fits(next)) line = next;
    else { if (line) lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
  return lines;
}

function slideSvg(spec: PostSpec, i: number) {
  const W = 1080, H = spec.f === 'story' ? 1920 : 1350;
  const { logo } = assets();
  const slide = spec.s[Math.min(i, spec.s.length - 1)];
  const total = spec.s.length;
  const isCover = i === 0;
  const isLast = spec.f === 'carrusel' && i === total - 1 && total > 1;
  const pad = 90, maxW = W - pad * 2;
  const top = spec.f === 'story' ? 330 : 250;

  // Fondo: negro con retícula, anillo neón (como el logo) y circuito
  const grid: string[] = [];
  for (let x = 0; x <= W; x += 60) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#141414" stroke-width="2"/>`);
  for (let y = 0; y <= H; y += 60) grid.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#141414" stroke-width="2"/>`);
  const circuit = `
    <g stroke="${NEON}" stroke-width="4" fill="none" opacity="0.45">
      <path d="M ${W} 300 H ${W - 70} V 380 H ${W - 150}"/>
      <path d="M ${W} 340 H ${W - 40} V 440"/>
    </g>
    <g fill="${NEON}" opacity="0.6"><circle cx="${W - 150}" cy="380" r="9"/><circle cx="${W - 40}" cy="440" r="9"/></g>`;

  const parts: string[] = [];
  // Cabecera: logo + marca + contador
  parts.push(`<image href="${logo}" x="${pad}" y="${pad - 20}" width="110" height="110"/>`);
  parts.push(`<text x="${pad + 135}" y="${pad + 52}" font-family="Anton" font-size="46" fill="#ffffff" letter-spacing="2">TJ FITLAB</text>`);
  parts.push(`<text x="${pad + 137}" y="${pad + 86}" font-family="Poppins" font-weight="500" font-size="22" fill="#9ca3af" letter-spacing="3">ENTRENAMIENTO HÍBRIDO</text>`);
  if (spec.f === 'carrusel') {
    parts.push(`<rect x="${W - pad - 120}" y="${pad + 5}" width="120" height="56" rx="28" fill="none" stroke="${NEON}" stroke-width="4"/>`);
    parts.push(`<text x="${W - pad - 60}" y="${pad + 45}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="28" fill="${NEON}">${i + 1}/${total}</text>`);
  }

  let y = top + (isCover ? 120 : 60);
  // Etiqueta (kicker) en la portada
  if (isCover && spec.k) {
    const kw = Math.min(maxW, spec.k.length * 22 + 70);
    parts.push(`<rect x="${pad}" y="${y - 50}" width="${kw}" height="64" rx="8" fill="${NEON}"/>`);
    parts.push(`<text x="${pad + 35}" y="${y - 7}" font-family="Poppins" font-weight="700" font-size="30" fill="#000000" letter-spacing="1">${esc(spec.k.toUpperCase())}</text>`);
    y += 70;
  }
  // Número grande en diapositivas de contenido
  if (!isCover && !isLast) {
    parts.push(`<text x="${pad - 6}" y="${y + 150}" font-family="Anton" font-size="200" fill="none" stroke="${NEON}" stroke-width="4">${String(i).padStart(2, '0')}</text>`);
    y += 210;
  }

  // Título: Anton en mayúsculas, la última palabra en verde neón; se reduce hasta que todo quepa
  const titleText = (slide.t || '').toUpperCase();
  const bodySize = spec.f === 'story' ? 46 : 40;
  const bodyLines = slide.x ? wrap(slide.x, bodySize, maxW, 0.52, spec.f === 'story' ? 9 : isCover ? 4 : 6) : [];
  const bodyH = bodyLines.length ? (bodyLines.length - 1) * bodySize * 1.45 + bodySize : 0;
  const limitY = H - pad - 120;
  let size = isCover ? 150 : 110, lines = wrap(titleText, size, maxW, 0.42, 99);
  for (; size > 56; size -= 4) {
    lines = wrap(titleText, size, maxW - 70, 0.42, 99);
    const endY = y + size + (lines.length - 1) * size * 1.02 + 40 + 70 + bodyH;
    if (lines.length <= (isCover ? 5 : 4) && endY <= limitY) break;
  }
  lines.forEach((ln, li) => {
    const isLastLine = li === lines.length - 1;
    const words = ln.split(' ');
    const lastWord = isLastLine ? words.pop()! : null;
    const yy = y + size + li * size * 1.02;
    const head = words.join(' ');
    parts.push(`<text x="${pad}" y="${yy}" font-family="Anton" font-size="${size}" fill="#ffffff">${esc(head)}${lastWord ? `${head ? ' ' : ''}<tspan fill="${NEON}">${esc(lastWord)}</tspan>` : ''}</text>`);
  });
  y += size + (lines.length - 1) * size * 1.02 + 40;

  // Barra neón y texto
  parts.push(`<rect x="${pad}" y="${y}" width="140" height="10" fill="${NEON}"/>`);
  y += 70;
  if (bodyLines.length) {
    bodyLines.forEach((ln, li) => parts.push(`<text x="${pad}" y="${y + li * bodySize * 1.45}" font-family="Poppins" font-weight="500" font-size="${bodySize}" fill="#d1d5db">${esc(ln)}</text>`));
  }

  // Pie: llamada a la acción y usuario
  const footY = H - pad;
  const cta = spec.f === 'carrusel' ? (isLast ? 'GUARDA Y COMPARTE' : 'DESLIZA →') : spec.f === 'story' ? 'RESPONDE A ESTA HISTORIA' : 'GUÁRDALO Y COMPÁRTELO';
  parts.push(`<rect x="0" y="${footY - 70}" width="${W}" height="2" fill="#262626"/>`);
  parts.push(`<text x="${pad}" y="${footY}" font-family="Poppins" font-weight="700" font-size="30" fill="${NEON}" letter-spacing="2">${esc(cta)}</text>`);
  parts.push(`<text x="${W - pad}" y="${footY}" text-anchor="end" font-family="Poppins" font-weight="500" font-size="28" fill="#9ca3af">${HANDLE}</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#0a0a0a"/>
    ${grid.join('')}
    <circle cx="${W + 40}" cy="-40" r="330" fill="none" stroke="${NEON}" stroke-width="14" opacity="0.18"/>
    <circle cx="${W + 40}" cy="-40" r="290" fill="none" stroke="${NEON}" stroke-width="5" opacity="0.12"/>
    ${circuit}
    ${parts.join('\n')}
  </svg>`;
}

export function renderSlide(spec: PostSpec, i: number): Buffer {
  const svg = slideSvg(spec, i);
  const r = new Resvg(svg, { font: { fontFiles: assets().fonts, loadSystemFonts: false, defaultFontFamily: 'Poppins' } }).render();
  const encoded = jpeg.encode({ data: r.pixels, width: r.width, height: r.height }, 90);
  return Buffer.from(encoded.data);
}

export default function handler(req: any, res: any) {
  const spec = decodeSpec(String(req.query?.d || ''));
  if (!spec) return res.status(400).json({ error: 'Diseño inválido' });
  const i = Math.max(0, Math.min(Number(req.query?.i || 0) || 0, spec.s.length - 1));
  try {
    const img = renderSlide(spec, i);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).send(img);
  } catch (e: any) {
    return res.status(500).json({ error: 'No se pudo generar la imagen: ' + (e?.message || '') });
  }
}
