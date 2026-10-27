import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  SerieItem, Prevision, EntreprisesResp, FicheEntreprise,
  ProfilAssure, ScoreAssure, Modalites, Qualite,
} from '../models/types';

/** Adresse de l'API FastAPI (chemin relatif : proxy ng serve en dev, nginx en prod/Docker). */
export const API_BASE = '/api';

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  // --- Macro
  series(): Observable<SerieItem[]> {
    return this.http.get<SerieItem[]>(`${API_BASE}/series`);
  }
  prevision(serie: string, mois = 12): Observable<Prevision> {
    const params = new HttpParams().set('mois', mois);
    return this.http.get<Prevision>(`${API_BASE}/prevision/${serie}`, { params });
  }

  // --- Méso
  entreprises(top: number): Observable<EntreprisesResp> {
    const params = new HttpParams().set('top', top);
    return this.http.get<EntreprisesResp>(`${API_BASE}/entreprises`, { params });
  }
  entreprise(id: string): Observable<FicheEntreprise> {
    return this.http.get<FicheEntreprise>(`${API_BASE}/entreprises/${id}`);
  }
  exportUrl(top: number): string {
    return `${API_BASE}/entreprises/export?top=${top}`;
  }

  // --- Micro
  modalites(): Observable<Modalites> {
    return this.http.get<Modalites>(`${API_BASE}/assures/modalites`);
  }
  scorerAssure(profil: ProfilAssure): Observable<ScoreAssure> {
    return this.http.post<ScoreAssure>(`${API_BASE}/assures/score`, profil);
  }

  // --- Qualité
  qualite(): Observable<Qualite> {
    return this.http.get<Qualite>(`${API_BASE}/qualite`);
  }
}
