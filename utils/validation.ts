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

/* ---------------- Věk ----------------
   Do FSL smí jen dospělí — 18 let **ke dni registrace**. Skutečnou pojistkou
   je backend (`src/utils/vek.js`), tohle je jen ohleduplnost k uživateli.
   Shodné s webem (`src/lib/validation.ts`). */

export const VEKOVA_HRANICE = 18;

/** Dovršený věk v letech, nebo `null`, když datum nedává smysl. */
export function vekVLetech(value: string, kDatu = new Date()): number | null {
  // Bere `YYYY-MM-DD` i celé ISO z `Date.toISOString()`.
  const shoda = /^(\d{4})-(\d{2})-(\d{2})/.exec((value ?? '').trim());
  if (!shoda) return null;
  const [, r, m, d] = shoda.map(Number);
  const datum = new Date(r, m - 1, d);
  // `new Date(2007, 1, 31)` nespadne, jen tiše posune na 3. března.
  if (datum.getFullYear() !== r || datum.getMonth() !== m - 1 || datum.getDate() !== d) return null;
  let let_ = kDatu.getFullYear() - r;
  const mesic = kDatu.getMonth() - (m - 1);
  if (mesic < 0 || (mesic === 0 && kDatu.getDate() < d)) let_ -= 1;
  return let_;
}

/**
 * Datum narození je **povinné** — bez něj se nedá ověřit věk.
 *
 * Do 11. 9. 2026 čekala tahle funkce `DD.MM.RRRR`, ale obrazovka jí posílala
 * ISO z `Date.toISOString()`. Kdo v appce datum narození vybral, dostal
 * „Datum musí být ve formátu DD.MM.RRRR" a registraci nedokončil.
 */
export function validateBirthdate(value: string): string | null {
  if (!value?.trim()) return 'Datum narození je povinné.';
  const let_ = vekVLetech(value);
  if (let_ === null) return 'Datum narození není platné.';
  if (Number(value.slice(0, 4)) < 1920 || let_ < 0) return 'Datum narození není platné.';
  if (let_ < VEKOVA_HRANICE) return `Do FSL smí jen hráči od ${VEKOVA_HRANICE} let.`;
  return null;
}

/** Datum narození schované v rodném čísle — `RRMMDD/XXX[X]`, jako `YYYY-MM-DD`. */
export function datumZRodnehoCisla(value: string): string | null {
  const cisla = (value ?? '').replace(/\D/g, '');
  if (cisla.length !== 9 && cisla.length !== 10) return null;

  const rr = Number(cisla.slice(0, 2));
  let mm = Number(cisla.slice(2, 4));
  const dd = Number(cisla.slice(4, 6));

  // Ženám se k měsíci přičítá 50, od roku 2004 navíc 20 (u žen tedy 70).
  if (mm > 70) mm -= 70;
  else if (mm > 50) mm -= 50;
  else if (mm > 20) mm -= 20;

  // Devítimístné rodné číslo se přidělovalo do roku 1953.
  const rok = cisla.length === 9 ? 1900 + rr : rr <= 53 ? 2000 + rr : 1900 + rr;
  const datum = `${rok}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  return vekVLetech(datum) === null ? null : datum;
}

/**
 * Rodné číslo rozhodčího. Od 11. 9. 2026 **povinné** — nese datum narození
 * a pískat smí jen od 18 let. Kontrolní číslice se schválně neověřuje:
 * u starších rodných čísel neplatí.
 */
export function validateBirthNo(value: string): string | null {
  if (!value?.trim()) return 'Rodné číslo je povinné.';
  const datum = datumZRodnehoCisla(value);
  if (!datum) return 'Rodné číslo zadej ve formátu 950615/1234.';
  return validateBirthdate(datum);
}

export function validateJersey(value: string): string | null {
  if (!value.trim()) return null; // optional
  const n = Number(value);
  // Nula je platné číslo dresu a backend ji bere — dřív ji appka odmítala
  if (!Number.isInteger(n) || n < 0 || n > 99) return 'Číslo dresu musí být 0–99.';
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
