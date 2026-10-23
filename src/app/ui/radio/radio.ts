import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { CityService } from '../../services/city.service';

@Component({
  selector: 'app-radio',
  templateUrl: './radio.html',
})
export class Radio implements AfterViewInit, OnDestroy {
  protected city = inject(CityService);
  private canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('viz');
  protected state = this.city.radio;
  protected playing = computed(() => this.state().playing);
  protected hasTracks = computed(() => this.state().tracks.length > 0);
  protected label = computed(() => {
    const t = this.state().tracks[this.state().index];
    return t
      ? (t.artist ? t.artist + ' - ' : '') + t.title
      : 'НОКТЮРН FM 13.02 · ГОЛОС НОЧНОГО ГОРОДА';
  });
  protected marqueeSec = computed(() => Math.max(8, this.label().length * 0.32));
  protected mini = signal(matchMedia('(max-width: 720px)').matches);
  protected scope = signal(false);
  protected showList = signal(false);
  protected cur = signal(0);
  protected dur = signal(0);

  private raf = 0;
  private peaks = new Float32Array(28);
  private levels = new Float32Array(28);
  private data: Uint8Array<ArrayBuffer> = new Uint8Array(256);
  private lastUi = 0;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  ngAfterViewInit() {
    this.raf = requestAnimationFrame(this.draw);
  }
  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
  }

  fmt(s: number) {
    if (!isFinite(s)) s = 0;
    const m = Math.floor(s / 60);
    return (
      m.toString().padStart(2, '0') +
      ':' +
      Math.floor(s % 60)
        .toString()
        .padStart(2, '0')
    );
  }

  private draw = (now: number) => {
    this.raf = requestAnimationFrame(this.draw);
    const au = this.city.audio,
      el = this.canvas().nativeElement,
      x = el.getContext('2d');
    if (!x) return;
    if (au && now - this.lastUi > 250) {
      this.lastUi = now;
      this.cur.set(au.track.currentTime || 0);
      this.dur.set(isFinite(au.track.duration) ? au.track.duration : 0);
    }
    const W = el.width,
      H = el.height;
    if (au && this.data.length !== au.bins) this.data = new Uint8Array(au.bins);
    const live = !!au && au.playing;
    x.fillStyle = '#03080a';
    x.fillRect(0, 0, W, H);
    // faint grid like an old LCD
    x.fillStyle = 'rgba(62,242,255,.05)';
    for (let gy = 0; gy < H; gy += 4) x.fillRect(0, gy, W, 1);

    if (this.scope()) {
      const ok = live && au!.waveform(this.data);
      x.strokeStyle = '#3ef2ff';
      x.lineWidth = 2;
      x.shadowColor = '#3ef2ff';
      x.shadowBlur = this.reduced ? 0 : 6;
      x.beginPath();
      for (let i = 0; i < W; i++) {
        const v = ok ? (this.data[Math.floor((i / W) * this.data.length)] - 128) / 128 : 0;
        const y = H / 2 + v * H * 0.42;
        i ? x.lineTo(i, y) : x.moveTo(i, y);
      }
      x.stroke();
      x.shadowBlur = 0;
      return;
    }
    const ok = live && au!.spectrum(this.data);
    const N = this.levels.length,
      gap = 3,
      bw = (W - gap * (N - 1)) / N,
      seg = 4;
    const n = this.data.length;
    for (let i = 0; i < N; i++) {
      // log-spaced bins, like a real analyser: more bars for lows and mids
      const a = Math.floor(Math.pow(n * 0.7, i / N)),
        b = Math.max(a + 1, Math.floor(Math.pow(n * 0.7, (i + 1) / N)));
      let v = 0;
      if (ok) {
        for (let k = a; k < b; k++) v = Math.max(v, this.data[k]);
        v /= 255;
      }
      this.levels[i] = Math.max(v, this.levels[i] * 0.86);
      this.peaks[i] = Math.max(this.levels[i], this.peaks[i] - 0.012);
      const h = Math.round((this.levels[i] * (H - 4)) / seg) * seg,
        px = i * (bw + gap);
      for (let y = 0; y < h; y += seg) {
        const t = y / H;
        x.fillStyle = t < 0.5 ? '#3ef2ff' : t < 0.78 ? '#c86bff' : '#ff3ea5';
        x.fillRect(px, H - y - seg + 1, bw, seg - 1);
      }
      const py = H - Math.round(this.peaks[i] * (H - 4)) - 2;
      x.fillStyle = '#ffc46b';
      x.fillRect(px, py, bw, 2);
    }
  };
}
