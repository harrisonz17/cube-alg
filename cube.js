// Minimal 3x3 sticker model. Coordinates: x = right, y = up, z = front.
// Faces are stored U R F D L B, 9 stickers each, read as seen from outside.
(function () {
  const FACES = 'URFDLB';

  function facePos(f, r, c) {
    switch (f) {
      case 'U': return [[c - 1, 1, r - 1], [0, 1, 0]];
      case 'F': return [[c - 1, 1 - r, 1], [0, 0, 1]];
      case 'R': return [[1, 1 - r, 1 - c], [1, 0, 0]];
      case 'B': return [[1 - c, 1 - r, -1], [0, 0, -1]];
      case 'L': return [[-1, 1 - r, c - 1], [-1, 0, 0]];
      case 'D': return [[c - 1, -1, 1 - r], [0, -1, 0]];
    }
  }

  const STK = [];
  for (const f of FACES) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) STK.push(facePos(f, r, c));
  const key = (p, n) => p.join(',') + '|' + n.join(',');
  const IDX = new Map(STK.map(([p, n], i) => [key(p, n), i]));

  function rot([x, y, z], ax, s) {
    if (ax === 0) return s < 0 ? [x, z, -y] : [x, -z, y];
    if (ax === 1) return s < 0 ? [-z, y, x] : [z, y, -x];
    return s < 0 ? [y, -x, z] : [-y, x, z];
  }

  const DEF = {
    R: [0, -1, v => v === 1], L: [0, 1, v => v === -1], M: [0, 1, v => v === 0],
    r: [0, -1, v => v >= 0], l: [0, 1, v => v <= 0], x: [0, -1, () => true],
    U: [1, -1, v => v === 1], D: [1, 1, v => v === -1], E: [1, 1, v => v === 0],
    u: [1, -1, v => v >= 0], d: [1, 1, v => v <= 0], y: [1, -1, () => true],
    F: [2, -1, v => v === 1], B: [2, 1, v => v === -1], S: [2, -1, v => v === 0],
    f: [2, -1, v => v >= 0], b: [2, 1, v => v <= 0], z: [2, -1, () => true],
  };
  const PERM = {};
  for (const [m, [ax, s, pred]] of Object.entries(DEF)) {
    PERM[m] = STK.map(([p, n], i) => (pred(p[ax]) ? IDX.get(key(rot(p, ax, s), rot(n, ax, s))) : i));
  }

  // Parse "R U2 R' Rw x'" into [{m:'R', n:1}, ...], n = quarter turns clockwise (1..3)
  function parse(alg) {
    const out = [];
    const re = /([RLUDFBMESxyzrludfb])(w?)(\d*)('?)/g;
    let t;
    const clean = alg.replace(/[()\[\]]/g, ' ');
    while ((t = re.exec(clean))) {
      let m = t[1];
      if (t[2]) m = m.toLowerCase();
      let n = t[3] ? parseInt(t[3], 10) % 4 : 1;
      if (t[4]) n = (4 - n) % 4;
      if (n) out.push({ m, n });
    }
    return out;
  }

  const fmt = moves => moves.map(({ m, n }) => m + (n === 1 ? '' : n === 2 ? '2' : "'")).join(' ');
  const inverse = moves => moves.slice().reverse().map(({ m, n }) => ({ m, n: (4 - n) % 4 }));
  const toMoves = a => (typeof a === 'string' ? parse(a) : a);

  const SOLVED = [...FACES].flatMap(f => Array(9).fill(f));

  function apply(state, alg) {
    let s = state.slice();
    for (const { m, n } of toMoves(alg)) {
      const p = PERM[m];
      for (let k = 0; k < n; k++) {
        const ns = new Array(54);
        for (let i = 0; i < 54; i++) ns[p[i]] = s[i];
        s = ns;
      }
    }
    return s;
  }

  const ORIENTS = [];
  for (const a of ['', 'x', 'x2', "x'", 'z', "z'"]) for (const b of ['', 'y', 'y2', "y'"]) ORIENTS.push(a + ' ' + b);
  function normalize(s) {
    for (const o of ORIENTS) {
      const t = apply(s, o);
      if (t[4] === 'U' && t[22] === 'F') return t;
    }
    return s;
  }

  // State shown before the algorithm is performed: solved cube with the inverse applied.
  // If the alg contains rotations, start from the rotated solved cube that leaves the
  // centres in standard orientation, so the case is shown the way you hold it.
  function caseOrient(alg) {
    const inv = inverse(parse(alg));
    for (const o of ORIENTS) {
      const t = apply(apply(SOLVED, o), inv);
      if (t[4] === 'U' && t[22] === 'F') return o.trim();
    }
    return '';
  }
  const caseState = alg => apply(apply(SOLVED, caseOrient(alg)), inverse(parse(alg)));

  // Rewrite a sequence using only the six outer faces (no rotations, wide or slice moves),
  // keeping the centres fixed. Used for setup scrambles you can follow from a solved cube.
  const PHI = {
    x: { U: 'F', F: 'D', D: 'B', B: 'U', R: 'R', L: 'L' },
    y: { F: 'R', R: 'B', B: 'L', L: 'F', U: 'U', D: 'D' },
    z: { U: 'L', L: 'D', D: 'R', R: 'U', F: 'F', B: 'B' },
  };
  const EXPAND = {
    r: 'L x', l: "R x'", u: 'D y', d: "U y'", f: 'B z', b: "F z'",
    M: "R L' x'", E: "U D' y'", S: "F' B z",
  };
  function toFaceMoves(alg) {
    let map = { U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B' };
    const out = [];
    const step = (m, n) => {
      if (PHI[m]) {
        for (let k = 0; k < n; k++) {
          const nm = {};
          for (const f of 'URFDLB') nm[f] = map[PHI[m][f]];
          map = nm;
        }
      } else if (EXPAND[m]) {
        for (let k = 0; k < n; k++) for (const e of parse(EXPAND[m])) step(e.m, e.n);
      } else {
        out.push({ m: map[m], n });
      }
    };
    for (const { m, n } of toMoves(alg)) step(m, n);
    return simplify(out);
  }

  // Merge consecutive turns of the same face, and of opposite faces that commute.
  const OPP = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
  function simplify(moves) {
    const out = [];
    for (const mv of moves) {
      out.push({ ...mv });
      let changed = true;
      while (changed && out.length) {
        changed = false;
        const a = out[out.length - 1];
        const b = out[out.length - 2];
        const c = out[out.length - 3];
        if (b && b.m === a.m) {
          out.splice(-2, 2);
          const n = (a.n + b.n) % 4;
          if (n) out.push({ m: a.m, n });
          changed = true;
        } else if (b && c && OPP[b.m] === a.m && c.m === a.m) {
          out.splice(-3, 3);
          const n = (a.n + c.n) % 4;
          if (n) out.push({ m: a.m, n });
          out.push(b);
          changed = true;
        }
      }
    }
    return out;
  }

  window.Cube = { FACES, STK, SOLVED, parse, fmt, inverse, apply, normalize, caseOrient, caseState, toFaceMoves, simplify };
})();
