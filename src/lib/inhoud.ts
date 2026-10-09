/**
 * Gedeelde toegang tot de content collections.
 *
 * Alle pagina's lezen hun gegevens hier, zodat sortering, koppeling en telling
 * overal hetzelfde werken. Schrijf deze logica niet opnieuw in een component.
 *
 * De peildatum is het moment van de build. De site wordt dagelijks opnieuw
 * gebouwd, dus "deze week" en "komende evenementen" kloppen met de dag waarop
 * de bezoeker kijkt. De hero gebruikt een andere "nu": die komt uit het veld
 * `tot` van data/reeksen/latest.json en niet van de klok.
 */

import { getCollection, type CollectionEntry } from 'astro:content';
import { naarSorteerDatum, dagenTussen } from './format.ts';
import { THEMA_SLUGS, type Thema } from './themas.ts';

export type Dataset = CollectionEntry<'datasets'>;
export type Bron = CollectionEntry<'bronnen'>;
export type Nieuwsbericht = CollectionEntry<'nieuws'>;
export type Evenement = CollectionEntry<'agenda'>;

/** Het moment waarop de site gebouwd wordt. */
export function peildatum(): Date {
  return new Date();
}

// ---------- ophalen en sorteren ----------

/** Alle datasets, alfabetisch op naam. */
export async function alleDatasets(): Promise<Dataset[]> {
  const items: Dataset[] = await getCollection('datasets');
  return items.sort((a, b) => a.data.naam.localeCompare(b.data.naam, 'nl'));
}

/** Alle bronnen, alfabetisch op naam. */
export async function alleBronnen(): Promise<Bron[]> {
  const items: Bron[] = await getCollection('bronnen');
  return items.sort((a, b) => a.data.naam.localeCompare(b.data.naam, 'nl'));
}

/** Alle nieuwsberichten, nieuwste eerst. */
export async function alleNieuws(): Promise<Nieuwsbericht[]> {
  const items: Nieuwsbericht[] = await getCollection('nieuws');
  return items.sort(
    (a, b) => naarSorteerDatum(b.data.gepubliceerd) - naarSorteerDatum(a.data.gepubliceerd),
  );
}

/** Alle evenementen, oplopend in de tijd. */
export async function alleEvenementen(): Promise<Evenement[]> {
  const items: Evenement[] = await getCollection('agenda');
  return items.sort((a, b) => naarSorteerDatum(a.data.start) - naarSorteerDatum(b.data.start));
}

// ---------- koppelingen ----------

/** Zoektabel van bronslug naar bron, om per dataset de leveranciersnaam te tonen. */
export async function bronnenPerSlug(): Promise<Map<string, Bron>> {
  const bronnen = await alleBronnen();
  return new Map(bronnen.map((bron) => [bron.data.slug, bron]));
}

/** De datasets van één bron, alfabetisch. */
export async function datasetsVanBron(bronSlug: string): Promise<Dataset[]> {
  const datasets = await alleDatasets();
  return datasets.filter((dataset) => dataset.data.leverancier === bronSlug);
}

/** Nieuwsberichten die expliciet aan deze dataset gekoppeld zijn, nieuwste eerst. */
export async function nieuwsVoorDataset(datasetSlug: string): Promise<Nieuwsbericht[]> {
  const berichten = await alleNieuws();
  return berichten.filter((bericht) => bericht.data.datasets?.includes(datasetSlug) ?? false);
}

/** De datasets waar een nieuwsbericht aan gekoppeld is. */
export async function datasetsVoorNieuws(bericht: Nieuwsbericht): Promise<Dataset[]> {
  const slugs = bericht.data.datasets ?? [];
  if (slugs.length === 0) return [];
  const datasets = await alleDatasets();
  return datasets.filter((dataset) => slugs.includes(dataset.data.slug));
}

/**
 * Vergelijkbare datasets: zelfde thema, zichzelf uitgesloten. Dezelfde
 * leverancier komt eerst, want dat is meestal het meest verwante.
 */
export async function vergelijkbareDatasets(dataset: Dataset, maximum = 4): Promise<Dataset[]> {
  const datasets = await alleDatasets();
  return datasets
    .filter((kandidaat) => kandidaat.data.slug !== dataset.data.slug)
    .filter((kandidaat) => kandidaat.data.thema === dataset.data.thema)
    .sort((a, b) => {
      const aZelfdeBron = a.data.leverancier === dataset.data.leverancier ? 0 : 1;
      const bZelfdeBron = b.data.leverancier === dataset.data.leverancier ? 0 : 1;
      return aZelfdeBron - bZelfdeBron;
    })
    .slice(0, maximum);
}

// ---------- agenda ----------

/** Evenementen die nog moeten komen, eerstvolgende eerst. */
export async function komendeEvenementen(vanaf: Date = peildatum()): Promise<Evenement[]> {
  const items = await alleEvenementen();
  const grens = vanaf.getTime();
  return items.filter((item) => naarSorteerDatum(item.data.eind ?? item.data.start) >= grens);
}

/** Evenementen die al geweest zijn, meest recente eerst. */
export async function afgelopenEvenementen(vanaf: Date = peildatum()): Promise<Evenement[]> {
  const items = await alleEvenementen();
  const grens = vanaf.getTime();
  return items
    .filter((item) => naarSorteerDatum(item.data.eind ?? item.data.start) < grens)
    .reverse();
}

// ---------- tellingen ----------

export type Kerncijfers = {
  datasets: number;
  bronnen: number;
  nieuwDezeWeek: number;
};

/**
 * De drie getallen in de hero. "Nieuw deze week" telt nieuwsberichten van de
 * afgelopen zeven dagen; staat er niets, dan tonen we het getal gewoon als 0 in
 * plaats van iets te verzinnen.
 */
export async function kerncijfers(vanaf: Date = peildatum()): Promise<Kerncijfers> {
  const [datasets, bronnen, nieuws] = await Promise.all([
    alleDatasets(),
    alleBronnen(),
    alleNieuws(),
  ]);

  const nieuwDezeWeek = nieuws.filter((bericht) => {
    const dagen = dagenTussen(new Date(naarSorteerDatum(bericht.data.gepubliceerd)), vanaf);
    return dagen >= 0 && dagen < 7;
  }).length;

  return { datasets: datasets.length, bronnen: bronnen.length, nieuwDezeWeek };
}

/** Hoeveel datasets er per thema zijn, in de vaste themavolgorde. */
export async function datasetsPerThema(): Promise<Array<{ thema: Thema; aantal: number }>> {
  const datasets = await alleDatasets();
  return THEMA_SLUGS.map((thema) => ({
    thema,
    aantal: datasets.filter((dataset) => dataset.data.thema === thema).length,
  }));
}

/**
 * Of er ergens voorbeeldcontent tussen zit. Zolang dat zo is moet de site dat
 * zichtbaar melden (harde regel).
 */
export async function bevatVoorbeeldcontent(): Promise<boolean> {
  const [datasets, bronnen, nieuws, agenda] = await Promise.all([
    alleDatasets(),
    alleBronnen(),
    alleNieuws(),
    alleEvenementen(),
  ]);
  const alles = [
    ...datasets.map((item) => item.data.voorbeeld),
    ...bronnen.map((item) => item.data.voorbeeld),
    ...nieuws.map((item) => item.data.voorbeeld),
    ...agenda.map((item) => item.data.voorbeeld),
  ];
  return alles.some((markering) => markering === true);
}
