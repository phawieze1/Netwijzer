/**
 * Themafilter voor /nieuws/. Klein stukje vanilla TypeScript, geen framework.
 *
 * Zonder JavaScript blijft alles zichtbaar: de filterbalk staat in de HTML op
 * `hidden` en wordt hier pas aangezet, zodat er geen knoppen in beeld staan
 * die niets doen.
 *
 * Het filter verbergt zowel de berichten in de lijst als de stippen in de
 * rivier, zodat beeld en lijst hetzelfde laten zien. De `aria-label` van de
 * rivier vertelt welk filter aanstaat en de teller is `aria-live`, dus ook
 * zonder de tekening is duidelijk wat er gebeurt.
 *
 * Er beweegt niets, dus `prefers-reduced-motion` verandert hier niets.
 */

const KEUZE = 'data-thema-keuze';
const ALLE = 'alle';

export function startThemaFilter(): void {
  const balk = document.querySelector<HTMLElement>('[data-nieuws-filter]');
  const lijst = document.querySelector<HTMLElement>('[data-nieuws-lijst]');
  if (balk === null || lijst === null) return;

  const knoppen = Array.from(balk.querySelectorAll<HTMLButtonElement>(`button[${KEUZE}]`));
  if (knoppen.length === 0) return;

  const items = Array.from(lijst.querySelectorAll<HTMLElement>('.ni'));
  const leeg = document.querySelector<HTMLElement>('[data-nieuws-leeg]');
  const teller = balk.querySelector<HTMLElement>('[data-nieuws-aantal]');
  const rivier = document.querySelector<SVGSVGElement>('[data-nieuws-rivier]');
  const stippen =
    rivier === null ? [] : Array.from(rivier.querySelectorAll<SVGCircleElement>('circle[data-thema]'));
  const rivierLabel = rivier === null ? '' : (rivier.getAttribute('aria-label') ?? '');

  function pasToe(keuze: string): void {
    let zichtbaar = 0;

    for (const item of items) {
      const hoort = keuze === ALLE || item.getAttribute('data-thema') === keuze;
      item.hidden = !hoort;
      if (hoort) zichtbaar += 1;
    }

    for (const stip of stippen) {
      const hoort = keuze === ALLE || stip.getAttribute('data-thema') === keuze;
      if (hoort) stip.removeAttribute('hidden');
      else stip.setAttribute('hidden', '');
    }

    let naam = '';
    for (const knop of knoppen) {
      const eigen = knop.getAttribute(KEUZE) ?? ALLE;
      knop.setAttribute('aria-pressed', eigen === keuze ? 'true' : 'false');
      if (eigen === keuze) naam = knop.dataset['themaNaam'] ?? '';
    }

    if (teller !== null) {
      teller.textContent = zichtbaar === 1 ? '1 bericht' : `${zichtbaar} berichten`;
    }
    if (leeg !== null) leeg.hidden = zichtbaar > 0;
    if (rivier !== null) {
      rivier.setAttribute(
        'aria-label',
        keuze === ALLE || naam === '' ? rivierLabel : `${rivierLabel} Filter: alleen ${naam}.`,
      );
    }
  }

  for (const knop of knoppen) {
    knop.addEventListener('click', () => {
      pasToe(knop.getAttribute(KEUZE) ?? ALLE);
    });
  }

  balk.hidden = false;
  pasToe(ALLE);
}
