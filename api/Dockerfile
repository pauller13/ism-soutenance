# API FastAPI - image à construire depuis la RACINE du projet :
#   docker build -f api/Dockerfile -t cnps-api .
# Les modèles (modeles/) et les données (data/) sont montés en volumes au runtime
# (voir docker-compose.yml) : ils ne sont pas copiés dans l'image.
FROM python:3.13-slim

# libgomp1 : OpenMP requis par XGBoost
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY api/requirements-docker.txt /app/api/requirements-docker.txt
# --retries / --timeout / --resume-retries : robustesse face à un réseau instable
RUN pip install --no-cache-dir --retries 10 --timeout 180 --resume-retries 50 \
    -r /app/api/requirements-docker.txt

COPY api/ /app/api/

EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
