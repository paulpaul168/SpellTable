FROM python:3.13-slim

WORKDIR /app

# Install curl for healthchecks
RUN apt-get update && apt-get install -y curl && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_NO_DEV=1

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project

COPY . .

RUN uv sync --locked

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8010

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010"]
