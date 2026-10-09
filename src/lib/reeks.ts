/**
 * De energiereeks voor de hero: inlezen, typen en klaarmaken voor het canvas.
 *
 * Bron van waarheid is `content/schemas/energiereeks.schema.json`; `npm run validate`
 * controleert het bestand tegen dat schema. Deze module vertrouwt daar niet blind
 * op: de hero mag nooit breken op een ontbrekend, leeg of half bestand. Alles wat
 * niet klopt levert `null` op, en de component toont dan een melding.
 *
 * Belangrijk: "nu" is het veld `tot` uit het bestand, niet de klok van de bezoeker.
 * Er wordt nooit data verzonnen; een ontbrekende meting blijft `null` en wordt in
 * het landschap mist.
 *
 * Deze module draait alleen bij de build (Node). Het canvas-script importeert er
 * uitsluitend typen uit, met `import type`, zodat er geen build-code in de browser
 * belandt.
 */

import { datumTijd, gw, procent, tijd } from './format';

const KWARTIER_MS = 900_000;
const DAG_MS = 86_400_000;
const ZONE = 'Europe/Amsterdam';

/** Terugval voor de zonuren als de reeks geen enkele zonmeting heeft (uren, zoals het prototype). */
const ZONOP_TERUGVAL = 7.75;
const ZONONDER_TERUGVAL = 18.4;

/** Een meting telt als zon zodra er iets staat; onder deze grens is het nacht. */
const ZON_DREMPEL = 0.05;

/** Wat in beeld komt als een waarde niet gemeten is. */
export const GEEN_WAARDE = '–';

// ---------------------------------------------------------------- bestandsvorm

export interface ReeksPunt {
  t: string;
  zon: number | null;
  wind: number | null;
  verbruik: number | null;
}

export interface ReeksBronnen {
  zon: string;
  wind: string;
  verbruik: string;
}

export interface Energiereeks {
  gegenereerd: string;
  tijdzone: string;
  van: string;
  tot: string;
  interval: string;
  eenheid: string;
  bronnen: ReeksBronnen;
  punten: ReeksPunt[];
  voorbeeld: boolean;
}

// ------------------------------------------------------------- vorm voor de hero

/** Eén annotatie in het landschap: waar hij staat en wat erbij staat. */
export interface HeroAnnotatie {
  /** Kwartierindex op de tijdas. */
  q: number;
  /** Twee regels: de kop en de waarde met tijd. */
  regels: [string, string];
}

/** Een label op de tijdas. */
export interface HeroAslabel {
  q: number;
  tekst: string;
}

/**
 * Alles wat het canvas nodig heeft, als gewone getallen. Dit gaat als JSON mee in
 * de pagina; het script rekent zelf niets met datums uit.
 */
export interface HeroData {
  /** Begin van de tijdas (gisteren 00:00 Nederlandse tijd) als epoch-ms. */
  vanMs: number;
  /** Kwartierindex van vandaag 00:00. Normaal 96, bij een zomertijdwissel 92 of 100. */
  dagQ: number;
  /** Aantal kwartieren op de hele as, tot vandaag 24:00. Normaal 192. */
  totaalQ: number;
  /** Kwartierindex van "nu" (`tot` uit het bestand). Alles daarna is mist. */
  nuQ: number;
  /** Hoogste index waarvoor een meting bestaat. */
  laatsteQ: number;
  /** Metingen per kwartier; `null` is nog niet gemeten. */
  zon: (number | null)[];
  wind: (number | null)[];
  verbruik: (number | null)[];
  /** Uur van zonsopkomst en -ondergang, afgeleid uit de reeks zelf. */
  zonop: number;
  zononder: number;
  /** "nu 14:00" voor de markering in het landschap. */
  nuLabel: string;
  /** Labels op de tijdas, elke zes uur. */
  asLabels: HeroAslabel[];
  zonpiek: HeroAnnotatie | null;
  avondpiek: HeroAnnotatie | null;
}

/** Eén moment als leesbare tekst, voor het waardenvak en de tabel. */
export interface HeroMoment {
  q: number;
  tijd: string;
  dag: 'gisteren' | 'vandaag';
  zon: string;
  wind: string;
  verbruik: string;
  dekking: string;
}

/** De tekstkant van de hero: zonder JavaScript en zonder interactie te lezen. */
export interface HeroTekst {
  /** Het laatst gemeten moment; dit staat server-side al in het waardenvak. */
  nu: HeroMoment;
  /** Eén rij per uur tot nu, voor het tekstalternatief. */
  uren: HeroMoment[];
  ariaLabel: string;
  /** Peildatum als `9 okt 2026, 14:00`. */
  peildatum: string;
  bronnen: ReeksBronnen;
  voorbeeld: boolean;
}

export interface Hero {
  data: HeroData;
  tekst: HeroTekst;
}

// ------------------------------------------------------------------- inlezen

function isObject(waarde: unknown): waarde is Record<string, unknown> {
  return typeof waarde === 'object' && waarde !== null;
}

function tekst(waarde: unknown, terugval = ''): string {
  return typeof waarde === 'string' ? waarde : terugval;
}

function meting(waarde: unknown): number | null {
  return typeof waarde === 'number' && Number.isFinite(waarde) && waarde >= 0 ? waarde : null;
}

/**
 * Leest de reeks uit een JSON-string. Geeft `null` als het bestand leeg is, geen
 * geldige JSON bevat of de verplichte velden mist.
 */
export function parseReeks(ruw: string): Energiereeks | null {
  if (ruw.trim().length === 0) return null;

  let data: unknown;
  try {
    data = JSON.parse(ruw);
  } catch {
    return null;
  }
  if (!isObject(data)) return null;

  const van = tekst(data['van']);
  const tot = tekst(data['tot']);
  if (!Number.isFinite(Date.parse(van)) || !Number.isFinite(Date.parse(tot))) return null;
  if (!Array.isArray(data['punten'])) return null;

  const punten: ReeksPunt[] = [];
  for (const ruwPunt of data['punten']) {
    if (!isObject(ruwPunt)) continue;
    const t = tekst(ruwPunt['t']);
    if (!Number.isFinite(Date.parse(t))) continue;
    punten.push({
      t,
      zon: meting(ruwPunt['zon']),
      wind: meting(ruwPunt['wind']),
      verbruik: meting(ruwPunt['verbruik']),
    });
  }
  if (punten.length === 0) return null;

  const ruweBronnen = isObject(data['bronnen']) ? data['bronnen'] : {};

  return {
    gegenereerd: tekst(data['gegenereerd'], tot),
    tijdzone: tekst(data['tijdzone'], ZONE),
    van,
    tot,
    interval: tekst(data['interval'], 'PT15M'),
    eenheid: tekst(data['eenheid'], 'GW'),
    bronnen: {
      zon: tekst(ruweBronnen['zon'], 'onbekend'),
      wind: tekst(ruweBronnen['wind'], 'onbekend'),
      verbruik: tekst(ruweBronnen['verbruik'], 'onbekend'),
    },
    punten,
    voorbeeld: data['voorbeeld'] === true,
  };
}

/**
 * `data/reeksen/latest.json` via `import.meta.glob`: zo breekt een ontbrekend
 * bestand de build niet (een gewone import zou dat wel doen), en ziet de
 * ontwikkelserver een wijziging meteen.
 */
const BESTANDEN = import.meta.glob<string>('../../data/reeksen/latest.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** De actuele reeks, of `null` als het bestand ontbreekt of niet bruikbaar is. */
export function leesReeks(): Energiereeks | null {
  const ruw = Object.values(BESTANDEN)[0];
  return ruw === undefined ? null : parseReeks(ruw);
}

// --------------------------------------------------------------- tijdzone-rekenwerk

const DEEL_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** Verschil tussen de wandklok in Amsterdam en UTC op dat moment, in ms. */
function zoneVerschil(ms: number): number {
  const delen = DEEL_FORMAT.formatToParts(new Date(ms));
  const nummer = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(delen.find((deel) => deel.type === type)?.value ?? '0');
  const alsUtc = Date.UTC(
    nummer('year'),
    nummer('month') - 1,
    nummer('day'),
    nummer('hour'),
    nummer('minute'),
    nummer('second'),
  );
  return alsUtc - ms;
}

/**
 * Het moment dat in Amsterdam dezelfde wandkloktijd heeft als `vanMs`, maar
 * `dagen` later. Nodig omdat een dag met een zomertijdwissel 23 of 25 uur duurt;
 * zonder deze correctie zou de dagscheiding een uur verschuiven.
 */
function zelfdeTijdLater(vanMs: number, dagen: number): number {
  const kandidaat = vanMs + dagen * DAG_MS;
  return kandidaat + zoneVerschil(vanMs) - zoneVerschil(kandidaat);
}

/** Tijd als `14:00` voor een kwartierindex op de as. */
function tijdBijQ(vanMs: number, q: number): string {
  return tijd(new Date(vanMs + Math.round(q * 15) * 60_000).toISOString());
}

// ------------------------------------------------------------------- opbouwen

function uurVanDag(q: number, dagQ: number): number {
  const binnenDeDag = q >= dagQ ? q - dagQ : q;
  return (binnenDeDag / 4) % 24;
}

function waarde(reeks: (number | null)[], index: number): number | null {
  return reeks[index] ?? null;
}

function toon(v: number | null): string {
  return v === null ? GEEN_WAARDE : gw(v);
}

function dekking(punt: { zon: number | null; wind: number | null; verbruik: number | null }): string {
  const { zon, wind, verbruik } = punt;
  if (zon === null || wind === null || verbruik === null || verbruik <= 0) return GEEN_WAARDE;
  return procent((zon + wind) / verbruik);
}

function moment(data: HeroData, q: number): HeroMoment {
  const index = Math.min(data.laatsteQ, Math.max(0, Math.round(q)));
  const punt = {
    zon: waarde(data.zon, index),
    wind: waarde(data.wind, index),
    verbruik: waarde(data.verbruik, index),
  };
  return {
    q,
    tijd: tijdBijQ(data.vanMs, q),
    dag: q >= data.dagQ ? 'vandaag' : 'gisteren',
    zon: toon(punt.zon),
    wind: toon(punt.wind),
    verbruik: toon(punt.verbruik),
    dekking: dekking(punt),
  };
}

/** Index van de hoogste waarde binnen `[van, tot]`, of `null` als er niets gemeten is. */
function piek(reeks: (number | null)[], van: number, tot: number): number | null {
  let beste: number | null = null;
  for (let i = Math.max(0, van); i <= Math.min(reeks.length - 1, tot); i++) {
    const v = waarde(reeks, i);
    if (v === null) continue;
    const huidige = beste === null ? null : waarde(reeks, beste);
    if (huidige === null || v > huidige) beste = i;
  }
  return beste;
}

/**
 * Zonsopkomst en -ondergang uit de reeks zelf, zodat de lucht de data volgt in
 * plaats van een vaste almanak. Zonder zonmetingen vallen we terug op het
 * prototype.
 */
function zonUren(data: Pick<HeroData, 'zon' | 'dagQ'>): { zonop: number; zononder: number } {
  let eerste: number | null = null;
  let laatste: number | null = null;
  for (let i = 0; i < data.zon.length; i++) {
    const v = waarde(data.zon, i);
    if (v === null || v <= ZON_DREMPEL) continue;
    const uur = uurVanDag(i, data.dagQ);
    if (eerste === null || uur < eerste) eerste = uur;
    if (laatste === null || uur > laatste) laatste = uur;
  }
  if (eerste === null || laatste === null || laatste - eerste < 2) {
    return { zonop: ZONOP_TERUGVAL, zononder: ZONONDER_TERUGVAL };
  }
  return { zonop: eerste, zononder: laatste };
}

/**
 * Maakt van een gevalideerde reeks de vorm die de component en het canvas
 * gebruiken. Geeft `null` als de reeks geen bruikbare tijdas oplevert.
 */
export function maakHero(reeks: Energiereeks | null): Hero | null {
  if (reeks === null) return null;

  const vanMs = Date.parse(reeks.van);
  const totMs = Date.parse(reeks.tot);
  if (!Number.isFinite(vanMs) || !Number.isFinite(totMs) || totMs <= vanMs) return null;

  const dagQ = Math.round((zelfdeTijdLater(vanMs, 1) - vanMs) / KWARTIER_MS);
  const totaalQ = Math.round((zelfdeTijdLater(vanMs, 2) - vanMs) / KWARTIER_MS);
  if (dagQ <= 0 || totaalQ <= dagQ) return null;

  const totQ = Math.min(totaalQ, Math.max(1, (totMs - vanMs) / KWARTIER_MS));

  const lengte = Math.min(totaalQ, Math.ceil(totQ));
  const zon: (number | null)[] = new Array<number | null>(lengte).fill(null);
  const wind: (number | null)[] = new Array<number | null>(lengte).fill(null);
  const verbruik: (number | null)[] = new Array<number | null>(lengte).fill(null);

  let laatsteQ = -1;
  for (const punt of reeks.punten) {
    const index = Math.round((Date.parse(punt.t) - vanMs) / KWARTIER_MS);
    if (index < 0 || index >= lengte) continue;
    zon[index] = punt.zon;
    wind[index] = punt.wind;
    verbruik[index] = punt.verbruik;
    if (punt.zon !== null || punt.wind !== null || punt.verbruik !== null) {
      laatsteQ = Math.max(laatsteQ, index);
    }
  }
  if (laatsteQ < 0) return null;

  // "nu" is `tot`, maar nooit verder dan het laatste kwartier waarvoor echt een
  // meting staat. Loopt `tot` daarop vooruit (bron hapert), dan wordt dat stuk
  // mist in plaats van een doorgetrokken lijn.
  const nuQ = Math.min(totQ, laatsteQ + 1);
  zon.length = laatsteQ + 1;
  wind.length = laatsteQ + 1;
  verbruik.length = laatsteQ + 1;

  const uren = zonUren({ zon, dagQ });

  const data: HeroData = {
    vanMs,
    dagQ,
    totaalQ,
    nuQ,
    laatsteQ,
    zon,
    wind,
    verbruik,
    zonop: uren.zonop,
    zononder: uren.zononder,
    nuLabel: tijdBijQ(vanMs, nuQ),
    asLabels: [],
    zonpiek: null,
    avondpiek: null,
  };

  // Tijdas: elk zesde uur een label, het laatste als 24:00 (einde van vandaag).
  for (let q = 0; q <= totaalQ; q += 24) {
    const laatste = q + 24 > totaalQ;
    data.asLabels.push({
      q: Math.min(q, totaalQ),
      tekst: laatste ? '24:00' : tijdBijQ(vanMs, q),
    });
  }

  const zonpiekIndex = piek(zon, 0, laatsteQ);
  if (zonpiekIndex !== null) {
    const v = waarde(zon, zonpiekIndex);
    if (v !== null) {
      data.zonpiek = {
        q: zonpiekIndex,
        regels: [
          `Zonpiek ${gw(v)}`,
          `${zonpiekIndex >= dagQ ? 'vandaag' : 'gisteren'} ${tijdBijQ(vanMs, zonpiekIndex)}`,
        ],
      };
    }
  }

  // Avondpiek: de hoogste verbruikswaarde van gisteren, de laatste volledige dag.
  const avondpiekIndex = piek(verbruik, 0, Math.min(dagQ - 1, laatsteQ)) ?? piek(verbruik, 0, laatsteQ);
  if (avondpiekIndex !== null) {
    const v = waarde(verbruik, avondpiekIndex);
    if (v !== null) {
      data.avondpiek = {
        q: avondpiekIndex,
        regels: [
          'Avondpiek verbruik',
          `${gw(v)} ${avondpiekIndex >= dagQ ? 'vandaag' : 'gisteren'} ${tijdBijQ(vanMs, avondpiekIndex)}`,
        ],
      };
    }
  }

  // Het waardenvak staat op "nu", net als de rode markering in het landschap.
  const nu = moment(data, nuQ);
  const urenRijen: HeroMoment[] = [];
  for (let q = 0; q < nuQ; q += 4) urenRijen.push(moment(data, q));
  urenRijen.push(nu);

  const tekstDeel: HeroTekst = {
    nu,
    uren: urenRijen,
    ariaLabel: maakAriaLabel(data, nu, reeks.voorbeeld),
    peildatum: datumTijd(reeks.tot),
    bronnen: reeks.bronnen,
    voorbeeld: reeks.voorbeeld,
  };

  return { data, tekst: tekstDeel };
}

/** Het tekstalternatief op het canvas zelf (identiteit §10). */
function maakAriaLabel(data: HeroData, nu: HeroMoment, voorbeeld: boolean): string {
  const delen = [
    `Polderlandschap getekend uit de energiedata van gisteren 00:00 tot ${data.nuLabel}:`,
    'de hoogte van de zonnebaan is de zonopwek, de molens draaien op de windopwek,',
    'de landlijn en de verlichte ramen volgen het verbruik.',
    'Het deel na nu is mist: nog niet gemeten.',
    `Om ${nu.tijd} ${nu.dag} was de zonopwek ${nu.zon}, de windopwek ${nu.wind} en het verbruik ${nu.verbruik};`,
    `zon en wind dekten ${nu.dekking} van het verbruik.`,
  ];
  if (data.zonpiek !== null) delen.push(`${data.zonpiek.regels[0]} ${data.zonpiek.regels[1]}.`);
  if (voorbeeld) delen.push('Voorbeelddata.');
  return delen.join(' ');
}

/** De hero rechtstreeks uit `data/reeksen/latest.json`. */
export function heroUitBestand(): Hero | null {
  return maakHero(leesReeks());
}

/** Korte bronregel voor onder het landschap, met peildatum (harde regel). */
export function bronRegel(tekst: HeroTekst): string {
  const { zon, wind, verbruik } = tekst.bronnen;
  const bronnen = zon === wind ? `zon en wind ${zon}` : `zon ${zon}, wind ${wind}`;
  return `Bron: ${bronnen}, verbruik ${verbruik} · peildatum ${tekst.peildatum}`;
}

/** Hulp voor de tabel: `4,8` zonder eenheid, als de eenheid in de kop staat. */
export function zonderEenheid(waarde: string): string {
  return waarde === GEEN_WAARDE ? waarde : waarde.replace(' GW', '');
}
