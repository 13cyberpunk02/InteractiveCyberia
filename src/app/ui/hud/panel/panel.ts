import { Component, inject } from '@angular/core';
import { CityService } from '../../../services/city.service';

@Component({
  selector: 'app-panel',
  templateUrl: './panel.html',
})
export class Panel {
  protected city = inject(CityService);
}
