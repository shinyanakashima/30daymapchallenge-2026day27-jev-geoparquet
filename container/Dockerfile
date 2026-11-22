FROM --platform=linux/amd64 python:3.13-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir duckdb==1.5.5
# Install the DuckDB extensions at build time so the container does not download them at start.
RUN python -c "import duckdb; c = duckdb.connect(); c.sql('INSTALL spatial; INSTALL httpfs; INSTALL jev FROM community')"

WORKDIR /app
COPY app/ /app/
EXPOSE 8080
CMD ["python", "-u", "server.py"]
