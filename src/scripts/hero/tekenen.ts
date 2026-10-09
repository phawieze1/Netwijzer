/**
 * Het landschap tekenen. Eén `render()` zet het hele beeld neer, zodat een
 * stilstaand beeld altijd compleet is (bouwspecificatie §8): animatie verschuift
 * alleen de afspeelkop, de molenbladen en de wolkenstreken.
 *
 * Alles komt uit de reeks. Waar geen meting is, komt mist — geen lijn, geen molen,
 * geen lichtje. Elementen en regels staan in docs/01-identiteit.md §7.
 */

import { gw, tijd } from '../../lib/format';
import type { HeroAnnotatie, HeroData } from '../../lib/reeks';
import { INK_DONKER, INK_LICHT, klok, MIST_LIJN, MIST_TEKST, mix, PALET, rgb } from './palet';
import type { Rgb } from './palet';
import { bij, daglicht, gaten, momentIso, puntBij, segmenten, uurVanDag } from './reeks';
import type { Segment } from './reeks';

/** Vaste schaal van de zonnebaan, met de schaallijnen uit identiteit §7. */
const ZON_SCHAAL = 8;
const ZON_LIJNEN = [2, 4, 6];

/** De landlijn is niet op schaal (identiteit §7): dit venster bepaalt het reliëf. */
const LAND_BASIS = 9;
const LAND_VENSTER = 8;

/** Eén molen per 3 uur op desktop, per 6 uur op mobiel. */
const MOLEN_STAP_BREED = 12;
const MOLEN_STAP_SMAL = 24;
const MOBIEL = 640;

interface Molen {
  q: number;
  hoek: number;
  wind: number;
}

interface Lichtje {
  x: number;
  y: number;
  k: number;
}

interface Ster {
  x: number;
  y: number;
  r: number;
  fase: number;
}

interface Streek {
  x: number;
  y: number;
  lengte: number;
  snelheid: number;
}

export interface Scene {
  /** Canvasmaat en alles wat van de maat afhangt opnieuw bepalen. */
  meet(): void;
  /** Het hele beeld tekenen op positie `q` (kwartieren), met animatieklok `tt`. */
  render(q: number, tt: number): void;
  /** Molenbladen een stap verder draaien, met de wind van dat moment. */
  draaiMolens(dt: number): void;
}

/** Vaste, herhaalbare willekeur: hetzelfde landschap bij elke render. */
function stroom(zaad: number): () => number {
  let s = zaad >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export function maakScene(cv: HTMLCanvasElement, data: HeroData): Scene {
  const ctx = cv.getContext('2d');
  if (ctx === null) throw new Error('Geen 2d-context');
  const tekenvlak: CanvasRenderingContext2D = ctx;

  let W = 0;
  let H = 0;
  let molens: Molen[] = [];
  let molenPiek: HeroAnnotatie | null = null;
  let fData = 'monospace';
  let fBody = 'sans-serif';
  let fDisplay = 'serif';

  const r = stroom(11);
  const sterren: Ster[] = Array.from({ length: 80 }, () => ({
    x: r(),
    y: r() * 0.55,
    r: 0.4 + r() * 1.1,
    fase: r() * 6,
  }));
  const lichtjes: Lichtje[] = Array.from({ length: 700 }, () => ({ x: r(), y: r(), k: r() }));
  const streken: Streek[] = Array.from({ length: 26 }, () => ({
    x: r(),
    y: 0.12 + r() * 0.42,
    lengte: 0.03 + r() * 0.07,
    snelheid: 0.6 + r() * 0.8,
  }));

  const laatsteAs = Math.max(1, data.totaalQ - 1);
  const zonSegmenten = segmenten(data.zon, data.laatsteQ);
  const landSegmenten = segmenten(data.verbruik, data.laatsteQ);
  const mistGaten = gaten(data);
  const zonTop = zonSegmenten.reduce((top, segment) => {
    let hoogste = top;
    for (let i = segment.van; i <= segment.tot; i++) hoogste = Math.max(hoogste, bij(data.zon, i) ?? 0);
    return hoogste;
  }, 1);

  const X = (q: number): number => (q / laatsteAs) * W;
  const grond = (): number => H * 0.78;
  const yZon = (v: number): number => grond() - 8 - (v / ZON_SCHAAL) * (grond() - 40);
  const yLand = (v: number): number =>
    grond() - (H * 0.05 + (Math.max(0, v - LAND_BASIS) / LAND_VENSTER) * H * 0.17);
  const torenHoogte = (): number => Math.min(H * 0.17, 120);

  function meet(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const kader = cv.getBoundingClientRect();
    W = Math.max(1, kader.width);
    H = Math.max(1, kader.height);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    tekenvlak.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Lettertypes uit de tokens; canvas kan geen CSS-variabele gebruiken.
    const stijl = getComputedStyle(cv);
    fData = stijl.getPropertyValue('--f-data').trim() || fData;
    fBody = stijl.getPropertyValue('--f-body').trim() || fBody;
    fDisplay = stijl.getPropertyValue('--f-display').trim() || fDisplay;

    const stap = W < MOBIEL ? MOLEN_STAP_SMAL : MOLEN_STAP_BREED;
    molens = [];
    for (let q = stap / 2; q < data.nuQ; q += stap) {
      const index = Math.min(data.laatsteQ, Math.round(q));
      const wind = bij(data.wind, index);
      if (wind === null) continue;
      molens.push({ q, hoek: r() * 6.28, wind });
    }
    molenPiek = bepaalMolenPiek();
  }

  function bepaalMolenPiek(): HeroAnnotatie | null {
    let beste: Molen | null = null;
    for (const molen of molens) if (beste === null || molen.wind > beste.wind) beste = molen;
    if (beste === null) return null;
    const tijdstip = tijdLabel(beste.q);
    return {
      q: beste.q,
      regels: [
        'Hardst draaiende molen',
        `${gw(beste.wind)} wind, ${beste.q >= data.dagQ ? 'vandaag' : 'gisteren'} ${tijdstip}`,
      ],
    };
  }

  /** Tijd bij een kwartierpositie, in Europe/Amsterdam via `src/lib/format.ts`. */
  function tijdLabel(q: number): string {
    return tijd(momentIso(data, q));
  }

  function draaiMolens(dt: number): void {
    for (const molen of molens) molen.hoek += dt * molen.wind * 0.55;
  }

  // -------------------------------------------------------------- onderdelen

  function tekenLucht(licht: number, uur: number): Rgb {
    const gy = grond();
    const schemer = Math.max(klok(uur, data.zonop, 0.7), klok(uur, data.zononder, 0.7));
    const boven = mix(PALET.nightTop, PALET.dayTop, licht);
    const onder = mix(mix(PALET.nightBottom, PALET.dayBottom, licht), PALET.dusk, schemer * 0.75);
    const lucht = tekenvlak.createLinearGradient(0, 0, 0, gy);
    lucht.addColorStop(0, rgb(boven));
    lucht.addColorStop(1, rgb(onder));
    tekenvlak.fillStyle = lucht;
    tekenvlak.fillRect(0, 0, W, gy + 1);
    return onder;
  }

  function tekenSterren(licht: number, tt: number): void {
    if (licht >= 0.95) return;
    const gy = grond();
    for (const ster of sterren) {
      const helder = (1 - licht) * (0.5 + 0.5 * Math.sin(tt * 1.3 + ster.fase));
      tekenvlak.fillStyle = rgb(PALET.dayBottom, Number(helder.toFixed(3)));
      tekenvlak.beginPath();
      tekenvlak.arc(ster.x * W, ster.y * gy, ster.r, 0, 6.283);
      tekenvlak.fill();
    }
  }

  function tekenSchaallijnen(inkt: Rgb): void {
    tekenvlak.font = `10px ${fData}`;
    tekenvlak.textAlign = 'right';
    tekenvlak.textBaseline = 'bottom';
    for (const v of ZON_LIJNEN) {
      const y = yZon(v);
      tekenvlak.strokeStyle = rgb(inkt, 0.14);
      tekenvlak.setLineDash([2, 5]);
      tekenvlak.beginPath();
      tekenvlak.moveTo(0, y);
      tekenvlak.lineTo(W, y);
      tekenvlak.stroke();
      tekenvlak.setLineDash([]);
      tekenvlak.fillStyle = rgb(inkt, 0.55);
      tekenvlak.fillText(`${v} GW zon`, W - 10, y - 3);
    }
  }

  /** Doorloopt één segment en legt het pad aan; `tot nu` rekt het laatste stuk tot "nu". */
  function zetPad(segment: Segment, y: (index: number) => number): void {
    tekenvlak.beginPath();
    for (let i = segment.van; i <= segment.tot; i++) {
      const x = X(i);
      if (i === segment.van) tekenvlak.moveTo(x, y(i));
      else tekenvlak.lineTo(x, y(i));
    }
    if (segment.tot === data.laatsteQ && data.nuQ > segment.tot) tekenvlak.lineTo(X(data.nuQ), y(segment.tot));
  }

  function tekenZonnebaan(): void {
    const gy = grond();
    for (const segment of zonSegmenten) {
      const y = (i: number): number => yZon(bij(data.zon, i) ?? 0);
      zetPad(segment, y);
      const eindeX = segment.tot === data.laatsteQ && data.nuQ > segment.tot ? X(data.nuQ) : X(segment.tot);
      tekenvlak.lineTo(eindeX, gy);
      tekenvlak.lineTo(X(segment.van), gy);
      tekenvlak.closePath();
      const vulling = tekenvlak.createLinearGradient(0, yZon(zonTop), 0, gy);
      vulling.addColorStop(0, rgb(PALET.sun, 0.3));
      vulling.addColorStop(1, rgb(PALET.sun, 0.04));
      tekenvlak.fillStyle = vulling;
      tekenvlak.fill();

      zetPad(segment, y);
      tekenvlak.strokeStyle = rgb(PALET.sun, 0.9);
      tekenvlak.lineWidth = 2;
      tekenvlak.stroke();
    }
  }

  function tekenStreken(inkt: Rgb, wind: number | null, tt: number): void {
    if (wind === null) return;
    const gy = grond();
    tekenvlak.lineWidth = 1;
    for (const streek of streken) {
      const x = ((streek.x + tt * 0.018 * streek.snelheid * wind) % 1) * W * 1.2 - W * 0.1;
      const y = streek.y * gy;
      const lengte = streek.lengte * W * (0.5 + wind / 5);
      tekenvlak.strokeStyle = rgb(inkt, Number((0.1 + wind * 0.03).toFixed(2)));
      tekenvlak.beginPath();
      tekenvlak.moveTo(x, y);
      tekenvlak.lineTo(x + lengte, y);
      tekenvlak.stroke();
    }
  }

  function tekenZon(q: number, zon: number): void {
    const x = X(q);
    const y = yZon(zon);
    const gloed = tekenvlak.createRadialGradient(x, y, 0, x, y, 46);
    gloed.addColorStop(0, rgb(PALET.sun, 0.55));
    gloed.addColorStop(1, rgb(PALET.sun, 0));
    tekenvlak.fillStyle = gloed;
    tekenvlak.beginPath();
    tekenvlak.arc(x, y, 46, 0, 6.283);
    tekenvlak.fill();
    tekenvlak.fillStyle = rgb(mix(PALET.sun, PALET.window, 0.4));
    tekenvlak.beginPath();
    tekenvlak.arc(x, y, 12, 0, 6.283);
    tekenvlak.fill();
  }

  function tekenMolens(licht: number): void {
    const kleur = rgb(mix(PALET.millNight, PALET.mill, licht));
    const toren = torenHoogte();
    const blad = toren * 0.42;
    for (const molen of molens) {
      const index = Math.min(data.laatsteQ, Math.round(molen.q));
      const verbruik = bij(data.verbruik, index);
      const voet = (verbruik === null ? grond() - H * 0.05 : yLand(verbruik)) + 6;
      const as = voet - toren;
      const x = X(molen.q);
      tekenvlak.strokeStyle = kleur;
      tekenvlak.lineWidth = 2;
      tekenvlak.beginPath();
      tekenvlak.moveTo(x, voet);
      tekenvlak.lineTo(x, as);
      tekenvlak.stroke();
      tekenvlak.lineWidth = 1.6;
      tekenvlak.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const hoek = molen.hoek + k * 2.0944;
        tekenvlak.beginPath();
        tekenvlak.moveTo(x, as);
        tekenvlak.lineTo(x + Math.cos(hoek) * blad, as + Math.sin(hoek) * blad);
        tekenvlak.stroke();
      }
      tekenvlak.lineCap = 'butt';
      tekenvlak.fillStyle = kleur;
      tekenvlak.beginPath();
      tekenvlak.arc(x, as, 2.4, 0, 6.283);
      tekenvlak.fill();
    }
  }

  function tekenLand(licht: number): Rgb {
    const gy = grond();
    const kleur = mix(PALET.landNight, PALET.land, licht);
    tekenvlak.fillStyle = rgb(kleur);
    for (const segment of landSegmenten) {
      const y = (i: number): number => yLand(bij(data.verbruik, i) ?? LAND_BASIS);
      zetPad(segment, y);
      const laatsteSegment = segment.tot === data.laatsteQ;
      const eindeX = laatsteSegment && data.nuQ > segment.tot ? X(data.nuQ) : X(segment.tot);
      if (laatsteSegment) {
        // Vlakke voortzetting onder de mist, zodat de horizon doorloopt.
        tekenvlak.lineTo(W, gy - H * 0.05);
        tekenvlak.lineTo(W, gy + 1);
      } else {
        tekenvlak.lineTo(eindeX, gy + 1);
      }
      tekenvlak.lineTo(X(segment.van), gy + 1);
      tekenvlak.closePath();
      tekenvlak.fill();
    }
    return kleur;
  }

  function tekenLichtjes(licht: number): void {
    const gy = grond();
    for (const lichtje of lichtjes) {
      const q = lichtje.x * laatsteAs;
      if (q > data.nuQ) continue;
      const verbruik = puntBij(data, q).verbruik;
      if (verbruik === null) continue;
      const dichtheid = (verbruik - 9.5) / 7;
      if (dichtheid <= 0 || lichtje.k > dichtheid) continue;
      const top = yLand(verbruik);
      const y = top + 6 + lichtje.y * (gy - top - 10);
      tekenvlak.fillStyle = rgb(PALET.window, (0.18 + 0.75 * (1 - licht)) * (0.5 + (0.5 * lichtje.k) / dichtheid));
      tekenvlak.fillRect(lichtje.x * W, y, 2, 2);
    }
  }

  function tekenWater(licht: number, luchtOnder: Rgb, landKleur: Rgb, q: number, tt: number): void {
    const gy = grond();
    const kleur = mix(PALET.waterNight, PALET.water, licht);
    const vulling = tekenvlak.createLinearGradient(0, gy, 0, H);
    vulling.addColorStop(0, rgb(mix(kleur, luchtOnder, 0.35)));
    vulling.addColorStop(1, rgb(kleur));
    tekenvlak.fillStyle = vulling;
    tekenvlak.fillRect(0, gy, W, H - gy);

    tekenvlak.fillStyle = rgb(landKleur, 0.35);
    for (const segment of landSegmenten) {
      tekenvlak.beginPath();
      tekenvlak.moveTo(X(segment.van), gy);
      for (let i = segment.van; i <= segment.tot; i++) {
        const verbruik = bij(data.verbruik, i) ?? LAND_BASIS;
        tekenvlak.lineTo(X(i), gy + (gy - yLand(verbruik)) * 0.35);
      }
      tekenvlak.lineTo(X(segment.tot), gy);
      tekenvlak.closePath();
      tekenvlak.fill();
    }

    const zon = puntBij(data, q).zon;
    if (zon !== null && zon > 0.03) {
      const x = X(q);
      for (let k = 0; k < 7; k++) {
        const y = gy + 8 + k * 7;
        const breed = (18 - k * 2) * (1 + 0.3 * Math.sin(tt * 3 + k));
        tekenvlak.fillStyle = rgb(PALET.sun, 0.5 - k * 0.06);
        tekenvlak.fillRect(x - breed / 2, y, breed, 1.5);
      }
    }
  }

  /** Mistband met zachte randen; voor elk gat in de reeks. */
  function mistBand(x0: number, x1: number): void {
    const breedte = Math.max(2, x1 - x0);
    const rand = Math.min(24, breedte / 2);
    const band = tekenvlak.createLinearGradient(x0 - rand, 0, x1 + rand, 0);
    band.addColorStop(0, rgb(PALET.mist, 0));
    band.addColorStop(Math.min(0.49, rand / (breedte + 2 * rand)), rgb(PALET.mist, 0.78));
    band.addColorStop(Math.max(0.51, 1 - rand / (breedte + 2 * rand)), rgb(PALET.mist, 0.78));
    band.addColorStop(1, rgb(PALET.mist, 0));
    tekenvlak.fillStyle = band;
    tekenvlak.fillRect(x0 - rand, 0, breedte + 2 * rand, H);
  }

  function tekenMist(): void {
    const gy = grond();
    const xNu = X(data.nuQ);

    for (const gat of mistGaten) mistBand(X(gat.van) - 3, X(gat.tot) + 3);

    const zacht = Math.min(90, Math.max(20, W * 0.08));
    const band = tekenvlak.createLinearGradient(xNu, 0, Math.min(W, xNu + zacht), 0);
    band.addColorStop(0, rgb(PALET.mist, 0));
    band.addColorStop(1, rgb(PALET.mist, 0.86));
    tekenvlak.fillStyle = band;
    tekenvlak.fillRect(xNu, 0, W - xNu, H);
    tekenvlak.fillStyle = rgb(PALET.mist, 0.86);
    tekenvlak.fillRect(Math.min(W, xNu + zacht), 0, Math.max(0, W - xNu - zacht), H);

    tekenvlak.strokeStyle = rgb(MIST_LIJN, 0.6);
    tekenvlak.lineWidth = 1;
    tekenvlak.setLineDash([3, 4]);
    tekenvlak.beginPath();
    tekenvlak.moveTo(xNu, gy);
    tekenvlak.lineTo(W, gy);
    tekenvlak.stroke();
    tekenvlak.setLineDash([]);

    if (W - xNu > 110) {
      tekenvlak.fillStyle = rgb(MIST_TEKST, 0.85);
      tekenvlak.font = `italic 15px ${fDisplay}`;
      tekenvlak.textAlign = 'center';
      tekenvlak.textBaseline = 'middle';
      tekenvlak.fillText('nog niet gemeten', (xNu + W) / 2 + 20, gy * 0.55);
    }
  }

  function tekenTijdas(inkt: Rgb): void {
    const gy = grond();
    const xMidden = X(data.dagQ);
    tekenvlak.strokeStyle = rgb(inkt, 0.35);
    tekenvlak.lineWidth = 1;
    tekenvlak.setLineDash([1, 4]);
    tekenvlak.beginPath();
    tekenvlak.moveTo(xMidden, 10);
    tekenvlak.lineTo(xMidden, gy);
    tekenvlak.stroke();
    tekenvlak.setLineDash([]);

    tekenvlak.font = `500 10px ${fData}`;
    tekenvlak.textAlign = 'left';
    tekenvlak.textBaseline = 'top';
    tekenvlak.fillStyle = rgb(inkt, 0.7);
    tekenvlak.fillText('VANDAAG →', xMidden + 8, 12);

    tekenvlak.font = `10px ${fData}`;
    tekenvlak.textBaseline = 'alphabetic';
    const laatsteIndex = data.asLabels.length - 1;
    data.asLabels.forEach((label, index) => {
      if (W < MOBIEL && index % 2 === 1) return;
      const x = X(Math.min(label.q, laatsteAs));
      tekenvlak.textAlign = index === 0 ? 'left' : index === laatsteIndex ? 'right' : 'center';
      const gemeten = label.q <= data.nuQ;
      tekenvlak.fillStyle = rgb(gemeten ? PALET.dayBottom : MIST_LIJN, gemeten ? 0.75 : 0.8);
      const dx = index === 0 ? 8 : index === laatsteIndex ? -8 : 0;
      tekenvlak.fillText(label.tekst, x + dx, H - 12);
    });
  }

  function tekenNu(): void {
    const verbruik = puntBij(data, data.laatsteQ).verbruik;
    const xNu = X(data.nuQ);
    const y = verbruik === null ? grond() - H * 0.05 : yLand(verbruik);
    tekenvlak.fillStyle = rgb(PALET.playhead);
    tekenvlak.beginPath();
    tekenvlak.arc(xNu, y, 4, 0, 6.283);
    tekenvlak.fill();
    tekenvlak.font = `500 11px ${fData}`;
    tekenvlak.textAlign = 'left';
    tekenvlak.textBaseline = 'bottom';
    tekenvlak.fillText(`nu ${data.nuLabel}`, xNu + 7, y - 6);
  }

  function tekenAfspeelkop(q: number): void {
    const x = X(q);
    tekenvlak.strokeStyle = rgb(PALET.playhead, 0.9);
    tekenvlak.lineWidth = 1.5;
    tekenvlak.beginPath();
    tekenvlak.moveTo(x, 8);
    tekenvlak.lineTo(x, H - 28);
    tekenvlak.stroke();
  }

  function schrijf(x: number, y: number, regels: readonly string[], inkt: Rgb, align: CanvasTextAlign): void {
    tekenvlak.font = `500 11px ${fBody}`;
    tekenvlak.textAlign = align;
    tekenvlak.textBaseline = 'alphabetic';
    regels.forEach((regel, i) => {
      tekenvlak.fillStyle = rgb(inkt, i === 0 ? 0.95 : 0.7);
      tekenvlak.fillText(regel, x, y + i * 14);
    });
  }

  function tekenAnnotaties(inkt: Rgb): void {
    tekenvlak.strokeStyle = rgb(inkt, 0.5);
    tekenvlak.lineWidth = 1;

    const zonpiek = data.zonpiek;
    if (zonpiek !== null) {
      const v = bij(data.zon, zonpiek.q);
      if (v !== null) {
        const x = X(zonpiek.q);
        const y = yZon(v);
        tekenvlak.beginPath();
        tekenvlak.moveTo(x, y - 8);
        tekenvlak.lineTo(x, y - 22);
        tekenvlak.stroke();
        schrijf(x + 6, y - 26, zonpiek.regels, inkt, 'left');
      }
    }

    const avondpiek = data.avondpiek;
    if (avondpiek !== null && W >= MOBIEL) {
      const v = bij(data.verbruik, avondpiek.q);
      if (v !== null) {
        const x = X(avondpiek.q);
        const y = yLand(v);
        tekenvlak.beginPath();
        tekenvlak.moveTo(x, y - 4);
        tekenvlak.lineTo(x - 24, y - 14);
        tekenvlak.stroke();
        schrijf(x - 28, y - 18, avondpiek.regels, inkt, 'right');
      }
    }

    if (molenPiek !== null) {
      const x = X(molenPiek.q);
      if (x >= W * 0.22) {
        const index = Math.min(data.laatsteQ, Math.round(molenPiek.q));
        const verbruik = bij(data.verbruik, index);
        const toren = torenHoogte();
        const voet = (verbruik === null ? grond() - H * 0.05 : yLand(verbruik)) + 6;
        schrijf(x, voet - toren - toren * 0.45 - 10, molenPiek.regels, inkt, 'center');
      }
    }
  }

  function render(q: number, tt: number): void {
    if (W === 0 || H === 0) meet();
    const positie = Math.max(0, Math.min(data.nuQ, q));
    const uur = uurVanDag(data, positie);
    const licht = daglicht(data, uur);
    const nu = puntBij(data, positie);
    const inkt = licht > 0.5 ? INK_DONKER : INK_LICHT;

    tekenvlak.clearRect(0, 0, W, H);
    const luchtOnder = tekenLucht(licht, uur);
    tekenSterren(licht, tt);
    tekenSchaallijnen(inkt);
    tekenZonnebaan();
    tekenStreken(inkt, nu.wind, tt);
    if (nu.zon !== null && nu.zon > 0.03) tekenZon(positie, nu.zon);
    tekenMolens(licht);
    const landKleur = tekenLand(licht);
    tekenLichtjes(licht);
    tekenWater(licht, luchtOnder, landKleur, positie, tt);
    tekenMist();
    tekenTijdas(inkt);
    tekenNu();
    tekenAfspeelkop(positie);
    tekenAnnotaties(inkt);
  }

  return { meet, render, draaiMolens };
}
