import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { CheckIcon, LockClosedIcon, ReplyIcon } from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import { ServerEggVariable } from '@/api/server/types';
import updateStartupVariable from '@/api/server/updateStartupVariable';
import getServerStartup from '@/api/swr/getServerStartup';
import { usePermissions } from '@/plugins/usePermissions';
import { httpErrorToHuman } from '@/api/http';
import { t } from '@/i18n';

const SWITCH_RULES = ['boolean', 'in:0,1', 'in:1,0', 'in:true,false', 'in:false,true'];

const control =
    'w-full h-10 rounded-lg bg-gray-950/60 px-3 text-sm text-gray-100 ring-1 ring-inset ring-gray-700 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-raptor-500 disabled:opacity-60';

const VariableBox = ({ variable }: { variable: ServerEggVariable }) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [canEdit] = usePermissions(['startup.update']);
    const { mutate } = getServerStartup(uuid);
    const [value, setValue] = useState(variable.serverValue ?? '');
    const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [error, setError] = useState('');
    const timeout = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => setValue(variable.serverValue ?? ''), [variable.serverValue]);

    const editable = canEdit && variable.isEditable;
    const isSwitch = variable.rules.some((rule) => SWITCH_RULES.includes(rule));
    const stringSwitch = variable.rules.includes('string') || /true|false/.test(variable.rules.join('|'));
    const options = (variable.rules.find((rule) => rule.startsWith('in:')) || '')
        .replace('in:', '')
        .split(',')
        .filter(Boolean);

    const save = (next: string, wait = 0) => {
        setValue(next);
        clearTimeout(timeout.current);
        timeout.current = setTimeout(async () => {
            setState('saving');
            setError('');
            try {
                const [response, invocation] = await updateStartupVariable(uuid, variable.envVariable, next);
                await mutate(
                    (data) =>
                        data && {
                            ...data,
                            invocation,
                            variables: data.variables.map((v) =>
                                v.envVariable === response.envVariable ? response : v
                            ),
                        },
                    false
                );
                setState('saved');
                setTimeout(() => setState('idle'), 1500);
            } catch (err) {
                setState('idle');
                setError(httpErrorToHuman(err));
            }
        }, wait);
    };

    const on = stringSwitch ? value === 'true' : value === '1';

    return (
        <div
            className={classNames('rounded-xl ring-1 bg-gray-900/40 p-4', error ? 'ring-rose-500/40' : 'ring-gray-800')}
        >
            <div className={'flex items-start gap-2'}>
                <div className={'min-w-0 flex-1'}>
                    <p className={'flex flex-wrap items-center gap-2 text-sm font-medium text-gray-100'}>
                        {variable.name}
                        {!variable.isEditable && (
                            <LockClosedIcon className={'w-3.5 h-3.5 text-gray-500'} aria-label={t('Read only')} />
                        )}
                    </p>
                    <code className={'text-[0.7rem] text-gray-500'}>{variable.envVariable}</code>
                </div>
                <span className={'text-xs text-gray-500 h-5 flex items-center'}>
                    {state === 'saving' && t('Saving…')}
                    {state === 'saved' && (
                        <span className={'flex items-center gap-1 text-raptor-400'}>
                            <CheckIcon className={'w-3.5 h-3.5'} />
                            {t('Saved')}
                        </span>
                    )}
                </span>
            </div>
            <div className={'mt-3'}>
                {isSwitch ? (
                    <button
                        type={'button'}
                        role={'switch'}
                        aria-checked={on}
                        disabled={!editable}
                        onClick={() => save(stringSwitch ? (on ? 'false' : 'true') : on ? '0' : '1')}
                        className={classNames(
                            'relative inline-flex w-11 h-6 rounded-full transition-colors disabled:opacity-50',
                            on ? 'bg-raptor-500' : 'bg-gray-700'
                        )}
                    >
                        <span
                            className={classNames(
                                'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all',
                                on ? 'left-6' : 'left-1'
                            )}
                        />
                    </button>
                ) : options.length ? (
                    <select
                        value={value || variable.defaultValue}
                        disabled={!editable}
                        onChange={(e) => save(e.target.value)}
                        className={control}
                    >
                        {options.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        value={value}
                        readOnly={!editable}
                        onChange={(e) => save(e.target.value, 700)}
                        placeholder={variable.defaultValue}
                        className={classNames(control, 'font-mono text-[0.8rem]')}
                    />
                )}
            </div>
            {error ? (
                <p className={'mt-2 text-xs text-rose-300'}>{error}</p>
            ) : (
                variable.description && (
                    <p className={'mt-2 text-xs text-gray-400 leading-relaxed'}>{variable.description}</p>
                )
            )}
            {editable && !isSwitch && variable.defaultValue && value !== '' && value !== variable.defaultValue && (
                <button
                    type={'button'}
                    onClick={() => save(variable.defaultValue)}
                    className={'mt-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-200'}
                >
                    <ReplyIcon className={'w-3.5 h-3.5'} />
                    {t('Reset to {{value}}', {
                        value:
                            variable.defaultValue.length > 30
                                ? variable.defaultValue.slice(0, 30) + '…'
                                : variable.defaultValue,
                    })}
                </button>
            )}
        </div>
    );
};

export default VariableBox;
