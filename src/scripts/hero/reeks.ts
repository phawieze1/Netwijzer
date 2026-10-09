/**
 * De reeks aan de clientkant: inlezen uit de pagina en opvragen per kwartier.
 *
 * De data staat als JSON in de pagina (door `PolderLandscape.astro` gezet), dus er
 * is geen netwerkverzoek nodig. Er wordt niets bijgerekend: een `null` blijft
 * `null`, en tussen twee metingen met een gat wordt niet geïnterpoleerd. Zo'n gat
 * wordt mist, net als het deel na "nu".
 */

import type { HeroData } from '../../lib/reeks';
import { soepel } from './palet';

export type { HeroData };

/**
 * Wat in beeld komt als een waarde niet gemeten is. Staat hier apart van
 * `GEEN_WAARDE` in `src/lib/reeks.ts` omdat die module het bestand inleest; die
 * mee-importeren zou de hele JSON in het hero-script trekken. Houd ze gelijk.
 */
export const GEEN_WAARDE = '–';

export interface HeroPunt {
  zon: number | null;
  wind: number | null;
  verbruik: number | null;
}

/** Een aaneengesloten reeks gemeten kwartieren, grenzen meegerekend. */
export interface Segment {
  van: number;
  tot: number;
}

function isGetalReeks(waarde: unknown): waarde is (number | null)[] {
  return (
    Array.isArray(waarde) && waarde.every((item) => item === null || (typeof item === 'number' && Number.isFinite(item)))
  );
}

/**
 * Leest het JSON-blok. Geeft `null` bij alles wat niet de verwachte vorm heeft,
 * zodat het landschap niet half getekend raakt.
 */
export function leesHeroData(bron: Element | null): HeroData | null {
  if (bron === null) return null;
  let ruw: unknown;
  try {
    ruw = JSON.parse(bron.textContent ?? '');
  } catch {
    return null;
  }
  if (typeof ruw !== 'object' || ruw === null) return null;
  const kandidaat = ruw as Partial<HeroData>;
  if (typeof kandidaat.vanMs !== 'number' || typeof kandidaat.nuQ !== 'number') return null;
  if (typeof kandidaat.dagQ !== 'number' || typeof kandidaat.totaalQ !== 'number') return null;
  if (typeof kandidaat.laatsteQ !== 'number' || !Array.isArray(kandidaat.asLabels)) return null;
  if (!isGetalReeks(kandidaat.zon) || !isGetalReeks(kandidaat.wind) || !isGetalReeks(kandidaat.verbruik)) return null;
  if (kandidaat.laatsteQ < 0) return null;
  return kandidaat as HeroData;
}

export function bij(reeks: (number | null)[], index: number): number | null {
  return reeks[index] ?? null;
}

/**
 * Waarde op een (niet per se hele) kwartierpositie. Tussen twee metingen wordt
 * lineair gelezen; grenst de positie aan een ontbrekende meting, dan is er geen
 * waarde. Nooit verzinnen.
 */
function lees(reeks: (number | null)[], q: number, laatste: number): number | null {
  const geklemd = Math.max(0, Math.min(laatste, q));
  const i = Math.floor(geklemd);
  const a = bij(reeks, i);
  if (a === null) return null;
  const f = geklemd - i;
  if (f === 0 || i >= laatste) return a;
  const b = bij(reeks, i + 1);
  if (b === null) return a;
  return a + (b - a) * f;
}

export function puntBij(data: HeroData, q: number): HeroPunt {
  return {
    zon: lees(data.zon, q, data.laatsteQ),
    wind: lees(data.wind, q, data.laatsteQ),
    verbruik: lees(data.verbruik, q, data.laatsteQ),
  };
}

/** Aaneengesloten stukken waarvoor wél een meting bestaat. */
export function segmenten(reeks: (number | null)[], laatste: number): Segment[] {
  const uit: Segment[] = [];
  let open: Segment | null = null;
  for (let i = 0; i <= laatste; i++) {
    if (bij(reeks, i) === null) {
      open = null;
      continue;
    }
    if (open === null) {
      open = { van: i, tot: i };
      uit.push(open);
    } else {
      open.tot = i;
    }
  }
  return uit;
}

/** Stukken waarin minstens één van de drie waarden ontbreekt: daar hoort mist. */
export function gaten(data: HeroData): Segment[] {
  const uit: Segment[] = [];
  let open: Segment | null = null;
  for (let i = 0; i <= data.laatsteQ; i++) {
    const compleet = bij(data.zon, i) !== null && bij(data.wind, i) !== null && bij(data.verbruik, i) !== null;
    if (compleet) {
      open = null;
      continue;
    }
    if (open === null) {
      open = { van: i, tot: i };
      uit.push(open);
    } else {
      open.tot = i;
    }
  }
  return uit;
}

/** Uur van de dag (0–24) bij een kwartierpositie; respecteert de dagscheiding. */
export function uurVanDag(data: HeroData, q: number): number {
  const binnenDeDag = q >= data.dagQ ? q - data.dagQ : q;
  return (binnenDeDag / 4) % 24;
}

/** Hoeveel daglicht er op dat uur is: 0 is nacht, 1 is volop dag. */
export function daglicht(data: HeroData, uur: number): number {
  const op = soepel(data.zonop - 1.1, data.zonop + 0.9, uur);
  const onder = 1 - soepel(data.zononder - 0.9, data.zononder + 1.1, uur);
  return op * onder;
}

/** Het moment als epoch-ms, voor de tijdnotatie uit `src/lib/format.ts`. */
export function momentIso(data: HeroData, q: number): string {
  return new Date(data.vanMs + Math.round(q * 15) * 60_000).toISOString();
}
