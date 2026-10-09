/**
 * Het landschapspalet voor het canvas.
 *
 * Harde regel: geen losse kleurwaarden. De waarden komen daarom rechtstreeks uit
 * `design/tokens.json` onder `landscape` — hetzelfde palet dat `tokens.css` voor
 * het waardenvak als `--ls-*` beschikbaar maakt. Het landschap wisselt niet mee
 * met licht/donker: het is een eigen wereld (identiteit §3).
 *
 * Tinten die het canvas verder nodig heeft (grijzen voor de horizonlijn, tekst op
 * een lichte of donkere lucht) worden hier gemengd uit diezelfde tokens, niet
 * ergens los opgeschreven.
 */

// Named import, zodat alleen het landschapspalet in het hero-script belandt en
// niet de hele tokenslijst.
import { landscape as ls } from '../../../design/tokens.json';

export type Rgb = readonly [number, number, number];

function kleur(waarde: readonly number[]): Rgb {
  const [r, g, b] = waarde;
  return [r ?? 0, g ?? 0, b ?? 0];
}

export const PALET = {
  dayTop: kleur(ls.dayTop),
  dayBottom: kleur(ls.dayBottom),
  nightTop: kleur(ls.nightTop),
  nightBottom: kleur(ls.nightBottom),
  dusk: kleur(ls.dusk),
  land: kleur(ls.land),
  landNight: kleur(ls.landNight),
  water: kleur(ls.water),
  waterNight: kleur(ls.waterNight),
  sun: kleur(ls.sun),
  window: kleur(ls.window),
  mill: kleur(ls.mill),
  millNight: kleur(ls.millNight),
  mist: kleur(ls.mist),
  playhead: kleur(ls.playhead),
} as const;

/** Tekst op een donkere lucht: de lichtste tint van het palet. */
export const INK_LICHT = PALET.dayBottom;
/** Tekst op een lichte lucht: de donkerste tint van het palet. */
export const INK_DONKER = PALET.nightTop;

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const f = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

export function rgb(c: Rgb, alpha = 1): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

/** Zachte overgang tussen twee grenzen, zoals smoothstep. */
export function soepel(van: number, tot: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - van) / (tot - van)));
  return t * t * (3 - 2 * t);
}

/** Gauss-klok; gebruikt voor schemer en voor de pieken in het licht. */
export function klok(x: number, midden: number, breedte: number): number {
  return Math.exp(-((x - midden) ** 2) / (2 * breedte * breedte));
}

/** Het grijs van de horizonlijn in de mist: mist gemengd met de nachtlucht. */
export const MIST_LIJN = mix(PALET.mist, PALET.nightTop, 0.52);
/** Iets donkerder, voor "nog niet gemeten" en de labels in de mist. */
export const MIST_TEKST = mix(PALET.mist, PALET.nightTop, 0.68);
