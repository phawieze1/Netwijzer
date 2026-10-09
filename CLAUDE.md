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

## Commando's (in te vullen na fase 0)

- `npm run dev` — lokale ontwikkelserver
- `npm run build` — statische build
- `npm run validate` — content valideren tegen de schema's
