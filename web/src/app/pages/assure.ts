import { Component, OnInit, inject, signal } from '@angular/core';
import { Api } from '../services/api';
import { Modalites, ProfilAssure, ScoreAssure } from '../models/types';

@Component({
  selector: 'app-assure',
  template: `
    <h1>Score de risque d'un assuré <small>- niveau Micro (forêt aléatoire)</small></h1>
    <p class="intro">Renseignez le profil : le modèle estime un score de risque et propose des
      recommandations de prévention. Décision au seuil 0,56 (rappel ≥ 75 %).</p>

    <div class="grid">
      <form (submit)="scorer($event)">
        @for (f of fields; track f.f) {
          <label>{{ f.label }}
            <select (change)="set(f.f, $any($event.target).value)">
              <option value="">- non renseigné -</option>
              @for (o of options(f.k); track o) { <option [value]="o">{{ o }}</option> }
            </select>
          </label>
        }
        <button type="submit">Calculer le score</button>
      </form>

      <aside>
        @if (res(); as r) {
          <h3>Résultat</h3>
          <div class="gauge">
            <div class="fill" [class.risk]="r.a_risque" [style.width.%]="r.score * 100"></div>
            <div class="seuil" [style.left.%]="r.seuil * 100" [title]="'seuil ' + r.seuil"></div>
          </div>
          <p class="scoreline">
            Score : <b>{{ r.score }}</b>
            <span class="tag" [class.risk]="r.a_risque">{{ r.a_risque ? 'À RISQUE' : 'sous le seuil' }}</span>
          </p>
          <h4>Recommandations</h4>
          <ul>@for (a of r.recommandations; track a) { <li>{{ a }}</li> }</ul>
        } @else if (erreur()) {
          <p class="err">{{ erreur() }}</p>
        } @else {
          <p class="hint">Remplissez le formulaire puis cliquez sur « Calculer le score ».</p>
        }
      </aside>
    </div>
  `,
  styles: [`
    h1 small{color:#8795a8;font-weight:500;font-size:1rem}
    .intro{color:#55637a;max-width:720px}
    .grid{display:grid;grid-template-columns:1.2fr 1fr;gap:1.2rem;margin-top:1rem}
    form{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;background:#fff;border:1px solid #e3e9f2;border-radius:8px;padding:1rem}
    label{display:flex;flex-direction:column;font-size:.8rem;color:#55637a;gap:.2rem}
    select{padding:.4rem;border:1px solid #cdd7e5;border-radius:6px;font-size:.9rem}
    button{grid-column:1/3;background:#1f497d;color:#fff;border:none;padding:.6rem;border-radius:6px;font-weight:700;font-size:.95rem;cursor:pointer}
    button:hover{background:#163a63}
    aside{background:#fff;border:1px solid #e3e9f2;border-radius:8px;padding:1rem;align-self:start}
    .gauge{position:relative;height:22px;background:#eef2f7;border-radius:11px;overflow:hidden;margin:.6rem 0}
    .fill{height:100%;background:#2e8b57;border-radius:11px}
    .fill.risk{background:#d62728}
    .seuil{position:absolute;top:0;width:2px;height:100%;background:#1f497d}
    .scoreline b{font-size:1.2rem;color:#1f497d}
    .tag{margin-left:.5rem;font-size:.72rem;background:#e7f3ec;color:#2e8b57;padding:.1rem .45rem;border-radius:4px;font-weight:700}
    .tag.risk{background:#fbe7e7;color:#c0392b}
    ul{padding-left:1.1rem;color:#44506a;font-size:.9rem}
    .hint{color:#8795a8;font-size:.85rem}
    .err{color:#c0392b}
    @media(max-width:800px){.grid{grid-template-columns:1fr}form{grid-template-columns:1fr}button{grid-column:1}}
  `],
})
export class Assure implements OnInit {
  private api = inject(Api);
  fields = [
    { f: 'sexe', k: 'SEXE', label: 'Sexe' },
    { f: 'classe_age', k: 'CLASSE_AGE', label: 'Âge' },
    { f: 'classe_salaire', k: 'CLASSE_SALAIRE', label: 'Salaire' },
    { f: 'classe_anciennete_entreprise', k: 'CLASSE_ANCIENNETE_ENTREPRISE', label: 'Ancienneté' },
    { f: 'profession', k: 'profession', label: 'Profession' },
    { f: 'nationalite', k: 'nationalite', label: 'Nationalité' },
    { f: 'classe_effectif', k: 'CLASSE_EFFECTIF', label: 'Effectif employeur' },
    { f: 'classe_masse_salariale', k: 'CLASSE_MASSE_SALARIALE', label: 'Masse salariale employeur' },
  ];
  modalites = signal<Modalites>({});
  profil: ProfilAssure = {};
  res = signal<ScoreAssure | null>(null);
  erreur = signal<string | null>(null);

  ngOnInit() {
    this.api.modalites().subscribe({
      next: m => this.modalites.set(m),
      error: () => this.erreur.set("Impossible de joindre l'API (http://127.0.0.1:8000)."),
    });
  }
  options(k: string): string[] {
    return [...(this.modalites()[k] ?? [])].sort();
  }
  set(field: string, value: string) {
    (this.profil as any)[field] = value || undefined;
  }
  scorer(ev: Event) {
    ev.preventDefault();
    this.res.set(null); this.erreur.set(null);
    this.api.scorerAssure(this.profil).subscribe({
      next: r => this.res.set(r),
      error: () => this.erreur.set("Erreur lors du calcul du score."),
    });
  }
}
