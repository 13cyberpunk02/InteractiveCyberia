import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'page-about',
  templateUrl: './about-page.html',
  imports: [RouterLink],
  styles: [
    `
      .blog-m { margin-left: 5px; }
    `
  ],
})
export class AboutPage {
  protected skills = [
    {
      title: 'Бэкенд',
      items: ['C#', '.NET', 'ASP.NET Core', 'Web API', 'EF Core', 'LINQ', 'SignalR'],
    },
    { title: 'Фронтенд', items: ['Angular', 'TypeScript', 'RxJS', 'Signals', 'SCSS', 'Three.js'] },
    { title: 'Данные', items: ['PostgreSQL', 'MS SQL', 'Redis'] },
    { title: 'Инструменты', items: ['Git', 'Docker', 'CI/CD', 'Swagger', 'xUnit'] },
  ];
}
