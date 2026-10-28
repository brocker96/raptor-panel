#!/usr/bin/env bash
#
# Raptor Wings installer for a clean node server (Ubuntu 22.04/24.04, Debian 11/12).
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/brocker96/raptor-panel/0.x_beta/wings.sh)
#
# Raptor Wings is the Pterodactyl® Wings daemon (MIT licensed, https://github.com/pterodactyl/wings)
# installed, configured and managed the Raptor way: Docker, Wings, a Let's Encrypt certificate,
# the firewall, automatic configuration from the Panel and the "raptor-wings" helper command.
#
# The quickest way: open Admin → Nodes → your node → Configuration in Raptor Panel, click
# "Install command" and run the line it shows on the new server. It looks like:
#
#   bash <(curl -fsSL .../wings.sh) --panel-url https://panel.example.com --token ptla_xxx --node 3
#
# Every question can also be answered through flags or environment variables:
#   --panel-url  RAPTOR_PANEL_URL   URL of the Panel, e.g. https://panel.example.com
#   --token      RAPTOR_TOKEN       Application API key from the auto deploy command.
#   --node       RAPTOR_NODE_ID     ID of the node in the Panel.
#   --fqdn       RAPTOR_NODE_FQDN   Domain of this node for the HTTPS certificate (or its IP).
#   --email      RAPTOR_EMAIL       Email for Let's Encrypt.
#   --ssl        RAPTOR_SSL         yes/no - request a Let's Encrypt certificate (default: yes for domains).
#   --ports      RAPTOR_PORTS       Game port range to open in the firewall (default: 25565-25600).
#   --firewall   RAPTOR_FIREWALL    yes/no - configure ufw (default: yes).
#   --version    RAPTOR_WINGS_VERSION  Wings release to install (default: latest).
#   --insecure   RAPTOR_INSECURE=1  Allow a Panel without a valid certificate (testing only).
#   --yes        RAPTOR_YES=1       Do not ask for confirmation.
#   --uninstall                     Remove Wings (server data in /var/lib/pterodactyl is kept).

set -Eeuo pipefail

REPO="brocker96/raptor-panel"
BRANCH="${RAPTOR_BRANCH:-0.x_beta}"
LOG_FILE="/var/log/raptor-wings-install.log"
CONFIG_DIR="/etc/pterodactyl"
DATA_DIR="/var/lib/pterodactyl"

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

run() {
    echo "+ $*" >>"$LOG_FILE"
    if ! "$@" >>"$LOG_FILE" 2>&1; then
        fail "Command failed: $*  (see $LOG_FILE for details)"
    fi
}

trap 'fail "Installation aborted on line $LINENO. The full log is available at $LOG_FILE."' ERR

ask() {
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
is_ip() { [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; }

# ---------------------------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------------------------

UNINSTALL=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --panel-url) RAPTOR_PANEL_URL="$2"; shift 2 ;;
        --token) RAPTOR_TOKEN="$2"; shift 2 ;;
        --node) RAPTOR_NODE_ID="$2"; shift 2 ;;
        --fqdn) RAPTOR_NODE_FQDN="$2"; shift 2 ;;
        --email) RAPTOR_EMAIL="$2"; shift 2 ;;
        --ssl) RAPTOR_SSL="$2"; shift 2 ;;
        --ports) RAPTOR_PORTS="$2"; shift 2 ;;
        --firewall) RAPTOR_FIREWALL="$2"; shift 2 ;;
        --version) RAPTOR_WINGS_VERSION="$2"; shift 2 ;;
        --insecure) RAPTOR_INSECURE=1; shift ;;
        --yes | -y) RAPTOR_YES=1; shift ;;
        --uninstall) UNINSTALL=1; shift ;;
        -h | --help)
            echo "Usage: wings.sh [--panel-url URL --token KEY --node ID] [--fqdn DOMAIN] [--email EMAIL]"
            echo "                [--ssl yes|no] [--ports 25565-25600] [--firewall yes|no] [--version latest]"
            echo "                [--insecure] [--yes] [--uninstall]"
            exit 0
            ;;
        *) fail "Unknown option: $1 (use --help)" ;;
    esac
done

cat <<'BANNER'

   ____             _              __        ___
  |  _ \ __ _ _ __ | |_ ___  _ __  \ \      / (_)_ __   __ _ ___
  | |_) / _` | '_ \| __/ _ \| '__|  \ \ /\ / /| | '_ \ / _` / __|
  |  _ < (_| | |_) | || (_) | |      \ V  V / | | | | | (_| \__ \
  |_| \_\__,_| .__/ \__\___/|_|       \_/\_/  |_|_| |_|\__, |___/
             |_|          based on Pterodactyl® Wings  |___/

BANNER

[[ $EUID -eq 0 ]] || fail "Run this installer as root (sudo -i)."
: >"$LOG_FILE"

# ---------------------------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------------------------

if ((UNINSTALL)); then
    step "Removing Raptor Wings"
    systemctl disable --now wings >>"$LOG_FILE" 2>&1 || true
    rm -f /etc/systemd/system/wings.service /usr/local/bin/wings /usr/local/bin/raptor-wings \
        /etc/update-motd.d/60-raptor-wings /etc/letsencrypt/renewal-hooks/deploy/restart-wings.sh
    systemctl daemon-reload
    info "Wings was removed. The configuration in $CONFIG_DIR and the server files in $DATA_DIR were kept."
    info "Delete them by hand if you do not need them anymore: rm -rf $CONFIG_DIR $DATA_DIR"
    exit 0
fi

# ---------------------------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------------------------

# shellcheck disable=SC1091
. /etc/os-release
case "${ID:-}:${VERSION_ID:-}" in
    ubuntu:22.04 | ubuntu:24.04 | debian:11 | debian:12) ;;
    *)
        warn "Raptor Wings is tested on Ubuntu 22.04/24.04 and Debian 11/12, detected ${PRETTY_NAME:-unknown}."
        ask CONTINUE_ANYWAY "Continue anyway? (yes/no)" "no"
        yes_no "$CONTINUE_ANYWAY" || exit 1
        ;;
esac

case "$(uname -m)" in
    x86_64) ARCH="amd64" ;;
    aarch64 | arm64) ARCH="arm64" ;;
    *) fail "Unsupported CPU architecture: $(uname -m)" ;;
esac

VIRT="$(systemd-detect-virt 2>/dev/null || echo none)"
case "$VIRT" in
    openvz | lxc | lxc-libvirt)
        warn "This machine runs in $VIRT. Docker usually does not work inside it, ask your host for a KVM VPS."
        ask CONTINUE_VIRT "Continue anyway? (yes/no)" "no"
        yes_no "$CONTINUE_VIRT" || exit 1
        ;;
esac

if systemctl is-active --quiet wings 2>/dev/null; then
    warn "Wings is already running on this machine."
    info "Update it with 'raptor-wings update', or reinstall to change its configuration."
    ask REINSTALL "Reinstall and reconfigure? (yes/no)" "no"
    yes_no "$REINSTALL" || exit 0
fi

PUBLIC_IP="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
DISK_GB=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
((MEM_MB >= 1024)) || warn "Only ${MEM_MB} MB of memory, game servers will be very limited."
((DISK_GB >= 10)) || warn "Only ${DISK_GB} GB of free disk space."

step "Configuration"
info "Paste the auto deploy command from the Panel (Admin → Nodes → node → Configuration),"
info "or leave it empty and answer the questions one by one."
ask RAPTOR_DEPLOY "Auto deploy command" ""
if [[ -n "${RAPTOR_DEPLOY:-}" ]]; then
    [[ "$RAPTOR_DEPLOY" =~ --panel-url[[:space:]]+([^[:space:]]+) ]] && RAPTOR_PANEL_URL="${BASH_REMATCH[1]}"
    [[ "$RAPTOR_DEPLOY" =~ --token[[:space:]]+([^[:space:]]+) ]] && RAPTOR_TOKEN="${BASH_REMATCH[1]}"
    [[ "$RAPTOR_DEPLOY" =~ --node[[:space:]]+([0-9]+) ]] && RAPTOR_NODE_ID="${BASH_REMATCH[1]}"
    [[ "$RAPTOR_DEPLOY" == *--allow-insecure* ]] && RAPTOR_INSECURE=1
fi
ask RAPTOR_PANEL_URL "Panel URL (empty to configure Wings by hand later)" ""
RAPTOR_PANEL_URL="${RAPTOR_PANEL_URL%/}"
if [[ -n "$RAPTOR_PANEL_URL" ]]; then
    ask RAPTOR_TOKEN "Application API key (ptla_...)" ""
    ask RAPTOR_NODE_ID "Node ID" ""
    [[ -n "$RAPTOR_TOKEN" && "$RAPTOR_NODE_ID" =~ ^[0-9]+$ ]] || fail "The API key and a numeric node ID are required to configure Wings."
fi
ask RAPTOR_NODE_FQDN "Domain of this node (must point to $PUBLIC_IP), or its IP" "$PUBLIC_IP"
if is_ip "$RAPTOR_NODE_FQDN"; then
    RAPTOR_SSL="no"
    info "An IP address was given, so no certificate is requested. The node must use HTTP in the Panel,"
    info "which only works when the Panel itself also runs on plain HTTP."
else
    ask RAPTOR_SSL "Request a free Let's Encrypt certificate for $RAPTOR_NODE_FQDN? (yes/no)" "yes"
    if yes_no "$RAPTOR_SSL"; then
        ask RAPTOR_EMAIL "Email for Let's Encrypt" "admin@${RAPTOR_NODE_FQDN#*.}"
    fi
fi
ask RAPTOR_FIREWALL "Configure the firewall (ufw)? (yes/no)" "yes"
ask RAPTOR_PORTS "Game port range to open" "25565-25600"
RAPTOR_WINGS_VERSION="${RAPTOR_WINGS_VERSION:-latest}"

if [[ ! "$RAPTOR_PORTS" =~ ^[0-9]+-[0-9]+$ ]]; then
    fail "The port range must look like 25565-25600."
fi

info ""
info "Panel:        ${RAPTOR_PANEL_URL:-configure later}${RAPTOR_NODE_ID:+ (node #$RAPTOR_NODE_ID)}"
info "Node domain:  $RAPTOR_NODE_FQDN ($(yes_no "${RAPTOR_SSL:-no}" && echo "HTTPS" || echo "no certificate"))"
info "Firewall:     $(yes_no "$RAPTOR_FIREWALL" && echo "ufw, ports 22, 8080, 2022, $RAPTOR_PORTS" || echo "unchanged")"
info "Wings:        $RAPTOR_WINGS_VERSION"
if [[ "${RAPTOR_YES:-}" != "1" && -t 0 ]]; then
    ask CONFIRM "Start the installation? (yes/no)" "yes"
    yes_no "$CONFIRM" || exit 0
fi

# ---------------------------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------------------------

step "Installing base packages"
export DEBIAN_FRONTEND=noninteractive
run apt-get update -y
run apt-get install -y curl ca-certificates tar unzip jq

step "Installing Docker"
if ! command -v docker >/dev/null; then
    run bash -c 'curl -fsSL https://get.docker.com | CHANNEL=stable sh'
else
    info "Docker $(docker --version | awk '{print $3}' | tr -d ,) is already installed."
fi
run systemctl enable --now docker

# Docker needs swap accounting to enforce the swap limits of servers.
SWAP_REBOOT=0
if [[ -f /etc/default/grub ]] && ! grep -q 'swapaccount=1' /etc/default/grub; then
    sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT="\(.*\)"/GRUB_CMDLINE_LINUX_DEFAULT="\1 swapaccount=1"/' /etc/default/grub
    if command -v update-grub >/dev/null && update-grub >>"$LOG_FILE" 2>&1; then
        SWAP_REBOOT=1
        info "Swap accounting was enabled, it becomes active after the next reboot."
    fi
fi

# ---------------------------------------------------------------------------------------------
# Wings
# ---------------------------------------------------------------------------------------------

step "Installing Wings"
mkdir -p "$CONFIG_DIR" "$DATA_DIR/volumes" /var/run/wings
if [[ "$RAPTOR_WINGS_VERSION" == "latest" ]]; then
    URL="https://github.com/pterodactyl/wings/releases/latest/download"
else
    URL="https://github.com/pterodactyl/wings/releases/download/v${RAPTOR_WINGS_VERSION#v}"
fi
run curl -fsSL -o /tmp/wings "$URL/wings_linux_$ARCH"
if curl -fsSL -o /tmp/wings-checksums.txt "$URL/checksums.txt" 2>>"$LOG_FILE"; then
    EXPECTED="$(grep "wings_linux_$ARCH\$" /tmp/wings-checksums.txt | awk '{print $1}')"
    ACTUAL="$(sha256sum /tmp/wings | awk '{print $1}')"
    if [[ -n "$EXPECTED" && "$EXPECTED" != "$ACTUAL" ]]; then
        fail "The downloaded Wings binary does not match its checksum, aborting."
    fi
    [[ -n "$EXPECTED" ]] && info "Checksum verified."
fi
install -m 755 /tmp/wings /usr/local/bin/wings
rm -f /tmp/wings /tmp/wings-checksums.txt
info "$(/usr/local/bin/wings --version 2>/dev/null | head -1)"

# ---------------------------------------------------------------------------------------------
# Certificate
# ---------------------------------------------------------------------------------------------

if yes_no "${RAPTOR_SSL:-no}"; then
    step "Requesting a certificate for $RAPTOR_NODE_FQDN"
    run apt-get install -y certbot
    HOOKS=()
    # certbot needs port 80 for a moment, stop a web server that may be using it.
    for service in nginx apache2; do
        if systemctl is-active --quiet "$service"; then
            HOOKS=(--pre-hook "systemctl stop $service" --post-hook "systemctl start $service")
        fi
    done
    if yes_no "$RAPTOR_FIREWALL" && command -v ufw >/dev/null; then ufw allow 80/tcp >>"$LOG_FILE" 2>&1 || true; fi
    if ! certbot certonly --standalone --non-interactive --agree-tos -m "$RAPTOR_EMAIL" -d "$RAPTOR_NODE_FQDN" "${HOOKS[@]}" >>"$LOG_FILE" 2>&1; then
        warn "The certificate could not be issued. Check that $RAPTOR_NODE_FQDN points to $PUBLIC_IP and port 80 is open,"
        warn "then run: certbot certonly --standalone -d $RAPTOR_NODE_FQDN && systemctl restart wings"
    fi
    mkdir -p /etc/letsencrypt/renewal-hooks/deploy
    printf '#!/bin/sh\nsystemctl restart wings\n' >/etc/letsencrypt/renewal-hooks/deploy/restart-wings.sh
    chmod +x /etc/letsencrypt/renewal-hooks/deploy/restart-wings.sh
fi

# ---------------------------------------------------------------------------------------------
# Configuration from the Panel
# ---------------------------------------------------------------------------------------------

if [[ -n "${RAPTOR_PANEL_URL:-}" ]]; then
    step "Downloading the configuration from the Panel"
    ARGS=(configure --panel-url "$RAPTOR_PANEL_URL" --token "$RAPTOR_TOKEN" --node "$RAPTOR_NODE_ID" --override)
    [[ "${RAPTOR_INSECURE:-}" == "1" ]] && ARGS+=(--allow-insecure)
    if ! (cd "$CONFIG_DIR" && /usr/local/bin/wings "${ARGS[@]}") >>"$LOG_FILE" 2>&1; then
        fail "Wings could not download its configuration. Check the Panel URL, the API key and the node ID."
    fi
    chmod 600 "$CONFIG_DIR/config.yml"
    info "Saved to $CONFIG_DIR/config.yml"
    DAEMON_PORT="$(awk '/^api:/{f=1} f && /port:/{print $2; exit}' "$CONFIG_DIR/config.yml")"
    SFTP_PORT="$(awk '/^  sftp:/{f=1} f && /bind_port:/{print $2; exit}' "$CONFIG_DIR/config.yml")"
fi
DAEMON_PORT="${DAEMON_PORT:-8080}"
SFTP_PORT="${SFTP_PORT:-2022}"

# ---------------------------------------------------------------------------------------------
# Service, helper and branding
# ---------------------------------------------------------------------------------------------

step "Setting up the service"
cat >/etc/systemd/system/wings.service <<'UNIT'
[Unit]
Description=Raptor Wings (Pterodactyl Wings daemon)
Documentation=https://github.com/brocker96/raptor-panel
After=docker.service network-online.target
Wants=network-online.target
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
Alias=raptor-wings.service
UNIT

cat >/usr/local/bin/raptor-wings <<HELPER
#!/usr/bin/env bash
# raptor-wings - manage the Raptor Wings daemon on this node.
set -euo pipefail
case "\${1:-status}" in
    status) systemctl status wings --no-pager ;;
    start | stop | restart) systemctl "\$1" wings ;;
    logs) journalctl -u wings -n "\${2:-200}" --no-pager ;;
    follow) journalctl -u wings -f ;;
    debug) systemctl stop wings; wings --debug ;;
    config) \${EDITOR:-nano} /etc/pterodactyl/config.yml && systemctl restart wings ;;
    update)
        arch=\$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')
        curl -fsSL -o /tmp/wings "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_\$arch"
        install -m 755 /tmp/wings /usr/local/bin/wings && rm -f /tmp/wings
        systemctl restart wings && wings --version
        ;;
    doctor)
        echo "Service:  \$(systemctl is-active wings)"
        echo "Docker:   \$(systemctl is-active docker)"
        echo "Version:  \$(wings --version 2>/dev/null | head -1)"
        echo "Config:   \$([[ -f /etc/pterodactyl/config.yml ]] && echo present || echo MISSING)"
        echo "Disk:     \$(df -h /var/lib/pterodactyl | awk 'NR==2 {print \$4 " free of " \$2}')"
        echo "Memory:   \$(free -h | awk '/Mem:/ {print \$7 " available of " \$2}')"
        code=\$(curl -sk -o /dev/null -w '%{http_code}' "https://127.0.0.1:$DAEMON_PORT/api/system" || curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$DAEMON_PORT/api/system" || true)
        echo "API:      \${code:-no answer} (401 means it is up and waiting for the Panel)"
        ;;
    uninstall) bash <(curl -fsSL https://raw.githubusercontent.com/$REPO/$BRANCH/wings.sh) --uninstall ;;
    *) echo "Usage: raptor-wings {status|start|stop|restart|logs [n]|follow|debug|config|update|doctor|uninstall}"; exit 1 ;;
esac
HELPER
chmod 755 /usr/local/bin/raptor-wings

if [[ -d /etc/update-motd.d ]]; then
    cat >/etc/update-motd.d/60-raptor-wings <<'MOTD'
#!/bin/sh
state=$(systemctl is-active wings 2>/dev/null)
servers=$(docker ps -q 2>/dev/null | wc -l)
printf '\n  \033[38;5;76mRaptor Wings\033[0m  %s · %s running servers · raptor-wings help\n\n' "$state" "$servers"
MOTD
    chmod +x /etc/update-motd.d/60-raptor-wings
fi

run systemctl daemon-reload
if [[ -f "$CONFIG_DIR/config.yml" ]]; then
    run systemctl enable --now wings
else
    run systemctl enable wings
fi

# ---------------------------------------------------------------------------------------------
# Firewall
# ---------------------------------------------------------------------------------------------

if yes_no "$RAPTOR_FIREWALL"; then
    step "Configuring the firewall"
    command -v ufw >/dev/null || run apt-get install -y ufw
    PORT_START="${RAPTOR_PORTS%-*}"
    PORT_END="${RAPTOR_PORTS#*-}"
    run ufw allow OpenSSH
    run ufw allow "$DAEMON_PORT/tcp"
    run ufw allow "$SFTP_PORT/tcp"
    run ufw allow "${PORT_START}:${PORT_END}/tcp"
    run ufw allow "${PORT_START}:${PORT_END}/udp"
    run ufw --force enable
    info "Open: SSH, $DAEMON_PORT (Wings), $SFTP_PORT (SFTP), $RAPTOR_PORTS (games)"
fi

# ---------------------------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------------------------

STATE="not started"
if [[ -f "$CONFIG_DIR/config.yml" ]]; then
    for _ in $(seq 1 15); do
        systemctl is-active --quiet wings && STATE="running" && break
        sleep 1
    done
    [[ "$STATE" == "running" ]] || STATE="failed, see: raptor-wings logs"
fi

trap - ERR
printf '\n%s✔ Raptor Wings is installed!%s\n\n' "$GREEN$BOLD" "$RESET"
printf '   Status    %s\n' "$STATE"
printf '   Node      %s (%s)\n' "$RAPTOR_NODE_FQDN" "$PUBLIC_IP"
printf '   Manage    raptor-wings status | logs | restart | update | doctor\n'
if [[ ! -f "$CONFIG_DIR/config.yml" ]]; then
    printf '\n   %sNext step%s: copy the configuration of the node from the Panel\n' "$BOLD" "$RESET"
    printf '   (Admin → Nodes → node → Configuration) to %s/config.yml, then run:\n' "$CONFIG_DIR"
    printf '   systemctl start wings\n'
else
    printf '\n   The node turns green in the Panel within a few seconds.\n'
    printf '   Add allocations for %s:%s in the Panel to create servers.\n' "$PUBLIC_IP" "$RAPTOR_PORTS"
fi
((SWAP_REBOOT)) && printf '\n   %sReboot once%s to activate swap limits for servers: reboot\n' "$YELLOW" "$RESET"
printf '\n   Raptor Wings is Pterodactyl® Wings (MIT), installed and managed by Raptor Panel.\n\n'
