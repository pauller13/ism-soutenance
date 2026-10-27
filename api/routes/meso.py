"""Endpoints Méso : classement des entreprises à inspecter."""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse

from api.store import store

router = APIRouter(prefix="/api", tags=["meso"])


@router.get("/entreprises")
def entreprises(top: float | None = Query(None, ge=0.1, le=100, description="part du portefeuille en %"),
                limit: int | None = Query(None, ge=1, le=2000),
                classe_effectif: str | None = None,
                statut: str | None = None):
    """Entreprises classées par score de risque décroissant.
    Utiliser `top` (ex. top=1 pour le 1 % le plus à risque) ou `limit`."""
    return store.entreprises(top_pct=top, limit=limit,
                             secteur_effectif=classe_effectif, statut=statut)


@router.get("/entreprises/export", response_class=PlainTextResponse)
def export(top: float = Query(5.0, ge=0.1, le=100)):
    """Export CSV des entreprises du top `top` %."""
    csv = store.entreprises_csv(top_pct=top)
    return PlainTextResponse(csv, media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=entreprises_prioritaires.csv"})


@router.get("/entreprises/{entreprise_id}")
def entreprise(entreprise_id: str):
    """Fiche d'une entreprise : score, historique et contributions SHAP."""
    try:
        return store.entreprise(entreprise_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Entreprise inconnue : {entreprise_id}")
