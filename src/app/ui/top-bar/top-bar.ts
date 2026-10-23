import { Component, inject } from '@angular/core';
import { CityService } from '../../services/city.service';
import { QUALITY_LABEL } from '../../engine/config';
import { Radio } from '../radio/radio';

/** Brand and sound controls: effects, ambient hum, your own darkwave track. */
@Component({
  selector: 'app-top-bar',
  templateUrl: './top-bar.html',
  imports: [Radio],
})
export class TopBar {
  protected city = inject(CityService);
  protected labels = QUALITY_LABEL;
}
