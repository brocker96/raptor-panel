# Raptor API

The Raptor API connects Raptor Panel to a billing system. The shop sells **packages**, and the Panel turns
them into running servers. There is one call to create a server, the same order is never created twice,
everything can be addressed by the billing system's own ids, and signed webhooks report back what happened.

- Base URL: `https://panel.example.com/api/raptor/v1`
- Format: JSON in, JSON out, `snake_case`, times in ISO 8601
- Stable: everything under `v1` stays compatible. New fields may be added, existing ones are not removed

## Contents

1. [Getting started in five minutes](#getting-started-in-five-minutes)
2. [Authentication and permissions](#authentication-and-permissions)
3. [Addressing resources](#addressing-resources)
4. [Packages](#packages)
5. [Servers](#servers)
6. [Users and sign in links](#users-and-sign-in-links)
7. [Webhooks](#webhooks)
8. [Retries and idempotency](#retries-and-idempotency)
9. [Errors](#errors)
10. [Lookup endpoints](#lookup-endpoints)
11. [Recipes for billing modules](#recipes-for-billing-modules)
12. [Configuration](#configuration)

---

## Getting started in five minutes

1. **Create packages.** Open *Admin → Packages → New package*. Pick the game (egg), the resources, the
   locations it may run in and the default variables. The **slug** (`minecraft-4gb`) is what the shop orders.
2. **Create a key.** Open *Admin → Raptor API → Create billing key*. The key has exactly the permissions the
   API needs. Restrict it to the IP address of your billing server.
3. **Test the connection:**

   ```bash
   curl https://panel.example.com/api/raptor/v1 -H "Authorization: Bearer $KEY"
   ```

   ```json
   {
     "api": "raptor",
     "version": "v1",
     "panel": { "name": "Raptor Panel", "version": "0.6.1", "url": "https://panel.example.com" },
     "key": { "identifier": "ptla_…", "permissions": { "servers": "write", "users": "write", "nodes": "read" } },
     "packages": 3
   }
   ```

4. **Sell your first server.** This call creates the customer if needed and deploys the server on the
   emptiest node that fits:

   ```bash
   curl -X POST https://panel.example.com/api/raptor/v1/servers \
     -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
     -d '{
       "package": "minecraft-4gb",
       "external_id": "order-1042",
       "user": { "email": "jane@example.com", "external_id": "client-7", "first_name": "Jane" },
       "login_link": true
     }'
   ```

5. **Add a webhook** in *Admin → Raptor API* so the shop hears about installs, suspensions and deletions.

---

## Authentication and permissions

Send an **application API key** as a bearer token:

```
Authorization: Bearer ptla_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
Accept: application/json
```

Browser sessions and account keys are refused, the Raptor API is only for server-to-server calls. Each
route needs a permission of the key:

| Endpoints | Permission |
| --- | --- |
| Everything | `servers: read` |
| Creating and changing servers, packages, webhooks | `servers: write` |
| Reading users | `users: read` |
| Creating users, sign in links, provisioning | `users: write` |
| `/eggs`, `/locations`, `/nodes` | `eggs`, `locations`, `nodes: read` |

Billing keys from *Admin → Raptor API* have all of them. `GET /` shows what the current key may do. Keys can
be limited to IP addresses, and requests are rate limited per key (`APP_API_APPLICATION_RATELIMIT`).

---

## Addressing resources

Every `{server}` and `{user}` in a path accepts the form the billing system already knows:

| Form | Example | Servers | Users |
| --- | --- | --- | --- |
| Billing id | `ext:order-1042` | ✓ | ✓ |
| Panel id | `15` | ✓ | ✓ |
| UUID | `9f8a2c1e-…` | ✓ | ✓ |
| Short identifier | `9f8a2c1e` | ✓ | |
| E-mail | `jane@example.com` | | ✓ |

`{package}` is the slug (`minecraft-4gb`) or the id. In most cases the module never needs to store a Panel
id: it uses `ext:<its own id>` everywhere.

---

## Packages

A package is a server template: everything except the owner. Manage packages in *Admin → Packages* or through
the API.

### Package object

```json
{
  "id": 3,
  "slug": "minecraft-4gb",
  "name": "Minecraft 4 GB",
  "description": "Paper, 4 GB RAM, 30 GB NVMe",
  "active": true,
  "egg": { "id": 5, "name": "Paper", "nest_id": 1 },
  "image": null,
  "startup": null,
  "environment": { "MINECRAFT_VERSION": "latest" },
  "limits": { "memory": 4096, "swap": 0, "disk": 30720, "io": 500, "cpu": 200, "threads": null, "oom_disabled": true },
  "feature_limits": { "databases": 2, "allocations": 1, "backups": 5 },
  "deploy": {
    "location_ids": [1, 2],
    "node_ids": [],
    "port_range": ["25565-25665"],
    "dedicated_ip": false,
    "start_on_completion": true
  },
  "metadata": { "price_eur": 7.99 },
  "sort": 1,
  "servers_count": 42
}
```

- Memory, swap and disk are in MiB. CPU is in percent of one core (`200` means two cores). `0` means unlimited.
- `image` and `startup` are `null` to use the defaults of the egg.
- `environment` holds defaults for the egg variables. The order can override them.
- `location_ids` / `node_ids` limit where servers go. Empty means every public node. Of the nodes that fit,
  the one with the most free memory is used.
- `port_range` lists ports or ranges for the main allocation. Empty means any free port.
- `metadata` is free JSON for the shop, such as prices, a badge or a description in other languages.

### Endpoints

| Method | Path | |
| --- | --- | --- |
| `GET` | `/packages` | All packages, `?active=1` for orderable ones |
| `GET` | `/packages/{package}` | One package |
| `GET` | `/packages/{package}/availability` | Can it be created right now? |
| `POST` | `/packages` | Create, same fields as the object but flat (see below) |
| `PATCH` | `/packages/{package}` | Change any field |
| `POST` | `/packages/{package}/duplicate` | Copy as an inactive `<slug>-copy` |
| `DELETE` | `/packages/{package}` | Servers made from it keep running |

Create and update take flat fields: `slug, name, description, active, egg_id, image, startup, environment,
memory, swap, disk, io, cpu, threads, oom_disabled, database_limit, allocation_limit, backup_limit,
location_ids, node_ids, port_range, dedicated_ip, start_on_completion, metadata, sort`.

**Availability** is meant for the shop page, so sold out plans can be hidden before somebody pays:

```json
{ "package": "minecraft-4gb", "active": true, "available": false, "reason": "no_node_with_capacity" }
```

`reason` is `no_node_with_capacity`, `no_free_allocation` or `null`.

---

## Servers

### Server object

```json
{
  "id": 15,
  "uuid": "9f8a2c1e-5b7d-4c0a-a1b2-3c4d5e6f7a8b",
  "identifier": "9f8a2c1e",
  "external_id": "order-1042",
  "name": "Minecraft 4 GB",
  "description": "",
  "state": "installing",
  "package": { "id": 3, "slug": "minecraft-4gb", "name": "Minecraft 4 GB" },
  "owner": { "id": 7, "uuid": "…", "external_id": "client-7", "username": "jane", "email": "jane@example.com" },
  "node": { "id": 2, "name": "de-fra-1", "location_id": 1 },
  "address": { "ip": "203.0.113.5", "alias": "play.example.com", "port": 25565, "display": "play.example.com:25565" },
  "limits": { "memory": 4096, "swap": 0, "disk": 30720, "io": 500, "cpu": 200, "threads": null, "oom_disabled": true },
  "feature_limits": { "databases": 2, "allocations": 1, "backups": 5 },
  "egg": { "id": 5, "name": "Paper" },
  "panel_url": "https://panel.example.com/server/9f8a2c1e",
  "installed_at": null,
  "created_at": "2026-10-29T12:00:00+00:00",
  "updated_at": "2026-10-29T12:00:00+00:00"
}
```

`state` is one of `installing`, `install_failed`, `reinstall_failed`, `suspended`, `restoring_backup` or
`active`. `address.display` can be shown to the customer as is.

### Create a server: `POST /servers`

| Field | | |
| --- | --- | --- |
| `package` | required | Slug or id |
| `user` | required | A reference (`"ext:client-7"`, an e-mail, an id), or an object to find or create the user, see below |
| `external_id` | recommended | The order or service id of the billing system. A second request with the same id returns the first server |
| `name`, `description` | | Default: the package name |
| `environment` | | Egg variables on top of the package defaults, e.g. `{"MINECRAFT_VERSION": "1.21.4"}` |
| `overrides` | | Limits on top of the package, for add-ons: `memory, swap, disk, io, cpu, threads, database_limit, allocation_limit, backup_limit` |
| `start_on_completion` | | Default from the package |
| `send_welcome_email` | | `true` by default. A new user gets the Panel e-mail with a link to set a password |
| `login_link` | | `true` adds a one time sign in link that opens the new server |

The user object is matched by `external_id`, then by `email`, and created when nothing matches:

```json
{ "email": "jane@example.com", "external_id": "client-7", "first_name": "Jane", "last_name": "Doe", "username": "jane", "password": "optional", "language": "de" }
```

The username is made from the e-mail address when it is missing (`jane.doe`, `jane.doe2`, …).

**201 Created:**

```json
{
  "existing": false,
  "server": { "...": "server object" },
  "user": { "id": 7, "uuid": "…", "external_id": "client-7", "username": "jane", "email": "jane@example.com", "created": true },
  "login_link": { "url": "https://panel.example.com/auth/link/…", "expires_at": "2026-10-29T12:05:00+00:00" }
}
```

**200 OK** with `"existing": true` when a server with this `external_id` exists already. **409** when no node
has room: show "out of stock" and retry later.

The server is created right away in the `installing` state. The `server.installed` webhook fires when Wings
has finished installing it.

### Manage servers

| Method | Path | Body | |
| --- | --- | --- | --- |
| `GET` | `/servers` | | `?external_id=`, `?user=`, `?package=`, `?state=`, `?page=`, `?per_page=` (max 100) |
| `GET` | `/servers/{server}` | | |
| `GET` | `/servers/{server}/resources` | | Live usage from Wings |
| `PATCH` | `/servers/{server}` | `name, description, external_id, owner` | `owner` takes any user reference |
| `PUT` | `/servers/{server}/package` | `package, overrides?` | Upgrade or downgrade. Limits change, files and game stay |
| `PATCH` | `/servers/{server}/limits` | any limit | Single changes, e.g. `{"memory": 6144}` for a RAM add-on |
| `POST` | `/servers/{server}/suspend` | | Overdue invoice |
| `POST` | `/servers/{server}/unsuspend` | | Paid |
| `POST` | `/servers/{server}/reinstall` | | Runs the install script again |
| `POST` | `/servers/{server}/power` | `signal: start, stop, restart, kill` | 204 |
| `DELETE` | `/servers/{server}` | `?force=1` deletes even if the node is offline | 204, cancelled or terminated service |

`GET /servers/{server}/resources`:

```json
{
  "state": "running",
  "suspended": false,
  "cpu": 37.5,
  "memory_bytes": 2684354560,
  "memory_limit_bytes": 4294967296,
  "disk_bytes": 6442450944,
  "network_rx_bytes": 104857600,
  "network_tx_bytes": 524288000,
  "uptime_ms": 7380000
}
```

Returns **502** when the node is unreachable.

---

## Users and sign in links

### User object

```json
{
  "id": 7, "uuid": "…", "external_id": "client-7", "username": "jane", "email": "jane@example.com",
  "first_name": "Jane", "last_name": "Doe", "language": "de", "admin": false, "2fa": true,
  "servers_count": 2, "created_at": "…"
}
```

| Method | Path | |
| --- | --- | --- |
| `GET` | `/users` | `?email=`, `?external_id=`, `?username=` |
| `GET` | `/users/{user}` | |
| `GET` | `/users/{user}/servers` | All servers of the user |
| `POST` | `/users` | **Upsert**: matched by `external_id`, then `email`. 201 when created, 200 when updated, both with `"created"` |
| `PATCH` | `/users/{user}` | `email, external_id, first_name, last_name, password, language` |
| `POST` | `/users/{user}/login-link` | `redirect?` (a Panel path, default `/`) |
| `DELETE` | `/users/{user}` | 409 while the user still owns servers |

E-mail addresses are stored in lower case. A password changed through the API signs the user out everywhere,
like a password change in the Panel.

### Sign in links

The "Open control panel" button of the shop:

```bash
curl -X POST https://panel.example.com/api/raptor/v1/users/ext:client-7/login-link \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{ "redirect": "/server/9f8a2c1e" }'
```

```json
{ "url": "https://panel.example.com/auth/link/Xy…", "expires_at": "2026-10-29T12:05:00+00:00" }
```

Redirect the browser to `url`. A link works **once** and expires after 5 minutes
(`RAPTOR_API_LOGIN_LINK_MINUTES`). Create it when the button is clicked, not when the page loads. For safety:

- `redirect` is always a path inside the Panel, a link never sends anybody to another site
- accounts with two-factor authentication and locked accounts are sent to the normal sign in page
- links for administrators are refused unless `RAPTOR_API_ADMIN_LOGIN_LINKS=true`
- every use is written to the activity log of the user

---

## Webhooks

The Panel posts an event to every webhook that wants it:

| Event | When |
| --- | --- |
| `server.created` | A server was created (API, admin area, anywhere) |
| `server.installed` | Wings finished installing or reinstalling it, the server is ready |
| `server.install_failed` | The install script failed |
| `server.suspended` / `server.unsuspended` | Suspension changed |
| `server.package_changed` | It moved to another package |
| `server.deleted` | It was deleted |
| `user.created` / `user.deleted` | Accounts |
| `ping` | The test button in the admin area, or `POST /webhooks/{id}/test` |

### Delivery

```
POST https://billing.example.com/raptor/webhook
Content-Type: application/json
User-Agent: Raptor-Panel-Webhooks/1
X-Raptor-Event: server.installed
X-Raptor-Delivery: 4f6c1a2e-…            (unique, use it to ignore duplicates)
X-Raptor-Signature: t=1761739200,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
```

```json
{
  "id": "4f6c1a2e-…",
  "event": "server.installed",
  "created_at": "2026-10-29T12:03:12+00:00",
  "data": { "server": { "...": "server object" } }
}
```

Answer with any 2xx within 10 seconds. Anything else is retried after 10 s, 1 min, 5 min, 15 min, 30 min,
1 h and 2 h. The last 100 deliveries of every webhook, with status, time and payload, can be viewed and sent
again in *Admin → Raptor API*.

### Verifying the signature

`v1` is the HMAC-SHA256 of `"<t>.<raw body>"` with the secret of the webhook. Reject requests with a
mismatch or an old `t`.

**PHP**

```php
function raptor_verify(string $body, string $header, string $secret, int $tolerance = 300): bool
{
    parse_str(str_replace(',', '&', $header), $parts);
    if (empty($parts['t']) || empty($parts['v1']) || abs(time() - (int) $parts['t']) > $tolerance) {
        return false;
    }

    return hash_equals(hash_hmac('sha256', $parts['t'] . '.' . $body, $secret), $parts['v1']);
}

$body = file_get_contents('php://input');
if (!raptor_verify($body, $_SERVER['HTTP_X_RAPTOR_SIGNATURE'] ?? '', getenv('RAPTOR_WEBHOOK_SECRET'))) {
    http_response_code(401);
    exit;
}
$event = json_decode($body, true);
```

**Node.js**

```js
const crypto = require('crypto');

function raptorVerify(rawBody, header, secret, tolerance = 300) {
    const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
    if (!parts.t || !parts.v1 || Math.abs(Date.now() / 1000 - Number(parts.t)) > tolerance) return false;
    const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}
```

Use the **raw** request body, not re-encoded JSON.

### Managing webhooks through the API

| Method | Path | |
| --- | --- | --- |
| `GET` | `/webhooks` | Webhooks and the list of events |
| `POST` | `/webhooks` | `url, events? (empty = all), description?, active?`. The answer holds the `secret`, shown once |
| `PATCH` | `/webhooks/{id}` | |
| `POST` | `/webhooks/{id}/rotate-secret` | New secret, shown once |
| `POST` | `/webhooks/{id}/test` | Sends `ping` |
| `GET` | `/webhooks/{id}/deliveries` | The last 50 |
| `POST` | `/webhooks/{id}/deliveries/{delivery}/redeliver` | |
| `DELETE` | `/webhooks/{id}` | |

---

## Retries and idempotency

Networks fail and workers crash. Two mechanisms make retrying always safe:

1. **`external_id` on `POST /servers`.** The same order never creates a second server, the retry gets the
   first one with `"existing": true`.
2. **The `Idempotency-Key` header** works on every `POST`, `PUT`, `PATCH` and `DELETE`:

   ```
   Idempotency-Key: invoice-5531-suspend
   ```

   The first answer is stored for 24 hours (`RAPTOR_API_IDEMPOTENCY_TTL`). Repeating the request returns it
   again with `Idempotent-Replayed: true`. Reusing a key for a different request gives **422**. A request still
   running with the same key gives **409**. Answers with 5xx are not stored, so they can be retried.

---

## Errors

Errors use the format of the other Panel APIs:

```json
{
  "errors": [
    {
      "code": "ValidationException",
      "status": "422",
      "detail": "The package field is required.",
      "meta": { "source_field": "package", "rule": "required" }
    }
  ]
}
```

| Status | Meaning |
| --- | --- |
| 400 | The action is not possible in the current state, `detail` says why |
| 401 | Missing or wrong key |
| 403 | Wrong kind of key, a permission is missing, or the IP is not allowed |
| 404 | No resource matches the reference |
| 409 | No capacity for the package, the user still owns servers, or a duplicate request is still running |
| 422 | Validation failed, see `meta.source_field` |
| 429 | Rate limit, retry after the `Retry-After` header |
| 502 | The node of the server could not be reached |

---

## Lookup endpoints

Mainly for building package forms in a billing module:

- `GET /eggs` returns every egg with its nest, Docker images, startup command and variables (`env`, `default`,
  `rules`, `user_editable`)
- `GET /locations` returns locations with their node count
- `GET /nodes` returns nodes with used and total memory and disk in MiB, including over-allocation

---

## Recipes for billing modules

The usual hooks of a billing system, each with the Raptor API call it needs:

| Billing event | Call |
| --- | --- |
| Test connection | `GET /` |
| Product page | `GET /packages?active=1`, `GET /packages/{slug}/availability` |
| Order paid / service created | `POST /servers` with `external_id = service id`, `Idempotency-Key = service id` |
| Invoice overdue | `POST /servers/ext:{service}/suspend` |
| Invoice paid | `POST /servers/ext:{service}/unsuspend` |
| Upgrade or downgrade | `PUT /servers/ext:{service}/package` |
| Add-on bought | `PATCH /servers/ext:{service}/limits` |
| Service terminated | `DELETE /servers/ext:{service}` |
| "Open control panel" | `POST /users/ext:{client}/login-link` with `redirect=/server/{identifier}`, then redirect |
| Client changed e-mail | `PATCH /users/ext:{client}` |
| Show usage in the client area | `GET /servers/ext:{service}/resources` |
| Mark the service ready | Webhook `server.installed` |

A minimal PHP client:

```php
final class Raptor
{
    public function __construct(private string $url, private string $key) {}

    public function call(string $method, string $path, array $body = [], ?string $idempotencyKey = null): array
    {
        $ch = curl_init(rtrim($this->url, '/') . $path);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_HTTPHEADER => array_filter([
                'Authorization: Bearer ' . $this->key,
                'Content-Type: application/json',
                'Accept: application/json',
                $idempotencyKey ? 'Idempotency-Key: ' . $idempotencyKey : null,
            ]),
            CURLOPT_POSTFIELDS => $body ? json_encode($body) : null,
        ]);
        $response = json_decode((string) curl_exec($ch), true) ?? [];
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        if ($status >= 400) {
            throw new RuntimeException($response['errors'][0]['detail'] ?? "Raptor API error $status");
        }

        return $response;
    }
}

$raptor = new Raptor('https://panel.example.com/api/raptor/v1', getenv('RAPTOR_KEY'));
$result = $raptor->call('POST', '/servers', [
    'package' => 'minecraft-4gb',
    'external_id' => 'service-' . $serviceId,
    'user' => ['email' => $client->email, 'external_id' => 'client-' . $client->id, 'first_name' => $client->firstName],
], 'service-' . $serviceId);
```

---

## Configuration

`.env` options of the Raptor API:

| Variable | Default | |
| --- | --- | --- |
| `RAPTOR_API_LOGIN_LINK_MINUTES` | `5` | Lifetime of sign in links |
| `RAPTOR_API_ADMIN_LOGIN_LINKS` | `false` | Allow sign in links for administrators |
| `RAPTOR_API_IDEMPOTENCY_TTL` | `86400` | Seconds an `Idempotency-Key` answer is replayed |
| `APP_API_APPLICATION_RATELIMIT` | `256` | Requests per minute per key |

Webhooks are sent by the queue worker. Make sure `raptorq` (or your `queue:work` service) is running.
