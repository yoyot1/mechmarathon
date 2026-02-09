/** Registration request body */
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

/** Login request body */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Successful auth response (login or register) */
export interface AuthResponse {
  token: string;
  user: import('./user').UserProfile;
}

/** Auth error response */
export interface AuthError {
  error: string;
  field?: string;
}
