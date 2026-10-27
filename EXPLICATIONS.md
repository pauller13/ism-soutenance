# Projet CNPS - Explication complète

Ce document explique **tout le projet** : son organisation, la façon de le lancer, ce que fait chaque notebook, les résultats obtenus, les erreurs corrigées par rapport à la première version et les limites à présenter en soutenance.

---

## 1. Le projet en une phrase

À partir des données de la CNPS (entreprises, travailleurs, sinistres), on construit **trois modèles complémentaires** pour mieux prévenir les accidents du travail :

| Niveau | Question | Modèle | Notebook |
|---|---|---|---|
| **Macro** | Combien de sinistres attendre dans les 12 prochains mois ? | SARIMA (comparé à Prophet et à une méthode naïve) | 2 |
| **Méso** | Quelles entreprises inspecter en priorité ? | XGBoost (comparé à une règle simple) | 3 |
| **Micro** | Quels assurés sont les plus exposés à un accident ? | Forêt aléatoire (comparée à une régression logistique) | 4 |

---

## 2. Organisation des fichiers

```
soutenance/
├── 0_conversion_excel_vers_parquet.ipynb
├── 1_audit_nettoyage_exploration.ipynb
├── 2_modele_macro_prevision_sinistres.ipynb
├── 3_modele_meso_entreprises_prioritaires.ipynb
├── 4_modele_micro_risque_assures.ipynb
├── EXPLICATIONS.md                         ← ce document
├── data/
│   ├── brut/                               ← les 3 fichiers Excel d'origine
│   ├── entreprises.parquet                 ← créés par le notebook 0 (données brutes)
│   ├── travailleurs.parquet
│   ├── sinistres.parquet
│   ├── entreprises_propre.parquet          ← créés par le notebook 1 (données nettoyées)
│   ├── travailleurs_propre.parquet
│   ├── sinistres_propre.parquet
│   └── liste_entreprises_prioritaires.csv  ← créé par le notebook 3
├── modeles/
│   ├── macro_sarima_national.joblib        ← notebook 2
│   ├── macro_sarima_btp.joblib             ← notebook 2
│   ├── macro_sarima_secteur_*.joblib       ← notebook 2 (7 modèles sectoriels)
│   ├── meso_xgboost_entreprises.joblib     ← notebook 3
│   └── micro_foret_aleatoire_assures.joblib← notebook 4
└── .venv/                                  ← environnement Python (caché)
```

---

## 3. Comment lancer le projet

1. Ouvrir le dossier dans **VS Code** (extensions *Python* et *Jupyter* installées).
2. Ouvrir un notebook → **« Select Kernel »** (en haut à droite) → **Python Environments** → **`.venv`**.
3. Lancer les notebooks **dans l'ordre 0 → 1 → 2 → 3 → 4** (bouton « Run All »).

| Notebook | Durée approximative |
|---|---|
| 0 - conversion | ~1 min 30 (lecture des Excel) |
| 1 - audit / exploration | ~30 s |
| 2 - macro | ~30 s |
| 3 - méso | ~30 s |
| 4 - micro | ~2 min |

> Les fichiers `data/*.parquet` et `modeles/*` sont **recréés automatiquement** par les notebooks. S'ils sont supprimés, il suffit de relancer les notebooks dans l'ordre.

---

## 4. Les données

| Table | Lignes | Une ligne = | Colonnes principales |
|---|---|---|---|
| `entreprises` | 337 137 | un employeur, une année (2022–2026) | statut, année d'immatriculation, classe d'effectif, classe de masse salariale |
| `travailleurs` | 1 048 001 | un assuré | sexe, nationalité, profession, âge, salaire, ancienneté, **STATUT_AT** (avec/sans accident) |

| `sinistres` | 321 127 | un dossier d'accident | date, secteur, âge, type (travail / trajet / maladie pro), coût, décès, durée d'arrêt |

Les trois tables sont reliées par `ENTREPRISE_ID` et `TRAVAILLEUR_ID` (identifiants pseudonymisés).

---

## 5. Notebook 0 - Conversion Excel → Parquet

**But :** lire une seule fois les fichiers Excel (lents : ~1 minute chacun) et les enregistrer au format **Parquet**, qui se lit en quelques secondes et prend jusqu'à 2,5 fois moins de place.

**Vérification ajoutée :** un fichier Excel indique lui-même son nombre de lignes. Le notebook compare ce nombre au nombre de lignes réellement lues :

| Table | Lignes dans l'Excel | Lignes lues | Statut |
|---|---|---|---|
| entreprises | 337 137 | 337 137 | ✅ tout est chargé |
| travailleurs | 1 048 001 | 1 048 001 | ✅ tout est chargé |
| sinistres | 321 127 | 321 127 | ✅ tout est chargé |

Les totaux lus **coïncident exactement** avec ceux déclarés dans les fichiers Excel : les extractions transmises par la CNPS sont donc **complètes**.

**Si une extraction CSV est fournie** (par exemple `data/brut/travailleurs_pseudonymises.csv`), le notebook l'utilise **automatiquement** à la place de l'Excel.

---

## 6. Notebook 1 - Audit qualité, nettoyage, exploration

### 6.1 Problèmes trouvés dans les données

| Problème | Ampleur | Conséquence si on ne corrige pas |
|---|---|---|
| Sinistres en double | **65 039 lignes (20 %)** | tous les comptages surestimés d'un quart |
| Dates fictives | 58 sinistres en **1899** | fausses années dans la série temporelle |
| Assurés présents plusieurs fois | 6 260 | assurés comptés deux fois |
| Colonnes presque vides | `PLAGE_HORAIRE` 99,9 %, `MATERIEL` 98 %, `NATURE_LESION` 97 %, `SIEGE_LESION` 95 % | analyses impossibles |
| Sexe incohérent | valeurs « 0 », « 1 », « = », « A » | modalités parasites |

### 6.2 Nettoyage appliqué

* suppression des doublons et d'un éventuel second enregistrement d'un même sinistre ;
* années < 1960 → manquantes ;
* suppression des 4 colonnes presque vides ;
* un assuré est gardé une seule fois (de préférence sur sa ligne `AVEC_AT`) ;
* sexe : seulement M ou F ;
* année d'immatriculation 1900 (valeur par défaut) → manquante.

**Résultat :** 255 350 sinistres uniques et 1 041 741 assurés uniques.

### 6.3 Ce que montrent les graphiques

| Figure | Ce qu'on voit | Ce qu'on en retient |
|---|---|---|
| 1.1 Valeurs manquantes | 4 colonnes presque vides | elles sont supprimées ; l'analyse par plage horaire est impossible |
| 1.2 Sinistres par année (1990–2025) | hausse jusqu'en 2007, chute en 2009–2011 (crise), remontée depuis 2012 ; les accidents de trajet passent de ~10 % à plus de 25 % ; **2026 incomplète est exclue** | sinistralité en hausse ; risque routier croissant ; maladies professionnelles sous-déclarées |
| 1.3 Top 10 des secteurs (2021–2025) | commerce + industrie ≈ la moitié des sinistres ; 10 secteurs = 88 % | prévention à cibler par secteur |
| 1.4 Âge des victimes | majorité de 26–45 ans | reflète surtout la pyramide des âges des salariés |
| 1.5 Coût par type | les accidents de trajet coûtent plus cher et sont **2,6 fois plus mortels** (0,36 % contre 0,14 %) | la prévention routière est un levier fort |
| 1.6 Cible micro | **4,3 %** d'assurés avec accident | classes déséquilibrées → on n'utilise pas l'accuracy |
| 1.7 Taux d'accident par profil | pic chez les 36–45 ans (6,8 %), salaire « 1m+ » à 8,3 %, hommes 4,6 % contre femmes 3,2 % ; « non renseigné » ≈ 1,5 % | **biais de saisie** : les dossiers des accidentés sont mieux remplis |
| Tableau `NOMBRE_ATM` | `NOMBRE_ATM = 0` ⇔ sans accident ; `≥ 1` ⇔ avec accident | **fuite d'information** : variable exclue |

### 6.4 Analyses statistiques : tests d'hypothèses (section 4 du notebook 1)

Les graphiques ne suffisent pas : un écart peut venir du hasard de l'échantillon. Chaque constat clé est confirmé par un **test** (seuil α = 0,05, avec H₀ « pas d'effet » / H₁ « effet »). Comme les effectifs sont énormes, on mesure aussi la **taille d'effet** (V de Cramér, risque relatif).

| Hypothèse | Test | p-value | Taille d'effet | Décision |
|---|---|---|---|---|
| **H1** – le profil d'accident (travail/trajet/maladie) dépend du secteur | χ² d'indépendance | ≈ 10⁻¹⁸⁷ | V ≈ 0,12 (modéré) | H₀ rejetée |
| **H2** – dans le commerce, les métiers de surveillance ont plus d'accidents de trajet que la manutention | z (2 proportions) | ≈ 10⁻⁵⁴ | 46,7 % vs 21,0 % (RR ≈ 2,2) | H₀ rejetée |
| **H3** – les accidents de trajet sont plus souvent mortels | z (2 proportions) | ≈ 10⁻²¹ | 0,36 % vs 0,14 % (RR ≈ 2,6) | H₀ rejetée |
| **H4** – le sexe et l'âge sont liés au risque d'accident | χ² d'indépendance | ≪ 0,05 | V ≈ 0,03–0,08 (faible) | H₀ rejetée |

* **H2** est l'exemple « métier » : les agents de sécurité / vigiles (poste statique mais trajets longs et à horaires décalés) ont bien plus d'accidents de trajet que les manutentionnaires (travail physique sur site). L'hypothèse, posée à partir des **caractéristiques du métier**, est confirmée par le test.
* Ces résultats **fondent les choix de modélisation** : prévision par secteur (H1), priorité au risque routier ciblé (H2, H3), modèle multivarié plutôt qu'une règle univariée (H4).

---

## 7. Notebook 2 - Modèle MACRO (prévision des sinistres)

### Méthode

1. On compte les sinistres **par mois**.
2. **Information métier :** 2026 est incomplète. On **coupe la série à fin 2025** (dernière année complète) et on garde **janvier 2012 → décembre 2025** (168 mois ; avant 2012, la crise 2009–2011 perturbe la série). L'année 2026 n'est **pas** utilisée pour l'analyse ni l'entraînement : elle servira à **valider** la prévision.
3. On analyse la série : **tendance** (de ~550 à ~750 sinistres par mois) et **saisonnalité** (mars le plus chargé, août–septembre les plus calmes, ~20 % d'écart).
4. On **cache l'année 2025**, on entraîne trois modèles sur 2012→2024, puis on compare leurs prévisions de 2025 à la réalité.
5. On **ré-entraîne sur tout ≤2025** et on prévoit l'**année civile 2026 entière**, qu'on confronte au **réel 2026 observé** (jan.→juil.) : validation hors échantillon.

### Pourquoi SARIMA ? (justification renforcée)

La série est une **série mensuelle avec tendance + saisonnalité de 12 mois, de longueur modérée (168 points)**. Ce régime désigne SARIMA comme le choix le plus approprié, pas seulement « un modèle qui marche » :

| Candidat | Verdict | Raison |
|---|---|---|
| Naïf saisonnier | référence | ne s'adapte pas à la tendance ; sert de garde-fou |
| Holt-Winters | écarté | cas particulier de SARIMA, intervalle moins exploitable |
| Prophet | écarté | extrapole trop la tendance : **dérape à 31,8 % sur le transport** (SARIMA : 24,9 % au pire) |
| LSTM / réseaux | écarté | demandent des milliers de points → sur-apprentissage sur 168 mois |
| **SARIMA** | **retenu** | référence pour ce régime ; **intervalle de confiance analytique** (budget) ; **robuste** |

**Validation statistique de la spécification SARIMA(1,1,1)(1,1,1,12) :**

| Diagnostic | Résultat | Conclusion |
|---|---|---|
| ADF (stationnarité) | série brute p = 0,32 ; après différenciation p = 0,002 | justifie *d = 1* et *D = 1* |
| AIC | 1 694 (avec saison) vs 1 846 (sans) | la composante saisonnière est **utile** |
| Ljung-Box (résidus, lag 12) | p = 0,74 | résidus = **bruit blanc** → modèle adéquat |

### Résultats (test sur l'année 2025)

| Modèle | National : MAE / MAPE | BTP : MAE / MAPE |
|---|---|---|
| Naïf saisonnier (référence) | 52,8 / 7,4 % | 7,9 / 12,3 % |
| **SARIMA** | 49,7 / **7,1 %** | 10,2 / 17,7 % |
| Prophet | 47,9 / **6,9 %** | 9,7 / 16,8 % |

* Au **niveau national**, SARIMA (7,1 %) et Prophet (6,9 %) battent la référence (7,4 %) : erreur d'environ **50 sinistres par mois**.
* Pour le **BTP** (~47 sinistres par mois), l'erreur est plus grande à cause du **hasard** : la variation naturelle vaut ≈ 1/√47 ≈ 15 %. Le naïf y est même le meilleur : aucun modèle ne descend durablement sous le bruit de Poisson.

### Prévision de l'année 2026 et validation

| | Réel 2025 | Prévu 2026 | Évolution | Validation vs réel 2026 observé |
|---|---|---|---|---|
| National | 8 688 | 8 961 | +3,1 % | MAPE 7,9 % |
| BTP | 800 | 812 | +1,5 % | MAPE 18,2 % |

Les points réels de 2026 (jan.→juil.) tombent **dans l'intervalle de confiance à 95 %** : la prévision est validée sur des mois qui n'ont pas servi à l'entraînement.

### Analyse par secteur : un modèle par secteur

Le modèle national ne prévoit que le **total**. Pour analyser un secteur, on entraîne **un modèle par secteur** avec la même méthode (test sur 2025, prévision de 2026).

* **Secteurs modélisés** (≥ 30 sinistres/mois) : commerce, industrie manufacturière, transport, BTP, agro-industrie, agricole pur (79 % des sinistres), plus « AUTRES SECTEURS » → **7 modèles sectoriels**.
* **Matrice de corrélation (Figure 2.8) :** les secteurs évoluent **indépendamment** les uns des autres. On ne peut donc pas répartir la prévision nationale avec des pourcentages fixes → un modèle par secteur (cohérent avec le test H1).
* **Erreurs (Figure 2.9) et prévisions 2026 :**

| Série | Meilleur modèle (test 2025) | MAPE | Réel 2025 | Prévu 2026 | Évolution |
|---|---|---|---|---|---|
| Commerce | Prophet | 7,7 % | 2 231 | 2 320 | +4,0 % |
| Industrie manufacturière | Prophet | 8,9 % | 2 103 | 2 151 | +2,3 % |
| Transport | Naïf | 15,2 % | 698 | 702 | +0,6 % |
| BTP | Naïf | 12,3 % | 800 | 812 | +1,5 % |
| Agro-industrie | Prophet | 16,6 % | 587 | 586 | −0,2 % |
| Agricole pur | SARIMA | 24,9 % | 398 | 441 | +10,8 % |
| Autres secteurs | SARIMA | 8,5 % | 1 871 | 1 924 | +2,8 % |
| **Somme des secteurs** | - | - | 8 688 | **8 936** | +2,9 % |
| **Modèle national** | SARIMA (retenu) | 7,1 % | 8 688 | **8 961** | +3,1 % |

* Aucun modèle n'est le meilleur partout. **SARIMA est retenu pour toutes les prévisions finales** car il n'a jamais d'erreur catastrophique (Prophet atteint **31,8 %** sur le transport) et fournit un intervalle de confiance.
* **Bruit de Poisson (Figure 2.10) :** l'erreur baisse quand le volume augmente et suit la courbe 100/√(moyenne). Pour les petits secteurs, l'erreur vient surtout du hasard.
* **Cohérence :** la **somme des secteurs (8 936)** et le **modèle national (8 961)** ne diffèrent que de **0,3 %** : les deux approches concordent.

**Utilité :** anticiper le budget des prestations et la charge de travail des services, au niveau national et par secteur.

---

## 8. Notebook 3 - Modèle MÉSO (entreprises prioritaires)

### Définition

**Entreprise prioritaire** = au moins **2 accidents** OU au moins **1 décès** dans l'année (≈ 1 % des entreprises chaque année).

### Méthode

* **Principe clé :** on prédit l'année **N+1** avec les informations de l'année **N** (on ne « triche » pas en utilisant les accidents qu'on cherche à prédire).
* **Variables :** classe d'effectif, masse salariale, statut, ancienneté de l'entreprise, accidents de l'année N, accidents et décès **avant** l'année N (historique depuis 1965).
* **Découpage dans le temps :** entraînement sur 2022–2023, test sur 2024 (pour prédire 2025, dernière année complète).
* **Lien passé → futur testé :** χ² entre la classe d'historique et le fait de devenir prioritaire : p ≪ 0,05, **V de Cramér ≈ 0,50** (effet fort). L'historique est donc à la fois la variable clé et la référence (« règle simple ») à battre.

### Pourquoi XGBoost ? (justification renforcée)

Données **tabulaires et hétérogènes**, **interactions** (taille × historique), cible **très rare** (~1 %), besoin d'**explicabilité**. Le gradient boosting est la référence dans ce cas. On le compare **empiriquement** à trois alternatives sur les mêmes données :

| Modèle | AUC-ROC | AUC-PR (cible rare) |
|---|---|---|
| Hasard | 0,500 | 0,010 |
| Règle simple (historique) | 0,948 | 0,475 |
| Régression logistique | 0,990 | 0,748 |
| Forêt aléatoire | 0,991 | 0,744 |
| **XGBoost (retenu)** | 0,990 | **0,759** |

Sur l'**AUC-PR** (la métrique adaptée à une cible rare), XGBoost obtient le **meilleur** score (0,759), devant la régression logistique (0,748) et la forêt (0,744), toutes loin devant la règle simple (0,475). C'est la justification **empirique** qui s'ajoute à la justification théorique.

**Courbe de gain : si on inspecte les x % d'entreprises les plus à risque, quelle part des entreprises prioritaires trouve-t-on ?**

| % d'entreprises inspectées | Règle simple | XGBoost |
|---|---|---|
| 1 % (~700 entreprises) | 50,7 % | **69,5 %** |
| 2 % | 72,5 % | **85,9 %** |
| 5 % | 86,5 % | **95,2 %** |
| 10 % | 92,0 % | **97,9 %** |

### Interprétation (SHAP)

* très **petite entreprise** (1–5 salariés) → risque plus faible ;
* **beaucoup d'accidents passés** → risque plus élevé ;
* entreprise **en activité** → risque plus élevé qu'une entreprise suspendue ;
* entreprise **ancienne** → risque plutôt plus faible, à taille égale ;
* **grande entreprise** (51–250, 251+) → risque plus élevé.

Le modèle est **cohérent avec le bon sens métier**.

**Livrable :** `data/liste_entreprises_prioritaires.csv` (les 20 entreprises les plus à risque, selon les données 2025).

---

## 9. Notebook 4 - Modèle MICRO (risque individuel)

### Méthode

* **Cible :** `STATUT_AT` (1 = accident, 0 = pas d'accident).
* **Variables utilisées :** sexe, âge, salaire, ancienneté dans l'entreprise, profession (30 plus fréquentes), nationalité (10 plus fréquentes), effectif et masse salariale de l'employeur.
* **Variables exclues (fuites d'information) :** `NOMBRE_ATM`, `ANNEE_ACCIDENT`, `CLASSE_ANCIENNETE_AVANT_AT`. Elles ne sont connues **que** pour les accidentés.
* **Découpage :** 60 % entraînement, 20 % validation (pour choisir le seuil), 20 % test (évaluation finale).
* **Déséquilibre des classes :** `class_weight="balanced"`.
* **Seuil de décision :** le plus élevé qui garde un **rappel ≥ 75 %** sur le jeu de validation → **0,56**.

### Pourquoi la forêt aléatoire ? (justification renforcée)

Elle est **prévue par le cahier des charges**, mais aussi **adaptée aux données** : variables surtout catégorielles / ordinales (pas de mise à l'échelle), **effets de seuil** (risque qui s'effondre après 66 ans, bondit chez les nouveaux arrivants) et **interactions** captés automatiquement, robustesse au bruit via le *bagging*. On la compare à une **régression logistique** (référence simple et explicable). Les deux obtiennent la **même AUC (0,847)** : les relations sont donc presque **additives** (pas d'interactions fortes). On garde la forêt (cahier des charges + effets de seuil), la logistique restant une alternative valable et plus explicable ; le **gradient boosting** est noté comme piste d'amélioration.

### Résultats sur le jeu de test

| Indicateur | Valeur | Signification |
|---|---|---|
| AUC-ROC (forêt aléatoire) | **0,847** | dans 85 % des cas, l'accidenté a un score plus élevé que le non-accidenté |
| AUC-ROC (régression logistique) | 0,847 | même performance avec un modèle plus simple |
| **Rappel** | **77 %** | 6 884 accidentés détectés sur 8 911 → **objectif de 75 % atteint** |
| Précision | 13 % | sur 100 alertes, 13 sont de vrais accidentés (3 fois mieux que le hasard, 4,3 %) |
| Part d'assurés signalés | ~26 % | la médecine du travail se concentre sur un quart des assurés |

### Variables les plus importantes

1. masse salariale de l'employeur « 1m+ » ;
2. effectif de l'employeur « 251+ » ;
3. salaire de l'assuré « 1m+ » ;
4. modalités « non renseigné » (salaire, profession, âge) → **biais de saisie**.

### Vérification du biais de saisie

| Population | AUC |
|---|---|
| Tous les assurés | 0,847 |
| Assurés dont l'âge et le salaire sont renseignés (47 %) | 0,791 |

Une partie de la performance vient du biais de saisie, mais le modèle reste **nettement meilleur que le hasard**. La performance « honnête » se situe **entre 0,79 et 0,85**.

### Utilisation

Le score de chaque assuré est traduit en **recommandations** : visite médicale si le score dépasse le seuil, formation pour les jeunes, accompagnement des nouveaux arrivants, signalement au service HSE pour les grandes entreprises.

---

## 10. Erreurs corrigées par rapport à la première version

| Problème dans la version d'origine | Correction |
|---|---|
| Les fichiers `.ipynb` étaient du **code Python brut** : impossible de les ouvrir comme notebooks | vrais notebooks Jupyter, avec texte, code et résultats |
| `NOMBRE_ATM` utilisé dans le modèle micro : **il contient la réponse** | variable exclue (ainsi que deux autres fuites) |
| Graphique par **plage horaire** alors que la colonne est vide à 99,9 % | graphique supprimé, remplacé par d'autres analyses |
| Secteur `"BATIMENT ET T.P."` mal orthographié : la série BTP était **vide** | nom corrigé (`"BATIMENT ET T.P"`) |
| **20 % de doublons** non supprimés | doublons supprimés |
| Modèle méso : les accidents de l'année servaient à prédire **la même année** | prédiction de l'année N+1 avec les données de l'année N, découpage dans le temps |
| Seuil du modèle micro choisi **sur le jeu de test** | seuil choisi sur un jeu de validation séparé |
| Pas de comparaison avec une méthode simple | chaque modèle est comparé à une référence (naïf, règle simple, régression logistique) |
| Modèles macro et méso non sauvegardés | les 4 modèles sont sauvegardés dans `modeles/` |

---

## 11. Limites à présenter honnêtement

1. **Biais de saisie.** Les informations (âge, salaire, profession) sont mieux remplies pour les accidentés : une partie du signal du modèle micro en vient (AUC « honnête » entre 0,79 et 0,85).
2. **Nombres et non taux.** Sans effectifs exacts par secteur ou par entreprise, on ne peut pas calculer de **taux de fréquence**. Les grandes entreprises ressortent donc naturellement en tête.
3. **2026 incomplète.** Écartée de l'analyse (données coupées à fin 2025) ; 2026 est **prévue** puis validée sur les mois déjà observés. À ré-estimer quand l'année sera complète.
4. **Maladies professionnelles sous-déclarées** (20 à 50 par an) : impossible de les modéliser.
5. **Précision micro faible (13 %)** : c'est un outil de **priorisation**, pas un diagnostic individuel.

---

## 12. Questions probables du jury (et réponses)

**« Pourquoi ne pas utiliser l'accuracy ? »**
Avec 4,3 % d'accidentés, un modèle qui répond toujours « pas d'accident » aurait 95,7 % d'accuracy sans détecter personne. On utilise donc l'AUC, l'AUC-PR et le rappel.

**« Qu'est-ce qu'une fuite d'information ? »**
C'est quand une variable contient (directement ou indirectement) la réponse. Exemple : `NOMBRE_ATM ≥ 1` seulement pour les accidentés. Le modèle serait parfait sur le papier mais inutilisable en pratique.

**« Pourquoi découper dans le temps pour le modèle méso ? »**
Parce qu'en pratique, on veut prédire **l'année prochaine** avec les données d'aujourd'hui. Un découpage au hasard mélangerait passé et futur, et surestimerait la performance.

**« Pourquoi SARIMA et pas Prophet ou un réseau de neurones ? »**
La série (tendance + saison de 12 mois, 168 points) désigne SARIMA : il fournit un **intervalle de confiance analytique** (budget), il est **robuste** (jamais d'erreur catastrophique, alors que Prophet monte à 31,8 % sur le transport), et sa spécification est **validée statistiquement** (ADF, AIC, Ljung-Box). Un LSTM sur-apprendrait sur si peu de points.

**« Pourquoi avoir coupé les données à fin 2025 ? »**
2026 est incomplète et donc peu fiable. On modélise sur des années complètes, on prévoit 2026 **entièrement**, puis on **valide** la prévision sur les mois 2026 déjà observés (erreur 7,9 % au national) : c'est plus rigoureux que de mélanger du réel partiel avec des prévisions.

**« Comment avez-vous justifié le choix des modèles ? »**
Pour chaque niveau, on a comparé le modèle retenu à ses alternatives, pas seulement constaté qu'il marche : SARIMA vs naïf/Holt-Winters/Prophet/LSTM (macro) ; XGBoost vs règle/logistique/forêt (méso, meilleure AUC-PR 0,759) ; forêt vs logistique (micro, AUC égale → relations additives).

**« Avez-vous fait des analyses statistiques, au-delà du ML ? »**
Oui : quatre tests d'hypothèses (section 6.4). Par exemple H2 - posée à partir des caractéristiques d'un métier - montre que, dans le commerce, les agents de sécurité ont 2,2 fois plus d'accidents de trajet que les manutentionnaires (p ≈ 10⁻⁵⁴).

**« Pourquoi garder la forêt aléatoire si la régression logistique fait aussi bien ? »**
Les deux ont la même AUC (0,847), signe que les relations sont presque additives. La forêt était prévue par le cahier des charges et capte sans risque les effets de seuil ; la régression logistique est une alternative valable et plus simple à expliquer.

**« Votre modèle méso a 0,99 d'AUC, n'est-ce pas trop beau ? »**
Non : la règle simple fait déjà 0,948, car l'historique d'accidents prédit fortement l'avenir (lien confirmé par χ², V ≈ 0,50). Le modèle n'utilise que des informations connues **avant** l'année prédite, et il est testé sur une année jamais vue. Sa vraie valeur ajoutée se lit dans l'AUC-PR (0,759 contre 0,475) et la courbe de gain (69,5 % contre 50,7 % des prioritaires trouvées en inspectant 1 %).

**« Que faudrait-il pour améliorer le projet ? »**
Les **effectifs exacts** des entreprises (pour des taux de fréquence), des informations mieux remplies pour **tous** les assurés (réduire le biais de saisie), et la mise à jour régulière des modèles dès qu'une année est complète.

## 13. Guide détaillé des livrables écrits

Cette section explique **chaque livrable** : son rôle, son contenu, les messages clés à retenir et les **nouveaux éléments** (tests statistiques, justification des modèles, prévision 2026) qui y ont été intégrés.

### 13.1 Deux ensembles de livrables (attention à ne pas les confondre)

Il existe **deux jeux** de livrables :

1. **Les livrables rédigés « à la main »** (dossier de soutenance : `Livrable_1.docx`, `Livrable_2.docx`, `livrable_3.docx`, `Livrable 4.docx`). Ce sont les documents officiels remis au fil du projet, en prose soignée.
2. **Les livrables générés automatiquement par le code** (dossier `livrables/` : `Livrable_4`, `Livrable_5`, `Livrable_6`, `Presentation_soutenance.pptx`), produits par `generer_livrables.py` à partir des chiffres réels des notebooks.

⚠️ Il existe donc **deux Livrables 4** (un rédigé, un généré) : ils disent la même chose ; à l'oral, on s'appuie sur la version rédigée. Les deux ont été mis à jour avec les nouveaux chiffres.

### 13.2 Le fil rouge « NLP retiré » (à savoir expliquer au jury)

Les **Livrables 1 et 2** prévoyaient un **4ᵉ niveau** d'analyse par **NLP** (traitement des récits textuels d'accidents). Or, l'extraction transmise par la CNPS a **supprimé toutes les zones de texte libre** (confidentialité, secret médical). Faute de variable cible textuelle, le volet NLP a été **officiellement retiré dès le Livrable 3**, et l'équipe s'est concentrée sur les trois modèles tabulaires Macro / Méso / Micro. Si le jury demande « où est le NLP prévu ? », c'est la réponse.

### 13.3 Livrable 1 - Présentation du projet

**Rôle :** poser le sujet et le justifier.
**Contenu :**
* **Choix de l'institution (CNPS)** et du sujet : la prévention des AT/MP est aujourd'hui **réactive** (on agit après l'accident) ; l'objectif est de la rendre **prédictive**.
* **Chiffres de cadrage :** ~55 000 entreprises affiliées, ~1,2 million de travailleurs immatriculés, 800 à 1 200 entreprises accidentées par an.
* **Les 3 niveaux de prévention de l'OIT** (primaire = agir sur le milieu, secondaire = surveillance de la santé, tertiaire = soins/secours) et le **cadre CNPS** (Direction de la Prévention, contrôleurs, CSST).
* **L'approche multi-niveaux Macro / Méso / Micro**, les objectifs (sanitaire, humain, financier) et les outils envisagés (Python, Prophet/ARIMA, XGBoost/LightGBM, + NLP alors prévu).
**À retenir :** c'est le « pourquoi » du projet. Il mentionne encore le NLP (voir 13.2).

### 13.4 Livrable 2 - Matrice RACI

**Rôle :** organiser l'équipe et les responsabilités.
**Contenu :** la légende **R**éalise / **A**pprouve / **C**onsulté / **I**nformé, puis une matrice par phase (cadrage, Macro, Méso, Micro, NLP, solution web, livrables/soutenance) indiquant qui fait quoi.
**À retenir :** montre la gouvernance du projet. La **Phase 5 (NLP)** y figure encore mais a été retirée ensuite (voir 13.2).

### 13.5 Livrable 3 - Désignation fonctionnelle des besoins (cahier des charges)

**Rôle :** le « quoi » technique, avant les résultats.
**Contenu :**
* **Besoins par niveau** (Macro = tendances sectorielles, Méso = scoring entreprises, Micro = scoring assurés) et **KPIs cibles**.
* **Dictionnaire détaillé des colonnes** des trois bases (sinistres, entreprises, travailleurs) et **modèle logique des données**.
* **Retrait officiel du NLP** et report des variables exogènes (météo, jours fériés) en « version 2 ».
* **Algorithmes cibles** et **infrastructure** (8 vCPU, 28 Go RAM, 400 Go SSD).
**À retenir - argument fort pour le jury :** les **objectifs cibles y sont fixés** (Macro MAPE < 12 %, Méso AUC-ROC ≥ 0,82, Micro rappel ≥ 75 %) et les **résultats obtenus les dépassent** (MAPE 7,1 % ; AUC 0,990 ; rappel 77 %).

### 13.6 Livrable 4 - Priorités et plans d'action (le cœur des résultats)

**Rôle :** passer des constats aux décisions. **C'est le livrable le plus « résultats ».**
**Contenu (mis à jour) :**
* **Rappel données + tableau d'audit** (doublons, fuites, valeurs aberrantes ; plus de ligne « troncature Excel »).
* **4 priorités, chacune étayée par un test statistique :**
  1. risque concentré (1 % des entreprises, récurrence 38,9 % → 0,1 %) ;
  2. concentration sectorielle (10 secteurs = 88 %) + **test H1** (le profil de risque diffère selon le secteur) ;
  3. accidents de trajet + **tests H3** (2,6× plus mortels) et **H2** (métiers de surveillance les plus exposés au trajet) ;
  4. profils d'assurés (4,3 %, 6,8 % chez les 36–45 ans, 8,3 % chez les hauts salaires).
* **3 plans d'action :**
  * **Macro** - SARIMA MAPE **7,1 %** (vs 7,4 % naïf), spécification validée (ADF/AIC/Ljung-Box), prévision **2026 = ~8 961 sinistres (+3,1 %)** validée sur le réel 2026 (**erreur 7,9 %**) ;
  * **Méso** - XGBoost **justifié par comparaison** (meilleure AUC-PR 0,759), **69,5 %** des prioritaires trouvés en inspectant 1 % ;
  * **Micro** - forêt aléatoire, seuil 0,56, rappel 77 %.
* **Action retenue = le Méso** (meilleur effet de levier, validé « à l'aveugle » sur 2025) + **plan de mise en œuvre en 4 phases** et indicateurs de suivi.
**À retenir :** c'est ici que les **tests d'hypothèses** et la **justification des modèles** apparaissent, exactement comme demandé.

### 13.7 Livrable 5 - Le projet, la solution web et la pré-soutenance

**Rôle :** vue d'ensemble + spécification de l'outil + préparation orale.
**Contenu :**
* **Synthèse** des 3 modèles (tableau : modèle retenu, référence battue, résultat, objectif atteint).
* **Architecture de la chaîne** (notebooks 0 → 4) et modèles sauvegardés.
* **Cahier des charges de la solution web** : API **FastAPI** (charge les 11 modèles `.joblib`) + interface **Angular** à **4 écrans** (observatoire/prévisions, entreprises à inspecter avec SHAP, score d'un assuré, qualité des données), avec la liste des **points d'accès API**.
* **Questions probables du jury et réponses** (précision 13 %, AUC 0,990, choix SARIMA/XGBoost, coupe 2025, modèles par secteur, NLP retiré).
**À retenir :** l'application est **spécifiée** ; les modèles sont **prêts à être branchés** ; le développement reste à faire.

### 13.8 Livrable 6 - Rapport de soutenance (document complet)

**Rôle :** le rapport final, qui reprend tout avec les figures.
**Plan :** résumé → introduction (contexte, problématique, réponse à 3 niveaux, équipe) → **données, audit et préparation** (avec la **section « analyses statistiques : tests d'hypothèses »**) → Macro → Méso → Micro → mise en production + solution web + plan d'action → limites et recommandations → conclusion → **annexes de figures**.
**À retenir :** c'est le document de référence écrit ; il intègre les tests statistiques, les justifications de modèles et la validation 2026.

---

## 14. Guide de la présentation de soutenance (diapo par diapo)

La présentation (`Presentation_soutenance.pptx`, **19 diapositives**) suit le fil « problème → données → démarche scientifique → 3 modèles → solution → action ». Chaque diapo a des **notes** dans le fichier ; voici les points à dire à l'oral.

| # | Diapositive | Ce qu'il faut dire |
|---|---|---|
| 1 | **Titre** | Thème, équipe, contexte ISM. |
| 2 | **Contexte et problématique** | ~9 000 sinistres/an, 70 000 employeurs, moyens limités → passer d'une prévention **réactive** à **ciblée**, réponse à 3 niveaux. |
| 3 | **Données et conversion** | 3 extractions Excel → Parquet ; vérification du nombre de lignes = **extractions complètes** ; 2026 incomplète **écartée** (sera prévue). |
| 4 | **Audit qualité** | 65 039 doublons (20 %) supprimés, 4 colonnes vides, fuite `NOMBRE_ATM` exclue, biais de saisie. Sans ce nettoyage, tout serait surestimé de 25 %. |
| 5 | **Ce que montre l'exploration** | 10 secteurs = 88 %, trajet 27 % et plus mortel, maladies pro sous-déclarées, 4,3 % d'accidentés. |
| 6 | **Démarche statistique (tests H1–H4)** | **Nouveauté :** on ne s'arrête pas au visuel. Montrer le tableau des 4 tests ; insister sur **H2** (agents de sécurité : 2,2× plus d'accidents de trajet que la manutention). |
| 7 | **Macro : série et saisonnalité** | Série 2012→2025 (2026 prévue, pas utilisée), pic de mars, creux d'août–septembre. |
| 8 | **Macro : pourquoi SARIMA ?** | **Nouveauté / cœur de la justification :** Prophet dérape (transport 31,8 %), LSTM sur-apprend ; SARIMA = intervalle de confiance + robustesse, **validé** (ADF, AIC, Ljung-Box). |
| 9 | **Macro : résultats sur 2025** | SARIMA 7,1 % et Prophet 6,9 % battent le naïf (7,4 %) ; le naïf gagne sur le BTP → bruit de Poisson. |
| 10 | **Macro : un modèle par secteur** | Profil différent par secteur (H1), SARIMA retenu partout ; somme des secteurs = national à 0,3 % près. |
| 11 | **Macro : prévision 2026 validée** | **Nouveauté :** 8 961 sinistres prévus pour 2026, **confrontés au réel observé (erreur 7,9 %)**, points réels dans l'intervalle à 95 %. |
| 12 | **Méso : quelles entreprises inspecter ?** | Prioritaire = ≥ 2 accidents ou 1 décès l'an suivant ; prédiction N→N+1 (pas de triche) ; lien historique→priorité confirmé (χ², V ≈ 0,50). |
| 13 | **Méso : XGBoost contre 3 alternatives** | **Nouveauté :** comparé à règle/logistique/forêt, XGBoost a la meilleure **AUC-PR 0,759** ; 1 % inspecté → 69,5 % des prioritaires. |
| 14 | **Méso : pourquoi une entreprise est ciblée (SHAP)** | Petites entreprises = risque faible ; historique, grande taille, « en activité » = risque accru ; liste opérationnelle. |
| 15 | **Micro : repérer les assurés exposés** | 4,3 % d'accidentés, variables « fuyantes » exclues, seuil 0,56, AUC 0,847, rappel 77 %, précision 13 % (3× le hasard), 26 % signalés. |
| 16 | **Micro : biais de saisie et usage** | Le modèle utilise en partie les « NON RENSEIGNE » ; sur profils complets AUC 0,791 ; forêt vs logistique = AUC égale → relations additives ; exemple d'actions. |
| 17 | **Solution web : FastAPI + Angular** | API charge les 11 modèles, 4 écrans Angular, Docker, réseau interne ; application **à développer**, modèles prêts. |
| 18 | **Plan d'action et recommandations** | Action prioritaire = ciblage des inspections (4 phases) ; effectif exact, saisie obligatoire, campagne risque routier. |
| 19 | **Conclusion** | Données nettoyées + démarche validée, chaque modèle bat sa référence sur données jamais vues, 11 modèles prêts, prochain levier = qualité de la saisie. |

**Conseils pour l'oral :**
* **Diapos 6, 8, 11, 13** sont les **nouveautés** qui répondent à la remarque de l'encadrant (démarche statistique + justification forte des modèles) : insister dessus.
* Toujours relier un **résultat** à une **décision** (ex. H2 → campagne routière ciblée sur les agents de sécurité).
* Assumer les **limites** (biais de saisie, précision micro 13 %, pas de taux de fréquence faute d'effectifs) : cela renforce la crédibilité.

---

## 15. Où se trouve chaque livrable

| Fichier | Dossier | Contenu |
|---|---|---|
| `Livrable_1.docx` … `Livrable 4.docx` | dossier de soutenance (rédigés à la main) | présentation, RACI, cahier des charges, priorités/plans d'action |
| `Livrable_4_Priorites_et_plans_d_action.docx` | `livrables/` (généré) | version générée des priorités et plans d'action |
| `Livrable_5_Projet_et_pre_soutenance.docx` | `livrables/` (généré) | projet, solution web, pré-soutenance |
| `Livrable_6_Rapport_de_soutenance.docx` | `livrables/` (généré) | rapport complet avec figures |
| `Presentation_soutenance.pptx` | `livrables/` (généré) | 19 diapositives avec notes |
| `generer_livrables.py` | `livrables/` | régénère les 4 fichiers ci-dessus (`.venv/Scripts/python livrables/generer_livrables.py`) ; `figures/` contient les graphiques extraits des notebooks |
