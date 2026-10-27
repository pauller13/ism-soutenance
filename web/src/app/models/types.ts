export interface SerieItem { cle: string; libelle: string; }

export interface Point { date: string; valeur: number; }
export interface PrevPoint { date: string; valeur: number; bas: number; haut: number; }

export interface Prevision {
  serie: string;
  libelle: string;
  historique: Point[];
  prevision: PrevPoint[];
  reel_2026_observe: Point[];
  total_reel_2025: number;
  total_prevu: number;
  evolution_pct: number | null;
}

export interface Entreprise {
  entreprise_id: string;
  classe_effectif: string;
  classe_masse_salariale: string;
  statut: string;
  accidents_annee: number;
  accidents_avant: number;
  deces_avant: number;
  score_risque: number;
}

export interface EntreprisesResp {
  total_entreprises: number;
  nb_affichees: number;
  entreprises: Entreprise[];
}

export interface FacteurShap { variable: string; impact: number; }
export interface FicheEntreprise extends Omit<Entreprise, 'classe_masse_salariale'> {
  classe_masse_salariale: string;
  facteurs_shap: FacteurShap[];
}

export interface ProfilAssure {
  sexe?: string;
  classe_age?: string;
  classe_salaire?: string;
  classe_anciennete_entreprise?: string;
  profession?: string;
  nationalite?: string;
  classe_effectif?: string;
  classe_masse_salariale?: string;
}

export interface ScoreAssure {
  score: number;
  seuil: number;
  a_risque: boolean;
  recommandations: string[];
}

export type Modalites = Record<string, string[]>;

export interface Qualite {
  tables: { table: string; lignes_brutes: number; lignes_propres: number; doublons_retires: number; }[];
  extraction_complete: boolean;
  taux_accident_pct: number;
  remplissage_sinistres: { colonne: string; rempli_pct: number; }[];
}
