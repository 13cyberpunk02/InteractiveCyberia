/**
 * Effects and the ambient hum are synthesized with the Web Audio API. Music is the "Ноктюрн FM" radio:
 * a fixed playlist from public/music (see scripts/playlist.mjs), played through an analyser that drives
 * both the player's visualizer and the city's bass pulse.
 * The context can only start after a user gesture, so `init()` is called from the "Enter" button.
 */
export interface RadioTrack {
  file: string;
  title: string;
  artist: string;
}
export class CityAudio {
  ctx: AudioContext | null = null;
  sfxOn = true;
  ambOn = true;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private music!: GainNode;
  private delay!: DelayNode;
  private analyser!: AnalyserNode;
  private data!: Uint8Array<ArrayBuffer>;
  private src: MediaElementAudioSourceNode | null = null;
  readonly track = new Audio();
  tracks: RadioTrack[] = [];
  index = 0;
  /** called whenever the radio state changes (track, play/pause) */
  onChange: () => void = () => {};
  private base = 'music/';
  private skipping = false;
  private retries = 0;
  private engine: { o: OscillatorNode[]; f: BiquadFilterNode; g: GainNode } | null = null;

  constructor() {
    this.track.preload = 'auto';
    this.track.volume = 0.7;
    this.track.addEventListener('ended', () => this.next());
    // a broken or missing file skips ahead once; a hiccup mid-track resumes where it stopped
    this.track.addEventListener('error', () => {
      if (!this.track.src || this.skipping) return;
      const at = this.track.currentTime;
      if (at > 1 && this.retries < 2) {
        this.retries++;
        const src = this.track.src;
        this.track.src = src;
        this.track.currentTime = at;
        this.track.play().catch(() => {});
        return;
      }
      if (this.tracks.length > 1) {
        this.skipping = true;
        setTimeout(() => {
          this.skipping = false;
          this.next();
        }, 500);
      }
    });
    this.track.addEventListener('playing', () => {
      this.retries = 0;
    });
    ['play', 'pause', 'loadedmetadata'].forEach((ev) =>
      this.track.addEventListener(ev, () => this.onChange()),
    );
  }

  /** Loads the station's playlist. Safe to call before the audio context exists. */
  async loadPlaylist(base = 'music/') {
    this.base = base;
    try {
      const r = await fetch(base + 'playlist.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      this.tracks = Array.isArray(j.tracks) ? j.tracks : [];
    } catch {
      this.tracks = [];
    }
    this.onChange();
    return this.tracks;
  }
  get current(): RadioTrack | null {
    return this.tracks[this.index] ?? null;
  }
  get playing() {
    return !!this.track.src && !this.track.paused;
  }

  private connect() {
    this.init();
    if (this.ctx && !this.src) {
      this.src = this.ctx.createMediaElementSource(this.track);
      this.src.connect(this.music);
    }
  }
  async playIndex(i: number) {
    if (!this.tracks.length) return;
    this.connect();
    this.index = ((i % this.tracks.length) + this.tracks.length) % this.tracks.length;
    this.track.src = this.base + this.tracks[this.index].file;
    if (this.ambOn && this.ctx) this.amb.gain.setTargetAtTime(0.12, this.ctx.currentTime, 1.5);
    this.updateSession();
    try {
      await this.track.play();
    } catch {
      /* blocked until a gesture: the play button will start it */
    }
    this.onChange();
  }
  /** Starts the station (from the "Enter" gesture): picks up where it is, or begins with a random track. */
  start() {
    if (!this.tracks.length) return;
    if (this.track.src) {
      this.connect();
      this.track.play().catch(() => {});
      return;
    }
    this.playIndex(Math.floor(Math.random() * this.tracks.length));
  }
  toggle() {
    if (!this.track.src) {
      this.start();
      return;
    }
    this.connect();
    if (this.track.paused) this.track.play().catch(() => {});
    else this.track.pause();
  }
  next() {
    this.playIndex(this.index + 1);
  }
  prev() {
    if (this.track.currentTime > 3) {
      this.track.currentTime = 0;
      return;
    }
    this.playIndex(this.index - 1);
  }
  seek(sec: number) {
    if (isFinite(this.track.duration))
      this.track.currentTime = Math.max(0, Math.min(this.track.duration - 0.2, sec));
  }

  /** Spectrum (0..255 per bin) for the visualizer; false when nothing is playing. */
  spectrum(out: Uint8Array<ArrayBuffer>) {
    if (!this.ctx || !this.src) return false;
    this.analyser.getByteFrequencyData(out);
    return true;
  }
  waveform(out: Uint8Array<ArrayBuffer>) {
    if (!this.ctx || !this.src) return false;
    this.analyser.getByteTimeDomainData(out);
    return true;
  }
  get bins() {
    return this.analyser ? this.analyser.frequencyBinCount : 256;
  }

  /** Hardware media keys and the lock screen show the station too. */
  private updateSession() {
    const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession,
      t = this.current;
    if (!ms || !t || typeof MediaMetadata === 'undefined') return;
    ms.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artist || 'Ноктюрн FM 13.02',
      album: 'Ноктюрн FM 13.02',
    });
    ms.setActionHandler('play', () => this.toggle());
    ms.setActionHandler('pause', () => this.toggle());
    ms.setActionHandler('nexttrack', () => this.next());
    ms.setActionHandler('previoustrack', () => this.prev());
  }

  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.amb = ctx.createGain();
    this.amb.gain.value = 0;
    this.amb.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = 0.7;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.72;
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    this.music.connect(this.analyser);
    this.analyser.connect(this.master);
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = 0.32;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const dl = ctx.createGain();
    dl.gain.value = 0.35;
    this.delay.connect(fb);
    fb.connect(this.delay);
    this.delay.connect(dl);
    dl.connect(this.sfx);
    // ambient drone: detuned saws through a slowly breathing low-pass
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    lp.Q.value = 6;
    lp.connect(this.amb);
    [55, 55.35, 82.4].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.05 : 0.07;
      o.connect(g);
      g.connect(lp);
      o.start();
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 140;
    lfo.connect(lg);
    lg.connect(lp.frequency);
    lfo.start();
    // rain: looped noise through band filters, plus a soft low rumble
    {
      const len = ctx.sampleRate * 3,
        buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        let b = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          b = 0.97 * b + 0.03 * w;
          d[i] = w * 0.55 + b * 2.2;
        }
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 500;
      const lp2 = ctx.createBiquadFilter();
      lp2.type = 'lowpass';
      lp2.frequency.value = 6500;
      const g = ctx.createGain();
      g.gain.value = 0.085;
      src.connect(hp);
      hp.connect(lp2);
      lp2.connect(g);
      g.connect(this.amb);
      src.start();
    }
    this.amb.gain.setTargetAtTime(0.55, ctx.currentTime, 2);
  }

  /** 0..1 bass level of the user's track, or a slow breathing pulse when no music plays. */
  bass(t: number) {
    if (this.ctx && this.src && !this.track.paused) {
      this.analyser.getByteFrequencyData(this.data);
      let b = 0;
      for (let i = 2; i < 14; i++) b += this.data[i];
      return Math.max(0, b / 12 / 255 - 0.35) / 0.65;
    }
    return 0.12 + 0.1 * Math.sin(t * 1.3);
  }

  setVolume(v: number) {
    this.track.volume = v;
  }
  toggleAmbient() {
    this.ambOn = !this.ambOn;
    if (this.ctx)
      this.amb.gain.setTargetAtTime(
        this.ambOn ? (this.track.src && !this.track.paused ? 0.12 : 0.55) : 0,
        this.ctx.currentTime,
        0.6,
      );
  }

  private env(g: GainNode, t: number, a: number, peak: number, r: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
  }
  private ready() {
    return !!this.ctx && this.sfxOn;
  }

  hover() {
    if (!this.ready()) return;
    const c = this.ctx!,
      t = c.currentTime,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(2100, t + 0.04);
    this.env(g, t, 0.005, 0.035, 0.06);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + 0.1);
  }
  click() {
    if (!this.ready()) return;
    const c = this.ctx!,
      t = c.currentTime,
      o = c.createOscillator(),
      g = c.createGain(),
      f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2400;
    o.type = 'square';
    o.frequency.setValueAtTime(620, t);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.09);
    this.env(g, t, 0.004, 0.07, 0.12);
    o.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    g.connect(this.delay);
    o.start(t);
    o.stop(t + 0.2);
  }
  whoosh(d: number) {
    if (!this.ready()) return;
    const c = this.ctx!,
      t = c.currentTime;
    const len = Math.ceil(c.sampleRate * (d + 0.4)),
      buf = c.createBuffer(1, len, c.sampleRate),
      ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(260, t);
    bp.frequency.exponentialRampToValueAtTime(3200, t + d * 0.45);
    bp.frequency.exponentialRampToValueAtTime(320, t + d);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + d * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + d + 0.4);
    const sub = c.createOscillator(),
      sg = c.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(120, t);
    sub.frequency.exponentialRampToValueAtTime(38, t + d);
    this.env(sg, t, 0.05, 0.22, d);
    sub.connect(sg);
    sg.connect(this.sfx);
    sub.start(t);
    sub.stop(t + d + 0.2);
  }
  arrive() {
    if (!this.ready()) return;
    const c = this.ctx!,
      t = c.currentTime;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.3);
    f.connect(this.sfx);
    f.connect(this.delay);
    [220, 261.63, 329.63, 440].forEach((hz, i) => {
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.value = hz;
      o.detune.value = i % 2 ? 7 : -7;
      const st = t + i * 0.07;
      this.env(g, st, 0.01, 0.06, 0.9);
      o.connect(g);
      g.connect(f);
      o.start(st);
      o.stop(st + 1.1);
    });
  }
  bump() {
    if (!this.ready()) return;
    const c = this.ctx!,
      t = c.currentTime,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    this.env(g, t, 0.005, 0.35, 0.3);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + 0.4);
  }

  /* engine hum while flying */
  engineStart() {
    if (!this.ctx || this.engine) return;
    const c = this.ctx;
    const o = [c.createOscillator(), c.createOscillator(), c.createOscillator()];
    o[0].type = 'sawtooth';
    o[1].type = 'sawtooth';
    o[2].type = 'sine';
    o[1].detune.value = 14;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 5;
    f.frequency.value = 300;
    const g = c.createGain();
    g.gain.value = 0;
    o[0].connect(f);
    o[1].connect(f);
    f.connect(g);
    o[2].connect(g);
    g.connect(this.master);
    o.forEach((x) => x.start());
    this.engine = { o, f, g };
  }
  engineUpdate(speed: number, throttle: number) {
    if (!this.engine || !this.ctx) return;
    const t = this.ctx.currentTime,
      e = this.engine,
      base = 42 + speed * 70;
    e.o[0].frequency.setTargetAtTime(base, t, 0.08);
    e.o[1].frequency.setTargetAtTime(base * 1.5, t, 0.08);
    e.o[2].frequency.setTargetAtTime(base * 0.5, t, 0.08);
    e.f.frequency.setTargetAtTime(260 + speed * 1300 + throttle * 500, t, 0.1);
    e.g.gain.setTargetAtTime(this.sfxOn ? 0.035 + throttle * 0.03 + speed * 0.02 : 0, t, 0.15);
  }
  engineStop() {
    if (!this.engine || !this.ctx) return;
    const e = this.engine;
    e.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    setTimeout(
      () =>
        e.o.forEach((x) => {
          try {
            x.stop();
          } catch {
            /* already stopped */
          }
        }),
      900,
    );
    this.engine = null;
  }
}
