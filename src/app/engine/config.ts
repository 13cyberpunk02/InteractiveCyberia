/**
 * The city's points of interest. Each one is a route of the site:
 * `obj` is where the landmark stands, `cam` and `look` are where the camera parks to show it.
 */
export type LocKey = 'hub' | 'about' | 'projects' | 'contact' | 'fly';

export interface Loc {
  key: LocKey;
  path: string;
  hotkey: string;
  name: string;
  code: string;
  obj: [number, number, number];
  cam: [number, number, number];
  look: [number, number, number];
  tagY: number;
}

export const LOCS: Loc[] = [
  {
    key: 'hub',
    path: '',
    hotkey: '1',
    name: 'Центр',
    code: 'S-00',
    obj: [0, 0, 0],
    cam: [58, 30, 74],
    look: [0, 40, 0],
    tagY: 94,
  },
  {
    key: 'about',
    path: 'about',
    hotkey: '2',
    name: 'Архив',
    code: 'S-14',
    obj: [-78, 0, -42],
    cam: [-48, 18, -8],
    look: [-78, 20, -42],
    tagY: 40,
  },
  {
    key: 'projects',
    path: 'projects',
    hotkey: '3',
    name: 'Проекты',
    code: 'S-27',
    obj: [64, 0, -76],
    cam: [62, 15, -40],
    look: [57, 12.5, -76],
    tagY: 30,
  },
  {
    key: 'contact',
    path: 'contact',
    hotkey: '4',
    name: 'Сигнал',
    code: 'S-41',
    obj: [26, 0, 78],
    cam: [72, 22, 112],
    look: [26, 36, 78],
    tagY: 77,
  },
  {
    key: 'fly',
    path: 'fly',
    hotkey: '5',
    name: 'Полёт',
    code: 'S-50',
    obj: [-45, 0, 45],
    cam: [-27, 34, 45],
    look: [-45, 30, 45],
    tagY: 40,
  },
];
export const LOC = Object.fromEntries(LOCS.map((l) => [l.key, l])) as Record<LocKey, Loc>;

export type CarKey = 'ten' | 'bastion' | 'iskra' | 'korona' | 'skat' | 'vektor';
export interface CarSpec {
  key: CarKey;
  name: string;
  desc: string;
  /** ground cars drive on the streets, air cars fly */
  kind: 'ground' | 'air';
  /** 0..1 bars shown in the hangar */
  speedBar: number;
  turnBar: number;
}
/** What the hangar shows. Handling numbers live next to the driving code in world.ts. */
export const CARS: CarSpec[] = [
  {
    key: 'ten',
    kind: 'ground',
    name: 'Тень',
    desc: 'Широкое купе. Едет по улицам, держит дорогу.',
    speedBar: 0.75,
    turnBar: 0.8,
  },
  {
    key: 'bastion',
    kind: 'ground',
    name: 'Бастион',
    desc: 'Броневик. Медленный разгон, но неудержим.',
    speedBar: 0.5,
    turnBar: 0.45,
  },
  {
    key: 'iskra',
    kind: 'ground',
    name: 'Искра',
    desc: 'Мотоцикл. Самый резкий на земле.',
    speedBar: 0.9,
    turnBar: 1,
  },
  {
    key: 'korona',
    kind: 'air',
    name: 'Корона',
    desc: 'Ховер-купе. Плавное и послушное.',
    speedBar: 0.7,
    turnBar: 0.65,
  },
  {
    key: 'skat',
    kind: 'air',
    name: 'Скат',
    desc: 'Самый быстрый в небе.',
    speedBar: 1,
    turnBar: 0.8,
  },
  {
    key: 'vektor',
    kind: 'air',
    name: 'Вектор',
    desc: 'Аэротакси. Тяжёлое, но устойчивое.',
    speedBar: 0.5,
    turnBar: 0.45,
  },
];
export const CAR = Object.fromEntries(CARS.map((c) => [c.key, c])) as Record<CarKey, CarSpec>;

/** Keyboard / touch controls while driving. */
export interface Controls {
  fwd: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  boost: boolean;
}

export type Quality = 'high' | 'mid' | 'low';
export const QUALITY_LABEL: Record<Quality, string> = {
  high: 'Высокая',
  mid: 'Средняя',
  low: 'Низкая',
};
