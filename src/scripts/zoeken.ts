/**
 * Zoeken met Pagefind.
 *
 * Pagefind maakt na `astro build` een statische index in `dist/pagefind/`
 * (zie de integratie in astro.config.mjs). Dit script is de laag erbovenop: het
 * formulier uit src/components/Zoeken.astro werkt zonder JavaScript als GET naar
 * de catalogus, en met JavaScript zet dit script de treffers onder het veld.
 *
 * ── Base-pad ─────────────────────────────────────────────────────────────────
 * De site staat op GitHub Pages onder /Netwijzer/, maar Astro schrijft de build
 * in `dist/` zonder die map ertussen. Pagefind indexeert `dist/` als wortel en
 * zet dus paden als `/datasets/<slug>/` in de index — zonder `/Netwijzer/`.
 * Pagefind heeft daar geen optie voor bij het indexeren; het wordt in de browser
 * gezet met `baseUrl`. Vandaar dat we `baseUrl` en `basePath` hier expliciet
 * meegeven in plaats van ze te laten raden. Zonder dat leidt elk zoekresultaat
 * naar een 404 — en dat zie je niet aan de build.
 */

/** Het pad waaronder de site draait, inclusief afsluitende slash. */
const BASE: string = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

/** Vanaf hoeveel tekens we zoeken. Eén letter geeft alleen ruis. */
const MINIMUM_TEKENS = 2;

/** Hoeveel treffers we onder het veld tonen; de rest via de catalogus. */
const MAX_TREFFERS = 8;

/** Wachttijd na de laatste toetsaanslag. */
const RUSTTIJD_MS = 250;

// ── Typen voor de Pagefind-bundel ───────────────────────────────────────────
// `pagefind.js` wordt door Pagefind bij de build gegenereerd en zit niet in
// node_modules, dus er zijn geen typen om te importeren. Dit is het stuk van de
// API dat wij gebruiken, volgens de documentatie van Pagefind 1.5.

interface PagefindTrefferData {
  readonly url: string;
  readonly excerpt: string;
  readonly meta: Readonly<Record<string, string>>;
}

interface PagefindTreffer {
  readonly id: string;
  readonly data: () => Promise<PagefindTrefferData>;
}

interface PagefindUitslag {
  readonly results: readonly PagefindTreffer[];
}

interface PagefindBundel {
  readonly options: (opties: Readonly<Record<string, unknown>>) => Promise<void>;
  readonly init: () => Promise<void>;
  readonly search: (term: string) => Promise<PagefindUitslag>;
}

function isPagefindBundel(waarde: unknown): waarde is PagefindBundel {
  if (typeof waarde !== 'object' || waarde === null) {
    return false;
  }
  const kandidaat = waarde as Record<string, unknown>;
  return typeof kandidaat['search'] === 'function' && typeof kandidaat['options'] === 'function';
}

// ── De bundel ophalen ───────────────────────────────────────────────────────

type Laadstatus = 'nog-niet' | 'bezig' | 'gelukt' | 'mislukt';

let status: Laadstatus = 'nog-niet';
let bundel: PagefindBundel | null = null;
let bezig: Promise<PagefindBundel | null> | null = null;

/**
 * De kandidaatpaden voor `pagefind.js`.
 *
 * In de gebouwde site staat de index onder het base-pad. In `astro dev` dient
 * de integratie `/pagefind/` zonder base-pad uit, dus dat is het tweede pad.
 * Zoeken in dev werkt pas na één `npm run build`: de index komt uit `dist/`.
 */
function kandidaatpaden(): string[] {
  const paden = [`${BASE}pagefind/pagefind.js`, '/pagefind/pagefind.js'];
  return [...new Set(paden)];
}

async function haalBundel(): Promise<PagefindBundel | null> {
  if (status === 'gelukt' || status === 'mislukt') {
    return bundel;
  }
  if (bezig !== null) {
    return bezig;
  }

  status = 'bezig';
  bezig = (async (): Promise<PagefindBundel | null> => {
    for (const pad of kandidaatpaden()) {
      try {
        const module: unknown = await import(/* @vite-ignore */ pad);
        if (!isPagefindBundel(module)) {
          continue;
        }
        // `options` vóór de eerste zoekopdracht: Pagefind bewaart deze waarden
        // en geeft ze door aan de index die het bij de eerste zoekactie opzet.
        await module.options({
          baseUrl: BASE,
          basePath: pad.replace(/pagefind\.js$/, ''),
        });
        await module.init();
        bundel = module;
        status = 'gelukt';
        return module;
      } catch {
        // Volgend pad proberen; de melding voor de bezoeker komt hieronder.
      }
    }
    status = 'mislukt';
    return null;
  })();

  const uitkomst = await bezig;
  bezig = null;
  return uitkomst;
}

// ── Resultaten omzetten ─────────────────────────────────────────────────────

/**
 * Pagefind zet `<mark>` om de treffer in de uitsnede. We hebben daar geen stijl
 * voor en willen geen innerHTML gebruiken, dus de tags gaan eruit en de tekst
 * wordt met `textContent` geplaatst.
 */
function zonderOpmaak(tekst: string): string {
  return tekst.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** Titel uit de metadata, met het laatste paddeel als terugvaloptie. */
function titelVan(data: PagefindTrefferData): string {
  const uitMeta = data.meta['title'];
  if (typeof uitMeta === 'string' && uitMeta.trim().length > 0) {
    return uitMeta.trim();
  }
  const delen = data.url.split('/').filter((deel) => deel.length > 0);
  return delen[delen.length - 1] ?? data.url;
}

/** De eigen foutpagina hoort niet in de resultaten. */
function isFoutpagina(url: string): boolean {
  return url.endsWith('/404.html') || url.endsWith('/404/');
}

function meldingVoor(aantal: number, term: string): string {
  if (aantal === 0) {
    return `Geen resultaten voor “${term}”.`;
  }
  if (aantal === 1) {
    return `1 resultaat voor “${term}”.`;
  }
  return `${aantal} resultaten voor “${term}”.`;
}

// ── Eén zoekveld aansluiten ─────────────────────────────────────────────────

/** De onderdelen van één zoekveld, na controle dat ze alle vijf bestaan. */
interface Zoekveld {
  readonly formulier: HTMLFormElement;
  readonly veld: HTMLInputElement;
  readonly melding: HTMLElement;
  readonly lijst: HTMLElement;
  readonly meer: HTMLElement;
}

/** Zoekt de onderdelen op; geeft null als de markup niet is wat we verwachten. */
function onderdelen(wortel: HTMLElement): Zoekveld | null {
  const formulier = wortel.querySelector('form');
  const veld = wortel.querySelector('input[name="q"]');
  const melding = wortel.querySelector('[data-zoekstatus]');
  const lijst = wortel.querySelector('[data-zoeklijst]');
  const meer = wortel.querySelector('[data-zoekmeer]');

  if (
    !(formulier instanceof HTMLFormElement) ||
    !(veld instanceof HTMLInputElement) ||
    !(melding instanceof HTMLElement) ||
    !(lijst instanceof HTMLElement) ||
    !(meer instanceof HTMLElement)
  ) {
    return null;
  }
  return { formulier, veld, melding, lijst, meer };
}

function sluitAan(wortel: HTMLElement): void {
  const onderdeel = onderdelen(wortel);
  if (onderdeel === null) {
    return;
  }
  const { formulier, veld, melding, lijst, meer } = onderdeel;

  const meerLink = meer.querySelector('a');
  // Teller tegen trage antwoorden die een nieuwere zoekopdracht overschrijven.
  let laatste = 0;
  let wachter: number | null = null;

  function leeg(): void {
    melding.textContent = '';
    lijst.replaceChildren();
    lijst.hidden = true;
    meer.hidden = true;
  }

  function toon(treffers: readonly PagefindTrefferData[], term: string): void {
    melding.textContent = meldingVoor(treffers.length, term);
    lijst.replaceChildren(
      ...treffers.map((data) => {
        const link = document.createElement('a');
        link.href = data.url;

        const naam = document.createElement('span');
        naam.textContent = titelVan(data);

        const uitsnede = document.createElement('span');
        uitsnede.textContent = zonderOpmaak(data.excerpt);

        link.append(naam, uitsnede);
        return link;
      }),
    );
    lijst.hidden = treffers.length === 0;

    if (meerLink instanceof HTMLAnchorElement) {
      const doel = new URL(meerLink.pathname, window.location.origin);
      doel.searchParams.set('q', term);
      meerLink.href = `${doel.pathname}${doel.search}`;
    }
    meer.hidden = treffers.length === 0;
  }

  async function zoek(term: string): Promise<void> {
    const beurt = ++laatste;

    if (term.length < MINIMUM_TEKENS) {
      leeg();
      return;
    }

    const api = await haalBundel();
    if (api === null) {
      // Geen index beschikbaar. Niets voorwenden: zeggen waar het wel kan.
      if (beurt === laatste) {
        melding.textContent = 'Zoeken werkt nu niet. Gebruik de catalogus.';
        lijst.hidden = true;
        meer.hidden = false;
      }
      return;
    }

    const uitslag = await api.search(term);
    if (beurt !== laatste) {
      return;
    }

    const data = await Promise.all(
      uitslag.results.slice(0, MAX_TREFFERS + 2).map((treffer) => treffer.data()),
    );
    if (beurt !== laatste) {
      return;
    }

    toon(
      data.filter((item) => !isFoutpagina(item.url)).slice(0, MAX_TREFFERS),
      term,
    );
  }

  formulier.addEventListener('submit', (gebeurtenis) => {
    const term = veld.value.trim();
    if (term.length < MINIMUM_TEKENS) {
      // Te kort om mee te zoeken: laat het formulier gewoon zijn werk doen en
      // naar de catalogus gaan.
      return;
    }
    if (status === 'mislukt') {
      // De index kon niet geladen worden; dan is de catalogus het antwoord.
      return;
    }
    gebeurtenis.preventDefault();
    void zoek(term);
  });

  veld.addEventListener('input', () => {
    if (wachter !== null) {
      window.clearTimeout(wachter);
    }
    wachter = window.setTimeout(() => {
      wachter = null;
      void zoek(veld.value.trim());
    }, RUSTTIJD_MS);
  });

  veld.addEventListener('keydown', (gebeurtenis) => {
    if (gebeurtenis.key === 'Escape' && !lijst.hidden) {
      // Escape ruimt de resultaten op zonder het veld te wissen, zodat de
      // bezoeker met het toetsenbord uit de lijst kan stappen.
      gebeurtenis.preventDefault();
      leeg();
    }
  });

  // De site is statisch, dus de server ziet de querystring nooit en kan het
  // veld niet vooraf vullen. Daarom halen we ?q= hier op: zo landt de
  // zoekactie uit de hero op /datasets/ met de term al ingevuld.
  if (veld.value.trim() === '') {
    const uitUrl = new URLSearchParams(window.location.search).get('q');
    if (uitUrl !== null && uitUrl.trim() !== '') {
      veld.value = uitUrl;
    }
  }

  // Staat er een term in het veld, dan meteen zoeken. Het formulier blijft
  // verder gewoon werken.
  const begin = veld.value.trim();
  if (begin.length >= MINIMUM_TEKENS) {
    void zoek(begin);
  }
}

for (const wortel of document.querySelectorAll('[data-zoeken]')) {
  if (wortel instanceof HTMLElement) {
    sluitAan(wortel);
  }
}
