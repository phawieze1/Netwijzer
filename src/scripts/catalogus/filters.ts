/**
 * Filter-island van de catalogus.
 *
 * Klein en zonder framework: het filtert client-side op de data-attributen die
 * `velden.ts` beschrijft, en wisselt tussen lijst- en kaartweergave.
 *
 * Zonder JavaScript is alles zichtbaar en is er niets kapot: de rijen en kaarten
 * staan er gewoon, en de knoppen (die zonder JavaScript niets zouden doen) staan
 * in de HTML op `hidden`. Dit script haalt dat weg.
 */

import { FILTERGROEPEN, FILTER_ATTRIBUUT, isFiltergroep, type Filtergroep } from './velden.ts';

/** Koppelt elke catalogus op de pagina. Veilig om twee keer te laten lopen. */
export function startCatalogus(): void {
  for (const wortel of document.querySelectorAll<HTMLElement>('[data-catalogus]')) {
    if (wortel.dataset.catalogusActief === 'ja') continue;
    wortel.dataset.catalogusActief = 'ja';
    koppel(wortel);
  }
}

function koppel(wortel: HTMLElement): void {
  const items = [...wortel.querySelectorAll<HTMLElement>('[data-slug]')];
  const chips = [...wortel.querySelectorAll<HTMLButtonElement>('button[data-groep]')];
  const leeg = wortel.querySelector<HTMLElement>('[data-leeg]');
  const telling = wortel.querySelector<HTMLElement>('[data-telling]');

  for (const bediening of wortel.querySelectorAll<HTMLElement>('[data-bediening]')) {
    bediening.hidden = false;
  }

  /** Per groep de gekozen waarde; een lege string betekent "alles". */
  const keuze = new Map<Filtergroep, string>();

  function pas(meld: boolean): void {
    const zichtbaar = new Set<string>();

    for (const item of items) {
      const past = FILTERGROEPEN.every((groep) => {
        const gekozen = keuze.get(groep);
        if (gekozen === undefined || gekozen === '') return true;
        return item.getAttribute(FILTER_ATTRIBUUT[groep]) === gekozen;
      });
      item.hidden = !past;
      const slug = item.dataset.slug;
      if (past && slug !== undefined) zichtbaar.add(slug);
    }

    for (const chip of chips) {
      const groep = chip.dataset.groep;
      if (groep === undefined || !isFiltergroep(groep)) continue;
      const actief = (chip.dataset.waarde ?? '') === (keuze.get(groep) ?? '');
      chip.setAttribute('aria-pressed', String(actief));
    }

    if (leeg !== null) leeg.hidden = zichtbaar.size > 0;

    // Terugkoppeling voor schermlezers: het aantal verandert bij elke keuze,
    // dus een live region moet het melden.
    if (telling !== null && meld) {
      telling.textContent =
        zichtbaar.size === 1 ? '1 dataset gevonden.' : `${zichtbaar.size} datasets gevonden.`;
    }
  }

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const groep = chip.dataset.groep;
      if (groep === undefined || !isFiltergroep(groep)) return;
      keuze.set(groep, chip.dataset.waarde ?? '');
      pas(true);
    });
  }

  koppelWeergave(wortel);

  // Een link van elders mag een filter meegeven, bijvoorbeeld
  // /Netwijzer/datasets/?thema=net. Onbekende waarden worden genegeerd.
  const vraag = new URLSearchParams(window.location.search);
  let uitUrl = false;
  for (const groep of FILTERGROEPEN) {
    const waarde = vraag.get(groep);
    if (waarde === null || waarde === '') continue;
    const bestaat = chips.some(
      (chip) => chip.dataset.groep === groep && chip.dataset.waarde === waarde,
    );
    if (!bestaat) continue;
    keuze.set(groep, waarde);
    uitUrl = true;
  }
  if (uitUrl) pas(false);
}

/** De weergaveschakelaar lijst/kaarten, met `aria-pressed` zoals in het prototype. */
function koppelWeergave(wortel: HTMLElement): void {
  const knoppen = [...wortel.querySelectorAll<HTMLButtonElement>('button[data-weergaveknop]')];
  const panelen = [...wortel.querySelectorAll<HTMLElement>('[data-weergave]')];
  if (knoppen.length === 0 || panelen.length === 0) return;

  for (const knop of knoppen) {
    knop.addEventListener('click', () => {
      const gekozen = knop.dataset.weergaveknop;
      if (gekozen === undefined) return;
      for (const andere of knoppen) {
        andere.setAttribute('aria-pressed', String(andere === knop));
      }
      for (const paneel of panelen) {
        paneel.hidden = paneel.dataset.weergave !== gekozen;
      }
    });
  }
}
