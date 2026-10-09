/**
 * Zod-spiegels van de JSON-schema's in content/schemas/.
 *
 * LET OP: de JSON-schema's zijn leidend. Deze spiegels bestaan alleen voor de
 * TypeScript-typen van `getCollection()`. `npm run validate` handhaaft de
 * JSON-schema's met Ajv en `scripts/check-schema-drift.ts` faalt als een spiegel
 * afwijkt van het bijbehorende JSON-schema.
 *
 * Bij een wijziging: eerst het JSON-schema, dan deze spiegel.
 *
 * Dit bestand importeert `zod` via `astro/zod` (een gewoon pakketpad) en niet via
 * het virtuele `astro:content`, zodat de drift-check het met Node kan inlezen.
 */

import { z } from 'astro/zod';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const THEMA = z.enum(['opwek', 'verbruik', 'net', 'markt', 'geo']);
export const ZEKERHEID = z.enum(['hoog', 'midden', 'laag']);

export const bronSchema = z
  .object({
    slug: z.string().regex(SLUG),
    naam: z.string(),
    type: z.enum(['netbeheerder', 'overheid', 'onderzoek', 'markt', 'community', 'overig']),
    website: z.url(),
    beschrijving: z.string().max(300).optional(),
    feeds: z.array(z.url()).optional(),
    voorbeeld: z.boolean().optional(),
  })
  .strict();

export const datasetSchema = z
  .object({
    slug: z.string().regex(SLUG),
    naam: z.string().max(90),
    leverancier: z.string().regex(SLUG),
    thema: THEMA,
    beschrijving: z.string().max(400),
    frequentie: z.enum(['minuut', 'kwartier', 'uur', 'dag', 'maand', 'jaar', 'statisch']),
    frequentieLabel: z.string().optional(),
    formaat: z.enum(['API', 'Bestand', 'Kaart']),
    toegang: z.enum(['open', 'account']),
    sinds: z.number().int().min(1990).max(2100),
    eenheid: z.string().optional(),
    laatstBijgewerkt: z.string().optional(),
    laatstGecontroleerd: z.string().optional(),
    bronUrl: z.url(),
    documentatieUrl: z.url().optional(),
    licentie: z
      .object({
        naam: z.string(),
        url: z.url().optional(),
      })
      .strict()
      .optional(),
    velden: z
      .array(
        z
          .object({
            naam: z.string(),
            type: z.string(),
            betekenis: z.string(),
          })
          .strict(),
      )
      .optional(),
    beperkingen: z.array(z.string().max(240)).optional(),
    preview: z
      .object({
        enabled: z.boolean(),
        weergave: z.enum(['weefsel', 'staven', 'punten']).optional(),
      })
      .strict()
      .optional(),
    prompt: z
      .object({
        valkuilen: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    zekerheid: ZEKERHEID,
    voorbeeld: z.boolean().optional(),
  })
  .strict();

export const nieuwsSchema = z
  .object({
    slug: z.string().regex(SLUG),
    titel: z.string().max(140),
    samenvatting: z.string().max(450),
    thema: THEMA,
    bron: z.string(),
    bronUrl: z.url(),
    gepubliceerd: z.string(),
    toegevoegd: z.string().optional(),
    datasets: z.array(z.string().regex(SLUG)).optional(),
    zekerheid: ZEKERHEID,
    voorbeeld: z.boolean().optional(),
  })
  .strict();

export const evenementSchema = z
  .object({
    slug: z.string().regex(SLUG),
    titel: z.string().max(120),
    start: z.string(),
    eind: z.string().optional(),
    plaats: z.string(),
    online: z.boolean().optional(),
    organisator: z.string(),
    url: z.url(),
    thema: THEMA,
    beschrijving: z.string().max(300).optional(),
    zekerheid: ZEKERHEID,
    voorbeeld: z.boolean().optional(),
  })
  .strict();

/** Welke spiegel bij welk JSON-schema hoort. De drift-check gebruikt deze map. */
export const spiegels = {
  'bron.schema.json': bronSchema,
  'dataset.schema.json': datasetSchema,
  'nieuws.schema.json': nieuwsSchema,
  'evenement.schema.json': evenementSchema,
};
