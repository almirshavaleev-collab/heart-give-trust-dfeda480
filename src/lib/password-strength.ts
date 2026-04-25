export type PasswordStrength = "empty" | "weak" | "medium" | "strong";

const COMMON_PASSWORDS = new Set([
  "password", "passw0rd", "password1", "password123",
  "12345678", "123456789", "1234567890", "qwerty", "qwerty123", "qwertyuiop",
  "111111", "11111111", "123123", "abc123", "letmein", "welcome",
  "admin", "admin123", "iloveyou", "monkey", "dragon", "master",
  "sunshine", "princess", "football", "baseball", "superman",
  "qazwsx", "zxcvbn", "asdfgh", "trustno1",
]);

export interface PasswordHints {
  strength: PasswordStrength;
  /** Hint to show under the field. Empty if password is OK. */
  hint: string | null;
}

export function evaluatePassword(pwd: string): PasswordHints {
  if (!pwd) return { strength: "empty", hint: null };

  const lower = pwd.toLowerCase();
  const len = pwd.length;
  const hasLetters = /[a-zа-яё]/i.test(pwd);
  const hasDigits = /\d/.test(pwd);
  const hasSymbols = /[^A-Za-zА-Яа-яЁё0-9]/.test(pwd);
  const onlyDigits = /^\d+$/.test(pwd);
  const onlyLetters = /^[A-Za-zА-Яа-яЁё]+$/.test(pwd);

  // Hard "too simple" patterns
  if (COMMON_PASSWORDS.has(lower)) {
    return { strength: "weak", hint: "Слишком простой пароль" };
  }
  // Sequential digits like 12345678 / 87654321
  if (onlyDigits && len >= 4) {
    const seqUp = "01234567890123456789";
    const seqDown = "98765432109876543210";
    if (seqUp.includes(pwd) || seqDown.includes(pwd)) {
      return { strength: "weak", hint: "Слишком простой пароль" };
    }
  }
  // Repeated single character: aaaaaaaa, 11111111
  if (/^(.)\1+$/.test(pwd)) {
    return { strength: "weak", hint: "Слишком простой пароль" };
  }

  if (len < 8) {
    return { strength: "weak", hint: "Минимум 8 символов" };
  }
  if (onlyDigits) {
    return { strength: "weak", hint: "Добавьте буквы" };
  }
  if (onlyLetters) {
    return { strength: "medium", hint: "Добавьте цифры для надёжности" };
  }

  // Has length + mix of letters/digits
  let score = 0;
  if (len >= 8) score += 1;
  if (len >= 12) score += 1;
  if (hasLetters && hasDigits) score += 1;
  if (hasSymbols) score += 1;
  if (/[A-ZА-ЯЁ]/.test(pwd) && /[a-zа-яё]/.test(pwd)) score += 1;

  if (score >= 4) return { strength: "strong", hint: null };
  if (score >= 2) return { strength: "medium", hint: null };
  return { strength: "weak", hint: "Слишком простой пароль" };
}

export const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  empty: "",
  weak: "Слабый",
  medium: "Средний",
  strong: "Надёжный",
};
