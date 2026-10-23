import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CityService } from '../../../services/city.service';
import { LOC } from '../../../engine/config';

@Component({
  imports: [DecimalPipe],
  selector: 'app-readout',
  templateUrl: './readout.html',
})
export class Readout {
  protected city = inject(CityService);
  protected h = this.city.hud;
  protected status = computed(() => {
    const c = this.city.current();
    return !this.city.arrived() ? 'В ПОЛЁТЕ' : 'СЕКТОР ' + (c ? LOC[c].code : 'S-00');
  });
}
