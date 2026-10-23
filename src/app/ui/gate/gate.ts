import { Component, computed, inject } from '@angular/core';
import { CityService } from '../../services/city.service';

/** Start screen. Sound can only start after a click, so the city waits here. */
@Component({
  selector: 'app-gate',
  templateUrl: './gate.html',
})
export class Gate {
  protected city = inject(CityService);
  protected label = computed(() =>
    this.city.ready()
      ? 'Войти в город'
      : `Генерация города… ${Math.round(this.city.progress() * 100)}%`,
  );
}
