import { Routes } from '@angular/router';
import { Observatoire } from './pages/observatoire';
import { Entreprises } from './pages/entreprises';
import { Assure } from './pages/assure';
import { Qualite } from './pages/qualite';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'observatoire' },
  { path: 'observatoire', component: Observatoire, title: 'Observatoire - Macro' },
  { path: 'entreprises', component: Entreprises, title: 'Entreprises à inspecter - Méso' },
  { path: 'assure', component: Assure, title: 'Score assuré - Micro' },
  // { path: 'qualite', component: Qualite, title: 'Qualité des données' },
];
