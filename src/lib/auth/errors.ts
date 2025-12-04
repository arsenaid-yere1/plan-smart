export class AuthError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number = 400) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super('Invalid email or password', 'invalid_credentials', 401);
  }
}

export class EmailNotVerifiedError extends AuthError {
  constructor() {
    super('Email not verified', 'email_not_verified', 403);
  }
}

export class UserAlreadyExistsError extends AuthError {
  constructor() {
    super('User already exists', 'user_exists', 409);
  }
}

export class WeakPasswordError extends AuthError {
  constructor(message: string) {
    super(message, 'weak_password', 400);
  }
}

export class TokenExpiredError extends AuthError {
  constructor() {
    super('Token has expired', 'token_expired', 401);
  }
}

export class SessionExpiredError extends AuthError {
  constructor() {
    super('Session has expired', 'session_expired', 401);
  }
}
