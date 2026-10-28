import { useStoreState } from '@/state/hooks';
import { Link } from 'react-router-dom';
import { store } from '@/state';
import React, { useEffect, useRef, useState } from 'react';
import { Websocket } from '@/plugins/Websocket';
import { ServerContext } from '@/state/server';
import getWebsocketToken from '@/api/server/getWebsocketToken';
import ContentContainer from '@/components/elements/ContentContainer';
import { CSSTransition } from 'react-transition-group';
import Spinner from '@/components/elements/Spinner';
import tw from 'twin.macro';
import { t } from '@/i18n';

const reconnectErrors = ['jwt: exp claim is invalid', 'jwt: created too far in past (denylist)'];

// The number of JWT errors in a row (without a successful authentication in between) after which
// we stop requesting new tokens, otherwise a misconfigured node would cause an endless loop.
const MAX_JWT_FAILURES = 3;

/**
 * Turns repeated connection failures into an actionable message. The first few failures are
 * usually a restarting node or a flaky network, so only keep the spinner for those.
 */
const diagnose = (url: string, failures: number): string => {
    if (failures < 3 || !url) return 'connecting';

    let host = url;
    try {
        const parsed = new URL(url);
        host = parsed.host;
    } catch {
        // Keep the raw value.
    }

    return t(
        "Can't reach the node at {{host}}. Wings may be offline, the port may be blocked by a firewall or proxy (Cloudflare only proxies HTTPS on 443/8443 and a few other ports), or its SSL certificate is invalid. Still retrying…",
        { host: host }
    );
};

export default () => {
    // Kept in a ref, a plain variable would be reset on every render and allow duplicate token requests.
    const updatingToken = useRef(false);
    const jwtFailures = useRef(0);
    const socketErrors = useRef(0);
    const socketUrl = useRef('');
    const rootAdmin = useStoreState((state) => state.user.data?.rootAdmin);
    const serverId = ServerContext.useStoreState((state) => state.server.data?.internalId);
    const [error, setError] = useState<'connecting' | string>('');
    const { connected, instance } = ServerContext.useStoreState((state) => state.socket);
    const uuid = ServerContext.useStoreState((state) => state.server.data?.uuid);
    const setServerStatus = ServerContext.useStoreActions((actions) => actions.status.setServerStatus);
    const { setInstance, setConnectionState } = ServerContext.useStoreActions((actions) => actions.socket);

    const updateToken = (uuid: string, socket: Websocket) => {
        if (updatingToken.current) return;

        updatingToken.current = true;
        getWebsocketToken(uuid)
            .then((data) => socket.setToken(data.token, true))
            .catch((error) => console.error(error))
            .then(() => {
                updatingToken.current = false;
            });
    };

    const connect = (uuid: string) => {
        // Fresh credentials are fetched before every reconnect, tokens are short lived and may have
        // expired while the connection was down.
        const socket = new Websocket()
            .setKeepalive(store.getState().settings.data?.websocketKeepalive !== false)
            .setConnectionProvider(() => getWebsocketToken(uuid));

        socket.on('auth success', () => {
            jwtFailures.current = 0;
            socketErrors.current = 0;
            setConnectionState(true);
        });
        socket.on('SOCKET_CLOSE', () => setConnectionState(false));
        socket.on('SOCKET_CONNECT_ERROR', () => {
            setError(t('Failed to connect to websocket instance after multiple attempts: try refreshing the page.'));
        });
        socket.on('SOCKET_ERROR', () => {
            setConnectionState(false);
            socketErrors.current++;
            setError(diagnose(socketUrl.current, socketErrors.current));
        });
        socket.on('status', (status) => setServerStatus(status));

        socket.on('daemon error', (message) => {
            console.warn('Got error message from daemon socket:', message);
        });

        socket.on('token expiring', () => updateToken(uuid, socket));
        socket.on('token expired', () => updateToken(uuid, socket));
        socket.on('jwt error', (error: string) => {
            setConnectionState(false);
            console.warn('JWT validation error from wings:', error);

            const recoverable = reconnectErrors.find((v) => error.toLowerCase().indexOf(v) >= 0);
            if (recoverable && ++jwtFailures.current <= MAX_JWT_FAILURES) {
                updateToken(uuid, socket);
            } else {
                socket.close();
                setError(
                    t(
                        'There was an error validating the credentials provided for the websocket. Please refresh the page.'
                    )
                );
            }
        });

        socket.on('transfer status', (status: string) => {
            if (status === 'starting' || status === 'success') {
                return;
            }

            // This code forces a reconnection to the websocket which will connect us to the target node instead of the source node
            // in order to be able to receive transfer logs from the target node.
            socket.close();
            setError('connecting');
            setConnectionState(false);
            setInstance(null);
            connect(uuid);
        });

        getWebsocketToken(uuid)
            .then((data) => {
                // Connect and then set the authentication token.
                socketUrl.current = data.socket;
                if (window.location.protocol === 'https:' && data.socket.startsWith('ws://')) {
                    setError(
                        t(
                            'The Panel uses HTTPS but this node does not, browsers block the insecure connection. Enable SSL for the node.'
                        )
                    );
                }
                socket.setToken(data.token).connect(data.socket);

                // Once that is done, set the instance.
                setInstance(socket);
            })
            .catch((error) => console.error(error));
    };

    useEffect(() => {
        connected && setError('');
    }, [connected]);

    useEffect(() => {
        return () => {
            instance && instance.close();
        };
    }, [instance]);

    useEffect(() => {
        // If there is already an instance or there is no server, just exit out of this process
        // since we don't need to make a new connection.
        if (instance || !uuid) {
            return;
        }

        connect(uuid);
    }, [uuid]);

    return error ? (
        <CSSTransition timeout={150} in appear classNames={'fade'}>
            <div css={tw`bg-red-500 py-2`}>
                <ContentContainer css={tw`flex items-center justify-center`}>
                    {error === 'connecting' ? (
                        <>
                            <Spinner size={'small'} />
                            <p css={tw`ml-2 text-sm text-red-100`}>
                                {t("We're having some trouble connecting to your server, please wait...")}
                            </p>
                        </>
                    ) : (
                        <p css={tw`ml-2 text-sm text-white text-center`}>
                            {error}
                            {rootAdmin && serverId && (
                                <Link to={`/admin/servers/${serverId}`} css={tw`ml-2 underline font-medium text-white`}>
                                    {t('Open in admin')}
                                </Link>
                            )}
                        </p>
                    )}
                </ContentContainer>
            </div>
        </CSSTransition>
    ) : null;
};
