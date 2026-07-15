FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create /data for Railway persistent volume mounts
RUN mkdir -p /data

ENV PORT=8000

EXPOSE 8000

# Railway (and most PaaS) inject PORT at runtime.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
