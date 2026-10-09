# 01 — Identiteit

Status: vastgesteld op basis van prototype v0.5 (9 okt 2026). Wijzigingen alleen na akkoord van Paul.

## 1. Merk

- **Naam:** Netwijzer. Een wijzer is de naald op een meter. De naam staat ook voor wijzer worden.
- **Positionering:** onafhankelijk, Nederlandstalig, voor iedereen die met energiedata werkt. Niet gelieerd aan een netbeheerder of werkgever.
- **Belofte (kop homepage):** *Elke dataset over het Nederlandse net, op één plek.*
- **Ondertitel:** *Datasets, nieuws en agenda voor iedereen die met energiedata werkt. Dagelijks bijgehouden, altijd met bron.*
- **Karakter:** precies, rustig, deskundig, met één poëtisch moment (het landschap in de hero).

## 2. Logo

Het logo is het venster van een Ferraris-kWh-meter: een afgerond kader met daarin de rand van de draaischijf en de rode markering.

| Variant | Bestand | Gebruik |
|---|---|---|
| Logo geanimeerd | `design/logo/netwijzer-logo-animated.svg` | Navigatiebalk op de site |
| Logo statisch | `design/logo/netwijzer-logo.svg` | Social, documenten, e-mail, plekken zonder beweging |
| Icoon | `design/logo/netwijzer-icon.svg` | Favicon, app-icoon, avatar |

**Constructie**

- Kader 44 × 26 eenheden, hoekradius 5, lijndikte 2, kleur `--ink`.
- Venster 36 × 10, hoekradius 2, kleur `--paper-2`.
- Schijfrand: horizontale lijn van 1 eenheid, kleur `--ink-2`.
- Markering: 8 × 6, hoekradius 1, kleur `--needle`.
- Woordmerk: `NETWIJZER` in Azeret Mono 500, letterafstand 0,14 em, 12 px rechts van het kader.

**Animatie**

- De markering schuift in 6 seconden lineair door het venster en begint opnieuw, zoals de schijf van een meter.
- Bij `prefers-reduced-motion: reduce` staat de markering stil op ⅓ van het venster.

**Niet doen**

- Geen andere kleur voor de markering dan `--needle`.
- Het kader niet vullen, schaduw geven of vervormen.
- Het woordmerk niet in een ander lettertype zetten.
- Minimale hoogte van het kader: 20 px. Vrije ruimte rondom: minimaal de hoogte van het venster.

## 3. Kleur

Alle kleuren staan als tokens in `design/tokens.css`. Componenten gebruiken alleen tokens.

### Basis

| Token | Licht | Donker | Rol |
|---|---|---|---|
| `--paper` | `#F2F3EF` | `#0E1318` | Achtergrond |
| `--paper-2` | `#E7E9E3` | `#161E26` | Vlakken, kaarten, hover |
| `--ink` | `#121A24` | `#E7E9E4` | Tekst, lijnen, primaire knop |
| `--ink-2` | `#55606C` | `#9AA4AE` | Secundaire tekst, labels |
| `--rule` | `#CBCFC7` | `#2A3440` | Scheidingslijnen |
| `--needle` | `#D2302A` | `#FF5B4F` | Accent: de wijzer, de afspeelkop, "nu" |

Het rood komt van het merkteken op de draaischijf van de Ferraris-meter. Het wordt spaarzaam gebruikt: voor de wijzer, voor "nu"/"vandaag" en voor focusringen.

### Thema's

Elk thema heeft een vaste kleur, overal hetzelfde (chips, lijsten, grafieken, nieuwsrivier, agenda).

| Thema | Token | Licht | Donker |
|---|---|---|---|
| Opwek | `--sun` | `#D99A0B` | `#F0B431` |
| Verbruik | `--verbruik` | `#3D5AA8` | `#8CA4EA` |
| Net & congestie | `--needle` | `#D2302A` | `#FF5B4F` |
| Markt | `--wind` | `#2B7B88` | `#4FB0C0` |
| Geo & infra | `--geo` | `#6E7F3C` | `#AFC274` |

### Landschap (hero)

Het landschap heeft een eigen, vast palet dat niet meewisselt met licht/donker. Het is een eigen wereld. Waarden staan in `design/tokens.json` onder `landscape`.

## 4. Typografie

| Rol | Lettertype | Gebruik |
|---|---|---|
| Display | Source Serif 4 (600, cursief 400) | Koppen. Cursief alleen voor één nadrukwoord per kop. |
| Tekst | Schibsted Grotesk (400/500/600) | Lopende tekst, knoppen, navigatie |
| Data | Azeret Mono (400/500) | Getallen, tijden, labels in kapitalen, woordmerk |

- Alle drie via Google Fonts, of self-hosted voor privacy en snelheid (voorkeur).
- Getallen altijd met `font-variant-numeric: tabular-nums`.
- Labels: Azeret Mono, 0,7 rem, kapitalen, letterafstand 0,08 em.
- Schaal: zie `--step-*` in `tokens.css`. Lopende tekst maximaal ongeveer 65 tekens breed.
- Decimaalteken is een komma (`14,2 GW`). Datum: `9 okt 2026`. Tijd: `14:00`.

## 5. Ruimte en vorm

- Maximale breedte inhoud: 1240 px. Zijmarge: `clamp(16px, 4vw, 48px)`.
- Ruimte tussen secties: 88 px (desktop).
- Hoekradius: 6 px voor vlakken, 999 px voor chips/knoppen. Geen schaduwen behalve bij de geselecteerde schakelaar.
- Scheidingslijnen in plaats van kaders. Kaarten alleen in de kaartweergave van de catalogus.

## 6. Datavisualisatie

- Eén kleur per thema; nooit twee betekenissen voor één kleur.
- Waar mogelijk labels direct in de grafiek in plaats van een legenda.
- Elke grafiek heeft een kop die zegt wat je ziet, een korte uitleg en een bron met peildatum.
- Interactie: hover/tik geeft exacte waarde. Alles wat gelezen moet worden is ook zonder interactie zichtbaar.
- Voorbeelddata is altijd gemarkeerd met "voorbeeld".

## 7. Het landschap (hero)

Het polderlandschap wordt volledig getekend uit data. Het is kunst, maar het moet leesbaar blijven.

| Element | Data | Regel |
|---|---|---|
| Tijdas | gisteren 00:00 → vandaag 24:00 | Links naar rechts, 192 kwartieren. Dagscheiding met stippellijn en label "VANDAAG →". |
| Zonnebaan | zonopwek (GW) | Hoogte = GW. Schaallijnen 2, 4, 6 GW rechts gelabeld. |
| Molens | windopwek (GW) | Eén molen per 3 uur (desktop) of 6 uur (mobiel). Draaisnelheid = wind op dat moment. |
| Landlijn | verbruik (GW) | Hoogte volgt verbruik. Niet op schaal; exacte waarde in het waardenvak. |
| Lichtjes | verbruik | Dichtheid volgt verbruik, fel als het donker is. |
| Lucht | tijd van de dag | Dag, schemer, nacht met sterren. |
| Mist | na "nu" | "nog niet gemeten". Geen verzonnen data na nu. |
| Rode lijn | afspeelkop | Speelt van gisteren 00:00 tot nu in ongeveer 36 seconden. Volgt de muis. |
| Annotaties | zonpiek, avondpiek, hardste molen | Direct in beeld, met waarde en tijd. |

Waardenvak linksboven: tijd, gisteren/vandaag, zon, wind, verbruik en "zon + wind dekt %".

Technisch: canvas, pauzeert buiten beeld, tekent altijd eerst een volledig stilstaand beeld (ook als animatieframes niet lopen), respecteert `prefers-reduced-motion`.

## 8. Beeld

- Uitgangspunt: **geen foto's en geen gegenereerde beelden**. Data is het beeld.
- Open besluit: eventueel later een vaste set AI-illustraties per sectie (Gemini). Alleen na akkoord en volgens de spelregels uit het moodboard (documentair, geen gloed, geen mensen, geen tekst).

## 9. Toon

- Nederlands, kort, actief. Schrijf zoals een deskundige collega praat.
- Geen marketingtaal, geen superlatieven, geen uitroeptekens.
- Samenvattingen altijd in eigen woorden, met link naar het origineel en de datum.
- Knoppen zeggen wat er gebeurt: "Zoeken", "Kopieer", "Naar de bron".

## 10. Toegankelijkheid

- Contrast minimaal 4,5:1 voor tekst (beide thema's).
- Zichtbare focusring in `--needle`.
- Grafieken hebben een tekstalternatief (`aria-label` of tabel).
- Alle beweging stopt bij `prefers-reduced-motion`.

### Themakleuren zijn markeringen, geen tekst

Vastgesteld 9 okt 2026, na meting tijdens de bouw van fase 1.

De themakleuren halen in de **lichte** modus op `--paper` niet allemaal 4,5:1.
Gemeten volgens WCAG 2.2:

| Token | Op `--paper` (licht) | Als kleine tekst |
|---|---|---|
| `--ink` | 15,72:1 | ja |
| `--verbruik` | 5,84:1 | ja |
| `--ink-2` | 5,75:1 | ja |
| `--needle` | 4,49:1 | nee |
| `--wind` | 4,39:1 | nee |
| `--geo` | 3,96:1 | nee |
| `--sun` | 2,20:1 | nee |

In de **donkere** modus haalt elk van deze kleuren ruim 6:1; daar speelt het niet.

De kleuren zelf veranderen niet. Geel kan op licht papier geen 4,5:1 halen zonder
op te houden geel te zijn, en de themakleuren moeten juist van elkaar te
onderscheiden blijven. In plaats daarvan geldt deze regel:

- **Tekst staat in `--ink` of `--ink-2`.** Ook een themalabel, een kop of een
  datum. Nooit in een themakleur, hoe verleidelijk ook.
- **De themakleur zit in de markering ernaast:** de stip, de streep, de staaf, de
  lijn in een grafiek, of de achtergrond van een geselecteerde chip. Voor
  niet-tekstelementen geldt 3:1, en dat halen alle themakleuren ruim.
- `--verbruik` haalt als enige wél 4,5:1, maar gebruik ook die niet als tekst:
  één regel is duidelijker dan vier uitzonderingen.
- Een chip met een themakleur als **achtergrond** mag, mits de tekst erop
  voldoende contrast heeft. Controleer dat per geval.

Dit is bewust een beperking op de vorm, niet op de betekenis: het thema blijft
overal herkenbaar aan dezelfde kleur, alleen niet meer in de letters zelf.
