export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface Session {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

export interface SignUpParams {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignInParams {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthProvider {
  // Core authentication
  signUp(params: SignUpParams): Promise<User>;
  signIn(params: SignInParams): Promise<Session>;
  signOut(): Promise<void>;

  // Session management
  getSession(): Promise<Session | null>;
  refreshSession(refreshToken: string): Promise<Session>;

  // Password management
  resetPassword(email: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
  updatePasswordByUserId(userId: string, newPassword: string): Promise<void>;

  // Email verification
  verifyEmail(token: string): Promise<void>;
  resendVerificationEmail(email: string): Promise<void>;

  // User info
  getUser(): Promise<User | null>;
}
