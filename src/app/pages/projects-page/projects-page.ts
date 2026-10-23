import { Component } from '@angular/core';
import { PROJECTS } from '../../content/projects';

@Component({
  selector: 'page-projects',
  templateUrl: './projects-page.html',
})
export class ProjectsPage {
  protected projects = PROJECTS;
  protected palette = ['#3ef2ff', '#ff3ea5', '#ffc46b', '#9b5bff', '#5dff9e'];
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** A small telemetry line, different for every card. */
  wave(i: number): string {
    let d = '';
    for (let k = 0; k <= 50; k++) {
      const x = k * 4,
        y =
          14 +
          Math.sin(k * 0.45 + i * 1.3) * 7 * Math.sin(k * 0.09 + 1) +
          Math.sin(k * 1.3 + i) * 2;
      d += (k ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return d;
  }
  /** Tilt the card towards the pointer, like a hologram you can lean around. */
  tilt(e: PointerEvent) {
    if (this.reduced || e.pointerType !== 'mouse') return;
    const el = e.currentTarget as HTMLElement,
      r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5,
      y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
    el.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
    el.style.setProperty('--gx', ((x + 0.5) * 100).toFixed(1) + '%');
    el.style.setProperty('--gy', ((y + 0.5) * 100).toFixed(1) + '%');
  }
  untilt(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    ['--rx', '--ry', '--gx', '--gy'].forEach((k) => el.style.removeProperty(k));
  }
}
