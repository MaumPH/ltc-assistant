export function toSafeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(toSafeString).filter(Boolean).join(' ');

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['value', 'date', 'text', 'label', 'summary', 'title', 'detail', 'answer', 'headline', 'conclusion', 'actor', 'artifact', 'term', 'reason']) {
      const normalized = toSafeString(record[key]);
      if (normalized) return normalized;
    }
  }

  return '';
}

export function safeTrim(value: unknown): string {
  return toSafeString(value).trim();
}
