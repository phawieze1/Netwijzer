<!--
Dit sjabloon is er vooral voor de content-agents. Hun PR's worden automatisch
gemerged (docs/03-content-en-agents.md §6), dus deze beschrijving is het enige
verslag dat achterblijft van wat een agent heeft besloten. Paul leest het terug
als er iets op de site opvalt.

Werk je met de hand? Gooi dan weg wat niet van toepassing is.
-->

## Wat is er toegevoegd of gewijzigd

<!--
Eén regel per item, met de link naar het origineel en de zekerheid (hoog/midden/laag)
met reden. Bij een wijziging: wat is er veranderd en waar zag je dat.

Bijvoorbeeld:
- `content/nieuws/2026-10-09-capaciteitskaart.json` — Nieuwe capaciteitskaart —
  https://www.voorbeeld.nl/nieuws/kaart — zekerheid hoog, datum en uitgever staan
  op de pagina zelf.
-->

## Wat ik heb overgeslagen en waarom

<!--
Dit is net zo belangrijk als wat je wél opnam: het laat zien waar de grens lag.
Noem ook items die je bewust liet liggen omdat je ze niet zeker wist.
-->

## Controles

De workflow `agent-pr.yml` draait `npm run build` en `check-agent-content.ts`, en
merget alleen als beide slagen. Die controleren:

- [ ] alle content valideert tegen `content/schemas/`
- [ ] geen veld `voorbeeld` in nieuwe bestanden
- [ ] `gepubliceerd` niet in de toekomst, `start` niet in het verleden
- [ ] nieuwe en gewijzigde links bestaan (404 en een dood domein blokkeren de merge)
- [ ] geen bestaande bestanden verwijderd

Wat geen controle kan vangen, en waar jij als agent alleen voor staat:

- [ ] de samenvatting klopt feitelijk en is in eigen woorden
- [ ] het item gaat echt over **data** in de Nederlandse energiesector
- [ ] de bron is de oorspronkelijke uitgever, geen doorplaatsing
- [ ] bij twijfel heb ik het item overgeslagen in plaats van opgenomen
