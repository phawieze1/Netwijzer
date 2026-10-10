# Bronnen-API

Status: onderzoek afgerond 9 okt 2026. Vastgelegd **voordat** er code komt, zoals
`docs/02-bouwspecificatie.md` §7.1 voorschrijft. Nog niet goedgekeurd door Paul.

Alles hieronder komt uit de officiële documentatie van NED en ENTSO-E. Per blok
staat waar het staat en wanneer ik het gelezen heb. Wat ik **niet** heb kunnen
verifiëren staat apart in §7 — dat is geen detail, want een aanname die stilletjes
fout is, levert een hero op die er goed uitziet en onjuist is.

## 1. De belangrijkste uitkomst

**NED levert alle drie de reeksen die de hero nodig heeft**, op kwartierbasis:
zon, wind én elektriciteitsvraag. Dat laatste was niet het plan. §7.1 van de
bouwspecificatie zegt "NED.nl (opwek) en ENTSO-E (totale belasting)", maar NED
publiceert zelf `type=59 Electricityload` op 15-minutenbasis, met historie en
near-realtime.

Gevolg voor de planning: **de ENTSO-E-token is geen blokkade meer.** Fase 2a kan
volledig gebouwd en live gezet worden met alleen `NED_API_KEY`.

Voorstel voor de rolverdeling:

| Reeks | Primaire bron | Waarom |
|---|---|---|
| Zon | NED `type=2` | Enige bron op kwartierbasis met near-realtime. |
| Wind | NED `type=1` + offshore | Idem. Zie §3.3 voor een open keuze. |
| Verbruik | NED `type=59` | Sneller dan ENTSO-E (zie hieronder) en één bron, één tijdas. |

**ENTSO-E blijft waardevol, maar als tweede bron, niet als eerste.** Twee redenen
om hem niet als primaire bron voor verbruik te nemen:

1. **Latentie.** ENTSO-E publiceert de werkelijke belasting "at the latest H+1
   after the end of the operating period". Voor een hero die tot "nu" loopt, is
   een uur achterstand veel.
2. **De cijfers worden later herzien.** De platformdocumentatie zegt specifiek
   over Nederland dat de gepubliceerde waarden "updated with settlement data
   after completion of the settlement process" worden. Een archiefbestand dat wij
   vandaag vastleggen, wijkt dus later af van wat ENTSO-E dan toont. Dat is geen
   fout van ons, maar het moet vastliggen voordat iemand zich erover verbaast.

Waar ENTSO-E wél sterk is: het is de officiële Europese publicatie onder
Verordening 543/2013. Dat maakt hem geschikt als **kruiscontrole** op NED, en als
eigen dataset in de catalogus. Beide zijn fase 2b of later, niet nu.

## 2. NED — basis

| Onderwerp | Waarde |
|---|---|
| Basis-URL | `https://api.ned.nl/v1` |
| Endpoint voor metingen | `GET /v1/utilizations` |
| Authenticatie | header `X-AUTH-TOKEN` |
| Sleutel aanvragen | NED.nl-account → "mijn account" → tabblad API → zelf sleutel aanmaken |
| Zonder sleutel | HTTP 401 (zelf nagegaan, 9 okt 2026) |
| Rate limit | 200 opvragingen per 5 minuten |
| Paginering | `page` (vanaf 1), `itemsPerPage` — standaard 144, **maximum 200** |
| Sortering | `order[validfrom]`, standaard **`desc`** |
| Formaten | jsonld, jsonhal, jsonapi, json, xml, csv, html |
| Tijd in de respons | altijd UTC |

De oude endpoint `https://api.netanders.io/v1` is uit gebruik. Niet gebruiken.

### 2.1 Parameters die wij nodig hebben

| Parameter | Waarde voor ons | Betekenis |
|---|---|---|
| `point` | `0` | Nederland (1–12 provincies, 14 offshore, 28–36 windparken) |
| `type` | zie §3 | energiedrager |
| `granularity` | `4` | 15 minuten (3=10 min, 5=uur, 6=dag, 7=maand, 8=jaar) |
| `granularitytimezone` | `1` | CET (0 = UTC) |
| `classification` | `2` | **Current** — gemeten. 1 is Forecast. |
| `activity` | `1` bij opwek, zie §7 bij verbruik | 1=Providing, 2=Consuming, 3=Import, 4=Export |
| `validfrom[after]` | datum van gisteren | ook `strictly_after`, `before`, `strictly_before` |

`classification=2` is niet optioneel voor ons. NED biedt voor `type=59` een
voorspellingshorizon van 7 dagen. Zou dat meekomen, dan tekent de hero data na
"nu" — precies wat `docs/01-identiteit.md` §7 verbiedt ("Geen verzonnen data na
nu"). **Het script moet `classification` altijd expliciet op 2 zetten en
daarnaast elk punt met `validto` in de toekomst weggooien**, als tweede slot op
dezelfde deur.

### 2.2 Responsvelden

`capacity` (kW), `volume` (kWh), `percentage`, `emission`, `emissionfactor`,
`validfrom`, `validto`, `lastupdate`. In de OpenAPI-specificatie zijn `capacity`
en `volume` van het type **string**, niet number — dus parsen, niet aannemen.

Wij hebben GW nodig. Bij een kwartier geldt
`volume [kWh] = capacity [kW] × 0,25 h`, dus beide wegen leiden naar hetzelfde
getal: `GW = capacity / 1 000 000`. Dat die identiteit in de praktijk opgaat is
een **aanname tot de eerste echte aanroep** (§7).

### 2.3 Hoeveel verzoeken dit kost

Twee dagen kwartierdata is 192 punten per type, en 196 op de dag na de
zomertijdwissel (§6.1). Met `itemsPerPage=200` past elk type dus in **één**
pagina — maar zonder enige marge. Daarom: één verzoek per type, en het script
volgt de `next`-verwijzing zolang die er is, in plaats van te vertrouwen op dat
het past.

Drie of vier verzoeken per uur, tegen een limiet van 200 per 5 minuten. Ruim.

*Bron: [Handleiding API](https://ned.nl/nl/handleiding-api), [API
datacatalogus](https://ned.nl/nl/datacatalogus), [Eigen toepassingen koppelen
(API)](https://ned.nl/nl/api) en de OpenAPI-specificatie op
[api.ned.nl/v1](https://api.ned.nl/v1) — gelezen 9 okt 2026.*

## 3. NED — welke types

### 3.1 Zon

`type=2` (Solar). Granulariteit 10 min, 15 min, uur, dag, maand, jaar.

`type=50` is SolarThermal en hoort **niet** bij de zonnebaan in de hero: dat is
warmte, geen elektriciteit.

### 3.2 Verbruik

`type=59` (Electricityload). Granulariteit 15 min, uur, dag, maand, jaar, met
historie en near-realtime, en een voorspellingshorizon van 7 dagen die wij dus
moeten wegfilteren (§2.1).

### 3.3 Wind — hier moet jij kiezen

NED kent geen enkel type "wind totaal". Er zijn drie losse types:

| Type | Naam | Wat het is |
|---|---|---|
| `1` | Wind | wind op land |
| `17` | WindOffShore | wind op zee, gemodelleerde data |
| `51` | WindOffshoreC | wind op zee, "ned.nl en energieopwek.nl" |

De molens in de hero staan voor "windopwek (GW)" — dat is land plus zee. We
moeten dus optellen, en kiezen welke offshore-reeks.

**Mijn voorstel: `1` + `51`.** De datacatalogus zegt dat `51` de reeks is die NED
op ned.nl en energieopwek.nl zelf gebruikt. Wie ons getal naast het nationale
dashboard legt, ziet dan hetzelfde. Dat lijkt me belangrijker dan de vraag welke
reeks technisch "zuiverder" is — Netwijzer is een wijzer, geen tweede waarheid.

Dit is een inhoudelijke keuze over energiedata, dus ik leg hem aan jou voor in
plaats van hem zelf te maken. Wat er ook uitkomt: het **moet** in de bronregel
onder de hero staan, want "wind" is dan een samenstelling van twee reeksen en
geen enkele meting.

*Bron: [API datacatalogus](https://ned.nl/nl/datacatalogus) — gelezen 9 okt 2026.*

## 4. NED — licentie: open punt

Op `ned.nl/nl/api` staat **niets** over bronvermelding, licentie, hergebruik of
commercieel gebruik. Ook niet over verschillen tussen accounttypen of over welke
data vrij is.

Dat is een probleem, want CLAUDE.md eist een licentie per dataset en de
datasetbestanden staan nu op `"licentie": { "naam": "Te controleren" }`. Voor de
hero tonen we NED-data publiek op een eigen site; dat mag niet op een aanname
rusten.

**Actie voor Paul:** NED vragen onder welke voorwaarden de API-data hergebruikt
en publiek getoond mag worden, en wat de gewenste bronvermelding is. Tot het
antwoord binnen is houden we de bronregel "Bron: NED" en blijft de licentie in de
catalogus "Te controleren".

## 5. ENTSO-E — voor later, maar vastgelegd

| Onderwerp | Waarde |
|---|---|
| Endpoint | `https://web-api.tp.entsoe.eu/api` (alleen https) |
| Testomgeving | `https://web-api.tp-iop.entsoe.eu/api` (minder data) |
| Authenticatie | queryparameter `securityToken` |
| Ontbrekend/ongeldig | HTTP 401 |
| Token aanvragen | account op transparency.entsoe.eu, dan e-mail naar `transparency@entsoe.eu` met "RESTful API access" in de subjectregel en het geregistreerde e-mailadres in de body. **Toegekend binnen 3 werkdagen.** |
| Rate limit | 400 verzoeken per minuut **per token** (niet per IP); overschrijden geeft een tijdelijke ban van circa 10 minuten |
| Timeout | 300 seconden |
| Tijd | overal UTC |

Dat "binnen 3 werkdagen" klopt met wat Paul hoorde. Het is geen zelfbediening: de
e-mailstap kan niet worden overgeslagen.

### 5.1 Werkelijke totale belasting opvragen

| Parameter | Waarde |
|---|---|
| `documentType` | `A65` |
| `processType` | `A16` (realised) |
| `outBiddingZone_Domain` | `10YNL----------L` |
| `periodStart` / `periodEnd` | `yyyyMMddHHmm`, in UTC |

De EIC-code `10YNL----------L` dekt voor Nederland zowel BZN als CTA. Er is geen
aparte code per netbeheerder nodig.

In plaats van `periodStart`/`periodEnd` kan `timeInterval`
(`yyyy-MM-ddTHH:mmZ/yyyy-MM-ddTHH:mmZ`) gebruikt worden; die werkt ook met POST.
Voor artikel 6.1.A geldt een maximum van **één jaar** per verzoek — voor ons geen
beperking.

### 5.2 Twee valkuilen in het antwoord

**Lees de resolutie uit het antwoord, neem hem niet aan.** De `ResolutionCode`
kan `PT15M`, `PT30M` of `PT60M` zijn. Een parser die 15 minuten aanneemt, schuift
de hele tijdas op zodra een periode op uurbasis gepubliceerd wordt.

**`curveType=A03` betekent dat ontbrekende posities geen gaten zijn.** ENTSO-E
gebruikt "variable-sized blocks" om data te verkleinen: bij A03 staat een punt er
alleen als de waarde *verandert*. Een ontbrekende positie betekent dan "zelfde
waarde als het vorige punt", niet "geen meting". Wie posities naïef op een as
legt, krijgt gaten die er niet zijn — of erger, verschuift alle latere waarden.
Bij `curveType=A01` staat elke positie er wel.

Dit is precies het soort stille fout waar de hero kwetsbaar voor is: het beeld
blijft mooi en is onjuist. Als we ENTSO-E gaan gebruiken, moet het inlezen
`curveType` expliciet afhandelen en moet daar een test op staan.

*Bron: kennisbank van het Transparency Platform, artikelen "Request Endpoint",
"Authentication and Authorization", "How to get security token?", "API Rate Limit
Part 1" en "Part 2", "API Query Size Limit", "Request Parameters - Time
Interval", "Response Time Zone", "ActualTotalLoad_6.1.A_r3", "Actual Total Load &
Day-ahead Per Bidding Zone [6.1.A] & [6.1.B]", "CurveType=A01 vs CurveType=A03"
en "Area List with Energy Identification Code (EIC)" op
[transparencyplatform.zendesk.com](https://transparencyplatform.zendesk.com/hc/en-us)
— gelezen 9 okt 2026. De oude handleiding op transparency.entsoe.eu bestaat niet
meer (de server geeft `URI_FORMAT_ERROR`); de kennisbank en de
Postman-documentatie zijn de actuele bron.*

## 6. Wat dit betekent voor het schema

`content/schemas/energiereeks.schema.json` vraagt één aanpassing. Gevonden door
het schema naast de echte situatie te leggen, niet door te gokken.

### 6.1 `maxItems: 192` is te laag — en dat breekt op 26 oktober

De hero loopt van gisteren 00:00 tot vandaag 24:00. Normaal 192 kwartieren. Maar
de zomertijd eindigt dit jaar op **zondag 25 oktober 2026**, en die dag heeft 25
uur, dus 100 kwartieren (nagerekend met de tijdzonedatabase, niet geschat):

| Dag | Uren | Kwartieren |
|---|---|---|
| 24 okt 2026 | 24 | 96 |
| **25 okt 2026** | **25** | **100** |
| 26 okt 2026 | 24 | 96 |
| 28 mrt 2027 | 23 | 92 |

Op 26 oktober beslaat het venster dus 100 + 96 = **196** punten. Het schema staat
192 toe, dus `npm run validate` faalt, dus de build faalt, dus de uurlijkse
workflow stopt met deployen en de site bevriest op oude data — **17 dagen na
vandaag**.

De hero-code zelf is wél zomertijdbewust: `src/lib/reeks.ts` berekent `dagQ` en
het commentaar noemt 92 en 100 al expliciet. Alleen het schema loopt achter.

**Voorstel:** `maxItems` naar `200`. Dat dekt 196 met een kleine marge en houdt
het plafond laag genoeg om onzin te blijven weren.

### 6.2 Een ontbrekende bron past al in het schema

`bronnen` vereist `zon`, `wind` en `verbruik` als verplichte strings. Dat
betekent dat "deze reeks ontbreekt" alleen als tekst in dat veld kan staan, niet
als structuur.

Dat is goed genoeg en ik stel hier **geen** wijziging voor: valt een bron uit,
dan zetten we de punten op `null` (dat mag al) en schrijven we in het bronveld
wat er aan de hand is. De hero toont dan een streepje en de dekking vervalt —
`src/lib/reeks.ts` doet dat al correct: `dekking()` geeft geen waarde zodra één
van de drie `null` is, en de lichtjes verdwijnen in plaats van een verzonnen
dichtheid te krijgen.

## 7. Wat ik niet heb kunnen verifiëren

Eerlijk lijstje, want hier kan ik mis zitten. Alles hieronder wordt gecontroleerd
bij de eerste echte aanroep in Actions, en het script moet luidruchtig falen in
plaats van door te gaan op een aanname.

1. **De exacte vorm van de `X-AUTH-TOKEN`-waarde.** De handleiding noemt zowel de
   headernaam als het woord "Bearer". Of de waarde de sleutel zelf is of
   `Bearer <sleutel>`, weet ik niet. Het script probeert het eerste en meldt bij
   een 401 expliciet dat dit de oorzaak kan zijn.
2. **Of `capacity / 1 000 000` werkelijk GW in dat kwartier geeft** — dat
   `capacity` gemiddeld vermogen over het interval is en niet een momentwaarde of
   een opgesteld vermogen. Controle: `volume` moet dan `capacity × 0,25` zijn. Het
   script logt die verhouding bij de eerste run.
3. **Of de datumfilters een tijdcomponent accepteren.** De handleiding noemt
   `YYYY-MM-DD`. Zo niet, dan halen we hele dagen op en snijden we zelf bij — dat
   werkt altijd en is het plan.
4. **Of `point`/`type` als getal mogen, of als IRI** (`/v1/types/2`). De
   handleiding gebruikt getallen, de OpenAPI noemt IRI-referenties. Een verzoek
   zonder sleutel gaf 401 en niet 400, dus de getalvorm wordt syntactisch
   geaccepteerd. Zeker weten we het pas met een sleutel.
5. **Welke `activity` bij `type=59` hoort.** Logisch zou `2` (Consuming) zijn,
   maar verbruik kan ook als `1` gepubliceerd staan. De eerste run wijst het uit.
6. **Of `type=59` met een gewone accountsleutel toegankelijk is.** Er is geen
   documentatie over toegangsniveaus (§4).
7. **De volledige ENTSO-E-respons heb ik niet gezien** — alleen de documentatie.
   Zonder token kon ik niets opvragen.

## 8. Voorgestelde volgorde voor de code

1. `scripts/fetch-energy.ts` — alleen NED, drie reeksen, schrijft
   `data/reeksen/latest.json`. Valideert zijn eigen uitvoer tegen het schema vóór
   het wegschrijven en faalt luidruchtig.
2. `energy.yml` — elk uur, bouwt en deployt zonder te committeren. `deploy.yml`
   wordt daarvoor herbruikbaar (`workflow_call`), en de concurrency-groep moet
   `cancel-in-progress` verliezen: anders breekt een energie-run een
   content-deploy halverwege af.
3. Archief — eens per dag gisteren vastleggen in `data/reeksen/archief/`.
4. Vangnet — bron faalt, laatste geldige archiefbestand plus "gegevens tot
   \<tijd\>" in het waardenvak.
5. Pas daarna, en alleen als Paul dat wil: ENTSO-E als kruiscontrole.

Stap 1 tot 4 kunnen nu, met alleen `NED_API_KEY`.
