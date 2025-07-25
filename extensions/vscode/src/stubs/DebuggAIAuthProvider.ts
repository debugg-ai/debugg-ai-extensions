// DebuggAIAuthProvider.ts  ───────────────────────────────────────
import crypto from "crypto";

import axios from "axios";
import { ControlPlaneSessionInfo } from "core/control-plane/client";
import { EXTENSION_NAME, getControlPlaneEnvSync } from "core/control-plane/env";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";
import {
    authentication,
    AuthenticationProvider,
    AuthenticationProviderAuthenticationSessionsChangeEvent,
    AuthenticationSession,
    Disposable,
    env,
    EventEmitter,
    ExtensionContext,
    ProgressLocation,
    Uri,
    window,
    workspace
} from "vscode";

import { PromiseAdapter, promiseFromEvent } from "./promiseUtils";
import { SecretStorage } from "./SecretStorage";
import { UriEventHandler } from "./uriHandler"; // same helper you used for WorkOS

/* ── CONFIG ──────────────────────────────────────────────────*/
const AUTH_NAME = "DebuggAI";

const enableControlServerBeta = workspace
    .getConfiguration(EXTENSION_NAME)
    .get<boolean>("enableContinueForTeams", false);

const debuggAiTestEnv = workspace
    .getConfiguration(EXTENSION_NAME)
    .get<"none" | "local" | "production" | "staging">("debuggAiTestEnvironment", "production");

const controlPlaneEnv = getControlPlaneEnvSync(
    'production',
    enableControlServerBeta,
);
console.log("Control plane env:", controlPlaneEnv);

const SESSIONS_SECRET_KEY = `${controlPlaneEnv.AUTH_TYPE}.sessions`;


const BASE_URL = controlPlaneEnv.OUATH_URL;
const API_BASE_URL = controlPlaneEnv.CONTROL_PLANE_URL;
const LOGIN_URL = `${BASE_URL}`;
const TOKEN_ENDPOINT = `${API_BASE_URL}/api/v1/o/token/`;          // POST code→tokens
const TOKEN_REFRESH_ENDPOINT = `${API_BASE_URL}/api/v1/o/token/`;
const USERINFO_ENDPOINT = `${API_BASE_URL}/api/v1/users/me/`;


/* ────────────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────────────────*/
function generateRandomString(len = 64) {
    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join(
        "",
    );
}
function generateCodeChallenge(verifier: string) {
    return crypto
        .createHash("sha256")
        .update(verifier)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}
function decodeJwt(jwt: string): any | null {
    try {
        return JSON.parse(Buffer.from(jwt.split(".")[1], "base64").toString());
    } catch {
        return null;
    }
}
function jwtLifetime(jwt: string, fallbackMs = 24 * 60 * 60 * 1000) {
    // We are using a 24 hour access tokens for oauth.
    const t = decodeJwt(jwt);
    return t && t.exp && t.iat ? (t.exp - t.iat) * 1000 : fallbackMs;
}

/* ────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────*/
interface DebuggAIAuthenticationSession extends AuthenticationSession {
    refreshToken: string;
    expiresInMs: number;
    loginNeeded: boolean;
    expiresAt: number;
}

/* ────────────────────────────────────────────────────────────
   PROVIDER
───────────────────────────────────────────────────────────────*/
export class DebuggAIAuthProvider implements AuthenticationProvider, Disposable {
    /* identical public API ---------------------------------------------------*/
    public static useOnboardingUri = false;

    private _sessionChangeEmitter =
        new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();
    private _disposable: Disposable;

    private secretStorage: SecretStorage;

    /* helpers for PKCE / redirect */
    private _pendingStates: string[] = [];
    private _codeExchangePromises = new Map<
        string,
        { promise: Promise<string>; cancel: EventEmitter<void> }
    >();

    private static EXPIRATION_TIME_MS = 1000 * 60 * 15;
    private _lastRefreshTime: number = 0;
    
    constructor(
        private readonly context: ExtensionContext,
        private readonly _uriHandler: UriEventHandler
    ) {
        this.secretStorage = new SecretStorage(context);

        this._disposable = Disposable.from(
            authentication.registerAuthenticationProvider(
                controlPlaneEnv.AUTH_TYPE,
                AUTH_NAME,
                this,
                { supportsMultipleAccounts: false },
            ),
            window.registerUriHandler(this._uriHandler),
        );
    }

    /* ── AuthenticationProvider interface ─────────────────────*/
    get onDidChangeSessions() {
        return this._sessionChangeEmitter.event;
    }

    async getSessions(): Promise<DebuggAIAuthenticationSession[]> {
        console.log("Getting sessions...");
        const raw = await this.secretStorage.get(SESSIONS_SECRET_KEY);
        console.log("Raw sessions:", raw);
        console.log("Raw sessions count:", raw?.length);
        if (!raw) {return [];}
        try {
            return JSON.parse(raw);
        } catch {
            return [];
        }
    }

    async createSession(scopes: string[]): Promise<DebuggAIAuthenticationSession> {
        const codeVerifier = generateRandomString();
        const codeChallenge = generateCodeChallenge(codeVerifier);
        const query = await this.login(codeChallenge, scopes);
        const q = new URLSearchParams(query);
        const access_token = q.get("access_token");
        const refresh_token = q.get("refresh_token");

        // const userInfo = (await this.getUserInfo(token, codeVerifier)) as any;
        // const { access_token, refresh_token } = userInfo;
        // const {
        //     access_token,
        //     refresh_token,
        // }: { access_token: string; refresh_token: string } = await fetchJson(TOKEN_ENDPOINT, {
        //     grant_type: "authorization_code",
        //     code: authCode,
        //     client_id: CLIENT_ID,
        //     redirect_uri: this.redirectUri,
        //     code_verifier: codeVerifier,
        // });
        const access = access_token;
        const refresh = refresh_token;
        if (!access || !refresh) {
            throw new Error("No access_token or refresh_token");
        }
        const user = await fetchOauthJson<{ email: string; first_name?: string; last_name?: string }>(
            USERINFO_ENDPOINT,
            undefined,
            access
        );

        const expiresAt = Date.now() + jwtLifetime(access);
        const session: DebuggAIAuthenticationSession = {
            id: uuidv4(),
            accessToken: access,
            refreshToken: refresh,
            expiresAt,
            expiresInMs: expiresAt - Date.now(),
            loginNeeded: false,
            account: {
                id: user.email,
                label: this._formatProfileLabel(user.first_name, user.last_name) || user.email,
            },
            scopes: [],
        };

        await this._storeSessions([session]);
        this._sessionChangeEmitter.fire({ added: [session], removed: [], changed: [] });

        /* schedule silent refresh */
        setTimeout(() => this._refreshSessions(), (session.expiresInMs * 2) / 3);

        return session;
    }

    async removeSession(sessionId: string): Promise<void> {
        const sessions = await this.getSessions();
        console.log("Sessions before removal:", sessions);
        const idx = sessions.findIndex((s) => s.id === sessionId);
        const removed = sessions.splice(idx, 1);
        await this._storeSessions(sessions);
        this._sessionChangeEmitter.fire({ added: [], removed, changed: [] });
    }

    async dispose() {
        this._disposable.dispose();
    }

    /* ── Additional public helpers (same names as before) ─────*/
    async refreshSessions() {
        try {
            await this._refreshSessions();
        } catch (e) {
            console.error("Error refreshing sessions:", e);
        }
    }

    public async clearSessions() {
        await this._storeSessions([]);
        this._sessionChangeEmitter.fire({ added: [], removed: [], changed: [] });
    }

    /* ideRedirectUri / redirectUri ------------------------------------------*/
    get ideRedirectUri() {
        if (["vscode", "vscode-insiders", "code-oss"].includes(env.uriScheme)) {
            const u = new URL(BASE_URL);
            u.pathname = `/auth/${env.uriScheme}-redirect`;
            return u.toString();
        }
        const { publisher, name } = this.context.extension.packageJSON;
        return `${env.uriScheme}://${publisher}.${name}`;
    }
    get redirectUri() {
        if (DebuggAIAuthProvider.useOnboardingUri) {
            const u = new URL(BASE_URL);
            u.pathname = `/onboarding/redirect/${env.uriScheme}`;
            return u.toString();
        }
        return this.ideRedirectUri;
    }

    /* ──────────────────────────────────────────────────────────
       PRIVATE HELPERS
    ────────────────────────────────────────────────────────────*/
    private async _storeSessions(v: DebuggAIAuthenticationSession[]) {
        console.log("Storing sessions to session secret key...");
        await this.secretStorage.store(SESSIONS_SECRET_KEY, JSON.stringify(v, null, 2));
    }

    private async _refreshSessions() {
        console.log("starting _refreshSessions...");
        const sessions = await this.getSessions();
        if (!sessions.length) {
            console.log("No sessions found");
            return;
        };

        const final: DebuggAIAuthenticationSession[] = [];
        for (const s of sessions) {
            try {
                const newS = await this._refreshSession(s.refreshToken, s);
                final.push({ ...s, ...newS });
            } catch (e) {
                console.log("Refresh failed, moving on", e);
                // if (controlPlaneEnv.AUTH_TYPE === 'debugg-ai-test') {
                //     final.push(s);
                // } else {
                //     final.push(s);
                // }
                this._sessionChangeEmitter.fire({ added: [], removed: [s], changed: [] });
                console.debug("Refresh failed, dropping session:", e);
            }
        }
        await this._storeSessions(final);
        this._sessionChangeEmitter.fire({ added: [], removed: [], changed: final });

        if (final[0]?.expiresInMs) {
            setTimeout(() => this._refreshSessions(), (final[0].expiresInMs * 2) / 3);
        }
    }

    private async _refreshSession(refreshToken: string, session?: DebuggAIAuthenticationSession) {
        // Check if the current access token is expired
        const expiresAt = session?.expiresAt;
        if (expiresAt && expiresAt < Date.now()) {
            // Actually expired, try to refresh
            console.log("Current access token is expired, refreshing session...");
            const curTime = Date.now();
            if (curTime - this._lastRefreshTime < 5000) {
                console.log('Waiting for 5 seconds before refreshing again...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            this._lastRefreshTime = Date.now();
            console.log('args - ', {
                grant_type: "refresh_token",
                refresh_token: refreshToken,
                client_id: controlPlaneEnv.OAUTH_CLIENT_ID,
                client_secret: controlPlaneEnv.OAUTH_CLIENT_SECRET,
                server: controlPlaneEnv.CONTROL_PLANE_URL
            });
            const response = await axios.post(TOKEN_REFRESH_ENDPOINT, {
                grant_type: "refresh_token",
                refresh_token: refreshToken,
                client_id: controlPlaneEnv.OAUTH_CLIENT_ID,
                client_secret: controlPlaneEnv.OAUTH_CLIENT_SECRET,
            }, {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });
            this._lastRefreshTime = curTime;
            const newExpiresAt = Date.now() + jwtLifetime(response.data?.access_token);
            return {
                accessToken: response.data?.access_token,
                refreshToken: response.data?.refresh_token,
                expiresInMs: newExpiresAt - Date.now(),
                expiresAt: newExpiresAt,
            };
        } else if (expiresAt) {
            // Not expired, just return the current session with updated expiresInMs
            return {
                accessToken: session?.accessToken,
                refreshToken: session?.refreshToken,
                expiresInMs: expiresAt - Date.now(),
                expiresAt: expiresAt,
            };
        } else {
            // No expiresAt, fallback to current session
            return session!;
        }
    }

    private _formatProfileLabel(first: string | undefined, last: string | undefined) {
        return ((first ?? "") + " " + (last ?? "")).trim();
    }

    /* ── OAuth login / redirect handling ──────────────────────*/
    private async login(codeChallenge: string, scopes: string[] = []) {
        console.log("logging in...");
        return await window.withProgress<string>(
            {
                location: ProgressLocation.Notification,
                title: "Signing in to DebuggAI…",
                cancellable: true,
            },
            async (_, token) => {
                const stateId = uuidv4();
                this._pendingStates.push(stateId);

                const scopeString = scopes.join(" ");
                const url = new URL(LOGIN_URL);
                url.searchParams.set("response_type", "code");
                url.searchParams.set("client_id", controlPlaneEnv.OAUTH_CLIENT_ID);
                url.searchParams.set("redirect_uri", this.redirectUri);
                url.searchParams.set("state", stateId);
                url.searchParams.set("code_challenge", codeChallenge);
                url.searchParams.set("code_challenge_method", "S256");

                await env.openExternal(Uri.parse(url.toString()));

                let codeExchangePromise = this._codeExchangePromises.get(scopeString);
                if (!codeExchangePromise) {
                    codeExchangePromise = promiseFromEvent(
                        this._uriHandler.event,
                        this.handleUri(scopes),
                    );
                    this._codeExchangePromises.set(scopeString, codeExchangePromise);
                }

                try {
                    return await Promise.race([
                        codeExchangePromise.promise,
                        new Promise<string>(
                            (_, reject) =>
                                setTimeout(() => reject("Cancelled"), 60 * 60 * 1_000), // 60min timeout
                        ),
                        promiseFromEvent<any, any>(
                            token.onCancellationRequested,
                            (_, __, reject) => {
                                reject("User Cancelled");
                            },
                        ).promise,
                    ]);
                } finally {
                    this._pendingStates = this._pendingStates.filter(
                        (n) => n !== stateId,
                    );
                    codeExchangePromise?.cancel.fire();
                    this._codeExchangePromises.delete(scopeString);
                }
            },
        );
    }

    private handleUri: (scopes: readonly string[]) => PromiseAdapter<Uri, string> =
        (_) => (uri, resolve, reject) => {
            const q = new URLSearchParams(uri.query);
            const state = q.get("state");
            // const code = q.get("code");
            // const access_token = q.get("access_token");
            // const refresh_token = q.get("refresh_token");
            // const expires_in = q.get("expires_in");
            // if (!access_token) return reject(new Error("No access_token"));
            // if (!code) return reject(new Error("No code"));
            if (!state || !this._pendingStates.includes(state))
                {return reject(new Error("Invalid state"));}
            resolve(uri.query);
        };

}


/* ────────────────────────────────────────────────────────────
   getControlPlaneSessionInfo – exported helper
───────────────────────────────────────────────────────────────*/
export async function getControlPlaneSessionInfo(
    silent: boolean,
    useOnboarding: boolean,
): Promise<ControlPlaneSessionInfo | undefined> {
    try {
        if (useOnboarding) {DebuggAIAuthProvider.useOnboardingUri = true;}

        const session = await authentication.getSession(
            controlPlaneEnv.AUTH_TYPE,
            [],
            silent ? { silent: true } : { createIfNone: true },
        );
        if (!session) {return undefined;}
        return {
            accessToken: session.accessToken,
            account: { id: session.account.id, label: session.account.label },
        };
    } finally {
        DebuggAIAuthProvider.useOnboardingUri = false;
    }
}

/* ────────────────────────────────────────────────────────────
   tiny fetch helpers
───────────────────────────────────────────────────────────────*/
async function fetchJson<T>(
    url: string,
    body?: any,
    bearer?: string,
): Promise<T> {
    const r = await fetch(url, {
        method: body ? "POST" : "GET",
        headers: {
            "Content-Type": "application/json",
            ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {throw new Error(await r.text());}
    return r.json() as Promise<T>;
}

async function fetchOauthJson<T>(
    url: string,
    body?: any,
    accessToken?: string,
): Promise<T> {
    if (body) {
        body.access_token = accessToken;
    } else {
        url = `${url}?access_token=${accessToken}`;
    }
    const r = await fetch(url, {
        method: body ? "POST" : "GET",
        headers: {
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {throw new Error(await r.text());}
    return r.json() as Promise<T>;
}

async function fetchWithQueryParams<T>(
    url: string,
    queryParams?: any,
    accessToken?: string,
): Promise<T> {
    let body = null;
    if (queryParams) {
        // url = `${url}?${new URLSearchParams(queryParams).toString()}`;
        body = new URLSearchParams(queryParams).toString();
    }

    console.log("Fetching with body:", body);

    const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
    };
    const r = await fetch(url, {
        method: "POST",
        headers: headers,
        body: body,
    });
    if (!r.ok) {throw new Error(await r.text());}
    return r.json() as Promise<T>;
}