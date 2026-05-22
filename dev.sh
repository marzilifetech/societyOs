#!/usr/bin/env bash
# dev.sh — bootstrap + start the full SocietyOS dev stack
#
# Usage:
#   ./dev.sh                  # full stack (backend + admin + both Expo apps)
#   ./dev.sh --no-expo        # skip the Expo apps (faster, web-only)
#   ./dev.sh --skip-migrate   # skip `prisma migrate deploy`
#   ./dev.sh --skip-seed      # skip `pnpm db:seed`
#   ./dev.sh --no-install     # skip `pnpm install`
#   ./dev.sh --reset          # drop the DB, re-migrate, re-seed (DESTRUCTIVE)
#   ./dev.sh --bootstrap-ios  # one-time: build + install both Expo dev clients
#                             # onto booted iOS simulators, then exit
#   ./dev.sh --help           # this message
#
# Cross-platform: macOS (Homebrew) and Linux (apt/dnf/yum). On Linux the
# iOS-Simulator wiring is skipped — scan the QR with Expo Go on a phone.
# Windows: run inside WSL2.
#
# A fresh checkout on a supported OS will be working after one invocation:
#   - tools installed (Node 20, pnpm, qrencode, postgres, redis or Docker)
#   - .env files created from .env.example
#   - Prisma client generated, migrations applied, seed loaded
#   - backend, admin-web, two Expo apps started with mutually consistent ports
set -euo pipefail

# Force UTF-8 — Ruby/CocoaPods on macOS crashes without it on some shells.
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS_FILE="$ROOT/.dev-pids"
LOG_DIR="$ROOT/.logs"

# ── colours ────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; RESET=''
fi
# All status output goes to stderr so command-substitution callers (e.g.
# BACKEND_PORT=$(free_port 3000)) only ever capture the real result on stdout.
log()  { echo -e "${BOLD}[dev]${RESET} $*"  >&2; }
ok()   { echo -e "${GREEN}[dev]${RESET} $*" >&2; }
warn() { echo -e "${YELLOW}[dev]${RESET} $*" >&2; }
die()  { echo -e "${RED}[dev]${RESET} $*"   >&2; exit 1; }

# ── flags ──────────────────────────────────────────────────────────────────
SKIP_MIGRATE=0; SKIP_SEED=0; NO_INSTALL=0; NO_EXPO=0; RESET_DB=0; BOOTSTRAP_IOS=0
for arg in "$@"; do
  case "$arg" in
    --skip-migrate) SKIP_MIGRATE=1 ;;
    --skip-seed)    SKIP_SEED=1 ;;
    --no-install)   NO_INSTALL=1 ;;
    --no-expo)      NO_EXPO=1 ;;
    --reset)        RESET_DB=1 ;;
    --bootstrap-ios) BOOTSTRAP_IOS=1 ;;
    --help|-h)
      sed -n '3,21p' "$0"; exit 0 ;;
    *) die "Unknown flag: $arg (try --help)" ;;
  esac
done

# ── OS detection ───────────────────────────────────────────────────────────
OS="$(uname -s)"
case "$OS" in
  Darwin) OS_KIND="mac" ;;
  Linux)  OS_KIND="linux" ;;
  *) die "Unsupported OS: $OS. Use macOS or Linux (or Windows under WSL2)." ;;
esac
ok "Detected OS: $OS_KIND"

# ── Linux package manager ──────────────────────────────────────────────────
LINUX_PKG=""
if [[ "$OS_KIND" == "linux" ]]; then
  if   command -v apt-get &>/dev/null; then LINUX_PKG="apt"
  elif command -v dnf     &>/dev/null; then LINUX_PKG="dnf"
  elif command -v yum     &>/dev/null; then LINUX_PKG="yum"
  elif command -v pacman  &>/dev/null; then LINUX_PKG="pacman"
  else warn "No supported Linux package manager — install Node 20, pnpm, postgres, redis, qrencode manually."
  fi
fi

# ── helpers ────────────────────────────────────────────────────────────────
have() { command -v "$1" &>/dev/null; }

linux_install() {
  # linux_install <apt-name> [<dnf-name>] [<pacman-name>]
  local apt_name="$1" dnf_name="${2:-$1}" pacman_name="${3:-$1}"
  case "$LINUX_PKG" in
    apt)    sudo apt-get install -y "$apt_name" ;;
    dnf)    sudo dnf install  -y "$dnf_name" ;;
    yum)    sudo yum install  -y "$dnf_name" ;;
    pacman) sudo pacman -S --noconfirm "$pacman_name" ;;
    *) return 1 ;;
  esac
}

# free_port PREFERRED — returns PREFERRED if free, else next available.
free_port() {
  local p="$1"
  while have lsof && lsof -ti tcp:"$p" &>/dev/null 2>&1; do
    warn "Port $p busy — trying $((p+1))"
    p=$((p+1))
  done
  # fallback if no lsof: ss / netstat
  if ! have lsof; then
    while have ss && ss -ltn "( sport = :$p )" 2>/dev/null | grep -q LISTEN; do
      warn "Port $p busy — trying $((p+1))"
      p=$((p+1))
    done
  fi
  echo "$p"
}

# Set a key=value in a .env file. Creates the line if missing.
set_env() {
  local file="$1" key="$2" val="$3"
  [[ -f "$file" ]] || return 0
  if grep -qE "^${key}=" "$file"; then
    # POSIX-portable in-place edit
    if [[ "$OS_KIND" == "mac" ]]; then
      sed -i.bak -E "s|^${key}=.*|${key}=${val}|" "$file" && rm -f "${file}.bak"
    else
      sed -i -E "s|^${key}=.*|${key}=${val}|" "$file"
    fi
  else
    echo "${key}=${val}" >> "$file"
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 1 — TOOL INSTALLATION
# ══════════════════════════════════════════════════════════════════════════════

# extend PATH with common locations
_nvm_node_bin() {
  local d="$HOME/.nvm/versions/node"
  [[ -d "$d" ]] && ls "$d" 2>/dev/null | sort -V | tail -1 | xargs -I{} echo "$d/{}/bin" || true
}
export PATH="\
/usr/local/bin:/usr/local/sbin:\
/opt/homebrew/bin:/opt/homebrew/sbin:\
/Applications/Docker.app/Contents/Resources/bin:\
$HOME/.docker/bin:$HOME/.volta/bin:$HOME/.fnm:\
$(_nvm_node_bin):$HOME/.pnpm:$PATH"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"

# ── Homebrew (macOS only) ─────────────────────────────────────────────────
if [[ "$OS_KIND" == "mac" ]]; then
  if ! have brew; then
    log "Homebrew not found — installing …"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if   [[ -f /opt/homebrew/bin/brew ]]; then eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ -f /usr/local/bin/brew    ]]; then eval "$(/usr/local/bin/brew shellenv)"
    fi
    ok "Homebrew installed"
  fi
fi

# ── Node 20 ───────────────────────────────────────────────────────────────
if ! have node || ! node -e "process.exit(parseInt(process.versions.node)<20?1:0)" 2>/dev/null; then
  if ! have nvm && [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    log "Installing nvm …"
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1091
    source "$NVM_DIR/nvm.sh"
  elif [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    source "$NVM_DIR/nvm.sh"
  fi
  log "Installing Node 20 …"
  nvm install 20 && nvm use 20 && nvm alias default 20
  NEW_NODE_BIN="$(_nvm_node_bin)"
  [[ -n "$NEW_NODE_BIN" ]] && export PATH="$NEW_NODE_BIN:$PATH"
fi
ok "Node $(node -v)"

# ── pnpm ──────────────────────────────────────────────────────────────────
if ! have pnpm; then
  log "Installing pnpm …"
  npm install -g pnpm
fi
ok "pnpm $(pnpm --version)"

# ── qrencode (terminal QR codes) ──────────────────────────────────────────
if ! have qrencode; then
  log "Installing qrencode …"
  if [[ "$OS_KIND" == "mac" ]]; then brew install qrencode
  else linux_install qrencode || warn "Could not install qrencode — QR codes disabled"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 2 — DETECT DB BACKEND: docker | brew | system
# ══════════════════════════════════════════════════════════════════════════════
DB_MODE=""

if have docker; then
  if ! docker info &>/dev/null 2>&1; then
    if [[ "$OS_KIND" == "mac" ]]; then
      warn "Docker daemon not running — launching Docker Desktop …"
      open -a Docker 2>/dev/null || true
      log "Waiting for Docker daemon (up to 30s) …"
      for i in $(seq 1 30); do
        docker info &>/dev/null 2>&1 && break
        [[ $i -eq 30 ]] && warn "Docker did not start. Falling back to native services."
        sleep 1
      done
    else
      warn "Docker daemon not reachable. Try: sudo systemctl start docker"
    fi
  fi
  if docker info &>/dev/null 2>&1; then
    ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
    DB_MODE="docker"
  fi
fi

if [[ -z "$DB_MODE" ]]; then
  if [[ "$OS_KIND" == "mac" ]]; then
    if have brew; then
      brew list postgresql@16 &>/dev/null 2>&1 || { log "Installing postgresql@16 …"; brew install postgresql@16; }
      brew list redis           &>/dev/null 2>&1 || { log "Installing redis …";          brew install redis; }
      export PATH="$(brew --prefix postgresql@16)/bin:$PATH"
      DB_MODE="brew"
    else
      die "Need either Docker or Homebrew on macOS."
    fi
  else
    if [[ -n "$LINUX_PKG" ]]; then
      have psql      || { log "Installing postgresql …"; linux_install postgresql postgresql-server postgresql; }
      have redis-cli || { log "Installing redis …";       linux_install redis-server redis redis; }
      DB_MODE="system"
    else
      die "Need either Docker or apt/dnf on Linux."
    fi
  fi
fi
ok "DB mode: $DB_MODE"

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 3 — ENV BOOTSTRAP
# ══════════════════════════════════════════════════════════════════════════════
ensure_env() {
  local dst="$1" src="$2"
  if [[ ! -f "$dst" ]]; then
    [[ -f "$src" ]] || { warn "$src missing"; return; }
    warn "$(basename "$dst") missing — copying from $(basename "$src")"
    cp "$src" "$dst"
  fi
}
ensure_env "$ROOT/backend/.env"              "$ROOT/backend/.env.example"
ensure_env "$ROOT/apps/admin-web/.env.local" "$ROOT/apps/admin-web/.env.example"
ensure_env "$ROOT/apps/staff-app/.env"       "$ROOT/apps/staff-app/.env.example"
ensure_env "$ROOT/apps/resident-app/.env"    "$ROOT/apps/resident-app/.env.example"

# DATABASE_URL — match the chosen DB mode
case "$DB_MODE" in
  docker)
    set_env "$ROOT/backend/.env" "DATABASE_URL" "postgresql://postgres:postgres@localhost:5432/societyos" ;;
  brew)
    DB_USER="$(whoami)"
    set_env "$ROOT/backend/.env" "DATABASE_URL" "postgresql://${DB_USER}@localhost:5432/societyos" ;;
  system)
    # Linux native postgres usually requires a real password — accept whatever the user already configured.
    if ! grep -qE "^DATABASE_URL=postgresql" "$ROOT/backend/.env"; then
      warn "Set DATABASE_URL in backend/.env manually for native postgres."
    fi ;;
esac

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 4 — PROCESS TRACKING + CLEANUP
# ══════════════════════════════════════════════════════════════════════════════
mkdir -p "$LOG_DIR"
: > "$PIDS_FILE"
register_pid() { echo "$1" >> "$PIDS_FILE"; }

cleanup() {
  echo ""
  log "Shutting down …"
  if [[ -f "$PIDS_FILE" ]]; then
    while IFS= read -r pid; do kill "$pid" 2>/dev/null || true; done < "$PIDS_FILE"
    rm -f "$PIDS_FILE"
  fi
  if [[ "$DB_MODE" == "docker" ]]; then
    docker compose -f "$ROOT/docker-compose.yml" stop 2>/dev/null || true
    docker stop marzi-redis 2>/dev/null || true
  fi
  ok "Done."
}
trap cleanup EXIT INT TERM

# LAN IP — used for QR codes so a phone on the same wifi can hit metro.
detect_lan_ip() {
  if [[ "$OS_KIND" == "mac" ]]; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost"
  else
    # Linux: prefer the first non-loopback v4 address.
    ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -1 \
      || hostname -I 2>/dev/null | awk '{print $1}' \
      || echo "localhost"
  fi
}
LAN_IP="$(detect_lan_ip)"

show_qr() {
  local label="$1" url="$2" color="$3"
  echo -e "\n  ${color}${BOLD}${label}${RESET}"
  echo -e "  ${BOLD}${url}${RESET}"
  if have qrencode; then qrencode -t UTF8 -m 1 "$url" | sed 's/^/  /'; fi
}

# tee log + show colored prefix
run_bg() {
  local label="$1" color="$2" dir="$3"; shift 3
  local logfile="$LOG_DIR/$label.log"
  : > "$logfile"
  (cd "$dir" && exec "$@" > "$logfile" 2>&1) &
  local proc_pid=$!
  register_pid "$proc_pid"
  tail -F "$logfile" 2>/dev/null \
    | while IFS= read -r line; do echo -e "${color}[$label]${RESET} $line"; done &
  ok "Started $label (pid $proc_pid  log: .logs/$label.log)"
}

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 4b — ONE-TIME iOS DEV CLIENT BOOTSTRAP (--bootstrap-ios)
# ══════════════════════════════════════════════════════════════════════════════
# Builds and installs the Expo dev client for resident-app + staff-app onto
# the currently-booted iOS simulators, in parallel. Run this once after a
# fresh checkout (or after `xcrun simctl erase all`) so that subsequent
# `./dev.sh` invocations can open the live URL into a real native client.
# Without this step the apps fall back to Expo Go, where native modules
# (Razorpay, push, image picker) won't work.
if [[ $BOOTSTRAP_IOS -eq 1 ]]; then
  if [[ "$OS_KIND" != "mac" ]] || ! have xcrun; then
    die "--bootstrap-ios requires macOS with Xcode installed."
  fi

  log "Boot a simulator first if none is booted (best-effort) …"
  if ! xcrun simctl list devices booted 2>/dev/null | grep -q "iPhone"; then
    open -a Simulator 2>/dev/null || true
    SIM_UDID="$(xcrun simctl list devices available -j 2>/dev/null \
      | python3 -c "
import sys, json
devs = json.load(sys.stdin).get('devices', {})
phones = [d for ds in devs.values() for d in ds if 'iPhone' in d.get('name','') and d.get('isAvailable')]
print(phones[0]['udid'] if phones else '')")"
    [[ -n "$SIM_UDID" ]] && xcrun simctl boot "$SIM_UDID" 2>/dev/null || true
    sleep 4
  fi

  log "Building + installing dev clients (resident-app + staff-app) in parallel — this takes 5–10 min."
  log "Streaming output to .logs/ios-build-{resident,staff}.log"
  mkdir -p "$LOG_DIR"
  : > "$LOG_DIR/ios-build-resident.log"
  : > "$LOG_DIR/ios-build-staff.log"

  (cd "$ROOT/apps/resident-app" && pnpm exec expo run:ios --no-install) > "$LOG_DIR/ios-build-resident.log" 2>&1 &
  RES_PID=$!
  (cd "$ROOT/apps/staff-app"    && pnpm exec expo run:ios --no-install) > "$LOG_DIR/ios-build-staff.log"    2>&1 &
  STAFF_PID=$!

  log "resident-app build pid: $RES_PID"
  log "staff-app build pid:    $STAFF_PID"
  log "Waiting for both builds to finish …"
  wait $RES_PID;   RES_RC=$?
  wait $STAFF_PID; STAFF_RC=$?

  if [[ $RES_RC -eq 0 ]];   then ok "resident-app dev client installed";   else warn "resident-app build failed (rc=$RES_RC) — see .logs/ios-build-resident.log";   fi
  if [[ $STAFF_RC -eq 0 ]]; then ok "staff-app dev client installed";       else warn "staff-app build failed (rc=$STAFF_RC) — see .logs/ios-build-staff.log";   fi

  ok "Bootstrap done. Run ./dev.sh (no flag) to start the full stack."
  exit 0
fi

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 5 — START DATABASES
# ══════════════════════════════════════════════════════════════════════════════
case "$DB_MODE" in
  docker)
    log "Starting PostgreSQL (docker) …"
    docker compose -f "$ROOT/docker-compose.yml" up -d postgres

    log "Starting Redis (docker) …"
    if docker ps -a --format '{{.Names}}' | grep -q '^marzi-redis$'; then
      docker start marzi-redis > /dev/null 2>&1 || true
    else
      docker run -d --name marzi-redis --restart unless-stopped \
        -p 6379:6379 redis:7-alpine \
        redis-server --save "" --appendonly no > /dev/null
    fi

    log "Waiting for PostgreSQL …"
    PG_CID="$(docker compose -f "$ROOT/docker-compose.yml" ps -q postgres)"
    for i in $(seq 1 30); do
      docker exec "$PG_CID" pg_isready -U postgres -q 2>/dev/null && { ok "PostgreSQL ready"; break; }
      [[ $i -eq 30 ]] && die "PostgreSQL did not become ready"
      sleep 1
    done

    log "Waiting for Redis …"
    for i in $(seq 1 15); do
      docker exec marzi-redis redis-cli ping 2>/dev/null | grep -q PONG && { ok "Redis ready"; break; }
      [[ $i -eq 15 ]] && die "Redis did not become ready"
      sleep 1
    done
    ;;

  brew)
    log "Starting PostgreSQL + Redis (brew services) …"
    brew services start postgresql@16 2>/dev/null || true
    brew services start redis           2>/dev/null || true
    for i in $(seq 1 20); do pg_isready -q 2>/dev/null && { ok "PostgreSQL ready"; break; }; [[ $i -eq 20 ]] && die "PostgreSQL did not start"; sleep 1; done
    for i in $(seq 1 10); do redis-cli ping 2>/dev/null | grep -q PONG && { ok "Redis ready"; break; }; [[ $i -eq 10 ]] && die "Redis did not start"; sleep 1; done
    createdb societyos 2>/dev/null || true
    ;;

  system)
    log "Starting PostgreSQL + Redis (systemd) …"
    sudo systemctl start postgresql 2>/dev/null || true
    sudo systemctl start redis-server 2>/dev/null || sudo systemctl start redis 2>/dev/null || true
    for i in $(seq 1 20); do pg_isready -q 2>/dev/null && { ok "PostgreSQL ready"; break; }; [[ $i -eq 20 ]] && die "PostgreSQL not ready — check sudo systemctl status postgresql"; sleep 1; done
    for i in $(seq 1 10); do redis-cli ping 2>/dev/null | grep -q PONG && { ok "Redis ready"; break; }; [[ $i -eq 10 ]] && die "Redis not ready"; sleep 1; done
    sudo -u postgres createdb societyos 2>/dev/null || true
    ;;
esac

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 6 — DEPENDENCIES + PRISMA
# ══════════════════════════════════════════════════════════════════════════════
if [[ $NO_INSTALL -eq 0 ]]; then
  log "Installing dependencies (pnpm install) …"
  pnpm install
fi

log "Generating Prisma client …"
(cd "$ROOT/backend" && pnpm exec prisma generate) || warn "prisma generate failed"

if [[ $RESET_DB -eq 1 ]]; then
  warn "RESET requested — dropping schema and re-migrating."
  (cd "$ROOT/backend" && pnpm exec prisma migrate reset --force --skip-seed) \
    || die "prisma migrate reset failed"
fi

if [[ $SKIP_MIGRATE -eq 0 ]]; then
  log "Applying Prisma migrations …"
  if (cd "$ROOT/backend" && pnpm exec prisma migrate deploy); then
    ok "Migrations applied"
  else
    warn "migrate deploy failed — falling back to db push (dev convenience)"
    (cd "$ROOT/backend" && pnpm exec prisma db push --accept-data-loss) \
      && ok "Schema synced via db push" \
      || warn "db push also failed — check schema drift"
  fi
fi

if [[ $SKIP_SEED -eq 0 ]]; then
  log "Seeding database (idempotent) …"
  (cd "$ROOT/backend" && pnpm exec prisma db seed) \
    && ok "Seed loaded" \
    || warn "Seed failed — check backend/prisma/seed.ts"
fi

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 7 — RESOLVE PORTS + PATCH ENVS
# ══════════════════════════════════════════════════════════════════════════════
BACKEND_PORT=$(free_port 3000)
ADMIN_PORT=$(free_port 3001)
STAFF_PORT=$(free_port 8081)
RESIDENT_PORT=$(free_port "$((STAFF_PORT+1))")

API_URL="http://localhost:${BACKEND_PORT}/v1"

# Backend
set_env "$ROOT/backend/.env" "PORT" "$BACKEND_PORT"
# admin-web origin must be in CORS_ORIGINS or browser requests will fail.
NEW_CORS="http://localhost:${ADMIN_PORT},http://localhost:19006,exp://localhost:${STAFF_PORT},exp://localhost:${RESIDENT_PORT}"
set_env "$ROOT/backend/.env" "CORS_ORIGINS" "\"${NEW_CORS}\""

# admin-web
set_env "$ROOT/apps/admin-web/.env.local" "NEXT_PUBLIC_API_URL" "$API_URL"

# Expo apps point at the LAN IP so a phone on the same wifi reaches the backend.
EXPO_API_URL="http://${LAN_IP}:${BACKEND_PORT}/v1"
set_env "$ROOT/apps/resident-app/.env" "EXPO_PUBLIC_API_URL" "$EXPO_API_URL"
set_env "$ROOT/apps/staff-app/.env"    "EXPO_PUBLIC_API_URL" "$EXPO_API_URL"

ok "Resolved ports — backend=$BACKEND_PORT admin=$ADMIN_PORT staff=$STAFF_PORT resident=$RESIDENT_PORT"
ok "API URL: $API_URL  (Expo apps use http://$LAN_IP:$BACKEND_PORT/v1)"

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 8 — START APP SERVICES
# ══════════════════════════════════════════════════════════════════════════════
log "Starting backend (NestJS :$BACKEND_PORT) …"
run_bg "backend" "$CYAN" "$ROOT/backend" pnpm run dev

log "Waiting for backend health …"
HEALTHY=0
for i in $(seq 1 60); do
  if curl -sf "http://localhost:${BACKEND_PORT}/v1/health" -o /dev/null 2>&1; then
    HEALTHY=1; break
  fi
  sleep 1
done
[[ $HEALTHY -eq 1 ]] && ok "Backend healthy" || warn "Backend did not respond on /v1/health within 60s — check .logs/backend.log"

log "Starting admin-web (Next.js :$ADMIN_PORT) …"
run_bg "admin-web" "$GREEN" "$ROOT/apps/admin-web" \
  sh -c "PORT=$ADMIN_PORT pnpm run dev"

# ── Expo apps + iOS Simulator (mac only) ────────────────────────────────
HAS_SIMULATOR=0; STAFF_SIM_UDID=""; STAFF_SIM_NAME=""; RESIDENT_SIM_UDID=""; RESIDENT_SIM_NAME=""

if [[ $NO_EXPO -eq 0 && "$OS_KIND" == "mac" ]] && have xcrun; then
  SIM_LIST=()
  while IFS= read -r line; do SIM_LIST+=("$line"); done < <(
    xcrun simctl list devices available -j 2>/dev/null \
    | python3 -c "
import sys, json
devs = json.load(sys.stdin).get('devices', {})
phones = [d for ds in devs.values() for d in ds if 'iPhone' in d.get('name','') and d.get('isAvailable')]
phones.sort(key=lambda d: 0 if d.get('state') == 'Booted' else 1)
seen=set(); out=[]
for d in phones:
  if d['name'] in seen: continue
  seen.add(d['name']); out.append(d)
  if len(out)==2: break
for d in out: print(d['udid'] + '|' + d['name'])
" 2>/dev/null || true)

  if [[ ${#SIM_LIST[@]} -ge 1 ]]; then
    STAFF_SIM_UDID="${SIM_LIST[0]%%|*}"; STAFF_SIM_NAME="${SIM_LIST[0]##*|}"; HAS_SIMULATOR=1
  fi
  if [[ ${#SIM_LIST[@]} -ge 2 ]]; then
    RESIDENT_SIM_UDID="${SIM_LIST[1]%%|*}"; RESIDENT_SIM_NAME="${SIM_LIST[1]##*|}"
  fi
  if [[ $HAS_SIMULATOR -eq 1 ]]; then
    log "Booting simulators …"
    xcrun simctl boot "$STAFF_SIM_UDID" 2>/dev/null || true
    [[ -n "$RESIDENT_SIM_UDID" ]] && xcrun simctl boot "$RESIDENT_SIM_UDID" 2>/dev/null || true
    open -a Simulator 2>/dev/null || true
  fi
fi

dev_client_installed() { xcrun simctl get_app_container "$1" "$2" &>/dev/null; }

open_in_simulator() {
  local name="$1" udid="$2" port="$3" sim_name="$4" bundle_id="$5" scheme="$6"
  for i in $(seq 1 90); do
    curl -sf "http://127.0.0.1:$port" > /dev/null 2>&1 && break
    [[ $i -eq 90 ]] && { warn "$name metro did not start — scan QR manually"; return; }
    sleep 1
  done
  for i in $(seq 1 20); do
    xcrun simctl list devices 2>/dev/null | grep "$udid" | grep -q Booted && break
    sleep 1
  done
  local url
  if dev_client_installed "$udid" "$bundle_id"; then
    url="$scheme://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A$port"
  else
    warn "$name: dev client not installed — falling back to Expo Go (native modules may fail)."
    warn "  One-time build: cd apps/$name && pnpm ios"
    url="exp://127.0.0.1:$port"
  fi
  xcrun simctl openurl "$udid" "$url" 2>/dev/null \
    && ok "$name → $sim_name  $url" \
    || warn "$name: simctl openurl failed; run manually: xcrun simctl openurl $udid '$url'"
}

if [[ $NO_EXPO -eq 0 ]]; then
  EXPO_FLAGS="--non-interactive"
  [[ "${CLEAR:-0}" == "1" ]] && EXPO_FLAGS="$EXPO_FLAGS --clear"

  log "Starting staff-app (Expo :$STAFF_PORT) …"
  run_bg "staff-app" "$YELLOW" "$ROOT/apps/staff-app" \
    pnpm exec expo start --port "$STAFF_PORT" $EXPO_FLAGS

  log "Starting resident-app (Expo :$RESIDENT_PORT) …"
  run_bg "resident-app" "$RED" "$ROOT/apps/resident-app" \
    pnpm exec expo start --port "$RESIDENT_PORT" $EXPO_FLAGS

  if [[ $HAS_SIMULATOR -eq 1 ]]; then
    ( open_in_simulator "staff-app" "$STAFF_SIM_UDID" "$STAFF_PORT" \
        "$STAFF_SIM_NAME" "com.societyos.staff" "societyos-staff" ) & register_pid $!
    if [[ -n "$RESIDENT_SIM_UDID" ]]; then
      ( sleep 5 && open_in_simulator "resident-app" "$RESIDENT_SIM_UDID" "$RESIDENT_PORT" \
          "$RESIDENT_SIM_NAME" "com.societyos.resident" "societyos" ) & register_pid $!
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 9 — STATUS BOARD
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  SocietyOS dev stack   OS: $OS_KIND   DB: $DB_MODE   LAN: $LAN_IP${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  ${CYAN}${BOLD}backend (NestJS)${RESET}"
echo -e "    API     → http://localhost:$BACKEND_PORT/v1"
echo -e "    Swagger → http://localhost:$BACKEND_PORT/api"
echo ""
echo -e "  ${GREEN}${BOLD}admin-web (Next.js)${RESET}"
echo -e "    Web     → http://localhost:$ADMIN_PORT"
echo ""
echo -e "  ${BOLD}databases${RESET}"
echo -e "    postgres → localhost:5432  (db: societyos)"
echo -e "    redis    → localhost:6379"
echo ""
echo -e "  ${BOLD}dev login (after seed)${RESET}"
echo -e "    Admin     → phone +91 90000 00001  · OTP 123456"
echo -e "    Resident  → phone +91 91000 00001  · OTP 123456"
echo -e "    Staff     → phone +91 92000 00001  · OTP 123456"

if [[ $NO_EXPO -eq 0 ]]; then
  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}  Expo apps — scan with Expo Go on the same wifi${RESET}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  show_qr "staff-app    (port $STAFF_PORT)"    "exp://$LAN_IP:$STAFF_PORT"    "$YELLOW"
  show_qr "resident-app (port $RESIDENT_PORT)" "exp://$LAN_IP:$RESIDENT_PORT" "$RED"
  echo ""
  if [[ $HAS_SIMULATOR -eq 1 ]]; then
    echo -e "  Simulators: ${BOLD}$STAFF_SIM_NAME${RESET}${RESIDENT_SIM_NAME:+ · ${BOLD}$RESIDENT_SIM_NAME${RESET}}"
    echo -e "  Apps open automatically once metro is ready (~10–20 s)."
  elif [[ "$OS_KIND" == "mac" ]]; then
    echo -e "  No simulator detected. Install Xcode → open Simulator, then re-run."
  else
    echo -e "  Linux detected — install ${BOLD}Expo Go${RESET} on your phone and scan a QR above."
  fi
fi

echo ""
echo -e "  Flags: ${BOLD}--no-expo${RESET}  ${BOLD}--skip-migrate${RESET}  ${BOLD}--skip-seed${RESET}  ${BOLD}--no-install${RESET}  ${BOLD}--reset${RESET}"
echo -e "  Logs:  ${BOLD}.logs/backend.log${RESET}  ${BOLD}.logs/admin-web.log${RESET}  ${BOLD}.logs/staff-app.log${RESET}  ${BOLD}.logs/resident-app.log${RESET}"
echo -e "  Press ${BOLD}Ctrl-C${RESET} to stop everything"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

wait
