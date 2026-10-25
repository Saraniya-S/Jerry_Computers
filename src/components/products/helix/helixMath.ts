/**
 * Double-helix geometry.
 *
 * Products alternate between strand A and strand B. Each product has a
 * "front time" τ = index / 2: when the scroll parameter f equals τ, that
 * product faces the viewer. Strand A's front point sits above centre and
 * strand B's below, so the two intertwining paths take turns presenting a
 * product. Moving f screws the rigid helix: rotation and vertical travel
 * stay locked together, so cards slide along their strands.
 */
export type HelixConfig = {
  radius: number; // px from the axis
  pitch: number; // px of vertical travel per full turn
  step: number; // degrees between neighbours on one strand
};

export const desktopHelix: HelixConfig = { radius: 260, pitch: 600, step: 56 };

export function frontTime(index: number) {
  return index / 2;
}

export function strandOf(index: number): 0 | 1 {
  return (index % 2) as 0 | 1;
}

/** Angle (deg) and vertical offset (px) for a point on a strand at front time τ, given scroll f. */
export function helixPoint(tau: number, strand: 0 | 1, f: number, cfg: HelixConfig) {
  const d = tau - f;
  const angle = d * cfg.step;
  const rise = (cfg.pitch * cfg.step) / 360; // px per unit of τ
  const y = (strand === 0 ? -cfg.pitch / 4 : cfg.pitch / 4) + d * rise;
  return { angle, y };
}

/** 1 when facing the viewer, 0 at the sides, negative behind. */
export function facing(angleDeg: number) {
  return Math.cos((angleDeg * Math.PI) / 180);
}
