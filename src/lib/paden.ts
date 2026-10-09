/**
 * Base-bewuste URL's.
 *
 * Netwijzer staat op GitHub Pages onder /Netwijzer/, dus elk pad in de site moet
 * via `pad()`. Een hard-coded "/datasets/" werkt lokaal wel en op Pages niet.
 * Gebruik dit overal in href, src en action.
 */

const BASE = import.meta.env.BASE_URL;

/**
 * Maakt een absoluut sitepad. `pad('datasets')` en `pad('/datasets/')` geven
 * beide `/Netwijzer/datasets/`. Een leeg argument geeft de homepage.
 */
export function pad(...delen: string[]): string {
  const schoon = delen
    .flatMap((deel) => deel.split('/'))
    .map((deel) => deel.trim())
    .filter((deel) => deel.length > 0);
  const basis = BASE.endsWith('/') ? BASE : `${BASE}/`;
  return schoon.length === 0 ? basis : `${basis}${schoon.join('/')}/`;
}

/** Pad naar een bestand in public/, zonder afsluitende slash. */
export function bestand(naam: string): string {
  const basis = BASE.endsWith('/') ? BASE : `${BASE}/`;
  return `${basis}${naam.replace(/^\/+/, '')}`;
}

export const paden = {
  home: () => pad(),
  datasets: () => pad('datasets'),
  dataset: (slug: string) => pad('datasets', slug),
  nieuws: () => pad('nieuws'),
  nieuwsbericht: (slug: string) => pad('nieuws', slug),
  agenda: () => pad('agenda'),
  bronnen: () => pad('bronnen'),
  bron: (slug: string) => pad('bronnen', slug),
  over: () => pad('over'),
};
