FROM python:3.11.18-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DO_NOT_TRACK=1 CACTUS_TELEMETRY=0
WORKDIR /app
COPY requirements.txt /tmp/requirements.txt
RUN python -m pip install --no-cache-dir -r /tmp/requirements.txt
COPY api/ /app/
EXPOSE 8000
CMD ["python", "-u", "server.py"]
