// @ts-check
import { defineConfig } from 'astro/config';
import pagefind from 'astro-pagefind';

/**
 * Netwijzer draait als project-site op GitHub Pages:
 * https://phawieze1.github.io/Netwijzer/
 *
 * `base` moet exact de repositorynaam zijn (Pages-paden zijn hoofdlettergevoelig).
 * Bij een eigen domein later: `site` naar dat domein zetten en `base` weghalen.
 */
export default defineConfig({
  site: 'https://phawieze1.github.io',
  base: '/Netwijzer',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  devToolbar: {
    enabled: false,
  },
  integrations: [
    /**
     * Pagefind bouwt na `astro build` een statische zoekindex uit de HTML in
     * `dist/`. Geen server, geen API-sleutel.
     *
     * Let op het base-pad. Astro schrijft de site in `dist/` zonder de map
     * `Netwijzer/` ertussen, dus Pagefind indexeert `dist/` als wortel en zet
     * in de index paden als `/datasets/<slug>/` — zonder `/Netwijzer/`. Pagefind
     * kent geen base-optie bij het indexeren; het wordt in de browser gezet met
     * `baseUrl` (zie src/scripts/zoeken.ts). Verander dat niet los van elkaar.
     *
     * De index zelf komt in `dist/pagefind/` en staat op Pages dus onder
     * https://phawieze1.github.io/Netwijzer/pagefind/.
     */
    pagefind({
      indexConfig: {
        // De hele site is Nederlands (<html lang="nl">). Vastzetten houdt het
        // bij één index in plaats van één per gedetecteerde taal.
        forceLanguage: 'nl',
        // Vaste onderdelen die op elke pagina staan. Zonder dit matcht elke
        // zoekterm uit het menu of de voorbeeldbalk op alle pagina's.
        excludeSelectors: [
          '.skip', // overslaan-link
          '.demo', // voorbeeldbalk
          '.nav', // hoofdmenu
          'footer',
          '[data-zoeken]', // het zoekformulier en zijn resultaten
        ],
        // De playground is een ontwikkelhulpje van Pagefind en hoort niet live.
        writePlayground: false,
      },
    }),
  ],
});
