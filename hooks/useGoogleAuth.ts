import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { useAuthStore } from '../store/auth.store';
import {
  getGoogleClientId,
  getRedirectUri,
  GoogleOAuthService,
} from '../services/google/oauth';
import {
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_OAUTH_ENDPOINTS,
} from '../constants/oauth';
import { AuthTokens } from '../types/auth';
import { logger } from '../utils/logger';

export function useGoogleAuth() {
  const {
    isAuthenticated,
    isLoading: isStoreLoading,
    user,
    error,
    signOut,
    setAuthenticatedUser,
    clearError,
  } = useAuthStore();

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const clientId = getGoogleClientId();
  const redirectUri = getRedirectUri();
  const isWeb = Platform.OS === 'web';

  // Configure Expo AuthSession request
  // On Web: Google Web Client OAuth requires client_secret for backend code exchange,
  // so we use ResponseType.Token (Implicit flow) which securely returns access_token directly in browser without a secret.
  // On Native: Use ResponseType.Code with PKCE.
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId || 'dummy-client-id.apps.googleusercontent.com',
      scopes: GOOGLE_OAUTH_SCOPES,
      redirectUri,
      responseType: isWeb
        ? AuthSession.ResponseType.Token
        : AuthSession.ResponseType.Code,
      usePKCE: !isWeb,
      extraParams: isWeb
        ? {}
        : {
            access_type: 'offline', // Requests refresh_token
            prompt: 'consent',
          },
    },
    {
      authorizationEndpoint: GOOGLE_OAUTH_ENDPOINTS.authorizationEndpoint,
      tokenEndpoint: GOOGLE_OAUTH_ENDPOINTS.tokenEndpoint,
    }
  );

  // Handle OAuth code or token response
  useEffect(() => {
    async function handleAuthResponse() {
      if (response?.type === 'success') {
        setIsAuthenticating(true);
        setAuthError(null);

        try {
          let tokens: AuthTokens;

          // Check for direct access_token (Web implicit flow or direct authentication)
          const directAccessToken =
            response.params?.access_token ||
            (response as any).authentication?.accessToken;

          if (directAccessToken) {
            logger.info('Received direct OAuth access token (Implicit flow)');
            tokens = {
              accessToken: directAccessToken,
              refreshToken:
                response.params?.refresh_token ||
                (response as any).authentication?.refreshToken,
              idToken:
                response.params?.id_token ||
                (response as any).authentication?.idToken,
              expiresIn: parseInt(response.params?.expires_in || '3600', 10),
              tokenType: response.params?.token_type || 'Bearer',
              scope: response.params?.scope,
              issuedAt: Date.now(),
            };
          } else if (response.params?.code) {
            // Authorization code exchange (Native PKCE flow)
            logger.info('Exchanging authorization code for OAuth tokens...');
            const tokenResult = await AuthSession.exchangeCodeAsync(
              {
                clientId,
                code: response.params.code,
                redirectUri,
                extraParams: {
                  code_verifier: request?.codeVerifier || '',
                },
              },
              {
                tokenEndpoint: GOOGLE_OAUTH_ENDPOINTS.tokenEndpoint,
              }
            );

            tokens = {
              accessToken: tokenResult.accessToken,
              refreshToken: tokenResult.refreshToken,
              idToken: tokenResult.idToken,
              expiresIn: tokenResult.expiresIn || 3600,
              tokenType: tokenResult.tokenType || 'Bearer',
              scope: tokenResult.scope,
              issuedAt: Date.now(),
            };
          } else {
            throw new Error('No access token or authorization code received from Google');
          }

          logger.info('Fetching Google User Profile...');
          const userProfile = await GoogleOAuthService.fetchUserProfile(tokens.accessToken);

          await setAuthenticatedUser(userProfile, tokens);
        } catch (err) {
          logger.error('Google OAuth token processing failed', err);
          setAuthError(err instanceof Error ? err.message : 'Google authentication failed');
        } finally {
          setIsAuthenticating(false);
        }
      } else if (response?.type === 'error') {
        logger.error('OAuth response error', response.error);
        const errMessage = (response.error as any)?.message || (response.error as any)?.description || 'Authentication was cancelled or failed';
        setAuthError(errMessage);
        setIsAuthenticating(false);
      } else if (response?.type === 'dismiss' || response?.type === 'cancel') {
        setIsAuthenticating(false);
      }
    }

    handleAuthResponse();
  }, [response, clientId, redirectUri, request?.codeVerifier, setAuthenticatedUser]);

  const signIn = useCallback(async () => {
    setAuthError(null);
    clearError();

    if (!clientId) {
      setAuthError(
        'Google Client ID is not configured. Please set EXPO_PUBLIC_GOOGLE_CLIENT_ID in your .env'
      );
      return;
    }

    try {
      setIsAuthenticating(true);
      await promptAsync();
    } catch (err) {
      logger.error('Failed to trigger Google Sign-In prompt', err);
      setAuthError('Failed to launch Google Sign-In window');
      setIsAuthenticating(false);
    }
  }, [clientId, promptAsync, clearError]);

  return {
    isAuthenticated,
    isLoading: isStoreLoading || isAuthenticating,
    user,
    error: authError || error,
    signIn,
    signOut,
    isReady: !!request,
  };
}
