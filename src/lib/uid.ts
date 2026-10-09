/**
 * Oplopende id's voor SVG-elementen die binnen één document uniek moeten zijn
 * (clipPath, mask, gradient). Module-scope, dus de teller loopt door over alle
 * renders in een build: binnen een pagina altijd uniek, en zonder willekeur zodat
 * de build reproduceerbaar blijft.
 */

const tellers = new Map<string, number>();

export function uid(voorvoegsel: string): string {
  const volgende = (tellers.get(voorvoegsel) ?? 0) + 1;
  tellers.set(voorvoegsel, volgende);
  return `${voorvoegsel}-${volgende}`;
}
