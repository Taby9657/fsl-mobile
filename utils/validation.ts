/**
 * FSL Form validation helpers
 * Vrací null pokud OK, nebo string s chybovou zprávou.
 */

export function validateRequired(value: string, label: string): string | null {
  if (!value.trim()) return `${label} je povinné pole.`;
  return null;
}

export function validateMinLength(value: string, min: number, label: string): string | null {
  if (value.trim().length < min) return `${label} musí mít alespoň ${min} znaky.`;
  return null;
}

export function validatePhone(value: string): string | null {
  if (!value.trim()) return null; // phone is optional
  const cleaned = value.replace(/\s/g, '');
  if (!/^\+?\d{9,15}$/.test(cleaned)) return 'Telefonní číslo není platné.';
  return null;
}

export function validateBirthdate(value: string): string | null {
  if (!value.trim()) return null; // optional
  const parts = value.split('.');
  if (parts.length !== 3) return 'Datum musí být ve formátu DD.MM.RRRR';
  const [d, m, y] = parts.map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime()) || date.getFullYear() < 1920 || date.getFullYear() > new Date().getFullYear()) {
    return 'Datum narození není platné.';
  }
  return null;
}

export function validateJersey(value: string): string | null {
  if (!value.trim()) return null; // optional
  const n = Number(value);
  if (isNaN(n) || n < 1 || n > 99) return 'Číslo dresu musí být 1–99.';
  return null;
}

export function validateName(value: string, label: string): string | null {
  const err = validateRequired(value, label);
  if (err) return err;
  if (value.trim().length < 2) return `${label} musí mít alespoň 2 znaky.`;
  return null;
}

/** Shromáždí seznam chyb a vrátí první, nebo null. */
export function firstError(checks: (string | null)[]): string | null {
  return checks.find(e => e !== null) ?? null;
}
