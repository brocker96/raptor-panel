#!/usr/bin/env bash
#
# Raptor Panel installer for a clean Ubuntu 24.04 LTS server.
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/xvmandz/raptor-panel/0.x_beta/install.sh)
#
# Installs and configures everything the Panel needs: PHP 8.3, MariaDB, Redis, nginx, Composer,
# Node.js (only when building from source), the queue worker, the scheduler cron job and an
# optional Let's Encrypt certificate. It can also install Docker and Wings on the same machine
# and register it as the first node, so the Panel is ready to create servers right away.
#
# Every question can be answered up front through environment variables, which makes the script
# usable non-interactively as well:
#
#   RAPTOR_FQDN=panel.example.com RAPTOR_EMAIL=me@example.com RAPTOR_ADMIN_PASSWORD=secret \
#   RAPTOR_WINGS=yes RAPTOR_YES=1 bash install.sh
#
# Supported variables:
#   RAPTOR_FQDN            Domain (or IP address) the Panel will be reachable on.
#   RAPTOR_EMAIL           Email for Let's Encrypt and the first administrator account.
#   RAPTOR_ADMIN_USERNAME  Username of the first administrator (default: admin).
#   RAPTOR_ADMIN_PASSWORD  Password of the first administrator (default: generated).
#   RAPTOR_TIMEZONE        PHP timezone, e.g. Europe/Kyiv (default: system timezone or UTC).
#   RAPTOR_SSL             yes/no - request a Let's Encrypt certificate (default: yes for domains).
#   RAPTOR_WINGS           yes/no - install Docker + Wings on this machine (default: ask).
#   RAPTOR_CLOUDFLARE      yes/no - the Panel domain is proxied by Cloudflare (orange cloud).
#   RAPTOR_NODE_FQDN       Domain for Wings/SFTP/game connections. Behind Cloudflare this should be a
#                          separate "DNS only" (grey cloud) record, e.g. node.example.com.
#   RAPTOR_BRANCH          Git branch to install from (default: 0.x_beta).
#   RAPTOR_RELEASE         Install a pre-built release instead of building from git, e.g. "latest" or "v1.0.0".
#   RAPTOR_DIR             Install directory (default: /var/www/raptor).
#   RAPTOR_PORTS           Port range to create as allocations on the local node (default: 25565-25600).
#   RAPTOR_YES=1           Do not ask for confirmation.

set -Eeuo pipefail

REPO="xvmandz/raptor-panel"
BRANCH="${RAPTOR_BRANCH:-0.x_beta}"
RELEASE="${RAPTOR_RELEASE:-}"
DIR="${RAPTOR_DIR:-/var/www/raptor}"
PHP_VERSION="8.3"
LOG_FILE="/var/log/raptor-install.log"
CREDENTIALS_FILE="/root/raptor-credentials.txt"

# ---------------------------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------------------------

if [[ -t 1 ]]; then
    GREEN=$'\e[38;5;76m'; DIM=$'\e[2m'; BOLD=$'\e[1m'; RED=$'\e[31m'; YELLOW=$'\e[33m'; RESET=$'\e[0m'
else
    GREEN=""; DIM=""; BOLD=""; RED=""; YELLOW=""; RESET=""
fi

STEP=0
step() { STEP=$((STEP + 1)); printf '\n%s[%02d]%s %s%s%s\n' "$GREEN" "$STEP" "$RESET" "$BOLD" "$*" "$RESET"; }
info() { printf '     %s%s%s\n' "$DIM" "$*" "$RESET"; }
warn() { printf '     %s! %s%s\n' "$YELLOW" "$*" "$RESET"; }
fail() { printf '\n%s✖ %s%s\n' "$RED" "$*" "$RESET" >&2; exit 1; }

# Runs a command, sending its output to the log file so the terminal stays readable.
run() {
    echo "+ $*" >>"$LOG_FILE"
    if ! "$@" >>"$LOG_FILE" 2>&1; then
        fail "Command failed: $*  (see $LOG_FILE for details)"
    fi
}

trap 'fail "Installation aborted on line $LINENO. The full log is available at $LOG_FILE."' ERR

ask() {
    # ask <variable> <question> <default>
    local __var="$1" __question="$2" __default="${3:-}" __answer
    if [[ -n "${!__var:-}" ]]; then return; fi
    if [[ "${RAPTOR_YES:-}" == "1" || ! -t 0 ]]; then
        printf -v "$__var" '%s' "$__default"
        return
    fi
    if [[ -n "$__default" ]]; then
        read -r -p "     $__question [$__default]: " __answer
    else
        read -r -p "     $__question: " __answer
    fi
    printf -v "$__var" '%s' "${__answer:-$__default}"
}

yes_no() { [[ "${1,,}" =~ ^(y|yes|1|true)$ ]]; }
random() { tr -dc 'A-Za-z0-9' </dev/urandom | head -c "${1:-32}" || true; }
is_ip() { [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; }

# ---------------------------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------------------------

cat <<'BANNER'

   ____             _              ____                  _
  |  _ \ __ _ _ __ | |_ ___  _ __ |  _ \ __ _ _ __   ___| |
  | |_) / _` | '_ \| __/ _ \| '__|| |_) / _` | '_ \ / _ \ |
  |  _ < (_| | |_) | || (_) | |   |  __/ (_| | | | |  __/ |
  |_| \_\__,_| .__/ \__\___/|_|   |_|   \__,_|_| |_|\___|_|
             |_|                    installer for Ubuntu 24.04

BANNER

[[ $EUID -eq 0 ]] || fail "Run this installer as root (sudo -i)."
: >"$LOG_FILE"

# shellcheck disable=SC1091
. /etc/os-release
if [[ "${ID:-}" != "ubuntu" || "${VERSION_ID:-}" != "24.04" ]]; then
    warn "This installer is written for Ubuntu 24.04 LTS, detected ${PRETTY_NAME:-unknown}."
    ask CONTINUE_ANYWAY "Continue anyway? (yes/no)" "no"
    yes_no "$CONTINUE_ANYWAY" || exit 1
fi

case "$(uname -m)" in
    x86_64) ARCH="amd64" ;;
    aarch64 | arm64) ARCH="arm64" ;;
    *) fail "Unsupported CPU architecture: $(uname -m)" ;;
esac

if [[ -e "$DIR/.env" ]]; then
    fail "$DIR already contains a Panel installation. Use 'php artisan p:upgrade' to update it instead."
fi

PUBLIC_IP="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
SYSTEM_TZ="$(timedatectl show -p Timezone --value 2>/dev/null || echo UTC)"

step "Configuration"
ask RAPTOR_FQDN "Domain the Panel will be reachable on (or the server IP)" "$PUBLIC_IP"
[[ -n "$RAPTOR_FQDN" ]] || fail "A domain or IP address is required."
ask RAPTOR_EMAIL "Your email (admin account + Let's Encrypt)" "admin@${RAPTOR_FQDN}"
ask RAPTOR_ADMIN_USERNAME "Administrator username" "admin"
ask RAPTOR_ADMIN_PASSWORD "Administrator password (leave empty to generate one)" ""
ask RAPTOR_TIMEZONE "Timezone" "${SYSTEM_TZ:-UTC}"
if is_ip "$RAPTOR_FQDN"; then
    RAPTOR_SSL="no"
    info "An IP address was given, Let's Encrypt certificates require a domain so HTTPS is skipped."
else
    ask RAPTOR_SSL "Request a free Let's Encrypt HTTPS certificate? (yes/no)" "yes"
fi
ask RAPTOR_WINGS "Install Docker + Wings on this server and add it as a node? (yes/no)" "yes"
if is_ip "$RAPTOR_FQDN"; then
    RAPTOR_CLOUDFLARE="no"
else
    ask RAPTOR_CLOUDFLARE "Is the domain proxied by Cloudflare (orange cloud)? (yes/no)" "no"
fi
RAPTOR_NODE_FQDN="${RAPTOR_NODE_FQDN:-}"
if yes_no "$RAPTOR_WINGS" && yes_no "$RAPTOR_CLOUDFLARE"; then
    info "Cloudflare only proxies HTTP(S): SFTP and game ports need a \"DNS only\" (grey cloud) record."
    info "Create e.g. node.$RAPTOR_FQDN -> $PUBLIC_IP as DNS only and enter it below, or keep the Panel"
    info "domain to run Wings on port 8443 through Cloudflare (SFTP/game ports then need the server IP)."
    ask RAPTOR_NODE_FQDN "Node domain" "$RAPTOR_FQDN"
fi
RAPTOR_NODE_FQDN="${RAPTOR_NODE_FQDN:-$RAPTOR_FQDN}"

GENERATED_PASSWORD=0
if [[ -z "$RAPTOR_ADMIN_PASSWORD" ]]; then
    RAPTOR_ADMIN_PASSWORD="$(random 20)"
    GENERATED_PASSWORD=1
fi
DB_PASSWORD="$(random 32)"

printf '\n'
info "Panel URL:     $RAPTOR_FQDN ($(yes_no "$RAPTOR_SSL" && echo https || echo http))"
info "Install from:  ${RELEASE:+release $RELEASE}${RELEASE:-git branch $BRANCH}"
info "Directory:     $DIR"
info "Admin:         $RAPTOR_ADMIN_USERNAME <$RAPTOR_EMAIL>"
info "Local Wings:   $(yes_no "$RAPTOR_WINGS" && echo "yes ($RAPTOR_NODE_FQDN)" || echo no)"
info "Cloudflare:    $(yes_no "${RAPTOR_CLOUDFLARE:-no}" && echo yes || echo no)"
ask CONFIRM "Start the installation? (yes/no)" "yes"
yes_no "$CONFIRM" || exit 1

export DEBIAN_FRONTEND=noninteractive

# Building the front-end needs ~1.5 GB of memory, which budget servers often do not have.
ensure_swap() {
    local mem_mb
    mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
    if ((mem_mb < 2000)) && ! swapon --show | grep -q .; then
        info "Only ${mem_mb} MB of RAM detected, creating a 2 GB swap file."
        run fallocate -l 2G /swapfile
        run chmod 600 /swapfile
        run mkswap /swapfile
        run swapon /swapfile
        grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
    fi
}

# ---------------------------------------------------------------------------------------------
# System packages
# ---------------------------------------------------------------------------------------------

step "Installing system packages (PHP $PHP_VERSION, MariaDB, Redis, nginx)"
run apt-get update
run apt-get install -y software-properties-common curl ca-certificates gnupg lsb-release tar unzip git cron \
    "php$PHP_VERSION" "php$PHP_VERSION"-{cli,fpm,common,gd,mysql,mbstring,bcmath,xml,curl,zip,intl,redis,sqlite3} \
    mariadb-server nginx redis-server
run systemctl enable --now mariadb redis-server nginx "php$PHP_VERSION-fpm" cron

if ! command -v composer >/dev/null; then
    info "Installing Composer"
    EXPECTED="$(curl -fsSL https://composer.github.io/installer.sig)"
    run curl -fsSL https://getcomposer.org/installer -o /tmp/composer-setup.php
    ACTUAL="$(sha384sum /tmp/composer-setup.php | awk '{print $1}')"
    [[ "$EXPECTED" == "$ACTUAL" ]] || fail "The Composer installer checksum does not match."
    run php /tmp/composer-setup.php --quiet --install-dir=/usr/local/bin --filename=composer
    rm -f /tmp/composer-setup.php
fi

# Allow larger uploads through the file manager.
for ini in "/etc/php/$PHP_VERSION/fpm/php.ini" "/etc/php/$PHP_VERSION/cli/php.ini"; do
    sed -i -E 's/^upload_max_filesize = .*/upload_max_filesize = 100M/; s/^post_max_size = .*/post_max_size = 100M/' "$ini"
done

# ---------------------------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------------------------

step "Creating the database"
mysql -u root <<SQL >>"$LOG_FILE" 2>&1
CREATE DATABASE IF NOT EXISTS panel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'raptor'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER 'raptor'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON panel.* TO 'raptor'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
info "Database 'panel' and user 'raptor' are ready."

# ---------------------------------------------------------------------------------------------
# Panel files
# ---------------------------------------------------------------------------------------------

step "Downloading Raptor Panel"
mkdir -p "$DIR"
if [[ -n "$RELEASE" ]]; then
    if [[ "$RELEASE" == "latest" ]]; then
        URL="https://github.com/$REPO/releases/latest/download/panel.tar.gz"
    else
        URL="https://github.com/$REPO/releases/download/$RELEASE/panel.tar.gz"
    fi
    info "$URL"
    run curl -fsSL "$URL" -o /tmp/raptor-panel.tar.gz
    run tar -xzf /tmp/raptor-panel.tar.gz -C "$DIR"
    rm -f /tmp/raptor-panel.tar.gz
else
    info "https://github.com/$REPO (branch $BRANCH)"
    TMP_CLONE="$(mktemp -d)"
    run git clone --depth 1 --branch "$BRANCH" "https://github.com/$REPO.git" "$TMP_CLONE"
    rm -rf "$TMP_CLONE/.git"
    cp -a "$TMP_CLONE/." "$DIR/"
    rm -rf "$TMP_CLONE"
fi
cd "$DIR"
chmod -R 755 storage/* bootstrap/cache/

step "Installing PHP dependencies"
run env COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader --no-interaction

if [[ ! -f public/build/manifest.json ]]; then
    step "Building the front-end (this takes a few minutes)"
    ensure_swap
    if ! command -v node >/dev/null || (($(node -p 'process.versions.node.split(".")[0]') < 22)); then
        info "Installing Node.js 22"
        run bash -c 'curl -fsSL https://deb.nodesource.com/setup_22.x | bash -'
        run apt-get install -y nodejs
    fi
    command -v yarn >/dev/null || run npm install -g yarn
    run yarn install --frozen-lockfile --network-timeout 600000
    run env NODE_OPTIONS=--max-old-space-size=1536 yarn build
    # The node modules are only needed to build the assets.
    rm -rf node_modules
fi

# ---------------------------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------------------------

step "Configuring the Panel"
SCHEME="http"
yes_no "$RAPTOR_SSL" && SCHEME="https"

cp .env.example .env
set_env() {
    local key="$1" value="$2"
    if grep -qE "^${key}=" .env; then
        sed -i "s|^${key}=.*|${key}=${value}|" .env
    else
        echo "${key}=${value}" >>.env
    fi
}
set_env APP_URL "$SCHEME://$RAPTOR_FQDN"
set_env APP_TIMEZONE "$RAPTOR_TIMEZONE"
set_env APP_SERVICE_AUTHOR "$RAPTOR_EMAIL"
set_env DB_USERNAME raptor
set_env DB_PASSWORD "$DB_PASSWORD"
set_env CACHE_DRIVER redis
set_env SESSION_DRIVER redis
set_env QUEUE_CONNECTION redis
set_env HASHIDS_SALT "$(random 20)"
set_env MAIL_FROM_ADDRESS "no-reply@$RAPTOR_FQDN"
# No mail server is known yet: write e-mails to the log instead of failing every notification.
# SMTP can be configured (and switched on) later in the admin area, Settings → Mail.
set_env MAIL_MAILER log
set_env MAIL_EHLO_DOMAIN "$RAPTOR_FQDN"
set_env RECAPTCHA_ENABLED false

run php artisan key:generate --force
run php artisan migrate --seed --force
run php artisan p:user:make --email="$RAPTOR_EMAIL" --username="$RAPTOR_ADMIN_USERNAME" \
    --name-first=Admin --name-last=User --password="$RAPTOR_ADMIN_PASSWORD" --admin=1 --no-interaction
run php artisan config:cache
run php artisan route:cache
run php artisan view:cache
chown -R www-data:www-data "$DIR"

step "Setting up the queue worker and scheduler"
cat >/etc/systemd/system/raptorq.service <<UNIT
[Unit]
Description=Raptor Panel Queue Worker
After=redis-server.service mariadb.service

[Service]
User=www-data
Group=www-data
Restart=always
ExecStart=/usr/bin/php $DIR/artisan queue:work --queue=high,standard,low --sleep=3 --tries=3
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
UNIT
run systemctl daemon-reload
run systemctl enable --now raptorq.service

CRON_LINE="* * * * * php $DIR/artisan schedule:run >> /dev/null 2>&1"
(crontab -u www-data -l 2>/dev/null | grep -v "artisan schedule:run" || true; echo "$CRON_LINE") | crontab -u www-data -

# ---------------------------------------------------------------------------------------------
# Webserver
# ---------------------------------------------------------------------------------------------

step "Configuring nginx"
rm -f /etc/nginx/sites-enabled/default

# Log the real visitor address for requests that come through Cloudflare. The Panel itself trusts
# the Cloudflare ranges on its own (config/trustedproxy.php).
CF_REAL_IP=""
for range in $(curl -fsS --max-time 10 https://www.cloudflare.com/ips-v4 2>/dev/null) $(curl -fsS --max-time 10 https://www.cloudflare.com/ips-v6 2>/dev/null); do
    CF_REAL_IP+="set_real_ip_from $range;"$'\n'
done
if [[ -n "$CF_REAL_IP" ]]; then
    printf '%sreal_ip_header CF-Connecting-IP;\n' "$CF_REAL_IP" >/etc/nginx/conf.d/cloudflare-real-ip.conf
fi

SERVER_NAMES="$RAPTOR_FQDN"
[[ "$RAPTOR_NODE_FQDN" != "$RAPTOR_FQDN" ]] && SERVER_NAMES+=" $RAPTOR_NODE_FQDN"
cat >/etc/nginx/sites-available/raptor.conf <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_NAMES;

    root $DIR/public;
    index index.php;

    access_log /var/log/nginx/raptor.app-access.log;
    error_log  /var/log/nginx/raptor.app-error.log error;

    client_max_body_size 100m;
    client_body_timeout 120s;
    sendfile off;

    # Serve the brotli/gzip files generated at build time instead of compressing on every request.
    gzip on;
    gzip_static on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    location /build/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php\$ {
        fastcgi_split_path_info ^(.+\.php)(/.+)\$;
        fastcgi_pass unix:/run/php/php$PHP_VERSION-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param PHP_VALUE "upload_max_filesize = 100M \n post_max_size=100M";
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_param HTTP_PROXY "";
        fastcgi_intercept_errors off;
        fastcgi_buffer_size 16k;
        fastcgi_buffers 4 16k;
        fastcgi_connect_timeout 300;
        fastcgi_send_timeout 300;
        fastcgi_read_timeout 300;
    }

    location ~ /\.ht {
        deny all;
    }
}
NGINX

# A loopback-only copy of the Panel that a local Wings uses to talk to it. This keeps Wings
# independent from DNS, Cloudflare (challenges, Bot Fight Mode) and certificate renewals.
cat >/etc/nginx/sites-available/raptor-local.conf <<NGINX
server {
    listen 127.0.0.1:8090;
    server_name _;
    root $DIR/public;
    index index.php;
    client_max_body_size 100m;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php\$ {
        fastcgi_pass unix:/run/php/php$PHP_VERSION-fpm.sock;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_param HTTP_PROXY "";
        fastcgi_read_timeout 300;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/raptor.conf /etc/nginx/sites-enabled/raptor.conf
ln -sf /etc/nginx/sites-available/raptor-local.conf /etc/nginx/sites-enabled/raptor-local.conf
run nginx -t
run systemctl reload nginx

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
    info "ufw is active, opening ports 80 and 443"
    run ufw allow 80/tcp
    run ufw allow 443/tcp
fi

if yes_no "$RAPTOR_SSL"; then
    step "Requesting a Let's Encrypt certificate"
    run apt-get install -y certbot python3-certbot-nginx
    CERT_DOMAINS=(-d "$RAPTOR_FQDN")
    [[ "$RAPTOR_NODE_FQDN" != "$RAPTOR_FQDN" ]] && CERT_DOMAINS+=(-d "$RAPTOR_NODE_FQDN")
    yes_no "${RAPTOR_CLOUDFLARE:-no}" && info "Behind Cloudflare: set SSL/TLS mode to \"Full (strict)\" once the certificate is issued."
    if certbot --nginx "${CERT_DOMAINS[@]}" --cert-name "$RAPTOR_FQDN" --redirect --non-interactive --agree-tos -m "$RAPTOR_EMAIL" >>"$LOG_FILE" 2>&1; then
        info "HTTPS is enabled, certificates renew automatically."
    else
        warn "Could not get a certificate. Make sure the domain points to $PUBLIC_IP and port 80 is open."
        warn "The Panel will run over plain HTTP for now, run 'certbot --nginx -d $RAPTOR_FQDN' later."
        if yes_no "${RAPTOR_CLOUDFLARE:-no}"; then
            warn "Behind Cloudflare: set SSL/TLS to \"Flexible\" and turn off \"Always Use HTTPS\" while requesting"
            warn "the certificate, then switch back to \"Full (strict)\". On Google Cloud / AWS / Oracle also open"
            warn "ports 80 and 443 in the provider firewall."
        fi
        SCHEME="http"
        RAPTOR_SSL="no"
        cd "$DIR"
        set_env APP_URL "http://$RAPTOR_FQDN"
        run php artisan config:cache
    fi
fi

# ---------------------------------------------------------------------------------------------
# Wings
# ---------------------------------------------------------------------------------------------

if yes_no "$RAPTOR_WINGS"; then
    step "Installing Docker"
    if ! command -v docker >/dev/null; then
        run bash -c 'curl -fsSL https://get.docker.com | CHANNEL=stable sh'
    fi
    run systemctl enable --now docker

    step "Installing Wings"
    mkdir -p /etc/pterodactyl /var/lib/pterodactyl/volumes
    run curl -fsSL -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_$ARCH"
    chmod u+x /usr/local/bin/wings

    step "Registering this server as a node"
    cd "$DIR"
    MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
    # Leave some room for the Panel, the database and the operating system.
    NODE_MEM=$((MEM_MB > 2048 ? MEM_MB - 1024 : MEM_MB))
    DISK_MB=$(df -m --output=avail /var/lib/pterodactyl | tail -1 | tr -d ' ')
    NODE_DISK=$((DISK_MB > 10240 ? DISK_MB - 5120 : DISK_MB))

    run php artisan p:location:make --short=local --long="This server" --no-interaction
    LOCATION_ID=$(mysql -N -u root panel -e "SELECT id FROM locations WHERE short='local' ORDER BY id DESC LIMIT 1")
    # Cloudflare does not proxy port 8080 over HTTPS, 8443 is one of the ports it does support.
    DAEMON_PORT=8080
    if yes_no "${RAPTOR_CLOUDFLARE:-no}" && [[ "$RAPTOR_NODE_FQDN" == "$RAPTOR_FQDN" ]]; then
        DAEMON_PORT=8443
    fi

    run php artisan p:node:make --name="Local node" --description="Wings running next to the Panel" \
        --locationId="$LOCATION_ID" --fqdn="$RAPTOR_NODE_FQDN" --public=1 --scheme="$SCHEME" --proxy=0 --maintenance=0 \
        --maxMemory="$NODE_MEM" --overallocateMemory=0 --maxDisk="$NODE_DISK" --overallocateDisk=0 \
        --uploadSize=100 --daemonListeningPort="$DAEMON_PORT" --daemonSFTPPort=2022 --daemonBase=/var/lib/pterodactyl/volumes \
        --no-interaction
    NODE_ID=$(mysql -N -u root panel -e "SELECT id FROM nodes WHERE name='Local node' ORDER BY id DESC LIMIT 1")

    # Create allocations for the requested port range so servers can be deployed immediately.
    PORTS="${RAPTOR_PORTS:-25565-25600}"
    PORT_START="${PORTS%-*}"
    PORT_END="${PORTS#*-}"
    VALUES=""
    # Players cannot connect to game ports through Cloudflare, show them the server IP instead.
    ALLOC_ALIAS="$RAPTOR_NODE_FQDN"
    [[ "$DAEMON_PORT" == "8443" ]] && ALLOC_ALIAS="$PUBLIC_IP"
    for ((port = PORT_START; port <= PORT_END; port++)); do
        VALUES+="${VALUES:+,}($NODE_ID,'0.0.0.0','$ALLOC_ALIAS',$port,NOW(),NOW())"
    done
    mysql -u root panel -e "INSERT IGNORE INTO allocations (node_id, ip, ip_alias, port, created_at, updated_at) VALUES $VALUES" >>"$LOG_FILE" 2>&1
    info "Node #$NODE_ID created with ${NODE_MEM} MB RAM, ${NODE_DISK} MB disk and ports $PORTS."

    php artisan p:node:configuration "$NODE_ID" --format=yaml >/etc/pterodactyl/config.yml
    # Talk to the Panel over the loopback listener instead of the public URL.
    sed -i -E "s|^remote: .*|remote: 'http://127.0.0.1:8090'|" /etc/pterodactyl/config.yml
    # Wings only accepts browser requests from its "remote", which is now the loopback address, so the
    # public Panel URL has to be allowed explicitly or the console and file manager are blocked (CORS).
    sed -i -E "s|^allowed_origins: .*|allowed_origins: ['$SCHEME://$RAPTOR_FQDN']|" /etc/pterodactyl/config.yml
    grep -q '^allowed_origins:' /etc/pterodactyl/config.yml || echo "allowed_origins: ['$SCHEME://$RAPTOR_FQDN']" >>/etc/pterodactyl/config.yml
    # A single certificate covers both domains, it is stored under the Panel domain.
    sed -i "s|/etc/letsencrypt/live/$RAPTOR_NODE_FQDN/|/etc/letsencrypt/live/$RAPTOR_FQDN/|g" /etc/pterodactyl/config.yml
    chmod 600 /etc/pterodactyl/config.yml

    cat >/etc/systemd/system/wings.service <<UNIT
[Unit]
Description=Pterodactyl Wings Daemon
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
User=root
WorkingDirectory=/etc/pterodactyl
LimitNOFILE=4096
PIDFile=/var/run/wings/daemon.pid
ExecStart=/usr/local/bin/wings
Restart=on-failure
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
UNIT
    run systemctl daemon-reload
    run systemctl enable --now wings

    # Wings only reads its certificate on start, restart it whenever certbot renews it.
    if [[ -d /etc/letsencrypt ]]; then
        mkdir -p /etc/letsencrypt/renewal-hooks/deploy
        printf '#!/bin/sh\nsystemctl restart wings\n' >/etc/letsencrypt/renewal-hooks/deploy/restart-wings.sh
        chmod +x /etc/letsencrypt/renewal-hooks/deploy/restart-wings.sh
    fi

    if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
        info "Opening Wings ports $DAEMON_PORT, 2022 and $PORTS"
        run ufw allow "$DAEMON_PORT/tcp"
        run ufw allow 2022/tcp
        run ufw allow "${PORT_START}:${PORT_END}/tcp"
        run ufw allow "${PORT_START}:${PORT_END}/udp"
    fi
fi

# ---------------------------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------------------------

cat >"$CREDENTIALS_FILE" <<CREDS
Raptor Panel - installed $(date -u '+%Y-%m-%d %H:%M UTC')

Panel URL:        $SCHEME://$RAPTOR_FQDN
Admin username:   $RAPTOR_ADMIN_USERNAME
Admin email:      $RAPTOR_EMAIL
Admin password:   $RAPTOR_ADMIN_PASSWORD

Database:         panel
Database user:    raptor
Database pass:    $DB_PASSWORD

Install path:     $DIR
Install log:      $LOG_FILE
CREDS
chmod 600 "$CREDENTIALS_FILE"

trap - ERR
printf '\n%s✔ Raptor Panel is installed!%s\n\n' "$GREEN$BOLD" "$RESET"
printf '   Open      %s%s://%s%s\n' "$BOLD" "$SCHEME" "$RAPTOR_FQDN" "$RESET"
printf '   Login     %s\n' "$RAPTOR_ADMIN_USERNAME"
if ((GENERATED_PASSWORD)); then
    printf '   Password  %s%s%s  (generated)\n' "$BOLD" "$RAPTOR_ADMIN_PASSWORD" "$RESET"
fi
printf '\n   All credentials were saved to %s\n' "$CREDENTIALS_FILE"
if yes_no "$RAPTOR_WINGS"; then
    printf '   Wings is running as "Local node". Check it with: systemctl status wings\n'
fi
if yes_no "${RAPTOR_CLOUDFLARE:-no}"; then
    printf '\n   %sCloudflare checklist%s\n' "$BOLD" "$RESET"
    printf '   • SSL/TLS mode: Full (strict)\n'
    printf '   • Network → WebSockets: enabled (default)\n'
    if [[ "$RAPTOR_NODE_FQDN" == "$RAPTOR_FQDN" ]] && yes_no "$RAPTOR_WINGS"; then
        printf '   • Wings listens on 8443 so it works through the orange cloud; SFTP (2022) and game ports\n'
        printf '     are not proxied by Cloudflare, players and SFTP clients must use %s directly.\n' "$PUBLIC_IP"
    elif yes_no "$RAPTOR_WINGS"; then
        printf '   • %s must stay "DNS only" (grey cloud) for SFTP and game connections.\n' "$RAPTOR_NODE_FQDN"
    fi
fi
printf '   Configure email sending in the admin area: Settings → Mail.\n\n'
