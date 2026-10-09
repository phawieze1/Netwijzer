/**
 * Content collections.
 *
 * De JSON-schema's in `content/schemas/` zijn de bron van waarheid; de
 * zod-schema's in `src/content.schemas.ts` zijn hun spiegel voor de
 * TypeScript-typen. Zie de toelichting in dat bestand.
 *
 * De bestandsnaam van elk contentbestand is `<slug>.json`, dus de `id` van een
 * entry is gelijk aan de slug. `npm run validate` handhaaft dat.
 */

import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { bronSchema, datasetSchema, nieuwsSchema, evenementSchema } from './content.schemas.ts';

export const collections = {
  bronnen: defineCollection({
    loader: glob({ pattern: '*.json', base: './content/bronnen' }),
    schema: bronSchema,
  }),
  datasets: defineCollection({
    loader: glob({ pattern: '*.json', base: './content/datasets' }),
    schema: datasetSchema,
  }),
  nieuws: defineCollection({
    loader: glob({ pattern: '*.json', base: './content/nieuws' }),
    schema: nieuwsSchema,
  }),
  agenda: defineCollection({
    loader: glob({ pattern: '*.json', base: './content/agenda' }),
    schema: evenementSchema,
  }),
};
