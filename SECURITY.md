# Security Policy

## Supported Versions

Security fixes are provided for the latest released version of Raptor Panel.

## Reporting a Vulnerability

Please **do not** open a public issue for security problems. Instead report them privately using
[GitHub Security Advisories](https://github.com/brocker96/raptor-panel/security/advisories/new).

If the issue also affects the upstream Pterodactyl Panel or Wings, please report it to the Pterodactyl team as well.

## Known Pterodactyl advisories

Raptor Panel is a fork of Pterodactyl Panel. Every published Panel advisory was checked against this code base:

| Advisory | Issue | Status in Raptor |
| --- | --- | --- |
| CVE-2026-86177 | `schedule.update` alone could run console, power and backup tasks | Fixed for creating, editing and manually running schedules |
| CVE-2026-61609 | One shared login rate limit for every visitor (lockout) | Fixed, limited per IP address |
| CVE-2026-54593 | One JWT accepted for websocket, upload and download | Fixed, every token carries its scope |
| CVE-2026-35202, CVE-2025-69198 | Racing requests exceed database, allocation and backup limits | Fixed, the server row is locked during the check |
| GHSA-j7f5-gfqm-pcx3 | Email change reveals registered addresses | Fixed, rate limited per user before validation |
| CVE-2026-26016 | A node could read and change servers of other nodes | Fixed, every Remote API endpoint checks the node |
| GHSA-hr7j-63v7-vj7g, CVE-2025-68954 | SFTP sessions outlive deletion, password changes and lost permissions | Fixed on the Panel side, Wings is told to end the sessions (also when admin rights are removed) |
| CVE-2025-69197 | A TOTP code works more than once | Fixed, also against two racing requests |
| CVE-2025-69199 | No websocket limits in Wings | Wings issue, use a current Wings release |
| GHSA-mgr9-6c2j-jxrq, CVE-2024-34067, GHSA-5822-pw57-vv37 | XSS in admin pages | Fixed, admin messages and dynamic values are escaped |
| CVE-2025-49132 | Unauthenticated code execution through `/locales/locale.json` | Fixed, locale and namespace are strictly validated |
| CVE-2024-49762 | Password in the query string when disabling 2FA | Fixed, sent in the request body |
| GHSA-7v3x-h7r2-34jv | API keys created lasting web sessions | Fixed, API keys authenticate a single request |
| CVE-2021-41129 | 2FA checkpoint token taken from user input | Fixed, the login state lives in the session |
| CVE-2021-41273, CVE-2021-41176 | CSRF on state changing GET routes and logout | Fixed, POST with CSRF protection |
| GHSA-g8gw-6j32-8w7g, GHSA-6888-7f3w-92jx | Actions on or listing of servers without access | Fixed, every resource is checked against the server |
| GHSA-pjmh-7xfm-r4x9 | Unlimited API key creation | Fixed, 25 keys per user and a security confirmation |
| CVE-2019-1020002, GHSA-vcm9-hx3q-qwj8 | Account enumeration through the 2FA step | Fixed, the password is checked first |

Wings advisories (registry credential leaks, quota overflows, backup path traversal and SSRF, `{{config.*}}`
secret disclosure, SFTP crashes and others) are fixed in Wings itself. `wings.sh` and `raptor-wings update`
install the latest checksum verified Wings release. After upgrading from Wings older than 1.12.3, reset each
node's daemon token in the Panel.

### Found during the Raptor audit

* MySQL reads `_` and `%` in a `GRANT` database name as wildcards. A server database whose name starts with
  `_` gave its user access to a database of another server (`s1__shop` also matched `s11_shop`). Grants now
  escape the name. `php artisan raptor:database:repair-grants` narrows existing grants and runs on every update
  and during `migrate.sh`. Upstream Pterodactyl is affected as well.

## Hardening

* Dependencies are checked against the GitHub advisory database on every push and daily (`composer audit`,
  `yarn audit`), CodeQL scans the frontend and Dependabot opens update pull requests.
* Security headers: a base Content Security Policy that blocks framing, `<base>`, plugins and foreign form
  targets, HSTS over HTTPS, `Cross-Origin-Opener-Policy`, `Permissions-Policy`, `nosniff` and a strict referrer policy.
* Sensitive actions need a fresh security confirmation (password, TOTP, passkey or PIN), the admin area can be
  limited to IP addresses, and behind Cloudflare only `CF-Connecting-IP` is trusted for the visitor address.
* The updater installs only releases with a matching SHA-256 checksum and refuses archives that could write outside
  the Panel directory.
* The install scripts keep passwords and tokens out of their logs, and logs, `.env` and Wings configuration files are
  readable only by their owner.
