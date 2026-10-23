import { Component } from '@angular/core';

@Component({
  selector: 'page-contact',
  templateUrl: './contact-page.html',
})
export class ContactPage {
  protected email = 'salawat1302@gmail.com';
  protected copied = false;
  async copy(el: HTMLElement) {
    try {
      await navigator.clipboard.writeText(this.email);
      this.copied = true;
    } catch {
      const r = document.createRange();
      r.selectNodeContents(el);
      const s = getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
    }
  }
}
