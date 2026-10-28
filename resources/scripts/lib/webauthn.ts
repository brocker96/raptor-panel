/**
 * Helpers around the WebAuthn browser API. The server sends and expects binary values as
 * base64url strings, the browser works with ArrayBuffers.
 */

export const toBuffer = (value: string): ArrayBuffer => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    return bytes.buffer;
};

export const fromBuffer = (value: ArrayBuffer | ArrayBufferView): string => {
    const bytes =
        value instanceof ArrayBuffer
            ? new Uint8Array(value)
            : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    let binary = '';
    bytes.forEach((byte) => (binary += String.fromCharCode(byte)));

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const passkeysSupported = (): boolean =>
    typeof window !== 'undefined' && window.isSecureContext && typeof window.PublicKeyCredential === 'function';

interface CredentialDescriptor {
    type: 'public-key';
    id: string;
    transports?: string[];
}

const descriptors = (list?: CredentialDescriptor[]): PublicKeyCredentialDescriptor[] =>
    (list || []).map((item) => ({
        type: item.type,
        id: toBuffer(item.id),
        transports: item.transports as AuthenticatorTransport[] | undefined,
    }));

/**
 * Runs navigator.credentials.create() with options from the server and returns the response in
 * the JSON form the server verifies.
 */
export const createPasskey = async (options: any): Promise<Record<string, unknown>> => {
    const credential = (await navigator.credentials.create({
        publicKey: {
            ...options,
            challenge: toBuffer(options.challenge),
            user: { ...options.user, id: toBuffer(options.user.id) },
            excludeCredentials: descriptors(options.excludeCredentials),
        },
    })) as PublicKeyCredential | null;

    if (!credential) throw new Error('The passkey was not created.');

    const response = credential.response as AuthenticatorAttestationResponse;

    return {
        id: credential.id,
        rawId: fromBuffer(credential.rawId),
        type: credential.type,
        response: {
            clientDataJSON: fromBuffer(response.clientDataJSON),
            attestationObject: fromBuffer(response.attestationObject),
            transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
        },
    };
};

/**
 * Runs navigator.credentials.get() with options from the server.
 */
export const getPasskey = async (options: any, signal?: AbortSignal): Promise<Record<string, unknown>> => {
    const credential = (await navigator.credentials.get({
        signal,
        publicKey: {
            ...options,
            challenge: toBuffer(options.challenge),
            allowCredentials: descriptors(options.allowCredentials),
        },
    })) as PublicKeyCredential | null;

    if (!credential) throw new Error('No passkey was selected.');

    const response = credential.response as AuthenticatorAssertionResponse;

    return {
        id: credential.id,
        rawId: fromBuffer(credential.rawId),
        type: credential.type,
        response: {
            clientDataJSON: fromBuffer(response.clientDataJSON),
            authenticatorData: fromBuffer(response.authenticatorData),
            signature: fromBuffer(response.signature),
            userHandle: response.userHandle ? fromBuffer(response.userHandle) : null,
        },
    };
};

/**
 * True when the user closed the browser dialog, which should not be reported as an error.
 */
export const isPasskeyCancelled = (error: unknown): boolean =>
    error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError');
