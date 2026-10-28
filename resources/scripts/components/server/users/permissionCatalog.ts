import React from 'react';
import {
    ArchiveIcon,
    ClipboardListIcon,
    ClockIcon,
    CogIcon,
    DatabaseIcon,
    FolderIcon,
    GlobeAltIcon,
    PlayIcon,
    TerminalIcon,
    UsersIcon,
} from '@heroicons/react/outline';
import { t } from '@/i18n';

type Icon = React.ComponentType<React.ComponentProps<'svg'>>;

export interface PermissionGroup {
    key: string;
    label: string;
    description: string;
    icon: Icon;
    permissions: { key: string; label: string; description: string; danger?: boolean }[];
}

/**
 * Human friendly names and explanations for every subuser permission, in the order they are shown.
 * Permissions the API knows but this list does not are appended by the editor automatically.
 */
export const permissionGroups = (): PermissionGroup[] => [
    {
        key: 'control',
        label: t('Console and power'),
        description: t('Watch the console, send commands and start or stop the server.'),
        icon: TerminalIcon,
        permissions: [
            {
                key: 'control.console',
                label: t('Send console commands'),
                description: t('Type commands into the server console.'),
            },
            {
                key: 'control.start',
                label: t('Starting the server'),
                description: t('Start the server when it is offline.'),
            },
            { key: 'control.stop', label: t('Stopping the server'), description: t('Stop or kill the server process.') },
            {
                key: 'control.restart',
                label: t('Restarting the server'),
                description: t('Restart the server, which also starts it when it is offline.'),
            },
        ],
    },
    {
        key: 'file',
        label: t('Files'),
        description: t('Browse and change the files of the server in the panel or over SFTP.'),
        icon: FolderIcon,
        permissions: [
            {
                key: 'file.read',
                label: t('List files'),
                description: t('See folders and file names, but not their content.'),
            },
            {
                key: 'file.read-content',
                label: t('Open and download files'),
                description: t('Read the content of files and download them.'),
            },
            {
                key: 'file.create',
                label: t('Create and upload files'),
                description: t('Create new files and folders and upload files.'),
            },
            {
                key: 'file.update',
                label: t('Edit files'),
                description: t('Change, rename, move and copy existing files.'),
            },
            { key: 'file.delete', label: t('Delete files'), description: t('Delete files and folders.'), danger: true },
            { key: 'file.archive', label: t('Archives'), description: t('Create archives and extract them.') },
            {
                key: 'file.sftp',
                label: t('SFTP access'),
                description: t('Connect with an SFTP client, using the file permissions chosen above.'),
            },
        ],
    },
    {
        key: 'backup',
        label: t('Backups'),
        description: t('Create backups of the server and restore them.'),
        icon: ArchiveIcon,
        permissions: [
            { key: 'backup.read', label: t('View backups'), description: t('See the list of backups.') },
            { key: 'backup.create', label: t('Create backups'), description: t('Make new backups of the server.') },
            {
                key: 'backup.download',
                label: t('Download backups'),
                description: t('Download backups, which contain every file of the server.'),
                danger: true,
            },
            {
                key: 'backup.restore',
                label: t('Restore backups'),
                description: t('Restore a backup, which can replace or delete the current files.'),
                danger: true,
            },
            {
                key: 'backup.delete',
                label: t('Delete backups'),
                description: t('Delete backups permanently.'),
                danger: true,
            },
        ],
    },
    {
        key: 'database',
        label: t('Databases'),
        description: t('MySQL databases of the server and the Raptor DB Manager.'),
        icon: DatabaseIcon,
        permissions: [
            {
                key: 'database.read',
                label: t('View databases'),
                description: t('See the databases and their connection details.'),
            },
            {
                key: 'database.create',
                label: t('Create databases'),
                description: t('Create new databases for the server.'),
            },
            {
                key: 'database.update',
                label: t('Rotate passwords'),
                description: t('Generate a new password for a database.'),
            },
            {
                key: 'database.view_password',
                label: t('View passwords'),
                description: t('See the password of each database.'),
                danger: true,
            },
            {
                key: 'database.manage',
                label: t('Use the DB Manager'),
                description: t('Browse, edit and query the data inside the databases in the panel.'),
                danger: true,
            },
            {
                key: 'database.delete',
                label: t('Delete databases'),
                description: t('Delete databases and all of their data.'),
                danger: true,
            },
        ],
    },
    {
        key: 'schedule',
        label: t('Schedules'),
        description: t('Automatic tasks such as restarts, commands and backups.'),
        icon: ClockIcon,
        permissions: [
            { key: 'schedule.read', label: t('View schedules'), description: t('See schedules and their tasks.') },
            { key: 'schedule.create', label: t('Create schedules'), description: t('Create new schedules.') },
            {
                key: 'schedule.update',
                label: t('Edit and run schedules'),
                description: t('Change schedules and tasks and run them now.'),
            },
            { key: 'schedule.delete', label: t('Delete schedules'), description: t('Delete schedules.') },
        ],
    },
    {
        key: 'allocation',
        label: t('Network'),
        description: t('IP addresses and ports of the server.'),
        icon: GlobeAltIcon,
        permissions: [
            {
                key: 'allocation.read',
                label: t('View ports'),
                description: t('See every port assigned to the server.'),
            },
            {
                key: 'allocation.create',
                label: t('Add ports'),
                description: t('Add more ports, within the limit of the server.'),
            },
            {
                key: 'allocation.update',
                label: t('Edit ports'),
                description: t('Change the primary port and add notes.'),
            },
            { key: 'allocation.delete', label: t('Remove ports'), description: t('Remove additional ports.') },
        ],
    },
    {
        key: 'startup',
        label: t('Startup'),
        description: t('Startup variables and the Docker image.'),
        icon: PlayIcon,
        permissions: [
            { key: 'startup.read', label: t('View startup'), description: t('See the startup command and variables.') },
            { key: 'startup.update', label: t('Change variables'), description: t('Change the startup variables.') },
            {
                key: 'startup.docker-image',
                label: t('Change the Docker image'),
                description: t('Switch to another Docker image offered by the egg.'),
            },
        ],
    },
    {
        key: 'settings',
        label: t('Settings'),
        description: t('Name of the server and reinstalling it.'),
        icon: CogIcon,
        permissions: [
            {
                key: 'settings.rename',
                label: t('Rename the server'),
                description: t('Change the name and description.'),
            },
            {
                key: 'settings.reinstall',
                label: t('Reinstall the server'),
                description: t('Run the install script again, which can delete files.'),
                danger: true,
            },
        ],
    },
    {
        key: 'user',
        label: t('Users'),
        description: t('Other people with access. Nobody can give permissions they do not have themselves.'),
        icon: UsersIcon,
        permissions: [
            {
                key: 'user.read',
                label: t('View users'),
                description: t('See the users of the server and their permissions.'),
            },
            { key: 'user.create', label: t('Invite users'), description: t('Give new people access.'), danger: true },
            {
                key: 'user.update',
                label: t('Edit users'),
                description: t('Change the permissions of other users.'),
                danger: true,
            },
            { key: 'user.delete', label: t('Remove users'), description: t('Take access away from other users.') },
        ],
    },
    {
        key: 'activity',
        label: t('Activity'),
        description: t('The log of everything that happened on the server.'),
        icon: ClipboardListIcon,
        permissions: [
            { key: 'activity.read', label: t('View the activity log'), description: t('See who did what and when.') },
        ],
    },
];

export interface RolePreset {
    key: string;
    label: string;
    description: string;
    /** Permissions of the role, a group key selects every permission of that group. */
    grants: string[];
}

const VIEW = [
    'activity.read',
    'file.read',
    'backup.read',
    'database.read',
    'schedule.read',
    'allocation.read',
    'startup.read',
    'user.read',
];
const OPERATOR = [...VIEW, 'control'];
const DEVELOPER = [
    ...OPERATOR,
    'file',
    'backup.create',
    'backup.download',
    'database.create',
    'database.update',
    'database.view_password',
    'database.manage',
    'schedule',
    'startup.update',
    'startup.docker-image',
];

export const rolePresets = (): RolePreset[] => [
    {
        key: 'viewer',
        label: t('Viewer'),
        description: t('Watches the console and looks around, cannot change anything.'),
        grants: VIEW,
    },
    {
        key: 'operator',
        label: t('Operator'),
        description: t(
            'Viewer who can also start, stop and restart the server and send commands. Good for moderators.'
        ),
        grants: OPERATOR,
    },
    {
        key: 'developer',
        label: t('Developer'),
        description: t('Operator who also works with files, SFTP, databases, schedules and backups.'),
        grants: DEVELOPER,
    },
    {
        key: 'admin',
        label: t('Co-owner'),
        description: t('Everything you are allowed to do yourself, including managing other users.'),
        grants: ['*'],
    },
];

/** Resolves the grants of a preset into concrete permission keys. */
export const expandGrants = (grants: string[], all: string[]): string[] => {
    if (grants.includes('*')) return [...all];

    return all.filter((key) => grants.includes(key) || grants.includes(key.split('.')[0]));
};

/** Finds the preset a set of permissions matches exactly, if any. */
export const matchPreset = (selected: string[], all: string[]): RolePreset | undefined => {
    const current = [...selected]
        .filter((key) => key !== 'websocket.connect')
        .sort()
        .join(',');

    return rolePresets().find((preset) => expandGrants(preset.grants, all).sort().join(',') === current);
};
