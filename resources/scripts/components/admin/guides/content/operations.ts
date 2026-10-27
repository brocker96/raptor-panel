import { Guide } from '@/components/admin/guides/types';

export default [
    {
        key: 'updates',
        title: 'Updating Raptor Panel',
        category: 'Operations',
        summary: 'One-click updates from GitHub releases, what happens during an update and how to roll back.',
        minutes: 5,
        sections: [
            {
                heading: 'How updates are found',
                body: 'The Panel reads the releases of its GitHub repository once an hour and shows a notice on the overview when a newer version is available on your update channel. Open **Updates** to see the release notes and press **Check for updates** to look right now.',
                points: [
                    'Stable — only final releases.',
                    'Beta — pre-releases as well, they get new features first and are what the 0.x versions are published as.',
                    'Development build — a Panel installed from a git branch has the version `canary`. Every release is offered to it, after installing one you get normal updates.',
                ],
            },
            {
                heading: 'What happens during an update',
                steps: [
                    'You press **Update** and the request is queued. The scheduler (the cron job of the Panel) picks it up within a minute.',
                    'The release archive is downloaded and checked against its SHA-256 checksum.',
                    'A backup of the Panel files, `.env` and the whole database is written to `storage/app/raptor/updates/backups`.',
                    'The Panel goes into maintenance mode, the files are replaced, PHP dependencies are installed and the database is migrated.',
                    'The queue worker is restarted and the Panel comes back online. Reload the page to load the new interface.',
                ],
                tips: [
                    'Game servers keep running, Wings is not touched by a Panel update.',
                    'The page follows the progress and shows the full log, even while the Panel is in maintenance mode.',
                ],
                warning:
                    'If any step fails, the backup is restored automatically and the error is shown. Nothing stays half updated.',
            },
            {
                heading: 'Rolling back',
                body: 'The newest backups (three by default, `RAPTOR_UPDATE_KEEP_BACKUPS`) are listed under **Backups**. **Roll back** restores the files and the database of that moment.',
                warning:
                    'A rollback also restores the database, so users, servers and settings created after the backup are lost. Files of game servers on the nodes are not affected.',
            },
            {
                heading: 'Updating from the terminal',
                body: 'Everything is also available as an Artisan command. Run it as the web server user so file permissions stay correct.',
                code: [
                    {
                        language: 'Shell',
                        content:
                            'cd /var/www/raptor\nsudo -u www-data php artisan raptor:update --check\nsudo -u www-data php artisan raptor:update            # newest release\nsudo -u www-data php artisan raptor:update 0.3.0      # a specific release\nsudo -u www-data php artisan raptor:update --backups\nsudo -u www-data php artisan raptor:update --rollback=latest',
                    },
                ],
            },
            {
                heading: 'Settings',
                points: [
                    'RAPTOR_UPDATE_CHANNEL — default channel (`stable` or `beta`), can be changed on the Updates page.',
                    'RAPTOR_UPDATE_REPOSITORY — repository releases are read from, `brocker96/raptor-panel` by default.',
                    'RAPTOR_UPDATE_FEED — optional mirror URL that returns the same JSON as the GitHub releases API.',
                ],
            },
        ],
        faq: [
            {
                q: 'The update stays at "Waiting for the scheduler".',
                a: 'The cron job is missing. Check it with `crontab -u www-data -l`; it must contain `* * * * * php /var/www/raptor/artisan schedule:run`. You can also run `sudo -u www-data php artisan raptor:update --pending` by hand.',
            },
            {
                q: 'It says the files are not writable.',
                a: 'Run `chown -R www-data:www-data /var/www/raptor` once, then try again.',
            },
            {
                q: 'Can I install an older version?',
                a: 'Database migrations cannot be undone safely, so going back is only possible with a backup made before the update.',
            },
        ],
        related: ['system'],
    },
    {
        key: 'system',
        title: 'System health, queue and caches',
        category: 'Operations',
        summary: 'Understanding the health checks, failed jobs and when to clear caches.',
        minutes: 4,
        sections: [
            {
                heading: 'Health checks',
                points: [
                    'Debug mode is disabled — `APP_DEBUG=true` shows stack traces including secrets to anyone who triggers an error. Only enable it briefly while debugging.',
                    'Panel URL uses HTTPS — required for secure cookies and for browsers to allow the console websocket to an SSL node.',
                    'Redis is used for cache — file or database caches are much slower. Set `CACHE_DRIVER=redis`.',
                    'A queue worker is configured — with `QUEUE_CONNECTION=sync` e-mails and Wings calls run inside web requests and make the Panel slow. Use `redis` and run the `raptorq` service.',
                    'Sessions in Redis or the database — file sessions break with several PHP workers.',
                    'No failed queue jobs — see below.',
                ],
            },
            {
                heading: 'Failed jobs',
                body: 'Background jobs (sending e-mails, running schedules, talking to Wings) are retried a few times. If they keep failing they are listed here with the error. Typical causes are wrong mail settings or a node that was offline.',
                points: [
                    'Retry — puts the job back on the queue after you fixed the cause.',
                    'Forget — deletes the failed job.',
                    'Flush — deletes all failed jobs.',
                ],
            },
            {
                heading: 'Clearing caches',
                body: 'After editing `.env` by hand press **Clear caches** (or run `php artisan optimize:clear`) so the Panel reads the new values. Restart the queue worker afterwards with `php artisan queue:restart`.',
            },
            {
                heading: 'Useful commands',
                code: [
                    {
                        language: 'Shell',
                        content:
                            'cd /var/www/raptor\nphp artisan p:info                # versions and configuration overview\nsystemctl status raptorq          # queue worker\ntail -f storage/logs/laravel-$(date +%F).log\nphp artisan queue:restart',
                    },
                ],
            },
        ],
        related: ['troubleshooting', 'upgrading'],
    },
    {
        key: 'upgrading',
        title: 'Updating Raptor Panel',
        category: 'Operations',
        summary: 'Updating the Panel and Wings safely, with backups.',
        minutes: 4,
        sections: [
            {
                heading: 'Before updating',
                steps: [
                    'Back up the database: `mysqldump -u root panel > ~/panel-$(date +%F).sql`.',
                    'Back up `/var/www/raptor/.env` — it contains the `APP_KEY` that encrypts secrets in the database. Losing it means losing node tokens, database host passwords and mail passwords.',
                ],
            },
            {
                heading: 'Updating the Panel',
                code: [
                    {
                        language: 'Shell',
                        content:
                            'cd /var/www/raptor\nphp artisan down\nphp artisan p:upgrade          # downloads the latest release and migrates\nchown -R www-data:www-data .\nphp artisan queue:restart\nphp artisan up',
                    },
                ],
            },
            {
                heading: 'Updating Wings',
                code: [
                    {
                        language: 'Shell',
                        content:
                            'systemctl stop wings\ncurl -L -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_amd64"\nchmod u+x /usr/local/bin/wings\nsystemctl restart wings',
                    },
                ],
                tips: ['Running servers keep running while Wings restarts, only the console connections reconnect.'],
            },
        ],
        related: ['system'],
    },
    {
        key: 'troubleshooting',
        title: 'Troubleshooting',
        category: 'Operations',
        summary: 'The most common problems and how to fix them, from offline nodes to 500 errors.',
        minutes: 8,
        sections: [
            {
                heading: 'Node shows offline',
                steps: [
                    'Look at the error on the node page, it is the exact error the Panel got.',
                    'On the node: `systemctl status wings` and `journalctl -u wings -n 200 --no-pager`.',
                    'Run `wings --debug` in the foreground to see configuration errors.',
                    'From the Panel machine: `curl -v https://node1.example.com:8080/api/system` should answer with 401 (that means Wings is reachable).',
                    'Check firewalls on both machines and at the hosting provider.',
                ],
            },
            {
                heading: 'Console says "connection lost" or keeps reconnecting',
                points: [
                    'Panel on HTTPS but node without SSL — browsers block insecure websockets. Enable SSL on the node.',
                    'Wrong FQDN — the browser connects to the node FQDN directly, it must resolve publicly.',
                    'Port blocked — the Wings port must be reachable from the internet, not only from the Panel.',
                    'Cloudflare proxy on port 8080 — Cloudflare does not proxy 8080 over HTTPS. Use 8443 or a DNS-only record.',
                    'Clock skew — websocket tokens are time based. Make sure both machines sync their clock (`timedatectl`).',
                ],
            },
            {
                heading: '500 errors in the Panel',
                steps: [
                    'Look at the newest file in `storage/logs/` in the Panel directory, the error is at the bottom.',
                    'Common causes: wrong file permissions (`chown -R www-data:www-data /var/www/raptor`), a missing PHP extension, Redis or MariaDB not running.',
                    'After changing `.env` run `php artisan config:cache`.',
                ],
            },
            {
                heading: 'Servers do not start',
                points: [
                    'Look at the console output, Wings prints the reason (e.g. "image not found", "port already in use").',
                    '"Port already in use" — another process or a leftover container uses the port: `docker ps -a` and `ss -tulpn | grep <port>`.',
                    'Out of disk — the server or the node disk is full.',
                    'Wrong Docker image for the version, e.g. Minecraft 1.21 needs Java 21.',
                ],
            },
            {
                heading: 'E-mails are not delivered',
                body: 'Send a test e-mail from Settings → Mail. Then look at System → Failed jobs, every e-mail that could not be sent is listed there with the SMTP error.',
            },
        ],
        related: ['nodes', 'node-configuration', 'system', 'cloudflare'],
    },
] as Guide[];
