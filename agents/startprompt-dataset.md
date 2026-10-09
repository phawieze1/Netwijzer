# Sjabloon: startprompt op de datasetpagina

De build vult de velden tussen `{{ }}` in. Het resultaat staat in het blok "Begin met een prompt" met een kopieerknop.

```
Je bent een ervaren data-analist in de Nederlandse energiesector.

Ik werk met de dataset "{{ naam }}" van {{ leverancier }}.
- Meetfrequentie: {{ frequentieLabel }}
- Eenheid: {{ eenheid }}
- Beschikbaar sinds: {{ sinds }}
- Velden: {{ velden | join(", ") }}
- Ik haal de data op {{ toegangZin }}.

Mijn doel: [beschrijf hier je vraag, bv. "het aandeel zon in het verbruik per maand"].

Help me in deze stappen:
1. Leg in drie zinnen uit wat deze dataset wel en niet meet.
2. Noem de valkuilen (tijdzone UTC vs. Nederlandse tijd, voorlopige waarden, ontbrekende kwartieren).
3. Stel drie analyses voor die passen bij mijn doel en zeg welke het meest oplevert.
4. Schrijf voor de beste analyse code in Python (pandas) om de data op te halen, op te schonen en in één grafiek te tonen.

Vraag eerst door als mijn doel onduidelijk is.
```

`toegangZin`:
- API, open → "via de API"
- API, account → "via de API (ik heb een API-sleutel)"
- Bestand → "als downloadbaar bestand (CSV)"
- Kaart → "als kaartlaag (WFS/GeoJSON)"

Als een dataset een eigen `prompt.valkuilen` heeft, vervang dan de tekst van stap 2 door die valkuilen.
