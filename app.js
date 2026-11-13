(function () {
  const { ALGS, Cube, Render } = window;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  // ---------- storage (per-browser conveniences) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cubealgs.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('cubealgs.' + k, JSON.stringify(v)); } catch {} },
  };
  const status = store.get('status', { f2l: {}, oll: {}, pll: {} });
  const STATUS_LABEL = ['New', 'Learning', 'Learned'];
  const getStatus = (set, id) => status[set][id] || 0;
  function cycleStatus(set, id) {
    status[set][id] = (getStatus(set, id) + 1) % 3;
    store.set('status', status);
    return status[set][id];
  }

  // Case diagrams are cached: state = solved cube with the inverse of the alg applied.
  const diagramCache = {};
  const diagramFor = (set, c) => (diagramCache[set + c.id] ||= Render.diagram(set, Cube.caseState(c.alg)));

  const esc = s => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const U_TURN = ['', 'U', 'U2', "U'"];

  // Every alg for a case: the top-voted one first, then SpeedCubeDB's other variations.
  // "pre" = U turns to do first when a variation expects the case from another angle.
  const options = c => [{ alg: c.alg, pre: 0, votes: c.votes }, ...(c.vars || [])];
  const choice = store.get('choice', { f2l: {}, oll: {}, pll: {} });
  const chosenIndex = (set, c) => Math.min(choice[set][c.id] || 0, options(c).length - 1);
  const chosen = (set, c) => options(c)[chosenIndex(set, c)];
  function choose(set, id, i) {
    if (i) choice[set][id] = i; else delete choice[set][id];
    store.set('choice', choice);
  }
  const withPre = (o, extra = 0) => {
    const u = U_TURN[(o.pre + extra) % 4];
    return (u ? `<span class="muted">(${u})</span> ` : '') + esc(o.alg);
  };
  const SCDB_SET = { f2l: 'F2L', oll: 'OLL', pll: 'PLL' };
  const scdbUrl = (set, c) => `https://speedcubedb.com/a/3x3/${SCDB_SET[set]}/${encodeURIComponent(set === 'pll' ? c.id : c.name)}`;

  // ---------- algorithm pages ----------
  const META = {
    f2l: { title: 'F2L', sub: 'First two layers: all 41 cases for the front-right slot. Click a case to see more algorithms and pick the one you use.' },
    oll: { title: 'OLL', sub: 'Orientation of the last layer: all 57 cases. Click a case to see more algorithms and pick the one you use.' },
    pll: { title: 'PLL', sub: 'Permutation of the last layer: all 21 cases. Click a case to see more algorithms and pick the one you use.' },
  };
  let currentSet = 'f2l';
  let filter = { q: '', s: 'all' };

  function renderAlgs() {
    const set = currentSet;
    $('#algs-title').textContent = META[set].title;
    $('#algs-sub').textContent = META[set].sub;
    const q = filter.q.trim().toLowerCase();
    const cases = ALGS[set].filter(c =>
      (filter.s === 'all' || String(getStatus(set, c.id)) === filter.s) &&
      (!q || (c.name + ' ' + c.group + ' ' + options(c).map(o => o.alg).join(' ')).toLowerCase().includes(q)));
    const groups = [];
    for (const c of cases) {
      let g = groups.find(g => g.name === c.group);
      if (!g) groups.push((g = { name: c.group, items: [] }));
      g.items.push(c);
    }
    $('#algs-body').innerHTML = groups.length
      ? groups.map(g => `
        <div class="group">
          <h2>${esc(g.name)} <span>${g.items.length}</span></h2>
          <div class="grid">${g.items.map(c => card(set, c)).join('')}</div>
        </div>`).join('')
      : `<div class="empty">No cases match.</div>`;
  }

  function card(set, c) {
    const s = getStatus(set, c.id);
    const n = options(c).length;
    const custom = chosenIndex(set, c) > 0;
    return `
      <div class="card" data-case="${esc(c.id)}" tabindex="0" role="button" aria-label="${esc(c.name)}: show algorithms">
        <div class="card-head">
          <span class="card-name">${esc(c.name)}</span>
          <button class="pill" data-s="${s}" data-status="${esc(c.id)}" title="Click to change">${STATUS_LABEL[s]}</button>
        </div>
        ${diagramFor(set, c)}
        <div class="alg">${withPre(chosen(set, c))}</div>
        <div class="card-foot muted">${custom ? '<span class="dot"></span>Your pick · ' : ''}${n} algorithm${n > 1 ? 's' : ''}</div>
      </div>`;
  }

  $('#algs-body').addEventListener('click', e => {
    const st = e.target.closest('[data-status]');
    if (st) {
      const s = cycleStatus(currentSet, st.dataset.status);
      st.dataset.s = s;
      st.textContent = STATUS_LABEL[s];
      return;
    }
    const cardEl = e.target.closest('[data-case]');
    if (cardEl) openCase(currentSet, cardEl.dataset.case);
  });
  $('#algs-body').addEventListener('keydown', e => {
    const cardEl = e.target.closest('[data-case]');
    if (cardEl && (e.key === 'Enter' || e.key === ' ') && e.target === cardEl) { e.preventDefault(); openCase(currentSet, cardEl.dataset.case); }
  });

  // ---------- case detail: all variations ----------
  let open = null; // { set, id }
  function openCase(set, id) {
    open = { set, id };
    renderCase();
    $('#case-modal').hidden = false;
    document.body.classList.add('modal-open');
    $('#case-modal .modal').focus();
  }
  function closeCase() {
    if (!open) return;
    open = null;
    $('#case-modal').hidden = true;
    document.body.classList.remove('modal-open');
    renderAlgs();
  }
  function renderCase() {
    const { set, id } = open;
    const c = ALGS[set].find(x => x.id === id);
    const sel = chosenIndex(set, c);
    const s = getStatus(set, c.id);
    $('#m-name').textContent = c.name;
    $('#m-group').textContent = c.group;
    $('#m-diagram').innerHTML = diagramFor(set, c);
    $('#m-status').dataset.s = s;
    $('#m-status').textContent = STATUS_LABEL[s];
    $('#m-link').href = scdbUrl(set, c);
    $('#m-list').innerHTML = options(c).map((o, i) => `
      <li>
        <button class="var${i === sel ? ' on' : ''}" data-i="${i}" aria-pressed="${i === sel}">
          <span class="radio" aria-hidden="true"></span>
          <span class="alg">${withPre(o)}</span>
          <span class="votes muted" title="SpeedCubeDB votes">${o.votes != null ? o.votes + ' votes' : ''}</span>
        </button>
      </li>`).join('');
  }
  $('#m-list').addEventListener('click', e => {
    const b = e.target.closest('.var');
    if (!b || !open) return;
    choose(open.set, open.id, +b.dataset.i);
    renderCase();
  });
  $('#m-status').addEventListener('click', () => {
    if (!open) return;
    cycleStatus(open.set, open.id);
    renderCase();
  });
  $('#m-close').addEventListener('click', closeCase);
  $('#case-modal').addEventListener('click', e => { if (e.target.id === 'case-modal') closeCase(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCase(); });
  $('#search').addEventListener('input', e => { filter.q = e.target.value; renderAlgs(); });
  segment('#status-filter', v => { filter.s = v; renderAlgs(); });

  function segment(sel, onChange, initial) {
    const el = $(sel);
    const setOn = v => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    if (initial) setOn(initial);
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      setOn(b.dataset.v);
      onChange(b.dataset.v);
    });
    return setOn;
  }

  // ---------- practice ----------
  const prefs = store.get('practice', { set: 'f2l', pool: 'all', custom: { f2l: null, pll: null } });
  const savePrefs = () => store.set('practice', prefs);
  let current = null; // { c, setup, state, auf }
  let revealStep = 0;

  segment('#p-set', v => { prefs.set = v; savePrefs(); renderCustom(); nextCase(); }, prefs.set);
  segment('#p-pool', v => { prefs.pool = v; savePrefs(); renderCustom(); nextCase(); }, prefs.pool);

  const customSel = set => new Set(prefs.custom[set] || ALGS[set].map(c => c.id));

  function pool() {
    const set = prefs.set, all = ALGS[set];
    if (prefs.pool === 'learning') return all.filter(c => getStatus(set, c.id) === 1);
    if (prefs.pool === 'custom') { const sel = customSel(set); return all.filter(c => sel.has(c.id)); }
    return all;
  }

  function renderCustom() {
    const show = prefs.pool === 'custom';
    $('#p-custom').hidden = !show;
    if (!show) return;
    const set = prefs.set, sel = customSel(set);
    $('#p-chips').innerHTML = ALGS[set]
      .map(c => `<button class="chip${sel.has(c.id) ? ' on' : ''}" data-id="${c.id}">${esc(set === 'pll' ? c.id : c.id)}</button>`)
      .join('');
    $('#p-custom-count').textContent = `${sel.size} of ${ALGS[set].length} cases selected`;
  }
  function setCustom(ids) { prefs.custom[prefs.set] = [...ids]; savePrefs(); renderCustom(); }
  $('#p-chips').addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const sel = customSel(prefs.set);
    sel.has(b.dataset.id) ? sel.delete(b.dataset.id) : sel.add(b.dataset.id);
    setCustom(sel);
    if (current && !sel.has(current.c.id)) nextCase();
  });
  $('#p-sel-all').addEventListener('click', () => { setCustom(ALGS[prefs.set].map(c => c.id)); });
  $('#p-sel-none').addEventListener('click', () => setCustom([]));

  const rand = n => Math.floor(Math.random() * n);

  function nextCase() {
    const list = pool();
    revealStep = 0;
    $('#p-reveal-box').hidden = true;
    $('#p-reveal').disabled = !list.length;
    if (!list.length) {
      current = null;
      $('#p-scramble').innerHTML = `<span class="muted" style="font-size:16px">${
        prefs.pool === 'learning' ? `No ${prefs.set.toUpperCase()} cases marked “Learning” yet. Mark some on the ${prefs.set.toUpperCase()} tab.` : 'No cases selected.'}</span>`;
      return;
    }
    let c = list[rand(list.length)];
    if (list.length > 1 && current && c.id === current.c.id && current.set === prefs.set) c = list[(list.indexOf(c) + 1) % list.length];
    // A random U before the setup only shuffles last-layer pieces, which F2L and OLL don't care about.
    // PLL is about that permutation, so it gets none.
    const pre = prefs.set === 'pll' ? 0 : rand(4);
    const auf = rand(4);
    const inv = Cube.fmt(Cube.inverse(Cube.parse(c.alg)));
    const setup = Cube.toFaceMoves(`${Cube.caseOrient(c.alg)} ${U_TURN[pre]} ${inv} ${U_TURN[auf]}`);
    current = { set: prefs.set, c, setup, auf, state: Cube.apply(Cube.SOLVED, setup) };
    $('#p-scramble').textContent = Cube.fmt(setup);
  }

  function reveal() {
    if (!current) return;
    if (revealStep === 0) {
      revealStep = 1;
      const { c, set } = current;
      $('#p-reveal-box').hidden = false;
      $('#p-diagram').innerHTML = Render.diagram(set, current.state);
      $('#p-name').textContent = c.name;
      $('#p-group').textContent = c.group;
      $('#p-solution').hidden = true;
      $('#p-show-sol').hidden = false;
      const s = getStatus(set, c.id);
      $('#p-status').dataset.s = s;
      $('#p-status').textContent = STATUS_LABEL[s];
    } else if (revealStep === 1) {
      revealStep = 2;
      // Your chosen variation, with the U turn needed to line the case up for it.
      $('#p-solution').innerHTML = withPre(chosen(current.set, current.c), (4 - current.auf) % 4);
      $('#p-solution').hidden = false;
      $('#p-show-sol').hidden = true;
    }
  }
  $('#p-next').addEventListener('click', nextCase);
  $('#p-reveal').addEventListener('click', reveal);
  $('#p-show-sol').addEventListener('click', reveal);
  $('#p-status').addEventListener('click', () => {
    if (!current) return;
    const s = cycleStatus(current.set, current.c.id);
    $('#p-status').dataset.s = s;
    $('#p-status').textContent = STATUS_LABEL[s];
    if (prefs.pool === 'learning') renderCustom();
  });

  // ---------- timer ----------
  const times = store.get('times', []);
  let tState = 'idle', tStart = 0, raf = 0;
  const fmtT = ms => (ms / 1000).toFixed(2);
  function avg(n) {
    if (times.length < n) return '–';
    const xs = times.slice(0, n).map(t => t.ms).sort((a, b) => a - b).slice(1, -1);
    return fmtT(xs.reduce((a, b) => a + b, 0) / xs.length);
  }
  function renderTimes() {
    $('#t-ao5').textContent = avg(5);
    $('#t-ao12').textContent = avg(12);
    $('#t-best').textContent = times.length ? fmtT(Math.min(...times.map(t => t.ms))) : '–';
    $('#t-list').innerHTML = times.slice(0, 50)
      .map(t => `<li>${fmtT(t.ms)}<span>${esc(t.name)}</span></li>`).join('');
  }
  function tick() { $('#t-display').textContent = fmtT(performance.now() - tStart); raf = requestAnimationFrame(tick); }
  function stopTimer() {
    cancelAnimationFrame(raf);
    const ms = performance.now() - tStart;
    tState = 'stopped';
    $('#t-display').classList.remove('running');
    $('#t-display').textContent = fmtT(ms);
    times.unshift({ ms, name: current ? current.c.name : '' });
    store.set('times', times.slice(0, 200));
    renderTimes();
  }
  $('#t-clear').addEventListener('click', () => { times.length = 0; store.set('times', []); renderTimes(); });

  const inPractice = () => location.hash === '#practice';
  const typing = e => e.target.matches('input, textarea');
  document.addEventListener('keydown', e => {
    if (!inPractice() || typing(e) || e.metaKey || e.ctrlKey) return;
    if (tState === 'running') { e.preventDefault(); stopTimer(); return; }
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat && tState !== 'ready') { tState = 'ready'; $('#t-display').classList.add('ready'); $('#t-display').textContent = '0.00'; }
      return;
    }
    if (e.repeat) return;
    if (e.key === 'n' || e.key === 'N') nextCase();
    if (e.key === 'r' || e.key === 'R') reveal();
  });
  document.addEventListener('keyup', e => {
    if (e.code !== 'Space' || tState !== 'ready') return;
    e.preventDefault();
    tState = 'running';
    $('#t-display').classList.remove('ready');
    $('#t-display').classList.add('running');
    tStart = performance.now();
    raf = requestAnimationFrame(tick);
  });
  // Touch / mouse: press on the time to get ready, lift to start; touch anywhere to stop.
  function startTimer() {
    tState = 'running';
    $('#t-display').classList.remove('ready');
    $('#t-display').classList.add('running');
    tStart = performance.now();
    raf = requestAnimationFrame(tick);
  }
  document.addEventListener('pointerdown', e => {
    swallowClick = false;
    if (!inPractice()) return;
    if (tState === 'running') { e.preventDefault(); stopTimer(); swallowClick = true; return; }
    if (e.target.closest('#t-display')) {
      e.preventDefault();
      tState = 'ready';
      $('#t-display').classList.add('ready');
      $('#t-display').textContent = '0.00';
    }
  });
  document.addEventListener('pointerup', e => {
    if (tState === 'ready' && e.target.closest('#t-display')) startTimer();
  });
  // The tap that stops the timer shouldn't also press whatever button it landed on.
  let swallowClick = false;
  document.addEventListener('click', e => {
    if (swallowClick) { swallowClick = false; e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('pointercancel', () => {
    if (tState === 'ready') { tState = 'idle'; $('#t-display').classList.remove('ready'); }
  });
  // Space must not activate a focused button while practising.
  document.addEventListener('keyup', e => { if (e.code === 'Space' && inPractice()) e.preventDefault(); }, true);
  $$('button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));

  // ---------- routing ----------
  function route() {
    const tab = (location.hash || '#f2l').slice(1);
    const valid = ['f2l', 'oll', 'pll', 'practice'].includes(tab) ? tab : 'f2l';
    $$('.tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === valid));
    $('#view-algs').hidden = valid === 'practice';
    $('#view-practice').hidden = valid !== 'practice';
    if (valid === 'practice') {
      if (!current) { renderCustom(); nextCase(); }
    } else {
      if (currentSet !== valid) { currentSet = valid; }
      renderAlgs();
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  renderTimes();
  route();

  // ---------- self test: open with ?test ----------
  if (location.search.includes('test')) {
    const res = [];
    const nonU = Cube.STK.map(([p], i) => (p[1] < 1 ? i : -1)).filter(i => i >= 0);
    const solved = Cube.SOLVED;
    const same = (a, b, idx) => idx.every(i => a[i] === b[i]);
    const eqAll = (a, b) => a.every((v, i) => v === b[i]);
    const fr = Cube.STK.map(([p], i) => ((p[0] === 1 && p[2] === 1 && p[1] < 1) ? i : -1)).filter(i => i >= 0);
    const notFR = nonU.filter(i => !fr.includes(i));
    let bad = 0, checked = 0;
    for (const set of ['f2l', 'oll', 'pll']) {
      for (const c of ALGS[set]) {
        checked++;
        const st = Cube.caseState(c.alg);
        const after = Cube.apply(st, c.alg);
        const errs = [];
        if (!eqAll(Cube.normalize(after), solved)) errs.push('alg does not solve its case');
        if (set === 'f2l' && !same(st, solved, notFR)) errs.push('touches more than FR slot');
        if (set !== 'f2l' && !same(st, solved, nonU)) errs.push('breaks F2L');
        if (set === 'pll' && st.slice(0, 9).some(x => x !== 'U')) errs.push('not oriented');
        // Every variation (after its pre-U) must solve the same case: F2L slot / OLL orientation / PLL up to AUF.
        for (const o of (c.vars || [])) {
          const s2 = Cube.normalize(Cube.apply(st, U_TURN[o.pre] + ' ' + o.alg));
          const ok = set === 'f2l' ? same(s2, solved, nonU)
            : set === 'oll' ? same(s2, solved, nonU) && s2.slice(0, 9).every(x => x === 'U')
            : U_TURN.some(u => eqAll(Cube.apply(s2, u), solved));
          checked++;
          if (!ok) errs.push('variation fails: ' + o.alg);
        }
        // setup scramble (face moves only) must produce the same state
        const setup = Cube.toFaceMoves(Cube.caseOrient(c.alg) + ' ' + Cube.fmt(Cube.inverse(Cube.parse(c.alg))));
        for (let k = 0; k < 4; k++) {
          // practice setups with every AUF must also give the case (up to that AUF)
          const s = Cube.toFaceMoves(Cube.caseOrient(c.alg) + ' ' + Cube.fmt(Cube.inverse(Cube.parse(c.alg))) + ' ' + ['', 'U', 'U2', "U'"][k]);
          const solvedBy = Cube.normalize(Cube.apply(Cube.apply(solved, s), ['', "U'", 'U2', 'U'][k] + ' ' + c.alg));
          if (!eqAll(solvedBy, solved)) errs.push('practice setup AUF ' + k + ' fails');
        }
        if (!eqAll(Cube.apply(solved, setup), st)) errs.push('face-move setup mismatch');
        if (errs.length) { bad++; res.push(`${set} ${c.name}: ${errs.join(', ')}`); }
      }
    }
    const sexy = Cube.apply(solved, "R U R' U' ".repeat(6));
    if (!eqAll(sexy, solved)) { bad++; res.push('(R U R\' U\')x6 not identity'); }
    const msg = `self-test: ${bad ? bad + ' case(s) with problems' : 'all ' + checked + ' algs OK'}\n` + res.join('\n');
    console.log(msg);
    $('#test-banner').hidden = false;
    $('#test-banner').textContent = msg;
  }
})();
