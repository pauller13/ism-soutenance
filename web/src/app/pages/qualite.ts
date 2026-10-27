import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Api } from '../services/api';
import { Qualite as QualiteData } from '../models/types';

@Component({
  selector: 'app-qualite',
  imports: [DecimalPipe],
  template: `
    <h1>Qualité des données</h1>
    <p class="intro">Volumes par table, complétude de l'extraction et taux de remplissage des champs
      de la base des sinistres, après nettoyage (notebook 1).</p>

    @if (q(); as d) {
      <div class="badge" [class.ok]="d.extraction_complete">
        {{ d.extraction_complete ? '✓ Extractions complètes (lignes lues = lignes déclarées par Excel)' : '⚠ Extraction à vérifier' }}
      </div>

      <table>
        <thead><tr><th>Table</th><th>Lignes brutes</th><th>Lignes propres</th><th>Doublons retirés</th></tr></thead>
        <tbody>
          @for (t of d.tables; track t.table) {
            <tr><td>{{ t.table }}</td><td>{{ t.lignes_brutes | number }}</td>
                <td>{{ t.lignes_propres | number }}</td><td>{{ t.doublons_retires | number }}</td></tr>
          }
        </tbody>
      </table>

      <p class="taux">Taux d'assurés avec accident : <b>{{ d.taux_accident_pct }} %</b></p>

      <h3>Remplissage des colonnes (sinistres)</h3>
      <div class="fills">
        @for (r of d.remplissage_sinistres; track r.colonne) {
          <div class="bar">
            <span class="lbl">{{ r.colonne }}</span>
            <span class="track"><span class="f" [style.width.%]="r.rempli_pct"></span></span>
            <span class="pct">{{ r.rempli_pct }} %</span>
          </div>
        }
      </div>
    } @else if (erreur()) {
      <p class="err">{{ erreur() }}</p>
    } @else { <p>Chargement…</p> }
  `,
  styles: [`
    .intro{color:#55637a;max-width:720px}
    .badge{display:inline-block;background:#fbe7e7;color:#c0392b;padding:.4rem .8rem;border-radius:6px;font-weight:600;margin:.6rem 0}
    .badge.ok{background:#e7f3ec;color:#2e8b57}
    table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e3e9f2;border-radius:8px;overflow:hidden;margin:.6rem 0}
    th,td{padding:.5rem .7rem;text-align:left;font-size:.88rem;border-bottom:1px solid #eef2f7}
    th{background:#f3f6fb;color:#55637a}
    .taux b{color:#1f497d;font-size:1.1rem}
    .fills{display:flex;flex-direction:column;gap:.35rem;margin-top:.5rem}
    .bar{display:flex;align-items:center;gap:.6rem;font-size:.8rem}
    .lbl{flex:0 0 240px;color:#55637a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .track{flex:1;background:#eef2f7;border-radius:6px;height:14px;overflow:hidden}
    .f{display:block;height:100%;background:#1f77b4}
    .pct{flex:0 0 50px;text-align:right;color:#44506a}
    .err{color:#c0392b}
    @media(max-width:640px){.lbl{flex-basis:120px}}
  `],
})
export class Qualite implements OnInit {
  private api = inject(Api);
  q = signal<QualiteData | null>(null);
  erreur = signal<string | null>(null);
  ngOnInit() {
    this.api.qualite().subscribe({
      next: d => this.q.set(d),
      error: () => this.erreur.set("Impossible de joindre l'API (http://127.0.0.1:8000)."),
    });
  }
}
