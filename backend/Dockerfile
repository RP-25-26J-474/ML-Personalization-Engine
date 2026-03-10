# syntax=docker/dockerfile:1
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Runtime libs for numpy/scikit-learn wheels
RUN apt-get -o Acquire::Retries=5 update \
    && apt-get install -y --no-install-recommends libgomp1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
# Install PyTorch from the CPU index first to avoid downloading large CUDA binaries
RUN pip install --upgrade pip && \
    pip install torch==2.7.1+cpu --index-url https://download.pytorch.org/whl/cpu || pip install torch==2.7.1 --index-url https://download.pytorch.org/whl/cpu && \
    pip install -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]