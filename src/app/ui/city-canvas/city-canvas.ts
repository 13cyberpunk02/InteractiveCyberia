import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { CityService } from '../../services/city.service';

@Component({
  selector: 'app-city-canvas',
  templateUrl: './city-canvas.html',
})
export class CityCanvas implements OnDestroy {
  private city = inject(CityService);
  private canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('c');

  constructor() {
    afterNextRender(() => this.city.attach(this.canvas().nativeElement));
  }
  ngOnDestroy() {
    this.city.detach();
  }
}
