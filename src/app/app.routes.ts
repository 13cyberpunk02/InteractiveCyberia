import { Routes } from '@angular/router';
import { HubPage } from './pages/hub-page/hub-page';
import { AboutPage } from './pages/about-page/about-page';
import { ProjectsPage } from './pages/projects-page/projects-page';
import { HangarPage } from './pages/hangar-page/hangar-page';
import { ContactPage } from './pages/contact-page/contact-page';

/** `data.loc` tells the 3D city where to fly when the route opens. */
export const routes: Routes = [
  { path: '', component: HubPage, title: 'Cyberius', data: { loc: 'hub' } },
  { path: 'about', component: AboutPage, title: 'Архив · Cyberius', data: { loc: 'about' } },
  {
    path: 'projects',
    component: ProjectsPage,
    title: 'Проекты · Cyberius',
    data: { loc: 'projects' },
  },
  { path: 'contact', component: ContactPage, title: 'Сигнал · Cyberius', data: { loc: 'contact' } },
  { path: 'fly', component: HangarPage, title: 'Полёт · Cyberius', data: { loc: 'fly' } },
  { path: '**', redirectTo: '' },
];
