import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="topbar">
      <div class="brand">
        <span class="logo">CNPS</span>
        <span class="brand-text">Prévention prédictive des accidents du travail</span>
      </div>
      <nav>
        <a routerLink="/observatoire" routerLinkActive="actif">Observatoire</a>
        <a routerLink="/entreprises" routerLinkActive="actif">Entreprises</a>
        <a routerLink="/assure" routerLinkActive="actif">Assuré</a>
        <a routerLink="/qualite" routerLinkActive="actif">Qualité</a>
      </nav>
    </header>
    <main><router-outlet /></main>
    <footer>Système de prédiction multi-niveaux</footer>
  `,
  styles: [`
    :host { display:flex; flex-direction:column; min-height:100vh; }
    .topbar { display:flex; align-items:center; justify-content:space-between;
      background:#1f497d; color:#fff; padding:0 1.4rem; height:60px; }
    .brand { display:flex; align-items:center; gap:.7rem; }
    .logo { background:#fff; color:#1f497d; font-weight:800; border-radius:6px; padding:.2rem .5rem; }
    .brand-text { font-weight:600; }
    nav { display:flex; gap:.3rem; }
    nav a { color:#cfe0f5; text-decoration:none; padding:.5rem .9rem; border-radius:6px; font-weight:600; }
    nav a:hover { background:rgba(255,255,255,.12); color:#fff; }
    nav a.actif { background:#fff; color:#1f497d; }
    main { flex:1; padding:1.6rem; max-width:1200px; width:100%; margin:0 auto; box-sizing:border-box; }
    footer { text-align:center; color:#6b7a90; font-size:.8rem; padding:1rem; border-top:1px solid #e3e9f2; }
    @media (max-width:640px){ .brand-text{display:none} main{padding:1rem} }
  `],
})
export class App {}
