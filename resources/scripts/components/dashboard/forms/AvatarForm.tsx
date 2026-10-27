import React, { useRef, useState } from 'react';
import classNames from 'classnames';
import { CameraIcon, TrashIcon, UploadIcon } from '@heroicons/react/outline';
import http, { httpErrorToHuman } from '@/api/http';
import Avatar from '@/components/Avatar';
import { Button } from '@/components/elements/button/index';
import { useStoreActions, useStoreState } from '@/state/hooks';
import useFlash from '@/plugins/useFlash';

const MAX_SIZE = 5 * 1024 * 1024;

/** Lets users upload their own profile picture, or go back to the generated avatar. */
export default () => {
    const user = useStoreState((state) => state.user.data!);
    const updateUserData = useStoreActions((actions) => actions.user.updateUserData);
    const { addFlash, clearFlashes } = useFlash();
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);

    const fail = (message: string) => addFlash({ key: 'account:avatar', type: 'error', title: 'Error', message });

    const upload = (file: File) => {
        clearFlashes('account:avatar');
        if (!file.type.startsWith('image/')) return fail('Please choose an image (PNG, JPG, WebP or GIF).');
        if (file.size > MAX_SIZE) return fail('The image must be smaller than 5 MB.');

        setPreview(URL.createObjectURL(file));
        setBusy(true);

        const form = new FormData();
        form.append('avatar', file);

        http.post<{ avatar_url: string }>('/api/client/account/avatar', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
            .then(({ data }) => {
                updateUserData({ avatarUrl: data.avatar_url });
                addFlash({ key: 'account:avatar', type: 'success', message: 'Your profile picture was updated.' });
            })
            .catch((error) => fail(httpErrorToHuman(error)))
            .finally(() => {
                setBusy(false);
                setPreview(null);
            });
    };

    const remove = () => {
        clearFlashes('account:avatar');
        setBusy(true);
        http.delete('/api/client/account/avatar')
            .then(() => updateUserData({ avatarUrl: null }))
            .catch((error) => fail(httpErrorToHuman(error)))
            .finally(() => setBusy(false));
    };

    return (
        <div
            onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) upload(file);
            }}
            className={classNames(
                'flex flex-col sm:flex-row sm:items-center gap-5 rounded-lg p-4 -m-4 transition-colors',
                dragging && 'bg-raptor-500/10 ring-2 ring-inset ring-raptor-500/50'
            )}
        >
            <button
                type={'button'}
                onClick={() => input.current?.click()}
                className={
                    'group relative w-24 h-24 flex-shrink-0 rounded-full overflow-hidden ring-2 ring-white/10 hover:ring-raptor-500/60 transition'
                }
                aria-label={'Change profile picture'}
            >
                {preview ? (
                    <img src={preview} alt={''} className={'w-full h-full object-cover'} />
                ) : (
                    <Avatar name={user.username} seed={user.uuid} src={user.avatarUrl} />
                )}
                <span
                    className={classNames(
                        'absolute inset-0 grid place-items-center bg-black/50 text-white transition-opacity',
                        busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    )}
                >
                    {busy ? (
                        <span className={'w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin'} />
                    ) : (
                        <CameraIcon className={'w-6 h-6'} />
                    )}
                </span>
            </button>
            <div className={'min-w-0'}>
                <p className={'text-sm text-gray-300'}>
                    {user.avatarUrl
                        ? 'This picture is shown to you and to everyone you share servers with.'
                        : 'You are using a generated avatar. Upload a photo or drop an image here.'}
                </p>
                <p className={'mt-1 text-xs text-gray-500'}>PNG, JPG, WebP or GIF up to 5 MB, cropped to a square.</p>
                <div className={'mt-3 flex flex-wrap gap-2'}>
                    <Button size={Button.Sizes.Small} disabled={busy} onClick={() => input.current?.click()}>
                        <UploadIcon className={'w-4 h-4 mr-1.5'} />
                        Upload photo
                    </Button>
                    {user.avatarUrl && (
                        <Button.Text size={Button.Sizes.Small} disabled={busy} onClick={remove}>
                            <TrashIcon className={'w-4 h-4 mr-1.5'} />
                            Use generated avatar
                        </Button.Text>
                    )}
                </div>
            </div>
            <input
                ref={input}
                type={'file'}
                accept={'image/png,image/jpeg,image/webp,image/gif'}
                className={'hidden'}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload(file);
                    e.target.value = '';
                }}
            />
        </div>
    );
};
