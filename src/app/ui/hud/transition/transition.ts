import { Component, effect, inject, signal } from '@angular/core';
import { CityService } from '../../../services/city.service';
import { LOC } from '../../../engine/config';

@Component({
  selector: 'app-transition',
  templateUrl: './transition.html',
})
export class Transition {
  private city = inject(CityService);
  protected on = signal(false);
  protected name = signal('');
  protected sub = signal('');
  private reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor() {
    effect(() => {
      const tr = this.city.transition();
      if (!tr || this.reduce) return;
      const L = LOC[tr.key];
      this.name.set(L.name);
      this.sub.set(`ПЕРЕХОД → ${L.code} · ${L.obj[0]}/${L.obj[2]}`);
      this.on.set(false);
      requestAnimationFrame(() => this.on.set(true));
    });
  }
}
