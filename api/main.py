"""Application FastAPI : expose les 3 modèles (Macro, Méso, Micro) de la CNPS.

Lancement (depuis la racine du projet) :
    .venv\\Scripts\\python -m uvicorn api.main:app --reload
Documentation interactive : http://127.0.0.1:8000/docs
"""
import os
import glob
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Prophet n'est pas utilisé ici, mais certains modèles statsmodels chargent des
# dépendances cmdstan : on sécurise le PATH de tbb.dll comme dans le notebook 2.
try:
    import prophet as _prophet  # noqa
    _tbb = next((os.path.dirname(p) for p in glob.glob(
        os.path.join(os.path.dirname(_prophet.__file__), "**", "tbb.dll"), recursive=True)), None)
    if _tbb:
        os.environ["PATH"] = _tbb + os.pathsep + os.environ.get("PATH", "")
except Exception:
    pass

from api.store import store
from api.routes import macro, meso, micro, qualite


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.charger()           # charge modèles
    yield


app = FastAPI(
    title="CNPS - Prévention prédictive des accidents du travail",
    description="API des trois modèles : Macro (prévision), Méso (entreprises prioritaires), Micro (score assuré).",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(macro.router)
app.include_router(meso.router)
app.include_router(micro.router)
# app.include_router(qualite.router)


@app.get("/api/sante", tags=["meta"])
def sante():
    return {"statut": "ok"}
