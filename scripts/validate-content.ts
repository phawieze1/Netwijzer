/**
 * Valideert alle content tegen content/schemas/*.schema.json.
 *
 * De JSON-schema's zijn de enige bron van waarheid: dat is ook wat de agents in
 * docs/03-content-en-agents.md te zien krijgen. Dit script draait als
 * `npm run validate` en als eerste stap van `npm run build`, zodat foute content
 * de build breekt in plaats van live te gaan.
 *
 * Naast de schema's controleert het de verbanden die een JSON-schema niet kan
 * zien: bestaat de genoemde leverancier als bron, bestaat elke gekoppelde
 * dataset, en klopt de bestandsnaam met de slug (en bij nieuws en agenda met de
 * datum).
 *
 * Draait met Node zelf (type stripping), dus geen build-stap nodig:
 *   node scripts/validate-content.ts
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { ErrorObject, ValidateFunction } from 'ajv';

const WORTEL = process.cwd();
const SCHEMA_MAP = join(WORTEL, 'content', 'schemas');

type Soort = {
  /** Map met de JSON-bestanden, relatief aan de repo-wortel. */
  map: string;
  /** Bestandsnaam van het schema. */
  schema: string;
  /** Verwacht een datumprefix `YYYY-MM-DD-` in de bestandsnaam. */
  datumPrefix: boolean;
  /** Veld waaruit de datum voor die prefix komt. */
  datumVeld?: string;
  /** Eén vast bestand in plaats van een map vol bestanden. */
  enkelBestand?: string;
};

const SOORTEN: Record<string, Soort> = {
  bronnen: { map: 'content/bronnen', schema: 'bron.schema.json', datumPrefix: false },
  datasets: { map: 'content/datasets', schema: 'dataset.schema.json', datumPrefix: false },
  nieuws: {
    map: 'content/nieuws',
    schema: 'nieuws.schema.json',
    datumPrefix: true,
    datumVeld: 'gepubliceerd',
  },
  agenda: {
    map: 'content/agenda',
    schema: 'evenement.schema.json',
    datumPrefix: true,
    datumVeld: 'start',
  },
  reeksen: {
    map: 'data/reeksen',
    schema: 'energiereeks.schema.json',
    datumPrefix: false,
    enkelBestand: 'latest.json',
  },
};

const fouten: string[] = [];
const waarschuwingen: string[] = [];

function fout(bestand: string, melding: string): void {
  fouten.push(`${bestand}\n    ${melding}`);
}

function leesJson(pad: string): unknown {
  const ruw = readFileSync(pad, 'utf8');
  try {
    return JSON.parse(ruw) as unknown;
  } catch (reden) {
    throw new Error(`geen geldige JSON: ${reden instanceof Error ? reden.message : String(reden)}`);
  }
}

function formatteerAjvFout(fout: ErrorObject): string {
  const plek = fout.instancePath === '' ? '(wortel)' : fout.instancePath;
  const extra =
    fout.keyword === 'additionalProperties' && typeof fout.params['additionalProperty'] === 'string'
      ? ` — onbekend veld "${fout.params['additionalProperty']}"`
      : fout.keyword === 'enum' && Array.isArray(fout.params['allowedValues'])
        ? ` — toegestaan: ${(fout.params['allowedValues'] as unknown[]).join(', ')}`
        : '';
  return `${plek}: ${fout.message ?? 'ongeldig'}${extra}`;
}

// ---------- schema's laden ----------

if (!existsSync(SCHEMA_MAP)) {
  console.error(`Kan ${SCHEMA_MAP} niet vinden. Draai dit script vanuit de repo-wortel.`);
  process.exit(1);
}

const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);

const validators = new Map<string, ValidateFunction>();
for (const soort of Object.values(SOORTEN)) {
  if (validators.has(soort.schema)) continue;
  const pad = join(SCHEMA_MAP, soort.schema);
  if (!existsSync(pad)) {
    console.error(`Schema ontbreekt: ${soort.schema}`);
    process.exit(1);
  }
  validators.set(soort.schema, ajv.compile(leesJson(pad) as object));
}

// ---------- bestanden inlezen en valideren ----------

type Item = { bestand: string; naam: string; data: Record<string, unknown> };
const perSoort = new Map<string, Item[]>();

for (const [sleutel, soort] of Object.entries(SOORTEN)) {
  const mapPad = join(WORTEL, soort.map);
  const items: Item[] = [];
  perSoort.set(sleutel, items);

  if (!existsSync(mapPad)) {
    waarschuwingen.push(`${soort.map}/ bestaat nog niet — niets te valideren.`);
    continue;
  }

  const bestanden = soort.enkelBestand
    ? existsSync(join(mapPad, soort.enkelBestand))
      ? [soort.enkelBestand]
      : []
    : readdirSync(mapPad).filter((naam) => naam.endsWith('.json'));

  if (bestanden.length === 0) {
    waarschuwingen.push(`${soort.map}/ is leeg — niets te valideren.`);
    continue;
  }

  const validate = validators.get(soort.schema);
  if (!validate) continue;

  for (const naam of bestanden) {
    const relatief = `${soort.map}/${naam}`;
    let data: unknown;
    try {
      data = leesJson(join(mapPad, naam));
    } catch (reden) {
      fout(relatief, reden instanceof Error ? reden.message : String(reden));
      continue;
    }

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      fout(relatief, 'de inhoud moet een JSON-object zijn');
      continue;
    }

    const record = data as Record<string, unknown>;
    items.push({ bestand: relatief, naam, data: record });

    if (!validate(data)) {
      for (const probleem of validate.errors ?? []) {
        fout(relatief, formatteerAjvFout(probleem));
      }
    }

    // De bestandsnaam is altijd `<slug>.json`, zodat de URL uit de slug volgt en
    // één bestand nooit twee pagina's kan opleveren. Bij nieuws en agenda begint
    // die slug met de datum (zoals in content/voorbeeld/), dus controleren we
    // bovendien of die datum klopt met het datumveld.
    if (!soort.enkelBestand) {
      const slug = typeof record['slug'] === 'string' ? record['slug'] : null;
      const zonderExt = basename(naam, '.json');

      if (slug === null) {
        // Een ontbrekende of niet-tekstuele slug meldt het schema al.
      } else if (zonderExt !== slug) {
        fout(relatief, `bestandsnaam moet "${slug}.json" zijn (slug en bestandsnaam moeten gelijk zijn)`);
      } else if (soort.datumPrefix) {
        const match = /^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*$/.exec(slug);
        if (!match) {
          fout(relatief, `slug moet beginnen met YYYY-MM-DD- (nu: ${slug})`);
        } else {
          const datumDeel = match[1] ?? '';
          const veld = soort.datumVeld;
          const waarde = veld ? record[veld] : undefined;
          if (typeof waarde === 'string' && !waarde.startsWith(datumDeel)) {
            fout(
              relatief,
              `datum in de slug (${datumDeel}) wijkt af van veld ${veld} (${waarde.slice(0, 10)})`,
            );
          }
        }
      }
    }
  }
}

// ---------- verbanden tussen bestanden ----------

const bronSlugs = new Set(
  (perSoort.get('bronnen') ?? [])
    .map((item) => item.data['slug'])
    .filter((slug): slug is string => typeof slug === 'string'),
);
const datasetSlugs = new Set(
  (perSoort.get('datasets') ?? [])
    .map((item) => item.data['slug'])
    .filter((slug): slug is string => typeof slug === 'string'),
);

for (const item of perSoort.get('datasets') ?? []) {
  const leverancier = item.data['leverancier'];
  if (typeof leverancier === 'string' && !bronSlugs.has(leverancier)) {
    fout(
      item.bestand,
      `leverancier "${leverancier}" bestaat niet in content/bronnen/ (verwacht ${leverancier}.json)`,
    );
  }
}

for (const item of perSoort.get('nieuws') ?? []) {
  const gekoppeld = item.data['datasets'];
  if (!Array.isArray(gekoppeld)) continue;
  for (const slug of gekoppeld) {
    if (typeof slug === 'string' && !datasetSlugs.has(slug)) {
      fout(item.bestand, `gekoppelde dataset "${slug}" bestaat niet in content/datasets/`);
    }
  }
}

// Dubbele slugs geven dubbele URL's.
for (const [sleutel, items] of perSoort) {
  const gezien = new Map<string, string>();
  for (const item of items) {
    const slug = item.data['slug'];
    if (typeof slug !== 'string') continue;
    const eerder = gezien.get(slug);
    if (eerder) {
      fout(item.bestand, `slug "${slug}" is al in gebruik door ${eerder} (${sleutel})`);
    } else {
      gezien.set(slug, item.bestand);
    }
  }
}

// ---------- uitkomst ----------

const aantal = [...perSoort.values()].reduce((som, items) => som + items.length, 0);

for (const regel of waarschuwingen) {
  console.warn(`  let op: ${regel}`);
}

if (fouten.length > 0) {
  console.error(`\nContentvalidatie mislukt — ${fouten.length} probleem(en):\n`);
  for (const regel of fouten) {
    console.error(`  ${regel}\n`);
  }
  console.error('Pas de bestanden aan of de schema\'s in content/schemas/.\n');
  process.exit(1);
}

console.log(`Contentvalidatie geslaagd: ${aantal} bestand(en) tegen de schema's gecontroleerd.`);
