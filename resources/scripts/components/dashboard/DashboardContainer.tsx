import React, { useEffect, useState } from 'react';
import { Server } from '@/api/server/getServer';
import getServers from '@/api/getServers';
import ServerRow from '@/components/dashboard/ServerRow';
import PageContentBlock from '@/components/elements/PageContentBlock';
import useFlash from '@/plugins/useFlash';
import { useStoreState } from 'easy-peasy';
import { usePersistedState } from '@/plugins/usePersistedState';
import Switch from '@/components/elements/Switch';
import { useResource } from '@/api/query';
import { PaginatedResult } from '@/api/http';
import Pagination from '@/components/elements/Pagination';
import { useLocation } from 'react-router-dom';
import { t } from '@/i18n';

export default () => {
    const { search } = useLocation();
    const defaultPage = Number(new URLSearchParams(search).get('page') || '1');

    const [page, setPage] = useState(!isNaN(defaultPage) && defaultPage > 0 ? defaultPage : 1);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const uuid = useStoreState((state) => state.user.data!.uuid);
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const [showOnlyAdmin, setShowOnlyAdmin] = usePersistedState(`${uuid}:show_all_servers`, false);

    const { data: servers, error } = useResource<PaginatedResult<Server>>(
        ['/api/client/servers', showOnlyAdmin && rootAdmin, page],
        () => getServers({ page, type: showOnlyAdmin && rootAdmin ? 'admin' : undefined }),
        { keepPrevious: true }
    );

    useEffect(() => {
        setPage(1);
    }, [showOnlyAdmin]);

    useEffect(() => {
        if (!servers) return;
        if (servers.pagination.currentPage > 1 && !servers.items.length) {
            setPage(1);
        }
    }, [servers?.pagination.currentPage]);

    useEffect(() => {
        // Don't use react-router to handle changing this part of the URL, otherwise it
        // triggers a needless re-render. We just want to track this in the URL incase the
        // user refreshes the page.
        window.history.replaceState(null, document.title, `/${page <= 1 ? '' : `?page=${page}`}`);
    }, [page]);

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'dashboard', error });
        if (!error) clearFlashes('dashboard');
    }, [error]);

    return (
        <PageContentBlock title={t('Dashboard')} showFlashKey={'dashboard'}>
            <div className={'flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6'}>
                <div>
                    <h1 className={'text-2xl sm:text-3xl'}>{showOnlyAdmin ? t('All servers') : t('Your servers')}</h1>
                    <p className={'mt-1 text-sm text-gray-400'}>
                        {servers
                            ? t('{{total}} server{{value}}', {
                                  total: servers.pagination.total,
                                  value: servers.pagination.total === 1 ? '' : 's',
                              })
                            : t('Loading servers…')}
                    </p>
                </div>
                {rootAdmin && (
                    <label className={'flex items-center gap-3 text-sm text-gray-400 cursor-pointer'}>
                        {t('Show servers of other users')}
                        <Switch
                            name={'show_all_servers'}
                            defaultChecked={showOnlyAdmin}
                            onChange={() => setShowOnlyAdmin((s) => !s)}
                        />
                    </label>
                )}
            </div>
            {!servers ? (
                <div className={'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'}>
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div
                            key={index}
                            className={'h-40 rounded-xl bg-gray-900/60 border border-gray-800 animate-pulse'}
                        />
                    ))}
                </div>
            ) : (
                <Pagination data={servers} onPageSelect={setPage}>
                    {({ items }) =>
                        items.length > 0 ? (
                            <div className={'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'}>
                                {items.map((server) => (
                                    <ServerRow key={server.uuid} server={server} />
                                ))}
                            </div>
                        ) : (
                            <div className={'rounded-xl border border-dashed border-gray-700 p-10 text-center'}>
                                <p className={'text-gray-300 font-medium'}>{t('No servers yet')}</p>
                                <p className={'mt-1 text-sm text-gray-500'}>
                                    {showOnlyAdmin
                                        ? t('There are no other servers to display.')
                                        : t('There are no servers associated with your account.')}
                                </p>
                            </div>
                        )
                    }
                </Pagination>
            )}
        </PageContentBlock>
    );
};
