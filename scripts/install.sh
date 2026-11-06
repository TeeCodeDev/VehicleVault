#!/usr/bin/env bash
# VehicleVault — one-line installer for Linux and macOS.
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/TeeCodeDev/VehicleVault/main/scripts/install.sh | bash
#   curl -fsSL .../install.sh | bash -s -- --dir ~/vehiclevault --port 3084 --tag latest
set -euo pipefail

IMAGE="ghcr.io/teecodedev/vehiclevault"
TAG="latest"
DIR="${HOME}/vehiclevault"
PORT="3084"
ASSUME_YES=0
DRY_RUN=0
DO_UNINSTALL=0

usage() {
  cat <<EOF
Usage: install.sh [--dir DIR] [--port PORT] [--tag TAG] [--yes] [--dry-run] [--uninstall]

  --dir DIR        Install directory (default: \$HOME/vehiclevault)
  --port PORT      Host port to expose (default: 3084)
  --tag TAG        Image tag (default: latest, e.g. v3.4.0)
  --yes            Skip confirmation prompt
  --dry-run        Print docker-compose.yml without starting
  --uninstall      Stop and remove the stack (keeps data unless --yes wipes it)
  -h, --help       Show this help
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) DIR="${2:?}"; shift 2 ;;
    --port) PORT="${2:?}"; shift 2 ;;
    --tag) TAG="${2:?}"; shift 2 ;;
    --yes) ASSUME_YES=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --uninstall) DO_UNINSTALL=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

# Expand leading ~ (when passed quoted through `bash -s --`).
case "$DIR" in "~"*) DIR="${HOME}${DIR#"~"}" ;; esac

log() { printf '%s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || return 1; }

random_hex() {
  # 32 random bytes -> 64 hex chars, no openssl required.
  if need_cmd openssl; then
    openssl rand -hex 32
  elif need_cmd python3; then
    python3 -c 'import secrets; print(secrets.token_hex(32))'
  else
    od -An -tx1 -N32 /dev/urandom 2>/dev/null | tr -d ' \n' || date +%s%N
  fi
}

check_docker() {
  need_cmd docker || die "Docker not found. Install it first: Linux -> https://docs.docker.com/engine/install, macOS -> Docker Desktop (or 'brew install --cask docker'), then re-run this script."
  docker info >/dev/null 2>&1 || die "Docker daemon is not running. Start Docker Desktop / 'sudo systemctl start docker' and re-run."
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 not found. Update Docker to a recent version and re-run."
}

uninstall() {
  [ -d "$DIR" ] || die "Nothing to uninstall: $DIR does not exist."
  cd "$DIR"
  [ -f docker-compose.yml ] || die "No docker-compose.yml in $DIR."
  log "Stopping VehicleVault in $DIR ..."
  docker compose down
  log "Stopped. Data kept in $DIR/data. Remove that directory manually to wipe all data."
}

main() {
  if [ "$DO_UNINSTALL" -eq 1 ]; then uninstall; exit 0; fi

  case "$PORT" in
    ''|*[!0-9]*) die "--port must be a number (got '$PORT')." ;;
  esac

  log "Installing VehicleVault ($IMAGE:$TAG) into $DIR (port $PORT) ..."
  if [ "$ASSUME_YES" -ne 1 ] && [ "$DRY_RUN" -ne 1 ]; then
    printf 'Continue? [y/N] '
    read -r answer || true
    case "$answer" in
      [yY][eE][sS]|[yY]) ;;
      *) log "Aborted."; exit 0 ;;
    esac
  fi

  mkdir -p "$DIR/data"

  # Create .env with secure secrets on first run; never overwrite existing secrets.
  if [ ! -f "$DIR/.env" ]; then
    log "Generating $DIR/.env with random JWT secrets ..."
    {
      echo "PORT=$PORT"
      echo "JWT_SECRET=$(random_hex)"
      echo "JWT_REFRESH_SECRET=$(random_hex)"
    } > "$DIR/.env"
    chmod 600 "$DIR/.env"
  elif ! grep -q '^PORT=' "$DIR/.env"; then
    echo "PORT=$PORT" >> "$DIR/.env"
  fi

  # shellcheck disable=SC2016
  cat > "$DIR/docker-compose.yml" <<YAML
services:
  vehiclevault:
    image: ${IMAGE}:${TAG}
    restart: unless-stopped
    ports:
      - "\${PORT:-$PORT}:3084"
    environment:
      - NODE_ENV=production
      - PORT=3084
      - DATA_DIR=/data
      - JWT_SECRET=\${JWT_SECRET:-change_this_to_a_random_secure_secret_in_production}
      - JWT_REFRESH_SECRET=\${JWT_REFRESH_SECRET:-change_this_to_another_random_secure_secret}
    volumes:
      - ./data:/data
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3084/healthz || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
YAML

  if [ "$DRY_RUN" -eq 1 ]; then
    log "--- $DIR/docker-compose.yml (dry run, not started) ---"
    cat "$DIR/docker-compose.yml"
    exit 0
  fi

  check_docker
  cd "$DIR"
  # shellcheck disable=SC1091
  set -a; . ./.env; set +a
  docker compose pull
  docker compose up -d

  log "Waiting for http://localhost:${PORT:-$PORT}/healthz ..."
  for _ in $(seq 1 30); do
    if curl -fsS "http://localhost:${PORT:-$PORT}/healthz" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  log ""
  log "VehicleVault is up at http://localhost:${PORT:-$PORT}"
  log "The first account you register receives Administrator rights."
  log "Data directory: $DIR/data | Manage with: cd $DIR && docker compose {logs,ps,down}"
}

main "$@"
