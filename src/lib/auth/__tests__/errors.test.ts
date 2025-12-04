import { describe, it, expect } from 'vitest';
import {
  AuthError,
  InvalidCredentialsError,
  EmailNotVerifiedError,
  UserAlreadyExistsError,
  WeakPasswordError,
  TokenExpiredError,
  SessionExpiredError,
} from '../errors';

describe('Auth Errors', () => {
  describe('AuthError', () => {
    it('should create error with message, code, and status', () => {
      const error = new AuthError('Test message', 'test_code', 500);
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('test_code');
      expect(error.status).toBe(500);
      expect(error.name).toBe('AuthError');
    });

    it('should default status to 400', () => {
      const error = new AuthError('Test', 'code');
      expect(error.status).toBe(400);
    });

    it('should be instance of Error', () => {
      const error = new AuthError('Test', 'code');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('InvalidCredentialsError', () => {
    it('should have correct message and code', () => {
      const error = new InvalidCredentialsError();
      expect(error.message).toBe('Invalid email or password');
      expect(error.code).toBe('invalid_credentials');
      expect(error.status).toBe(401);
    });
  });

  describe('EmailNotVerifiedError', () => {
    it('should have correct message and code', () => {
      const error = new EmailNotVerifiedError();
      expect(error.message).toBe('Email not verified');
      expect(error.code).toBe('email_not_verified');
      expect(error.status).toBe(403);
    });
  });

  describe('UserAlreadyExistsError', () => {
    it('should have correct message and code', () => {
      const error = new UserAlreadyExistsError();
      expect(error.message).toBe('User already exists');
      expect(error.code).toBe('user_exists');
      expect(error.status).toBe(409);
    });
  });

  describe('WeakPasswordError', () => {
    it('should have correct code and status with custom message', () => {
      const error = new WeakPasswordError('Password too short');
      expect(error.message).toBe('Password too short');
      expect(error.code).toBe('weak_password');
      expect(error.status).toBe(400);
    });
  });

  describe('TokenExpiredError', () => {
    it('should have correct message and code', () => {
      const error = new TokenExpiredError();
      expect(error.message).toBe('Token has expired');
      expect(error.code).toBe('token_expired');
      expect(error.status).toBe(401);
    });
  });

  describe('SessionExpiredError', () => {
    it('should have correct message and code', () => {
      const error = new SessionExpiredError();
      expect(error.message).toBe('Session has expired');
      expect(error.code).toBe('session_expired');
      expect(error.status).toBe(401);
    });
  });
});
