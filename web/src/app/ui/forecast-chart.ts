import { Component, computed, input } from '@angular/core';
import { Prevision } from '../models/types';

interface XY { x: number; y: number; }

@Component({
  selector: 'app-forecast-chart',
  template: `
    @if (geo(); as g) {
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="chart" preserveAspectRatio="xMidYMid meet">
        <!-- grille horizontale -->
        @for (t of g.yticks; track t.v) {
          <line [attr.x1]="PAD" [attr.x2]="W - PAD" [attr.y1]="t.y" [attr.y2]="t.y" class="grid" />
          <text [attr.x]="PAD - 6" [attr.y]="t.y + 4" class="ylabel">{{ t.v }}</text>
        }
        <!-- intervalle de confiance -->
        <polygon [attr.points]="g.band" class="band" />
        <!-- historique -->
        <polyline [attr.points]="g.hist" class="hist" />
        <!-- prévision -->
        <polyline [attr.points]="g.prev" class="prev" />
        <!-- réel 2026 observé -->
        @for (p of g.obs; track p.x) {
          <rect [attr.x]="p.x - 3" [attr.y]="p.y - 3" width="6" height="6" class="obs" />
        }
        <!-- étiquettes x -->
        @for (l of g.xlabels; track l.x) {
          <text [attr.x]="l.x" [attr.y]="H - 6" class="xlabel">{{ l.t }}</text>
        }
      </svg>
      <div class="legende">
        <span><i class="sw hist"></i> historique (≤2025)</span>
        <span><i class="sw prev"></i> prévision</span>
        <span><i class="sw band"></i> intervalle 95 %</span>
        <span><i class="sw obs"></i> réel 2026 observé</span>
      </div>
    }
  `,
  styles: [`
    .chart { width:100%; height:auto; background:#fff; border:1px solid #e3e9f2; border-radius:8px; }
    .grid { stroke:#eef2f7; stroke-width:1; }
    .ylabel { fill:#8795a8; font-size:10px; text-anchor:end; }
    .xlabel { fill:#8795a8; font-size:10px; text-anchor:middle; }
    .band { fill:rgba(31,119,180,.15); stroke:none; }
    .hist { fill:none; stroke:#222; stroke-width:1.6; }
    .prev { fill:none; stroke:#1f77b4; stroke-width:2; }
    .obs { fill:#d62728; }
    .legende { display:flex; gap:1.1rem; flex-wrap:wrap; font-size:.78rem; color:#55637a; margin-top:.5rem; }
    .sw { display:inline-block; width:12px; height:12px; border-radius:2px; vertical-align:middle; margin-right:3px; }
    .sw.hist{background:#222} .sw.prev{background:#1f77b4} .sw.band{background:rgba(31,119,180,.3)} .sw.obs{background:#d62728}
  `],
})
export class ForecastChart {
  data = input<Prevision | null>(null);

  readonly W = 760; readonly H = 300; readonly PAD = 44;

  geo = computed(() => {
    const d = this.data();
    if (!d || !d.historique.length) return null;

    const hist = d.historique.map(p => ({ date: p.date, v: p.valeur }));
    const prev = d.prevision.map(p => ({ date: p.date, v: p.valeur, bas: p.bas, haut: p.haut }));
    const dates = [...hist.map(h => h.date), ...prev.map(p => p.date)];
    const xOf = (i: number) => this.PAD + (i * (this.W - 2 * this.PAD)) / Math.max(1, dates.length - 1);

    const allY = [...hist.map(h => h.v), ...prev.flatMap(p => [p.bas, p.haut]), ...d.reel_2026_observe.map(o => o.valeur)];
    const ymin = Math.min(...allY) * 0.95;
    const ymax = Math.max(...allY) * 1.05;
    const yOf = (v: number) => this.H - 24 - ((v - ymin) / Math.max(1e-6, ymax - ymin)) * (this.H - 48);

    const histXY: XY[] = hist.map((h, i) => ({ x: xOf(i), y: yOf(h.v) }));
    const nH = hist.length;
    const prevXY: XY[] = prev.map((p, i) => ({ x: xOf(nH + i), y: yOf(p.v) }));
    // relier la prévision au dernier point d'historique
    const prevLine = nH ? [histXY[nH - 1], ...prevXY] : prevXY;

    const bandTop = prev.map((p, i) => ({ x: xOf(nH + i), y: yOf(p.haut) }));
    const bandBot = prev.map((p, i) => ({ x: xOf(nH + i), y: yOf(p.bas) })).reverse();
    const band = [...bandTop, ...bandBot].map(p => `${p.x},${p.y}`).join(' ');

    const idx = new Map(dates.map((dt, i) => [dt, i]));
    const obs = d.reel_2026_observe
      .filter(o => idx.has(o.date))
      .map(o => ({ x: xOf(idx.get(o.date)!), y: yOf(o.valeur) }));

    const yticks = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const v = Math.round((ymin + f * (ymax - ymin)) / 10) * 10;
      return { v, y: yOf(v) };
    });

    const step = Math.max(1, Math.round(dates.length / 6));
    const xlabels = dates.map((dt, i) => ({ i, t: dt, x: xOf(i) }))
      .filter(l => l.i % step === 0)
      .map(l => ({ x: l.x, t: l.t.slice(0, 4) }));

    return {
      hist: histXY.map(p => `${p.x},${p.y}`).join(' '),
      prev: prevLine.map(p => `${p.x},${p.y}`).join(' '),
      band, obs, yticks, xlabels,
    };
  });
}
