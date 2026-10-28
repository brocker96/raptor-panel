import { Guide } from '@/components/admin/guides/types';

export default [
    {
        key: 'settings-general',
        title: 'General settings',
        category: 'Configuration',
        summary: 'Panel name, default language and the two-factor authentication policy.',
        minutes: 2,
        sections: [
            {
                heading: 'Fields',
                points: [
                    'Company name — shown in the browser tab, e-mails and the login page.',
                    'Default language — used for e-mails and users that did not choose a language.',
                    'Require two-factor authentication — "Not required", "Admin only" or "All users". Affected users are asked to set up 2FA on their next page load and cannot use the Panel until they did.',
                ],
                tips: [
                    'Requiring 2FA for administrators is strongly recommended, an admin account can control every server and node.',
                ],
            },
            {
                heading: 'Where settings are stored',
                body: 'Settings changed here are stored in the database and override the values from `.env`. The queue worker is restarted automatically so that e-mails and background jobs pick up the change. If `APP_ENVIRONMENT_ONLY=true` is set in `.env`, database settings are ignored and only `.env` is used.',
            },
        ],
        related: ['settings-mail', 'settings-advanced'],
    },
    {
        key: 'settings-mail',
        title: 'Mail settings',
        category: 'Configuration',
        summary: 'Sending e-mail over SMTP with examples for popular providers, and testing it.',
        minutes: 4,
        sections: [
            {
                heading: 'Why mail matters',
                body: 'The Panel sends e-mails for password resets, new accounts without a password, being added as a subuser and server installation results. Without working mail users cannot reset their passwords.',
            },
            {
                heading: 'Fields',
                points: [
                    'SMTP host and port — e.g. `smtp.gmail.com` and `587`.',
                    'Encryption — TLS (STARTTLS, usually port 587), SSL (implicit TLS, usually port 465) or none (port 25, not recommended).',
                    'Username / password — credentials of the mailbox. The password is stored encrypted and never shown again, leave it empty to keep the current one.',
                    'From address / name — sender of all e-mails, e.g. `no-reply@example.com` / "Raptor Panel". Use an address of a domain the SMTP server may send for, otherwise mail ends up in spam.',
                ],
            },
            {
                heading: 'Provider examples',
                points: [
                    'Gmail / Google Workspace — `smtp.gmail.com`, 587, TLS. Requires an app password (Google account → Security → App passwords).',
                    'Mailgun — `smtp.eu.mailgun.org` (EU) or `smtp.mailgun.org`, 587, TLS, SMTP credentials from the domain settings.',
                    'Postmark — `smtp.postmarkapp.com`, 587, TLS, server API token as username and password.',
                    'Amazon SES — `email-smtp.<region>.amazonaws.com`, 587, TLS, SMTP credentials (not your AWS keys).',
                    'Zoho — `smtp.zoho.eu` or `smtp.zoho.com`, 465, SSL.',
                ],
            },
            {
                heading: 'Testing',
                body: 'Press **Send test e-mail** after saving. The e-mail goes to your own address. Errors from the SMTP server are shown directly, e.g. "authentication failed" or "connection timed out".',
                warning:
                    'Many VPS providers block outgoing port 25 and sometimes 465/587. If the test times out, ask your provider or use port 2525 if your mail service offers it.',
            },
            {
                heading: 'Other mail drivers',
                body: 'These settings can only be edited when `MAIL_MAILER=smtp`. Drivers such as `mailgun` or `postmark` (API based) are configured in `.env`.',
            },
        ],
        related: ['settings-general', 'system'],
    },
    {
        key: 'settings-security',
        title: 'Security settings',
        category: 'Configuration',
        summary: 'Sessions, re-confirmation of sensitive actions, account lockout, passkeys and admin area access.',
        minutes: 6,
        sections: [
            {
                heading: 'What users get',
                body: 'Every user has a Security page (Account → Security) with a security score, two-step verification, passkeys, a PIN with automatic screen lock, the list of signed in devices, trusted devices and recent sign-ins. These settings decide the rules for all of them.',
            },
            {
                heading: 'Sessions',
                points: [
                    'Keep me signed in for — how many days a device stays signed in when the user ticks "Keep me signed in". Every device gets its own token, so users and administrators can sign out a single device.',
                    'Sign out after inactivity — ends sessions that made no request for this many minutes. `0` disables it.',
                    'Maximum screen lock delay — forces the screen lock for everyone. Users can choose a shorter delay but not turn it off. `0` lets users decide.',
                    'Trust devices for — how long a browser may skip the two-step code after the user chose "Trust this device". `0` disables trusted devices.',
                ],
            },
            {
                heading: 'Sign-in protection',
                points: [
                    'Failed sign-ins before locking — the account is locked for the lock duration after this many wrong passwords or two-step codes, no matter from how many IP addresses they came. The owner gets an e-mail. `0` disables it.',
                    'Minimum password length — applies when users change or reset their password.',
                    'Allow passkeys — sign in with fingerprint, face, device PIN or security keys. A passkey sign in counts as two factors. Passkeys only work over HTTPS (or on `localhost`).',
                    'Security alert e-mails — new sign-in alerts (users can turn those off) and always-on alerts for password, e-mail, two-step, passkey and PIN changes.',
                ],
                warning:
                    'The account lock is checked after the password, so it never reveals whether an account exists.',
            },
            {
                heading: 'Sensitive actions',
                body: 'Creating or deleting API keys and SSH keys, changing subusers, deleting or restoring backups, deleting databases, rotating database passwords and reinstalling servers ask the user to confirm it is them with their PIN, password, two-step code or a passkey. Changing the security of the account itself (PIN, passkeys, recovery codes) never accepts the PIN.\n\nA confirmation stays valid for the configured minutes, so a series of actions only asks once. Requests made with API keys are not affected.',
                points: [
                    'Confirm changes in the admin area — administrators confirm before their first change in the admin area.',
                ],
            },
            {
                heading: 'Admin area access',
                body: 'Restrict the admin area (including `/api/admin`) to IP addresses or CIDR ranges, one per line or separated by commas. Leave it empty to allow every address. Saving is refused when your current address is not in the list, so you cannot lock yourself out.',
                tips: [
                    'Behind Cloudflare the real visitor address is used, see "Running behind Cloudflare".',
                    'Locked out anyway (for example after your IP address changed)? Run `php artisan raptor:admin-allowlist --clear` on the Panel server.',
                ],
            },
        ],
        faq: [
            {
                q: 'A user lost the phone with their passkey or authenticator app',
                a: 'Open the user in the admin area. The Account security card can disable two-step verification, remove all passkeys and trusted devices, reset the PIN and sign the user out everywhere.',
            },
            {
                q: 'An account may be compromised',
                a: 'Use "Sign out everywhere" on the user page and set a new password. Changing a password also signs out every other session and forgets trusted devices automatically.',
            },
        ],
        related: ['settings-general', 'users', 'cloudflare'],
    },
    {
        key: 'settings-advanced',
        title: 'Advanced settings',
        category: 'Configuration',
        summary: 'reCAPTCHA, timeouts when talking to nodes and automatic allocation creation for users.',
        minutes: 4,
        sections: [
            {
                heading: 'reCAPTCHA',
                body: 'Protects the login and password reset forms against bots with an invisible Google reCAPTCHA v2. Create keys at google.com/recaptcha/admin for your domain (type "reCAPTCHA v2 → Invisible").',
                warning:
                    'The keys shipped with the Panel are shared by every installation. Replace them with your own keys or disable reCAPTCHA.',
            },
            {
                heading: 'HTTP connections',
                points: [
                    'Connection timeout — seconds to wait while connecting to Wings before giving up.',
                    'Request timeout — seconds to wait for Wings to answer. Raise it if large file operations time out.',
                ],
            },
            {
                heading: 'Automatic allocation creation',
                body: 'When enabled, server owners can add additional ports themselves on their Network page (up to the allocation limit of the server). If no free allocation exists on the IP of the server, the Panel creates one from the port range given here.',
                tips: [
                    'Open the whole range in the node firewall so that automatically created ports work immediately.',
                ],
            },
        ],
        related: ['settings-general', 'allocations'],
    },
    {
        key: 'cloudflare',
        title: 'Running behind Cloudflare',
        category: 'Configuration',
        summary: "What works through Cloudflare's proxy, recommended settings and how to keep Wings reachable.",
        minutes: 6,
        sections: [
            {
                heading: 'What Raptor Panel does for you',
                points: [
                    "Cloudflare's IP ranges are trusted out of the box: the audit log, rate limits and API key IP restrictions see the real visitor address and HTTPS is detected correctly. Disable with `TRUSTED_PROXIES_CLOUDFLARE=false`.",
                    'Console websockets send a keepalive every 25 seconds, so Cloudflare (which closes idle websockets after ~100 seconds) never drops an idle console. Dead connections are detected and replaced automatically.',
                    'Rocket Loader and e-mail obfuscation are disabled for the scripts the Panel needs, so enabling them on the zone does not break the Panel.',
                    'The installer connects a local Wings to the Panel over the loopback interface, so Cloudflare challenges never block Wings.',
                ],
            },
            {
                heading: 'Recommended DNS setup',
                points: [
                    '`panel.example.com` → proxied (orange cloud). Only HTTP(S) to the Panel goes through Cloudflare.',
                    '`node1.example.com` → DNS only (grey cloud). Use this as the node FQDN. SFTP (2022) and game ports cannot be proxied by Cloudflare at all.',
                ],
                tips: [
                    'If the node must be proxied, use daemon port 8443 — Cloudflare only proxies HTTPS on 443, 2053, 2083, 2087, 2096 and 8443. Port 8080 is not proxied over HTTPS.',
                ],
            },
            {
                heading: 'Cloudflare dashboard settings',
                points: [
                    "SSL/TLS → Overview → **Full (strict)**, with a valid certificate on the origin (Let's Encrypt or a Cloudflare origin certificate).",
                    'Network → **WebSockets** on (default).',
                    'Security → Bots: if Bot Fight Mode is enabled, add a WAF skip rule for `/api/remote/*` when a remote Wings talks to the Panel through Cloudflare.',
                    'Caching: no special rules needed, the Panel sends the right cache headers. Do not enable "Cache Everything" for the Panel.',
                ],
                warning:
                    "Cloudflare's free plan limits request bodies to 100 MB. Keep the node upload size at 100 MiB or below, or use SFTP for larger files.",
            },
        ],
        related: ['nodes', 'ssl'],
    },
    {
        key: 'ssl',
        title: 'HTTPS and certificates',
        category: 'Configuration',
        summary: "Securing the Panel and Wings with Let's Encrypt.",
        minutes: 3,
        sections: [
            {
                heading: 'Panel',
                body: '`install.sh` requests a certificate with certbot automatically. To add one later:',
                code: [
                    {
                        language: 'Shell',
                        content:
                            'apt install -y certbot python3-certbot-nginx\ncertbot --nginx -d panel.example.com --redirect',
                    },
                ],
                steps: [
                    'Set `APP_URL=https://panel.example.com` in `.env`.',
                    'Run `php artisan config:cache` in the Panel directory.',
                ],
            },
            {
                heading: 'Wings',
                body: 'When the Panel uses HTTPS every node must use SSL too, see "Installing and configuring Wings". Certificates renew automatically every 60–90 days, Wings must be restarted after a renewal (the installer adds a certbot hook for that).',
            },
        ],
        related: ['node-configuration', 'cloudflare'],
    },
] as Guide[];
