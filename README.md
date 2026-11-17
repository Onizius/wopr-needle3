# WOPR + Needle 3

A retro WarGames-inspired WOPR web dashboard integrated with Cactus Compute Needle 3 and Ollama.

## Features

- Retro WOPR web interface inspired by 1980s computer terminals
- Chat powered by Ollama
- Natural-language commands processed by Cactus Compute Needle 3
- Interactive DEFCON levels and color changes
- Persistent SQLite conversation history
- Docker Compose deployment with isolated services and persistent volumes

## Requirements

- Docker Engine with Docker Compose v2 (Docker Desktop recommended on Windows)
- Internet access for the initial image and Cactus runtime downloads
- Ollama running separately and reachable from the WOPR container
- An Ollama model installed locally

## Installation

1. Clone this repository and open its directory.
2. Optionally copy .env.example to .env and adjust the settings.
3. Make sure Ollama is running on the host.
4. Install a chat model in Ollama, for example:

```powershell
ollama pull openbmb/minicpm5-2b:latest
```

5. Build and start WOPR and Needle 3:

```powershell
docker compose up -d --build
```

6. Open http://localhost:3007 in your browser.

The first Needle 3 startup may take longer while the Cactus runtime and model files are downloaded.

## Example Needle 3 command

Enter the following in the WOPR chat:

```text
/needle Set DEFCON level to 2
```

Needle 3 processes the command and WOPR updates its simulated DEFCON indicator.

## Configuration

- WOPR_PORT: localhost web interface port (default 3007)
- OLLAMA_URL: Ollama API URL reachable from Docker (default http://host.docker.internal:11434)
- NEEDLE_URL: internal Docker service address http://needle3:8000

The default Ollama address is intended for Docker Desktop. Linux Docker Engine installations may require additional host networking configuration.

## Storage and networking

Docker Compose creates dedicated named volumes for WOPR SQLite data and Needle 3 Cactus/Hugging Face caches. Needle 3 is accessible only within the Compose network. WOPR is published on the local loopback interface by default.

## Useful commands

```powershell
docker compose ps
docker compose logs --tail 100
docker compose down
```

The down command preserves named volumes unless explicitly requested otherwise.

## Notes

This project is a fictional simulation interface, not a real military system. Third-party source code, models, assets, and dependencies retain their respective licenses. Review applicable licenses before redistribution.
