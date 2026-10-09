/**
 * Kopieerknop bij de startprompt (docs/02-bouwspecificatie.md §6, punt 6).
 *
 * De knop is een gewone `<button>`, dus hij werkt met het toetsenbord. Wat er
 * gebeurt wordt twee keer teruggekoppeld: in het opschrift van de knop en in een
 * live region ernaast, zodat een schermlezer het ook hoort.
 *
 * Lukt het klembord niet (oudere browser, geen beveiligde verbinding), dan
 * selecteren we de tekst zodat je hem zelf kunt kopiëren.
 */

const TERUG_MS = 2400;

export function startKopieerknoppen(): void {
  for (const knop of document.querySelectorAll<HTMLButtonElement>('button[data-kopieer]')) {
    if (knop.dataset.kopieerActief === 'ja') continue;
    knop.dataset.kopieerActief = 'ja';
    koppel(knop);
  }
}

function koppel(knop: HTMLButtonElement): void {
  const doelId = knop.dataset.kopieer;
  if (doelId === undefined) return;
  const doel = document.getElementById(doelId);
  if (doel === null) return;

  const melding = document.querySelector<HTMLElement>(`[data-kopieermelding="${doelId}"]`);
  const rust = knop.textContent ?? 'Kopieer';
  let timer = 0;

  function koppelTerug(tekst: string): void {
    knop.textContent = tekst;
    if (melding !== null) melding.textContent = tekst;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      knop.textContent = rust;
      if (melding !== null) melding.textContent = '';
    }, TERUG_MS);
  }

  // Zonder JavaScript doet de knop niets, dus staat hij in de HTML op `hidden`.
  knop.hidden = false;

  knop.addEventListener('click', () => {
    void kopieer(doel).then((gelukt) => {
      koppelTerug(gelukt ? 'Gekopieerd' : 'Geselecteerd, kopieer zelf');
    });
  });
}

async function kopieer(doel: HTMLElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(doel.textContent ?? '');
    return true;
  } catch {
    selecteer(doel);
    return false;
  }
}

function selecteer(doel: HTMLElement): void {
  const selectie = window.getSelection();
  if (selectie === null) return;
  const bereik = document.createRange();
  bereik.selectNodeContents(doel);
  selectie.removeAllRanges();
  selectie.addRange(bereik);
}
