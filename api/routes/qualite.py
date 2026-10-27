"""Endpoint Qualité des données."""
from fastapi import APIRouter

from api.store import store

router = APIRouter(prefix="/api", tags=["qualite"])


@router.get("/qualite")
def qualite():
    """Indicateurs de qualité : volumes par table, complétude, remplissage des champs."""
    return store.qualite()
