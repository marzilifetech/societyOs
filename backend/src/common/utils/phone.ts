export function normalizeIndianPhone(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  if (trimmed.startsWith('+') && digits.length >= 11) {
    return `+${digits}`;
  }

  return trimmed;
}
