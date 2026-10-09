/**
 * Het island van de hero. Zoekt elk landschap in de pagina, tekent het meteen
 * volledig en zet daarna pas de animatie aan.
 *
 * Gedrag volgens docs/01-identiteit.md §7 en docs/02-bouwspecificatie.md §8:
 * - eerst een compleet stilstaand beeld; de animatie is een extraatje;
 * - de afspeelkop loopt in ~36 seconden van gisteren 00:00 tot "nu";
 * - hij volgt de muis (en de pijltjestoetsen, zodat het ook zonder muis werkt);
 * - buiten beeld stopt alles (IntersectionObserver);
 * - bij `prefers-reduced-motion: reduce` beweegt niets en staat de kop op "nu".
 */

import { gw, procent, tijd } from '../../lib/format';
import type { HeroData } from '../../lib/reeks';
import { GEEN_WAARDE, leesHeroData, momentIso, puntBij } from './reeks';
import { maakScene } from './tekenen';
import type { Scene } from './tekenen';

/** Secondes voor één ronde van gisteren 00:00 tot nu (tokens: `--hero-loop`). */
const RONDE_SECONDEN = 36;

function waardeveld(wortel: Element, naam: string): HTMLElement | null {
  const element = wortel.querySelector(`[data-hero-waarde="${naam}"]`);
  return element instanceof HTMLElement ? element : null;
}

function start(wortel: Element): void {
  const gevonden = wortel.querySelector('[data-hero-canvas]');
  if (!(gevonden instanceof HTMLCanvasElement)) return;
  const cv: HTMLCanvasElement = gevonden;
  const gelezen = leesHeroData(wortel.querySelector('[data-hero-data]'));
  if (gelezen === null) return;
  const data: HeroData = gelezen;

  let scene: Scene;
  try {
    scene = maakScene(cv, data);
  } catch {
    // Geen canvas-context: het tekstalternatief en het waardenvak staan al in de
    // pagina, dus er is niets stuk. Niets doen is hier het juiste.
    return;
  }

  const velden = {
    tijd: waardeveld(wortel, 'tijd'),
    dag: waardeveld(wortel, 'dag'),
    zon: waardeveld(wortel, 'zon'),
    wind: waardeveld(wortel, 'wind'),
    verbruik: waardeveld(wortel, 'verbruik'),
    dekking: waardeveld(wortel, 'dekking'),
  };

  const stil = window.matchMedia('(prefers-reduced-motion: reduce)');
  let rustig = stil.matches;

  let kop = rustig ? data.nuQ : Math.min(data.nuQ, data.dagQ * 0.55);
  let sleep: number | null = null;
  let klok = 0;
  let vorige = 0;
  let frame = 0;
  let inBeeld = true;

  function toon(v: number | null): string {
    return v === null ? GEEN_WAARDE : gw(v);
  }

  function waardenvak(q: number): void {
    const punt = puntBij(data, q);
    if (velden.tijd !== null) velden.tijd.textContent = tijd(momentIso(data, q));
    if (velden.dag !== null) velden.dag.textContent = q >= data.dagQ ? 'vandaag' : 'gisteren';
    if (velden.zon !== null) velden.zon.textContent = toon(punt.zon);
    if (velden.wind !== null) velden.wind.textContent = toon(punt.wind);
    if (velden.verbruik !== null) velden.verbruik.textContent = toon(punt.verbruik);
    if (velden.dekking !== null) {
      const { zon, wind, verbruik } = punt;
      velden.dekking.textContent =
        zon === null || wind === null || verbruik === null || verbruik <= 0
          ? GEEN_WAARDE
          : procent((zon + wind) / verbruik);
    }
  }

  function nu(): number {
    return sleep ?? kop;
  }

  function toonBeeld(): void {
    scene.render(nu(), klok);
    waardenvak(nu());
  }

  function stap(t: number): void {
    const dt = Math.min(0.05, Math.max(0, (t - vorige) / 1000));
    vorige = t;
    klok += dt;
    if (sleep === null) kop = (kop + (dt * data.nuQ) / RONDE_SECONDEN) % data.nuQ;
    scene.draaiMolens(dt);
    toonBeeld();
    frame = !rustig && inBeeld ? requestAnimationFrame(stap) : 0;
  }

  function aan(): void {
    if (rustig || !inBeeld || frame !== 0) return;
    vorige = performance.now();
    frame = requestAnimationFrame(stap);
  }

  function uit(): void {
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
  }

  function sleepNaar(ev: PointerEvent): void {
    const kader = cv.getBoundingClientRect();
    if (kader.width === 0) return;
    const deel = (ev.clientX - kader.left) / kader.width;
    sleep = Math.max(0, Math.min(data.nuQ, deel * Math.max(1, data.totaalQ - 1)));
    toonBeeld();
  }

  cv.addEventListener('pointermove', sleepNaar);
  cv.addEventListener('pointerdown', sleepNaar);
  cv.addEventListener('pointerleave', () => {
    if (sleep !== null) kop = sleep;
    sleep = null;
    toonBeeld();
    aan();
  });

  // Toetsenbord: dezelfde afspeelkop, in kwartieren of (met Shift) in uren.
  cv.addEventListener('keydown', (ev: KeyboardEvent) => {
    const groot = ev.shiftKey ? 4 : 1;
    let sprong = 0;
    if (ev.key === 'ArrowRight') sprong = groot;
    else if (ev.key === 'ArrowLeft') sprong = -groot;
    else if (ev.key === 'Home') sprong = -data.nuQ;
    else if (ev.key === 'End') sprong = data.nuQ;
    if (sprong === 0) return;
    ev.preventDefault();
    uit();
    sleep = Math.max(0, Math.min(data.nuQ, nu() + sprong));
    toonBeeld();
  });
  cv.addEventListener('blur', () => {
    if (sleep !== null) kop = sleep;
    sleep = null;
    toonBeeld();
    aan();
  });

  // Eerst het volledige stilstaande beeld; pas daarna beweging.
  scene.meet();
  toonBeeld();

  new ResizeObserver(() => {
    scene.meet();
    toonBeeld();
    aan();
  }).observe(cv);

  new IntersectionObserver((regels) => {
    inBeeld = regels.some((regel) => regel.isIntersecting);
    if (inBeeld) aan();
    else uit();
  }).observe(cv);

  stil.addEventListener('change', (ev) => {
    rustig = ev.matches;
    if (rustig) {
      uit();
      kop = data.nuQ;
      sleep = null;
      toonBeeld();
    } else {
      aan();
    }
  });

  aan();
}

export function startLandschap(): void {
  for (const wortel of document.querySelectorAll('[data-hero]')) start(wortel);
}
