import { Guide } from '@/components/admin/guides/types';

export default [
    {
        key: 'migrating',
        title: 'Moving from Pterodactyl',
        category: 'Getting started',
        summary: 'Switch an existing Pterodactyl Panel to Raptor Panel without losing data, and how to go back.',
        minutes: 5,
        sections: [
            {
                heading: 'What is kept',
                body: 'Raptor Panel uses the same database as Pterodactyl 1.x. The migration keeps the database and the `.env` file, including the `APP_KEY` that every stored secret is encrypted with, so everything stays as it was.',
                points: [
                    'Users, passwords, two-factor authentication, API keys and SSH keys.',
                    'Servers, nodes, allocations, locations, nests and eggs (custom eggs too), databases and mounts.',
                    'Schedules, backups, subusers, activity logs and all Panel settings.',
                    'Wings and game servers keep running, nodes do not need a new configuration.',
                ],
                tips: ['Everybody is signed out once and signs in again with their existing password.'],
            },
            {
                heading: 'Running the migration',
                steps: [
                    'Make sure PHP 8.2 or newer is installed (`php -v`). Pterodactyl installs made with older guides may still use PHP 8.1.',
                    'Run the migration script below as root on the Panel server.',
                    'The script installs Raptor Panel next to Pterodactyl in `/var/www/raptor`, the old files are not changed.',
                    'It backs up the database, the old Panel directory, the web server and queue worker configuration and the cron job to `/var/backups/raptor-migration/<id>`.',
                    'During a short maintenance window the database is migrated and nginx (or Apache), the queue worker (`pteroq` becomes `raptorq`) and the cron job are switched over.',
                    'The Panel is checked over HTTP, if it does not answer everything is rolled back automatically.',
                ],
                code: [
                    {
                        language: 'Shell',
                        content:
                            'bash <(curl -fsSL https://raw.githubusercontent.com/brocker96/raptor-panel/0.x_beta/migrate.sh)',
                    },
                ],
            },
            {
                heading: 'Going back to Pterodactyl',
                body: 'The rollback restores the database from the migration backup, switches the web server, queue worker and cron job back and takes Pterodactyl out of maintenance mode. Raptor Panel is moved aside, not deleted.',
                code: [
                    {
                        language: 'Shell',
                        content:
                            'bash /var/www/raptor/migrate.sh --list\nbash /var/www/raptor/migrate.sh --rollback            # newest backup\nbash /var/www/raptor/migrate.sh --rollback <id>',
                    },
                ],
                warning:
                    'Changes made in Raptor Panel after the migration (new users, servers, settings) are lost by a rollback, because the database of the moment of migration is restored.',
            },
            {
                heading: 'Options',
                points: [
                    'PTERODACTYL_DIR — directory of the old Panel, default `/var/www/pterodactyl`.',
                    'RAPTOR_DIR — where Raptor Panel is installed, default `/var/www/raptor`.',
                    'RAPTOR_RELEASE — install a release (`latest` or a tag) instead of the git branch.',
                    'RAPTOR_YES=1 — run without questions.',
                ],
            },
        ],
        faq: [
            {
                q: 'Do I have to do anything on my nodes?',
                a: 'No. Wings talks to the same Panel URL with the same tokens. You can update Wings later as usual.',
            },
            {
                q: 'Can I delete /var/www/pterodactyl afterwards?',
                a: 'Yes, once everything works. A copy of it is part of the migration backup, which a rollback restores if the directory is missing.',
            },
        ],
        related: ['getting-started', 'updates'],
    },
    {
        key: 'getting-started',
        title: 'Quick start: from a fresh install to the first server',
        category: 'Getting started',
        summary:
            'The shortest path from an empty Panel to a running game server: location, node, allocations, egg and server.',
        minutes: 6,
        sections: [
            {
                heading: 'How the pieces fit together',
                body: 'Raptor Panel is the web interface and API. It never runs game servers itself, that is the job of Wings, a small daemon installed on every machine that hosts servers. Wings runs every server inside its own Docker container.\n\nThe Panel organises your infrastructure like this:',
                points: [
                    'Location — a group of nodes, usually a data center or a region (e.g. "eu-fra"). Purely organisational.',
                    'Node — one machine running Wings. Has a memory and disk budget that servers are carved out of.',
                    'Allocation — an IP address + port combination on a node. Every server needs at least one, it is the address players connect to.',
                    'Nest — a category of eggs, e.g. "Minecraft" or "Source Engine".',
                    'Egg — the recipe for a type of server: Docker image, startup command, install script and variables. "Paper", "Forge", "Rust" are all eggs.',
                    'Server — an instance of an egg on a node, owned by a user, with resource limits and one or more allocations.',
                ],
            },
            {
                heading: 'Step by step',
                steps: [
                    'Open **Locations** and create a location, for example `local` / "My first location".',
                    'Open **Nodes → Create node**. Enter the domain (or IP) of the machine running Wings, its memory and disk and save. If you used `install.sh` with Wings this was already done for you.',
                    'On the node, open the **Configuration** tab and copy the configuration to `/etc/pterodactyl/config.yml` on the machine, or run the auto-deploy command shown there. Start Wings with `systemctl enable --now wings`.',
                    'Wait until the node shows a green **Online** badge (the Panel checks it every few seconds).',
                    'Open the **Allocations** tab of the node and add the IP address and ports servers may use, e.g. `25565-25600`.',
                    'Open **Servers → Create server**, pick the owner, an egg (e.g. Minecraft → Paper), the node and a free allocation, set memory and disk and create it.',
                    'The server is now installing. Open it from the dashboard to watch the install log in the console, then press **Start**.',
                ],
                tips: [
                    'Every page in the admin area has a **Guide** button in the top right corner that opens the guide for that exact page.',
                    'The Overview page shows how much of each node is already allocated, so you can see at a glance where new servers fit.',
                ],
            },
            {
                heading: 'Recommended first settings',
                points: [
                    'Settings → General: set the company name shown in the browser tab and e-mails.',
                    'Settings → Mail: configure SMTP so users receive password reset and server notification e-mails, then send a test e-mail.',
                    'Settings → General: consider requiring two-factor authentication for administrators.',
                    'System: check that every health check is green (Redis cache, queue worker, HTTPS, debug mode off).',
                ],
            },
        ],
        faq: [
            {
                q: 'Do I need a separate machine for Wings?',
                a: 'No. Wings can run on the same machine as the Panel, which is what `install.sh` sets up when you answer "yes" to installing Wings. For larger setups separate machines are recommended so that game servers cannot starve the Panel of resources.',
            },
            {
                q: 'Where is the old admin area?',
                a: 'The original server rendered admin area is still available at `/admin/legacy` as a fallback. Everything it could do is available here as well.',
            },
        ],
        related: ['nodes', 'node-configuration', 'allocations', 'server-create'],
    },
    {
        key: 'overview',
        title: 'Overview dashboard',
        category: 'Getting started',
        summary: 'What every number and chart on the Overview page means and how to react to it.',
        minutes: 3,
        sections: [
            {
                heading: 'Statistic cards',
                body: 'The cards at the top count the main resources of the Panel. Click a card to jump to its list.',
                points: [
                    'Servers — the total number of servers, the hint shows how many are suspended or failed to install.',
                    'Users — all accounts, the hint shows how many of them are administrators.',
                    'Nodes — machines running Wings.',
                    'Eggs — server types available for new servers.',
                ],
            },
            {
                heading: 'Server health',
                body: 'The status breakdown shows how many servers are installed, still installing, failed to install or are suspended. A growing "Install failed" number usually means an egg install script is broken or a node cannot download Docker images. Use the filter on the Servers page (Status → Install failed) to find them.',
            },
            {
                heading: 'Node capacity',
                body: 'Each bar shows the memory and disk assigned to servers on that node compared to its budget, including overallocation. Green is below 75%, yellow up to 90%, red above. The numbers come from the server limits, not live usage: a node can show 100% allocated while the servers on it only use half of it.',
                tips: [
                    'When a node is red, raise its overallocation, add a new node or transfer servers away from it.',
                ],
            },
            {
                heading: 'Activity',
                body: 'The sparkline counts audit log events per day over the last two weeks (logins, file edits, power actions, admin changes). Sudden spikes can point to a brute force attempt or a misbehaving integration. Open the Audit log to investigate.',
            },
        ],
        related: ['audit-log', 'system'],
    },
] as Guide[];
