/**
 * Nederlandse notatie, volgens docs/01-identiteit.md §4:
 * decimaalteken is een komma (14,2 GW), datum is `9 okt 2026`, tijd is `14:00`.
 *
 * Let op datums: velden met `format: "date"` in de schema's zijn kalenderdatums
 * zonder tijd. Die parsen we met `new Date('2026-10-09')` NIET, want dat is
 * UTC-middernacht en kan in een andere tijdzone een dag opschuiven. Daarom
 * splitsen we de string zelf. Datum-tijdvelden worden wel als moment behandeld
 * en expliciet in Europe/Amsterdam geformatteerd.
 */

export const MAANDEN = [
  'jan',
  'feb',
  'mrt',
  'apr',
  'mei',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
] as const;

const ZONE = 'Europe/Amsterdam';

/** Getal met komma als decimaalteken. */
export function getal(waarde: number, decimalen = 1): string {
  return waarde.toFixed(decimalen).replace('.', ',');
}

/** Hele getallen met punt als duizendscheiding, zoals 1.234. */
export function geheel(waarde: number): string {
  return new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 }).format(waarde);
}

/** Vermogen in GW, bijvoorbeeld `14,2 GW`. */
export function gw(waarde: number, decimalen = 1): string {
  return `${getal(waarde, decimalen)} GW`;
}

/** Percentage als heel getal, bijvoorbeeld `38%`. */
export function procent(deel: number): string {
  return `${Math.round(deel * 100)}%`;
}

type DatumDelen = { jaar: number; maand: number; dag: number };

/** Splitst een `YYYY-MM-DD`-string zonder tijdzone-interpretatie. */
function deelKalenderdatum(datum: string): DatumDelen | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
  if (!match) return null;
  const [, jaar, maand, dag] = match;
  if (jaar === undefined || maand === undefined || dag === undefined) return null;
  return { jaar: Number(jaar), maand: Number(maand), dag: Number(dag) };
}

/**
 * Kalenderdatum als `9 okt 2026`. Accepteert `YYYY-MM-DD` of een datum-tijdstring;
 * bij een datum-tijdstring wordt de dag in Europe/Amsterdam genomen.
 */
export function datum(waarde: string): string {
  const delen = deelKalenderdatum(waarde);
  if (delen) {
    const maandNaam = MAANDEN[delen.maand - 1];
    if (maandNaam === undefined) return waarde;
    return `${delen.dag} ${maandNaam} ${delen.jaar}`;
  }
  const moment = new Date(waarde);
  if (Number.isNaN(moment.getTime())) return waarde;
  const delenNl = nlDelen(moment);
  return `${delenNl.dag} ${delenNl.maand} ${delenNl.jaar}`;
}

/** Tijd als `14:00`, in Europe/Amsterdam. */
export function tijd(waarde: string): string {
  const moment = new Date(waarde);
  if (Number.isNaN(moment.getTime())) return '';
  return new Intl.DateTimeFormat('nl-NL', {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(moment);
}

/** Datum en tijd als `9 okt 2026, 14:00`. */
export function datumTijd(waarde: string): string {
  const t = tijd(waarde);
  return t ? `${datum(waarde)}, ${t}` : datum(waarde);
}

/** Dag, maand en jaar van een moment, uitgedrukt in Europe/Amsterdam. */
export function nlDelen(moment: Date): { dag: number; maand: string; jaar: number; maandNr: number } {
  const delen = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(moment);
  const gesplitst = deelKalenderdatum(delen);
  if (!gesplitst) {
    return { dag: moment.getUTCDate(), maand: 'jan', jaar: moment.getUTCFullYear(), maandNr: 1 };
  }
  return {
    dag: gesplitst.dag,
    maand: MAANDEN[gesplitst.maand - 1] ?? 'jan',
    jaar: gesplitst.jaar,
    maandNr: gesplitst.maand,
  };
}

/** Kalenderdatum als `YYYY-MM-DD` in Europe/Amsterdam, geschikt voor sortering. */
export function kalenderdatum(moment: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(moment);
}

/** Zet een `YYYY-MM-DD` om naar een Date op middernacht UTC, puur om te sorteren. */
export function naarSorteerDatum(waarde: string): number {
  const delen = deelKalenderdatum(waarde);
  if (delen) return Date.UTC(delen.jaar, delen.maand - 1, delen.dag);
  const moment = new Date(waarde);
  return Number.isNaN(moment.getTime()) ? 0 : moment.getTime();
}

/** Aantal hele dagen tussen twee momenten (b - a). */
export function dagenTussen(a: Date, b: Date): number {
  const dag = 86_400_000;
  const aMidnacht = Date.parse(`${kalenderdatum(a)}T00:00:00Z`);
  const bMidnacht = Date.parse(`${kalenderdatum(b)}T00:00:00Z`);
  return Math.round((bMidnacht - aMidnacht) / dag);
}

const FREQUENTIE_LABELS = {
  minuut: 'per minuut',
  kwartier: 'per kwartier',
  uur: 'per uur',
  dag: 'per dag',
  maand: 'per maand',
  jaar: 'per jaar',
  statisch: 'eenmalig',
} as const;

export type Frequentie = keyof typeof FREQUENTIE_LABELS;

/**
 * Leesbare meetfrequentie. `frequentieLabel` in de content gaat voor, zodat een
 * bron met een eigen ritme ("per station") dat kan aangeven.
 */
export function frequentieLabel(frequentie: Frequentie, eigenLabel?: string | undefined): string {
  return eigenLabel ?? FREQUENTIE_LABELS[frequentie];
}

/** Of een frequentie een tijdreeks oplevert (bepaalt de keuze van de voorbeeldvisualisatie). */
export function isTijdreeks(frequentie: Frequentie): boolean {
  return frequentie === 'minuut' || frequentie === 'kwartier' || frequentie === 'uur' || frequentie === 'dag';
}

/** Of een frequentie periodes oplevert (maand- of jaarstaven). */
export function isPeriode(frequentie: Frequentie): boolean {
  return frequentie === 'maand' || frequentie === 'jaar';
}

export function toegangLabel(toegang: 'open' | 'account'): string {
  return toegang === 'open' ? 'Open' : 'Account nodig';
}
