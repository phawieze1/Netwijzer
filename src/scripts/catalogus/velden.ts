/**
 * Gedeelde afspraken tussen de catalogus-componenten (server) en het
 * filter-island (browser): welke filtergroepen er zijn, in welk data-attribuut
 * een item zijn waarde bewaart, en welke attributen elk item meekrijgt.
 *
 * Het prototype filtert op data-attributen (`data-th`, `data-txt`); die namen
 * zijn met opzet overgenomen, zodat het prototype na te lopen blijft.
 *
 * Dit bestand kent geen DOM en geen Astro: het wordt zowel bij de build als in
 * de browser ingelezen.
 */

/** De filtergroepen uit docs/02-bouwspecificatie.md §4, in deze volgorde. */
export const FILTERGROEPEN = ['thema', 'formaat', 'toegang', 'frequentie'] as const;

export type Filtergroep = (typeof FILTERGROEPEN)[number];

/** Het data-attribuut waarin een item zijn waarde voor die groep bewaart. */
export const FILTER_ATTRIBUUT: Record<Filtergroep, string> = {
  thema: 'data-th',
  formaat: 'data-formaat',
  toegang: 'data-toegang',
  frequentie: 'data-frequentie',
};

/** Wat een rij of kaart nodig heeft om filterbaar en telbaar te zijn. */
export interface Catalogusitem {
  slug: string;
  naam: string;
  bronnaam: string;
  thema: string;
  themaNaam: string;
  formaat: string;
  toegang: string;
  frequentie: string;
}

/**
 * De data-attributen van één rij of kaart. `data-slug` maakt het mogelijk om te
 * tellen hoeveel dátasets zichtbaar zijn in plaats van hoeveel elementen (elke
 * dataset staat er twee keer in: als rij en als kaart).
 *
 * `data-txt` is de zoektekst; het zoekveld van de homepage kan daarop filteren,
 * net als in het prototype.
 */
export function itemAttributen(item: Catalogusitem): Record<string, string> {
  return {
    'data-slug': item.slug,
    'data-th': item.thema,
    'data-formaat': item.formaat,
    'data-toegang': item.toegang,
    'data-frequentie': item.frequentie,
    'data-txt': `${item.naam} ${item.bronnaam} ${item.themaNaam}`.toLowerCase(),
  };
}

export function isFiltergroep(waarde: string): waarde is Filtergroep {
  return (FILTERGROEPEN as readonly string[]).includes(waarde);
}
