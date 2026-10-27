"""Chargement des modèles et des données, une seule fois au démarrage de l'API.

Rien ici ne ré-entraîne de modèle : on recharge les fichiers .joblib produits par les
notebooks et on reconstruit, à partir des données propres, ce qui est nécessaire pour
servir les endpoints (séries macro, table de scores méso, indicateurs qualité).
"""
from __future__ import annotations

import joblib
import numpy as np
import pandas as pd

from api import config as C


class Store:
    def __init__(self) -> None:
        self._macro: dict[str, object] = {}
        self._series: dict[str, pd.Series] = {}
        self._obs2026: dict[str, pd.Series] = {}
        self._meso = None            # dict {modele, colonnes}
        self._meso_scores = None     # DataFrame scoré (année 2025)
        self._meso_X = None          # matrice encodée alignée (pour SHAP)
        self._micro = None           # dict {modele, seuil, colonnes}
        self._micro_modalites = None
        self._qualite = None
        self._charge = False

    # ------------------------------------------------------------------ chargement
    def charger(self) -> None:
        if self._charge:
            return
        self._charger_macro()
        self._charger_meso()
        self._charger_micro()
        # self._charger_qualite()
        self._charge = True

    # --------------------------------------------------------------------- macro
    def _serie_mensuelle(self, sin: pd.DataFrame, masque=None) -> pd.Series:
        sous = sin if masque is None else sin[masque]
        s = sous.groupby("date").size()
        # on cale sur le calendrier national complet
        return s

    def _charger_macro(self) -> None:
        sin = pd.read_parquet(C.DATA / "sinistres_propre.parquet")
        sin = sin.dropna(subset=["ANNEE_ACCIDENT", "MOIS_ACCIDENT"]).copy()
        sin["date"] = pd.to_datetime(dict(year=sin["ANNEE_ACCIDENT"], month=sin["MOIS_ACCIDENT"], day=1))

        base = sin.groupby("date").size().asfreq("MS", fill_value=0)
        index_ref = base["2012-01":"2025-12"].index

        for cle, meta in C.SERIES.items():
            if meta["kind"] == "national":
                serie_complete = base
            elif meta["kind"] == "secteur":
                serie_complete = (sin[sin["SECTEUR_ACTIVITE"] == meta["secteur"]]
                                  .groupby("date").size().reindex(base.index, fill_value=0))
            else:  # autres
                serie_complete = (sin[~sin["SECTEUR_ACTIVITE"].isin(C.SECTEURS)]
                                  .groupby("date").size().reindex(base.index, fill_value=0))
            self._series[cle] = serie_complete.reindex(index_ref).fillna(0)
            self._obs2026[cle] = serie_complete["2026-01":"2026-07"]
            self._macro[cle] = joblib.load(C.MODELES / meta["model"])

    def series_disponibles(self) -> list[dict]:
        return [{"cle": k, "libelle": v["label"]} for k, v in C.SERIES.items()]

    def prevision(self, cle: str, mois: int = 12, historique_mois: int = 60) -> dict:
        if cle not in self._macro:
            raise KeyError(cle)
        modele = self._macro[cle]
        serie = self._series[cle]
        prev = modele.get_forecast(mois)
        moy = prev.predicted_mean
        ic = prev.conf_int()

        hist = serie.tail(historique_mois)
        historique = [{"date": d.strftime("%Y-%m"), "valeur": round(float(v), 1)}
                      for d, v in hist.items()]
        prevision = [{"date": d.strftime("%Y-%m"), "valeur": round(float(v), 1),
                      "bas": round(float(max(0, ic.iloc[i, 0])), 1), "haut": round(float(ic.iloc[i, 1]), 1)}
                     for i, (d, v) in enumerate(moy.items())]
        observe = [{"date": d.strftime("%Y-%m"), "valeur": int(v)}
                   for d, v in self._obs2026[cle].items()]
        total_prevu = int(round(float(moy.sum())))
        total_reel_2025 = int(serie.tail(12).sum())
        return {
            "serie": cle,
            "libelle": C.SERIES[cle]["label"],
            "historique": historique,
            "prevision": prevision,
            "reel_2026_observe": observe,
            "total_reel_2025": total_reel_2025,
            "total_prevu": total_prevu,
            "evolution_pct": round((total_prevu / total_reel_2025 - 1) * 100, 1) if total_reel_2025 else None,
        }

    # ---------------------------------------------------------------------- méso
    def _charger_meso(self) -> None:
        self._meso = joblib.load(C.MODELES / "meso_xgboost_entreprises.joblib")
        ent = pd.read_parquet(C.DATA / "entreprises_propre.parquet")
        sin = pd.read_parquet(C.DATA / "sinistres_propre.parquet").dropna(subset=["ANNEE_ACCIDENT"]).copy()
        sin["deces"] = (sin["MORT_APRES_AT"] == "OUI").astype(int)

        par_an = (sin.groupby(["ENTREPRISE_ID", "ANNEE_ACCIDENT"])
                  .agg(nb_accidents=("SINISTRE_ID", "count"), nb_deces=("deces", "sum"))
                  .reset_index().rename(columns={"ANNEE_ACCIDENT": "ANNEE"}))
        par_an["ANNEE"] = par_an["ANNEE"].astype(int)

        df = ent[ent["ANNEE"] == 2025].copy()
        df["anciennete"] = (df["ANNEE"] - df["DATE_IMMATRICULATION_ANNEE"]).clip(lower=0)
        df = df.merge(par_an, on=["ENTREPRISE_ID", "ANNEE"], how="left")
        df = df.rename(columns={"nb_accidents": "accidents_annee", "nb_deces": "deces_annee"})

        hist = (par_an[par_an["ANNEE"] < 2025].groupby("ENTREPRISE_ID")[["nb_accidents", "nb_deces"]].sum()
                .rename(columns={"nb_accidents": "accidents_avant", "nb_deces": "deces_avant"}).reset_index())
        df = df.merge(hist, on="ENTREPRISE_ID", how="left")
        for col in ["accidents_annee", "deces_annee", "accidents_avant", "deces_avant"]:
            df[col] = df[col].fillna(0)

        X = pd.get_dummies(df[C.MESO_VARIABLES], dtype=int).reindex(columns=self._meso["colonnes"], fill_value=0)
        df["score_risque"] = self._meso["modele"].predict_proba(X)[:, 1]

        self._meso_X = X.reset_index(drop=True)
        self._meso_scores = (df.reset_index(drop=True)
                             .sort_values("score_risque", ascending=False)
                             .reset_index(drop=True))

    def entreprises(self, top_pct: float | None = None, limit: int | None = None,
                    secteur_effectif: str | None = None, statut: str | None = None) -> dict:
        d = self._meso_scores
        if secteur_effectif:
            d = d[d["CLASSE_EFFECTIF"] == secteur_effectif]
        if statut:
            d = d[d["STATUT_ENTREPRISE"] == statut]
        total = len(self._meso_scores)
        if top_pct is not None:
            n = max(1, int(total * top_pct / 100))
        else:
            n = limit or 50
        lignes = d.head(n)[["ENTREPRISE_ID", "CLASSE_EFFECTIF", "CLASSE_MASSE_SALARIALE",
                            "STATUT_ENTREPRISE", "accidents_annee", "accidents_avant",
                            "deces_avant", "score_risque"]]
        return {
            "total_entreprises": total,
            "nb_affichees": len(lignes),
            "entreprises": [
                {"entreprise_id": r.ENTREPRISE_ID,
                 "classe_effectif": r.CLASSE_EFFECTIF,
                 "classe_masse_salariale": r.CLASSE_MASSE_SALARIALE,
                 "statut": r.STATUT_ENTREPRISE,
                 "accidents_annee": int(r.accidents_annee),
                 "accidents_avant": int(r.accidents_avant),
                 "deces_avant": int(r.deces_avant),
                 "score_risque": round(float(r.score_risque), 4)}
                for r in lignes.itertuples()
            ],
        }

    def entreprise(self, entreprise_id: str) -> dict:
        d = self._meso_scores
        masque = d["ENTREPRISE_ID"] == entreprise_id
        if not masque.any():
            raise KeyError(entreprise_id)
        i = d.index[masque][0]
        r = d.loc[i]
        import shap
        explainer = shap.TreeExplainer(self._meso["modele"])
        row = self._meso_X.iloc[[i]]
        vals = explainer.shap_values(row)
        contribs = sorted(zip(self._meso["colonnes"], vals[0]), key=lambda t: abs(t[1]), reverse=True)[:8]
        return {
            "entreprise_id": entreprise_id,
            "score_risque": round(float(r["score_risque"]), 4),
            "classe_effectif": r["CLASSE_EFFECTIF"],
            "classe_masse_salariale": r["CLASSE_MASSE_SALARIALE"],
            "statut": r["STATUT_ENTREPRISE"],
            "accidents_annee": int(r["accidents_annee"]),
            "accidents_avant": int(r["accidents_avant"]),
            "deces_avant": int(r["deces_avant"]),
            "facteurs_shap": [{"variable": v, "impact": round(float(x), 4)} for v, x in contribs],
        }

    def entreprises_csv(self, top_pct: float = 5.0) -> str:
        n = max(1, int(len(self._meso_scores) * top_pct / 100))
        cols = ["ENTREPRISE_ID", "CLASSE_EFFECTIF", "CLASSE_MASSE_SALARIALE", "STATUT_ENTREPRISE",
                "accidents_annee", "accidents_avant", "deces_avant", "score_risque"]
        return self._meso_scores.head(n)[cols].to_csv(index=False)

    # --------------------------------------------------------------------- micro
    def _charger_micro(self) -> None:
        self._micro = joblib.load(C.MODELES / "micro_foret_aleatoire_assures.joblib")
        modalites: dict[str, list[str]] = {p.rstrip("_"): [] for p in C.MICRO_PREFIXES}
        for col in self._micro["colonnes"]:
            for p in C.MICRO_PREFIXES:
                if col.startswith(p):
                    modalites[p.rstrip("_")].append(col[len(p):])
                    break
        self._micro_modalites = modalites

    def micro_modalites(self) -> dict:
        return self._micro_modalites

    def _vecteur_micro(self, profil: dict) -> pd.DataFrame:
        colonnes = self._micro["colonnes"]
        x = pd.Series(0, index=colonnes, dtype="uint8")
        champs = {
            "SEXE_": profil.get("sexe"),
            "CLASSE_AGE_": profil.get("classe_age"),
            "CLASSE_SALAIRE_": profil.get("classe_salaire"),
            "CLASSE_ANCIENNETE_ENTREPRISE_": profil.get("classe_anciennete_entreprise"),
            "profession_": profil.get("profession"),
            "nationalite_": profil.get("nationalite"),
            "CLASSE_EFFECTIF_": profil.get("classe_effectif"),
            "CLASSE_MASSE_SALARIALE_": profil.get("classe_masse_salariale"),
        }
        for prefixe, valeur in champs.items():
            if valeur is None:
                valeur = "NON RENSEIGNE"
            col = f"{prefixe}{valeur}"
            if col in x.index:
                x[col] = 1
            else:
                defaut = f"{prefixe}NON RENSEIGNE"
                if defaut in x.index:
                    x[defaut] = 1
        return x.to_frame().T

    def _recommandations(self, profil: dict, proba: float, seuil: float) -> list[str]:
        actions = []
        if proba >= seuil:
            actions.append("Visite médicale d'aptitude au poste à programmer")
        if profil.get("classe_age") in ("<18", "18-25"):
            actions.append("Formation sécurité obligatoire (jeune travailleur)")
        if profil.get("classe_anciennete_entreprise") in ("0", "1-3"):
            actions.append("Accompagnement des nouveaux arrivants (tutorat, accueil sécurité)")
        if profil.get("classe_effectif") in ("51-250", "251+") and proba >= seuil:
            actions.append("Signaler au service HSE de l'entreprise")
        if not actions:
            actions.append("Suivi standard (calendrier réglementaire)")
        return actions

    def scorer_assure(self, profil: dict) -> dict:
        seuil = float(self._micro["seuil"])
        x = self._vecteur_micro(profil)
        proba = float(self._micro["modele"].predict_proba(x)[:, 1][0])
        return {
            "score": round(proba, 4),
            "seuil": round(seuil, 2),
            "a_risque": bool(proba >= seuil),
            "recommandations": self._recommandations(profil, proba, seuil),
        }

    def scorer_fichier(self, df: pd.DataFrame) -> pd.DataFrame:
        seuil = float(self._micro["seuil"])
        lignes = []
        for _, row in df.iterrows():
            x = self._vecteur_micro(row.to_dict())
            lignes.append(float(self._micro["modele"].predict_proba(x)[:, 1][0]))
        out = df.copy()
        out["score"] = np.round(lignes, 4)
        out["a_risque"] = out["score"] >= seuil
        return out

    # -------------------------------------------------------------------- qualité
    def _charger_qualite(self) -> None:
        def n(path):
            try:
                return len(pd.read_parquet(C.DATA / path))
            except Exception:
                return None
        sin_p = pd.read_parquet(C.DATA / "sinistres_propre.parquet")
        trv_p = pd.read_parquet(C.DATA / "travailleurs_propre.parquet")
        remplissage = ((1 - sin_p.isna().mean()) * 100).round(1)
        taux_acc = round((trv_p["STATUT_AT"] == "AVEC_AT").mean() * 100, 1)
        self._qualite = {
            "tables": [
                {"table": "sinistres", "lignes_brutes": n("sinistres.parquet"),
                 "lignes_propres": len(sin_p), "doublons_retires": (n("sinistres.parquet") or 0) - len(sin_p)},
                {"table": "travailleurs", "lignes_brutes": n("travailleurs.parquet"),
                 "lignes_propres": len(trv_p), "doublons_retires": (n("travailleurs.parquet") or 0) - len(trv_p)},
                {"table": "entreprises", "lignes_brutes": n("entreprises.parquet"),
                 "lignes_propres": n("entreprises_propre.parquet"), "doublons_retires": 0},
            ],
            "extraction_complete": True,
            "taux_accident_pct": taux_acc,
            "remplissage_sinistres": [{"colonne": c, "rempli_pct": float(remplissage[c])}
                                      for c in remplissage.sort_values(ascending=False).index],
        }

    def qualite(self) -> dict:
        return self._qualite


store = Store()
