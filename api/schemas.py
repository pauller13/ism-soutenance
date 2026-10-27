"""Schémas Pydantic des entrées/sorties de l'API."""
from __future__ import annotations

from pydantic import BaseModel, Field


class ProfilAssure(BaseModel):
    sexe: str | None = Field(None, examples=["M"])
    classe_age: str | None = Field(None, examples=["36-45"])
    classe_salaire: str | None = Field(None, examples=["250k-1m"])
    classe_anciennete_entreprise: str | None = Field(None, examples=["4-10"])
    profession: str | None = Field(None, examples=["MANUTENTIONNAIRE"])
    nationalite: str | None = Field(None, examples=["IVOIRIENNE"])
    classe_effectif: str | None = Field(None, examples=["251+"])
    classe_masse_salariale: str | None = Field(None, examples=["1m+"])


class ScoreAssure(BaseModel):
    score: float
    seuil: float
    a_risque: bool
    recommandations: list[str]
