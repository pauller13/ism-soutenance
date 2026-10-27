import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Api } from '../services/api';
import { Entreprise, EntreprisesResp, FicheEntreprise } from '../models/types';

@Component({
  selector: 'app-entreprises',
  imports: [DecimalPipe],
  template: `
    <h1>Entreprises à inspecter <small>- niveau Méso (XGBoost)</small></h1>
    <p class="intro">Entreprises classées par score de risque pour l'année suivante. En inspectant
      le top 1 %, on retrouve ~69,5 % des entreprises qui deviendront prioritaires.</p>

    <div class="row">
      <label>Part du portefeuille inspectée :
        <select (change)="choisir(+$any($event.target).value)">
          @for (t of tops; track t) {
            <option [value]="t" [selected]="t === top()">{{ t }} %</option>
          }
        </select>
      </label>
      <a class="btn" [href]="api.exportUrl(top())" target="_blank" rel="noopener">⇩ Exporter CSV</a>
    </div>

    @if (resp(); as r) {
      <p class="count">{{ r.nb_affichees | number }} entreprises sur {{ r.total_entreprises | number }} ({{ top() }} %)</p>
      <div class="grid">
        <table>
          <thead><tr><th>Entreprise</th><th>Effectif</th><th>Acc. année</th><th>Acc. passés</th><th>Score</th></tr></thead>
          <tbody>
            @for (e of r.entreprises; track e.entreprise_id) {
              <tr (click)="ouvrir(e)" [class.sel]="fiche()?.entreprise_id === e.entreprise_id">
                <td class="id">{{ e.entreprise_id }}</td>
                <td>{{ e.classe_effectif }}</td>
                <td>{{ e.accidents_annee }}</td>
                <td>{{ e.accidents_avant }}</td>
                <td><span class="score" [style.--p]="e.score_risque">{{ e.score_risque | number:'1.3-3' }}</span></td>
              </tr>
            }
          </tbody>
        </table>

        <aside>
          @if (fiche(); as f) {
            <h3>Fiche entreprise</h3>
            <p class="fid">{{ f.entreprise_id }}</p>
            <p>Score de risque : <b>{{ f.score_risque | number:'1.3-3' }}</b></p>
            <ul class="meta">
              <li>Effectif : {{ f.classe_effectif }}</li>
              <li>Masse salariale : {{ f.classe_masse_salariale }}</li>
              <li>Statut : {{ f.statut }}</li>
              <li>Accidents (année / passés) : {{ f.accidents_annee }} / {{ f.accidents_avant }}</li>
              <li>Décès passés : {{ f.deces_avant }}</li>
            </ul>
            <h4>Pourquoi ce score ? (SHAP)</h4>
            <div class="shap">
              @for (s of f.facteurs_shap; track s.variable) {
                <div class="bar">
                  <span class="lbl">{{ s.variable }}</span>
                  <span class="v" [class.pos]="s.impact > 0"
                        [style.width.%]="largeur(s.impact, f.facteurs_shap)">{{ s.impact > 0 ? '+' : '' }}{{ s.impact | number:'1.2-2' }}</span>
                </div>
              }
            </div>
            <p class="hint">Rouge = augmente le risque, bleu = le réduit.</p>
          } @else {
            <p class="hint">Cliquez sur une entreprise pour voir le détail et les facteurs SHAP.</p>
          }
        </aside>
      </div>
    } @else if (erreur()) {
      <p class="err">{{ erreur() }}</p>
    } @else { <p>Chargement…</p> }
  `,
  styles: [`
    h1 small{color:#8795a8;font-weight:500;font-size:1rem}
    .intro{color:#55637a;max-width:720px}
    .row{display:flex;align-items:center;gap:1rem;margin:1rem 0;flex-wrap:wrap}
    select{padding:.45rem .6rem;border:1px solid #cdd7e5;border-radius:6px;font-size:1rem;margin-left:.4rem}
    .btn{background:#1f497d;color:#fff;text-decoration:none;padding:.5rem .9rem;border-radius:6px;font-weight:600}
    .count{color:#55637a;font-size:.85rem}
    .grid{display:grid;grid-template-columns:1.6fr 1fr;gap:1rem}
    table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e3e9f2;border-radius:8px;overflow:hidden}
    th,td{padding:.5rem .6rem;text-align:left;font-size:.85rem;border-bottom:1px solid #eef2f7}
    th{background:#f3f6fb;color:#55637a}
    tbody tr{cursor:pointer}
    tbody tr:hover{background:#f7faff}
    tbody tr.sel{background:#eaf1fb}
    .id{font-family:monospace;font-size:.78rem}
    .score{font-weight:700;color:#1f497d}
    aside{background:#fff;border:1px solid #e3e9f2;border-radius:8px;padding:1rem;align-self:start}
    .fid{font-family:monospace;font-size:.78rem;color:#55637a;word-break:break-all}
    .meta{list-style:none;padding:0;color:#44506a;font-size:.85rem}
    .meta li{padding:.15rem 0}
    .shap .bar{display:flex;align-items:center;gap:.4rem;margin:.2rem 0}
    .shap .lbl{flex:0 0 46%;font-size:.72rem;color:#55637a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .shap .v{background:#1f77b4;color:#fff;font-size:.7rem;padding:.1rem .3rem;border-radius:3px;min-width:34px}
    .shap .v.pos{background:#d62728}
    .hint{color:#8795a8;font-size:.8rem}
    .err{color:#c0392b}
    @media(max-width:800px){.grid{grid-template-columns:1fr}}
  `],
})
export class Entreprises implements OnInit {
  api = inject(Api);
  tops = [1, 2, 5, 10];
  top = signal(1);
  resp = signal<EntreprisesResp | null>(null);
  fiche = signal<FicheEntreprise | null>(null);
  erreur = signal<string | null>(null);

  ngOnInit() { this.charger(); }
  choisir(t: number) { this.top.set(t); this.fiche.set(null); this.charger(); }
  private charger() {
    this.resp.set(null); this.erreur.set(null);
    this.api.entreprises(this.top()).subscribe({
      next: r => this.resp.set(r),
      error: () => this.erreur.set("Impossible de joindre l'API (http://127.0.0.1:8000)."),
    });
  }
  ouvrir(e: Entreprise) {
    this.api.entreprise(e.entreprise_id).subscribe({ next: f => this.fiche.set(f) });
  }
  largeur(impact: number, all: { impact: number }[]): number {
    const max = Math.max(...all.map(a => Math.abs(a.impact)), 1e-6);
    return 20 + (Math.abs(impact) / max) * 80;
  }
}
