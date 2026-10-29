#!/usr/bin/env bash
#
# Moves an existing Pterodactyl Panel to Raptor Panel without losing any data.
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/brocker96/raptor-panel/0.x_beta/migrate.sh)
#
# Raptor Panel uses the same database schema, so the migration keeps the database, the .env file
# (including APP_KEY, which every stored secret is encrypted with) and everything in it: users,
# servers, nodes, eggs, API keys, schedules, backups and activity. Wings and game servers keep
# running and do not need to be touched.
#
# How it works:
#   1. Raptor Panel is installed next to the old Panel (default /var/www/raptor), the old files
#      are never changed.
#   2. A backup of the database, the old Panel directory, the web server configuration, the queue
#      worker service and the cron job is written to /var/backups/raptor-migration/<id>.
#   3. The old Panel goes into maintenance mode, the database is migrated, the web server, queue
#      worker (pteroq -> raptorq) and cron job are switched to the new directory.
#   4. The Panel is checked over HTTP. If anything fails, everything is rolled back automatically.
#
# Rolling back later restores the database and the old configuration and brings Pterodactyl back:
#
#   bash migrate.sh --rollback            # newest migration backup
#   bash migrate.sh --rollback <id>       # a specific one, see --list
#
# Variables:
#   PTERODACTYL_DIR   Directory of the Pterodactyl Panel (default: /var/www/pterodactyl).
#   RAPTOR_DIR        Directory Raptor Panel is installed to (default: /var/www/raptor).
#   RAPTOR_BRANCH     Git branch to install from (default: 0.x_beta).
#   RAPTOR_RELEASE    Install a pre-built release instead, e.g. "latest" or "v1.0.0".
#   RAPTOR_SOURCE     Copy Raptor Panel from this local directory instead of downloading it.
#   RAPTOR_YES=1      Do not ask for confirmation.

set -Eeuo pipefail

REPO="brocker96/raptor-panel"
BRANCH="${RAPTOR_BRANCH:-0.x_beta}"
RELEASE="${RAPTOR_RELEASE:-}"
OLD="${PTERODACTYL_DIR:-/var/www/pterodactyl}"
DIR="${RAPTOR_DIR:-/var/www/raptor}"
BACKUP_ROOT="${RAPTOR_BACKUP_ROOT:-/var/backups/raptor-migration}"
LOG_FILE="/var/log/raptor-migrate.log"

if [[ -t 1 ]]; then
    GREEN=$'\e[38;5;76m'; DIM=$'\e[2m'; BOLD=$'\e[1m'; RED=$'\e[31m'; YELLOW=$'\e[33m'; RESET=$'\e[0m'
else
    GREEN=""; DIM=""; BOLD=""; RED=""; YELLOW=""; RESET=""
fi

STEP=0
step() { STEP=$((STEP + 1)); printf '\n%s[%02d]%s %s%s%s\n' "$GREEN" "$STEP" "$RESET" "$BOLD" "$*" "$RESET"; }
info() { printf '     %s%s%s\n' "$DIM" "$*" "$RESET"; }
warn() { printf '     %s! %s%s\n' "$YELLOW" "$*" "$RESET"; }
die() { printf '\n%s✖ %s%s\n' "$RED" "$*" "$RESET" >&2; exit 1; }

# Set once the live system was changed, from then on a failure triggers the automatic rollback.
SWITCHING=0
BACKUP=""
CREATED_DIR=0

on_error() {
    local line="$1"
    trap - ERR
    if [[ "$SWITCHING" == "1" && -n "$BACKUP" ]]; then
        printf '\n%s✖ The migration failed on line %s, rolling back automatically…%s\n' "$RED" "$line" "$RESET" >&2
        rollback "$BACKUP" || die "The rollback failed as well. Restore manually from $BACKUP_ROOT/$BACKUP (see README in that folder)."
        die "The migration failed and Pterodactyl was restored. Nothing was lost, the log is at $LOG_FILE."
    fi
    # Nothing was switched yet, remove the half installed copy so the script can simply run again.
    [[ "$CREATED_DIR" == "1" ]] && rm -rf "$DIR"
    die "Aborted on line $line before anything was changed. The log is at $LOG_FILE."
}
trap 'on_error $LINENO' ERR

# Passwords and tokens passed as arguments never reach the log or the screen.
redact() { sed -E 's/(--(password|token)[= ])[^ ]+/\1***/g' <<<"$*"; }

run() {
    echo "+ $(redact "$*")" >>"$LOG_FILE"
    if ! "$@" >>"$LOG_FILE" 2>&1; then
        echo "! command failed: $(redact "$*")" >>"$LOG_FILE"
        tail -n 15 "$LOG_FILE" | sed 's/^/       /' >&2
        return 1
    fi
}

confirm() {
    [[ "${RAPTOR_YES:-}" == "1" ]] && return 0
    [[ -t 0 ]] || die "Run this script in an interactive terminal or set RAPTOR_YES=1."
    local answer
    read -r -p "     $1 (yes/no) [no]: " answer
    [[ "${answer,,}" =~ ^(y|yes)$ ]]
}

# Reads a value from a .env file, without quotes.
env_get() {
    local value
    value="$(grep -E "^$1=" "$2" | tail -n1 | cut -d= -f2- || true)"
    value="${value%\"}"; value="${value#\"}"; value="${value%\'}"; value="${value#\'}"
    printf '%s' "$value"
}

systemd_running() { [[ -d /run/systemd/system ]]; }

reload_webserver() {
    case "$1" in
        nginx)
            run nginx -t
            if systemd_running; then run systemctl reload nginx; else run nginx -s reload; fi
            ;;
        apache)
            run apachectl configtest
            if systemd_running; then run systemctl reload apache2; else run apachectl graceful; fi
            ;;
    esac
}

mysql_args() {
    # mysql_args <env file>
    local host port socket
    host="$(env_get DB_HOST "$1")"; port="$(env_get DB_PORT "$1")"; socket="$(env_get DB_SOCKET "$1")"
    MYSQL_ARGS=("--user=$(env_get DB_USERNAME "$1")")
    if [[ -n "$socket" ]]; then MYSQL_ARGS+=("--socket=$socket"); else MYSQL_ARGS+=("--host=${host:-127.0.0.1}" "--port=${port:-3306}"); fi
    export MYSQL_PWD
    MYSQL_PWD="$(env_get DB_PASSWORD "$1")"
    DB_NAME="$(env_get DB_DATABASE "$1")"
}

# ---------------------------------------------------------------------------------------------
# Rollback
# ---------------------------------------------------------------------------------------------

rollback() {
    local id="$1" b="$BACKUP_ROOT/$1"
    [[ -f "$b/meta.env" ]] || die "Backup $id does not exist, see: bash migrate.sh --list"
    # shellcheck disable=SC1091
    . "$b/meta.env"

    step "Rolling back migration $id"
    info "Stopping the Raptor queue worker"
    if systemd_running; then
        systemctl disable --now raptorq.service >>"$LOG_FILE" 2>&1 || true
        rm -f /etc/systemd/system/raptorq.service
    fi

    if [[ ! -f "$M_OLD/artisan" ]]; then
        info "Restoring the Pterodactyl files"
        mkdir -p "$(dirname "$M_OLD")"
        run tar -xzf "$b/pterodactyl-files.tar.gz" -C "$(dirname "$M_OLD")"
    fi

    info "Restoring the database"
    mysql_args "$M_OLD/.env"
    # Tables added by Raptor are not part of the dump, empty the database first.
    local drop
    drop="$(mysql "${MYSQL_ARGS[@]}" -N -e "SELECT CONCAT('DROP TABLE IF EXISTS \`', table_name, '\`;') FROM information_schema.tables WHERE table_schema = '$DB_NAME'" 2>>"$LOG_FILE")"
    run mysql "${MYSQL_ARGS[@]}" "$DB_NAME" -e "SET FOREIGN_KEY_CHECKS=0; $drop SET FOREIGN_KEY_CHECKS=1;"
    gunzip -c "$b/database.sql.gz" | mysql "${MYSQL_ARGS[@]}" "$DB_NAME" 2>>"$LOG_FILE" || die "Importing $b/database.sql.gz failed."

    info "Restoring the web server configuration"
    if [[ -d "$b/etc" ]]; then
        cp -a "$b/etc/." /etc/
    fi
    reload_webserver "$M_WEBSERVER"

    if systemd_running && [[ -n "$M_QUEUE_UNITS" ]]; then
        info "Starting the Pterodactyl queue worker"
        run systemctl daemon-reload
        for unit in $M_QUEUE_UNITS; do run systemctl enable --now "$unit"; done
    fi

    if [[ -f "$b/crontab.txt" ]]; then
        info "Restoring the cron job"
        run crontab -u "$M_WEB_USER" "$b/crontab.txt"
    fi

    run php "$M_OLD/artisan" optimize:clear
    run php "$M_OLD/artisan" up

    if [[ -d "$M_DIR" ]]; then
        local aside
        aside="$M_DIR.rolled-back-$(date +%Y%m%d-%H%M%S)"
        mv "$M_DIR" "$aside"
        info "Raptor Panel was moved to $aside, delete it when you no longer need it."
    fi

    printf '\n%s✔ Pterodactyl is back online with the database of %s.%s\n' "$GREEN" "$id" "$RESET"
}

latest_backup() { ls -1 "$BACKUP_ROOT" 2>/dev/null | sort | tail -n1; }

case "${1:-}" in
    --list)
        printf 'Migration backups in %s:\n' "$BACKUP_ROOT"
        for b in $(ls -1 "$BACKUP_ROOT" 2>/dev/null | sort); do
            printf '  %s  %s\n' "$b" "$(du -sh "$BACKUP_ROOT/$b" | cut -f1)"
        done
        exit 0
        ;;
    --rollback)
        [[ $EUID -eq 0 ]] || die "Run this script as root (sudo -i)."
        : >>"$LOG_FILE"
        ID="${2:-$(latest_backup)}"
        [[ -n "$ID" ]] || die "There is no migration backup in $BACKUP_ROOT."
        printf '%sThis restores the database of backup %s and switches the web server back to Pterodactyl.%s\n' "$BOLD" "$ID" "$RESET"
        printf 'Everything changed in the Panel after the migration (new users, servers, settings) is lost.\n'
        confirm "Roll back now?" || exit 1
        rollback "$ID"
        exit 0
        ;;
    --help | -h)
        sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'
        exit 0
        ;;
    "") ;;
    *) die "Unknown option $1, see --help." ;;
esac

# ---------------------------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------------------------

cat <<'BANNER'

   ____             _              ____                  _
  |  _ \ __ _ _ __ | |_ ___  _ __ |  _ \ __ _ _ __   ___| |
  | |_) / _` | '_ \| __/ _ \| '__|| |_) / _` | '_ \ / _ \ |
  |  _ < (_| | |_) | || (_) | |   |  __/ (_| | | | |  __/ |
  |_| \_\__,_| .__/ \__\___/|_|   |_|   \__,_|_| |_|\___|_|
             |_|              migration from Pterodactyl

BANNER

[[ $EUID -eq 0 ]] || die "Run this script as root (sudo -i)."
: >"$LOG_FILE"
chmod 600 "$LOG_FILE"

step "Checking the Pterodactyl installation"
[[ -f "$OLD/artisan" && -f "$OLD/.env" ]] || die "No Pterodactyl Panel found in $OLD. Set PTERODACTYL_DIR to its directory."
grep -q '"pterodactyl/panel"' "$OLD/composer.json" 2>/dev/null || die "$OLD does not contain a Pterodactyl Panel."
[[ ! -e "$DIR/.env" ]] || die "$DIR already contains a Panel. Move it away or set RAPTOR_DIR to another directory."
OLD_VERSION="$(grep -oE "'version' => '[^']+'" "$OLD/config/app.php" | cut -d"'" -f4 || true)"
info "Pterodactyl ${OLD_VERSION:-unknown version} in $OLD"
case "$OLD_VERSION" in
    1.*|canary|develop) ;;
    *) die "Only Pterodactyl 1.x can be migrated (found ${OLD_VERSION:-unknown}). Upgrade it to the latest 1.x first." ;;
esac

PHP_ID="$(php -r 'echo PHP_VERSION_ID;')"
((PHP_ID >= 80200)) || die "Raptor Panel needs PHP 8.2 or newer, $(php -r 'echo PHP_VERSION;') is installed. Install PHP 8.3 (see the README) and run the migration again."
for ext in bcmath curl gd mbstring mysql xml zip intl; do
    php -m | grep -qi "^${ext/mysql/pdo_mysql}$" || die "The PHP extension $ext is missing (apt install php$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')-$ext)."
done
for binary in mysqldump mysql tar gzip curl; do
    command -v "$binary" >/dev/null || die "The command $binary is required."
done
command -v composer >/dev/null || die "Composer is required, it was used to install Pterodactyl as well."

WEB_USER="$(stat -c %U "$OLD/public")"
WEB_GROUP="$(stat -c %G "$OLD/public")"
info "Web server user: $WEB_USER"

WEBSERVER=""
WEB_CONFIGS=""
for f in /etc/nginx/sites-available/* /etc/nginx/conf.d/*.conf; do
    [[ -f "$f" ]] && grep -q "$OLD" "$f" && WEB_CONFIGS+="$f " && WEBSERVER="nginx"
done
if [[ -z "$WEBSERVER" ]]; then
    for f in /etc/apache2/sites-available/*; do
        [[ -f "$f" ]] && grep -q "$OLD" "$f" && WEB_CONFIGS+="$f " && WEBSERVER="apache"
    done
fi
[[ -n "$WEBSERVER" ]] || die "No nginx or Apache configuration pointing to $OLD was found."
info "Web server: $WEBSERVER ($WEB_CONFIGS)"

QUEUE_UNITS=""
UNIT_FILES=""
for f in /etc/systemd/system/*.service; do
    if [[ -f "$f" ]] && grep -q "$OLD/artisan queue:work" "$f"; then
        QUEUE_UNITS+="$(basename "$f") "
        UNIT_FILES+="$f "
    fi
done
info "Queue worker: ${QUEUE_UNITS:-none found}"

CRONTAB="$(crontab -u "$WEB_USER" -l 2>/dev/null || true)"
grep -q "$OLD/artisan schedule:run" <<<"$CRONTAB" && info "Scheduler cron job of $WEB_USER found" || warn "No scheduler cron job found for $WEB_USER, one is created."

mysql_args "$OLD/.env"
mysql "${MYSQL_ARGS[@]}" "$DB_NAME" -e 'SELECT 1' >/dev/null 2>>"$LOG_FILE" || die "Could not connect to the database $DB_NAME with the credentials from $OLD/.env."
SERVERS="$(mysql "${MYSQL_ARGS[@]}" "$DB_NAME" -N -e 'SELECT COUNT(*) FROM servers')"
USERS="$(mysql "${MYSQL_ARGS[@]}" "$DB_NAME" -N -e 'SELECT COUNT(*) FROM users')"
info "Database $DB_NAME: $USERS users, $SERVERS servers"

FREE_MB="$(df -Pm "$(dirname "$DIR")" | awk 'NR==2 {print $4}')"
((FREE_MB > 2048)) || die "At least 2 GB of free disk space is needed, $FREE_MB MB are available."

APP_URL="$(env_get APP_URL "$OLD/.env")"

printf '\n%sPlan%s\n' "$BOLD" "$RESET"
info "1. Install Raptor Panel into $DIR (Pterodactyl stays untouched in $OLD)"
info "2. Back up the database, $OLD and the configuration to $BACKUP_ROOT"
info "3. Short maintenance window: migrate the database and switch $WEBSERVER, the queue worker and cron"
info "4. Check $APP_URL and roll back automatically if it does not respond"
info "Wings, nodes and game servers keep running. Users stay, sessions are signed out once."
printf '\n'
confirm "Start the migration?" || exit 1

# ---------------------------------------------------------------------------------------------
# Install Raptor Panel next to Pterodactyl
# ---------------------------------------------------------------------------------------------

step "Downloading Raptor Panel"
[[ -d "$DIR" ]] || CREATED_DIR=1
mkdir -p "$DIR"
if [[ -n "${RAPTOR_SOURCE:-}" ]]; then
    info "Copying $RAPTOR_SOURCE"
    run tar -cf /tmp/raptor-source.tar -C "$RAPTOR_SOURCE" --exclude=./.git --exclude=./node_modules --exclude=./vendor --exclude=./.env --exclude=./storage/logs --exclude=./storage/app/raptor .
    run tar -xf /tmp/raptor-source.tar -C "$DIR"
    rm -f /tmp/raptor-source.tar
elif [[ -n "$RELEASE" ]]; then
    if [[ "$RELEASE" == "latest" ]]; then URL="https://github.com/$REPO/releases/latest/download/panel.tar.gz"; else URL="https://github.com/$REPO/releases/download/$RELEASE/panel.tar.gz"; fi
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

step "Copying the configuration"
cp -a "$OLD/.env" "$DIR/.env"
# Files stored by the Panel itself (not game server files, those live on the nodes).
if [[ -d "$OLD/storage/app" ]]; then
    cp -a "$OLD/storage/app/." "$DIR/storage/app/"
fi
info "APP_KEY and all settings were taken over from $OLD/.env"

step "Installing PHP dependencies"
cd "$DIR"
run env COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader --no-interaction

if [[ ! -f public/build/manifest.json ]]; then
    step "Building the front-end (this takes a few minutes)"
    if ! command -v node >/dev/null || (($(node -p 'process.versions.node.split(".")[0]') < 22)); then
        info "Installing Node.js 22"
        run bash -c 'curl -fsSL https://deb.nodesource.com/setup_22.x | bash -'
        run apt-get install -y nodejs
    fi
    command -v yarn >/dev/null || run npm install -g yarn
    run yarn install --frozen-lockfile --network-timeout 600000
    run env NODE_OPTIONS=--max-old-space-size=1536 yarn build
    rm -rf node_modules
fi
chmod -R 755 storage/* bootstrap/cache/
chown -R "$WEB_USER:$WEB_GROUP" "$DIR"

# ---------------------------------------------------------------------------------------------
# Backup
# ---------------------------------------------------------------------------------------------

step "Backing up Pterodactyl"
BACKUP="$(date +%Y%m%d-%H%M%S)"
B="$BACKUP_ROOT/$BACKUP"
mkdir -p "$B"
chmod 700 "$BACKUP_ROOT" "$B"

info "Enabling maintenance mode on the old Panel"
run php "$OLD/artisan" down
if systemd_running; then
    for unit in $QUEUE_UNITS; do run systemctl stop "$unit"; done
fi
SWITCHING=1

cat >"$B/meta.env" <<META
M_OLD="$OLD"
M_DIR="$DIR"
M_WEB_USER="$WEB_USER"
M_WEBSERVER="$WEBSERVER"
M_QUEUE_UNITS="$QUEUE_UNITS"
M_VERSION="$OLD_VERSION"
META

info "Database $DB_NAME"
mysqldump "${MYSQL_ARGS[@]}" --single-transaction --quick --routines --no-tablespaces "$DB_NAME" 2>>"$LOG_FILE" | gzip >"$B/database.sql.gz"

info "Files of $OLD"
run tar -czf "$B/pterodactyl-files.tar.gz" -C "$(dirname "$OLD")" --exclude="$(basename "$OLD")/storage/logs" "$(basename "$OLD")"

info "Web server, queue worker and cron configuration"
for f in $WEB_CONFIGS $UNIT_FILES; do
    mkdir -p "$B/etc$(dirname "${f#/etc}")"
    cp -a "$f" "$B/etc${f#/etc}"
done
printf '%s\n' "$CRONTAB" >"$B/crontab.txt"

cat >"$B/README" <<README
Backup made by migrate.sh before switching $OLD (Pterodactyl $OLD_VERSION) to Raptor Panel.

  database.sql.gz           full dump of the database "$DB_NAME"
  pterodactyl-files.tar.gz  the old Panel directory including .env
  etc/                      web server and queue worker configuration
  crontab.txt               crontab of $WEB_USER

Restore everything with:  bash migrate.sh --rollback $BACKUP
README
info "Stored in $B ($(du -sh "$B" | cut -f1))"

# ---------------------------------------------------------------------------------------------
# Switch
# ---------------------------------------------------------------------------------------------

step "Migrating the database"
run runuser -u "$WEB_USER" -- php "$DIR/artisan" migrate --force
# Pterodactyl grants treat "_" in database names as a wildcard, narrow them to the one database.
runuser -u "$WEB_USER" -- php "$DIR/artisan" raptor:database:repair-grants >>"$LOG_FILE" 2>&1 \
    || warn "Some database grants could not be repaired, run: php artisan raptor:database:repair-grants"
run runuser -u "$WEB_USER" -- php "$DIR/artisan" optimize:clear
# Only the default name is changed, a name chosen by the owner is kept.
if [[ "$(env_get APP_NAME "$DIR/.env")" == "Pterodactyl" ]]; then
    sed -i 's/^APP_NAME=.*/APP_NAME="Raptor Panel"/' "$DIR/.env"
    info "The Panel name was changed from the default \"Pterodactyl\" to \"Raptor Panel\""
fi
mysql "${MYSQL_ARGS[@]}" "$DB_NAME" -e "UPDATE settings SET value = 'Raptor Panel' WHERE \`key\` = 'settings::app:name' AND value = 'Pterodactyl'" 2>>"$LOG_FILE" || true

step "Switching $WEBSERVER to Raptor Panel"
for f in $WEB_CONFIGS; do
    sed -i "s#$OLD/#$DIR/#g; s#$OLD\\b#$DIR#g" "$f"
done
reload_webserver "$WEBSERVER"

step "Switching the queue worker and scheduler"
if systemd_running; then
    for unit in $QUEUE_UNITS; do run systemctl disable "$unit"; done
    PHP_BIN="$(command -v php)"
    cat >/etc/systemd/system/raptorq.service <<UNIT
[Unit]
Description=Raptor Panel Queue Worker
After=redis-server.service mariadb.service mysql.service

[Service]
User=$WEB_USER
Group=$WEB_GROUP
Restart=always
ExecStart=$PHP_BIN $DIR/artisan queue:work --queue=high,standard,low --sleep=3 --tries=3
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
UNIT
    run systemctl daemon-reload
    run systemctl enable --now raptorq.service
    info "pteroq was replaced by raptorq.service"
else
    warn "systemd is not running, start the queue worker yourself: php $DIR/artisan queue:work"
fi

CRON_LINE="* * * * * php $DIR/artisan schedule:run >> /dev/null 2>&1"
(grep -v "artisan schedule:run" <<<"$CRONTAB" || true; echo "$CRON_LINE") | sed '/^$/d' | crontab -u "$WEB_USER" -
info "Cron: $CRON_LINE"

step "Checking the Panel"
HOST="$(sed -E 's#^https?://##; s#[:/].*$##' <<<"$APP_URL")"
CODE="000"
for _ in 1 2 3 4 5; do
    # Through the local web server, so neither DNS nor a proxy such as Cloudflare is involved.
    CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -H "Host: $HOST" "http://127.0.0.1/auth/login" || true)"
    [[ "$CODE" =~ ^(200|301|302)$ ]] && break
    CODE="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 15 --resolve "$HOST:443:127.0.0.1" "https://$HOST/auth/login" || true)"
    [[ "$CODE" =~ ^(200|301|302)$ ]] && break
    sleep 3
done
if [[ ! "$CODE" =~ ^(200|301|302)$ ]]; then
    echo "Health check of http://$HOST/auth/login returned HTTP $CODE" >>"$LOG_FILE"
    printf '     %sThe Panel answered with HTTP %s.%s\n' "$RED" "$CODE" "$RESET"
    false
fi
info "http://$HOST/auth/login answered with HTTP $CODE"
SWITCHING=0

cat <<DONE

${GREEN}${BOLD}✔ Pterodactyl was migrated to Raptor Panel.${RESET}

   Panel:     $APP_URL
   Directory: $DIR
   Backup:    $B

   All users, servers, nodes and settings were kept. Everybody has to sign in once again.
   Wings does not need any change.

   Something wrong? Bring Pterodactyl back with:
     bash $DIR/migrate.sh --rollback $BACKUP

   When everything works you can delete the old directory $OLD
   (a copy stays in the backup).

DONE
