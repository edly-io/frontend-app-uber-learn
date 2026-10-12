// ── Formatting utilities ─────────────────────────────────

export const toOrdinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export const getResetsText = (resetsOn?: string): string => {
  if (resetsOn) {
    const d = new Date(resetsOn);
    return `resets ${d.toLocaleString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}`;
  }
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return `resets 1 ${d.toLocaleString('en-US', { month: 'long' })}`;
};
