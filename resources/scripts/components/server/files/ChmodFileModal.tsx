import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { LockClosedIcon } from '@heroicons/react/outline';
import { fileBitsToString } from '@/helpers';
import { useFileManagerMutate } from '@/plugins/useFileManagerSwr';
import { RequiredModalProps } from '@/components/elements/Modal';
import chmodFiles from '@/api/server/files/chmodFiles';
import { ServerContext } from '@/state/server';
import Modal from '@/components/ui/Modal';
import Button from '@/components/admin/ui/Button';
import { toast } from '@/components/admin/ui/Toast';
import { t } from '@/i18n';

interface File {
    file: string;
    mode: string;
}

type OwnProps = RequiredModalProps & { files: File[] };

const PRESETS = ['644', '755', '600', '700', '775'];

const ChmodFileModal = ({ files, visible, onDismissed }: OwnProps) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const setSelectedFiles = ServerContext.useStoreActions((actions) => actions.files.setSelectedFiles);
    const mutate = useFileManagerMutate();
    const [mode, setMode] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (visible) setMode(files.length > 1 ? '644' : (files[0]?.mode || '644').slice(-3));
    }, [visible]);

    const valid = /^[0-7]{3,4}$/.test(mode);
    const digits = valid ? mode.slice(-3).split('').map(Number) : [0, 0, 0];

    const toggle = (who: number, bit: number) => {
        const next = [...digits];
        next[who] = next[who] ^ bit;
        setMode(next.join(''));
    };

    const submit = async () => {
        if (!valid) return;
        setBusy(true);
        mutate(
            (data) =>
                data?.map((f) =>
                    f.name === files[0].file ? { ...f, mode: fileBitsToString(mode, !f.isFile), modeBits: mode } : f
                ),
            false
        );
        try {
            await chmodFiles(
                uuid,
                directory,
                files.map((f) => ({ file: f.file, mode }))
            );
            await mutate();
            setSelectedFiles([]);
            toast.success(
                t('Permissions changed'),
                files.length === 1 ? files[0].file : t('{{count}} files', { count: files.length })
            );
            onDismissed();
        } catch (err) {
            mutate();
            toast.fromError(err);
        } finally {
            setBusy(false);
        }
    };

    const who = [t('Owner'), t('Group'), t('Others')];
    const bits: [number, string][] = [
        [4, t('Read')],
        [2, t('Write')],
        [1, t('Run')],
    ];

    return (
        <Modal
            open={visible}
            onClose={onDismissed}
            busy={busy}
            icon={LockClosedIcon}
            title={t('Change permissions')}
            description={
                files.length === 1 ? (
                    <span className={'font-mono break-all'}>{files[0].file}</span>
                ) : (
                    t('{{count}} files', { count: files.length })
                )
            }
            footer={
                <>
                    <Button variant={'secondary'} onClick={onDismissed} disabled={busy}>
                        {t('Cancel')}
                    </Button>
                    <Button loading={busy} disabled={!valid} onClick={submit}>
                        {t('Apply')}
                    </Button>
                </>
            }
        >
            <div className={'overflow-hidden rounded-xl ring-1 ring-gray-800'}>
                <table className={'w-full text-sm'}>
                    <thead>
                        <tr className={'bg-gray-950/40'}>
                            <th className={'px-3 py-2 text-left text-xs font-medium text-gray-500'} />
                            {bits.map(([, label]) => (
                                <th key={label} className={'px-3 py-2 text-xs font-medium text-gray-400'}>
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {who.map((label, w) => (
                            <tr key={label} className={'border-t border-gray-800'}>
                                <td className={'px-3 py-2 text-gray-200'}>{label}</td>
                                {bits.map(([bit]) => {
                                    const on = (digits[w] & bit) !== 0;

                                    return (
                                        <td key={bit} className={'px-3 py-2 text-center'}>
                                            <button
                                                type={'button'}
                                                aria-pressed={on}
                                                onClick={() => toggle(w, bit)}
                                                className={classNames(
                                                    'w-8 h-8 rounded-lg ring-1 ring-inset transition-colors text-xs font-mono',
                                                    on
                                                        ? 'bg-raptor-500/15 ring-raptor-500/50 text-raptor-200'
                                                        : 'ring-gray-700 text-gray-600 hover:text-gray-300'
                                                )}
                                            >
                                                {bit === 4 ? 'r' : bit === 2 ? 'w' : 'x'}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className={'mt-4 flex flex-wrap items-center gap-2'}>
                <input
                    value={mode}
                    onChange={(e) => setMode(e.target.value.replace(/[^0-7]/g, '').slice(0, 4))}
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                    aria-label={t('Mode')}
                    className={classNames(
                        'w-24 h-10 rounded-lg bg-gray-950/60 px-3 text-center font-mono text-sm text-gray-100 ring-1 ring-inset focus:outline-none focus:ring-2',
                        valid ? 'ring-gray-700 focus:ring-raptor-500' : 'ring-rose-500/70 focus:ring-rose-500'
                    )}
                />
                {PRESETS.map((preset) => (
                    <button
                        key={preset}
                        type={'button'}
                        onClick={() => setMode(preset)}
                        className={
                            'rounded-md px-2 py-1 font-mono text-xs text-gray-400 ring-1 ring-inset ring-gray-700 hover:text-gray-100'
                        }
                    >
                        {preset}
                    </button>
                ))}
            </div>
        </Modal>
    );
};

export default ChmodFileModal;
