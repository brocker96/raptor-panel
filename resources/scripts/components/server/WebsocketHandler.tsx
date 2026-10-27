import { store } from '@/state';
import React, { useEffect, useRef, useState } from 'react';
import { Websocket } from '@/plugins/Websocket';
import { ServerContext } from '@/state/server';
import getWebsocketToken from '@/api/server/getWebsocketToken';
import ContentContainer from '@/components/elements/ContentContainer';
import { CSSTransition } from 'react-transition-group';
import Spinner from '@/components/elements/Spinner';
import tw from 'twin.macro';

const reconnectErrors = ['jwt: exp claim is invalid', 'jwt: created too far in past (denylist)'];

// The number of JWT errors in a row (without a successful authentication in between) after which
// we stop requesting new tokens, otherwise a misconfigured node would cause an endless loop.
const MAX_JWT_FAILURES = 3;

export default () => {
    // Kept in a ref, a plain variable would be reset on every render and allow duplicate token requests.
    const updatingToken = useRef(false);
    const jwtFailures = useRef(0);
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
            setConnectionState(true);
        });
        socket.on('SOCKET_CLOSE', () => setConnectionState(false));
        socket.on('SOCKET_CONNECT_ERROR', () => {
            setError('Failed to connect to websocket instance after multiple attempts: try refreshing the page.');
        });
        socket.on('SOCKET_ERROR', () => {
            setError('connecting');
            setConnectionState(false);
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
                    'There was an error validating the credentials provided for the websocket. Please refresh the page.'
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
                                We&apos;re having some trouble connecting to your server, please wait...
                            </p>
                        </>
                    ) : (
                        <p css={tw`ml-2 text-sm text-white`}>{error}</p>
                    )}
                </ContentContainer>
            </div>
        </CSSTransition>
    ) : null;
};
