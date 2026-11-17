FROM python:3.12.16-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN groupadd --gid 10001 wopr && useradd --uid 10001 --gid 10001 --no-create-home wopr && mkdir -p /data && chown 10001:10001 /data
COPY --chown=10001:10001 app.py /app/app.py
COPY --chown=10001:10001 static/ /app/static/
USER 10001:10001
EXPOSE 8000
CMD ["python", "app.py"]
