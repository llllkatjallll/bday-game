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
    easy:   { approach: 1.15, win: [0.08, 0.15, 0.22],  eighths: 0,    doubles: 0.08, minGap: 0.5 },
    normal: { approach: 0.9,  win: [0.055, 0.11, 0.17], eighths: 0.35, doubles: 0.18, minGap: 0.32 },
    hard:   { approach: 0.72, win: [0.045, 0.09, 0.14], eighths: 0.75, doubles: 0.28, minGap: 0.22 },
  };
  const VALUE = { perfect: 1, great: 0.7, good: 0.4, miss: 0 };
  const LABEL = { perfect: 'PERFECT', great: 'GREAT, BIBER', good: 'GOOD', miss: 'MISS' };

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
  // Verteilt Noten auf dem 4×4-Feld. Die Position folgt der Melodie:
  //  Ton höher → eine Reihe nach oben, tiefer → nach unten, gleich → seitlich weiter.
  //  Dabei wandert die Position Schritt für Schritt (Treppen, Wellen …) statt zu springen.
  //  Ohne Tonhöhe: sanfter Zufallsweg zu Nachbarfeldern.
  //  Ein Feld ist erst wieder frei, wenn die alte Note durch ist.
  function makePlacer(D, rnd, notes) {
    const last = new Array(16).fill(-99);
    const gap = D.approach + D.win[2] + 0.08;
    let prev = [], r = 1, c = 1, dir = 1, prevPitch = null;
    const free = (cell, t, excl) => t - last[cell] >= gap && !prev.includes(cell) && !excl.includes(cell);
    const nearest = (rr, cc, t, excl = []) => {
      let best = -1, bd = Infinity;
      for (let cell = 0; cell < 16; cell++) {
        if (!free(cell, t, excl)) continue;
        const d = Math.abs((cell >> 2) - rr) * 1.1 + Math.abs((cell & 3) - cc) + rnd() * 0.05;
        if (d < bd) { bd = d; best = cell; }
      }
      return best;
    };
    return (t, count, pitch) => {
      let dr;
      if (pitch != null && prevPitch != null) {
        const d = pitch - prevPitch, ad = Math.abs(d);
        dr = ad < 0.6 ? 0 : (ad >= 5 && ad < 10 ? 2 : 1) * (d < 0 ? 1 : -1); // tiefer = weiter unten
      } else {
        dr = rnd() < 0.5 ? 0 : rnd() < 0.5 ? 1 : -1;
      }
      if (pitch != null) prevPitch = pitch;
      let nc = c + dir;
      if (nc < 0 || nc > 3) { dir = -dir; nc = c + dir; }
      let nr = r + dr;
      if (nr > 3) nr -= 4; // unten raus → oben weiter (Treppe läuft weiter runter)
      if (nr < 0) nr += 4;
      const first = nearest(nr, nc, t);
      if (first < 0) return;
      const pick = [first];
      r = first >> 2; c = first & 3;
      if (count > 1) {
        const second = nearest(r, 3 - c, t, pick); // gespiegelt auf der anderen Seite
        if (second >= 0) pick.push(second);
      }
      pick.forEach((cell) => { last[cell] = t; notes.push({ t, cell, judged: false }); });
      prev = pick;
    };
  }

  function buildChart(D, seed) {
    const rnd = mulberry32(seed);
    const notes = [];
    const place = makePlacer(D, rnd, notes);

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

  function initAudio(resume = true) {
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
    if (resume && ctx.state !== 'running') ctx.resume();
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
    if (!ctx || C.hitSounds === false) return;
    tone(ctx.currentTime, kind === 'perfect' ? 1760 : 1320, 0.05, 'sine', songBuf ? 0.04 : 0.08);
  }

  // ============================================================
  //  Eigener Song (MP3/M4A/OGG/WAV) – Tempo & Beats werden erkannt
  // ============================================================
  const params = new URLSearchParams(location.search);
  // Liste aus config.js (songs: [...]); ?song=datei.mp3 überschreibt sie zum Testen.
  // Ältere Configs mit nur "song: {...}" funktionieren weiterhin.
  const SONGS = params.get('song') ? [{ file: params.get('song') }]
    : Array.isArray(C.songs) && C.songs.length ? C.songs.slice()
    : C.song && C.song.file ? [C.song] : [];
  if (!SONGS.length) SONGS.push({ file: '', title: 'Eingebauter Beat' });

  let SONG = null, songBuf = null, songInfo = null, songSrc = null, songGain = null;
  const songCache = new Map(); // Lied → { buf, info } (Laden + Analyse nur einmal)

  const songName = (s) => s.title ||
    (s.file ? decodeURIComponent(s.file.split('/').pop().replace(/\.[^.]+$/, '')).replace(/[_-]+/g, ' ') : 'Eingebauter Beat');

  async function loadSong(s) {
    if (songCache.has(s)) return songCache.get(s);
    initAudio(false);
    const res = await fetch(s.file);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.arrayBuffer();
    const buf = await new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail));
    const info = analyzeSong(buf, s);
    const msg = `„${songName(s)}“: ${info.bpm.toFixed(2)} BPM, erster Beat bei ${info.firstBeat.toFixed(3)} s, ` +
      `Raster-Treffer ${Math.round(info.gridFit * 100)} % → Modus „${info.mode === 'beat' ? 'Beat-Raster' : 'Einsätze'}“`;
    console.log(msg);
    if (params.has('debug')) {
      $('#song-info').textContent = msg;
      $('#song-info').hidden = false;
      window.__beatTap = { songBuf: buf, songInfo: info, analyzeSong, buildSongChart, DIFFS };
    }
    const entry = { buf, info };
    songCache.set(s, entry);
    return entry;
  }

  function makeFFT(N) {
    const lev = Math.log2(N);
    const rev = new Uint32Array(N);
    for (let i = 0; i < N; i++) {
      let r = 0;
      for (let b = 0; b < lev; b++) r |= ((i >> b) & 1) << (lev - 1 - b);
      rev[i] = r;
    }
    const cs = new Float32Array(N / 2), sn = new Float32Array(N / 2);
    for (let i = 0; i < N / 2; i++) { cs[i] = Math.cos((2 * Math.PI * i) / N); sn[i] = -Math.sin((2 * Math.PI * i) / N); }
    return (re, im) => {
      for (let i = 0; i < N; i++) {
        const j = rev[i];
        if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
      }
      for (let size = 2; size <= N; size <<= 1) {
        const half = size >> 1, step = N / size;
        for (let i = 0; i < N; i += size) {
          for (let j = 0, k = 0; j < half; j++, k += step) {
            const a = i + j, l = a + half;
            const tre = re[l] * cs[k] - im[l] * sn[k];
            const tim = re[l] * sn[k] + im[l] * cs[k];
            re[l] = re[a] - tre; im[l] = im[a] - tim;
            re[a] += tre; im[a] += tim;
          }
        }
      }
    };
  }

  function analyzeSong(buf, cfg) {
    const sr = buf.sampleRate;
    const start = Math.max(0, cfg.startAt || 0);
    const dur = Math.max(10, Math.min(cfg.duration || 90, buf.duration - start));
    const chs = [];
    for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) chs.push(buf.getChannelData(c));

    // 1) Onset-Kurve per Spectral Flux: wie stark nimmt die Energie in den Frequenzbändern zu?
    //    Frame f ist um die Zeit f*HOP zentriert.
    const N = 1024, HOP = 256, fr = sr / HOP;
    const n0 = Math.floor(start * sr);
    const nF = Math.floor((dur * sr) / HOP);
    const fft = makeFFT(N);
    const win = new Float32Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
    const maxBin = Math.min(N / 2, Math.round((10000 * N) / sr));
    const re = new Float32Array(N), im = new Float32Array(N);
    let prevMag = new Float32Array(maxBin), mag = new Float32Array(maxBin);
    const raw = new Float32Array(nF), loud = new Float32Array(nF);
    for (let f = 0; f < nF; f++) {
      const base = n0 + f * HOP - N / 2;
      let e = 0;
      for (let i = 0; i < N; i++) {
        let x = 0;
        const idx = base + i;
        for (const ch of chs) x += ch[idx] || 0;
        x /= chs.length;
        e += x * x;
        re[i] = x * win[i];
        im[i] = 0;
      }
      fft(re, im);
      let flux = 0;
      for (let k = 1; k < maxBin; k++) {
        const m = Math.log(1 + 100 * Math.sqrt(re[k] * re[k] + im[k] * im[k]));
        mag[k] = m;
        const d = m - prevMag[k];
        if (d > 0) flux += d;
      }
      raw[f] = f === 0 ? 0 : flux;
      loud[f] = Math.log(1 + (1000 * e) / N);
      const tmp = prevMag; prevMag = mag; mag = tmp;
    }
    // lokalen Mittelwert abziehen → nur echte Spitzen bleiben
    const env = new Float32Array(nF);
    const W = Math.round(fr * 0.25);
    let acc = 0;
    for (let f = 0; f < nF + W; f++) {
      if (f < nF) acc += raw[f];
      if (f - 2 * W - 1 >= 0) acc -= raw[f - 2 * W - 1];
      const c = f - W;
      if (c >= 0 && c < nF) env[c] = Math.max(0, raw[c] - acc / (2 * W + 1));
    }
    const val = (t) => {
      const x = t * fr, i = Math.floor(x);
      if (i < 0 || i + 1 >= nF) return 0;
      const k = x - i;
      return env[i] * (1 - k) + env[i + 1] * k;
    };
    const valMax = (t, w) => Math.max(val(t - w), val(t - w / 2), val(t), val(t + w / 2), val(t + w));
    const pct = (arr, q) => { const s = [...arr].sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))] || 1; };

    // 2) Einzelne Einsätze (Peaks) finden – für Musik mit wechselndem Tempo
    const PW = Math.round(fr * 0.05);
    const pre = new Float64Array(nF + 1);
    for (let f = 0; f < nF; f++) pre[f + 1] = pre[f] + env[f];
    const LW = Math.round(fr * 1.5);
    const peaks = [];
    for (let f = 1; f < nF - 1; f++) {
      const v = env[f];
      if (v <= 0 || v < env[f - 1] || v <= env[f + 1]) continue;
      let isMax = true;
      for (let g = Math.max(0, f - PW); g <= Math.min(nF - 1, f + PW); g++) if (env[g] > v) { isMax = false; break; }
      if (!isMax) continue;
      const a = env[f - 1], c = env[f + 1], den = a - 2 * v + c;
      const off = den < 0 ? (0.5 * (a - c)) / den : 0;
      const lo = Math.max(0, f - LW), hi = Math.min(nF, f + LW);
      const local = (pre[hi] - pre[lo]) / (hi - lo) || 1e-6;
      peaks.push({ t: (f + off) / fr, sg: v, sl: v / local, loud: loud[f] });
    }
    const refG = pct(peaks.map((p) => p.sg), 0.9) || 1;
    const refL = pct(peaks.map((p) => p.sl), 0.9) || 1;
    const loudMedP = pct(peaks.map((p) => p.loud), 0.5) || 1;
    peaks.forEach((p) => { p.sg /= refG; p.sl /= refL; p.loud /= loudMedP; });

    // 3) Tempo grob per Autokorrelation (bevorzugt um ~100 BPM, vermeidet Doppelt/Halb-Fehler)
    let period;
    if (cfg.bpm) period = 60 / cfg.bpm;
    else {
      let best = -1, bestLag = 0;
      for (let lag = Math.floor((fr * 60) / 180); lag <= Math.ceil((fr * 60) / 60); lag++) {
        let s = 0;
        for (let i = 0; i + lag < nF; i++) s += env[i] * env[i + lag];
        const bpm = (60 * fr) / lag;
        s = (s / (nF - lag)) * Math.exp(-0.5 * Math.pow(Math.log2(bpm / 100) / 0.9, 2));
        if (s > best) { best = s; bestLag = lag; }
      }
      period = bestLag / fr;
    }

    // 4) Tempo fein + Phase: das Beat-Raster suchen, das am besten auf die Onsets passt
    const fit = (p, ph) => { let s = 0, n = 0; for (let t = ph; t < dur; t += p) { s += val(t); n++; } return s / n; };
    let bestP = period, bestPh = 0, bestS = -1;
    const range = cfg.bpm ? 0 : 0.03 * period;
    const pStep = range ? range / 150 : 1;
    const fixedPh = cfg.firstBeat != null ? ((((cfg.firstBeat - start) % period) + period) % period) : null;
    for (let p = period - range; p <= period + range + 1e-9; p += pStep) {
      if (fixedPh != null) { const s = fit(p, fixedPh); if (s > bestS) { bestS = s; bestP = p; bestPh = fixedPh; } continue; }
      for (let ph = 0; ph < p; ph += 0.004) {
        const s = fit(p, ph);
        if (s > bestS) { bestS = s; bestP = p; bestPh = ph; }
      }
    }
    if (fixedPh == null) {
      const c = bestPh;
      for (let ph = c - 0.004; ph <= c + 0.004; ph += 0.0005) {
        const s = fit(bestP, ph);
        if (s > bestS && ph >= 0) { bestS = s; bestPh = ph; }
      }
    }

    // 5) Passt ein festes Raster überhaupt? Anteil der starken Einsätze, die auf dem 8tel-Raster liegen
    const half = bestP / 2;
    let hit = 0, tot = 0;
    peaks.forEach((p) => {
      if (p.sg < 0.3) return;
      const d = (((p.t - bestPh) % half) + half) % half;
      tot += p.sg;
      if (Math.min(d, half - d) < 0.035) hit += p.sg;
    });
    const gridFit = tot ? hit / tot : 0;
    const chance = Math.min(1, 0.07 / half); // so viel Treffer gäbe es rein zufällig
    const mode = cfg.mode === 'beat' || cfg.mode === 'onset' ? cfg.mode : gridFit >= 1.8 * chance ? 'beat' : 'onset';

    // 6) Beats mit Stärke, Lautstärke und (geswingtem) Offbeat
    const beats = [];
    for (let t = bestPh; t < dur; t += bestP) {
      let ot = t + bestP / 2, os = 0;
      for (let x = t + 0.35 * bestP; x <= t + 0.75 * bestP; x += 0.005) {
        const v = val(x);
        if (v > os) { os = v; ot = x; }
      }
      const fi = Math.min(nF - 1, Math.max(0, Math.round(t * fr)));
      beats.push({ t, s: valMax(t, 0.03), loud: loud[fi], off: { t: ot, s: os } });
    }
    const ref = pct(beats.map((b) => b.s), 0.85) || 1;
    const loudMed = pct(beats.map((b) => b.loud), 0.5) || 1;
    beats.forEach((b) => { b.s /= ref; b.off.s /= ref; b.loud /= loudMed; });

    // 7) Tonhöhe einer Note schätzen: neu hinzugekommene Obertöne (Spektrum nach minus vor dem
    //    Einsatz) → Grundton mit der stärksten harmonischen Summe. Ergebnis in Halbtönen (MIDI).
    const N2 = 4096, fft2 = makeFFT(N2);
    const win2 = new Float32Array(N2);
    for (let i = 0; i < N2; i++) win2[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N2);
    const maxB2 = Math.round((6000 * N2) / sr);
    const re2 = new Float32Array(N2), im2 = new Float32Array(N2);
    const spec = (ct) => {
      const base = n0 + Math.round(ct * sr) - N2 / 2;
      for (let i = 0; i < N2; i++) {
        let x = 0;
        for (const ch of chs) x += ch[base + i] || 0;
        re2[i] = (x / chs.length) * win2[i];
        im2[i] = 0;
      }
      fft2(re2, im2);
      const m = new Float32Array(maxB2);
      for (let k = 0; k < maxB2; k++) m[k] = Math.sqrt(re2[k] * re2[k] + im2[k] * im2[k]);
      return m;
    };
    const pitchCache = new Map();
    const pitchAt = (t) => {
      const key = Math.round(t * 1000);
      if (pitchCache.has(key)) return pitchCache.get(key);
      const A = spec(t + 0.06), B = spec(t - 0.06);
      const dif = new Float32Array(maxB2);
      let sA = 0, sD = 0;
      for (let k = 0; k < maxB2; k++) { dif[k] = Math.max(0, A[k] - 0.7 * B[k]); sA += A[k]; sD += dif[k]; }
      const S = sD > 0.15 * sA ? dif : A;
      const at = (bin) => { const i = Math.floor(bin), f = bin - i; return i + 1 < maxB2 ? S[i] * (1 - f) + S[i + 1] * f : 0; };
      let best = -1, bestM = null;
      for (let m = 45; m <= 96; m += 1 / 3) {
        const f0 = 440 * Math.pow(2, (m - 69) / 12);
        let s = 0;
        for (let h = 1; h <= 6; h++) {
          const bin = (h * f0 * N2) / sr;
          if (bin >= maxB2 - 1) break;
          s += Math.pow(0.8, h - 1) * at(bin);
        }
        if (s > best) { best = s; bestM = m; }
      }
      pitchCache.set(key, bestM);
      return bestM;
    };

    return {
      period: bestP, bpm: 60 / bestP, firstBeat: start + bestPh, dur, beats, peaks, gridFit, mode, pitchAt,
      cdBeat: Math.min(0.75, Math.max(0.45, bestP)), // Takt für den 3-2-1-Countdown
    };
  }

  function buildSongChart(D, info, seed) {
    const events = info.mode === 'onset' ? onsetEvents(D, info) : beatEvents(D, info, mulberry32(seed + 1));
    if (!events.length) return [];
    // Die stärksten/lautesten Noten werden Doppel-Tabs (Anteil je nach Schwierigkeit)
    const share = D.doubles * 0.7;
    const pw = events.filter((e) => e.canDouble).map((e) => e.power).sort((a, b) => a - b);
    const thr = pw.length ? pw[Math.min(pw.length - 1, Math.floor((1 - share) * pw.length))] : Infinity;
    const notes = [];
    const place = makePlacer(D, mulberry32(seed), notes);
    events.forEach((e, i) => {
      const dbl = i === events.length - 1 || (e.canDouble && e.power >= thr);
      place(e.t, dbl ? 2 : 1, info.pitchAt(e.t));
    });
    return notes;
  }

  // erste Note frühestens nach so vielen Sekunden Musik (Countdown läuft vorher in Stille)
  const LEAD_IN = 1.0;

  // Noten direkt auf hörbare Einsätze – folgt auch Tempowechseln (Klassik, Rubato …)
  function onsetEvents(D, info) {
    const firstT = LEAD_IN;
    const lastT = info.dur - 3.5;
    const cands = info.peaks
      .filter((p) => p.t >= firstT && p.t <= lastT && p.loud > 0.3 && (p.sg >= 0.12 || p.sl >= 0.5))
      .map((p) => ({
        t: p.t,
        score: 0.5 * Math.min(p.sg, 2) + 0.5 * Math.min(p.sl, 2),
        power: p.sg * (0.5 + 0.5 * Math.min(p.loud, 2)), // Anschlag × Lautstärke
        canDouble: true,
      }))
      .sort((a, b) => b.score - a.score);
    const picked = [];
    for (const c of cands) if (picked.every((a) => Math.abs(a.t - c.t) >= D.minGap)) picked.push(c);
    return picked.sort((a, b) => a.t - b.t);
  }

  // Noten auf einem festen Beat-Raster (gleichmäßiger Takt)
  function beatEvents(D, info, rnd) {
    const ev = [];
    const p = info.period;
    const fast = p < 0.42; // bei schnellen Songs nur jeden 2. Beat als Hauptnote (außer „Schwer“)
    const firstT = LEAD_IN;
    const lastT = info.dur - 3.5;
    let k = 0, lastBeat = null;
    for (const b of info.beats) {
      const i = k++;
      if (b.t < firstT) continue;
      if (b.t > lastT) { if (!lastBeat) lastBeat = b; continue; }
      if (b.loud < 0.35) continue; // leise Stelle → Pause
      const main = !fast || D === DIFFS.hard || i % 2 === 0;
      const power = b.s * (0.5 + 0.5 * Math.min(b.loud, 2));
      if (main) {
        if (rnd() < (b.s < 0.15 ? 0.35 : 1)) ev.push({ t: b.t, power, canDouble: true });
        const o = b.off;
        if (D.eighths && p / 2 >= 0.24 && rnd() < D.eighths * Math.min(1, o.s)) ev.push({ t: o.t, power: 0, canDouble: false });
      } else if (D.eighths && rnd() < D.eighths * Math.min(1, b.s)) {
        ev.push({ t: b.t, power: 0, canDouble: false });
      }
    }
    if (lastBeat) ev.push({ t: lastBeat.t, power: 0, canDouble: false });
    return ev;
  }

  function playSong(t0) {
    stopSong();
    const st = SONG.startAt || 0, dur = songInfo.dur;
    const v = SONG.volume != null ? SONG.volume : 1;
    songSrc = ctx.createBufferSource();
    songSrc.buffer = songBuf;
    songGain = ctx.createGain();
    songGain.gain.setValueAtTime(st > 0 ? 0.0001 : v, t0);
    if (st > 0) songGain.gain.exponentialRampToValueAtTime(v, t0 + 0.6);
    songGain.gain.setValueAtTime(v, t0 + dur - 3);
    songGain.gain.linearRampToValueAtTime(0, t0 + dur);
    songSrc.connect(songGain);
    songGain.connect(ctx.destination);
    songSrc.start(t0, st, dur);
  }
  function stopSong() {
    if (!songSrc) return;
    const t = ctx.currentTime;
    songGain.gain.cancelScheduledValues(t);
    songGain.gain.setValueAtTime(songGain.gain.value, t);
    songGain.gain.linearRampToValueAtTime(0, t + 0.8);
    songSrc.stop(t + 0.85);
    songSrc = null;
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

  // glänzende Farbpaare: [obere Hälfte, untere Hälfte]
  const NOTE_COLORS = [
    ['#7dffb0', '#16b86a'], // grün
    ['#ffd166', '#ff7a1a'], // orange
    ['#ff7ab8', '#e0186f'], // pink
    ['#7ee8ff', '#1f8fff'], // blau
    ['#c79bff', '#7a35ff'], // lila
    ['#fff27a', '#e6b800'], // gelb
  ];
  // ============================================================
  //  Liedauswahl
  // ============================================================
  const DIFF_LABEL = { easy: 'Leicht', normal: 'Normal', hard: 'Schwer' };
  const SONG_ICONS = ['♪', '♫', '♬', '♩'];
  const songBtns = SONGS.map((s, i) => {
    const b = document.createElement('button');
    b.className = 'song';
    const [c1, c2] = NOTE_COLORS[(i + 1) % NOTE_COLORS.length];
    b.style.setProperty('--c1', c1);
    b.style.setProperty('--c2', c2);
    b.innerHTML = '<span class="song-icon"></span><span class="song-text"><b></b><small></small></span><span class="song-status"></span>';
    b.querySelector('.song-icon').textContent = SONG_ICONS[i % SONG_ICONS.length];
    b.querySelector('b').textContent = songName(s);
    const sub = [s.artist, s.file ? '' : 'eingebaute Musik'].filter(Boolean).join(' · ');
    b.querySelector('small').textContent = sub;
    b.querySelector('small').hidden = !sub;
    b.addEventListener('click', () => pickSong(s, b));
    $('#song-list').appendChild(b);
    return b;
  });

  function showSongs() {
    $('#songs-diff').textContent = `Schwierigkeit: ${DIFF_LABEL[diffKey]} · Ziel ${fmt(passFor(diffKey))} Punkte`;
    show('songs');
  }

  let picking = false;
  async function pickSong(s, btn) {
    if (picking) return;
    initAudio(); // im Klick: Audio freischalten (iOS)
    $('#song-error').hidden = true;
    if (s.file && !songCache.has(s)) {
      picking = true;
      songBtns.forEach((b) => { b.disabled = true; });
      btn.classList.remove('failed');
      btn.classList.add('loading');
      btn.querySelector('.song-status').textContent = 'lädt …';
      try {
        await loadSong(s);
        btn.querySelector('.song-status').textContent = '';
      } catch (err) {
        console.error(err);
        btn.classList.add('failed');
        btn.querySelector('.song-status').textContent = 'Fehler';
        $('#song-error').textContent = `„${s.file}“ konnte nicht geladen werden.`;
        $('#song-error').hidden = false;
        return;
      } finally {
        picking = false;
        btn.classList.remove('loading');
        songBtns.forEach((b) => { b.disabled = false; });
      }
    }
    SONG = s;
    const entry = s.file ? songCache.get(s) : null;
    songBuf = entry ? entry.buf : null;
    songInfo = entry ? entry.info : null;
    startGame();
  }

  // ============================================================
  //  Spielfeld
  // ============================================================
  const gridEl = $('#grid');
  const cells = [];
  for (let i = 0; i < 16; i++) {
    const el = document.createElement('div');
    el.className = 'cell';
    el.innerHTML = '<div class="target"></div><div class="marker"><div class="half top"></div><div class="half bot"></div></div><div class="judge"></div>';
    gridEl.appendChild(el);
    cells.push({ el, marker: el.querySelector('.marker'), judge: el.querySelector('.judge'), shown: false });
    // Pointer Events: jeder Finger löst sein eigenes pointerdown aus → Multitouch
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('pressed'); onTap(i); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
      el.addEventListener(ev, () => el.classList.remove('pressed')));
  }

  let D, notes, queues, running = false, paused = false, endT = 0, latency = 0;
  let counts, combo, maxCombo, points, lastCd = null, beatLen = 1;

  const songTime = () => ctx.currentTime - startTime - latency;

  function startGame() {
    initAudio();
    D = DIFFS[diffKey];
    const seed = (C.seed || 1) * 7 + diffKey.length;
    notes = SONG && songBuf ? buildSongChart(D, songInfo, seed) : [];
    const useSong = notes.length > 0;
    if (!useSong) notes = buildChart(D, seed);
    beatLen = Math.min(0.75, Math.max(0.5, useSong ? songInfo.cdBeat : 4 * STEP));
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

    // 3-2-1 läuft vor dem Start (Zeit 0 = Musikbeginn), mit leisen Klicks
    startTime = ctx.currentTime + 0.4 + 3 * beatLen;
    for (let k = 3; k >= 1; k--) tone(startTime - k * beatLen, 880, 0.06, 'sine', 0.08);
    tone(startTime, 1320, 0.09, 'sine', 0.08);
    if (useSong) playSong(startTime);
    else startScheduler();
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
        if (cell.note !== n) setNoteColor(cell, n);
        cell.marker.style.setProperty('--p', Math.min(p, 1).toFixed(4));
        cell.marker.style.opacity = p > 1 ? String(Math.max(0.2, 1 - ((p - 1) * A) / W)) : String(Math.min(1, 0.35 + p));
        cell.marker.classList.toggle('ready', p > 0.88);
        if (!cell.shown) { cell.shown = true; cell.el.classList.add('active'); }
      } else if (cell.shown) {
        hideMarker(cell);
      }
    }

    // Countdown 3-2-1-Los im ersten Takt
    let txt = '';
    if (now >= -3 * beatLen && now < beatLen) txt = ['3', '2', '1', 'Los!'][Math.floor(now / beatLen) + 3];
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

  function setNoteColor(cell, n) {
    cell.note = n;
    if (n.color == null) n.color = Math.floor(Math.random() * NOTE_COLORS.length);
    const [c1, c2] = NOTE_COLORS[n.color];
    cell.marker.style.setProperty('--c1', c1);
    cell.marker.style.setProperty('--c2', c2);
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
    stopSong();
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

  $('#btn-start').addEventListener('click', () => { initAudio(); showSongs(); });
  $('#btn-songs-back').addEventListener('click', () => show('start'));
  $('#btn-other-song').addEventListener('click', showSongs);
  $('#btn-retry').addEventListener('click', startGame);
  $('#btn-easier').addEventListener('click', () => {
    diffKey = diffKey === 'hard' ? 'normal' : 'easy';
    updateDiffUI();
    startGame();
  });
  $('#btn-menu').addEventListener('click', () => show('start'));
  $('#btn-reward').addEventListener('click', showWin);
  $('#btn-again').addEventListener('click', () => { stopConfetti(); show('start'); });

  // Vollbild (nicht auf jedem Gerät verfügbar, z.B. iPhone-Safari → Knopf bleibt versteckt)
  const docEl = document.documentElement;
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  if (docEl.requestFullscreen || docEl.webkitRequestFullscreen) {
    const fsBtn = $('#btn-fs');
    fsBtn.hidden = false;
    fsBtn.addEventListener('click', () => {
      if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else {
        const p = (docEl.requestFullscreen || docEl.webkitRequestFullscreen).call(docEl, { navigationUI: 'hide' });
        if (p && p.catch) p.catch(() => {});
      }
    });
    const sync = () => fsBtn.classList.toggle('on', !!fsElement());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
  }

  // ============================================================
  //  Gewonnen: Gutschein + Konfetti
  // ============================================================
  function showWin() {
    const v = C.voucher || {};
    $('#win-title').textContent = C.winTitle || 'Herzlichen Glückwunsch!';
    $('#win-text').textContent = C.winText || '';
    $('#v-heading').textContent = v.heading || 'GUTSCHEIN';
    $('#v-heading-back').textContent = v.heading || 'GUTSCHEIN';
    $('#v-recipient').textContent = C.recipientName || '';
    $('#v-title').textContent = v.title || '';
    $('#v-details').textContent = v.details || '';
    $('#v-from').textContent = C.fromName || '';
    $('#v-code').textContent = v.code || '';
    const scene = $('#card-scene');
    if (v.cardColor) scene.style.setProperty('--card', v.cardColor);
    const logo = $('#v-logo');
    if (v.logo) {
      logo.src = v.logo;
      logo.hidden = false;
      $('#v-front-title').hidden = true;
      logo.onerror = () => { logo.hidden = true; $('#v-front-title').hidden = false; };
    } else {
      logo.hidden = true;
    }
    $('#v-front-title').textContent = v.title || '';
    $('#card-flip').classList.remove('flipped');
    // Karten-Animation neu starten
    scene.style.animation = 'none';
    void scene.offsetWidth;
    scene.style.animation = '';
    show('win');
    startConfetti();
    if (ctx) {
      const t = ctx.currentTime + 0.05;
      [72, 76, 79, 84].forEach((m, i) => tone(t + i * 0.12, mtof(m), 0.3, 'square', 0.07, 3000));
      chord(t + 0.48, [60, 64, 67, 72], 1.2, 0.04);
    }
  }

  // Karte folgt Finger/Maus; kurzes Tippen dreht sie um
  (() => {
    const scene = $('#card-scene');
    let down = null;
    const tilt = (e) => {
      const r = scene.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      const y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      scene.style.setProperty('--ry', `${x * 16}deg`);
      scene.style.setProperty('--rx', `${-y * 12}deg`);
      scene.style.setProperty('--gx', x.toFixed(3));
      scene.style.setProperty('--gy', y.toFixed(3));
    };
    const reset = () => {
      ['--rx', '--ry'].forEach((p) => scene.style.setProperty(p, '0deg'));
      ['--gx', '--gy'].forEach((p) => scene.style.setProperty(p, '0'));
    };
    scene.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; tilt(e); });
    scene.addEventListener('pointermove', (e) => { if (down || e.pointerType === 'mouse') tilt(e); });
    scene.addEventListener('pointerup', (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12) $('#card-flip').classList.toggle('flipped');
      down = null;
      if (e.pointerType !== 'mouse') reset();
    });
    scene.addEventListener('pointercancel', () => { down = null; reset(); });
    scene.addEventListener('pointerleave', () => { down = null; reset(); });
  })();

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
