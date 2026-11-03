#!/usr/bin/env bash
# Install + start the self-hosted GitHub Actions runner on the PRODUCTION box.
#
# Usage (on the production server, as the deploy user - NOT root):
#   1. Get a registration token:
#      https://github.com/BlueCodeSystems/ecap-plus-pmp/settings/actions/runners/new?arch=x64&os=linux
#   2. Run:
#      RUNNER_TOKEN=<paste-token> bash setup-production-runner.sh
#
# Re-runnable: if a runner is already configured it skips re-config.
set -euo pipefail

REPO_URL="https://github.com/BlueCodeSystems/ecap-plus-pmp"
RUNNER_VERSION="2.335.1"
RUNNER_NAME="ecap-plus-pmp-production-runner"
RUNNER_LABELS="production"
RUNNER_DIR="$HOME/actions-runner"
PROD_DOMAIN="ecapplus.pmp.bluecodeltd.com"
PROD_PORT="3040"
PROD_NGINX_SITE="/etc/nginx/sites-available/${PROD_DOMAIN}"
# ECAP Plus backend API (REACT_PUBLIC_API_URL) - shared by both the production
# and staging frontends.
BACKEND_DOMAIN="server.ecapplus.pmp.bluecodeltd.com"
BACKEND_PORT="${BACKEND_PORT:-9003}"
BACKEND_NGINX_SITE="/etc/nginx/sites-available/${BACKEND_DOMAIN}"
TARBALL="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
DOWNLOAD_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${TARBALL}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -ne 0 ] || die "Run as the deploy user, not root (sudo is used only for the service step)."
[ -n "${RUNNER_TOKEN:-}" ] || die "RUNNER_TOKEN not set. Get one from the GitHub runners page and run: RUNNER_TOKEN=<token> bash $0"

say "Checking toolchain (node, npm, pm2, git, curl)..."
missing=""
for bin in node npm pm2 git curl; do
  if command -v "$bin" >/dev/null 2>&1; then
    printf '  %-6s %s\n' "$bin" "$(command -v "$bin")"
  else
    printf '  %-6s MISSING\n' "$bin"
    missing="$missing $bin"
  fi
done
if [ -n "$missing" ]; then
  die "Missing:$missing. Install them system-wide (NodeSource for node/npm, 'npm i -g pm2') before continuing."
fi
case "$(command -v node)" in
  *"/.nvm/"*) printf '\n\033[1;33mWARNING: node resolves via nvm (%s). A runner installed as a SERVICE may not see it.\nIf the deploy later logs "node: not found", install Node system-wide or symlink into /usr/local/bin, then restart the service.\033[0m\n' "$(command -v node)";;
esac

mkdir -p "$RUNNER_DIR" && cd "$RUNNER_DIR"
if [ ! -x "./config.sh" ]; then
  say "Downloading runner v${RUNNER_VERSION}..."
  curl -fsSL -o "$TARBALL" "$DOWNLOAD_URL"
  tar xzf "$TARBALL"
else
  say "Runner already unpacked in $RUNNER_DIR - skipping download."
fi

if [ -f ".runner" ]; then
  say "Runner already configured (.runner exists) - skipping config."
else
  say "Configuring runner '$RUNNER_NAME' with label '$RUNNER_LABELS'..."
  ./config.sh \
    --url "$REPO_URL" \
    --token "$RUNNER_TOKEN" \
    --name "$RUNNER_NAME" \
    --labels "$RUNNER_LABELS" \
    --work _work \
    --unattended \
    --replace
fi

say "Installing and starting the runner service (sudo)..."
sudo ./svc.sh install "$USER"
sudo ./svc.sh start
sudo ./svc.sh status || true

if command -v nginx >/dev/null 2>&1; then
  say "Configuring Nginx production vhost (${PROD_DOMAIN} -> 127.0.0.1:${PROD_PORT})..."
  sudo tee "$PROD_NGINX_SITE" >/dev/null <<NGINX
server {
    listen 80;
    server_name ${PROD_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${PROD_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX
  sudo ln -sf "$PROD_NGINX_SITE" "/etc/nginx/sites-enabled/${PROD_DOMAIN}"
  sudo nginx -t
  sudo systemctl reload nginx

  if command -v certbot >/dev/null 2>&1; then
    say "Requesting/refreshing HTTPS certificate for ${PROD_DOMAIN}..."
    sudo certbot --nginx -d "$PROD_DOMAIN" --non-interactive --agree-tos --redirect || \
      printf '\n\033[1;33mWARNING: Certbot did not complete. Confirm DNS points here, then run: sudo certbot --nginx -d %s --redirect\033[0m\n' "$PROD_DOMAIN"
  else
    printf '\n\033[1;33mWARNING: certbot not found. Install certbot, then run: sudo certbot --nginx -d %s --redirect\033[0m\n' "$PROD_DOMAIN"
  fi

  say "Configuring Nginx vhost for the ECAP Plus backend (${BACKEND_DOMAIN} -> 127.0.0.1:${BACKEND_PORT})..."
  printf '\033[1;33mNOTE: this only works once %s has a DNS A record pointing at this server'"'"'s IP.\033[0m\n' "$BACKEND_DOMAIN"
  sudo tee "$BACKEND_NGINX_SITE" >/dev/null <<NGINX
server {
    listen 80;
    server_name ${BACKEND_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX
  sudo ln -sf "$BACKEND_NGINX_SITE" "/etc/nginx/sites-enabled/${BACKEND_DOMAIN}"
  sudo nginx -t
  sudo systemctl reload nginx

  if command -v certbot >/dev/null 2>&1; then
    say "Requesting/refreshing HTTPS certificate for ${BACKEND_DOMAIN}..."
    sudo certbot --nginx -d "$BACKEND_DOMAIN" --non-interactive --agree-tos --redirect || \
      printf '\n\033[1;33mWARNING: Certbot did not complete. Confirm DNS points here, then run: sudo certbot --nginx -d %s --redirect\033[0m\n' "$BACKEND_DOMAIN"
  else
    printf '\n\033[1;33mWARNING: certbot not found. Install certbot, then run: sudo certbot --nginx -d %s --redirect\033[0m\n' "$BACKEND_DOMAIN"
  fi
else
  printf '\n\033[1;33mWARNING: nginx not found; skipping production reverse proxy setup.\033[0m\n'
fi

say "Done. In GitHub the runner should now show 'Idle' under Settings -> Actions -> Runners."
echo "The queued Deploy Production run will pick up automatically within ~30s."
