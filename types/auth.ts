export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  verifiedEmail?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number; // duration in seconds
  tokenType?: string;
  scope?: string;
  issuedAt: number; // Unix timestamp in ms
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: GoogleUser | null;
  error: string | null;
  isOffline: boolean;
}
