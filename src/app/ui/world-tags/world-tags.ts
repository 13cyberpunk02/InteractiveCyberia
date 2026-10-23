import { afterNextRender, Component, ElementRef, inject, viewChildren } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CityService } from '../../services/city.service';
import { LocKey, LOCS } from '../../engine/config';

@Component({
  imports: [RouterLink],
  selector: 'app-world-tags',
  templateUrl: './world-tags.html',
})
export class WorldTags {
  protected city = inject(CityService);
  protected locs = LOCS;
  private tags = viewChildren<ElementRef<HTMLElement>>('tag');
  constructor() {
    afterNextRender(() =>
      this.tags().forEach((t) =>
        this.city.registerTag(t.nativeElement.dataset['key'] as LocKey, t.nativeElement),
      ),
    );
  }
}
