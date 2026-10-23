import { Component, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { CityService } from './services/city.service';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Controls, LocKey, LOCS } from './engine/config';
import { CityCanvas } from './ui/city-canvas/city-canvas';
import { WorldTags } from './ui/world-tags/world-tags';
import { TopBar } from './ui/top-bar/top-bar';
import { Panel } from './ui/hud/panel/panel';
import { NavBar } from './ui/nav-bar/nav-bar';
import { Readout } from './ui/hud/readout/readout';
import { DriveHud } from './ui/hud/drive-hud/drive-hud';
import { Transition } from './ui/hud/transition/transition';
import { Gate } from './ui/gate/gate';

const KEYMAP: Record<string, keyof Controls> = {
  KeyW: 'fwd',
  ArrowUp: 'fwd',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyE: 'up',
  Space: 'up',
  KeyQ: 'down',
  KeyC: 'down',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
};

@Component({
  imports: [
    RouterOutlet,
    CityCanvas,
    WorldTags,
    TopBar,
    Panel,
    NavBar,
    Readout,
    DriveHud,
    Transition,
    Gate,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  host: {
    '[class.driving]': 'city.driving()',
    '(window:keydown)': 'keydown($event)',
    '(window:keyup)': 'keyup($event)',
    '(document:pointerover)': 'hover($event)',
  },
})
export class App {
  protected city = inject(CityService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  constructor() {
    // every navigation tells the city where to fly
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        let r = this.route.snapshot;
        while (r.firstChild) r = r.firstChild;
        const loc = r.data['loc'] as LocKey | undefined;
        if (loc) this.city.goTo(loc);
      });
  }

  keydown(e: KeyboardEvent) {
    if (!this.city.started()) return;
    if (this.city.driving()) {
      const k = KEYMAP[e.code];
      if (k) {
        this.city.setKey(k, true);
        e.preventDefault();
      }
      if (e.code === 'Escape') this.city.land();
      if (e.code === 'KeyT') {
        this.city.toggleTrail();
        this.city.click();
      }
      return;
    }
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    const loc = LOCS.find((l) => l.hotkey === e.key);
    if (loc) {
      this.city.click();
      this.router.navigate(['/' + loc.path]);
    }
  }
  keyup(e: KeyboardEvent) {
    const k = KEYMAP[e.code];
    if (k) this.city.setKey(k, false);
  }
  hover(e: PointerEvent) {
    const el = (e.target as HTMLElement).closest('button, a, label.chip');
    if (el && !el.contains(e.relatedTarget as Node)) this.city.hover();
  }
}
