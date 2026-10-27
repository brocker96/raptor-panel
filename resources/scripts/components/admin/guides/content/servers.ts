import { Guide } from '@/components/admin/guides/types';

export default [
    {
        key: 'servers',
        title: 'Managing servers',
        category: 'Servers',
        summary: 'Finding servers, understanding their status and what each tab of a server lets you change.',
        minutes: 4,
        sections: [
            {
                heading: 'The server list',
                body: "The list shows every server on the Panel, regardless of who owns it. Searching matches the server name, its UUID, the external ID, the owner's username or e-mail and the IP, alias or port of its primary allocation. Typing `25565` therefore finds the server listening on that port.",
                points: [
                    'Node filter — only servers on one node, useful before maintenance.',
                    'Status filter — Installed, Installing, Install failed or Suspended.',
                    'Click a row to open the server, the identifier (8 characters) is what users see in their URLs.',
                ],
            },
            {
                heading: 'Statuses',
                points: [
                    'Installed — the install script finished and the server can be started by its owner.',
                    'Installing — the install script is running, or the server was manually marked as installing.',
                    'Install failed — the install script exited with an error. Check the console of the server for the output, fix the egg or variables and reinstall.',
                    'Suspended — the owner cannot start the server or access its files, it is stopped by Wings.',
                    'Restoring backup — a backup is being restored, most actions are locked until it finishes.',
                ],
            },
            {
                heading: 'Server tabs',
                points: [
                    'About — name, owner, description and external ID, plus a summary of everything else.',
                    'Build — CPU, memory, swap, disk, IO, threads, OOM killer, allocations and feature limits.',
                    'Startup — the egg, Docker image, startup command and environment variables.',
                    'Databases — MySQL databases created for the server on a database host.',
                    'Mounts — extra directories of the node made available inside the container.',
                    'Manage — reinstall, suspend, toggle install status, transfer to another node and delete.',
                ],
                tips: [
                    'Use **Open as user** to jump into the regular server view (console, files, schedules) of any server, even if you are not a subuser.',
                ],
            },
        ],
        related: ['server-create', 'server-build', 'server-startup', 'server-manage'],
    },
    {
        key: 'server-create',
        title: 'Creating a server',
        category: 'Servers',
        summary: 'Every field of the server creation form explained, with sensible values for common games.',
        minutes: 7,
        sections: [
            {
                heading: 'Before you start',
                body: 'You need at least one node that is online, one free allocation on it and an egg. Without a free allocation the server cannot be created.',
            },
            {
                heading: 'Core details',
                points: [
                    'Name — shown to the owner on their dashboard. Can be changed later by the owner.',
                    'Owner — the user that owns the server. Owners can add subusers with limited permissions themselves.',
                    'Description — optional, shown below the name.',
                    'External ID — optional identifier from a billing system (WHMCS, Paymenter, Blesta …). Must be unique, lets integrations find the server again.',
                ],
            },
            {
                heading: 'Egg and container',
                points: [
                    'Nest / Egg — decides what kind of server is installed. Changing the egg later re-uses the files of the server, so pick carefully.',
                    'Docker image — the runtime the server runs in, e.g. Java 21 for modern Minecraft. Eggs offer a list of images, you can also type a custom one.',
                    'Startup command — prefilled from the egg. Variables in `{{DOUBLE_BRACES}}` are replaced when the server starts.',
                    'Variables — settings defined by the egg (server version, jar file, max players …). Required variables must be filled in.',
                    'Skip egg install script — creates the server without running the install script, for when you will upload the files yourself.',
                    'Start when installed — starts the server automatically once installation finished.',
                ],
            },
            {
                heading: 'Resources',
                points: [
                    'Memory (MiB) — hard memory limit of the container. `0` means unlimited, which is not recommended. 1024 MiB = 1 GiB.',
                    'Swap (MiB) — additional swap the container may use. `0` disables swap, `-1` allows unlimited swap.',
                    'Disk (MiB) — disk space limit. Wings checks usage periodically and stops the server when it is exceeded.',
                    'CPU (%) — `100` is one full CPU thread, `200` two threads, `0` unlimited.',
                    'Block IO weight — relative disk priority between 10 and 1000, 500 is the default. Leave it unless you know you need it.',
                    'CPU pinning — optional list of host threads the server may run on, e.g. `0,1` or `0-3`. Leave empty to use all.',
                    'Disable OOM killer — when enabled the kernel does not kill the process when it hits the memory limit, it is frozen instead. Usually leave it off.',
                ],
                tips: [
                    'Minecraft (Paper): 4096 MiB memory, 0 swap, 10240 MiB disk, 200% CPU is a good start for ~20 players.',
                    'Java servers need about 15% more memory than the -Xmx value, the Paper egg already accounts for that.',
                ],
            },
            {
                heading: 'Network and limits',
                points: [
                    'Primary allocation — the IP and port players connect to. Exposed to the startup command as `{{SERVER_IP}}` / `{{SERVER_PORT}}`.',
                    'Additional allocations — extra ports for query, RCON, voice plugins and similar.',
                    'Database limit — how many databases the owner may create on their own. `0` disables the feature for them.',
                    'Allocation limit — how many additional ports the owner may add on their own (if automatic allocations are enabled in Settings → Advanced).',
                    'Backup limit — how many backups the owner may keep. `0` disables backups.',
                ],
            },
        ],
        faq: [
            {
                q: 'Creating fails with "no allocations available"',
                a: "The chosen node has no unassigned allocations left. Add more ports on the node's Allocations tab.",
            },
            {
                q: 'The server stays in "Installing" forever',
                a: 'Open the server console as the owner to see the install output. Common causes are a node that cannot pull the install image, wrong variables (e.g. a version that does not exist) or a firewall blocking downloads.',
            },
        ],
        related: ['server-build', 'server-startup', 'allocations', 'nests-eggs'],
    },
    {
        key: 'server-build',
        title: 'Build configuration: resources, allocations and limits',
        category: 'Servers',
        summary: 'Changing CPU, memory, disk, allocations and feature limits of an existing server.',
        minutes: 4,
        sections: [
            {
                heading: 'How changes are applied',
                body: 'Saving the build configuration updates the Panel and immediately tells Wings about the new limits. Memory, CPU and IO changes are applied to the running container right away. Changing allocations requires a restart of the server to take effect because the port bindings of a Docker container cannot change while it runs.',
                warning:
                    'Lowering the disk limit below the current usage will stop the server and prevent it from starting until files are removed.',
            },
            {
                heading: 'Allocations',
                points: [
                    'Primary allocation — the main address of the server. Choose another one from the list to change the address players use.',
                    'Add — assign free allocations of the node as additional ports.',
                    'Remove — release additional allocations so they can be used by other servers. The primary allocation cannot be removed, pick another primary first.',
                ],
            },
            {
                heading: 'Resource fields',
                body: 'The meaning of every resource field is the same as when creating a server, see the "Creating a server" guide. Units are MiB for memory, swap and disk and percent of a CPU thread for CPU.',
            },
        ],
        related: ['server-create', 'allocations'],
    },
    {
        key: 'server-startup',
        title: 'Startup: egg, image, command and variables',
        category: 'Servers',
        summary: 'Changing how a server starts, switching eggs and editing variables, including hidden ones.',
        minutes: 4,
        sections: [
            {
                heading: 'Startup command',
                body: 'The command executed inside the container when the server starts. Variables are written as `{{VARIABLE}}` and replaced with their values. Built-in variables are available on every server:',
                points: [
                    '`{{SERVER_MEMORY}}` — memory limit in MiB.',
                    '`{{SERVER_IP}}` and `{{SERVER_PORT}}` — the primary allocation.',
                    '`{{SERVER_UUID}}` — the UUID of the server.',
                    'Every egg variable, e.g. `{{SERVER_JARFILE}}`.',
                ],
                tips: ['Use **Reset to egg default** to restore the command from the egg after experimenting.'],
            },
            {
                heading: 'Variables',
                body: 'Variables are defined by the egg. As an administrator you see and can edit all of them, including variables hidden from the owner. Each variable is validated against the rules defined in the egg, for example `required|string|max:20`.',
            },
            {
                heading: 'Changing the egg',
                body: 'Switching to another egg changes the startup command, Docker image and variables. Files of the server are kept. Tick **Reinstall** in the Manage tab afterwards if the new egg needs its install script to run.',
                warning:
                    'Changing between unrelated eggs (e.g. Minecraft to Rust) leaves incompatible files behind. Wipe the files from the file manager first.',
            },
            {
                heading: 'Skip egg install script',
                body: 'When enabled, reinstalling the server does not run the install script of the egg. Useful for servers whose files are managed manually.',
            },
        ],
        related: ['egg-variables', 'nests-eggs'],
    },
    {
        key: 'server-manage',
        title: 'Reinstall, suspend, transfer and delete',
        category: 'Servers',
        summary: 'Server lifecycle actions and their consequences.',
        minutes: 5,
        sections: [
            {
                heading: 'Reinstall',
                body: 'Runs the install script of the egg again. The script decides what happens to existing files, most eggs only replace the server software (e.g. the jar file) and keep worlds and configs.',
                warning:
                    'Some install scripts delete everything in the server directory. Create a backup first if in doubt.',
            },
            {
                heading: 'Suspend / unsuspend',
                body: 'Suspending stops the server and locks the owner and subusers out of it: no console, no files, no SFTP. Nothing is deleted. Typical uses are unpaid invoices or abuse investigations. Unsuspending restores access immediately, the server has to be started again.',
            },
            {
                heading: 'Toggle install status',
                body: 'Switches the server between "installed" and "installing" without running anything. Use it when an install was interrupted (node rebooted mid-install) and the server is stuck as installing, or to lock the owner out while you prepare files.',
            },
            {
                heading: 'Transfer to another node',
                steps: [
                    'Make sure the target node is online and has enough free memory and disk for the server.',
                    'Choose the target node and a free allocation on it as the new primary allocation. Optionally pick additional allocations.',
                    'Start the transfer. The source node archives the server, the target node downloads and extracts it.',
                    'While the transfer runs the server cannot be started. Once finished the server runs on the new node with the new allocations, the old ones are released.',
                ],
                warning:
                    'Both nodes must be able to reach each other over HTTPS (or HTTP) on the Wings port. Large servers can take a long time to transfer.',
            },
            {
                heading: 'Delete',
                body: 'Deleting removes the server from Wings (including all files and backups stored on the node) and from the Panel. Databases are removed from their database host.',
                points: [
                    'Delete — fails if Wings cannot be reached, so nothing is left behind on the node.',
                    'Force delete — removes the server from the Panel even if Wings is offline. Files may remain on the node and must be cleaned manually from `/var/lib/pterodactyl/volumes/<uuid>`.',
                ],
                warning: 'Deletion cannot be undone.',
            },
        ],
        related: ['servers', 'nodes'],
    },
    {
        key: 'server-databases',
        title: 'Server databases',
        category: 'Servers',
        summary: 'Creating MySQL databases for servers and handing out the credentials.',
        minutes: 3,
        sections: [
            {
                heading: 'Creating a database',
                steps: [
                    'Make sure at least one database host exists (Databases in the sidebar).',
                    'Open the server, go to Databases and press **New database**.',
                    'Choose the host, a name (the Panel prefixes it with `s<server id>_`) and the hosts allowed to connect: `%` allows every address, `127.0.0.1` only the node itself if the database runs there.',
                    'The username and a random password are generated automatically. The owner sees the credentials in their Databases tab.',
                ],
            },
            {
                heading: 'Rotating a password',
                body: 'Use **Rotate password** if credentials leaked. Update the plugins or config files that use the database afterwards, the old password stops working immediately.',
            },
        ],
        related: ['database-hosts'],
    },
] as Guide[];
