/**
 * Controleert wat een agent in een pull request aanlevert, bovenop de
 * schema-validatie van validate-content.ts.
 *
 * Agent-PR's worden automatisch gemerged (docs/03-content-en-agents.md §6). Deze
 * controles zijn daarmee het enige wat tussen een agent en de live site staat.
 *
 * Het script kijkt alleen naar wat de PR verandert, en vergelijkt met de
 * basisversie. Dat is bewust: de placeholdercontent uit fase 1 heeft nog
 * `voorbeeld: true` en example.org-links, en die mag een agent ongemoeid laten
 * staan of bijwerken zonder dat deze controles afgaan.
 *
 * Draait met Node zelf (type stripping), dus geen build-stap nodig:
 *   node scripts/check-agent-content.ts --basis origin/main
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

type Status = 'toegevoegd' | 'gewijzigd' | 'verwijderd';

type Wijziging = {
  status: Status;
  pad: string;
};

type Regels = {
  /** Velden die een bereikbare URL moeten bevatten. */
  urlVelden: string[];
  /** Datumvelden die niet in de toekomst mogen liggen. */
  nietInToekomst: string[];
  /** Datumvelden die niet in het verleden mogen liggen. */
  nietInVerleden: string[];
  /** Velden die aanwezig moeten zijn in een nieuw bestand. */
  verplichtBijNieuw: string[];
};

const PER_MAP: Record<string, Regels> = {
  'content/nieuws/': {
    urlVelden: ['bronUrl'],
    nietInToekomst: ['gepubliceerd'],
    nietInVerleden: [],
    // Het schema maakt dit optioneel, maar alle bestaande berichten hebben het.
    verplichtBijNieuw: ['toegevoegd'],
  },
  'content/agenda/': {
    urlVelden: ['url'],
    nietInToekomst: [],
    // Een evenement hoort in de toekomst te liggen; de agenda kijkt vooruit.
    nietInVerleden: ['start'],
    verplichtBijNieuw: [],
  },
  'content/datasets/': {
    urlVelden: ['bronUrl', 'documentatieUrl'],
    nietInToekomst: ['laatstBijgewerkt', 'laatstGecontroleerd', 'sinds'],
    nietInVerleden: [],
    verplichtBijNieuw: [],
  },
  'content/bronnen/': {
    urlVelden: [],
    nietInToekomst: [],
    nietInVerleden: [],
    verplichtBijNieuw: [],
  },
};

const DATUM_BEGIN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}/;
const WACHTTIJD_MS = 15_000;

const problemen: string[] = [];

function meld(pad: string, tekst: string): void {
  problemen.push(`${pad}: ${tekst}`);
}

function git(...argumenten: string[]): string {
  return execFileSync('git', argumenten, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** De basisref uit `--basis <ref>`, standaard origin/main. */
function basisRef(): string {
  const i = process.argv.indexOf('--basis');
  const waarde = i === -1 ? undefined : process.argv[i + 1];
  return waarde === undefined || waarde === '' ? 'origin/main' : waarde;
}

/** Vandaag als kalenderdatum in Nederlandse tijd, als YYYY-MM-DD. */
function vandaagNL(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function regelsVoor(pad: string): Regels | null {
  for (const map of Object.keys(PER_MAP)) {
    if (pad.startsWith(map)) return PER_MAP[map] ?? null;
  }
  return null;
}

/** De gewijzigde contentbestanden tussen de basis en HEAD. */
function wijzigingen(basis: string): Wijziging[] {
  const uit = git('diff', '--name-status', `${basis}...HEAD`, '--', 'content');
  const lijst: Wijziging[] = [];
  for (const regel of uit.split('\n')) {
    if (regel.trim() === '') continue;
    const delen = regel.split('\t');
    const letter = delen[0] ?? '';
    // Bij een rename staat het nieuwe pad in het laatste veld.
    const pad = delen[delen.length - 1] ?? '';
    if (!pad.endsWith('.json')) continue;
    if (regelsVoor(pad) === null) continue;
    if (letter.startsWith('A')) lijst.push({ status: 'toegevoegd', pad });
    else if (letter.startsWith('D')) lijst.push({ status: 'verwijderd', pad });
    else lijst.push({ status: 'gewijzigd', pad });
  }
  return lijst;
}

function leesJson(inhoud: string, pad: string): Record<string, unknown> | null {
  try {
    const waarde: unknown = JSON.parse(inhoud);
    if (typeof waarde !== 'object' || waarde === null || Array.isArray(waarde)) {
      meld(pad, 'de inhoud is geen JSON-object.');
      return null;
    }
    return waarde as Record<string, unknown>;
  } catch (reden) {
    meld(pad, `geen geldige JSON (${reden instanceof Error ? reden.message : String(reden)}).`);
    return null;
  }
}

/** De versie van dit bestand in de basis, of null als het daar nog niet bestond. */
function basisVersie(basis: string, pad: string): Record<string, unknown> | null {
  let inhoud: string;
  try {
    inhoud = git('show', `${basis}:${pad}`);
  } catch {
    return null;
  }
  return leesJson(inhoud, `${pad} (basisversie)`);
}

function tekst(object: Record<string, unknown>, veld: string): string | null {
  const waarde = object[veld];
  return typeof waarde === 'string' && waarde.trim() !== '' ? waarde : null;
}

/**
 * De uitkomst van één linkcontrole.
 *
 * Het onderscheid is belangrijk: een linkcheck kan bewijzen dat een pagina weg is,
 * maar niet dat hij er is. Veel sites (tennet.eu bijvoorbeeld) antwoorden een
 * bezoeker zonder browser met 403, en Cloudflare doet hetzelfde. Dat 403 als
 * "kapotte link" rekenen zou elke PR blokkeren op een link die prima werkt.
 * Daarom faalt alleen wat zeker dood is; de rest is een waarschuwing.
 */
type LinkUitkomst =
  | { soort: 'leeft' }
  | { soort: 'dood'; reden: string }
  | { soort: 'onbekend'; reden: string };

async function haal(url: string, methode: string): Promise<Response> {
  const stopper = new AbortController();
  const klok = setTimeout(() => stopper.abort(), WACHTTIJD_MS);
  try {
    return await fetch(url, {
      method: methode,
      redirect: 'follow',
      signal: stopper.signal,
      headers: { 'user-agent': 'Netwijzer-linkcheck (+https://phawieze1.github.io/Netwijzer/)' },
    });
  } finally {
    // Zonder dit blijft de timer open en klaagt Node bij het afsluiten.
    clearTimeout(klok);
  }
}

/** Eén URL opvragen. Eerst HEAD want dat is goedkoop, dan GET. */
async function urlLeeft(url: string): Promise<LinkUitkomst> {
  let laatsteFout = 'onbereikbaar';

  for (const methode of ['HEAD', 'GET', 'GET']) {
    try {
      const antwoord = await haal(url, methode);
      if (antwoord.ok) return { soort: 'leeft' };
      // Alleen deze twee zeggen met zekerheid dat de pagina niet bestaat.
      if (antwoord.status === 404 || antwoord.status === 410) {
        return { soort: 'dood', reden: `HTTP ${antwoord.status}` };
      }
      // 405 en 501 betekenen "HEAD mag niet"; al het andere is een server die
      // ons buitenhoudt, niet een pagina die weg is.
      if (methode === 'HEAD') continue;
      return { soort: 'onbekend', reden: `HTTP ${antwoord.status}` };
    } catch (reden) {
      laatsteFout = reden instanceof Error ? reden.message : String(reden);
      // Twee keer GET: een enkele hapering in de runner mag geen PR tegenhouden.
    }
  }

  // Niets gekregen, ook niet na een tweede poging: dan bestaat de host niet of
  // ligt hij eruit. Een verzonnen domein komt hier terecht.
  return { soort: 'dood', reden: laatsteFout };
}

async function hoofd(): Promise<void> {
  const basis = basisRef();
  const lijst = wijzigingen(basis);

  if (lijst.length === 0) {
    console.log(`check-agent-content: geen gewijzigde content tussen ${basis} en HEAD.`);
    return;
  }

  console.log(`check-agent-content: ${lijst.length} gewijzigd bestand(en) ten opzichte van ${basis}.`);

  const vandaag = vandaagNL();
  // Per URL één keer opvragen, ook als meer bestanden ernaar wijzen.
  const teControleren = new Map<string, string[]>();

  for (const { status, pad } of lijst) {
    if (status === 'verwijderd') {
      meld(pad, 'verwijderd. Een agent mag content toevoegen en bijwerken, niet weggooien.');
      continue;
    }

    const regels = regelsVoor(pad);
    if (regels === null) continue;

    const nu = leesJson(readFileSync(pad, 'utf8'), pad);
    if (nu === null) continue;
    const oud = status === 'gewijzigd' ? basisVersie(basis, pad) : null;

    // 1. Het voorbeeldlabel. Nieuwe content mag het niet hebben; bestaande content
    //    mag het houden zoals het was, maar de waarde mag niet veranderen.
    if (status === 'toegevoegd') {
      if ('voorbeeld' in nu) {
        meld(
          pad,
          'heeft het veld "voorbeeld". Dat markeert content als voorbeeld op de site ' +
            'en hoort alleen bij de placeholders uit fase 1. Laat het veld weg.',
        );
      }
    } else if (oud !== null && nu['voorbeeld'] !== oud['voorbeeld']) {
      meld(
        pad,
        `het veld "voorbeeld" ging van ${JSON.stringify(oud['voorbeeld'])} naar ` +
          `${JSON.stringify(nu['voorbeeld'])}. Laat dat label ongemoeid.`,
      );
    }

    // 2. Verplichte velden die het schema optioneel laat.
    if (status === 'toegevoegd') {
      for (const veld of regels.verplichtBijNieuw) {
        if (tekst(nu, veld) === null) {
          meld(pad, `het veld "${veld}" ontbreekt. Alle bestaande bestanden hebben het.`);
        }
      }
    }

    // 3. Datums. Een jaartal dat verkeerd is gelezen valt hier door de mand.
    for (const veld of regels.nietInToekomst) {
      const waarde = tekst(nu, veld);
      if (waarde === null) continue;
      const dag = waarde.slice(0, 10);
      if (!DATUM_BEGIN.test(waarde)) {
        meld(pad, `"${veld}" is "${waarde}" en begint niet met een datum YYYY-MM-DD.`);
      } else if (dag > vandaag) {
        meld(pad, `"${veld}" is ${dag} en ligt in de toekomst (vandaag is ${vandaag}).`);
      }
    }
    for (const veld of regels.nietInVerleden) {
      const waarde = tekst(nu, veld);
      if (waarde === null) continue;
      const dag = waarde.slice(0, 10);
      if (!DATUM_BEGIN.test(waarde)) {
        meld(pad, `"${veld}" is "${waarde}" en begint niet met een datum YYYY-MM-DD.`);
      } else if (dag < vandaag) {
        meld(pad, `"${veld}" is ${dag} en ligt in het verleden (vandaag is ${vandaag}).`);
      }
    }

    // 4. Links. Alleen nieuwe of gewijzigde URL's: bestaande placeholderlinks naar
    //    example.org mogen blijven staan tot er echte content voor is.
    for (const veld of regels.urlVelden) {
      const url = tekst(nu, veld);
      if (url === null) continue;
      if (oud !== null && tekst(oud, veld) === url) continue;
      const bij = teControleren.get(url) ?? [];
      bij.push(`${pad} (${veld})`);
      teControleren.set(url, bij);
    }
  }

  const waarschuwingen: string[] = [];

  if (teControleren.size > 0) {
    console.log(`  ${teControleren.size} nieuwe of gewijzigde link(s) controleren.`);
    const urls = [...teControleren.keys()];
    const uitkomsten = await Promise.all(urls.map((url) => urlLeeft(url)));
    urls.forEach((url, i) => {
      const uitkomst = uitkomsten[i];
      if (uitkomst === undefined || uitkomst.soort === 'leeft') return;
      for (const waar of teControleren.get(url) ?? []) {
        if (uitkomst.soort === 'dood') {
          meld(waar, `de link ${url} bestaat niet (${uitkomst.reden}).`);
        } else {
          waarschuwingen.push(
            `${waar}: ${url} gaf ${uitkomst.reden}. Dat is geen bewijs dat de pagina ` +
              'weg is — veel sites weigeren een bezoeker zonder browser. Niet geblokkeerd.',
          );
        }
      }
    });
  }

  if (waarschuwingen.length > 0) {
    console.log(`\ncheck-agent-content: ${waarschuwingen.length} waarschuwing(en).\n`);
    for (const w of waarschuwingen) console.log(`  ~ ${w}`);
  }

  if (problemen.length > 0) {
    console.error(`\ncheck-agent-content: ${problemen.length} probleem(en).\n`);
    for (const p of problemen) console.error(`  - ${p}`);
    console.error(
      '\nDeze PR wordt niet gemerged. Zie docs/03-content-en-agents.md paragraaf 6 ' +
        'voor wat deze controles doen en waarom.',
    );
    // Geen process.exit(): de code laten staan en zelf aflopen, zodat openstaande
    // verbindingen netjes sluiten.
    process.exitCode = 1;
    return;
  }

  console.log('check-agent-content: alle controles geslaagd.');
}

await hoofd();
