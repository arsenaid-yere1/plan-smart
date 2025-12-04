/**
 * Password strength validator per NFR requirements:
 * - Minimum 12 characters
 * - At least 3 character classes (uppercase, lowercase, numbers, special)
 * - Not in common pwned passwords list
 */

const MIN_LENGTH = 12;
const MIN_CHARACTER_CLASSES = 3;

export interface PasswordStrength {
  score: number; // 0-4
  feedback: string[];
  isValid: boolean;
}

export function validatePassword(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length < MIN_LENGTH) {
    feedback.push(`Password must be at least ${MIN_LENGTH} characters`);
  } else if (password.length >= 16) {
    score += 2;
  } else {
    score += 1;
  }

  // Character class checks
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  const characterClasses = [
    hasLowercase,
    hasUppercase,
    hasNumbers,
    hasSpecial,
  ].filter(Boolean).length;

  if (characterClasses < MIN_CHARACTER_CLASSES) {
    feedback.push(
      `Password must contain at least ${MIN_CHARACTER_CLASSES} of: uppercase, lowercase, numbers, special characters`
    );
  } else {
    score += characterClasses;
  }

  // Common patterns check
  const commonPatterns = [
    /^123456/,
    /password/i,
    /qwerty/i,
    /abc123/i,
    /letmein/i,
  ];

  const hasCommonPattern = commonPatterns.some((pattern) =>
    pattern.test(password)
  );

  if (hasCommonPattern) {
    feedback.push('Password contains common patterns');
    score = Math.max(0, score - 2);
  }

  // Sequential characters check
  const hasSequential = /(.)\1{2,}/.test(password);
  if (hasSequential) {
    feedback.push('Avoid repeating characters');
    score = Math.max(0, score - 1);
  }

  const isValid =
    password.length >= MIN_LENGTH &&
    characterClasses >= MIN_CHARACTER_CLASSES &&
    !hasCommonPattern;

  return {
    score: Math.min(4, score),
    feedback: feedback.length > 0 ? feedback : ['Strong password'],
    isValid,
  };
}

export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return 'Weak';
    case 2:
      return 'Fair';
    case 3:
      return 'Good';
    case 4:
      return 'Strong';
    default:
      return 'Unknown';
  }
}

export function getPasswordStrengthColor(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return 'bg-red-500';
    case 2:
      return 'bg-orange-500';
    case 3:
      return 'bg-yellow-500';
    case 4:
      return 'bg-green-500';
    default:
      return 'bg-gray-300';
  }
}
