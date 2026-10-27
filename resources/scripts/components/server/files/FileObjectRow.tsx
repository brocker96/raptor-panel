import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faFileArchive, faFileImport, faFolder } from '@fortawesome/free-solid-svg-icons';
import { encodePathSegments } from '@/helpers';
import { differenceInHours, format, formatDistanceToNow } from 'date-fns';
import React, { memo } from 'react';
import { FileObject } from '@/api/server/files/loadDirectory';
import FileDropdownMenu from '@/components/server/files/FileDropdownMenu';
import { ServerContext } from '@/state/server';
import { NavLink } from 'react-router-dom';
import tw from 'twin.macro';
import isEqual from 'react-fast-compare';
import SelectFileCheckbox from '@/components/server/files/SelectFileCheckbox';
import { usePermissions } from '@/plugins/usePermissions';
import { join } from 'pathe';
import { bytesToString } from '@/lib/formatters';
import styles from './style.module.css';
import routes, { preload } from '@/routers/routes';

const editorRoute = routes.server.find((route) => route.path === '/files/:action')!;

const Clickable = memo(({ file, children }: { file: FileObject; children: React.ReactNode }) => {
    const [canRead] = usePermissions(['file.read']);
    const [canReadContents] = usePermissions(['file.read-content']);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const directory = ServerContext.useStoreState((state) => state.files.directory);

    return (file.isFile && (!file.isEditable() || !canReadContents)) || (!file.isFile && !canRead) ? (
        <div className={styles.details}>{children}</div>
    ) : (
        <NavLink
            className={styles.details}
            {...(file.isFile ? preload(editorRoute) : {})}
            to={`/server/${id}/files${file.isFile ? '/edit' : ''}#${encodePathSegments(join(directory, file.name))}`}
        >
            {children}
        </NavLink>
    );
}, isEqual);

const modifiedAt = (file: FileObject) =>
    Math.abs(differenceInHours(file.modifiedAt, new Date())) > 48
        ? format(file.modifiedAt, 'MMM do, yyyy h:mma')
        : formatDistanceToNow(file.modifiedAt, { addSuffix: true });

const FileObjectRow = ({ file }: { file: FileObject }) => (
    <div
        className={styles.file_row}
        key={file.name}
        onContextMenu={(e) => {
            e.preventDefault();
            window.dispatchEvent(
                new CustomEvent(`pterodactyl:files:ctx:${file.key}`, { detail: { x: e.clientX, y: e.clientY } })
            );
        }}
    >
        <SelectFileCheckbox name={file.name} />
        <Clickable file={file}>
            <div
                css={[
                    tw`flex-none ml-6 mr-3 sm:mr-4 text-lg pl-3`,
                    file.isFile ? tw`text-gray-500` : tw`text-raptor-400`,
                ]}
            >
                {file.isFile ? (
                    <FontAwesomeIcon
                        icon={file.isSymlink ? faFileImport : file.isArchiveType() ? faFileArchive : faFileAlt}
                    />
                ) : (
                    <FontAwesomeIcon icon={faFolder} />
                )}
            </div>
            <div css={tw`flex-1 min-w-0`}>
                <div css={tw`truncate`}>{file.name}</div>
                {/* On small screens the size and modification date are shown below the name. */}
                <div css={tw`flex gap-2 text-xs text-gray-500 truncate sm:hidden`}>
                    {file.isFile && <span>{bytesToString(file.size)}</span>}
                    <span>{modifiedAt(file)}</span>
                </div>
            </div>
            {file.isFile && (
                <div css={tw`w-1/6 text-right mr-4 hidden sm:block text-gray-400 tabular-nums`}>
                    {bytesToString(file.size)}
                </div>
            )}
            <div css={tw`w-1/5 text-right mr-4 hidden md:block text-gray-500`} title={file.modifiedAt.toString()}>
                {modifiedAt(file)}
            </div>
        </Clickable>
        <FileDropdownMenu file={file} />
    </div>
);

export default memo(FileObjectRow, (prevProps, nextProps) => {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const { isArchiveType, isEditable, ...prevFile } = prevProps.file;
    const { isArchiveType: nextIsArchiveType, isEditable: nextIsEditable, ...nextFile } = nextProps.file;
    /* eslint-enable @typescript-eslint/no-unused-vars */

    return isEqual(prevFile, nextFile);
});
