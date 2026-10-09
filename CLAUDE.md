# CLAUDE.md — Netwijzer

Netwijzer is een onafhankelijke, Nederlandstalige website die toegang geeft tot datasets, nieuws, agenda en bronnen over data in de Nederlandse energiesector. De site is statisch en draait op GitHub Pages.

## Lees eerst

1. `docs/02-bouwspecificatie.md` — wat je bouwt en in welke volgorde.
2. `docs/01-identiteit.md` — hoe het eruitziet. Afwijken alleen na akkoord.
3. `docs/03-content-en-agents.md` — contentformaten en agents.
4. `prototype/netwijzer-prototype.html` — visuele referentie. Het prototype is leidend voor uiterlijk en gedrag, niet voor codestructuur.

## Werkwijze

- Werk per fase uit de bouwspecificatie. Presenteer per fase eerst een kort plan en wacht op akkoord.
- Houd stappen klein en laat na elke stap zien wat er veranderd is.
- Vraag bij twijfel over inhoud of domein (energie, data) altijd door. Neem niets aan.
- Controleer de actuele stabiele versie van elke dependency en GitHub Action voordat je die vastlegt.

## Harde regels

- Alle tekst op de site is Nederlands. Code, bestandsnamen en commentaar mogen Engels.
- Gebruik uitsluitend de design tokens uit `design/tokens.css`. Geen losse kleurwaarden of lettertypes.
- Geen AI-look: geen gradients als decoratie, geen glow, geen glas-effect, geen emoji als iconen, geen stockfoto's of gegenereerde beelden. Data is het beeld.
- Elk getal en elke visualisatie heeft een bron en peildatum in beeld.
- Voorbeelddata wordt altijd zichtbaar als voorbeeld gemarkeerd.
- Geheimen (API-sleutels) alleen via GitHub repository secrets. Nooit in code, logs of commits.
- Content van agents komt binnen via een pull request en wordt gevalideerd tegen `content/schemas/`.
- Toegankelijkheid: WCAG 2.2 AA, toetsenbord bedienbaar, `prefers-reduced-motion` gerespecteerd.
- Prestaties: hero-script maximaal 30 KB (gzip), geen client-side framework.

## Commando's

- `npm run dev` — lokale ontwikkelserver op http://localhost:4321/Netwijzer/
- `npm run build` — volledige build: valideren, schema's vergelijken, typecontrole, statische site naar `dist/`
- `npm run preview` — `dist/` lokaal bekijken zoals het op Pages staat
- `npm run validate` — content valideren tegen `content/schemas/` (Ajv) plus de verbanden tussen bestanden
- `npm run check:schemas` — controleren of de zod-spiegels in `src/content.schemas.ts` nog gelijk zijn aan de JSON-schema's
- `npm run check` — alleen de TypeScript-controle (`astro check`)

Node 22.12 of nieuwer is vereist (Astro 7). De scripts in `scripts/` zijn TypeScript
en draaien rechtstreeks met Node, zonder bouwstap.

## Hoe het in elkaar zit

- **Bron van waarheid voor content:** de JSON-schema's in `content/schemas/`. De
  zod-schema's in `src/content.schemas.ts` zijn alleen een spiegel voor de
  TypeScript-typen; `npm run check:schemas` faalt als ze uiteenlopen.
- **Tokens:** `design/tokens.css` wordt rechtstreeks geïmporteerd in
  `src/layouts/Base.astro`. Niet kopiëren naar `src/`.
- **Stijlen:** alle gedeelde CSS staat in `src/styles/global.css`, een getrouwe port
  van het prototype met dezelfde klassennamen. Componenten voegen geen eigen
  kleuren of maten toe.
- **Links:** altijd via `src/lib/paden.ts`. De site staat op GitHub Pages onder
  `/Netwijzer/`, dus een hard-coded pad breekt daar.
- **Getallen en datums:** via `src/lib/format.ts` (komma als decimaalteken,
  `9 okt 2026`, `14:00`, tijdzone Europe/Amsterdam).
- **Thema's:** via `src/lib/themas.ts`, nooit een losse kleurwaarde. Een themakleur
  is een **markering** (stip, streep, staaf, lijn), nooit tekst: vier van de vijf
  halen in de lichte modus geen 4,5:1. Tekst staat in `--ink` of `--ink-2`. Zie
  `docs/01-identiteit.md` §10 voor de gemeten waarden.
