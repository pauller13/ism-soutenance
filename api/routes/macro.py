"""Endpoints Macro : séries et prévisions SARIMA."""
from fastapi import APIRouter, HTTPException, Query

from api.store import store

router = APIRouter(prefix="/api", tags=["macro"])


@router.get("/series")
def liste_series():
    """Liste des séries disponibles (national + secteurs)."""
    return store.series_disponibles()


@router.get("/prevision/{serie}")
def prevision(serie: str, mois: int = Query(12, ge=1, le=24),
              historique_mois: int = Query(60, ge=12, le=168)):
    """Historique mensuel, prévision à `mois` mois avec intervalle à 95 %,
    et réel 2026 observé (pour validation)."""
    try:
        return store.prevision(serie, mois=mois, historique_mois=historique_mois)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Série inconnue : {serie}")
