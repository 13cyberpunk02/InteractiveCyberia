import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CityService } from '../../../services/city.service';
import { Controls } from '../../../engine/config';

@Component({
  imports: [DecimalPipe],
  selector: 'app-drive-hud',
  templateUrl: './drive-hud.html',
})
export class DriveHud {
  protected city = inject(CityService);
  protected coarse = matchMedia('(pointer: coarse)').matches;
  protected ground = computed(() => this.city.carSpec().kind === 'ground');
  protected pedals = computed<{ k: keyof Controls; label: string }[]>(() =>
    this.ground()
      ? [
          { k: 'fwd', label: 'Газ' },
          { k: 'back', label: 'Тормоз' },
        ]
      : [
          { k: 'up', label: 'Вверх' },
          { k: 'fwd', label: 'Газ' },
          { k: 'down', label: 'Вниз' },
          { k: 'back', label: 'Тормоз' },
        ],
  );
  protected knob = signal('');
  private sid: number | null = null;

  stickDown(e: PointerEvent) {
    this.sid = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.stickMove(e);
  }
  stickMove(e: PointerEvent) {
    if (e.pointerId !== this.sid) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2),
      y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    this.city.setStick(x, y);
    this.knob.set(`translate(${x * 38}px,${y * 38}px)`);
  }
  stickUp() {
    this.sid = null;
    this.city.setStick(0, 0);
    this.knob.set('');
  }
  press(k: keyof Controls, down: boolean, e?: PointerEvent) {
    if (e) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.city.setKey(k, down);
  }
}
