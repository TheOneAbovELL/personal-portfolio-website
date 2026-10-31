const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-05" → "Oct 2026". Absolute, so server and client always render the same text. */
export const monthOf = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""} ${iso.slice(0, 4)}`;

/** Garage row number, e.g. "G.007" — the same number a repository has on the homepage Garage. */
export const garageNumber = (index: number) => `G.${String(index + 1).padStart(3, "0")}`;
