/**
 * De vaste themalijst uit docs/03-content-en-agents.md §1, met de kleur per thema
 * uit docs/01-identiteit.md §3. Eén kleur per thema, overal hetzelfde: chips,
 * lijsten, grafieken, nieuwsrivier en agenda.
 *
 * Gebruik altijd `themaKleur()` en nooit een losse kleurwaarde.
 */

export const THEMAS = {
  opwek: { naam: 'Opwek', token: '--sun' },
  verbruik: { naam: 'Verbruik', token: '--verbruik' },
  net: { naam: 'Net & congestie', token: '--needle' },
  markt: { naam: 'Markt', token: '--wind' },
  geo: { naam: 'Geo & infra', token: '--geo' },
} as const;

export type Thema = keyof typeof THEMAS;

/** De vaste volgorde waarin thema's in chips en filters staan. */
export const THEMA_SLUGS = Object.keys(THEMAS) as Thema[];

export function themaNaam(thema: Thema): string {
  return THEMAS[thema].naam;
}

/** CSS-waarde voor een thema, bijvoorbeeld `var(--sun)`. */
export function themaKleur(thema: Thema): string {
  return `var(${THEMAS[thema].token})`;
}

export function isThema(waarde: string): waarde is Thema {
  return Object.hasOwn(THEMAS, waarde);
}
