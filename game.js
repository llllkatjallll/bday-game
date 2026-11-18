(() => {
  'use strict';

  const C = window.GAME_CONFIG || {};
  const $ = (s) => document.querySelector(s);

  // ============================================================
  //  Schwierigkeitsgrade
  //  approach = Sekunden, die eine Markierung zum Füllen braucht
  //  win      = Zeitfenster (±s) für PERFECT / GREAT / GOOD
  // ============================================================
  const DIFFS = {
    easy:   { approach: 1.15, win: [0.08, 0.15, 0.22],  eighths: 0,    doubles: 0.08 },
    normal: { approach: 0.9,  win: [0.055, 0.11, 0.17], eighths: 0.35, doubles: 0.18 },
    hard:   { approach: 0.72, win: [0.045, 0.09, 0.14], eighths: 0.75, doubles: 0.28 },
  };
  const VALUE = { perfect: 1, great: 0.7, good: 0.4, miss: 0 };
  const LABEL = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS' };

  // ============================================================
  //  Song-Aufbau (alles wird live per Web Audio synthetisiert)
  // ============================================================
  const BPM = C.bpm || 124;
  const STEP = 60 / BPM / 4; // Länge einer 16tel-Note
  const SECTIONS = [
    ['count', 1], ['intro', 4], ['verse', 8], ['build', 4],
    ['chorus', 8], ['chorus2', 6], ['outro', 2],
  ];
  const BAR_SECTION = [];
  const BAR_IDX = [];
  SECTIONS.forEach(([name, bars]) => {
    for (let i = 0; i < bars; i++) { BAR_SECTION.push(name); BAR_IDX.push(i); }
  });
  const TOTAL_BARS = BAR_SECTION.length;
  const TOTAL_STEPS = TOTAL_BARS * 16;
  const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
  const LEAD = [0, 1, 2, 1, 3, 2, 1, 2];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Notenmuster passend zur Musik erzeugen ----------
  function buildChart(D, seed) {
    const rnd = mulberry32(seed);
    const notes = [];
    const last = new Array(16).fill(-99);
    const gap = D.approach + D.win[2] + 0.08; // ein Feld ist erst wieder frei, wenn die alte Note durch ist
    let prev = [];

    const place = (t, count) => {
      const cand = [];
      for (let c = 0; c < 16; c++) if (t - last[c] >= gap && !prev.includes(c)) cand.push(c);
      for (let i = cand.length - 1; i > 0; i--) {
        const j = (rnd() * (i + 1)) | 0;
        [cand[i], cand[j]] = [cand[j], cand[i]];
      }
      const pick = cand.slice(0, count);
      pick.forEach((c) => { last[c] = t; notes.push({ t, cell: c, judged: false }); });
      if (pick.length) prev = pick;
    };

    for (let bar = 0; bar < TOTAL_BARS; bar++) {
      const sec = BAR_SECTION[bar], idx = BAR_IDX[bar];
      for (let step = 0; step < 16; step++) {
        const t = (bar * 16 + step) * STEP;
        const q = step % 4 === 0, e = step % 4 === 2;
        let p = 0, dbl = 0;
        if (sec === 'intro') p = step % 8 === 0 ? 1 : 0;
        else if (sec === 'verse') { p = q ? 1 : e ? D.eighths * 0.3 : 0; dbl = D.doubles * 0.5; }
        else if (sec === 'build') { p = q ? 1 : e ? D.eighths * 0.6 : 0; dbl = D.doubles * 0.7; }
        else if (sec === 'chorus' || sec === 'chorus2') { p = q ? 1 : e ? D.eighths : 0; dbl = D.doubles; }
        else if (sec === 'outro') {
          if (idx === 0) { p = q ? 1 : 0; dbl = D.doubles; }
          else if (step === 0) { place(t, 2); continue; } // Schlussakkord: zwei Felder
        }
        if (p && rnd() < p) place(t, q && rnd() < dbl ? 2 : 1);
      }
    }
    return notes;
  }

  // ============================================================
  //  Audio
  // ============================================================
  let ctx = null, out = null, noiseBuf = null;

  function initAudio() {
    if (!ctx) {
      // iOS: auch bei Stummschalter Ton abspielen (Safari 16.4+)
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* egal */ }
      ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      const comp = ctx.createDynamicsCompressor();
      comp.connect(ctx.destination);
      out = ctx.createGain();
      out.gain.value = 0.7;
      out.connect(comp);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state !== 'running') ctx.resume();
  }

  function envGain(t, peak, attack, decay) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(out);
    return g;
  }
  function tone(t, freq, dur, type = 'square', vol = 0.1, cutoff = 0) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    let node = o;
    if (cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      o.connect(f);
      node = f;
    }
    node.connect(envGain(t, vol, 0.005, dur));
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function noise(t, vol, decay, type, freq) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    s.connect(f);
    f.connect(envGain(t, vol, 0.001, decay));
    s.start(t);
    s.stop(t + decay + 0.05);
  }
  function kick(t, vol = 0.9) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    o.connect(envGain(t, vol, 0.002, 0.32));
    o.start(t);
    o.stop(t + 0.4);
  }
  const snare = (t, vol = 0.35) => { noise(t, vol, 0.16, 'highpass', 1500); tone(t, 190, 0.08, 'triangle', vol * 0.6); };
  const hat = (t, vol = 0.12) => noise(t, vol, 0.04, 'highpass', 8000);
  const crash = (t, vol = 0.22) => noise(t, vol, 1.6, 'highpass', 4500);
  const chord = (t, notes, dur, vol = 0.035) => notes.forEach((m) => tone(t, mtof(m), dur, 'sawtooth', vol, 1400));

  function scheduleStep(s, t) {
    if (s >= TOTAL_STEPS) return;
    const bar = (s / 16) | 0, step = s % 16;
    const sec = BAR_SECTION[bar], idx = BAR_IDX[bar];
    const ch = PROG[(bar + 3) % 4];
    const root = ch[0] - 24;
    const q = step % 4 === 0, e8 = step % 2 === 0;
    const bass = (cut) => { if (e8) tone(t, mtof(root + (step % 4 === 2 ? 12 : 0)), STEP * 1.6, 'square', 0.08, cut); };

    switch (sec) {
      case 'count':
        if (q) tone(t, step === 0 ? 1046 : 784, 0.08, 'sine', 0.25);
        break;
      case 'intro':
        if (step === 0 || step === 8) kick(t, 0.7);
        if (step % 4 === 2) hat(t);
        if (step === 0) chord(t, ch, STEP * 15);
        break;
      case 'verse':
        if (q) kick(t);
        if (step === 4 || step === 12) snare(t, 0.22);
        if (step % 4 === 2) hat(t, 0.14);
        bass(700);
        if (step === 0) chord(t, ch, STEP * 15, 0.028);
        break;
      case 'build': {
        const lastBar = idx === 3;
        if (q) kick(t);
        if (lastBar) snare(t, 0.1 + 0.3 * step / 15);
        else if (q) snare(t, 0.18);
        hat(t, e8 ? 0.12 : 0.06);
        bass(600 + idx * 500);
        break;
      }
      case 'chorus':
      case 'chorus2': {
        if (q) kick(t);
        if (step === 4 || step === 12) snare(t);
        hat(t, e8 ? 0.12 : 0.06);
        bass(1000);
        if (step === 0) { chord(t, ch, STEP * 15); if (idx === 0) crash(t); }
        if (e8) {
          const tones = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24];
          let k = LEAD[step / 2];
          if (sec === 'chorus2' && idx % 2) k = 3 - k;
          tone(t, mtof(tones[k]), STEP * 1.8, 'square', 0.05, 3200);
        }
        break;
      }
      case 'outro':
        if (idx === 0) {
          if (q) kick(t);
          if (step === 4 || step === 12) snare(t);
          hat(t, e8 ? 0.12 : 0.06);
          bass(900);
          if (step === 0) chord(t, ch, STEP * 15);
        } else if (step === 0) {
          kick(t); crash(t, 0.3);
          chord(t, [57, 60, 64, 69], 2.8, 0.045);
          tone(t, mtof(33), 2.5, 'square', 0.1, 500);
        }
        break;
    }
  }

  let startTime = 0, nextStep = 0, schedId = null;
  function pump() {
    while (nextStep < TOTAL_STEPS && startTime + nextStep * STEP < ctx.currentTime + 0.15) {
      scheduleStep(nextStep, startTime + nextStep * STEP);
      nextStep++;
    }
  }
  function startScheduler() { nextStep = 0; pump(); schedId = setInterval(pump, 25); }
  function stopScheduler() { clearInterval(schedId); schedId = null; }

  function hitSound(kind) {
    if (!ctx) return;
    tone(ctx.currentTime, kind === 'perfect' ? 1760 : 1320, 0.05, 'sine', 0.08);
  }

  // ============================================================
  //  Bildschirme
  // ============================================================
  function show(id) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', el.id === id));
  }
  const fmt = (n) => Math.round(n).toLocaleString('de-DE');
  const passFor = (k) => (C.passScore && C.passScore[k]) || 700000;

  let diffKey = DIFFS[C.difficulty] ? C.difficulty : 'normal';
  let fails = 0;

  $('#recipient').textContent = C.recipientName || '';
  function updateDiffUI() {
    document.querySelectorAll('#diff button').forEach((b) => b.classList.toggle('sel', b.dataset.diff === diffKey));
    $('#goal-score').textContent = fmt(passFor(diffKey));
  }
  document.querySelectorAll('#diff button').forEach((b) =>
    b.addEventListener('click', () => { diffKey = b.dataset.diff; updateDiffUI(); }));
  updateDiffUI();

  // ============================================================
  //  Spielfeld
  // ============================================================
  const gridEl = $('#grid');
  const cells = [];
  for (let i = 0; i < 16; i++) {
    const el = document.createElement('div');
    el.className = 'cell';
    el.innerHTML = '<div class="target"></div><div class="marker"></div><div class="judge"></div>';
    gridEl.appendChild(el);
    cells.push({ el, marker: el.querySelector('.marker'), judge: el.querySelector('.judge'), shown: false });
    // Pointer Events: jeder Finger löst sein eigenes pointerdown aus → Multitouch
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('pressed'); onTap(i); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
      el.addEventListener(ev, () => el.classList.remove('pressed')));
  }

  let D, notes, queues, running = false, paused = false, endT = 0, latency = 0;
  let counts, combo, maxCombo, points, lastCd = null;

  const songTime = () => ctx.currentTime - startTime - latency;

  function startGame() {
    initAudio();
    D = DIFFS[diffKey];
    notes = buildChart(D, (C.seed || 1) * 7 + diffKey.length);
    queues = Array.from({ length: 16 }, () => ({ list: [], i: 0 }));
    notes.forEach((n) => queues[n.cell].list.push(n));
    counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    combo = 0; maxCombo = 0; points = 0; lastCd = null;
    endT = notes[notes.length - 1].t + 1.8;
    latency = (ctx.outputLatency || ctx.baseLatency || 0) + (C.audioOffsetMs || 0) / 1000;

    cells.forEach((c) => {
      c.shown = false;
      c.el.classList.remove('active', 'flash', 'pressed');
      c.marker.style.opacity = '0';
      c.judge.className = 'judge';
    });
    updateHud();
    $('#pause').hidden = true;
    show('game');

    startTime = ctx.currentTime + 0.4;
    startScheduler();
    running = true;
    paused = false;
    requestAnimationFrame(frame);
  }

  function frame() {
    if (!running) return;
    const now = songTime();
    const A = D.approach, W = D.win[2];

    for (let c = 0; c < 16; c++) {
      const q = queues[c], cell = cells[c];
      let n = q.list[q.i];
      if (n && now > n.t + W) { judge(c, n, 'miss'); n = q.list[q.i]; }
      if (n && now >= n.t - A) {
        const p = (now - (n.t - A)) / A;
        cell.marker.style.transform = `scale(${0.15 + 0.85 * Math.min(p, 1)})`;
        cell.marker.style.opacity = p > 1 ? String(Math.max(0.2, 1 - ((p - 1) * A) / W)) : String(Math.min(1, 0.35 + p));
        cell.marker.classList.toggle('ready', p > 0.88);
        if (!cell.shown) { cell.shown = true; cell.el.classList.add('active'); }
      } else if (cell.shown) {
        hideMarker(cell);
      }
    }

    // Countdown 3-2-1-Los im ersten Takt
    let txt = '';
    if (now >= 0 && now < 16 * STEP) txt = ['3', '2', '1', 'Los!'][Math.floor(now / (4 * STEP))];
    if (txt !== lastCd) {
      const cd = $('#countdown');
      cd.textContent = txt;
      cd.classList.remove('pulse');
      if (txt) { void cd.offsetWidth; cd.classList.add('pulse'); }
      lastCd = txt;
    }

    $('#progress-bar').style.width = `${Math.max(0, Math.min(1, now / endT)) * 100}%`;

    if (now > endT) { finish(); return; }
    requestAnimationFrame(frame);
  }

  function hideMarker(cell) {
    cell.shown = false;
    cell.el.classList.remove('active');
    cell.marker.style.opacity = '0';
    cell.marker.classList.remove('ready');
  }

  function onTap(c) {
    if (!running || paused) return;
    const n = queues[c].list[queues[c].i];
    if (!n) return;
    const ad = Math.abs(songTime() - n.t);
    if (ad > D.win[2]) return; // viel zu früh → zählt nicht
    const kind = ad <= D.win[0] ? 'perfect' : ad <= D.win[1] ? 'great' : 'good';
    judge(c, n, kind);
    hitSound(kind);
  }

  function judge(c, n, kind) {
    n.judged = true;
    queues[c].i++;
    counts[kind]++;
    points += VALUE[kind];
    if (kind === 'miss') combo = 0;
    else { combo++; maxCombo = Math.max(maxCombo, combo); }

    const cell = cells[c];
    hideMarker(cell);
    const j = cell.judge;
    j.textContent = LABEL[kind];
    j.className = 'judge ' + kind;
    void j.offsetWidth;
    j.classList.add('show');
    if (kind !== 'miss') {
      cell.el.classList.remove('flash');
      void cell.el.offsetWidth;
      cell.el.classList.add('flash');
    }
    updateHud();
  }

  function currentScore() { return notes.length ? (1e6 * points) / notes.length : 0; }

  function updateHud() {
    $('#score').textContent = fmt(currentScore());
    const comboEl = $('#combo');
    comboEl.textContent = combo;
    comboEl.classList.remove('bump');
    if (combo > 0) { void comboEl.offsetWidth; comboEl.classList.add('bump'); }
  }

  // Pause, wenn App/Tab verlassen wird
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running && !paused) {
      paused = true;
      ctx.suspend();
      $('#pause').hidden = false;
    }
  });
  $('#pause').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    ctx.resume().then(() => { paused = false; $('#pause').hidden = true; });
  });

  // ============================================================
  //  Ergebnis
  // ============================================================
  function finish() {
    running = false;
    stopScheduler();
    const score = currentScore();
    const pass = score >= passFor(diffKey);
    if (!pass) fails++;

    $('#res-title').textContent = pass ? 'Geschafft! 🎉' : score > passFor(diffKey) - 100000 ? 'Ganz knapp!' : 'Leider nicht…';
    $('#res-title').className = pass ? 'pass' : 'fail';
    $('#res-score').textContent = fmt(score);
    $('#res-msg').textContent = pass
      ? 'Wahnsinn! Da wartet etwas ganz Besonderes auf dich …'
      : `Du brauchst ${fmt(passFor(diffKey))} Punkte. Versuch's nochmal – du schaffst das!`;
    ['perfect', 'great', 'good', 'miss'].forEach((k) => { $('#r-' + k).textContent = counts[k]; });
    $('#r-combo').textContent = maxCombo;

    $('#btn-reward').hidden = !pass;
    $('#btn-retry').hidden = pass;
    $('#btn-easier').hidden = pass || diffKey === 'easy' || fails < 2;
    show('result');
  }

  $('#btn-start').addEventListener('click', startGame);
  $('#btn-retry').addEventListener('click', startGame);
  $('#btn-easier').addEventListener('click', () => {
    diffKey = diffKey === 'hard' ? 'normal' : 'easy';
    updateDiffUI();
    startGame();
  });
  $('#btn-menu').addEventListener('click', () => show('start'));
  $('#btn-reward').addEventListener('click', showWin);
  $('#btn-again').addEventListener('click', () => { stopConfetti(); show('start'); });

  // ============================================================
  //  Gewonnen: Gutschein + Konfetti
  // ============================================================
  function showWin() {
    const v = C.voucher || {};
    $('#win-title').textContent = C.winTitle || 'Herzlichen Glückwunsch!';
    $('#win-text').textContent = C.winText || '';
    $('#v-heading').textContent = v.heading || 'GUTSCHEIN';
    $('#v-recipient').textContent = C.recipientName || '';
    $('#v-title').textContent = v.title || '';
    $('#v-details').textContent = v.details || '';
    $('#v-from').textContent = C.fromName || '';
    $('#v-code').textContent = v.code || '';
    show('win');
    startConfetti();
    if (ctx) {
      const t = ctx.currentTime + 0.05;
      [72, 76, 79, 84].forEach((m, i) => tone(t + i * 0.12, mtof(m), 0.3, 'square', 0.07, 3000));
      chord(t + 0.48, [60, 64, 67, 72], 1.2, 0.04);
    }
  }

  let confettiGen = 0;
  function startConfetti() {
    const cv = $('#confetti'), g = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    let W = 0, H = 0;
    const resize = () => { W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr; };
    resize();
    window.addEventListener('resize', resize);
    const colors = ['#ff3d8b', '#ffb03b', '#3de8ff', '#8dff8a', '#c77dff'];
    const P = Array.from({ length: 160 }, () => ({
      x: Math.random() * W, y: -Math.random() * H,
      vy: (1.2 + Math.random() * 2.5) * dpr, vx: (Math.random() - 0.5) * dpr,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.2,
      s: (6 + Math.random() * 7) * dpr, c: colors[(Math.random() * colors.length) | 0],
    }));
    const startedAt = performance.now();
    const gen = ++confettiGen;
    (function loop() {
      g.clearRect(0, 0, W, H);
      if (gen !== confettiGen) { window.removeEventListener('resize', resize); return; }
      const recycle = performance.now() - startedAt < 8000; // nach 8s ausrieseln lassen
      let any = false;
      P.forEach((p) => {
        p.x += p.vx + Math.sin(p.y / (30 * dpr)) * 0.6 * dpr;
        p.y += p.vy;
        p.r += p.vr;
        if (p.y > H + 20 && recycle) { p.y = -20; p.x = Math.random() * W; }
        if (p.y <= H + 20) any = true;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.r);
        g.fillStyle = p.c;
        g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        g.restore();
      });
      if (any) requestAnimationFrame(loop);
      else { g.clearRect(0, 0, W, H); window.removeEventListener('resize', resize); }
    })();
  }
  function stopConfetti() { confettiGen++; }

  // ============================================================
  //  Allgemeines
  // ============================================================
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  // Vorschau für die schenkende Person: index.html?win zeigt direkt den Gutschein
  if (new URLSearchParams(location.search).has('win')) showWin();
})();
