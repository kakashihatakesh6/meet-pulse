import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import {
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_OAUTH_ENDPOINTS,
} from '../../constants/oauth';
import { SECURE_STORE_KEYS } from '../../constants/storage';
import { GoogleUser, AuthTokens } from '../../types/auth';
import { logger } from '../../utils/logger';

// Completes auth session for web browser redirect
WebBrowser.maybeCompleteAuthSession();

/**
 * Resolves the Google OAuth Client ID based on the runtime platform
 */
export function getGoogleClientId(): string {
  if (Platform.OS === 'ios') {
    return (
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ||
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ||
      ''
    );
  }
  if (Platform.OS === 'android') {
    return (
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID ||
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ||
      ''
    );
  }
  return (
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ||
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    ''
  );
}

/**
 * Resolves the OAuth Redirect URI
 */
export function getRedirectUri(): string {
  if (Platform.OS === 'web') {
    return process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI || AuthSession.makeRedirectUri();
  }
  const envUri = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI;
  if (envUri && !envUri.includes('localhost') && !envUri.includes('127.0.0.1')) {
    return envUri;
  }
  return AuthSession.makeRedirectUri({
    scheme: 'meetpulse',
    path: 'oauthredirect',
  });
}

export const GoogleOAuthService = {
  /**
   * Retrieves securely stored authentication tokens
   */
  async getStoredTokens(): Promise<AuthTokens | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          const json = window.localStorage.getItem(SECURE_STORE_KEYS.AUTH_TOKENS);
          if (!json) return null;
          return JSON.parse(json) as AuthTokens;
        }
        return null;
      }
      const json = await SecureStore.getItemAsync(SECURE_STORE_KEYS.AUTH_TOKENS);
      if (!json) return null;
      return JSON.parse(json) as AuthTokens;
    } catch (err) {
      logger.error('Failed to read auth tokens from SecureStore', err);
      return null;
    }
  },

  /**
   * Saves authentication tokens securely
   */
  async storeTokens(tokens: AuthTokens): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(
            SECURE_STORE_KEYS.AUTH_TOKENS,
            JSON.stringify(tokens)
          );
        }
        return;
      }
      await SecureStore.setItemAsync(
        SECURE_STORE_KEYS.AUTH_TOKENS,
        JSON.stringify(tokens)
      );
    } catch (err) {
      logger.error('Failed to save auth tokens to SecureStore', err);
      throw err;
    }
  },

  /**
   * Retrieves securely stored user profile
   */
  async getStoredUser(): Promise<GoogleUser | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          const json = window.localStorage.getItem(SECURE_STORE_KEYS.USER_PROFILE);
          if (!json) return null;
          return JSON.parse(json) as GoogleUser;
        }
        return null;
      }
      const json = await SecureStore.getItemAsync(SECURE_STORE_KEYS.USER_PROFILE);
      if (!json) return null;
      return JSON.parse(json) as GoogleUser;
    } catch (err) {
      logger.error('Failed to read user profile from SecureStore', err);
      return null;
    }
  },

  /**
   * Saves user profile securely
   */
  async storeUser(user: GoogleUser): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(
            SECURE_STORE_KEYS.USER_PROFILE,
            JSON.stringify(user)
          );
        }
        return;
      }
      await SecureStore.setItemAsync(
        SECURE_STORE_KEYS.USER_PROFILE,
        JSON.stringify(user)
      );
    } catch (err) {
      logger.error('Failed to save user profile to SecureStore', err);
    }
  },

  /**
   * Fetches the user profile from Google UserInfo endpoint
   */
  async fetchUserProfile(accessToken: string): Promise<GoogleUser> {
    const response = await fetch(GOOGLE_OAUTH_ENDPOINTS.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google UserInfo request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return {
      id: String(data.id || data.sub || 'google_user_' + Date.now()),
      email: String(data.email || 'user@example.com'),
      name: String(data.name || data.email || 'Google User'),
      givenName: data.given_name || undefined,
      familyName: data.family_name || undefined,
      picture: typeof data.picture === 'string' ? data.picture : undefined,
      verifiedEmail: Boolean(data.verified_email ?? data.email_verified ?? true),
    };
  },

  /**
   * Performs proactive token refresh if token is expired or about to expire in 5 minutes
   */
  async getValidAccessToken(): Promise<string> {
    const tokens = await this.getStoredTokens();
    if (!tokens) {
      throw new Error('Not authenticated. Please sign in with Google.');
    }

    const now = Date.now();
    const expiryBufferMs = 5 * 60 * 1000; // 5 minute buffer
    const expiresInMs = (tokens.expiresIn || 3600) * 1000;
    const isExpired = now >= tokens.issuedAt + expiresInMs - expiryBufferMs;

    if (!isExpired) {
      return tokens.accessToken;
    }

    // Refresh token
    if (!tokens.refreshToken) {
      logger.warn('Access token expired and no refresh token available');
      return tokens.accessToken; // Fallback attempt
    }

    logger.info('Proactively refreshing expired Google OAuth token...');
    try {
      const refreshedTokens = await this.refreshToken(tokens.refreshToken);
      return refreshedTokens.accessToken;
    } catch (err) {
      logger.error('Failed to refresh token, falling back to existing token', err);
      return tokens.accessToken;
    }
  },

  /**
   * Refreshes OAuth token using refresh_token grant
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const clientId = getGoogleClientId();
    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await fetch(GOOGLE_OAUTH_ENDPOINTS.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const existingTokens = await this.getStoredTokens();

    const updatedTokens: AuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      idToken: data.id_token || existingTokens?.idToken,
      expiresIn: data.expires_in || 3600,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope || existingTokens?.scope,
      issuedAt: Date.now(),
    };

    await this.storeTokens(updatedTokens);
    return updatedTokens;
  },

  /**
   * Clears all authentication data from SecureStore and revokes token
   */
  async signOut(): Promise<void> {
    try {
      const tokens = await this.getStoredTokens();
      if (tokens?.accessToken) {
        // Attempt revocation (fire and forget)
        fetch(
          `${GOOGLE_OAUTH_ENDPOINTS.revocationEndpoint}?token=${encodeURIComponent(tokens.accessToken)}`,
          { method: 'POST' }
        ).catch(() => {});
      }
    } catch (err) {
      logger.warn('Error during token revocation', err);
    } finally {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(SECURE_STORE_KEYS.AUTH_TOKENS);
          window.localStorage.removeItem(SECURE_STORE_KEYS.USER_PROFILE);
        }
      } else {
        await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.AUTH_TOKENS).catch(() => {});
        await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.USER_PROFILE).catch(() => {});
      }
      logger.info('Local Google OAuth credentials securely cleared');
    }
  },
};
