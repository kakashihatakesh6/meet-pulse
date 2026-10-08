import { create } from 'zustand';
import { GoogleUser, AuthTokens } from '../types/auth';
import { GoogleOAuthService } from '../services/google/oauth';
import { logger } from '../utils/logger';

interface AuthStoreState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: GoogleUser | null;
  error: string | null;
  isOffline: boolean;

  // Actions
  initializeSession: () => Promise<void>;
  setAuthenticatedUser: (user: GoogleUser, tokens: AuthTokens) => Promise<void>;
  setOfflineState: (isOffline: boolean) => void;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,
  isOffline: false,

  initializeSession: async () => {
    set({ isLoading: true, error: null });
    try {
      const tokens = await GoogleOAuthService.getStoredTokens();
      const user = await GoogleOAuthService.getStoredUser();

      if (tokens && user) {
        set({
          isAuthenticated: true,
          user,
          isLoading: false,
        });
        logger.info(`Restored session for user: ${user.email}`);
      } else {
        set({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });
      }
    } catch (err) {
      logger.error('Failed to initialize auth session', err);
      set({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: 'Failed to restore session',
      });
    }
  },

  setAuthenticatedUser: async (user: GoogleUser, tokens: AuthTokens) => {
    try {
      await GoogleOAuthService.storeTokens(tokens);
      await GoogleOAuthService.storeUser(user);
    } catch (err) {
      logger.warn('Failed to persist user session to storage', err);
    } finally {
      set({
        isAuthenticated: true,
        user,
        isLoading: false,
        error: null,
      });
      logger.info(`User authenticated: ${user.email}`);
    }
  },

  setOfflineState: (isOffline: boolean) => {
    set({ isOffline });
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await GoogleOAuthService.signOut();
      set({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
      });
      logger.info('User signed out and credentials wiped');
    } catch (err) {
      logger.error('Error during sign out', err);
      set({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
