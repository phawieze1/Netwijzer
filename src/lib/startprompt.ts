/**
 * Vult het sjabloon uit agents/startprompt-dataset.md met de gegevens van een
 * dataset, voor het blok "Begin met een prompt" op de detailpagina
 * (docs/02-bouwspecificatie.md §6, punt 6).
 *
 * Het sjabloon in agents/ blijft de enige bron van waarheid: het wordt hier via
 * Vite's `?raw` ingelezen, dus een wijziging aan dat bestand verandert de site
 * zonder dat hier code aan te passen is.
 */

import sjabloonBestand from '../../agents/startprompt-dataset.md?raw';
import { frequentieLabel, type Frequentie } from './format.ts';

export type StartpromptDataset = {
  naam: string;
  /** Weergavenaam van de leverancier, niet de slug. */
  leverancier: string;
  frequentie: Frequentie;
  frequentieLabel?: string | undefined;
  eenheid?: string | undefined;
  sinds: number;
  formaat: 'API' | 'Bestand' | 'Kaart';
  toegang: 'open' | 'account';
  velden?: ReadonlyArray<{ naam: string }> | undefined;
  prompt?: { valkuilen?: readonly string[] | undefined } | undefined;
};

/** Het eerste afgebakende codeblok uit het sjabloonbestand. */
function haalSjabloon(markdown: string): string {
  const match = /```\r?\n([\s\S]*?)```/.exec(markdown);
  if (!match || match[1] === undefined) {
    throw new Error(
      'Kan het sjabloon niet vinden in agents/startprompt-dataset.md: er is geen codeblok (```) aangetroffen.',
    );
  }
  return match[1].trimEnd();
}

const SJABLOON = haalSjabloon(sjabloonBestand);

/** De zin over hoe je de data ophaalt, volgens de tabel in het sjabloonbestand. */
export function toegangZin(formaat: StartpromptDataset['formaat'], toegang: StartpromptDataset['toegang']): string {
  if (formaat === 'API') {
    return toegang === 'open' ? 'via de API' : 'via de API (ik heb een API-sleutel)';
  }
  if (formaat === 'Bestand') return 'als downloadbaar bestand (CSV)';
  return 'als kaartlaag (WFS/GeoJSON)';
}

/**
 * Vult het sjabloon. Ontbrekende gegevens worden eerlijk benoemd in plaats van
 * verzonnen: een dataset zonder gedocumenteerde velden of eenheid zegt dat.
 */
export function startprompt(dataset: StartpromptDataset): string {
  const veldnamen = dataset.velden?.map((veld) => veld.naam) ?? [];

  const vervangingen: Record<string, string> = {
    naam: dataset.naam,
    leverancier: dataset.leverancier,
    frequentieLabel: frequentieLabel(dataset.frequentie, dataset.frequentieLabel),
    eenheid: dataset.eenheid ?? 'niet vermeld bij de bron',
    sinds: String(dataset.sinds),
    'velden | join(", ")': veldnamen.length > 0 ? veldnamen.join(', ') : 'nog niet gedocumenteerd',
    toegangZin: toegangZin(dataset.formaat, dataset.toegang),
  };

  let tekst = SJABLOON.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_volledig: string, sleutel: string) => {
    const waarde = vervangingen[sleutel];
    if (waarde === undefined) {
      throw new Error(
        `Onbekend veld "${sleutel}" in agents/startprompt-dataset.md. Vul het aan in src/lib/startprompt.ts of pas het sjabloon aan.`,
      );
    }
    return waarde;
  });

  // Een dataset met eigen valkuilen vervangt de standaardtekst van stap 2
  // (zie de slotregel van agents/startprompt-dataset.md).
  const valkuilen = dataset.prompt?.valkuilen;
  if (valkuilen && valkuilen.length > 0) {
    const lijst = valkuilen.join('; ');
    tekst = tekst.replace(/^2\. .*$/m, `2. Let op deze bekende valkuilen: ${lijst}.`);
  }

  return tekst;
}
