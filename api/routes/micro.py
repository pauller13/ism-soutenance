"""Endpoints Micro : score de risque d'un assuré et recommandations."""
import io

import pandas as pd
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import PlainTextResponse

from api.schemas import ProfilAssure, ScoreAssure
from api.store import store

router = APIRouter(prefix="/api", tags=["micro"])


@router.get("/assures/modalites")
def modalites():
    """Modalités valides pour chaque champ du formulaire (dérivées du modèle)."""
    return store.micro_modalites()


@router.post("/assures/score", response_model=ScoreAssure)
def scorer(profil: ProfilAssure):
    """Score d'un assuré, décision au seuil 0,56 et recommandations."""
    return store.scorer_assure(profil.model_dump())


@router.post("/assures/score-fichier", response_class=PlainTextResponse)
async def scorer_fichier(fichier: UploadFile = File(...)):
    """Scorer un lot d'assurés fournis en CSV ; renvoie le CSV enrichi des scores."""
    contenu = await fichier.read()
    df = pd.read_csv(io.BytesIO(contenu))
    out = store.scorer_fichier(df)
    return PlainTextResponse(out.to_csv(index=False), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=assures_scores.csv"})
