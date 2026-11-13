// SVG case diagrams built from the actual cube state.
(function () {
  const { STK } = window.Cube;
  const COLORS = { U: '#f4d03f', D: '#eeeeee', F: '#2fb35a', B: '#2f7de1', R: '#ff8c2e', L: '#e5484d' };
  const GREY = '#3a3e47';
  const BODY = '#0d0e11';
  const NORMAL = { U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] };
  const svg = (w, h, inner) =>
    `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" class="diagram">${inner}</svg>`;
  const rect = (x, y, w, h, fill, r = 2) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;

  // Colours of every sticker on the cubie at position p.
  function cubie(state, p) {
    const out = [];
    STK.forEach(([q], i) => { if (q[0] === p[0] && q[1] === p[1] && q[2] === p[2]) out.push(state[i]); });
    return out;
  }
  function home(colors) {
    const h = [0, 0, 0];
    for (const c of colors) for (let k = 0; k < 3; k++) h[k] += NORMAL[c][k];
    return h;
  }

  // Top-down last-layer view. mode: 'oll' (yellow vs grey) or 'pll' (full colour + arrows).
  function topView(state, mode) {
    const cell = 24, gap = 2, strip = 7, pad = 4;
    const g0 = pad + strip + gap; // grid origin
    const size = g0 * 2 + cell * 3;
    const col = c => (mode === 'oll' ? (c === 'U' ? COLORS.U : GREY) : COLORS[c]);
    let s = rect(g0 - 2, g0 - 2, cell * 3 + 4, cell * 3 + 4, BODY, 4);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        s += rect(g0 + c * cell + 1, g0 + r * cell + 1, cell - 2, cell - 2, col(state[r * 3 + c]), 3);
    for (let j = 0; j < 3; j++) {
      const x = g0 + j * cell + 2, w = cell - 4;
      s += rect(x, pad, w, strip, col(state[45 + (2 - j)]));          // back
      s += rect(x, size - pad - strip, w, strip, col(state[18 + j])); // front
      s += rect(pad, x, strip, w, col(state[36 + j]));                // left
      s += rect(size - pad - strip, x, strip, w, col(state[9 + (2 - j)])); // right
    }
    if (mode === 'pll') s += arrows(state, g0, cell);
    return svg(size, size, s);
  }

  function arrows(state, g0, cell) {
    const center = (x, z) => [g0 + (x + 1) * cell + cell / 2, g0 + (z + 1) * cell + cell / 2];
    const moves = [];
    for (let x = -1; x <= 1; x++)
      for (let z = -1; z <= 1; z++) {
        if (!x && !z) continue;
        const h = home(cubie(state, [x, 1, z]));
        if (h[0] !== x || h[2] !== z) moves.push([x, z, h[0], h[2]]);
      }
    const done = new Set();
    let s = `<defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#111"/></marker></defs>`;
    for (const [x, z, hx, hz] of moves) {
      const k = `${x},${z}>${hx},${hz}`;
      if (done.has(k)) continue;
      const back = moves.some(m => m[0] === hx && m[1] === hz && m[2] === x && m[3] === z);
      done.add(k);
      if (back) done.add(`${hx},${hz}>${x},${z}`);
      let [x1, y1] = center(x, z), [x2, y2] = center(hx, hz);
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), sh = 5;
      x1 += (dx / len) * sh; y1 += (dy / len) * sh; x2 -= (dx / len) * sh; y2 -= (dy / len) * sh;
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111" stroke-width="2.4" stroke-linecap="round" marker-end="url(#ah)"${back ? ' marker-start="url(#ah)"' : ''}/>`;
    }
    return s;
  }

  // Isometric view of U, F and R faces for F2L. Pieces not involved in the case are greyed.
  function isoView(state) {
    const S = 17, cx = 60, cy = 62;
    const proj = ([x, y, z]) => [cx + (x - z) * 0.866 * S, cy + ((x + z) * 0.5 - y) * S];
    const poly = pts => pts.map(p => proj(p).map(v => v.toFixed(2)).join(',')).join(' ');
    const faceQuad = (k, sign, a, b, ca, cb, half) => {
      const out = [];
      for (const [da, db] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const p = [0, 0, 0];
        p[k] = 1.5 * sign; p[a] = ca + da * half; p[b] = cb + db * half;
        out.push(p);
      }
      return out;
    };
    const faces = [[1, 1, 0, 2], [2, 1, 0, 1], [0, 1, 2, 1]]; // U, F, R: [axis, sign, a, b]
    let s = '';
    for (const [k, sign, a, b] of faces) s += `<polygon points="${poly(faceQuad(k, sign, a, b, 0, 0, 1.55))}" fill="${BODY}"/>`;
    STK.forEach(([p, n], i) => {
      const k = n.findIndex(v => v !== 0);
      if (n[k] !== 1) return; // only U, F, R are visible
      const f = faces.find(fc => fc[0] === k);
      const colors = cubie(state, p);
      // Last-layer pieces (anything with a yellow sticker) are irrelevant to F2L: grey them out.
      const fill = colors.includes('U') ? GREY : COLORS[state[i]];
      s += `<polygon points="${poly(faceQuad(k, 1, f[2], f[3], p[f[2]], p[f[3]], 0.44))}" fill="${fill}" stroke="${BODY}" stroke-width="0.6" stroke-linejoin="round"/>`;
    });
    return svg(120, 124, s);
  }

  function diagram(set, state) {
    if (set === 'f2l') return isoView(state);
    return topView(state, set);
  }

  window.Render = { diagram, COLORS };
})();
