// Procedural chibi kemonomimi VRM 1.0 builder (runs in the browser, three r164)
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rr = (a, b) => lerp(a, b, rnd());

// ---------------------------------------------------------------- skeleton (T-pose, faces +Z, left = +X)
const BONES = [
  ['J_Hips', 'hips', null, [0, 0.26, 0]],
  ['J_Spine', 'spine', 'J_Hips', [0, 0.30, 0]],
  ['J_Chest', 'chest', 'J_Spine', [0, 0.36, 0]],
  ['J_Neck', 'neck', 'J_Chest', [0, 0.445, 0]],
  ['J_Head', 'head', 'J_Neck', [0, 0.475, 0]],
];
for (const [s, k] of [['L', 1], ['R', -1]]) {
  const side = s === 'L' ? 'left' : 'right';
  BONES.push(
    [`J_${s}_UpperArm`, side + 'UpperArm', 'J_Chest', [0.085 * k, 0.415, 0]],
    [`J_${s}_LowerArm`, side + 'LowerArm', `J_${s}_UpperArm`, [0.145 * k, 0.415, 0]],
    [`J_${s}_Hand`, side + 'Hand', `J_${s}_LowerArm`, [0.195 * k, 0.415, 0]],
    [`J_${s}_UpperLeg`, side + 'UpperLeg', 'J_Hips', [0.05 * k, 0.235, 0]],
    [`J_${s}_LowerLeg`, side + 'LowerLeg', `J_${s}_UpperLeg`, [0.05 * k, 0.14, 0]],
    [`J_${s}_Foot`, side + 'Foot', `J_${s}_LowerLeg`, [0.05 * k, 0.045, 0]],
    [`J_${s}_Toes`, side + 'Toes', `J_${s}_Foot`, [0.05 * k, 0.015, 0.04]],
  );
}
const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));

function autoW(v) {
  const ax = Math.abs(v.x), S = v.x >= 0 ? 'L' : 'R', out = [];
  const add = (b, w) => { if (w > 1e-4) out.push([b, w]); };
  if (ax > 0.07 && v.y > 0.34 && v.y < 0.49) {
    const a = sm(0.07, 0.1, ax), b = sm(0.13, 0.16, ax), c = sm(0.18, 0.2, ax);
    add('J_Chest', 1 - a); add(`J_${S}_UpperArm`, a * (1 - b)); add(`J_${S}_LowerArm`, a * b * (1 - c)); add(`J_${S}_Hand`, a * b * c);
    return out;
  }
  if (v.y > 0.47) return [['J_Head', 1]];
  if (v.y > 0.43) { const n = sm(0.44, 0.47, v.y); add('J_Chest', 1 - n); add('J_Neck', n); return out; }
  if (v.y > 0.255) {
    if (v.y > 0.32) { const c = sm(0.32, 0.36, v.y); add('J_Spine', 1 - c); add('J_Chest', c); return out; }
    const s = sm(0.265, 0.3, v.y); add('J_Hips', 1 - s); add('J_Spine', s); return out;
  }
  if (ax < 0.01) return [['J_Hips', 1]];
  const h = sm(0.205, 0.245, v.y), k = sm(0.115, 0.165, v.y), f = sm(0.035, 0.07, v.y);
  add('J_Hips', h); add(`J_${S}_UpperLeg`, (1 - h) * k); add(`J_${S}_LowerLeg`, (1 - h) * (1 - k) * f); add(`J_${S}_Foot`, (1 - h) * (1 - k) * (1 - f));
  return out;
}

// ---------------------------------------------------------------- geometry helpers
const HC = V(0, 0.635, 0), HR = V(0.165, 0.152, 0.148);
const SC = V(0, 0.645, -0.006), SR = V(HR.x * 1.085, HR.y * 1.085, HR.z * 1.085);
const onShell = (az, el, k = 1) => V(SC.x + SR.x * k * Math.cos(el) * Math.sin(az), SC.y + SR.y * k * Math.sin(el), SC.z + SR.z * k * Math.cos(el) * Math.cos(az));

function ellipsoid(c, r, seg = 24, rings = 16) { const g = new THREE.SphereGeometry(1, seg, rings); g.scale(r[0], r[1], r[2]); g.translate(c[0], c[1], c[2]); return g; }
function lathe(profile, sz = 1, seg = 32, cx = 0, cz = 0, phiStart = 0, phiLen = Math.PI * 2) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg, phiStart, phiLen);
  g.scale(1, 1, sz); g.translate(cx, 0, cz); return g;
}
function basis(g, pos, yAxis, zHint = V(0, 0, 1)) {
  const y = yAxis.clone().normalize(); const z = zHint.clone().sub(y.clone().multiplyScalar(zHint.dot(y))).normalize(); const x = new THREE.Vector3().crossVectors(y, z);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z).setPosition(pos)); return g;
}
function tube(a, b, r0, r1, seg = 20, open = false) {
  const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r1, r0, d.length(), seg, 3, open);
  g.translate(0, d.length() / 2, 0); return basis(g, a, d, Math.abs(d.z) > 0.9 ? V(1, 0, 0) : V(0, 0, 1));
}
function torus(c, R, r, axis = V(0, 1, 0), seg = 32) { const g = new THREE.TorusGeometry(R, r, 8, seg); g.rotateX(Math.PI / 2); return basis(g, c, axis); }
function extrudeShape(pts, depth) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
}
const defProf = s => s < 0.12 ? 0.72 + 0.28 * s / 0.12 : Math.pow(Math.max(0, (1 - s) / 0.88), 0.8);
// a tapered strand along a curve, split into colour bands: returns [{g, m}]
function strand(pts, o) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const N = o.seg || 14, R = o.radial || 6, prof = o.prof || defProf, rings = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N, p = curve.getPointAt(s), t = curve.getTangentAt(s).normalize();
    let n;
    if (o.up) n = o.up.clone(); else { const c = o.center || SC; n = p.clone().sub(V(c.x, Math.min(p.y, c.y), c.z)); }
    n.sub(t.clone().multiplyScalar(n.dot(t)));
    if (n.lengthSq() < 1e-8) n = V(0, 0, 1).sub(t.clone().multiplyScalar(t.z));
    n.normalize();
    const side = new THREE.Vector3().crossVectors(t, n).normalize();
    const f = i === N && o.closeTip !== false ? 0 : prof(s), ring = [];
    for (let k = 0; k < R; k++) {
      const a = (k / R) * Math.PI * 2;
      ring.push(p.clone().addScaledVector(side, Math.cos(a) * o.w * f).addScaledVector(n, Math.sin(a) * o.t * f));
    }
    rings.push({ ring, p, s });
  }
  const bands = o.bands || [[1, o.m]], out = [];
  let i0 = 0;
  for (const [sEnd, m] of bands) {
    let i1 = Math.round(sEnd * N); if (i1 <= i0) continue;
    const pos = [], idx = [];
    if (i0 === 0) { pos.push(...rings[0].p.toArray()); }
    const base = i0 === 0 ? 1 : 0;
    for (let i = i0; i <= i1; i++) for (const q of rings[i].ring) pos.push(q.x, q.y, q.z);
    if (i0 === 0) for (let k = 0; k < R; k++) idx.push(0, base + (k + 1) % R, base + k);
    for (let i = 0; i < i1 - i0; i++) for (let k = 0; k < R; k++) {
      const a = base + i * R + k, b = base + i * R + (k + 1) % R, c = a + R, d = b + R;
      idx.push(a, b, c, b, d, c);
    }
    if (i1 === N && o.closeTip === false) { const c = pos.length / 3; pos.push(...rings[N].p.toArray()); for (let k = 0; k < R; k++) idx.push(c, base + (i1 - i0) * R + k, base + (i1 - i0) * R + (k + 1) % R); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    out.push({ g, m }); i0 = i1;
  }
  return out;
}
// head-surface projection (face paint)
function headSurf(x, y, off) {
  const dx = x / HR.x, dy = (y - HC.y) / HR.y, q = Math.max(1e-4, 1 - dx * dx - dy * dy), z = HC.z + HR.z * Math.sqrt(q);
  const n = V(x / (HR.x * HR.x), (y - HC.y) / (HR.y * HR.y), (z - HC.z) / (HR.z * HR.z)).normalize();
  return V(x, y, z).addScaledVector(n, off);
}
const TARGETS = ['blink', 'blinkLeft', 'blinkRight', 'happy', 'angry', 'sad', 'relaxed', 'surprised', 'aa', 'ih', 'ou', 'ee', 'oh'];
const MORPH_MATS = new Set(['eye', 'eyeWhite']);
// fn(target, dx, dy) -> [dx, dy] (new offset from the decal centre) or null for no change
function decal(cx, cy, a, b, off, fn) {
  const R = 24, K = 4, pos = [], mor = fn ? TARGETS.map(() => []) : null, idx = [];
  const put = (x, y) => {
    const p = headSurf(x, y, off); pos.push(p.x, p.y, p.z);
    if (fn) TARGETS.forEach((t, ti) => { const r = fn(t, x - cx, y - cy); if (!r) { mor[ti].push(0, 0, 0); return; } const q = headSurf(cx + r[0], cy + r[1], off); mor[ti].push(q.x - p.x, q.y - p.y, q.z - p.z); });
  };
  put(cx, cy);
  for (let j = 1; j <= K; j++) for (let k = 0; k < R; k++) { const t = (k / R) * Math.PI * 2, r = j / K; put(cx + Math.cos(t) * a * r, cy + Math.sin(t) * b * r); }
  for (let k = 0; k < R; k++) idx.push(0, 1 + k, 1 + (k + 1) % R);
  for (let j = 0; j < K - 1; j++) for (let k = 0; k < R; k++) { const a0 = 1 + j * R + k, a1 = 1 + j * R + (k + 1) % R; idx.push(a0, a0 + R, a1, a1, a0 + R, a1 + R); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  if (fn) g.morphAttributes.position = mor.map(m => new THREE.Float32BufferAttribute(m, 3));
  return g;
}
const ER = 0.0265;
// eye shapes; ring = black rim (keeps a thin line), white collapses away when closed
function eyeFn(side, ring) {
  const keep = ring ? 0.13 : 0;
  const clip = (dx, dy, yl, k) => dy > yl ? [dx, yl + (dy - yl) * k] : [dx, dy];
  return (t, dx, dy) => {
    const closed = () => [dx, -0.3 * ER + dy * keep];
    switch (t) {
      case 'blink': return closed();
      case 'blinkLeft': return side > 0 ? closed() : null;
      case 'blinkRight': return side < 0 ? closed() : null;
      case 'happy': { const u = Math.max(-1, Math.min(1, dx / ER)); return [dx * 1.05, -0.25 * ER + 0.6 * ER * (1 - u * u) + dy * keep]; }
      case 'relaxed': return clip(dx, dy, 0.05 * ER, ring ? 0.12 : 0);
      case 'angry': return clip(dx, dy * 0.95, 0.2 * ER + 0.45 * side * dx, ring ? 0.12 : 0);
      case 'sad': { const r = clip(dx, dy, 0.25 * ER - 0.45 * side * dx, ring ? 0.12 : 0); return [r[0] * 0.95, r[1] - 0.12 * ER]; }
      case 'surprised': return [dx * 1.18, dy * 1.18 + 0.05 * ER];
      default: return null;
    }
  };
}
const MW = 0.012;
function mouthFn(t, dx, dy) {
  const u = Math.max(-1, Math.min(1, dx / MW)), q = u * u;
  switch (t) {
    case 'happy': return [dx * 1.25, dy * 1.3 + 0.009 * q - 0.004];
    case 'relaxed': return [dx * 1.1, dy + 0.005 * q - 0.0025];
    case 'sad': return [dx * 1.05, dy * 1.2 - 0.008 * q + 0.004];
    case 'angry': return [dx * 0.85, dy * 1.4 - 0.007 * q + 0.003];
    case 'surprised': return [dx * 0.5, dy * 3.3];
    case 'aa': return [dx * 0.95, dy * 6.5 - 0.004];
    case 'ih': return [dx * 1.25, dy * 2.6 - 0.001];
    case 'ou': return [dx * 0.45, dy * 3.2 - 0.002];
    case 'ee': return [dx * 1.15, dy * 3.8 - 0.002];
    case 'oh': return [dx * 0.7, dy * 5.2 - 0.003];
    default: return null;
  }
}
// lay a flat extruded shape onto the torso surface (front: dir=1, back: dir=-1)
function conform(g, prof, sz, dir = 1, lift = 0.003) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), R = profR(prof, y);
    const zs = sz * Math.sqrt(Math.max(0, R * R - x * x));
    p.setZ(i, dir * (zs + lift + z));
  }
  g.computeVertexNormals(); return g;
}
// a flat, finely divided quad (corners tl, tr, br, bl) to lay onto a curved surface with conform()
function quadStrip(c, n = 24) {
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) { const t = i / n; for (const [a, b] of [[c[0], c[3]], [c[1], c[2]]]) pos.push(lerp(a[0], b[0], t), lerp(a[1], b[1], t), 0); if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
function profR(prof, y) {
  for (let i = 0; i < prof.length - 1; i++) { const [r0, y0] = prof[i], [r1, y1] = prof[i + 1]; if ((y - y0) * (y - y1) <= 0 && y0 !== y1) return lerp(r0, r1, (y - y0) / (y1 - y0)); }
  return prof[0][0];
}

// ---------------------------------------------------------------- one character
function buildCharacter(C) {
  seed = C.seed || 7;
  const parts = [];
  const P = (g, m, w = 'auto') => { if (Array.isArray(g)) g.forEach(x => parts.push({ g: x.g, m: x.m, w: m || 'auto' })); else parts.push({ g, m, w }); };

  // head + face
  P(ellipsoid([HC.x, HC.y, HC.z], [HR.x, HR.y, HR.z], 36, 24), 'skin', 'head');
  for (const s of [-1, 1]) {
    P(decal(s * 0.068, HC.y + 0.01, ER, ER, 0.0022, eyeFn(s, true)), 'eye', 'head');
    P(decal(s * 0.068, HC.y + 0.01, 0.0205, 0.0205, 0.0032, eyeFn(s, false)), 'eyeWhite', 'head');
    P(decal(s * 0.088, HC.y - 0.044, 0.02, 0.012, 0.0016, null), 'cheek', 'head');
  }
  P(decal(0, HC.y - 0.052, MW, 0.0022, 0.0022, mouthFn), 'eye', 'head');
  P(tube(V(0, 0.43, -0.005), V(0, 0.5, -0.01), 0.032, 0.03, 16), 'skin', 'auto');

  // ---- hair
  const H = C.hair;
  { // shell
    const g = ellipsoid([SC.x, SC.y, SC.z], [SR.x, SR.y, SR.z], 40, 28).toNonIndexed(), p = g.attributes.position, keep = [], nk = [], nn = g.attributes.normal;
    for (let i = 0; i < p.count; i += 3) {
      let cx = 0, cy = 0, cz = 0; for (let j = 0; j < 3; j++) { cx += p.getX(i + j) / 3; cy += p.getY(i + j) / 3; cz += p.getZ(i + j) / 3; }
      const dx = (cx - SC.x) / SR.x, dy = (cy - SC.y) / SR.y, dz = (cz - SC.z) / SR.z;
      const cut = (dz > 0.12 && dy < 0.38) || (dy < -0.35 && dz > -0.55) || (dy < -0.7);
      if (!cut) for (let j = 0; j < 3; j++) { keep.push(p.getX(i + j), p.getY(i + j), p.getZ(i + j)); nk.push(nn.getX(i + j), nn.getY(i + j), nn.getZ(i + j)); }
    }
    const s = new THREE.BufferGeometry(); s.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3)); s.setAttribute('normal', new THREE.Float32BufferAttribute(nk, 3));
    P(s, 'hair', 'head');
    const n = ellipsoid([HC.x, HC.y, HC.z - 0.004], [HR.x * 1.025, HR.y * 1.025, HR.z * 1.025], 32, 24).toNonIndexed(), np = n.attributes.position, nk2 = [];
    for (let i = 0; i < np.count; i += 3) { let cz = 0, cy = 0; for (let j = 0; j < 3; j++) { cz += np.getZ(i + j) / 3; cy += np.getY(i + j) / 3; } if ((cz - HC.z) / HR.z < -0.1 && (cy - HC.y) / HR.y < 0.2) for (let j = 0; j < 3; j++) nk2.push(np.getX(i + j), np.getY(i + j), np.getZ(i + j)); }
    const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(nk2, 3)); ng.computeVertexNormals(); P(ng, 'hair', 'head');
  }
  const hs = (pts, w, t, extra = {}) => P(strand(pts, Object.assign({ w, t, m: 'hair', bands: H.tip ? [[H.tipAt || 0.78, 'hair'], [1, 'hairTip']] : null }, extra)), 'head');
  // bangs
  const nb = H.bangs || 7;
  for (let i = 0; i < nb; i++) {
    const u = (i / (nb - 1)) * 2 - 1, az = u * 0.95;
    const len = (H.bangLen || 0.05) + (Math.abs(u) < 0.2 ? -0.018 : 0) + rr(-0.008, 0.008) + Math.abs(u) * 0.02;
    const tx = Math.sin(az) * 0.145 + rr(-0.008, 0.008) - u * 0.012;
    const tip = headSurf(tx, HC.y + len, 0.016);
    hs([onShell(az * 0.8, 1.05, 1.0), onShell(az * 0.92, 0.62, 1.07), headSurf(tx * 0.98, HC.y + len + 0.045, 0.02), tip], 0.036, 0.01, { seg: 12 });
  }
  // side locks framing the face
  for (const s of [-1, 1]) for (const [az, end, w] of (H.locks || [[1.2, -0.13, 0.036], [1.38, -0.1, 0.04]])) {
    const r = onShell(s * az, 0.7, 1.0), m = onShell(s * az * 0.98, 0.0, 1.06), e = V(s * (0.15 + (H.lockOut || 0)), HC.y + end, 0.07 - az * 0.04);
    hs([r, m, e.clone().add(V(0, 0.04, 0.0)), e], w, 0.012, { seg: 12 });
  }
  // back / body of hair, per style
  const hang = (az, rootEl, pts, w, t) => hs([onShell(az, rootEl, 1.0), onShell(az, 0.15, 1.06), ...pts], w, t);
  const around = (n, a0, a1, f) => { for (let i = 0; i < n; i++) { const u = i / (n - 1), az = lerp(a0, a1, u); f(az, u); } };
  const radial = (az, r, y) => { const k = sm(HC.y - 0.1, HC.y - 0.2, y); return V(Math.sin(az) * r, y, SC.z + Math.cos(az) * r - 0.075 * k * Math.abs(Math.sin(az))); };
  if (H.style === 'long' || H.style === 'wild') {
    const wild = H.style === 'wild', bottom = H.bottom || 0.27;
    around(wild ? 15 : 13, 1.5, Math.PI * 2 - 1.5, (az, u) => {
      const side = Math.abs(Math.sin(az)), fl = (H.flare || 0.22) - side * 0.01 + rr(-0.015, 0.02) + (wild ? 0.025 : 0);
      const yb = bottom + rr(-0.03, 0.04) + side * 0.05;
      hang(az, rr(0.55, 0.9), [radial(az, 0.2, HC.y - 0.16), radial(az, fl * 0.95, lerp(HC.y - 0.16, yb, 0.6)), radial(az + rr(-0.06, 0.06), fl + 0.02, yb)], rr(0.07, 0.09), 0.02);
    });
    around(10, 1.3, Math.PI * 2 - 1.3, (az) => hang(az, 0.4, [radial(az, 0.17, HC.y - 0.2), radial(az, 0.16, bottom + 0.06)], 0.08, 0.02));
    if (wild) for (const sd of [-1, 1]) for (let j = 0; j < 3; j++) { const y0 = HC.y - 0.12 - j * 0.1; hs([V(sd * 0.17, y0 + 0.06, -0.06), V(sd * 0.2, y0 - 0.02, -0.07), V(sd * (0.25 + j * 0.01), y0 - 0.1, -0.075)], 0.05, 0.012, { seg: 8, up: V(0, 0, 1) }); }
  } else if (H.style === 'bob' || H.style === 'messy' || H.style === 'medium') {
    const end = H.style === 'medium' ? 0.42 : H.style === 'bob' ? HC.y - 0.13 : HC.y - 0.14;
    const n = H.style === 'messy' ? 18 : 15;
    around(n, 1.1, Math.PI * 2 - 1.1, (az) => {
      const flick = H.style === 'messy' ? rr(0.0, 0.05) : H.style === 'bob' ? -0.015 : 0.05;
      const yb = end + rr(-0.02, 0.02), r1 = H.style === 'medium' ? 0.19 : 0.185;
      hang(az, rr(0.5, 0.9), [radial(az, r1, lerp(HC.y - 0.08, yb, 0.4)), radial(az + rr(-0.12, 0.12), r1 + flick + 0.01, yb)], rr(0.07, 0.085), 0.02);
    });
    if (H.style === 'messy') for (let i = 0; i < 9; i++) { const az = rr(-2.6, 2.6), el = rr(0.5, 1.2); const r = onShell(az, el, 0.99); hs([r, onShell(az + rr(-0.2, 0.2), el - 0.25, 1.12), onShell(az + rr(-0.3, 0.3), el - 0.4, 1.22)], 0.05, 0.014, { seg: 8 }); }
    if (H.style === 'medium') around(9, 1.4, Math.PI * 2 - 1.4, (az) => hang(az, 0.35, [radial(az, 0.165, HC.y - 0.15), radial(az + 0.1, 0.2, 0.43), radial(az + 0.2, 0.235, 0.45)], 0.07, 0.018));
  }
  if (H.twin) for (const s of [-1, 1]) { // pigtails
    const a = V(s * 0.175, HC.y - 0.06, -0.04);
    P(ellipsoid([a.x, a.y, a.z], [0.022, 0.022, 0.022], 14, 10), 'accent', 'head');
    for (let j = 0; j < 3; j++) hs([a.clone().add(V(0, 0.01, 0)), a.clone().add(V(s * 0.04, -0.06, rr(-0.02, 0.02))), V(s * (0.21 + rr(0, 0.02)), 0.4 + j * 0.02, a.z + rr(-0.02, 0.02)), V(s * (0.235 + rr(0, 0.02)), 0.33 + rr(0, 0.03), a.z + rr(-0.03, 0.02))], 0.036, 0.034, { radial: 10, up: V(0, 0, 1), prof: s2 => Math.pow(Math.sin(Math.PI * Math.min(1, 0.15 + s2 * 0.85)), 0.7) });
  }
  // ahoge
  { const t = onShell(0.05, 1.45, 0.98); P(strand([t, t.clone().add(V(0.005, 0.05, 0.03)), t.clone().add(V(0.018, 0.085, 0.0)), t.clone().add(V(0.012, 0.075, -0.035))], { w: 0.014, t: 0.006, up: V(1, 0, 0.2), m: 'hair', seg: 14, prof: s => s < 0.1 ? 1 : Math.pow(1 - s, 0.7) }), 'head'); }

  // ---- ears
  const E = C.ears;
  const ES = C.earScale || 1.35;
  for (const s of [-1, 1]) {
    const i0 = parts.length; let EA = null;
    if (E === 'bear' || E === 'round') {
      const r = E === 'bear' ? 0.05 : 0.04, b = EA = onShell(s * 1.12, 0.68, 1.0), out = V(s * 0.6, 1, 0).normalize(), c = b.clone().addScaledVector(out, r * 0.55);
      P(basis(ellipsoid([0, 0, 0], [r, r, r * 0.5]), c, V(0, 1, 0), V(s * 0.25, 0, 1)), 'hair', 'head');
      P(basis(ellipsoid([0, 0, 0], [r * 0.55, r * 0.55, r * 0.22]), c.clone().add(V(0, 0.004, r * 0.36)), V(0, 1, 0), V(s * 0.25, 0, 1)), E === 'round' ? 'hairDark' : 'earIn', 'head');
    } else if (E === 'point') {
      const h = C.earH || 0.1, w = C.earW || 0.05, b = EA = onShell(s * 0.95, 0.85, 0.96), ax = V(s * (C.earTilt || 0.45), 1, 0.05).normalize();
      const cone = (hh, ww, dz, m) => { const g = new THREE.ConeGeometry(ww, hh, 4, 3); g.rotateY(Math.PI / 4); g.scale(1, 1, 0.42); g.translate(0, hh / 2, dz); P(basis(g, b, ax, V(0, 0, 1)), m, 'head'); };
      cone(h, w, 0, 'hair'); cone(h * 0.72, w * 0.62, w * 0.24, 'earIn');
      if (C.earTipM) { const g = new THREE.ConeGeometry(w * 0.33, h * 0.3, 4, 1); g.rotateY(Math.PI / 4); g.scale(1, 1, 0.45); g.translate(0, h * 0.86, 0.001); P(basis(g, b, ax, V(0, 0, 1)), C.earTipM, 'head'); }
    } else if (E === 'long') {
      const b = EA = onShell(s * 0.55, 1.05, 0.95), fold = s > 0 && C.earFold;
      const pts = fold ? [b, b.clone().add(V(s * 0.03, 0.1, -0.01)), b.clone().add(V(s * 0.06, 0.17, -0.02)), b.clone().add(V(s * 0.12, 0.17, 0.0)), b.clone().add(V(s * 0.16, 0.12, 0.01))]
        : [b, b.clone().add(V(s * 0.02, 0.09, -0.012)), b.clone().add(V(s * 0.04, 0.18, -0.03)), b.clone().add(V(s * 0.055, 0.23, -0.045))];
      const pr = s2 => Math.pow(Math.sin(Math.PI * Math.min(1, 0.2 + s2 * 0.8)), 0.55);
      P(strand(pts, { w: 0.036, t: 0.012, up: V(0, 0, 1), m: 'hair', seg: 14, radial: 10, prof: pr }), 'head');
      P(strand(pts.map(p => p.clone().add(V(0, 0, 0.009))), { w: 0.022, t: 0.006, up: V(0, 0, 1), m: 'earIn', seg: 14, radial: 10, prof: s2 => pr(s2) * (s2 < 0.12 ? 0 : 0.9) }), 'head');
    } else if (E === 'deer') {
      const b = EA = onShell(s * 1.42, 0.35, 1.0);
      const g = ellipsoid([0, 0, 0], [0.024, 0.055, 0.011]); g.translate(0, 0.05, 0); P(basis(g, b, V(s, 0.35, 0.15), V(0, 0, 1)), 'hair', 'head');
      const g2 = ellipsoid([0, 0, 0], [0.014, 0.04, 0.006]); g2.translate(0, 0.052, 0.008); P(basis(g2, b, V(s, 0.35, 0.15), V(0, 0, 1)), 'earIn', 'head');
    }
    if (EA) for (let k = i0; k < parts.length; k++) { const g = parts[k].g; g.translate(-EA.x, -EA.y, -EA.z); g.scale(ES, ES, ES); g.translate(EA.x, EA.y, EA.z); }
  }
  if (C.antlers) for (const s of [-1, 1]) {
    const b = onShell(s * 0.5, 1.12, 0.97), up = { up: V(0, 0, 1), m: 'antler', radial: 7, prof: s2 => 1 - 0.55 * s2 };
    const m1 = b.clone().add(V(s * 0.03, 0.06, -0.005)), m2 = b.clone().add(V(s * 0.06, 0.12, -0.01)), tip = b.clone().add(V(s * 0.06, 0.17, 0.0));
    P(strand([b, m1, m2, tip], Object.assign({ w: 0.012, t: 0.012 }, up)), 'head');
    P(strand([m1, m1.clone().add(V(s * 0.035, 0.02, 0.005)), m1.clone().add(V(s * 0.06, 0.05, 0.01))], Object.assign({ w: 0.009, t: 0.009 }, up)), 'head');
    P(strand([m2, m2.clone().add(V(-s * 0.02, 0.03, 0.004)), m2.clone().add(V(-s * 0.025, 0.06, 0.01))], Object.assign({ w: 0.008, t: 0.008 }, up)), 'head');
  }
  if (C.leaf) { // tanuki leaf
    const L = [[0, 0]]; for (let i = 1; i <= 10; i++) { const t = i / 10; L.push([Math.sin(Math.PI * t) * 0.03 * (1 - t * 0.3), t * 0.085]); } for (let i = 9; i >= 1; i--) { const t = i / 10; L.push([-Math.sin(Math.PI * t) * 0.03 * (1 - t * 0.3), t * 0.085]); }
    const g = extrudeShape(L, 0.004); g.translate(0, 0, -0.002); g.rotateX(-1.25); g.rotateZ(0.5); g.translate(-0.03, HC.y + SR.y * 1.02, 0.0); P(g, 'leaf', 'head');
    P(tube(V(-0.03, HC.y + SR.y * 1.0, 0.0), V(-0.04, HC.y + SR.y * 0.98, 0.02), 0.003, 0.003, 6), 'leafDark', 'head');
  }
  if (C.fawnSpots) for (const [x, y] of [[0.07, 0.11], [0.1, 0.08], [0.115, 0.115], [-0.09, 0.115]]) { const p = onShell(Math.asin(x / SR.x), Math.asin(y / SR.y), 1.01); P(ellipsoid([p.x, p.y, p.z], [0.008, 0.008, 0.008], 10, 8), 'spot', 'head'); }

  // ---- body & outfit
  const O = C.outfit;
  const torsoProf = O.torso || [[0.0, 0.25], [0.095, 0.25], [0.1, 0.3], [0.098, 0.36], [0.093, 0.41], [0.08, 0.44], [0.05, 0.455], [0.0, 0.46]];
  const TSZ = 0.72;
  P(lathe(torsoProf, TSZ, 36), 'top');
  const frontZ = (x, y, lift = 0) => TSZ * Math.sqrt(Math.max(0, profR(torsoProf, y) ** 2 - x * x)) + lift;
  // arms
  for (const s of [-1, 1]) {
    const sl = O.sleeve || { end: 0.18, r0: 0.036, r1: 0.032 };
    P(tube(V(s * 0.06, 0.415, 0), V(s * sl.end, 0.415, 0), sl.r0, sl.r1, 20), sl.m || 'top');
    if (sl.puff) P(ellipsoid([s * 0.095, 0.418, 0], [0.04, 0.045, 0.045], 18, 12), sl.m || 'top');
    if (sl.cuff) P(torus(V(s * (sl.end - 0.004), 0.415, 0), sl.r1 + 0.001, 0.006, V(1, 0, 0)), sl.cuff);
    if (sl.end < 0.2) P(tube(V(s * (sl.end - 0.01), 0.415, 0), V(s * 0.195, 0.415, 0), 0.022, 0.022, 12), 'skin');
    P(ellipsoid([s * 0.207, 0.413, 0.002], [0.026, 0.028, 0.024], 16, 12), 'skin');
  }
  // bottoms
  const B = O.bottom;
  if (B.type === 'shorts') {
    P(lathe([[0.0, 0.29], [0.096, 0.29], [0.104, 0.265], [0.106, 0.235], [0.0, 0.225]], 0.76, 36), B.m);
    for (const s of [-1, 1]) P(tube(V(s * 0.05, 0.245, 0), V(s * 0.052, B.len || 0.17, 0), 0.052, B.cuffR || 0.047, 20), B.m);
    if (B.cuff) for (const s of [-1, 1]) P(torus(V(s * 0.052, (B.len || 0.17) + 0.004, 0), (B.cuffR || 0.047), 0.006), B.cuff);
  } else if (B.type === 'skirt') {
    const top = B.top || 0.3, hem = B.hem || 0.18, rh = B.r || 0.14, g = lathe([[0.0, top + 0.02], [0.098, top + 0.02], [0.1, top], [rh, hem], [rh - 0.004, hem - 0.004], [0.0, hem - 0.004]], 0.8, 64);
    if (B.pleats) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(x, z), k = 1 + 0.06 * Math.abs(Math.cos(a * B.pleats)) * sm(top, hem, y); p.setX(i, x * k); p.setZ(i, z * k); } g.computeVertexNormals(); }
    P(g, B.m, 'hips');
    P(lathe([[0.0, 0.26], [0.1, 0.26], [0.1, 0.21], [0.0, 0.21]], 0.76, 24), B.under || 'top', 'hips');
    for (const s of [-1, 1]) P(tube(V(s * 0.05, 0.23, 0), V(s * 0.05, 0.17, 0), 0.03, 0.028, 12), 'skin');
  } else if (B.type === 'hakama') {
    P(lathe([[0.0, 0.33], [0.1, 0.33], [0.112, 0.27], [0.118, 0.235], [0.0, 0.225]], 0.78, 36), B.m);
    for (const s of [-1, 1]) {
      const g = tube(V(s * 0.05, 0.25, 0), V(s * 0.058, 0.145, 0), 0.056, 0.064, 24);
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) - s * 0.055, z = p.getZ(i), a = Math.atan2(x, z), k = 1 + 0.07 * Math.abs(Math.cos(a * 4)); p.setX(i, s * 0.055 + x * k); p.setZ(i, z * k); } g.computeVertexNormals();
      P(g, B.m);
    }
  }
  // legs, socks, shoes
  const L = O.legs;
  for (const s of [-1, 1]) {
    const x = s * 0.05;
    P(tube(V(x, 0.19, 0), V(x, 0.05, 0), 0.026, 0.025, 14), 'skin');
    const sockTop = L.sockTop || 0.11;
    if (L.sock) {
      if (L.stripes) { const n = 5, h = (sockTop - 0.045) / n; for (let i = 0; i < n; i++) P(tube(V(x, sockTop - i * h, 0), V(x, sockTop - (i + 1) * h, 0), 0.0295, 0.029, 14), i % 2 ? L.stripes : L.sock); }
      else P(tube(V(x, sockTop, 0), V(x, 0.045, 0), 0.0295, 0.029, 14), L.sock);
      P(torus(V(x, sockTop, 0), 0.03, L.frill ? 0.008 : 0.0055), L.sock);
    }
    if (L.boot) { P(tube(V(x, L.bootTop, 0), V(x, 0.04, 0.004), 0.034, 0.033, 16), L.boot); P(torus(V(x, L.bootTop, 0), 0.035, 0.006), L.bootCuff || L.boot); }
    const g = ellipsoid([0, 0, 0], [0.034, 0.03, 0.052], 20, 14), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.012) p.setY(i, -0.012);
    g.computeVertexNormals(); g.translate(x, 0.012 + 0.012, 0.012); P(g, L.shoe);
    if (L.strap) P(torus(V(x, 0.045, 0.02), 0.026, 0.004, V(0, 0.4, 1)), L.shoe);
  }
  // neckwear & outfit details
  const T = O.tie;
  if (T === 'tie') {
    const z0 = frontZ(0, 0.437, 0.006);
    P(ellipsoid([0, 0.436, z0], [0.014, 0.012, 0.008], 14, 10), 'tie', 'J_Chest');
    P(conform(extrudeShape([[-0.009, 0.43], [0.009, 0.43], [0.024, 0.345], [0, 0.318], [-0.024, 0.345]], 0.004), torsoProf, TSZ, 1, 0.006), 'tie');
    for (const s of [-1, 1]) P(conform(extrudeShape([[0, 0.452], [s * 0.04, 0.44], [s * 0.032, 0.415], [s * 0.006, 0.43]], 0.003), torsoProf, TSZ, 1, 0.002), 'top');
  }
  const bow = (c, sz, m, tails = true) => {
    for (const s of [-1, 1]) P(basis(ellipsoid([0, 0, 0], [sz * 0.55, sz * 1.1, sz * 0.4], 14, 10), c.clone().add(V(s * sz * 0.9, 0, 0)), V(-s * 0.9, 1, 0), V(0, 0, 1)), m, 'J_Chest');
    P(ellipsoid([c.x, c.y, c.z + 0.002], [sz * 0.4, sz * 0.4, sz * 0.38], 12, 8), m, 'J_Chest');
    if (tails) for (const s of [-1, 1]) P(strand([c.clone().add(V(s * 0.004, -0.005, 0.001)), c.clone().add(V(s * 0.016, -sz * 1.6, 0.006)), c.clone().add(V(s * 0.026, -sz * 3.0, 0.01))], { w: sz * 0.5, t: sz * 0.12, up: V(0, 0, 1), m, seg: 6, prof: s2 => s2 > 0.92 ? 0.6 : 0.8 + 0.2 * s2, closeTip: false }), 'J_Chest');
  };
  if (T === 'bow') bow(V(0, 0.437, frontZ(0, 0.437, 0.012)), O.bowSize || 0.022, 'tie');
  if (O.overall) { // bib + straps + buttons
    const top = 0.4;
    P(conform(extrudeShape([[-0.058, 0.3], [0.058, 0.3], [0.05, top], [-0.05, top]], 0.004), torsoProf, TSZ, 1, 0.002), 'bottom');
    P(lathe([[0, 0.31], [0.102, 0.31], [0.102, 0.29], [0, 0.29]], 0.76, 36), 'bottom');
    for (const s of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8, y = lerp(top - 0.004, 0.33, t) + Math.sin(Math.PI * t) * 0.115, x = s * 0.042; const z = t < 0.5 ? frontZ(x, Math.min(y, 0.44), 0.004) : -frontZ(x, Math.min(y, 0.44), 0.004); pts.push(V(x, y, lerp(z, 0, Math.sin(Math.PI * t) ** 4))); }
      pts[4].y = 0.452; pts[4].z = 0;
      P(strand(pts, { w: 0.01, t: 0.003, center: V(0, 0.38, 0), m: 'bottom', seg: 16, prof: () => 1, closeTip: false }), 'J_Chest');
      P(ellipsoid([s * 0.042, top - 0.012, frontZ(s * 0.042, top - 0.012, 0.009)], [0.007, 0.007, 0.004], 10, 8), 'accent', 'J_Chest');
    }
    P(conform(extrudeShape([[-0.022, 0.32], [0.022, 0.32], [0.022, 0.355], [-0.022, 0.355]], 0.003), torsoProf, TSZ, 1, 0.007), 'accent2');
  }
  if (O.sailor) { // collar flap on the back, V lapels in front, stripe
    P(conform(extrudeShape([[-0.08, 0.36], [0.08, 0.36], [0.075, 0.455], [-0.075, 0.455]], 0.003), torsoProf, TSZ, -1, 0.003), 'collar');
    P(conform(extrudeShape([[-0.076, 0.37], [0.076, 0.37], [0.072, 0.378], [-0.072, 0.378]], 0.002), torsoProf, TSZ, -1, 0.007), 'top');
    for (const s of [-1, 1]) P(conform(extrudeShape([[s * 0.075, 0.452], [s * 0.05, 0.452], [0, 0.37], [s * 0.01, 0.355]], 0.003), torsoProf, TSZ, 1, 0.003), 'collar');
  }
  if (O.kimono) { // crossed collar, obi, cord
    for (const [s, l] of [[1, 0.003], [-1, 0.006]]) P(conform(extrudeShape([[s * 0.05, 0.456], [s * 0.034, 0.456], [-s * 0.034, 0.31], [-s * 0.05, 0.31]], 0.003), torsoProf, TSZ, 1, l), 'trim');
    P(lathe([[0, 0.345], [profR(torsoProf, 0.345) + 0.006, 0.345], [profR(torsoProf, 0.3) + 0.006, 0.3], [0, 0.3]], TSZ + 0.01, 36), 'tie');
    P(torus(V(0, 0.322, 0), 0.105, 0.0035, V(0, 1, 0)), 'accent');
    P(ellipsoid([0.04, 0.322, frontZ(0.04, 0.322, 0.012)], [0.012, 0.009, 0.006], 10, 8), 'accent', 'J_Spine');
  }
  if (O.sweater) { // turtleneck + ribbed hem + cable lines
    P(torus(V(0, 0.448, -0.002), 0.045, 0.016), 'top', 'J_Neck');
    for (let i = 0; i < 2; i++) P(torus(V(0, 0.258 + i * 0.012, 0), 0.105, 0.008), 'top');
    for (const x of [-0.04, 0, 0.04]) P(conform(extrudeShape([[x - 0.004, 0.27], [x + 0.004, 0.27], [x + 0.004, 0.43], [x - 0.004, 0.43]], 0.003), torsoProf, TSZ, 1, 0.0), 'topDark');
  }
  if (O.scarf) {
    P(torus(V(0, 0.448, -0.003), 0.05, 0.02), 'tie', 'J_Neck');
    for (const [x, len, ph] of [[0.04, 0.12, 0.0], [0.065, 0.09, 0.02]]) { const a = V(x, 0.44, frontZ(x, 0.44, 0.02)); P(strand([a, a.clone().add(V(0.01, -len * 0.5, 0.012)), a.clone().add(V(0.014 + ph, -len, 0.008))], { w: 0.02, t: 0.006, up: V(0, 0, 1), m: 'tie', seg: 8, prof: s => s > 0.9 ? 0.7 : 1, closeTip: false }), 'J_Chest'); }
  }
  if (O.cape) {
    P(lathe([[0.05, 0.47], [0.09, 0.455], [0.125, 0.42], [0.145, 0.36], [0.16, 0.31]], 0.85, 40, 0, -0.005, 0.55, Math.PI * 2 - 1.1), 'cape', 'J_Chest');
    P(lathe([[0.05, 0.47], [0.088, 0.452], [0.122, 0.418], [0.14, 0.36], [0.155, 0.312]], 0.82, 40, 0, -0.005, 0.55, Math.PI * 2 - 1.1), 'capeIn', 'J_Chest');
    P(basis(ellipsoid([0, 0, 0], [0.085, 0.04, 0.05], 20, 12), V(0, 0.47, -0.075), V(0, 1, -0.3), V(0, 0, 1)), 'cape', 'J_Chest');
    for (const s of [-1, 1]) P(ellipsoid([s * 0.03, 0.43, frontZ(s * 0.03, 0.43, 0.01)], [0.006, 0.006, 0.004], 8, 6), 'accent', 'J_Chest');
  }
  if (O.pinafore) { // bib + straps over shoulders
    P(conform(extrudeShape([[-0.06, 0.3], [0.06, 0.3], [0.05, 0.395], [-0.05, 0.395]], 0.004), torsoProf, TSZ, 1, 0.002), 'bottom');
    P(conform(extrudeShape([[-0.06, 0.3], [0.06, 0.3], [0.05, 0.395], [-0.05, 0.395]], 0.004), torsoProf, TSZ, -1, 0.002), 'bottom');
    for (const s of [-1, 1]) P(torus(V(s * 0.05, 0.4, 0), 0.075, 0.006, V(1, 0, 0)), 'bottom', 'J_Chest');
    P(conform(extrudeShape([[-0.02, 0.32], [0.02, 0.32], [0.02, 0.345], [-0.02, 0.345]], 0.002), torsoProf, TSZ, 1, 0.007), 'accent2');
  }
  if (O.buttons) for (const y of [0.33, 0.37, 0.41]) P(ellipsoid([0, y, frontZ(0, y, 0.004)], [0.006, 0.006, 0.003], 8, 6), 'accent', 'J_Chest');

  // ---- tail
  const TL = C.tail, tb = V(0, 0.255, -0.065);
  if (TL === 'fluff') P(strand([tb, tb.clone().add(V(0.03, -0.06, -0.07)), tb.clone().add(V(0.11, -0.06, -0.11)), tb.clone().add(V(0.17, 0.02, -0.1))], { w: C.tailW || 0.055, t: C.tailW || 0.055, radial: 12, seg: 18, up: V(1, 0, 0), m: 'hair', bands: C.tailTip ? [[0.72, 'hair'], [1, C.tailTip]] : null, prof: s => Math.pow(Math.sin(Math.PI * Math.min(1, 0.1 + s * 0.88)), 0.6) }), 'J_Hips');
  if (TL === 'stripe') { const b = []; for (let i = 1; i <= 6; i++) b.push([i / 6, i % 2 ? 'hair' : 'hairDark']); P(strand([tb, tb.clone().add(V(0, -0.03, -0.06)), tb.clone().add(V(0.02, -0.02, -0.12)), tb.clone().add(V(0.03, 0.03, -0.16))], { w: 0.05, t: 0.05, radial: 12, seg: 18, up: V(1, 0, 0), m: 'hair', bands: b, prof: s => Math.pow(Math.sin(Math.PI * Math.min(1, 0.1 + s * 0.86)), 0.5) }), 'J_Hips'); }
  if (TL === 'thin') P(strand([tb, tb.clone().add(V(0, -0.02, -0.06)), tb.clone().add(V(0.05, 0.03, -0.1)), tb.clone().add(V(0.03, 0.12, -0.11)), tb.clone().add(V(-0.02, 0.15, -0.09))], { w: 0.014, t: 0.014, radial: 8, seg: 22, up: V(1, 0, 0), m: 'hair', prof: s => s > 0.9 ? Math.sqrt((1 - s) / 0.1) : 1 }), 'J_Hips');
  if (TL === 'puff') P(ellipsoid([tb.x, tb.y + (C.tailUp || 0), tb.z - 0.02], [0.035, 0.035, 0.03], 14, 10), C.tailM || 'hair', 'J_Hips');

  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.15, -0.02, 0, 1.15, -0.02, 0, 1.15, -0.02], 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); P(g, 'hair', 'head'); }
  return { root: assemble(C, parts, BONES, autoW), BL: BONES };
}
function assemble(C, parts, BONES, autoW, skirtW) {
  const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
  const root = new THREE.Group(); root.name = C.id;
  const bones = {};
  for (const [n, , par, pos] of BONES) { const b = new THREE.Bone(); b.name = n; bones[n] = b; const pp = par ? BONES[BI[par]][3] : [0, 0, 0]; b.position.set(pos[0] - pp[0], pos[1] - pp[1], pos[2] - pp[2]); if (par) bones[par].add(b); }
  root.add(bones.J_Hips); root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(BONES.map(b => bones[b[0]]));
  const groups = {};
  for (const pt of parts) {
    let g = pt.g.index ? pt.g.toNonIndexed() : pt.g;
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const p = g.attributes.position, si = new Uint16Array(p.count * 4), sw = new Float32Array(p.count * 4), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      let w = pt.w === 'auto' ? autoW(v) : pt.w === 'skirt' ? skirtW(v) : pt.w === 'head' ? [['J_Head', 1]] : pt.w === 'hips' ? [['J_Hips', 1]] : [[pt.w, 1]];
      w = w.sort((a, b) => b[1] - a[1]).slice(0, 4); const tot = w.reduce((a, b) => a + b[1], 0);
      w.forEach(([b, x], j) => { si[i * 4 + j] = BI[b]; sw[i * 4 + j] = x / tot; });
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    if (MORPH_MATS.has(pt.m)) { if (!g.morphAttributes.position) g.morphAttributes.position = TARGETS.map(() => new THREE.Float32BufferAttribute(new Float32Array(p.count * 3), 3)); g.morphTargetsRelative = true; }
    else g.morphAttributes = {};
    (groups[pt.m] = groups[pt.m] || []).push(g);
  }
  const meshes = [];
  for (const [m, gs] of Object.entries(groups)) {
    let g = mergeGeometries(gs, false); if (!g) throw new Error('merge failed ' + m); for (const k in g.morphAttributes) if (!g.morphAttributes[k].length) delete g.morphAttributes[k]; if (!Object.keys(g.morphAttributes).length) g = mergeVertices(g, 1e-5);
    g.computeBoundingBox(); g.computeBoundingSphere();
    const col = C.colors[m]; if (col === undefined) throw new Error('no colour for ' + m);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(col), roughness: 1, metalness: 0, side: THREE.DoubleSide, name: m });
    const mesh = new THREE.SkinnedMesh(g, mat); mesh.name = 'Mesh_' + m;
    if (MORPH_MATS.has(m)) { g.morphTargetsRelative = true; g.morphAttributes.position.forEach((a, i) => a.name = TARGETS[i][0].toUpperCase() + TARGETS[i].slice(1)); mesh.updateMorphTargets(); }
    mesh.bind(skeleton, new THREE.Matrix4()); root.add(mesh); meshes.push(mesh);
  }
  return root;
}

// ---------------------------------------------------------------- export + VRM 1.0 extensions
function shade(hex, m) {
  const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl);
  if (m === 'skin' || m === 'cheek') return new THREE.Color('#f2c3bb');
  const s = new THREE.Color().setHSL(hsl.l > 0.85 ? 0.68 : hsl.h, hsl.l > 0.85 ? 0.18 : Math.min(1, hsl.s * 1.05), hsl.l * (hsl.l > 0.85 ? 0.86 : 0.74));
  return s;
}
export async function exportVRM(C) {
  const { root, BL } = C.lady ? buildLady(C) : buildCharacter(C);
  const scene = new THREE.Scene(); scene.add(root);
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
  const dv = new DataView(glb), jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLen)));
  const binStart = 20 + jsonLen, binLen = dv.getUint32(binStart, true), bin = new Uint8Array(glb, binStart + 8, binLen);
  const nodeIdx = n => json.nodes.findIndex(x => x.name === n);
  const humanBones = {}; for (const [n, h] of BL) humanBones[h] = { node: nodeIdx(n) };
  // MToon materials
  json.materials.forEach(m => {
    const col = C.colors[m.name], sc = (C.shades && C.shades[m.name]) ? new THREE.Color(C.shades[m.name]) : shade(col, m.name), lin = new THREE.Color(col), sh = sc.clone();
    m.pbrMetallicRoughness = { baseColorFactor: [lin.r, lin.g, lin.b, 1], metallicFactor: 0, roughnessFactor: 1 };
    m.doubleSided = true;
    m.extensions = { VRMC_materials_mtoon: { specVersion: '1.0', transparentWithZWrite: false, renderQueueOffsetNumber: 0, shadeColorFactor: [sh.r, sh.g, sh.b], shadingShiftFactor: m.name === 'eye' || m.name === 'eyeWhite' || m.name === 'cheek' ? -1 : -0.05, shadingToonyFactor: 0.92, giEqualizationFactor: 0.9, matcapFactor: [0, 0, 0], parametricRimColorFactor: [0.12, 0.12, 0.14], parametricRimFresnelPowerFactor: 4, parametricRimLiftFactor: 0, rimLightingMixFactor: 1, outlineWidthMode: 'none', outlineWidthFactor: 0, outlineColorFactor: [0, 0, 0], outlineLightingMixFactor: 1, uvAnimationScrollXSpeedFactor: 0, uvAnimationScrollYSpeedFactor: 0, uvAnimationRotationSpeedFactor: 0 } };
  });
  // blink expression
  const faceNodes = C.lady ? [] : json.nodes.map((n, i) => n.name === 'Mesh_eye' || n.name === 'Mesh_eyeWhite' ? i : -1).filter(i => i >= 0);
  const preset = {};
  if (faceNodes.length) TARGETS.forEach((t, ti) => { const emo = ['happy', 'angry', 'sad', 'relaxed', 'surprised'].includes(t); preset[t] = { morphTargetBinds: faceNodes.map(node => ({ node, index: ti, weight: 1 })), isBinary: false, overrideBlink: emo ? 'block' : 'none', overrideLookAt: 'none', overrideMouth: emo ? 'block' : 'none' }; });
  const headNode = nodeIdx('J_Head');
  json.extensionsUsed = [...new Set([...(json.extensionsUsed || []), 'VRMC_vrm', 'VRMC_materials_mtoon'])];
  json.extensions = Object.assign(json.extensions || {}, {
    VRMC_vrm: {
      specVersion: '1.0',
      meta: { name: C.name, version: '1.0', authors: ['Drig (VidyahGamu)'], licenseUrl: 'https://vrm.dev/licenses/1.0/', avatarPermission: 'onlyAuthor', allowExcessivelyViolentUsage: false, allowExcessivelySexualUsage: false, commercialUsage: 'personalNonProfit', allowPoliticalOrReligiousUsage: false, allowAntisocialOrHateUsage: false, creditNotation: 'required', allowRedistribution: false, modification: 'allowModification' },
      humanoid: { humanBones },
      firstPerson: { meshAnnotations: [] },
      lookAt: { type: 'expression', offsetFromHeadBone: C.lookOffset || [0, 0.16, 0.1], rangeMapHorizontalInner: { inputMaxValue: 90, outputScale: 1 }, rangeMapHorizontalOuter: { inputMaxValue: 90, outputScale: 1 }, rangeMapVerticalDown: { inputMaxValue: 90, outputScale: 1 }, rangeMapVerticalUp: { inputMaxValue: 90, outputScale: 1 } },
      expressions: { preset },
    },
  });
  // repack GLB
  let js = new TextEncoder().encode(JSON.stringify(json)); const pad = (4 - js.length % 4) % 4;
  const jsonChunk = new Uint8Array(js.length + pad); jsonChunk.set(js); jsonChunk.fill(0x20, js.length);
  const total = 12 + 8 + jsonChunk.length + 8 + bin.length, out = new ArrayBuffer(total), o = new DataView(out), u8 = new Uint8Array(out);
  o.setUint32(0, 0x46546c67, true); o.setUint32(4, 2, true); o.setUint32(8, total, true);
  o.setUint32(12, jsonChunk.length, true); o.setUint32(16, 0x4e4f534a, true); u8.set(jsonChunk, 20);
  const b0 = 20 + jsonChunk.length; o.setUint32(b0, bin.length, true); o.setUint32(b0 + 4, 0x004e4942, true); u8.set(bin, b0 + 8);
  return out;
}

// ================================================================ the shrine lady: anime proportions, miko + kitsune mask
const LBONES = [
  ['J_Hips', 'hips', null, [0, 0.92, 0]],
  ['J_Spine', 'spine', 'J_Hips', [0, 1.0, 0]],
  ['J_Chest', 'chest', 'J_Spine', [0, 1.14, 0]],
  ['J_Neck', 'neck', 'J_Chest', [0, 1.33, 0]],
  ['J_Head', 'head', 'J_Neck', [0, 1.42, 0]],
];
for (const [s, k] of [['L', 1], ['R', -1]]) {
  const side = s === 'L' ? 'left' : 'right';
  LBONES.push(
    [`J_${s}_UpperArm`, side + 'UpperArm', 'J_Chest', [0.16 * k, 1.3, 0]],
    [`J_${s}_LowerArm`, side + 'LowerArm', `J_${s}_UpperArm`, [0.41 * k, 1.3, 0]],
    [`J_${s}_Hand`, side + 'Hand', `J_${s}_LowerArm`, [0.63 * k, 1.3, 0]],
    [`J_${s}_UpperLeg`, side + 'UpperLeg', 'J_Hips', [0.09 * k, 0.87, 0]],
    [`J_${s}_LowerLeg`, side + 'LowerLeg', `J_${s}_UpperLeg`, [0.09 * k, 0.48, 0]],
    [`J_${s}_Foot`, side + 'Foot', `J_${s}_LowerLeg`, [0.09 * k, 0.08, 0]],
    [`J_${s}_Toes`, side + 'Toes', `J_${s}_Foot`, [0.09 * k, 0.02, 0.1]],
  );
}
function ladyW(v) {
  const ax = Math.abs(v.x), S = v.x >= 0 ? 'L' : 'R', out = [];
  const add = (b, w) => { if (w > 1e-4) out.push([b, w]); };
  if (ax > 0.13 && v.y > 1.1 && v.y < 1.5) {
    const a = sm(0.13, 0.21, ax), b = sm(0.38, 0.44, ax), c = sm(0.6, 0.64, ax);
    add('J_Chest', 1 - a); add(`J_${S}_UpperArm`, a * (1 - b)); add(`J_${S}_LowerArm`, a * b * (1 - c)); add(`J_${S}_Hand`, a * b * c); return out;
  }
  if (v.y > 1.43) return [['J_Head', 1]];
  if (v.y > 1.3) { const n = sm(1.31, 1.4, v.y); add('J_Chest', 1 - n); add('J_Neck', n); return out; }
  if (v.y > 1.05) { const c = sm(1.05, 1.15, v.y); add('J_Spine', 1 - c); add('J_Chest', c); return out; }
  if (v.y > 0.88) { const sp = sm(0.92, 1.02, v.y); add('J_Hips', 1 - sp); add('J_Spine', sp); return out; }
  if (ax < 0.02) return [['J_Hips', 1]];
  const h = sm(0.8, 0.9, v.y), k = sm(0.42, 0.54, v.y), f = sm(0.06, 0.12, v.y);
  add('J_Hips', h); add(`J_${S}_UpperLeg`, (1 - h) * k); add(`J_${S}_LowerLeg`, (1 - h) * (1 - k) * f); add(`J_${S}_Foot`, (1 - h) * (1 - k) * (1 - f));
  return out;
}
// skirt weights: hips at the waist, sharing the two legs further down so walking doesn't poke through
function skirtW(v) {
  const lw = sm(0.95, 0.35, v.y) * 0.85, u = Math.max(-1, Math.min(1, v.x / 0.12));
  return [['J_Hips', 1 - lw], ['J_L_UpperLeg', lw * (0.5 + 0.5 * u)], ['J_R_UpperLeg', lw * (0.5 - 0.5 * u)]].filter(w => w[1] > 1e-4);
}
// point on the front of an ellipsoid at (x, y), pushed out along the normal
function surfE(E, x, y, off) {
  const dx = (x - E.c.x) / E.r.x, dy = (y - E.c.y) / E.r.y, q = Math.max(1e-4, 1 - dx * dx - dy * dy), z = E.c.z + E.r.z * Math.sqrt(q);
  const n = V((x - E.c.x) / (E.r.x * E.r.x), (y - E.c.y) / (E.r.y * E.r.y), (z - E.c.z) / (E.r.z * E.r.z)).normalize();
  return V(x, y, z).addScaledVector(n, off);
}
function blobOn(E, cx, cy, a, b, rot, off) {
  const R = 18, pos = [], idx = [], ca = Math.cos(rot), sa = Math.sin(rot);
  const put = (x, y) => { const p = surfE(E, cx + x * ca - y * sa, cy + x * sa + y * ca, off); pos.push(p.x, p.y, p.z); };
  put(0, 0); for (let k = 0; k < R; k++) { const t = k / R * Math.PI * 2; put(Math.cos(t) * a, Math.sin(t) * b); }
  for (let k = 0; k < R; k++) idx.push(0, 1 + k, 1 + (k + 1) % R);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function strokeOn(E, pts, w, off, taper = true) {
  const pos = [], idx = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    const t = i / (n - 1), ww = w * (taper ? Math.max(0.25, Math.sin(Math.PI * (0.15 + 0.7 * t))) : 1) / 2;
    for (const sd of [-1, 1]) { const p = surfE(E, pts[i][0] - ty / l * ww * sd, pts[i][1] + tx / l * ww * sd, off); pos.push(p.x, p.y, p.z); }
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const curve = (f, x0, x1, n = 14) => { const o = []; for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n); o.push([x, f(x)]); } return o; };

function buildLady(C) {
  seed = C.seed || 5;
  const parts = [];
  const P = (g, m, w = 'auto') => { if (Array.isArray(g)) g.forEach(x => parts.push({ g: x.g, m: x.m, w: m || 'auto' })); else parts.push({ g, m, w }); };
  const H = V(0, 1.515, 0), HRr = V(0.086, 0.106, 0.096);
  // head + neck + hands
  P(ellipsoid([H.x, H.y, H.z], [HRr.x, HRr.y, HRr.z], 32, 24), 'skin', 'head');
  P(tube(V(0, 1.3, -0.005), V(0, 1.46, -0.01), 0.034, 0.032, 16), 'skin');
  for (const s of [-1, 1]) { const g = ellipsoid([0, 0, 0], [0.045, 0.022, 0.035], 16, 12); g.translate(s * 0.665, 1.295, 0.004); P(g, 'skin'); P(tube(V(s * 0.62, 1.297, 0.002), V(s * 0.70, 1.297, 0.012), 0.009, 0.007, 8), 'skin'); }

  // ---- kitsune mask
  const ME = { c: V(0, 1.505, 0.035), r: V(0.084, 0.104, 0.074) };
  {
    const g = ellipsoid([ME.c.x, ME.c.y, ME.c.z], [ME.r.x, ME.r.y, ME.r.z], 36, 28).toNonIndexed(), p = g.attributes.position, nn = g.attributes.normal, keep = [], nk = [];
    for (let i = 0; i < p.count; i += 3) { let cz = 0; for (let j = 0; j < 3; j++) cz += (p.getZ(i + j) - ME.c.z) / ME.r.z / 3; if (cz > 0.05) for (let j = 0; j < 3; j++) { keep.push(p.getX(i + j), p.getY(i + j), p.getZ(i + j)); nk.push(nn.getX(i + j), nn.getY(i + j), nn.getZ(i + j)); } }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nk, 3)); P(m, 'mask', 'head');
  }
  const SN = { c: V(0, 1.468, 0.095), r: V(0.03, 0.026, 0.035) }; // snout
  P(ellipsoid([SN.c.x, SN.c.y, SN.c.z], [SN.r.x, SN.r.y, SN.r.z], 20, 14), 'mask', 'head');
  P(blobOn(SN, 0, SN.c.y + 0.006, 0.009, 0.006, 0, 0.001), 'maskInk', 'head'); // nose
  for (const s of [-1, 1]) {
    // eyes: closed, curved lids with a little lash flick
    P(strokeOn(ME, curve(x => 1.52 - 120 * (x - s * 0.034) ** 2, s * 0.012, s * 0.056), 0.0042, 0.0012), 'maskInk', 'head');
    P(strokeOn(ME, [[s * 0.054, 1.512], [s * 0.062, 1.518], [s * 0.068, 1.526]], 0.004, 0.0012), 'maskInk', 'head');
    // red eye flares sweeping up to the temples
    P(strokeOn(ME, curve(x => 1.53 + 4.5 * (x - s * 0.03) ** 2 * (Math.sign(x) === s ? 1 : 0) + 0.004, s * 0.022, s * 0.07), 0.0075, 0.0009), 'maskRed', 'head');
    // whisker stripes
    for (const [y0, dy] of [[1.478, 0.004], [1.466, -0.002], [1.454, -0.008]]) P(strokeOn(ME, [[s * 0.042, y0], [s * 0.056, y0 + dy * 0.5], [s * 0.07, y0 + dy]], 0.006, 0.0009), 'maskRed', 'head');
    // ears on the mask
    const b = V(s * 0.048, 1.585, 0.04), ax = V(s * 0.42, 1, 0.15).normalize();
    const cone = (hh, ww, dz, m) => { const g = new THREE.ConeGeometry(ww, hh, 4, 2); g.rotateY(Math.PI / 4); g.scale(1, 1, 0.4); g.translate(0, hh / 2, dz); P(basis(g, b, ax, V(0, 0, 1)), m, 'head'); };
    cone(0.075, 0.034, 0, 'mask'); cone(0.052, 0.02, 0.008, 'maskRed');
  }
  // forehead flame marks
  P(blobOn(ME, 0, 1.567, 0.0055, 0.017, 0, 0.0009), 'maskRed', 'head');
  for (const s of [-1, 1]) P(blobOn(ME, s * 0.019, 1.561, 0.0045, 0.013, -s * 0.35, 0.0009), 'maskRed', 'head');
  // smiling cat mouth (w shape) under the snout
  P(strokeOn(ME, curve(x => 1.438 + 0.0075 * (((Math.abs(x) - 0.013) / 0.013) ** 2) - 0.0075, -0.028, 0.028, 20), 0.0038, 0.0012, false), 'maskInk', 'head');

  // ---- hair: black bob, blunt but spiky at the ends
  const HS = { c: V(0, 1.525, -0.008), r: V(0.097, 0.117, 0.108) };
  const on = (az, el, k = 1) => V(HS.c.x + HS.r.x * k * Math.cos(el) * Math.sin(az), HS.c.y + HS.r.y * k * Math.sin(el), HS.c.z + HS.r.z * k * Math.cos(el) * Math.cos(az));
  {
    const g = ellipsoid([HS.c.x, HS.c.y, HS.c.z], [HS.r.x, HS.r.y, HS.r.z], 40, 28).toNonIndexed(), p = g.attributes.position, nn = g.attributes.normal, keep = [], nk = [];
    for (let i = 0; i < p.count; i += 3) { let cx = 0, cy = 0, cz = 0; for (let j = 0; j < 3; j++) { cx += p.getX(i + j) / 3; cy += p.getY(i + j) / 3; cz += p.getZ(i + j) / 3; } const dy = (cy - HS.c.y) / HS.r.y, dz = (cz - HS.c.z) / HS.r.z; if (!((dz > 0.2 && dy < 0.3) || (dy < -0.4 && dz > -0.6) || dy < -0.75)) for (let j = 0; j < 3; j++) { keep.push(p.getX(i + j), p.getY(i + j), p.getZ(i + j)); nk.push(nn.getX(i + j), nn.getY(i + j), nn.getZ(i + j)); } }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nk, 3)); P(m, 'hair', 'head');
  }
  const hstr = (pts, w, t, o = {}) => P(strand(pts, Object.assign({ w, t, m: 'hair', center: HS.c, seg: 14 }, o)), 'head');
  const N = 24;
  for (let i = 0; i < N; i++) {
    const az = lerp(0.95, Math.PI * 2 - 0.95, i / (N - 1)), side = Math.abs(Math.sin(az));
    const yb = 1.375 + rr(-0.012, 0.012) - side * 0.01, r1 = 0.118 + side * 0.012, flick = rr(0.008, 0.035) * (0.5 + side);
    const R0 = (r, y) => V(Math.sin(az) * r, y, HS.c.z + Math.cos(az) * r * 0.95);
    hstr([on(az, rr(0.55, 0.95)), on(az, 0.05, 1.08), R0(r1, lerp(1.47, yb, 0.5)), R0(r1 + flick, yb)], rr(0.045, 0.055), 0.012);
  }
  for (const s of [-1, 1]) for (const [az, yb] of [[0.78, 1.37], [0.9, 1.36]]) hstr([on(s * az, 0.75), on(s * az, 0.1, 1.1), V(s * 0.1, 1.42, 0.06), V(s * (0.115 + rr(0, 0.015)), yb, 0.055)], 0.035, 0.01);
  // a few loose wisps on top that poke out around the mask ears
  for (let i = 0; i < 6; i++) { const az = rr(-2.6, 2.6), el = rr(0.7, 1.2); hstr([on(az, el, 0.98), on(az + rr(-0.2, 0.2), el - 0.2, 1.1), on(az + rr(-0.3, 0.3), el - 0.35, 1.18)], 0.035, 0.01, { seg: 8 }); }

  // ---- kimono (kosode) top
  const TP = [[0.0, 0.9], [0.13, 0.9], [0.125, 0.98], [0.12, 1.06], [0.128, 1.16], [0.134, 1.24], [0.148, 1.3], [0.11, 1.335], [0.05, 1.35], [0.0, 1.355]], TSZ = 0.7;
  P(lathe(TP, TSZ, 40), 'top');
  // crossed collar: red underlayer then white collar band, left over right
  for (const [s, lift] of [[1, 0.004], [-1, 0.008]]) {
    P(conform(quadStrip([[s * 0.046, 1.345], [s * 0.024, 1.345], [-s * 0.06, 1.06], [-s * 0.082, 1.06]]), TP, TSZ, 1, lift), 'red');
    P(conform(quadStrip([[s * 0.074, 1.343], [s * 0.046, 1.343], [-s * 0.082, 1.06], [-s * 0.11, 1.06]]), TP, TSZ, 1, lift + 0.001), 'collar');
  }
  // obi + bow
  P(lathe([[0, 1.075], [profR(TP, 1.075) + 0.012, 1.075], [profR(TP, 0.965) + 0.012, 0.965], [0, 0.965]], TSZ + 0.012, 40), 'red');
  {
    const fz = y => TSZ * profR(TP, y) + 0.02, c = V(0, 1.02, fz(1.02));
    for (const s of [-1, 1]) {
      P(basis(ellipsoid([0, 0, 0], [0.038, 0.06, 0.018], 16, 10), c.clone().add(V(s * 0.05, 0.004, 0.004)), V(-s * 1.2, 1, 0), V(0, 0, 1)), 'red', 'J_Spine');
      P(strand([c.clone().add(V(s * 0.01, -0.01, 0.006)), c.clone().add(V(s * 0.03, -0.06, 0.012)), c.clone().add(V(s * 0.045, -0.12, 0.016))], { w: 0.03, t: 0.006, up: V(0, 0, 1), m: 'red', seg: 6, prof: t => t > 0.9 ? 0.7 : 1, closeTip: false }), 'J_Hips');
    }
    P(ellipsoid([c.x, c.y, c.z + 0.004], [0.02, 0.022, 0.014], 12, 8), 'red', 'J_Spine');
    P(torus(V(0, 1.06, 0), profR(TP, 1.06) + 0.013, 0.0035, V(0, 1, 0)), 'gold');
  }
  // sleeves: wide, long, with a red cord and bow near the shoulder
  for (const s of [-1, 1]) {
    const g = tube(V(s * 0.12, 1.3, 0), V(s * 0.6, 1.29, 0), 0.07, 0.135, 28, true);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = (Math.abs(p.getX(i)) - 0.12) / 0.48; p.setY(i, p.getY(i) - 0.045 * t * t); p.setZ(i, p.getZ(i) * (1 - 0.25 * t)); } g.computeVertexNormals();
    P(g, 'top');
    P(tube(V(s * 0.12, 1.3, 0), V(s * 0.6, 1.29, 0), 0.06, 0.05, 16), 'top');
    { const t = new THREE.TorusGeometry(1, 0.035, 6, 40); t.rotateY(Math.PI / 2); t.scale(0.35, 0.135 * 1.03, 0.135 * 0.77); t.translate(s * 0.598, 1.29 - 0.045, 0); P(t, 'red'); }
    // cord around the upper sleeve + a little bow on the front
    { const t = new THREE.TorusGeometry(1, 0.05, 6, 32); t.rotateY(Math.PI / 2); t.scale(0.12, 0.08, 0.08 * 0.95); t.translate(s * 0.2, 1.298, 0); P(t, 'red'); }
    const bc = V(s * 0.2, 1.33, 0.07);
    for (const k of [-1, 1]) P(basis(new THREE.TorusGeometry(0.014, 0.0035, 6, 16), bc.clone().add(V(k * 0.016, 0.006, 0)), V(0, 0, 1), V(0, 1, 0)), 'red');
    for (const k of [-1, 1]) P(strand([bc.clone(), bc.clone().add(V(k * 0.012, -0.03, 0.004)), bc.clone().add(V(k * 0.02, -0.06, 0.002))], { w: 0.004, t: 0.004, up: V(0, 0, 1), m: 'red', seg: 6, prof: () => 1, closeTip: false, radial: 5 }));
  }
  // red hakama: wide, pleated, down to the ankles
  {
    const g = lathe([[0.0, 1.02], [0.138, 1.02], [0.15, 0.95], [0.185, 0.75], [0.225, 0.45], [0.26, 0.14], [0.27, 0.08], [0.262, 0.075], [0.0, 0.075]], 0.82, 72);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(x, z), k = 1 + 0.05 * Math.abs(Math.cos(a * 7)) * sm(1.0, 0.7, y); p.setX(i, x * k); p.setZ(i, z * k); } g.computeVertexNormals();
    P(g, 'hakama', 'skirt');
    // ties wrapped over the obi at the back and sides
    P(lathe([[0, 0.97], [profR(TP, 0.97) + 0.02, 0.97], [profR(TP, 0.955) + 0.02, 0.955], [0, 0.955]], TSZ + 0.02, 40), 'hakama', 'J_Hips');
  }
  // feet: white tabi in sandals
  for (const s of [-1, 1]) {
    const x = s * 0.09;
    P(tube(V(x, 0.5, 0), V(x, 0.08, 0), 0.045, 0.034, 14), 'skin');
    const f = ellipsoid([0, 0, 0], [0.04, 0.035, 0.1], 18, 12), fp = f.attributes.position; for (let i = 0; i < fp.count; i++) if (fp.getY(i) < -0.01) fp.setY(i, -0.01); f.computeVertexNormals(); f.translate(x, 0.035, 0.035); P(f, 'tabi');
    { const z = new THREE.CylinderGeometry(0.045, 0.045, 0.014, 20); z.scale(1, 1, 2.4); z.translate(x, 0.007, 0.035); P(z, 'zori'); }
    P(strand([V(x - 0.035, 0.03, 0.03), V(x, 0.07, 0.09), V(x + 0.035, 0.03, 0.03)], { w: 0.006, t: 0.006, up: V(0, 0, 1), m: 'red', seg: 8, prof: () => 1, closeTip: false, radial: 5 }));
  }
  // height marker for the game's sizing
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.7, -0.02, 0, 1.7, -0.02, 0, 1.7, -0.02], 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); P(g, 'hair', 'head'); }
  return { root: assemble(C, parts, LBONES, v => ladyW(v), skirtW), BL: LBONES };
}
