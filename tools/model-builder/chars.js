const base = { skin: '#ffe9e1', eye: '#141018', eyeWhite: '#ffffff', cheek: '#f8b4ba', earIn: '#f7b6c2', accent: '#f5d27a', accent2: '#ffffff' };
const C = (o) => Object.assign(o, { colors: Object.assign({}, base, o.colors) });
export const CHARS = [
  C({ id: 'fox', name: 'Kon the Fox Wispling', seed: 11, ears: 'point', earH: 0.11, earW: 0.05, earTipM: 'hairDark', tail: 'fluff', tailW: 0.06, tailTip: 'hairTip',
    hair: { style: 'long', bottom: 0.28, flare: 0.21 },
    outfit: { kimono: true, tie: null, sleeve: { end: 0.185, r0: 0.04, r1: 0.062, m: 'top' }, bottom: { type: 'hakama', m: 'bottom' }, legs: { sock: 'sock', sockTop: 0.1, shoe: 'shoe' } },
    colors: { hair: '#f2a65a', hairTip: '#fff8f3', hairDark: '#5a3a3a', earIn: '#fff3ea', top: '#fbfbfd', trim: '#3fa89a', tie: '#3fa89a', bottom: '#2d6e69', accent: '#f07a3c', sock: '#fbfbfd', shoe: '#4a3434' } }),
  C({ id: 'cat', name: 'Nyoko the Cat Wispling', seed: 23, ears: 'point', earH: 0.085, earW: 0.05, earTilt: 0.35, tail: 'thin',
    hair: { style: 'bob', bangs: 8, bangLen: 0.045 },
    outfit: { sailor: true, tie: 'bow', bowSize: 0.024, bottom: { type: 'skirt', m: 'bottom', pleats: 12, top: 0.3, hem: 0.185, r: 0.135 }, legs: { sock: 'sock', sockTop: 0.165, shoe: 'shoe', strap: true } },
    colors: { hair: '#3b3346', top: '#fbfbfd', collar: '#2c3557', tie: '#f07aa0', bottom: '#2c3557', sock: '#2c3557', shoe: '#2a2230' } }),
  C({ id: 'bunny', name: 'Mochi the Bunny Wispling', seed: 31, ears: 'long', earFold: true, tail: 'puff', tailUp: 0.02,
    hair: { style: 'bob', twin: true, bangs: 7, bangLen: 0.05, locks: [[1.25, -0.11, 0.036]] },
    outfit: { tie: 'bow', bowSize: 0.02, overall: true, sleeve: { end: 0.18, r0: 0.034, r1: 0.031, puff: true, cuff: 'top' }, bottom: { type: 'shorts', m: 'bottom', len: 0.19, cuff: 'bottom' }, legs: { sock: 'sock', sockTop: 0.1, frill: true, shoe: 'shoe', strap: true } },
    colors: { hair: '#fff4ee', top: '#fff6d8', tie: '#a98ae8', bottom: '#b9a3ec', accent: '#fff6d8', accent2: '#9a80dc', sock: '#ffffff', shoe: '#f3a7bf' } }),
  C({ id: 'tanuki', name: 'Ponta the Tanuki Wispling', seed: 47, ears: 'round', tail: 'stripe', leaf: true,
    hair: { style: 'messy', bangs: 8, bangLen: 0.055, tip: false },
    outfit: { sweater: true, tie: null, torso: [[0.0, 0.25], [0.104, 0.25], [0.11, 0.3], [0.107, 0.36], [0.1, 0.41], [0.085, 0.44], [0.05, 0.455], [0.0, 0.46]], sleeve: { end: 0.198, r0: 0.04, r1: 0.036, cuff: 'topDark' }, bottom: { type: 'shorts', m: 'bottom', len: 0.18 }, legs: { sock: 'sock', stripes: 'sockB', sockTop: 0.12, shoe: 'shoe' } },
    colors: { hair: '#8a6a55', hairDark: '#3b2a3f', top: '#6cc25a', topDark: '#58a948', bottom: '#6b4f3f', sock: '#f6efe4', sockB: '#c98f5c', shoe: '#3b2a2a', leaf: '#7fcf5f', leafDark: '#4f8f3a' } }),
  C({ id: 'wolf', name: 'Fenn the Wolf Wispling', seed: 59, ears: 'point', earH: 0.1, earW: 0.048, earTilt: 0.3, tail: 'fluff', tailW: 0.05, tailTip: 'hairTip',
    hair: { style: 'wild', bottom: 0.3, flare: 0.23, tip: false, bangs: 8 },
    outfit: { cape: true, scarf: true, tie: null, bottom: { type: 'shorts', m: 'bottom', len: 0.18 }, legs: { boot: 'boot', bootTop: 0.12, bootCuff: 'bootCuff', shoe: 'boot' } },
    colors: { hair: '#b8bccb', hairTip: '#eef0f6', earIn: '#eaeaf2', top: '#3a3d4c', tie: '#d9483b', cape: '#565d78', capeIn: '#2f3345', bottom: '#2f3345', boot: '#6b4a3a', bootCuff: '#d9c7a8', accent: '#e8c46a' } }),
  C({ id: 'deer', name: 'Suzu the Deer Wispling', seed: 71, ears: 'deer', antlers: true, tail: 'puff', tailM: 'spot', tailUp: 0.03, fawnSpots: true,
    hair: { style: 'medium', bangs: 7, bangLen: 0.05 },
    outfit: { pinafore: true, tie: 'bow', bowSize: 0.02, buttons: false, sleeve: { end: 0.18, r0: 0.034, r1: 0.031, puff: true, cuff: 'top' }, bottom: { type: 'skirt', m: 'bottom', top: 0.31, hem: 0.17, r: 0.15, under: 'top' }, legs: { sock: 'sock', sockTop: 0.16, shoe: 'shoe' } },
    colors: { hair: '#c9925f', earIn: '#f3d9c4', top: '#fff8ec', tie: '#3a5aa8', bottom: '#3a5aa8', accent2: '#fff8ec', spot: '#fffaf2', antler: '#efe2c8', sock: '#ffffff', shoe: '#6b4a3a' } }),
];

export const LADY = { id: 'lady', lady: true, name: 'The Shrine Lady', seed: 5, lookOffset: [0, 0.09, 0.08],
  colors: { skin: '#f4e8ea', hair: '#1e1a26', mask: '#fbf9f6', maskRed: '#d4383c', maskInk: '#2b1c28', top: '#f8f7fa', collar: '#ffffff', red: '#c9343b', hakama: '#b8272f', gold: '#e8c46a', tabi: '#fbfbfd', zori: '#c9a77a' },
  shades: { skin: '#d9cad6', mask: '#d8d4de', top: '#d2d0de', collar: '#c9c7d6', tabi: '#d6d6e2' } };

const PC = { skin: '#f7e4dc', nose: '#e9c2b8', cheek: '#f6b3b5', strap: '#c9343b', tabi: '#fbfbfd', zori: '#c9a77a',
  e1_white: '#ffffff', e1_dark: '#2a1f2e', e1_shine: '#ffffff', e2_white: '#ffffff', e2_dark: '#2a1f2e', e2_shine: '#ffffff', e3_white: '#ffffff', e3_dark: '#2a1f2e', e3_shine: '#ffffff',
  m1_mouth: '#8a3a46', m2_mouth: '#6a2434', m2_tongue: '#f08a96', m3_mouth: '#8a3a46', h2_tie: '#d9483b',
  o1_top: '#f8f7fa', o1_collar: '#ffffff', o1_bottom: '#3a5aa8',
  o2_robe: '#e9eef8', o2_trim: '#3a5aa8', o2_obi: '#d9483b',
  o3_shirt: '#f4ecdc', o3_sash: '#c9343b', o3_jacket: '#4a5a7a', o3_trim: '#2a2a3a', o3_tie: '#3b2a2a', o3_pants: '#5a4a40', o3_wrap: '#e8e0d0' };
const PS = { skin: '#e6c9c4', tabi: '#d6d6e2', o1_top: '#d2d0de', o1_collar: '#c9c7d6', e1_white: '#e8e8f0', e2_white: '#e8e8f0', e3_white: '#e8e8f0' };
export const PLAYERS = [
  { id: 'player-female', player: true, sex: 'f', name: 'Player (female)', seed: 13, lookOffset: [0, 0.06, 0.09], colors: Object.assign({}, PC, { e1_iris: '#b8743a', e2_iris: '#b8743a', e3_iris: '#b8743a', h1_hair: '#4a3040', h2_hair: '#4a3040', h3_hair: '#4a3040' }), shades: PS },
  { id: 'player-male', player: true, sex: 'm', name: 'Player (male)', seed: 17, lookOffset: [0, 0.06, 0.09], colors: Object.assign({}, PC, { e1_iris: '#4f6f9a', e2_iris: '#4f6f9a', e3_iris: '#4f6f9a', h1_hair: '#2e2a3a', h2_hair: '#2e2a3a', h3_hair: '#2e2a3a' }), shades: PS },
];
