import { Component, computed, inject } from '@angular/core';
import { CityService } from '../../services/city.service';
import { CarKey, CARS, CarSpec } from '../../engine/config';

@Component({
  selector: 'page-hangar',
  templateUrl: './hangar-page.html',
})
export class HangarPage {
  protected city = inject(CityService);
  protected groups: { label: string; cars: CarSpec[] }[] = [
    { label: 'Наземные', cars: CARS.filter((c) => c.kind === 'ground') },
    { label: 'Летающие', cars: CARS.filter((c) => c.kind === 'air') },
  ];
  protected ground = computed(() => this.city.carSpec().kind === 'ground');
  private coarse = matchMedia('(pointer: coarse)').matches;
  protected hint = computed(() =>
    this.coarse
      ? 'Джойстик слева - поворот' +
        (this.ground() ? '' : ' и высота') +
        ', кнопки справа - газ и тормоз.'
      : 'W/S - газ и тормоз, A/D - поворот' +
        (this.ground() ? '' : ', E и Q - вверх и вниз') +
        ', Shift - ускорение, T - световой след, Esc - выйти.',
  );
  choose(k: CarKey) {
    this.city.click();
    this.city.selectCar(k);
  }
}
