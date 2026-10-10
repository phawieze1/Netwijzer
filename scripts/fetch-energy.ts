/**
 * Haalt zon, wind en verbruik per kwartier op bij NED en schrijft
 * `data/reeksen/latest.json` voor de hero.
 *
 * Achtergrond, parameters en de zeven punten die nog niet geverifieerd waren
 * staan in `docs/bronnen-api.md`. Kort:
 *
 *   zon      = type 2  (Solar)
 *   wind     = type 1  (wind op land) + type 51 (wind op zee, de reeks die NED
 *                       zelf op ned.nl en energieopwek.nl gebruikt)
 *   verbruik = type 59 (Electricityload)
 *
 * Alles met `classification=2` (gemeten, niet voorspeld) en `granularity=4`
 * (15 minuten). NED biedt voor type 59 ook een voorspelling van 7 dagen; die
 * mag er nooit in komen, want `docs/01-identiteit.md` §7 verbiedt data na "nu".
 * Daarom staat er een tweede slot op die deur: punten die eindigen na het
 * laatste volledige kwartier vallen weg, ongeacht wat de API stuurt.
 *
 * Draaien:
 *   node scripts/fetch-energy.ts            schrijft data/reeksen/latest.json
 *   node scripts/fetch-energy.ts --droog    haalt op, controleert, schrijft niets
 *   node scripts/fetch-energy.ts --archief  schrijft data/reeksen/archief/<gisteren>.json
 *
 * De sleutel komt uit de omgevingsvariabele NED_API_KEY (GitHub secret). Die
 * wordt nooit gelogd en staat nooit in een URL.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { ErrorObject } from 'ajv';

const WORTEL = process.cwd();
const ZONE = 'Europe/Amsterdam';
const KWARTIER_MS = 900_000;
const NED_HOST = 'https://api.ned.nl';
const NED_PAD = '/v1/utilizations';

// ---------------------------------------------------------------- reeksen

type ReeksNaam = 'zon' | 'wind' | 'verbruik';

interface ReeksOpzet {
  /** NED-types die bij elkaar opgeteld deze reeks vormen. */
  types: number[];
  /**
   * `activity` is niet geverifieerd voor type 59 (docs/bronnen-api.md §7.5).
   * Het script probeert deze waarden in volgorde en gebruikt de eerste die
   * records oplevert; welke dat was staat in het logboek.
   */
  activities: number[];
  /** Komt letterlijk in `bronnen` van het bestand, en dus in de bronregel. */
  bron: string;
  /** Plausibele bandbreedte in GW. Buiten deze grenzen faalt het script. */
  max: number;
  /** Ondergrens voor het gemiddelde; `null` = geen eis (zon is 's nachts 0). */
  minGemiddelde: number | null;
}

const REEKSEN: Record<ReeksNaam, ReeksOpzet> = {
  zon: {
    types: [2],
    activities: [1],
    bron: 'NED.nl, zonne-energie',
    max: 60,
    minGemiddelde: null,
  },
  wind: {
    types: [1, 51],
    activities: [1],
    bron: 'NED.nl, wind op land en wind op zee',
    max: 40,
    minGemiddelde: null,
  },
  verbruik: {
    types: [59],
    activities: [1, 2],
    bron: 'NED.nl, elektriciteitsvraag',
    max: 40,
    // Nederland zit normaal tussen de 9 en 20 GW. Zakt het gemiddelde onder de
    // 4 GW of gaat het boven de 40, dan is er iets anders opgehaald dan bedoeld
    // (verkeerde activity, of kW/MW in plaats van GW). Dan niet publiceren.
    minGemiddelde: 4,
  },
};

// ---------------------------------------------------------------- tijd

const DELEN = new Intl.DateTimeFormat('sv-SE', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  // Expliciet h23 en niet `hour12: false`: die laatste mag van de specificatie
  // ook h24 opleveren, en dan wordt middernacht "24:00:00" op de vorige dag.
  // Dat zou de kalenderdag een dag verschuiven. Niet aan de ICU-versie van de
  // runner overlaten.
  hourCycle: 'h23',
});

/** "2026-10-09 14:07:00" in Nederlandse tijd. */
function lokaleDelen(instant: number): string {
  return DELEN.format(new Date(instant)).replace(' ', 'T');
}

/** Het verschil met UTC op dit moment, in minuten (120 in de zomer, 60 in de winter). */
function offsetMinuten(instant: number): number {
  const alsOfUtc = Date.parse(`${lokaleDelen(instant)}Z`);
  return Math.round((alsOfUtc - instant) / 60_000);
}

/** "2026-10-09T14:07:00+02:00" — dezelfde notatie als het voorbeeldbestand. */
function lokaleIso(instant: number): string {
  const offset = offsetMinuten(instant);
  const teken = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const uu = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${lokaleDelen(instant)}${teken}${uu}:${mm}`;
}

/** De kalenderdag in Nederland, als "2026-10-09". */
function kalenderdag(instant: number): string {
  return lokaleDelen(instant).slice(0, 10);
}

/**
 * Het moment waarop een Nederlandse kalenderdag om 00:00 begint.
 *
 * Twee keer rekenen, want de offset hangt af van het antwoord: rond de
 * zomertijdwissel geeft één ronde een uur verschil.
 */
function middernacht(dag: string): number {
  let instant = Date.parse(`${dag}T00:00:00Z`);
  for (let ronde = 0; ronde < 2; ronde += 1) {
    instant = Date.parse(`${dag}T00:00:00Z`) - offsetMinuten(instant) * 60_000;
  }
  return instant;
}

/** Dagen optellen bij een kalenderdag, zonder tijdzonegedoe. */
function dagPlus(dag: string, dagen: number): string {
  const d = new Date(`${dag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- hulpjes

function isObject(waarde: unknown): waarde is Record<string, unknown> {
  return typeof waarde === 'object' && waarde !== null && !Array.isArray(waarde);
}

function getal(waarde: unknown): number | null {
  if (typeof waarde === 'number') return Number.isFinite(waarde) ? waarde : null;
  if (typeof waarde !== 'string') return null;
  const n = Number(waarde);
  return Number.isFinite(n) ? n : null;
}

function afgerond(gw: number): number {
  return Math.round(gw * 1000) / 1000;
}

function stop(melding: string): never {
  console.error(`\nfetch-energy: ${melding}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------- NED

interface Meting {
  /** Begin van het kwartier, als absolute tijd. */
  van: number;
  /** Einde van het kwartier. */
  tot: number;
  /** Vermogen in GW. */
  gw: number;
}

function leden(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isObject(data)) return [];
  const m = data['hydra:member'] ?? data['member'];
  return Array.isArray(m) ? m : [];
}

function volgendePagina(data: unknown): string | null {
  if (!isObject(data)) return null;
  const view = data['hydra:view'] ?? data['view'];
  if (!isObject(view)) return null;
  const next = view['hydra:next'] ?? view['next'];
  return typeof next === 'string' && next.length > 0 ? next : null;
}

/** Eenmalige controle of `volume` werkelijk `capacity × 0,25 h` is (§7.2). */
let eenhedenGemeld = false;
function meldEenheden(record: Record<string, unknown>): void {
  if (eenhedenGemeld) return;
  const capacity = getal(record['capacity']);
  const volume = getal(record['volume']);
  if (capacity === null || volume === null || capacity === 0) return;
  eenhedenGemeld = true;
  const verhouding = volume / (capacity * 0.25);
  console.log(
    `  eenheidscontrole: capacity=${capacity} kW, volume=${volume} kWh, ` +
      `volume / (capacity × 0,25) = ${verhouding.toFixed(4)} (verwacht 1,0000)`,
  );
  if (Math.abs(verhouding - 1) > 0.02) {
    console.warn(
      '  let op: capacity is blijkbaar geen gemiddeld vermogen over het kwartier. ' +
        'Zie docs/bronnen-api.md §7.2 — dit moet uitgezocht worden voordat we hierop vertrouwen.',
    );
  }
}

async function haalType(
  sleutel: string,
  type: number,
  activity: number,
  vanDag: string,
  totDag: string,
): Promise<Meting[]> {
  const params = new URLSearchParams({
    point: '0',
    type: String(type),
    granularity: '4',
    granularitytimezone: '1',
    classification: '2',
    activity: String(activity),
    'validfrom[after]': vanDag,
    'validfrom[strictly_before]': totDag,
    'order[validfrom]': 'asc',
    itemsPerPage: '200',
  });

  let url: string | null = `${NED_HOST}${NED_PAD}?${params.toString()}`;
  const metingen: Meting[] = [];
  let paginas = 0;

  while (url !== null) {
    paginas += 1;
    if (paginas > 20) stop(`type ${type}: meer dan 20 pagina's, dat kan niet kloppen.`);

    const antwoord = await fetch(url, {
      headers: { 'X-AUTH-TOKEN': sleutel, Accept: 'application/ld+json' },
    });

    if (antwoord.status === 401) {
      stop(
        'NED gaf 401 Unauthorized.\n' +
          '  Mogelijke oorzaken:\n' +
          '   - het secret NED_API_KEY ontbreekt of is verlopen;\n' +
          '   - de header moet "Bearer <sleutel>" zijn in plaats van de sleutel zelf.\n' +
          '  Dat tweede is nooit geverifieerd: zie docs/bronnen-api.md §7.1.',
      );
    }
    if (!antwoord.ok) {
      stop(`NED gaf HTTP ${antwoord.status} ${antwoord.statusText} voor type ${type}.`);
    }

    const data: unknown = await antwoord.json();
    const rijen = leden(data);

    for (const rij of rijen) {
      if (!isObject(rij)) continue;
      meldEenheden(rij);
      const van = Date.parse(String(rij['validfrom']));
      const tot = Date.parse(String(rij['validto']));
      const capacity = getal(rij['capacity']);
      if (!Number.isFinite(van) || !Number.isFinite(tot) || capacity === null) continue;
      if (tot - van !== KWARTIER_MS) continue; // geen kwartier: niet onze granulariteit
      metingen.push({ van, tot, gw: capacity / 1_000_000 });
    }

    const next = volgendePagina(data);
    url = next === null ? null : new URL(next, NED_HOST).toString();
  }

  return metingen;
}

/**
 * Eén reeks ophalen: alle types erbij, opgeteld per kwartier.
 *
 * Bestaat een reeks uit twee types (wind), dan geldt een kwartier alleen als
 * gemeten wanneer **beide** types er een waarde voor hebben. Anders zou een
 * ontbrekende offshore-meting stilletjes een te laag windtotaal opleveren, en
 * dat is erger dan een gat: een gat wordt mist, een te laag getal wordt geloofd.
 */
async function haalReeks(
  sleutel: string,
  naam: ReeksNaam,
  vanDag: string,
  totDag: string,
): Promise<Map<number, number>> {
  const opzet = REEKSEN[naam];
  const perType: Array<Map<number, number>> = [];

  for (const type of opzet.types) {
    let metingen: Meting[] = [];
    let gebruikt = opzet.activities[0] ?? 1;

    for (const activity of opzet.activities) {
      metingen = await haalType(sleutel, type, activity, vanDag, totDag);
      gebruikt = activity;
      if (metingen.length > 0) break;
    }

    if (metingen.length === 0) {
      stop(
        `type ${type} (${naam}) gaf geen enkele meting voor ${vanDag} tot ${totDag}.\n` +
          `  Geprobeerde activity-waarden: ${opzet.activities.join(', ')}.\n` +
          '  Zie docs/bronnen-api.md §7.5 en §7.6.',
      );
    }

    const kaart = new Map<number, number>();
    for (const meting of metingen) kaart.set(meting.van, meting.gw);
    perType.push(kaart);
    console.log(
      `  type ${String(type).padStart(2)} (${naam}): ${metingen.length} kwartieren, activity=${gebruikt}`,
    );
  }

  const eerste = perType[0];
  if (eerste === undefined) stop(`reeks ${naam} heeft geen types.`);

  const totaal = new Map<number, number>();
  let onvolledig = 0;
  for (const [ms, waarde] of eerste) {
    let som = waarde;
    let compleet = true;
    for (const kaart of perType.slice(1)) {
      const extra = kaart.get(ms);
      if (extra === undefined) {
        compleet = false;
        break;
      }
      som += extra;
    }
    if (compleet) totaal.set(ms, som);
    else onvolledig += 1;
  }

  if (onvolledig > 0) {
    console.log(
      `  ${naam}: ${onvolledig} kwartier(en) overgeslagen omdat niet alle ${opzet.types.length} types een waarde hadden`,
    );
  }

  return totaal;
}

// ---------------------------------------------------------------- bestand bouwen

interface Punt {
  t: string;
  zon: number | null;
  wind: number | null;
  verbruik: number | null;
}

interface Energiereeks {
  gegenereerd: string;
  tijdzone: 'Europe/Amsterdam';
  van: string;
  tot: string;
  interval: 'PT15M';
  eenheid: 'GW';
  bronnen: { zon: string; wind: string; verbruik: string };
  punten: Punt[];
  voorbeeld: boolean;
}

function controleerBandbreedte(naam: ReeksNaam, waarden: number[]): void {
  if (waarden.length === 0) return;
  const opzet = REEKSEN[naam];
  const hoogste = Math.max(...waarden);
  const gemiddelde = waarden.reduce((som, w) => som + w, 0) / waarden.length;

  console.log(
    `  ${naam.padEnd(8)}: ${waarden.length} metingen, gemiddeld ${gemiddelde.toFixed(2)} GW, piek ${hoogste.toFixed(2)} GW`,
  );

  if (hoogste > opzet.max) {
    stop(
      `${naam} piekt op ${hoogste.toFixed(2)} GW, boven de plausibele grens van ${opzet.max} GW.\n` +
        '  Waarschijnlijk is de eenheid niet kW (kW/1e6 = GW) of is er een verkeerd type opgehaald.\n' +
        '  Niet gepubliceerd — liever geen data dan onjuiste data.',
    );
  }
  if (opzet.minGemiddelde !== null && gemiddelde < opzet.minGemiddelde) {
    stop(
      `${naam} heeft een gemiddelde van ${gemiddelde.toFixed(2)} GW, onder de plausibele ondergrens van ${opzet.minGemiddelde} GW.\n` +
        '  Waarschijnlijk is een verkeerde activity of een verkeerd type opgehaald (docs/bronnen-api.md §7.5).\n' +
        '  Niet gepubliceerd — liever geen data dan onjuiste data.',
    );
  }
}

function bouwReeks(
  vanMs: number,
  totMs: number,
  reeksen: Record<ReeksNaam, Map<number, number>>,
): Energiereeks {
  const punten: Punt[] = [];
  const gemeten: Record<ReeksNaam, number[]> = { zon: [], wind: [], verbruik: [] };

  for (let ms = vanMs; ms < totMs; ms += KWARTIER_MS) {
    const punt: Punt = { t: lokaleIso(ms), zon: null, wind: null, verbruik: null };
    for (const naam of ['zon', 'wind', 'verbruik'] as const) {
      const waarde = reeksen[naam].get(ms);
      if (waarde === undefined) continue;
      punt[naam] = afgerond(waarde);
      gemeten[naam].push(waarde);
    }
    punten.push(punt);
  }

  for (const naam of ['zon', 'wind', 'verbruik'] as const) {
    controleerBandbreedte(naam, gemeten[naam]);
  }

  return {
    gegenereerd: lokaleIso(Date.now()),
    tijdzone: ZONE,
    van: lokaleIso(vanMs),
    tot: lokaleIso(totMs),
    interval: 'PT15M',
    eenheid: 'GW',
    bronnen: {
      zon: REEKSEN.zon.bron,
      wind: REEKSEN.wind.bron,
      verbruik: REEKSEN.verbruik.bron,
    },
    punten,
    voorbeeld: false,
  };
}

// ---------------------------------------------------------------- valideren

function valideer(reeks: Energiereeks): void {
  const pad = join(WORTEL, 'content', 'schemas', 'energiereeks.schema.json');
  if (!existsSync(pad)) stop(`schema ontbreekt: ${pad}`);

  const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
  addFormats(ajv);
  const validate = ajv.compile(JSON.parse(readFileSync(pad, 'utf8')) as object);

  if (!validate(reeks)) {
    const regels = (validate.errors ?? []).map((f: ErrorObject) => {
      const plek = f.instancePath === '' ? '(wortel)' : f.instancePath;
      return `   ${plek}: ${f.message ?? 'ongeldig'}`;
    });
    stop(`de opgehaalde reeks past niet op energiereeks.schema.json:\n${regels.join('\n')}`);
  }
}

// ---------------------------------------------------------------- vangnet

/**
 * Bron faalt: het laatste geldige archiefbestand gebruiken (§7.1 van de
 * bouwspecificatie). Nooit data verzinnen, en nooit terugvallen op iets dat
 * ouder is dan wat er al staat.
 */
function vangnet(): boolean {
  const archiefMap = join(WORTEL, 'data', 'reeksen', 'archief');
  if (!existsSync(archiefMap)) {
    console.error('  vangnet: er is nog geen archief om op terug te vallen.');
    return false;
  }

  const bestanden = readdirSync(archiefMap)
    .filter((naam) => /^\d{4}-\d{2}-\d{2}\.json$/.test(naam))
    .sort();
  const nieuwste = bestanden.at(-1);
  if (nieuwste === undefined) {
    console.error('  vangnet: het archief is leeg.');
    return false;
  }

  let reeks: unknown;
  try {
    reeks = JSON.parse(readFileSync(join(archiefMap, nieuwste), 'utf8'));
  } catch {
    console.error(`  vangnet: ${nieuwste} is geen geldige JSON.`);
    return false;
  }
  if (!isObject(reeks) || typeof reeks['tot'] !== 'string') {
    console.error(`  vangnet: ${nieuwste} mist het veld "tot".`);
    return false;
  }

  const doel = join(WORTEL, 'data', 'reeksen', 'latest.json');
  if (existsSync(doel)) {
    try {
      const huidig: unknown = JSON.parse(readFileSync(doel, 'utf8'));
      if (isObject(huidig) && typeof huidig['tot'] === 'string') {
        if (Date.parse(huidig['tot']) >= Date.parse(reeks['tot'])) {
          console.error(
            `  vangnet: het bestaande latest.json loopt tot ${huidig['tot']} en is niet ouder ` +
              `dan het archief (${reeks['tot']}). Laten staan.`,
          );
          return true;
        }
      }
    } catch {
      // Onbruikbaar bestand: dan is het archief altijd beter.
    }
  }

  const bronnen = isObject(reeks['bronnen']) ? reeks['bronnen'] : {};
  reeks['bronnen'] = {
    zon: `${String(bronnen['zon'] ?? 'NED.nl')} — laatste geldige meting, niet bijgewerkt`,
    wind: `${String(bronnen['wind'] ?? 'NED.nl')} — laatste geldige meting, niet bijgewerkt`,
    verbruik: `${String(bronnen['verbruik'] ?? 'NED.nl')} — laatste geldige meting, niet bijgewerkt`,
  };

  writeFileSync(doel, `${JSON.stringify(reeks, null, 2)}\n`, 'utf8');
  console.error(
    `  vangnet: teruggevallen op archief/${nieuwste}. De hero toont gegevens tot ${String(reeks['tot'])}.`,
  );
  return true;
}

// ---------------------------------------------------------------- hoofd

async function hoofd(): Promise<void> {
  const argumenten = process.argv.slice(2);
  const droog = argumenten.includes('--droog');
  const archiefModus = argumenten.includes('--archief');

  const sleutel = process.env['NED_API_KEY'];
  if (sleutel === undefined || sleutel.trim() === '') {
    stop(
      'de omgevingsvariabele NED_API_KEY is niet gezet.\n' +
        '  In GitHub Actions komt die uit het repository secret met dezelfde naam.\n' +
        '  Lokaal: zet hem alleen in je eigen shell, nooit in een bestand in de repo.',
    );
  }

  const nu = Date.now();
  const vandaag = kalenderdag(nu);
  const gisteren = dagPlus(vandaag, -1);

  // Het venster. Normaal gisteren 00:00 tot het laatste volledige kwartier;
  // in archiefmodus precies de hele dag van gisteren.
  const vanMs = middernacht(gisteren);
  const totMs = archiefModus ? middernacht(vandaag) : Math.floor(nu / KWARTIER_MS) * KWARTIER_MS;

  if (totMs <= vanMs) stop('het venster is leeg; dat kan alleen door een klokfout.');

  // Ruim filteren en zelf bijsnijden: de datumfilters van NED nemen volgens de
  // handleiding alleen YYYY-MM-DD, en `validfrom` staat in UTC. Een filter dat
  // precies op gisteren begint zou de eerste kwartieren van gisteren missen,
  // want die liggen in UTC nog op de dag ervoor. Zie docs/bronnen-api.md §7.3.
  const vanDag = dagPlus(gisteren, -1);
  const totDag = dagPlus(vandaag, 1);

  console.log(
    `fetch-energy: venster ${lokaleIso(vanMs)} tot ${lokaleIso(totMs)} ` +
      `(${Math.round((totMs - vanMs) / KWARTIER_MS)} kwartieren)`,
  );
  console.log(`  opgevraagd bij NED van ${vanDag} tot ${totDag}, daarna zelf bijgesneden`);

  let reeksen: Record<ReeksNaam, Map<number, number>>;
  try {
    reeksen = {
      zon: await haalReeks(sleutel, 'zon', vanDag, totDag),
      wind: await haalReeks(sleutel, 'wind', vanDag, totDag),
      verbruik: await haalReeks(sleutel, 'verbruik', vanDag, totDag),
    };
  } catch (reden) {
    const melding = reden instanceof Error ? reden.message : String(reden);
    console.error(`\nfetch-energy: ophalen bij NED mislukt — ${melding}`);
    if (droog || archiefModus) process.exit(1);
    if (vangnet()) {
      console.error('  de site gaat door met de laatste geldige data.\n');
      process.exit(0);
    }
    process.exit(1);
  }

  const reeks = bouwReeks(vanMs, totMs, reeksen);
  valideer(reeks);

  const leeg = reeks.punten.filter(
    (p) => p.zon === null && p.wind === null && p.verbruik === null,
  ).length;
  console.log(
    `  resultaat: ${reeks.punten.length} punten, waarvan ${leeg} zonder enige meting (die worden mist)`,
  );

  if (droog) {
    console.log('\nfetch-energy: --droog, dus niets weggeschreven. De reeks is wel gevalideerd.');
    return;
  }

  if (archiefModus) {
    const map = join(WORTEL, 'data', 'reeksen', 'archief');
    mkdirSync(map, { recursive: true });
    const pad = join(map, `${gisteren}.json`);
    writeFileSync(pad, `${JSON.stringify(reeks, null, 2)}\n`, 'utf8');
    console.log(`\nfetch-energy: ${pad} geschreven (hele dag ${gisteren}).`);
    return;
  }

  const pad = join(WORTEL, 'data', 'reeksen', 'latest.json');
  writeFileSync(pad, `${JSON.stringify(reeks, null, 2)}\n`, 'utf8');
  console.log(`\nfetch-energy: ${pad} geschreven.`);
}

await hoofd();
