import { Component, inject } from '@angular/core';
import { CityService } from '../../services/city.service';
import { LOCS } from '../../engine/config';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  imports: [RouterLink, RouterLinkActive],
  selector: 'app-nav-bar',
  templateUrl: './nav-bar.html',
})
export class NavBar {
  protected city = inject(CityService);
  protected locs = LOCS;
}
