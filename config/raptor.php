<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Restricted Environment
    |--------------------------------------------------------------------------
    |
    | Set this environment variable to true to enable a restricted configuration
    | setup on the panel. When set to true, configurations stored in the
    | database will not be applied.
    */

    'load_environment_only' => (bool) env('APP_ENVIRONMENT_ONLY', false),

    /*
    |--------------------------------------------------------------------------
    | Service Author
    |--------------------------------------------------------------------------
    |
    | Each panel installation is assigned a unique UUID to identify the
    | author of custom services, and make upgrades easier by identifying
    | standard Panel shipped services.
    */

    'service' => [
        'author' => env('APP_SERVICE_AUTHOR', 'unknown@unknown.com'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Authentication
    |--------------------------------------------------------------------------
    |
    | Should login success and failure events trigger an email to the user?
    */

    'auth' => [
        '2fa_required' => env('APP_2FA_REQUIRED', 0),
        '2fa' => [
            'bytes' => 32,
            'window' => env('APP_2FA_WINDOW', 4),
            'verify_newer' => true,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Account Security
    |--------------------------------------------------------------------------
    |
    | Policies for sessions, re-confirmation of sensitive actions, lockouts and
    | passkeys. All of them can be changed in Settings → Security.
    */

    'db_manager' => [
        // Seconds a single query of the Raptor DB Manager may run before the database stops it.
        'query_timeout' => (int) env('RAPTOR_DB_MANAGER_TIMEOUT', 30),
        // Rows returned per result in the SQL console.
        'max_result_rows' => (int) env('RAPTOR_DB_MANAGER_MAX_ROWS', 1000),
        // Statements run per console submission.
        'max_statements' => 50,
        // Largest SQL file that can be imported, in kilobytes.
        'max_import_kb' => (int) env('RAPTOR_DB_MANAGER_MAX_IMPORT_KB', 51200),
    ],

    'security' => [
        // How long "keep me signed in" lasts on a device, in days.
        'session_days' => (int) env('APP_SESSION_DAYS', 30),
        // Sign out sessions without any activity for this many minutes, 0 disables it.
        'idle_timeout' => (int) env('APP_IDLE_TIMEOUT', 0),
        // Minutes a successful re-confirmation stays valid for sensitive actions.
        'confirm_window' => (int) env('APP_CONFIRM_WINDOW', 10),
        // Require re-confirmation for changes made in the admin area.
        'confirm_admin' => (bool) env('APP_CONFIRM_ADMIN', true),
        // Failed logins (from any address) before an account is locked temporarily.
        'lockout_attempts' => (int) env('APP_LOCKOUT_ATTEMPTS', 10),
        'lockout_minutes' => (int) env('APP_LOCKOUT_MINUTES', 15),
        // E-mail users about sign-ins from new devices and important account changes.
        'alerts' => (bool) env('APP_SECURITY_ALERTS', true),
        'passkeys' => (bool) env('APP_PASSKEYS', true),
        // Days a device stays trusted after skipping the two-factor checkpoint, 0 disables it.
        'trusted_device_days' => (int) env('APP_TRUSTED_DEVICE_DAYS', 30),
        // Comma separated IP addresses or CIDR ranges allowed to open the admin area.
        'admin_allowlist' => env('APP_ADMIN_ALLOWLIST', ''),
        'password_min_length' => (int) env('APP_PASSWORD_MIN_LENGTH', 8),
        // Maximum minutes of inactivity before the screen locks, 0 lets users decide.
        'screen_lock_max' => (int) env('APP_SCREEN_LOCK_MAX', 0),
    ],

    /*
    |--------------------------------------------------------------------------
    | Pagination
    |--------------------------------------------------------------------------
    |
    | Certain pagination result counts can be configured here and will take
    | effect globally.
    */

    'paginate' => [
        'frontend' => [
            'servers' => env('APP_PAGINATE_FRONT_SERVERS', 15),
        ],
        'admin' => [
            'servers' => env('APP_PAGINATE_ADMIN_SERVERS', 25),
            'users' => env('APP_PAGINATE_ADMIN_USERS', 25),
        ],
        'api' => [
            'nodes' => env('APP_PAGINATE_API_NODES', 25),
            'servers' => env('APP_PAGINATE_API_SERVERS', 25),
            'users' => env('APP_PAGINATE_API_USERS', 25),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Guzzle Connections
    |--------------------------------------------------------------------------
    |
    | Configure the timeout to be used for Guzzle connections here.
    */

    /*
    |--------------------------------------------------------------------------
    | Cloudflare
    |--------------------------------------------------------------------------
    |
    | Defaults for running the Panel behind Cloudflare, all of them can be
    | changed in the admin area under Settings → Cloudflare.
    |
    */

    'cloudflare' => [
        'trust_proxies' => env('TRUSTED_PROXIES_CLOUDFLARE', true),
        'websocket_keepalive' => env('RAPTOR_WEBSOCKET_KEEPALIVE', true),
        // Stored as JSON by "Refresh IP ranges" in the admin area, empty means the built-in list.
        'ranges' => '',
        'ranges_updated_at' => '',
    ],

    /*
    |--------------------------------------------------------------------------
    | Updates
    |--------------------------------------------------------------------------
    |
    | The built-in updater looks for new releases of the repository below and
    | installs them from the admin area or with "php artisan raptor:update".
    | The "beta" channel also offers pre-releases.
    */

    'updates' => [
        'repository' => env('RAPTOR_UPDATE_REPOSITORY', 'brocker96/raptor-panel'),
        // Optional mirror returning the same JSON as the GitHub releases API.
        'feed' => env('RAPTOR_UPDATE_FEED'),
        'channel' => env('RAPTOR_UPDATE_CHANNEL', 'beta'),
        'auto_check' => env('RAPTOR_UPDATE_AUTO_CHECK', true),
        // Number of pre-update backups that are kept for rollbacks.
        'keep_backups' => (int) env('RAPTOR_UPDATE_KEEP_BACKUPS', 3),
    ],

    'guzzle' => [
        'timeout' => env('GUZZLE_TIMEOUT', 15),
        'connect_timeout' => env('GUZZLE_CONNECT_TIMEOUT', 5),
    ],

    /*
    |--------------------------------------------------------------------------
    | CDN
    |--------------------------------------------------------------------------
    |
    | Information for the panel to use when contacting the CDN to confirm
    | if panel is up to date.
    */

    'cdn' => [
        'cache_time' => 60,
        'url' => 'https://cdn.pterodactyl.io/releases/latest.json',
    ],

    /*
    |--------------------------------------------------------------------------
    | Client Features
    |--------------------------------------------------------------------------
    |
    | Allow clients to create their own databases.
    */

    'client_features' => [
        'databases' => [
            'enabled' => env('RAPTOR_CLIENT_DATABASES_ENABLED', env('PTERODACTYL_CLIENT_DATABASES_ENABLED', true)),
            'allow_random' => env('RAPTOR_CLIENT_DATABASES_ALLOW_RANDOM', env('PTERODACTYL_CLIENT_DATABASES_ALLOW_RANDOM', true)),
        ],

        'schedules' => [
            // The total number of tasks that can exist for any given schedule at once.
            'per_schedule_task_limit' => env('RAPTOR_PER_SCHEDULE_TASK_LIMIT', env('PTERODACTYL_PER_SCHEDULE_TASK_LIMIT', 10)),
        ],

        'allocations' => [
            'enabled' => env('RAPTOR_CLIENT_ALLOCATIONS_ENABLED', env('PTERODACTYL_CLIENT_ALLOCATIONS_ENABLED', false)),
            'range_start' => env('RAPTOR_CLIENT_ALLOCATIONS_RANGE_START', env('PTERODACTYL_CLIENT_ALLOCATIONS_RANGE_START')),
            'range_end' => env('RAPTOR_CLIENT_ALLOCATIONS_RANGE_END', env('PTERODACTYL_CLIENT_ALLOCATIONS_RANGE_END')),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | File Editor
    |--------------------------------------------------------------------------
    |
    | This array includes the MIME filetypes that can be edited via the web.
    */

    'files' => [
        'max_edit_size' => env('RAPTOR_FILES_MAX_EDIT_SIZE', env('PTERODACTYL_FILES_MAX_EDIT_SIZE', 1024 * 1024 * 4)),
    ],

    /*
    |--------------------------------------------------------------------------
    | Dynamic Environment Variables
    |--------------------------------------------------------------------------
    |
    | Place dynamic environment variables here that should be auto-appended
    | to server environment fields when the server is created or updated.
    |
    | Items should be in 'key' => 'value' format, where key is the environment
    | variable name, and value is the server-object key. For example:
    |
    | 'P_SERVER_CREATED_AT' => 'created_at'
    */

    'environment_variables' => [
        'P_SERVER_ALLOCATION_LIMIT' => 'allocation_limit',
    ],

    /*
    |--------------------------------------------------------------------------
    | Email Notification Settings
    |--------------------------------------------------------------------------
    |
    | This section controls what notifications are sent to users.
    */

    'email' => [
        // Should an email be sent to a server owner once their server has completed it's first install process?
        'send_install_notification' => env('RAPTOR_SEND_INSTALL_NOTIFICATION', env('PTERODACTYL_SEND_INSTALL_NOTIFICATION', true)),
        // Should an email be sent to a server owner whenever their server is reinstalled?
        'send_reinstall_notification' => env('RAPTOR_SEND_REINSTALL_NOTIFICATION', env('PTERODACTYL_SEND_REINSTALL_NOTIFICATION', true)),
    ],

    /*
    |--------------------------------------------------------------------------
    | Telemetry Settings
    |--------------------------------------------------------------------------
    |
    | This section controls the telemetry sent by Pterodactyl.
    */

    'telemetry' => [
        // Disabled by default: the upstream telemetry service collects data for Pterodactyl, not this fork.
        'enabled' => env('RAPTOR_TELEMETRY_ENABLED', env('PTERODACTYL_TELEMETRY_ENABLED', false)),
    ],

    'features' => [
        'new_server_identifiers' => (bool) env('RAPTOR_USE_SERVER_IDENTIFIERS', env('PTERODACTYL_USE_SERVER_IDENTIFIERS', false)),
    ],
];
