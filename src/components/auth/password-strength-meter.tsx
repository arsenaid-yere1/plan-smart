'use client';

import { useEffect, useState } from 'react';
import {
  validatePassword,
  getPasswordStrengthLabel,
  getPasswordStrengthColor,
  type PasswordStrength,
} from '@/lib/auth/password-validator';

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const [strength, setStrength] = useState<PasswordStrength>({
    score: 0,
    feedback: [],
    isValid: false,
  });

  useEffect(() => {
    if (password.length > 0) {
      setStrength(validatePassword(password));
    } else {
      setStrength({ score: 0, feedback: [], isValid: false });
    }
  }, [password]);

  if (password.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${getPasswordStrengthColor(
              strength.score
            )}`}
            style={{ width: `${(strength.score / 4) * 100}%` }}
          />
        </div>
        <span className="text-sm font-medium">
          {getPasswordStrengthLabel(strength.score)}
        </span>
      </div>
      {strength.feedback.length > 0 && (
        <ul className="text-sm text-gray-600 space-y-1">
          {strength.feedback.map((item, index) => (
            <li key={index} className="flex items-start gap-1">
              <span>{strength.isValid ? '✓' : '•'}</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
