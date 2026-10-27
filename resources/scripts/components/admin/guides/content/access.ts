import { Guide } from '@/components/admin/guides/types';

export default [
    {
        key: 'users',
        title: 'Users and administrators',
        category: 'Users & access',
        summary: 'Creating accounts, administrator permissions, two-factor authentication and deleting users.',
        minutes: 5,
        sections: [
            {
                heading: 'Creating users',
                points: [
                    'E-mail and username — both must be unique. Users can log in with either.',
                    'First and last name — shown in the activity log and to other users on shared servers.',
                    'Password — leave empty to send the user an e-mail with a link to choose their own password (requires working mail settings).',
                    'Administrator — gives full access to this admin area. Grant it sparingly.',
                ],
            },
            {
                heading: 'Administrators vs. subusers',
                body: 'Administrators can see and change everything. To give someone access to a single server use subusers instead: the server owner (or you, via **Open as user**) adds them on the Users tab of the server with fine grained permissions such as console, files or backups.',
            },
            {
                heading: 'Two-factor authentication',
                body: 'Users enable 2FA themselves on their account page. If a user lost their device, open the user and press **Disable 2FA**. They can then log in with only their password and set it up again.',
                tips: ['Settings → General can require 2FA for administrators or for everyone.'],
            },
            {
                heading: 'Deleting users',
                warning:
                    'A user that still owns servers cannot be deleted. Transfer the servers to another owner (Server → About → Owner) or delete them first. You cannot delete your own account here.',
            },
        ],
        faq: [
            {
                q: 'A user forgot their password',
                a: 'They can use "Forgot password" on the login page. Alternatively set a new password for them here and ask them to change it after logging in.',
            },
        ],
        related: ['settings-general', 'audit-log'],
    },
    {
        key: 'api-keys',
        title: 'Application API keys',
        category: 'Users & access',
        summary: 'Keys for billing systems and automation, permissions per resource and IP restrictions.',
        minutes: 5,
        sections: [
            {
                heading: 'Application vs. client keys',
                points: [
                    'Application keys (created here, prefix `ptla_`) access `/api/application` and can manage users, servers, nodes and more. Used by billing systems like WHMCS, Paymenter or Blesta.',
                    'Client keys (created by every user on their account page, prefix `ptlc_`) access `/api/client` and can only do what that user can do on their own servers.',
                ],
            },
            {
                heading: 'Creating a key',
                steps: [
                    'Press **Create key** and describe what it is for, e.g. "Paymenter billing".',
                    'For every resource choose None, Read or Read & write. Give the integration only what it needs, most billing systems need read & write on servers, users and allocations and read on everything else.',
                    'Optionally restrict the key to IP addresses or CIDR ranges, e.g. the address of your billing server.',
                    'Copy the key immediately. It is shown only once.',
                ],
                warning:
                    'An application key with write access to users can create administrators. Treat it like a root password.',
            },
            {
                heading: 'Using a key',
                code: [
                    {
                        language: 'Shell',
                        content:
                            'curl https://panel.example.com/api/application/servers \\\n  -H "Authorization: Bearer ptla_xxxxxxxxxxxxxxxx" \\\n  -H "Accept: application/json"',
                    },
                ],
            },
            {
                heading: 'Revoking',
                body: 'Revoking deletes the key immediately, requests using it start failing with 401. "Last used" helps spot keys that are no longer needed.',
            },
        ],
        related: ['audit-log'],
    },
    {
        key: 'audit-log',
        title: 'Audit log',
        category: 'Users & access',
        summary: 'Panel-wide history of logins, server actions and administrative changes.',
        minutes: 3,
        sections: [
            {
                heading: 'What is recorded',
                points: [
                    '`auth:*` — logins, failed logins, two-factor checkpoints, password resets.',
                    '`user:*` — account changes: e-mail, password, API keys, SSH keys, 2FA.',
                    '`server:*` — everything users do on servers: power actions, console commands, file edits, backups, schedules, subusers, SFTP logins.',
                    '`admin:*` — changes made in this admin area: users, servers, nodes, eggs, settings and more.',
                ],
            },
            {
                heading: 'Investigating',
                steps: [
                    'Use the scope buttons to narrow down to authentication, user, server or admin events.',
                    "Search matches the event name, the IP address, the actor's username or e-mail and the recorded properties (e.g. a file name).",
                    'Click an entry to see all recorded properties.',
                ],
                tips: [
                    "Behind Cloudflare the real visitor IP is recorded, Raptor Panel trusts Cloudflare's proxy addresses out of the box.",
                ],
            },
            {
                heading: 'Retention',
                body: 'Activity is pruned automatically by the scheduler, by default after 90 days. Change `APP_ACTIVITY_PRUNE_DAYS` in `.env` to keep it longer.',
            },
        ],
        related: ['users', 'cloudflare'],
    },
] as Guide[];
