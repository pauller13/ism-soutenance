import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Api } from '../services/api';
import { ForecastChart } from '../ui/forecast-chart';
import { Prevision, SerieItem } from '../models/types';

@Component({
  selector: 'app-observatoire',
  imports: [ForecastChart, DecimalPipe],
  template: `
    <h1>Observatoire & prévisions <small>- niveau Macro (SARIMA)</small></h1>
    <p class="intro">Prévision mensuelle du nombre de sinistres. Modèles entraînés sur les années
      complètes (≤ 2025) et prévision de l'année 2026, confrontée au réel déjà observé.</p>

    <div class="row">
      <label>Série :
        <select (change)="choisir($any($event.target).value)">
          @for (s of series(); track s.cle) {
            <option [value]="s.cle" [selected]="s.cle === serie()">{{ s.libelle }}</option>
          }
        </select>
      </label>
    </div>

    @if (prev(); as p) {
      <div class="kpis">
        <div class="kpi"><span>Réel 2025</span><b>{{ p.total_reel_2025 | number }}</b></div>
        <div class="kpi"><span>Prévu 2026</span><b>{{ p.total_prevu | number }}</b></div>
        <div class="kpi" [class.up]="(p.evolution_pct ?? 0) >= 0">
          <span>Évolution</span><b>{{ p.evolution_pct! >= 0 ? '+' : '' }}{{ p.evolution_pct }} %</b>
        </div>
        <div class="kpi"><span>Mois le plus chargé</span><b>Mars</b></div>
      </div>
      <app-forecast-chart [data]="p" />
    } @else if (erreur()) {
      <p class="err">{{ erreur() }}</p>
    } @else {
      <p>Chargement…</p>
    }
  `,
  styles: [`
    h1 small{color:#8795a8;font-weight:500;font-size:1rem}
    .intro{color:#55637a;max-width:720px}
    .row{margin:1rem 0}
    select{padding:.45rem .6rem;border:1px solid #cdd7e5;border-radius:6px;font-size:1rem;margin-left:.4rem}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:.8rem;margin:1rem 0}
    .kpi{background:#fff;border:1px solid #e3e9f2;border-radius:8px;padding:.8rem 1rem}
    .kpi span{display:block;color:#8795a8;font-size:.78rem}
    .kpi b{font-size:1.4rem;color:#1f497d}
    .kpi.up b{color:#c0392b}
    .err{color:#c0392b}
    @media(max-width:640px){.kpis{grid-template-columns:repeat(2,1fr)}}
  `],
})
export class Observatoire implements OnInit {
  private api = inject(Api);
  series = signal<SerieItem[]>([]);
  serie = signal('national');
  prev = signal<Prevision | null>(null);
  erreur = signal<string | null>(null);

  ngOnInit() {
    this.api.series().subscribe({
      next: s => { this.series.set(s); this.charger(); },
      error: () => this.erreur.set("Impossible de joindre l'API (http://127.0.0.1:8000). Est-elle démarrée ?"),
    });
  }
  choisir(cle: string) { this.serie.set(cle); this.charger(); }
  private charger() {
    this.prev.set(null); this.erreur.set(null);
    this.api.prevision(this.serie()).subscribe({
      next: p => this.prev.set(p),
      error: () => this.erreur.set("Erreur lors du chargement de la prévision."),
    });
  }
}
