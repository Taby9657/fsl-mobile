/**
 * Volba dresů pro zápas.
 *
 * Oba týmy hrají v primární sadě. Když se barvy pletou, převleče se do
 * sekundární tým uvedený jako hostující. Pokud sekundární sadu nemá,
 * musí se to vyřešit na místě — vracíme proto i příznak `unresolvedClash`.
 */

interface TeamKit {
  color?: string | null;
  colorSecondary?: string | null;
}

function toRgb(hex?: string | null): [number, number, number] | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Hrubá vzdálenost barev v RGB. Na rozlišení dresů je to dost přesné. */
export function colorDistance(a?: string | null, b?: string | null): number {
  const ra = toRgb(a), rb = toRgb(b);
  if (!ra || !rb) return Number.POSITIVE_INFINITY;
  return Math.sqrt(
    (ra[0] - rb[0]) ** 2 + (ra[1] - rb[1]) ** 2 + (ra[2] - rb[2]) ** 2,
  );
}

/**
 * Pod touhle hranicí jsou barvy na dálku k nerozeznání.
 *
 * Nakalibrováno na paletě dresů: při 90 se za kolizní označí modrá/tyrkysová,
 * červená/růžová, fialová/indigo, modrá/indigo, zlatá/oranžová a zlatá/hnědá —
 * tedy přesně dvojice, které si na hřišti spletete. Zlatá s červenou
 * (vzdálenost 108) už kolizní není.
 */
export const KIT_CLASH_THRESHOLD = 90;

export function resolveMatchKits(home: TeamKit, away: TeamKit) {
  const homeKit    = home?.color ?? '#C9A140';
  const awayPrimary = away?.color ?? '#8B5CF6';

  const clash   = colorDistance(homeKit, awayPrimary) < KIT_CLASH_THRESHOLD;
  const awayKit = clash && away?.colorSecondary ? away.colorSecondary : awayPrimary;

  return {
    homeKit,
    awayKit,
    /** Hostující tým se převlékl do sekundární sady kvůli shodě barev. */
    awaySwitched: clash && !!away?.colorSecondary,
    /** Barvy se pletou a hostující tým sekundární sadu nemá. */
    unresolvedClash: clash && !away?.colorSecondary,
  };
}
