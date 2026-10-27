import { Guide } from '@/components/admin/guides/types';

export default [
    {
        key: 'nests-eggs',
        title: 'Nests and eggs',
        category: 'Nests & eggs',
        summary: 'How eggs describe a server type, importing community eggs and keeping them up to date.',
        minutes: 5,
        sections: [
            {
                heading: 'Concepts',
                points: [
                    'Nest — a folder for eggs, e.g. "Minecraft". Nests have no settings of their own besides a name and description.',
                    'Egg — everything needed to install and run one kind of server: Docker images, startup command, how to detect that the server started, how to stop it, configuration files to rewrite, variables and the install script.',
                ],
            },
            {
                heading: 'Importing eggs',
                body: 'Thousands of ready-made eggs exist for almost every game. They are distributed as JSON files (the Pterodactyl egg format, which Raptor Panel uses unchanged).',
                steps: [
                    'Download the egg JSON, for example from the community "pelican-eggs" / "parkervcp eggs" repositories on GitHub.',
                    'Open the nest the egg belongs to (create one if needed) and press **Import egg**.',
                    'Choose the file. The egg is created with all variables and its install script.',
                ],
                tips: [
                    'To update an existing egg to a newer version of the same file use **Update from file** on the egg. Servers using it keep working, only the egg configuration is replaced.',
                ],
            },
            {
                heading: 'Exporting eggs',
                body: 'Press **Export** on an egg to download it as JSON. Use this to back up custom eggs or move them to another Panel.',
            },
            {
                heading: 'Deleting',
                warning:
                    'Eggs and nests that are used by servers cannot be deleted. Move the servers to another egg first (Server → Startup).',
            },
        ],
        related: ['egg-configuration', 'egg-variables', 'egg-install-script'],
    },
    {
        key: 'egg-configuration',
        title: 'Egg configuration',
        category: 'Nests & eggs',
        summary: 'Docker images, startup command, startup detection, stop command, log and file parsers.',
        minutes: 8,
        sections: [
            {
                heading: 'General',
                points: [
                    'Name / description — shown when choosing an egg.',
                    'Docker images — one per line. Use `Display name|image` to show a friendly name, e.g. `Java 21|ghcr.io/pterodactyl/yolks:java_21`. Users can switch between these images on their Startup page.',
                    'Startup command — the default startup command for new servers, see "Startup: egg, image, command and variables".',
                    'Features — flags that enable extra behaviour in the server view, e.g. `eula` (shows the Minecraft EULA popup), `java_version` (offers to switch the Java image), `pid_limit`.',
                    'File denylist — files the owner cannot open or edit in the file manager, one per line. Supports wildcards.',
                    'Force outgoing IP — makes outgoing traffic of the server use the IP of its primary allocation. Needed on machines with several public IPs.',
                ],
            },
            {
                heading: 'Process management',
                body: 'These fields tell Wings how to handle the process. They can be inherited from another egg in the same nest with **Copy settings from**.',
                points: [
                    'Startup configuration — JSON telling Wings which console line means "started". Example: `{"done": ")! For help, type "}`. Several strings can be given as an array.',
                    'Stop command — sent to the console to stop the server gracefully, e.g. `stop` or `quit`. Use `^C` to send a SIGINT signal instead of a console command.',
                    'Log configuration — legacy JSON, normally `{}`.',
                    'Configuration files — JSON describing files Wings rewrites before every start, so that ports and memory always match the Panel.',
                ],
                code: [
                    {
                        label: 'Configuration files example (Minecraft)',
                        language: 'JSON',
                        content:
                            '{\n    "server.properties": {\n        "parser": "properties",\n        "find": {\n            "server-ip": "0.0.0.0",\n            "server-port": "{{server.build.default.port}}",\n            "query.port": "{{server.build.default.port}}"\n        }\n    }\n}',
                    },
                ],
                tips: [
                    'Available parsers: `properties`, `ini`, `yaml`, `json`, `xml` and `file` (plain search & replace by line prefix).',
                ],
            },
        ],
        related: ['egg-variables', 'egg-install-script'],
    },
    {
        key: 'egg-variables',
        title: 'Egg variables',
        category: 'Nests & eggs',
        summary: 'Defining settings users can change, with validation rules and visibility.',
        minutes: 5,
        sections: [
            {
                heading: 'Fields',
                points: [
                    'Name / description — shown to users on the Startup page.',
                    'Environment variable — the name used in the startup command and install script, e.g. `SERVER_JARFILE`. Uppercase letters, numbers and underscores. Reserved names such as `SERVER_MEMORY` or `P_SERVER_UUID` cannot be used.',
                    'Default value — used for new servers.',
                    'Users can view — the owner sees the variable on their Startup page.',
                    'Users can edit — the owner may change the value. Requires "Users can view".',
                    'Validation rules — Laravel validation rules the value must pass, separated by `|`.',
                ],
            },
            {
                heading: 'Useful validation rules',
                points: [
                    '`required|string|max:20` — any text up to 20 characters.',
                    '`nullable|string` — optional text.',
                    '`required|integer|between:1,100` — a whole number in a range.',
                    '`required|boolean` — accepts true/false/1/0.',
                    '`required|in:vanilla,paper,purpur` — one of a fixed list, users get a dropdown.',
                    '`required|regex:/^[\\w.-]+\\.jar$/` — a value matching a pattern, here a jar file name.',
                    '`nullable|url` — an optional URL.',
                ],
                tips: ['Use `in:` rules wherever possible: they render as a dropdown and prevent typos.'],
            },
        ],
        related: ['egg-configuration', 'server-startup'],
    },
    {
        key: 'egg-install-script',
        title: 'Install scripts',
        category: 'Nests & eggs',
        summary: 'How the install script of an egg runs and how to write one.',
        minutes: 5,
        sections: [
            {
                heading: 'How install scripts run',
                body: 'When a server is created or reinstalled, Wings starts a temporary container from the install image, mounts the server directory at `/mnt/server` and runs the script with the entrypoint. All egg variables are available as environment variables. When the script exits with code 0 the server is marked as installed.',
                points: [
                    'Install container — the image the script runs in, e.g. `ghcr.io/pterodactyl/installers:debian` or `ghcr.io/pterodactyl/installers:alpine`.',
                    'Entrypoint — the interpreter, usually `bash` or `ash` (Alpine).',
                    'Copy script from — reuse the install script of another egg in the same nest. Eggs that copy a script cannot be used as a source themselves.',
                ],
            },
            {
                heading: 'Example',
                code: [
                    {
                        language: 'Shell',
                        content:
                            '#!/bin/bash\n# Paper install script\ncd /mnt/server\n\nVERSION=${MINECRAFT_VERSION:-latest}\nif [ "$VERSION" == "latest" ]; then\n  VERSION=$(curl -s https://api.papermc.io/v2/projects/paper | jq -r \'.versions[-1]\')\nfi\nBUILD=$(curl -s https://api.papermc.io/v2/projects/paper/versions/$VERSION | jq -r \'.builds[-1]\')\n\ncurl -o ${SERVER_JARFILE} https://api.papermc.io/v2/projects/paper/versions/$VERSION/builds/$BUILD/downloads/paper-$VERSION-$BUILD.jar\necho "eula=true" > eula.txt',
                    },
                ],
                tips: [
                    'Write files to `/mnt/server`, everything else is discarded with the install container.',
                    'Install output is visible in the server console while it runs, add `echo` lines to make debugging easier.',
                ],
            },
        ],
        related: ['egg-configuration', 'server-manage'],
    },
] as Guide[];
