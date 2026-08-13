// Referral program helpers shared across pages.

export const REFERRAL_CREDIT_COP_DEFAULT = 50000;

// Short human-shareable code. Uppercase + digits, avoids confusing
// characters (0/O, 1/I). Length 6 gives ~10^8 codes — plenty and short
// enough to dictate over the phone.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateReferralCode(): string {
  let out = 'AKU-';
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function referralUrl(code: string): string {
  if (typeof window === 'undefined') return `/r/${code}`;
  return `${window.location.origin}/r/${code}`;
}

// Lead status buckets that indicate the referred family reached the
// terminal "enrolled" state — i.e. the referring parent has earned the
// credit.
export function isReferralConverted(status: string | null | undefined): boolean {
  return status === 'enrolled';
}

export function formatCop(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}
