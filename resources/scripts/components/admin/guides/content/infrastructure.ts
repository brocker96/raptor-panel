import { Guide } from '@/components/admin/guides/types';

export default [
    {
        key: 'nodes',
        title: 'Nodes: adding machines that run servers',
        category: 'Infrastructure',
        summary: 'Every node setting explained, how resource budgets and overallocation work, and maintenance mode.',
        minutes: 7,
        sections: [
            {
                heading: 'What a node is',
                body: 'A node is a machine running Wings. The Panel sends it commands (create server, start, stop, read files) over HTTP(S) and Wings reports back. Browsers also connect to Wings directly for the console websocket, file uploads and downloads, so the node address must be reachable from the internet, not just from the Panel.',
            },
            {
                heading: 'Connection settings',
                points: [
                    'FQDN — the domain name (e.g. `node1.example.com`) or IP address of the machine. An IP address can only be used without SSL because certificates are issued for domains.',
                    "Communicate over SSL — must be enabled when the Panel itself uses HTTPS, browsers refuse to open an insecure websocket from a secure page. Wings then needs a certificate for the FQDN (e.g. from Let's Encrypt).",
                    'Behind proxy — enable when Wings runs behind a reverse proxy that terminates SSL (e.g. nginx or Cloudflare). Wings then listens on plain HTTP and trusts the proxy for HTTPS.',
                    'Daemon port — the port Wings listens on, `8080` by default. Behind Cloudflare use `8443` (one of the HTTPS ports Cloudflare proxies) or a "DNS only" record.',
                    'SFTP port — `2022` by default, used by SFTP clients such as FileZilla or WinSCP.',
                    'Daemon base directory — where server files are stored on the node, `/var/lib/pterodactyl/volumes` by default. Use a fast disk with enough space.',
                ],
            },
            {
                heading: 'Resource budget and overallocation',
                body: 'Memory and disk are the totals that can be handed out to servers on this node. They are not detected automatically: enter what you want to allocate, usually the physical amount minus what the operating system and other software need.\n\nOverallocation lets you hand out more than the budget, in percent. `0` disables it, `20` allows 120% of the budget, `-1` turns the check off completely. Overallocating memory works well when servers rarely use their full limit at the same time, overallocating disk is risky because a full disk breaks every server on the node.',
                tips: [
                    'Leave about 1–2 GiB of memory for the operating system and Docker, more if the Panel runs on the same machine.',
                ],
            },
            {
                heading: 'Visibility and maintenance',
                points: [
                    'Public — public nodes are used for automatic deployment (e.g. by billing systems through the API). Private nodes can still be chosen manually.',
                    'Maintenance mode — users see a maintenance notice and cannot control their servers on this node. Use it while updating or rebooting the machine.',
                    "Upload size — maximum size of a single file uploaded through the file manager, in MiB. Behind Cloudflare's free plan keep it at or below 100 MiB.",
                ],
            },
            {
                heading: 'Node status',
                body: 'The status badge is fetched live from Wings. "Online" shows the Wings version, the operating system, CPU count and the response time. "Offline" includes the error the Panel received, which usually tells you exactly what is wrong (DNS, refused connection, SSL error, timeout).',
            },
            {
                heading: 'Resetting the daemon token',
                body: 'The node settings include **Reset daemon token**. This generates new credentials for Wings. Use it if `/etc/pterodactyl/config.yml` leaked. Afterwards update the configuration on the node and restart Wings, until then the node is offline.',
            },
        ],
        faq: [
            {
                q: 'The node is offline with "connection refused"',
                a: 'Wings is not running or listens on another port. Run `systemctl status wings` and `journalctl -u wings -n 100` on the node.',
            },
            {
                q: 'The node is offline with an SSL error',
                a: 'The certificate on the node does not match the FQDN or expired. Check the `api.ssl` section of `config.yml` and run `certbot renew`. After renewing restart Wings.',
            },
            {
                q: 'Console shows "connection lost" right after loading',
                a: 'The browser cannot reach Wings: check the firewall (port 8080 or 8443), that SSL is enabled when the Panel uses HTTPS, and that the FQDN resolves from the internet.',
            },
        ],
        related: ['node-configuration', 'allocations', 'cloudflare', 'troubleshooting'],
    },
    {
        key: 'node-configuration',
        title: 'Installing and configuring Wings',
        category: 'Infrastructure',
        summary: 'Installing Docker and Wings on a new machine and connecting it to the Panel.',
        minutes: 8,
        sections: [
            {
                heading: 'Requirements',
                points: [
                    'A 64-bit Linux machine (Ubuntu 22.04/24.04 or Debian 12 recommended), x86_64 or arm64.',
                    'Virtualisation that supports Docker: KVM, VMware, dedicated servers. OpenVZ and LXC usually do not work.',
                    'Ports 8080 (or 8443) and 2022 open, plus the ports you will hand out as allocations.',
                ],
            },
            {
                heading: 'Install Docker and Wings',
                code: [
                    {
                        label: 'Docker',
                        language: 'Shell',
                        content:
                            'curl -sSL https://get.docker.com/ | CHANNEL=stable bash\nsystemctl enable --now docker',
                    },
                    {
                        label: 'Wings',
                        language: 'Shell',
                        content:
                            'mkdir -p /etc/pterodactyl\ncurl -L -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_$([[ "$(uname -m)" == "x86_64" ]] && echo "amd64" || echo "arm64")"\nchmod u+x /usr/local/bin/wings',
                    },
                ],
            },
            {
                heading: 'Add the configuration',
                body: 'Wings reads its configuration from `/etc/pterodactyl/config.yml`. There are two ways to create it:',
                steps: [
                    'Auto deploy: press **Auto-deploy command** on the Configuration tab of the node and run the command on the machine. It downloads the configuration using a read-only API key.',
                    'Manual: copy the configuration shown on the Configuration tab into `/etc/pterodactyl/config.yml`.',
                ],
                warning:
                    'The configuration contains the secret token Wings uses to authenticate with the Panel. Never share it.',
            },
            {
                heading: 'Test and start Wings',
                code: [
                    { label: 'Run in the foreground to see errors', language: 'Shell', content: 'wings --debug' },
                    {
                        label: '/etc/systemd/system/wings.service',
                        language: 'Properties',
                        content:
                            '[Unit]\nDescription=Pterodactyl Wings Daemon\nAfter=docker.service\nRequires=docker.service\nPartOf=docker.service\n\n[Service]\nUser=root\nWorkingDirectory=/etc/pterodactyl\nLimitNOFILE=4096\nPIDFile=/var/run/wings/daemon.pid\nExecStart=/usr/local/bin/wings\nRestart=on-failure\nStartLimitInterval=180\nStartLimitBurst=30\nRestartSec=5s\n\n[Install]\nWantedBy=multi-user.target',
                    },
                    { label: 'Enable on boot', language: 'Shell', content: 'systemctl enable --now wings' },
                ],
            },
            {
                heading: 'SSL for Wings',
                body: "If the Panel uses HTTPS, Wings must too. The simplest way is a Let's Encrypt certificate for the node FQDN. The generated configuration already points to `/etc/letsencrypt/live/<fqdn>/`.",
                code: [
                    {
                        language: 'Shell',
                        content:
                            "apt install -y certbot\ncertbot certonly --standalone -d node1.example.com\n# restart Wings after every renewal\necho -e '#!/bin/sh\\nsystemctl restart wings' > /etc/letsencrypt/renewal-hooks/deploy/wings.sh\nchmod +x /etc/letsencrypt/renewal-hooks/deploy/wings.sh",
                    },
                ],
            },
        ],
        related: ['nodes', 'cloudflare', 'troubleshooting'],
    },
    {
        key: 'allocations',
        title: 'Allocations: IP addresses and ports',
        category: 'Infrastructure',
        summary: 'Creating port ranges, aliases and cleaning up unused allocations.',
        minutes: 4,
        sections: [
            {
                heading: 'Creating allocations',
                steps: [
                    'Open the node and go to the Allocations tab, press **Add allocations**.',
                    'IP address — the address servers bind to. Use the public IP of the node, `0.0.0.0` to listen on every address, or a CIDR range between /25 and /32 to create allocations for several IPs at once.',
                    'Alias — optional text shown to users instead of the IP, e.g. `play.example.com`. Useful with `0.0.0.0` or NAT.',
                    'Ports — single ports (`25565`), ranges (`25565-25600`) or several of both. Ports must be between 1025 and 65535 and a range may contain at most 1000 ports.',
                ],
            },
            {
                heading: 'Managing allocations',
                points: [
                    'Filter by assigned/unassigned to see which ports are still free.',
                    'Click the alias of an allocation to edit it inline.',
                    'Select several allocations and press **Delete selected**, or delete every unassigned allocation of an IP at once. Assigned allocations are never deleted, the result tells you how many were skipped.',
                ],
                warning:
                    'Allocations only describe which ports the Panel may hand out. Open the same ports in the firewall of the node (e.g. `ufw allow 25565:25600/tcp` and `/udp`).',
            },
        ],
        faq: [
            {
                q: 'Players cannot connect although the server is running',
                a: "Check the firewall of the node and the hosting provider, that the server binds to the allocation IP (use `0.0.0.0` behind NAT) and that the port is not proxied by Cloudflare — game traffic cannot pass through Cloudflare's proxy.",
            },
        ],
        related: ['nodes', 'server-build'],
    },
    {
        key: 'locations',
        title: 'Locations',
        category: 'Infrastructure',
        summary: 'Grouping nodes by region or data center.',
        minutes: 2,
        sections: [
            {
                heading: 'What locations are for',
                body: 'A location groups nodes, typically by data center or country. Automatic deployment (through the API) can be limited to locations, so a billing system can offer "Germany" and "USA" and the Panel picks a node with free resources inside it.',
                points: [
                    'Short code — a unique identifier such as `de-fra`, used by integrations.',
                    'Description — a human readable name such as "Frankfurt, Germany".',
                ],
                warning: 'A location can only be deleted when no nodes are assigned to it.',
            },
        ],
        related: ['nodes'],
    },
    {
        key: 'database-hosts',
        title: 'Database hosts',
        category: 'Infrastructure',
        summary: 'Connecting a MySQL / MariaDB server so that servers can get their own databases.',
        minutes: 6,
        sections: [
            {
                heading: 'How it works',
                body: 'A database host is a MySQL or MariaDB server the Panel can log into with a privileged user. When a database is created for a game server, the Panel creates the database and a dedicated user on that host. Game servers then connect to it with the generated credentials.',
            },
            {
                heading: 'Preparing MariaDB on the node',
                steps: [
                    'Install MariaDB on the node (or any machine reachable by the servers): `apt install -y mariadb-server`.',
                    'Allow remote connections: in `/etc/mysql/mariadb.conf.d/50-server.cnf` set `bind-address = 0.0.0.0` and restart MariaDB.',
                    'Create a user the Panel will use. It needs permission to create other users and databases.',
                    'Open port 3306 in the firewall, ideally only for the Panel and your nodes.',
                ],
                code: [
                    {
                        label: 'Run inside `mysql -u root`',
                        language: 'SQL',
                        content:
                            "CREATE USER 'raptor'@'%' IDENTIFIED BY 'a-long-random-password';\nGRANT ALL PRIVILEGES ON *.* TO 'raptor'@'%' WITH GRANT OPTION;\nFLUSH PRIVILEGES;",
                    },
                ],
                warning:
                    "Restrict `%` to the IP of the Panel if the database is reachable from the internet, e.g. `'raptor'@'203.0.113.10'`.",
            },
            {
                heading: 'Adding the host',
                points: [
                    'Name — shown to users, e.g. "EU database".',
                    'Host and port — address the Panel and the game servers use to connect, usually the node IP and 3306. Do not use `127.0.0.1` if the Panel runs on another machine.',
                    'Username / password — the user created above. The password is stored encrypted, leave it empty when editing to keep it.',
                    'Linked node — optional. When set, the host is preferred for servers on that node.',
                ],
                tips: [
                    'Saving tests the connection immediately, so a typo is reported right away instead of when a user creates a database.',
                ],
            },
        ],
        related: ['server-databases'],
    },
    {
        key: 'mounts',
        title: 'Mounts',
        category: 'Infrastructure',
        summary: 'Sharing directories of the node with servers, e.g. a shared map folder or mod cache.',
        minutes: 4,
        sections: [
            {
                heading: 'What mounts do',
                body: 'A mount makes a directory of the node available inside the container of a server. A mount is only usable by servers whose egg **and** node are both linked to it, and it must then be attached to the server on its Mounts tab.',
                points: [
                    'Source — the path on the node, e.g. `/srv/shared/maps`. Wings must be allowed to use it: add the path to `allowed_mounts` in `/etc/pterodactyl/config.yml` and restart Wings.',
                    'Target — the path inside the container, e.g. `/home/container/maps`. Cannot be `/home/container` itself.',
                    'Read only — the server can read but not change the files. Recommended for shared data.',
                    'User mountable — allows the server owner to attach the mount themselves.',
                ],
                warning:
                    'The Wings directories `/etc/pterodactyl`, `/var/lib/pterodactyl/volumes` and `/srv/daemon-data` cannot be used as a source.',
            },
            {
                heading: 'Typical setup',
                steps: [
                    'Create the directory on the node and add it to `allowed_mounts` in the Wings config.',
                    'Create the mount here and link the eggs and nodes it applies to.',
                    'Open each server that should use it, go to Mounts and attach it.',
                    'Restart the server, mounts are applied when the container is created.',
                ],
            },
        ],
        related: ['nodes', 'nests-eggs'],
    },
] as Guide[];
