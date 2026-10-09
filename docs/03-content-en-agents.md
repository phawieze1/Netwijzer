# 03 — Content en agents

## 1. Contentsoorten

| Soort | Map | Schema | Bestandsnaam |
|---|---|---|---|
| Dataset | `content/datasets/` | `dataset.schema.json` | `<slug>.json` |
| Nieuwsbericht | `content/nieuws/` | `nieuws.schema.json` | `YYYY-MM-DD-<slug>.json` |
| Evenement | `content/agenda/` | `evenement.schema.json` | `YYYY-MM-DD-<slug>.json` |
| Bron | `content/bronnen/` | `bron.schema.json` | `<slug>.json` |
| Energiereeks | `data/reeksen/` | `energiereeks.schema.json` | `latest.json` (script) |

Voorbeelden die aan de schema's voldoen staan in `content/voorbeeld/`.

**Thema's** (vaste lijst): `opwek`, `verbruik`, `net`, `markt`, `geo`.

## 2. Wie levert wat

| Wat | Door | Hoe vaak | Review |
|---|---|---|---|
| Energiereeks hero | Script (GitHub Actions) | Elk uur | Nee, wel validatie |
| Voorbeelddata datasets | Script (GitHub Actions) | Wekelijks | Nee, wel validatie |
| Nieuws | Claude-agent | Dagelijks (werkdagen) | Ja, via PR |
| Agenda | Claude-agent | Wekelijks | Ja, via PR |
| Nieuwe datasets / beschrijvingen | Claude-agent | Wekelijks | Ja, via PR |
| Controle bestaande datasets (links, metadata) | Claude-agent of script | Dagelijks | Alleen bij wijziging |

## 3. Werkwijze agents

1. De scheduled task start met de prompt uit `agents/<agent>.md`.
2. De agent leest de bestaande content in de repo om dubbelingen te voorkomen (vergelijk op `bronUrl`).
3. De agent zoekt in de bronnenlijst (`content/bronnen/`) en het web.
4. Per nieuw item schrijft de agent één JSON-bestand volgens het schema.
5. De agent maakt een branch `agent/<soort>/<datum>`, commit en opent een pull request met:
   - een lijst van toegevoegde items met links;
   - per item een zekerheid (hoog/midden/laag) en waarom;
   - wat de agent heeft overgeslagen en waarom.
6. De build in de PR valideert de schema's. Paul reviewt en merget.

**Toegang:** de scheduled task heeft schrijfrechten op de repository nodig (GitHub-koppeling of een fine-grained token met alleen `contents` en `pull requests` op deze repo).

## 4. Redactieregels voor agents

- Schrijf in het Nederlands, kort en feitelijk. Samenvatting maximaal 60 woorden, in eigen woorden.
- Nooit tekst overnemen uit het origineel, behalve een citaat van maximaal één zin tussen aanhalingstekens.
- Altijd: link naar het origineel, naam van de bron, publicatiedatum.
- Alleen opnemen wat over **data** in de energiesector gaat: datasets, visualisaties, duiding, rapporten. Geen marketing van leveranciers, geen hardware-nieuws.
- Scope: netcongestie en netbeheer (kern), verbruik, invoeding en opwek. Nederland eerst; buitenland alleen als inspirerend voorbeeld.
- Kies bij twijfel `zekerheid: "laag"` en leg uit waarom. Liever een item overslaan dan gokken.
- Geen gegevens van besloten bronnen of achter een login. LinkedIn niet automatisch uitlezen.
- Koppel nieuws waar mogelijk aan een dataset (`datasets: ["<slug>"]`).

## 5. Startprompt op de detailpagina

Elke datasetpagina toont een startprompt die bezoekers kunnen kopiëren naar een AI-assistent. Het sjabloon staat in `agents/startprompt-dataset.md`. De site vult de velden tussen `{{ }}` in bij de build.
