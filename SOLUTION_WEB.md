# Solution web - API FastAPI + interface Angular

Met les trois modèles de la CNPS (Macro, Méso, Micro) à disposition via une interface web,
sans avoir à ouvrir un notebook. Deux parties indépendantes :

- **`api/`** - API **FastAPI** (Python) : charge les modèles `.joblib` et sert les calculs en JSON.
- **`web/`** - interface **Angular** (TypeScript) : 4 écrans qui consomment l'API.

```
api/
├── main.py            # application FastAPI, CORS, chargement des modèles au démarrage
├── config.py          # chemins, définition des séries et des variables
├── store.py           # charge modèles + données une fois ; logique de scoring
├── schemas.py         # entrées/sorties Pydantic
└── routes/            # un fichier par niveau
    ├── macro.py        # /api/series, /api/prevision/{serie}
    ├── meso.py         # /api/entreprises, /api/entreprises/{id}, /api/entreprises/export
    ├── micro.py        # /api/assures/modalites, /api/assures/score, /api/assures/score-fichier
    └── qualite.py      # /api/qualite
web/
└── src/app/
    ├── services/api.ts      # appels HTTP vers l'API
    ├── models/types.ts      # types partagés
    ├── ui/forecast-chart.ts # graphique SVG (sans dépendance)
    └── pages/               # observatoire (Macro), entreprises (Méso), assure (Micro), qualite
```

## Prérequis

- Les modèles doivent exister dans `modeles/` et les données dans `data/` (lancer les notebooks 0 → 4 une fois).
- Python : l'environnement `.venv` du projet.
- Node.js ≥ 20 et npm (pour Angular).

## 1. Démarrer l'API (port 8000)

```powershell
# depuis la racine du projet
.venv\Scripts\python -m pip install -r api\requirements-api.txt   # une seule fois
.venv\Scripts\python -m uvicorn api.main:app --reload
```

- Documentation interactive (Swagger) : <http://127.0.0.1:8000/docs>
- Santé : <http://127.0.0.1:8000/api/sante>

Au démarrage, l'API charge une seule fois : les 8 modèles SARIMA, le modèle XGBoost (méso,
avec reconstruction de la table de scores 2025) et la forêt aléatoire (micro).

## 2. Démarrer l'interface Angular (port 4200)

```powershell
cd web
npm install        # une seule fois
npm start          # = ng serve --proxy-config proxy.conf.json
```

Ouvrir <http://localhost:4200>. L'interface appelle l'API via le chemin **relatif `/api`** :
en développement, `proxy.conf.json` redirige `/api` vers `http://localhost:8000` ; en Docker,
c'est nginx qui fait le relais. Aucune configuration de CORS n'est donc nécessaire côté navigateur.

## 3. Tout lancer avec Docker (recommandé pour une démo)

Prérequis : Docker Desktop. Les modèles (`modeles/`) et les données (`data/`) doivent exister
(lancer les notebooks une fois) ; ils sont montés en lecture seule, pas copiés dans les images.

```powershell
# depuis la racine du projet
docker compose up --build
```

- Interface : <http://localhost:8080>
- API : <http://localhost:8000/docs>

Deux services :

| Service | Image | Rôle |
|---|---|---|
| `api` | `python:3.13-slim` (voir `api/Dockerfile`) | FastAPI + Uvicorn, modèles/données montés en volumes |
| `web` | build Node puis `nginx:alpine` (voir `web/Dockerfile`) | sert l'Angular compilé et relaie `/api` vers le service `api` |

Arrêter : `docker compose down`.

## Les 4 écrans

| Écran | Niveau | Contenu |
|---|---|---|
| **Observatoire** | Macro | choix de la série (national + 7 secteurs), courbe historique + prévision 2026 avec intervalle 95 % et réel observé, KPIs |
| **Entreprises** | Méso | classement par score, curseur 1–10 %, fiche entreprise avec facteurs SHAP, export CSV |
| **Assuré** | Micro | formulaire (listes déroulantes issues du modèle), score + jauge au seuil 0,56 + recommandations |
| **Qualité** | - | volumes par table, complétude de l'extraction, taux de remplissage des champs |

## Points d'accès de l'API

| Méthode & adresse | Entrée | Sortie |
|---|---|---|
| `GET /api/series` | - | séries disponibles (national + secteurs) |
| `GET /api/prevision/{serie}?mois=12` | série, horizon | historique, prévision mensuelle, intervalle 95 %, réel 2026 observé |
| `GET /api/entreprises?top=1` | part du portefeuille (%) | entreprises classées par score |
| `GET /api/entreprises/{id}` | identifiant | score, historique, contributions SHAP |
| `GET /api/entreprises/export?top=5` | part du portefeuille | fichier CSV |
| `GET /api/assures/modalites` | - | modalités valides par champ (pour le formulaire) |
| `POST /api/assures/score` | profil (JSON) | score, décision au seuil 0,56, recommandations |
| `POST /api/assures/score-fichier` | fichier CSV | CSV enrichi des scores |
| `GET /api/qualite` | - | indicateurs de qualité des données |

## Build de production Angular

```powershell
cd web
npm run build      # génère web/dist/web
```

Les deux tiers peuvent ensuite être conteneurisés (un conteneur API, un conteneur interface), sans GPU.
