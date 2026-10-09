/**
 * Vergelijkt de zod-spiegels in src/content.schemas.ts met de JSON-schema's in
 * content/schemas/ en faalt als ze uiteenlopen.
 *
 * Waarom dit bestaat: de JSON-schema's zijn de bron van waarheid (dat is wat de
 * agents krijgen en wat Ajv handhaaft), maar Astro heeft zod nodig voor de
 * TypeScript-typen van getCollection(). Twee bestanden die hetzelfde moeten
 * zeggen lopen op termijn uit elkaar. Deze check maakt dat een buildfout in
 * plaats van een stille afwijking.
 *
 * Vergeleken worden: welke velden er zijn, welke verplicht zijn, of extra velden
 * verboden zijn, en de toegestane waarden van elke enum — op elk niveau.
 *
 *   node scripts/check-schema-drift.ts
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { spiegels } from '../src/content.schemas.ts';

const SCHEMA_MAP = join(process.cwd(), 'content', 'schemas');

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
};

/** Minimale vorm van een zod-schema die we via introspectie aanspreken. */
type ZodAchtig = {
  constructor: { name: string };
  shape?: Record<string, ZodAchtig>;
  element?: ZodAchtig;
  options?: unknown[];
  isOptional?: () => boolean;
  unwrap?: () => ZodAchtig;
  _zod?: { def?: { catchall?: { constructor: { name: string } } } };
};

const verschillen: string[] = [];

function meld(schema: string, pad: string, melding: string): void {
  verschillen.push(`${schema} ${pad || '(wortel)'}: ${melding}`);
}

/** Haalt de kern uit optional/nullable/default-wrappers. */
function uitpakken(zod: ZodAchtig): ZodAchtig {
  let huidig = zod;
  const wrappers = new Set(['ZodOptional', 'ZodNullable', 'ZodDefault', 'ZodReadonly']);
  while (wrappers.has(huidig.constructor.name) && typeof huidig.unwrap === 'function') {
    huidig = huidig.unwrap();
  }
  return huidig;
}

function isOptioneel(zod: ZodAchtig): boolean {
  return typeof zod.isOptional === 'function' ? zod.isOptional() : false;
}

function zelfdeSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const gesorteerdA = [...a].sort();
  const gesorteerdB = [...b].sort();
  return gesorteerdA.every((waarde, i) => waarde === gesorteerdB[i]);
}

function vergelijk(naam: string, json: JsonSchema, zodRuw: ZodAchtig, pad: string): void {
  const zod = uitpakken(zodRuw);

  // ---- enum ----
  if (Array.isArray(json.enum)) {
    const verwacht = json.enum.map((waarde) => String(waarde));
    const gevonden = (zod.options ?? []).map((waarde) => String(waarde));
    if (zod.options === undefined) {
      meld(naam, pad, `JSON-schema heeft een enum (${verwacht.join(', ')}), de spiegel niet`);
    } else if (!zelfdeSet(verwacht, gevonden)) {
      meld(
        naam,
        pad,
        `enum wijkt af — JSON-schema: ${verwacht.join(', ')} | spiegel: ${gevonden.join(', ')}`,
      );
    }
    return;
  }

  // ---- const (bv. tijdzone, interval, eenheid in de energiereeks) ----
  if (json.const !== undefined) {
    const gevonden = zod.options ?? [];
    if (gevonden.length !== 1 || String(gevonden[0]) !== String(json.const)) {
      meld(naam, pad, `const "${String(json.const)}" niet terug te vinden in de spiegel`);
    }
    return;
  }

  // ---- object ----
  if (json.properties !== undefined) {
    if (zod.shape === undefined) {
      meld(naam, pad, 'JSON-schema beschrijft een object, de spiegel niet');
      return;
    }

    const jsonVelden = Object.keys(json.properties);
    const zodVelden = Object.keys(zod.shape);

    const alleenInJson = jsonVelden.filter((veld) => !zodVelden.includes(veld));
    const alleenInSpiegel = zodVelden.filter((veld) => !jsonVelden.includes(veld));
    if (alleenInJson.length > 0) {
      meld(naam, pad, `ontbreekt in de spiegel: ${alleenInJson.join(', ')}`);
    }
    if (alleenInSpiegel.length > 0) {
      meld(naam, pad, `staat alleen in de spiegel: ${alleenInSpiegel.join(', ')}`);
    }

    // verplicht versus optioneel
    const jsonVerplicht = json.required ?? [];
    const zodVerplicht = zodVelden.filter((veld) => {
      const tak = zod.shape?.[veld];
      return tak !== undefined && !isOptioneel(tak);
    });
    if (!zelfdeSet(jsonVerplicht, zodVerplicht)) {
      const extraJson = jsonVerplicht.filter((veld) => !zodVerplicht.includes(veld));
      const extraSpiegel = zodVerplicht.filter((veld) => !jsonVerplicht.includes(veld));
      if (extraJson.length > 0) {
        meld(naam, pad, `verplicht in JSON-schema maar optioneel in de spiegel: ${extraJson.join(', ')}`);
      }
      if (extraSpiegel.length > 0) {
        meld(
          naam,
          pad,
          `verplicht in de spiegel maar optioneel in JSON-schema: ${extraSpiegel.join(', ')}`,
        );
      }
    }

    // additionalProperties: false hoort bij .strict()
    const jsonGesloten = json.additionalProperties === false;
    const zodGesloten = zod._zod?.def?.catchall?.constructor?.name === 'ZodNever';
    if (jsonGesloten && !zodGesloten) {
      meld(naam, pad, 'JSON-schema staat geen extra velden toe; zet .strict() op de spiegel');
    }
    if (!jsonGesloten && zodGesloten) {
      meld(naam, pad, 'spiegel is .strict() maar het JSON-schema staat extra velden toe');
    }

    for (const veld of jsonVelden) {
      const takJson = json.properties[veld];
      const takZod = zod.shape[veld];
      if (takJson !== undefined && takZod !== undefined) {
        vergelijk(naam, takJson, takZod, `${pad}/${veld}`);
      }
    }
    return;
  }

  // ---- array ----
  if (json.items !== undefined) {
    if (zod.element === undefined) {
      meld(naam, pad, 'JSON-schema beschrijft een array, de spiegel niet');
      return;
    }
    vergelijk(naam, json.items, zod.element, `${pad}[]`);
  }
}

// ---------- uitvoeren ----------

for (const [bestandsnaam, spiegel] of Object.entries(spiegels)) {
  const pad = join(SCHEMA_MAP, bestandsnaam);
  if (!existsSync(pad)) {
    verschillen.push(`${bestandsnaam}: schema niet gevonden in content/schemas/`);
    continue;
  }
  const json = JSON.parse(readFileSync(pad, 'utf8')) as JsonSchema;
  vergelijk(bestandsnaam, json, spiegel as unknown as ZodAchtig, '');
}

if (verschillen.length > 0) {
  console.error(`\nSchema's lopen uiteen — ${verschillen.length} verschil(len):\n`);
  for (const regel of verschillen) {
    console.error(`  ${regel}`);
  }
  console.error(
    '\nHet JSON-schema in content/schemas/ is leidend. Pas src/content.schemas.ts aan zodat het klopt.\n',
  );
  process.exit(1);
}

console.log(
  `Schema's in overeenstemming: ${Object.keys(spiegels).length} spiegel(s) gelijk aan content/schemas/.`,
);
