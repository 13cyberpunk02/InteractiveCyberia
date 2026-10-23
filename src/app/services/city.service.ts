import { Injectable, computed, effect, signal } from '@angular/core';
import { CityEngine, HudInfo } from '../engine/city-engine';
import { CAR, CarKey, Controls, LocKey, Quality } from '../engine/config';
import { PROJECTS } from '../content/projects';
import { CityAudio, RadioTrack } from '../engine/audio';

const QUALITY_KEY = 'ne-quality';
const VOLUME_KEY = 'ne-volume';

/**
 * The bridge between Angular and the 3D engine.
 * Components read signals from here; the engine is created once by <app-city-canvas>.
 */
@Injectable({ providedIn: 'root' })
export class CityService {
  private engine: CityEngine | null = null;
  private pending: LocKey = 'hub';
  private tags = new Map<LocKey, HTMLElement>();

  readonly progress = signal(0);
  readonly ready = signal(false);
  readonly started = signal(false);
  readonly current = signal<LocKey | null>(null);
  readonly arrived = signal(false);
  /** bumps every time a transition starts; the overlay animates on change */
  readonly transition = signal<{ key: LocKey; n: number } | null>(null);
  readonly driving = signal(false);
  readonly car = signal<CarKey>('ten');
  readonly carSpec = computed(() => CAR[this.car()]);
  readonly hud = signal<HudInfo>({ x: 0, y: 0, z: 0, speed: 0, altitude: 0 });
  readonly sfxOn = signal(true);
  readonly ambOn = signal(true);
  /** Ноктюрн FM: what is on air */
  readonly radio = signal<{ tracks: RadioTrack[]; index: number; playing: boolean }>({
    tracks: [],
    index: 0,
    playing: false,
  });
  readonly volume = signal(loadVolume());
  readonly trailOn = signal(true);
  readonly quality = signal<Quality>(loadQuality());
  readonly starting = signal(false);

  /** The content panel is visible once the camera has arrived (and not while driving). */
  readonly panelOpen = computed(() => this.arrived() && !this.driving());

  constructor() {
    effect(() => this.engine?.setPanelOpen(this.panelOpen()));
  }

  attach(canvas: HTMLCanvasElement) {
    if (this.engine) return;
    let n = 0;
    this.engine = new CityEngine(
      canvas,
      {
        depart: (key) => {
          this.arrived.set(false);
          this.current.set(key);
          this.transition.set({ key, n: ++n });
        },
        arrive: () => this.arrived.set(true),
        tick: (info) => this.hud.set(info),
        drive: (on) => this.driving.set(on),
      },
      { quality: this.quality(), projects: PROJECTS },
    );
    this.tags.forEach((el, k) => this.engine!.registerTag(k, el));
    const au = this.engine.audio;
    au.track.volume = this.volume();
    au.onChange = () => this.radio.set({ tracks: au.tracks, index: au.index, playing: au.playing });
    au.loadPlaylist();
    this.engine.select(this.car());
    this.engine.init((p) => this.progress.set(p)).then(() => this.ready.set(true));
  }
  detach() {
    this.engine?.dispose();
    this.engine = null;
  }

  /** Called from the "Enter" button: audio may only start after a user gesture. */
  enter() {
    if (!this.engine || this.started()) return;
    this.engine.audio.init();
    this.engine.audio.start(); // the station starts with the first click
    this.started.set(true);
    this.engine.start();
    this.engine.flyTo(this.pending, true);
  }

  /** Called whenever the route changes. */
  goTo(key: LocKey) {
    this.pending = key;
    if (this.started() && this.engine && !this.driving()) this.engine.flyTo(key);
  }

  /* --- hangar and driving --- */
  selectCar(k: CarKey) {
    this.car.set(k);
    this.engine?.select(k);
  }
  async takeoff() {
    if (!this.engine || this.starting()) return;
    this.starting.set(true);
    try {
      await this.engine.takeoff();
    } finally {
      this.starting.set(false);
    }
  }
  land() {
    this.engine?.land();
  }
  setKey(k: keyof Controls, down: boolean) {
    if (this.engine) this.engine.keys[k] = down;
  }
  setStick(x: number, y: number) {
    if (this.engine) {
      this.engine.stick.x = x;
      this.engine.stick.y = y;
    }
  }
  toggleTrail() {
    if (this.engine) this.trailOn.set(this.engine.toggleTrail());
  }

  /* --- graphics --- */
  cycleQuality() {
    const next: Record<Quality, Quality> = { high: 'mid', mid: 'low', low: 'high' };
    const q = next[this.quality()];
    this.quality.set(q);
    this.engine?.setQuality(q);
    try {
      localStorage.setItem(QUALITY_KEY, q);
    } catch {
      /* private mode */
    }
  }

  /* --- audio --- */
  hover() {
    this.engine?.audio.hover();
  }
  click() {
    this.engine?.audio.click();
  }
  toggleSfx() {
    if (!this.engine) return;
    this.engine.audio.sfxOn = !this.engine.audio.sfxOn;
    this.sfxOn.set(this.engine.audio.sfxOn);
  }
  toggleAmbient() {
    if (!this.engine) return;
    this.engine.audio.toggleAmbient();
    this.ambOn.set(this.engine.audio.ambOn);
  }
  /* --- radio --- */
  get audio(): CityAudio | null {
    return this.engine?.audio ?? null;
  }
  radioToggle() {
    this.engine?.audio.toggle();
  }
  radioNext() {
    this.engine?.audio.next();
  }
  radioPrev() {
    this.engine?.audio.prev();
  }
  radioPlay(i: number) {
    this.engine?.audio.playIndex(i);
  }
  seek(sec: number) {
    this.engine?.audio.seek(sec);
  }
  setVolume(v: number) {
    this.volume.set(v);
    this.engine?.audio.setVolume(v);
    try {
      localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      /* private mode */
    }
  }
  registerTag(key: LocKey, el: HTMLElement) {
    this.tags.set(key, el);
    this.engine?.registerTag(key, el);
  }
}

function loadQuality(): Quality {
  try {
    const q = localStorage.getItem(QUALITY_KEY);
    if (q === 'high' || q === 'mid' || q === 'low') return q;
  } catch {
    /* ignore */
  }
  return matchMedia('(pointer: coarse)').matches ? 'low' : 'mid';
}

function loadVolume(): number {
  try {
    const v = parseFloat(localStorage.getItem(VOLUME_KEY) ?? '');
    if (v >= 0 && v <= 1) return v;
  } catch {
    /* ignore */
  }
  return 0.7;
}
