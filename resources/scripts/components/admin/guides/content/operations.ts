import { Guide } from '@/components/admin/guides/types';

export default [
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
