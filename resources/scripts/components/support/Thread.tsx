import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { format } from 'date-fns';
import { PaperAirplaneIcon } from '@heroicons/react/outline';
import Avatar from '@/components/Avatar';
import Button from '@/components/admin/ui/Button';
import { TicketMessage } from '@/api/support';
import { t } from '@/i18n';

interface Props {
    messages: TicketMessage[];
    /** Staff messages are on the right in the admin area, the user's own in the account area. */
    staffView?: boolean;
    onSend: (body: string) => Promise<unknown>;
    hint?: React.ReactNode;
}

const MAX = 10000;

// The outline paper plane points up, turned it reads as "send" instead of a warning sign.
const SendIcon = ({ className, ...props }: React.ComponentProps<'svg'>) => (
    <PaperAirplaneIcon {...props} className={classNames(className, 'rotate-90')} />
);

export default ({ messages, staffView, onSend, hint }: Props) => {
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const end = useRef<HTMLDivElement>(null);

    useEffect(() => {
        end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }, [messages.length]);

    const send = () => {
        const value = body.trim();
        if (!value || sending) return;

        setSending(true);
        onSend(value)
            .then(() => setBody(''))
            .catch(() => undefined)
            .then(() => setSending(false));
    };

    return (
        <div className={'flex flex-col gap-4'}>
            <ol className={'flex flex-col gap-4'}>
                {messages.map((message) => {
                    const mine = message.staff === !!staffView;
                    const name = message.author?.username || t('Deleted user');

                    return (
                        <li
                            key={message.id}
                            className={classNames('flex gap-3 animate-fade-in', mine && 'flex-row-reverse')}
                        >
                            <span className={'w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-gray-800'}>
                                <Avatar name={name} seed={message.author?.uuid} src={message.author?.avatar_url} />
                            </span>
                            <div className={classNames('min-w-0 max-w-[85%] sm:max-w-[75%]', mine && 'text-right')}>
                                <p
                                    className={classNames(
                                        'flex items-center gap-2 text-xs text-gray-500 mb-1',
                                        mine && 'justify-end'
                                    )}
                                >
                                    <span className={'font-medium text-gray-300'}>{name}</span>
                                    {message.staff && (
                                        <span className={'text-[0.65rem] uppercase tracking-wider text-raptor-400'}>
                                            {t('Support')}
                                        </span>
                                    )}
                                    <time dateTime={message.created_at} title={message.created_at}>
                                        {format(new Date(message.created_at), 'd MMM, HH:mm')}
                                    </time>
                                </p>
                                <div
                                    className={classNames(
                                        'inline-block text-left rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ring-1 ring-inset',
                                        mine
                                            ? 'bg-raptor-500/10 ring-raptor-500/20 text-gray-50 rounded-tr-md'
                                            : 'bg-gray-800/70 ring-gray-700/60 text-gray-100 rounded-tl-md'
                                    )}
                                >
                                    {message.body}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ol>
            <div ref={end} />
            <div
                className={'rounded-xl bg-gray-950/50 ring-1 ring-inset ring-gray-800 focus-within:ring-raptor-500/40'}
            >
                <textarea
                    value={body}
                    maxLength={MAX}
                    rows={3}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            send();
                        }
                    }}
                    placeholder={t('Write a reply…')}
                    aria-label={t('Reply')}
                    className={
                        'block w-full resize-y min-h-[5rem] bg-transparent px-4 pt-3 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none'
                    }
                />
                <div className={'flex items-center gap-3 px-3 pb-3'}>
                    <p className={'flex-1 min-w-0 text-xs text-gray-500'}>{hint || t('Ctrl + Enter to send')}</p>
                    <Button
                        icon={PaperAirplaneIcon}
                        size={'sm'}
                        loading={sending}
                        disabled={!body.trim()}
                        onClick={send}
                    >
                        {t('Send')}
                    </Button>
                </div>
            </div>
        </div>
    );
};
