# 02 — Bouwspecificatie

Status: v1, 9 okt 2026. Visuele referentie: `prototype/netwijzer-prototype.html` (v0.5).

## 1. Doel en scope

Netwijzer is een statische website die toegang geeft tot datasets, nieuws, agenda en bronnen over data in de Nederlandse energiesector. Bezoekers komen voor de catalogus en het nieuws; de hero laat met een datakunstwerk zien wat er gisteren en vandaag op het net gebeurde.

**In scope fase 1–3**

- Homepage met hero (polderlandschap), zoeken, catalogus, nieuws, agenda, bronnen.
- Detailpagina per dataset, per nieuwsbericht en per bron.
- Overzichtspagina's voor datasets, nieuws, agenda en bronnen.
- Dagelijkse energiedata voor de hero en de datasetvoorbeelden.
- Content-agents die nieuws, agenda en datasetbeschrijvingen aanleveren via pull requests.

**Buiten scope (later)**

- Interactieve kaart (fase 4).
- Accounts, reacties, nieuwsbrief.
- Engelstalige versie.

## 2. Technische keuzes

| Onderwerp | Keuze | Waarom |
|---|---|---|
| Framework | **Astro** (actuele stabiele versie) | Gemaakt voor content-sites. Elke dataset en elk bericht wordt een eigen pagina uit JSON. Standaard geen JavaScript naar de browser, alleen waar nodig (hero, filters). |
| Taal | TypeScript | Typecontrole op contentformaten en hero-code. |
| Content | Astro content collections met JSON-bestanden | Agents schrijven gewone JSON; schema's valideren bij elke build. |
| Validatie | Zod-schema's in de collections, gelijk aan `content/schemas/*.schema.json` | Eén bron van waarheid; foute agent-content breekt de build en komt niet live. |
| Styling | Gewone CSS met `design/tokens.css` | Geen Tailwind of UI-bibliotheek; het ontwerp is klein en eigen. |
| Interactie | Kleine vanilla TypeScript-modules als Astro-island | Hero-canvas, filters, weergaveschakelaar, kopieerknop. Geen React/Vue. |
| Zoeken | Pagefind | Statische zoekindex die bij de build wordt gemaakt. Werkt zonder server. |
| Lettertypes | Self-hosted (bijv. via Fontsource) | Sneller en geen verzoeken naar Google. |
| Hosting | GitHub Pages via GitHub Actions | Gratis, past bij de repo-werkwijze. Eigen domein later. |
| Energiedata | Script in GitHub Actions (Node of Python) | Gratis, betrouwbaar, geen AI nodig. |
| Content-agents | Claude (scheduled task) → pull request | Nieuws, agenda en beschrijvingen vragen om lezen en samenvatten. Review door Paul. |

**Alternatieven overwogen:** Eleventy (simpeler, minder geschikt voor islands), Next.js (zwaarder dan nodig), puur HTML (geen pagina per dataset zonder eigen tooling).

## 3. Repostructuur (doel)

```
/
├─ CLAUDE.md
├─ README.md
├─ docs/                      # deze specificatie
├─ design/                    # tokens, logo
├─ prototype/                 # visuele referentie, niet deployen
├─ agents/                    # prompts voor content-agents
├─ content/
│  ├─ schemas/                # JSON-schema's (referentie voor agents)
│  ├─ datasets/*.json
│  ├─ nieuws/*.json
│  ├─ agenda/*.json
│  └─ bronnen/*.json
├─ data/
│  ├─ reeksen/latest.json     # gisteren tot nu, voor de hero (alleen in build)
│  ├─ reeksen/archief/YYYY-MM-DD.json
│  └─ voorbeelden/<dataset-slug>.json   # echte voorbeelddata per dataset
├─ scripts/
│  ├─ fetch-energy.(ts|py)    # haalt zon, wind, verbruik op
│  ├─ fetch-previews.(ts|py)  # haalt voorbeelddata per dataset op
│  └─ validate-content.ts
├─ src/
│  ├─ content.config.ts       # collections + zod-schema's
│  ├─ layouts/Base.astro
│  ├─ components/             # zie §5
│  ├─ scripts/hero/           # canvas-landschap (TS)
│  ├─ styles/                 # tokens.css + globale stijlen
│  └─ pages/                  # zie §4
├─ public/                    # favicon, logo's, fonts
└─ .github/workflows/
   ├─ deploy.yml
   ├─ energy.yml
   └─ previews.yml
```

## 4. Pagina's en routes

| Route | Inhoud |
|---|---|
| `/` | Hero (kop, zoeken, snelle thema-chips, kerncijfers, landschap), catalogus (lijst/kaarten, filters), nieuwsrivier + laatste 4 berichten, agenda (jaarring + 4 items), bronnen. |
| `/datasets/` | Volledige catalogus met filters (thema, formaat, toegang, frequentie) en zoeken. |
| `/datasets/[slug]/` | Detailpagina (zie §6). |
| `/nieuws/` | Rivier van 90 dagen + lijst, filter op thema. |
| `/nieuws/[slug]/` | Samenvatting, link naar origineel, gekoppelde datasets. |
| `/agenda/` | Komende en afgelopen evenementen, jaarring. |
| `/bronnen/` en `/bronnen/[slug]/` | Overzicht per leverancier met hun datasets. |
| `/over/` | Wat Netwijzer is, hoe agents werken, hoe je een fout meldt. |
| `/404` | Eigen foutpagina in de stijl van de site. |

Elke detailpagina heeft een eigen URL, titel, beschrijving en Open Graph-gegevens.

## 5. Componenten

| Component | Bron in prototype | Opmerkingen |
|---|---|---|
| `Header` / `Logo` | nav + `.meter` | Logo geanimeerd, stil bij reduced motion. |
| `HeroIntro` | `.hero-top` | Kop, ondertitel, zoeken, thema-chips, drie kerncijfers (uit content berekend). |
| `PolderLandscape` | `#cv` + `.readout` + `.legend` | Island. Leest `data/reeksen/latest.json`. Regels in `01-identiteit.md` §7. |
| `ThemeChip` | `.chip` | Kleur uit thema-mapping. |
| `CatalogList` / `CatalogRow` | `.list`, `.row` | Tijdbalk "beschikbaar sinds". |
| `CatalogCards` / `DatasetCard` | `.cards`, `.card` | Mini-grafiek uit `data/voorbeelden/`. |
| `CatalogFilters` | `.filters`, `.view` | Island; filtert client-side op data-attributen. Zonder JS: alle items zichtbaar. |
| `NewsRiver` | `#river` | SVG, server-side gegenereerd. Tooltip via `<title>`. |
| `NewsItem` | `.ni` | Themastreep, kop, samenvatting, bron + datum. |
| `AgendaRing` / `AgendaItem` | `#ring`, `.ag` | SVG, wijzer op vandaag. |
| `SourceRow` | `.src-row` | Stip per dataset. |
| `DatasetFacts` | `.facts6` | Zes kerngegevens. |
| `DatasetPreview` | `weave` / `periodBars` / `dotMap` | Keuze op basis van frequentie en formaat. Echte data (zie §7.2). |
| `DataTable` | `.tbl` | Eerste vijf rijen en veldenlijst. |
| `PromptBlock` | `.code` | Startprompt met kopieerknop (zie §6). |
| `Coverage` | `.cover` | Dekking per jaar. |
| `AgentStamp` | `.agent` | "Gecontroleerd door de Netwijzer-agent op …". Alleen tonen als `lastChecked` < 48 uur oud. |

## 6. Detailpagina dataset

Volgorde (zie prototype, route `#ds-2`):

1. Kruimelpad, thema, naam, leverancier, beschrijving in eigen woorden.
2. Zes kerngegevens: meetfrequentie, formaat, toegang, beschikbaar sinds, laatst bijgewerkt, eenheid.
3. Voorbeeld: tijdreeks → weefsel 7 dagen × 24 uur; maand/jaar → staven; kaart → puntenpatroon (tot fase 4).
4. Zo ziet de data eruit: eerste vijf rijen.
5. Velden: naam, type, betekenis.
6. **Begin met een prompt:** een startprompt voor Claude of een andere AI-assistent, automatisch gevuld met de gegevens van de dataset, met kopieerknop. Sjabloon in `agents/startprompt-dataset.md`.
7. Dekking per jaar.
8. Let op: bekende beperkingen.
9. Zijkolom: "Naar de bron", leverancier, licentie, thema, agent-stempel, vergelijkbare datasets, gerelateerd nieuws.

## 7. Datastromen

### 7.1 Hero: gisteren tot nu

- `energy.yml` draait elk uur (cron, bijv. minuut 7) en bij handmatige start.
- `scripts/fetch-energy` haalt per kwartier zon, wind en verbruik op voor gisteren 00:00 tot nu (Nederlandse tijd), uit NED.nl (opwek) en ENTSO-E (totale belasting). Sleutels als secrets `NED_API_KEY` en `ENTSOE_TOKEN`.
- Uitvoer: `data/reeksen/latest.json` volgens `content/schemas/energiereeks.schema.json`.
- Om commit-ruis te voorkomen: de workflow bouwt en deployt direct met dit bestand **zonder** het te committen. Eén keer per dag (na middernacht) wordt de volledige dag van gisteren gecommit in `data/reeksen/archief/`.
- Als de bron faalt: laatste geldige archiefbestand gebruiken en in het waardenvak tonen "gegevens tot <tijd>". Nooit data verzinnen.
- Exacte endpoints, parameters en limieten: Claude Code zoekt dit uit in de officiële documentatie van NED en ENTSO-E en legt het vast in `docs/bronnen-api.md` voordat er code komt.

### 7.2 Echte voorbeelddata per dataset

- `previews.yml` draait wekelijks.
- `scripts/fetch-previews` haalt per dataset met `preview.enabled: true` een kleine uitsnede op (7 dagen, 12 perioden of max. 500 objecten) en schrijft `data/voorbeelden/<slug>.json`.
- De detailpagina en de kaartweergave lezen dit bestand. Ontbreekt het: toon "Nog geen voorbeelddata" in plaats van verzonnen data.

### 7.3 Content via agents

Zie `docs/03-content-en-agents.md`. Kort: Claude scheduled tasks maken een branch, schrijven JSON-bestanden en openen een pull request. Paul reviewt en merget. De build valideert alles.

## 8. Kwaliteit

- **Toegankelijkheid:** WCAG 2.2 AA. Automatische check (bijv. axe) in CI op home en één detailpagina.
- **Prestaties:** Lighthouse ≥ 90 op mobiel voor prestaties en toegankelijkheid. Hero-script ≤ 30 KB gzip. Canvas pauzeert buiten beeld.
- **Robuustheid hero:** eerst een stilstaand volledig beeld tekenen; animatie is een extraatje. Vangnet als animatieframes niet lopen.
- **Links:** wekelijkse linkcheck op `content/`; kapotte links worden een issue.
- **Privacy:** geen trackers. Eventueel later cookieloze statistiek (open beslissing).

## 9. Fasering en acceptatiecriteria

### Fase 0 — Basis
- Astro-project, TypeScript, tokens, lettertypes, Base-layout, header met logo, footer.
- `deploy.yml`: build en deploy naar GitHub Pages bij push op `main`.
- ✅ Klaar als: een lege pagina in Netwijzer-stijl staat live op GitHub Pages; build faalt bij een TypeScript-fout.

### Fase 1 — Statische site met voorbeeldcontent
- Content collections + zod-schema's; voorbeeldcontent uit `content/voorbeeld/` overnemen.
- Alle pagina's uit §4 behalve `/over/` mogen eenvoudig.
- Hero met de voorbeeldreeks (statisch bestand), volledig gedrag uit het prototype.
- Pagefind-zoeken.
- ✅ Klaar als: de site er op desktop en mobiel uitziet als het prototype; elke dataset heeft een eigen URL; zoeken vindt datasets; Lighthouse ≥ 90; fout JSON-bestand breekt de build met een duidelijke melding.

### Fase 2 — Echte energiedata
- `bronnen-api.md`, `fetch-energy`, `energy.yml`, archief; `fetch-previews`, `previews.yml`.
- ✅ Klaar als: de hero toont echte data van gisteren tot het laatste beschikbare kwartier; bij een storing van de bron blijft de site werken met de laatste geldige data en een melding; sleutels staan alleen in secrets.

### Fase 3 — Content-agents
- Prompts in `agents/` uitwerken, scheduled tasks inrichten, PR-sjabloon met checklist.
- ✅ Klaar als: een agent-run levert een PR op met geldige JSON, eigen samenvattingen, werkende links en bronvermelding; na merge staat het binnen 10 minuten live.

### Fase 4 — Kaart (later)
- Apart ontwerp nodig.

## 10. Open beslissingen

| # | Beslissing | Voorstel |
|---|---|---|
| 1 | Domeinnaam | Beschikbaarheid `netwijzer.nl` checken bij SIDN. Let op: `netwijzers.nl` bestaat al (andere sector). |
| 2 | AI-illustraties | Voorlopig niet; data is het beeld. |
| 3 | Statistiek | Geen, of cookieloos (bijv. Plausible/GoatCounter). |
| 4 | Licenties per bron | Per dataset vastleggen; agent vult in, Paul controleert. |
| 5 | Archief hero | Hoe lang bewaren: voorstel 2 jaar. |

## 11. Risico's

- **Bronnen veranderen** (endpoints, licenties): wekelijkse controle + agent-stempel alleen bij geslaagde check.
- **Agent hallucineert** (verkeerde datum, verzonnen link): schema-validatie, linkcheck en verplichte review per PR.
- **Rate limits API's:** caching via archief, beperkte uitsnedes voor voorbeelden.
- **Afhankelijkheid van één persoon:** alle werkwijzen staan in deze docs en in de repo.
- **Werkgever / merk:** de site gebruikt geen interne data of huisstijl van een werkgever.
