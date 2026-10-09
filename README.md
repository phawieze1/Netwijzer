# Netwijzer startpakket

Dit pakket bevat alles om Netwijzer te laten bouwen door Claude Code: het ontwerp, de huisstijl, de bouwspecificatie, de contentformaten en een werkend prototype.

## Wat zit erin

| Map / bestand | Inhoud |
|---|---|
| `CLAUDE.md` | Werkinstructies voor Claude Code. Wordt automatisch gelezen. |
| `docs/01-identiteit.md` | Huisstijl: naam, logo, kleur, typografie, regels voor het landschap, toon. |
| `docs/02-bouwspecificatie.md` | Techniek, pagina's, componenten, datastromen, fasering en acceptatiecriteria. |
| `docs/03-content-en-agents.md` | Contentformaten, werkwijze van de agents en de review-stap. |
| `design/tokens.css`, `design/tokens.json` | Kleuren, letters en maten als vaste waarden. |
| `design/logo/` | Logo (statisch en geanimeerd) en icoon als SVG. |
| `content/schemas/` | JSON-schema's voor datasets, nieuws, agenda, bronnen en energiereeksen. |
| `content/voorbeeld/` | Voorbeeldbestanden die aan de schema's voldoen. |
| `agents/` | Prompts voor de content-agents. |
| `prototype/netwijzer-prototype.html` | Het goedgekeurde prototype (v0.5). Open het in een browser. |

## Zo begin je

1. Maak een lege GitHub-repository, bijvoorbeeld `netwijzer`.
2. Pak dit pakket uit in de root van die repository en commit het.
3. Open de map in Claude Code.
4. Geef als eerste opdracht: `Lees CLAUDE.md en docs/, en stel me je plan voor fase 0 en 1 voor. Begin pas na mijn akkoord.`
5. Werk fase voor fase (zie `docs/02-bouwspecificatie.md`, hoofdstuk Fasering).

## Voordat je begint (zelf regelen)

- Domeinnaam controleren en vastleggen (zie Open beslissingen in de bouwspecificatie).
- API-sleutels aanvragen: NED.nl en ENTSO-E Transparency. Zet ze later als *repository secrets* in GitHub, nooit in code of chat.
- GitHub Pages aanzetten voor de repository (Settings → Pages → Source: GitHub Actions).

Alle namen, cijfers en berichten in het prototype en de voorbeeldbestanden zijn placeholders.
