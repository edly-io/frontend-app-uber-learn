// ── Formatting utilities ─────────────────────────────────

export const toOrdinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export const getResetsText = (resetsOn: string): string => {
  const d = new Date(resetsOn);
  return `resets ${d.toLocaleString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`;
};
