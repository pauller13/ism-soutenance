"""Chemins et constantes partagés par l'API."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELES = ROOT / "modeles"
DATA = ROOT / "data"

SEUIL_MICRO_DEFAUT = 0.56

# Secteurs modélisés séparément (mêmes libellés que dans les notebooks)
SECTEURS = [
    "COMMERCE",
    "INDUSTRIE MANUFACTURIERE",
    "TRANSPORT_TERRESTRE,AERIENS",
    "BATIMENT ET T.P",
    "AGRO INDUSTRIE",
    "AGRICOLE PUR",
]

# Définition des séries macro exposées par l'API : clé -> libellé, fichier modèle, filtre secteur
SERIES = {
    "national": {"label": "National", "model": "macro_sarima_national.joblib", "kind": "national"},
    "commerce": {"label": "Commerce", "model": "macro_sarima_secteur_commerce.joblib", "kind": "secteur", "secteur": "COMMERCE"},
    "industrie_manufacturiere": {"label": "Industrie manufacturière", "model": "macro_sarima_secteur_industrie_manufacturiere.joblib", "kind": "secteur", "secteur": "INDUSTRIE MANUFACTURIERE"},
    "transport_terrestre_aeriens": {"label": "Transport terrestre / aérien", "model": "macro_sarima_secteur_transport_terrestre_aeriens.joblib", "kind": "secteur", "secteur": "TRANSPORT_TERRESTRE,AERIENS"},
    "batiment_et_tp": {"label": "Bâtiment et TP", "model": "macro_sarima_secteur_batiment_et_tp.joblib", "kind": "secteur", "secteur": "BATIMENT ET T.P"},
    "agro_industrie": {"label": "Agro-industrie", "model": "macro_sarima_secteur_agro_industrie.joblib", "kind": "secteur", "secteur": "AGRO INDUSTRIE"},
    "agricole_pur": {"label": "Agricole pur", "model": "macro_sarima_secteur_agricole_pur.joblib", "kind": "secteur", "secteur": "AGRICOLE PUR"},
    "autres_secteurs": {"label": "Autres secteurs", "model": "macro_sarima_secteur_autres_secteurs.joblib", "kind": "autres"},
}

# Variables du modèle méso (dans l'ordre attendu avant get_dummies)
MESO_VARIABLES = [
    "CLASSE_EFFECTIF", "CLASSE_MASSE_SALARIALE", "STATUT_ENTREPRISE", "anciennete",
    "accidents_annee", "deces_annee", "accidents_avant", "deces_avant",
]

# Préfixes des colonnes one-hot du modèle micro (pour reconstruire un vecteur depuis un profil)
MICRO_PREFIXES = [
    "SEXE_", "CLASSE_AGE_", "CLASSE_SALAIRE_", "CLASSE_ANCIENNETE_ENTREPRISE_",
    "profession_", "nationalite_", "CLASSE_EFFECTIF_", "CLASSE_MASSE_SALARIALE_",
]
