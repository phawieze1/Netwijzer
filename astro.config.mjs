// @ts-check
import { defineConfig } from 'astro/config';

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
});
