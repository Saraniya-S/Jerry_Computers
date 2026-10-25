/** Round to 2 decimals so trig-derived coordinates match between server and browser. */
export const r2 = (n: number) => Math.round(n * 100) / 100;
