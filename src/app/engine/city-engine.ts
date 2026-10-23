import { CityAudio } from './audio';
import { CarKey, Controls, LocKey, Quality } from './config';
import { createWorld } from './world';
import { Project } from '../content/projects';

export interface HudInfo {
  x: number;
  y: number;
  z: number;
  speed: number;
  altitude: number;
}

export interface EngineEvents {
  /** the camera started flying to a location (show the transition overlay, hide the panel) */
  depart(key: LocKey, intro: boolean): void;
  /** the camera arrived (show the page content) */
  arrive(key: LocKey): void;
  /** ~10 times a second: numbers for the HUD */
  tick(info: HudInfo): void;
  /** the player got into a car or out of it */
  drive(on: boolean, car: CarKey): void;
}

/** Everything the 3D world exposes (implemented in world.ts). */
interface World {
  init(progress: (p: number) => void): Promise<void>;
  start(): void;
  flyTo(key: LocKey, intro?: boolean): void;
  setPanelOpen(open: boolean): void;
  registerTag(key: LocKey, el: HTMLElement): void;
  select(car: CarKey): void;
  takeoff(): Promise<boolean>;
  land(): void;
  readonly driving: boolean;
  readonly keys: Controls;
  readonly stick: { x: number; y: number };
  toggleTrail(): boolean;
  readonly quality: Quality;
  setQuality(q: Quality): void;
  dispose(): void;
}

/**
 * The whole 3D city behind a small typed facade. Plain TypeScript, no Angular inside:
 * CityService creates it, calls `flyTo()` when the route changes and listens to its events.
 */
export class CityEngine {
  readonly audio = new CityAudio();
  private world: World;

  constructor(
    canvas: HTMLCanvasElement,
    events: EngineEvents,
    opts: { quality?: Quality; assets?: string; projects?: Project[] } = {},
  ) {
    this.world = createWorld(canvas, {
      audio: this.audio,
      hooks: events,
      quality: opts.quality,
      assets: opts.assets ?? 'models/',
      projects: opts.projects,
    }) as World;
  }

  init(progress: (p: number) => void) {
    return this.world.init(progress);
  }
  start() {
    this.world.start();
  }
  flyTo(key: LocKey, intro = false) {
    this.world.flyTo(key, intro);
  }
  setPanelOpen(open: boolean) {
    this.world.setPanelOpen(open);
  }
  registerTag(key: LocKey, el: HTMLElement) {
    this.world.registerTag(key, el);
  }

  get driving() {
    return this.world.driving;
  }
  select(car: CarKey) {
    this.world.select(car);
  }
  takeoff() {
    return this.world.takeoff();
  }
  land() {
    this.world.land();
  }
  get keys() {
    return this.world.keys;
  }
  get stick() {
    return this.world.stick;
  }
  toggleTrail() {
    return this.world.toggleTrail();
  }

  get quality() {
    return this.world.quality;
  }
  setQuality(q: Quality) {
    this.world.setQuality(q);
  }

  dispose() {
    this.world.dispose();
  }
}
