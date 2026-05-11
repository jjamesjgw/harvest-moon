// Wikipedia-backed race results fetcher. Used by /api/ingest-results to
// auto-publish weekly NASCAR Cup results without the admin pasting numbers.
//
// Wikipedia is the source because jayski + nascar.com are both behind
// Cloudflare's bot challenge (`cf-mitigated: challenge` in response
// headers), which a Vercel serverless function cannot solve. Wikipedia
// is open + CC-BY-SA, so the legal footing is clean too.
//
// Every Cup race article has a "Final Stage Results" section whose first
// wikitable holds the per-driver totals. Columns are consistent across
// races: Pos | Grid | No | Driver | Team | Manufacturer | Laps | Points.
// The "Points" column is the total race points awarded (finish position +
// stage points + winner bonus) which is exactly what the league's
// driverPoints["Cup:NUM"] map needs.

// Build the article slug from a raceName. Allows per-wk overrides for
// disambiguated races — e.g. wk 7 and wk 24 are both named "Cook Out 400"
// so wk 24 needs `state.scheduleOverrides[24].wikiSlug = "2026_Cook_Out_400_(Richmond)"`.
export function deriveWikiSlug(raceName, year, override) {
  if (override) return override;
  return `${year}_${raceName.replace(/\s+/g, '_')}`;
}

// Fetch parsed article HTML via Wikipedia's parse API. Returns either
// { ok: true, html } or { ok: false, reason } so callers can surface
// the failure mode (missing page vs. transport error).
export async function fetchArticleHtml(slug) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(slug)}&prop=text&format=json&formatversion=2`;
  let res;
  try {
    res = await fetch(url, {
      headers: { 'user-agent': 'harvest-moon-fantasy/1.0 (https://github.com/jjamesjgw/harvest-moon)' },
    });
  } catch (e) {
    return { ok: false, reason: `wiki-fetch-failed: ${e.message || 'unknown'}` };
  }
  if (!res.ok) return { ok: false, reason: `wiki-http-${res.status}` };
  const data = await res.json().catch(() => null);
  if (!data) return { ok: false, reason: 'wiki-bad-json' };
  if (data.error) return { ok: false, reason: `wiki-${data.error.code || 'error'}` };
  const html = data?.parse?.text;
  if (typeof html !== 'string') return { ok: false, reason: 'wiki-no-text' };
  return { ok: true, html };
}

// Parse the Final Stage Results table out of a race article. Returns
// { final: true, results: [{ carNum, points }] } when the section + table
// exist. Returns { final: false, reason } when the race isn't published
// yet (Wikipedia editors take some hours after the checkered flag).
//
// Heading id varies between "Final_Stage_Results" and "Final_Stage_results"
// across articles — editors aren't consistent. We match both.
export function parseFinalResults(html) {
  const sectionMatch = html.match(/<h3[^>]*id="Final_Stage_[Rr]esults"/);
  if (!sectionMatch) return { final: false, reason: 'no-final-stage-section' };

  const after = html.slice(sectionMatch.index);
  const tableMatch = after.match(/<table[^>]*class="wikitable"[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tableMatch) return { final: false, reason: 'no-final-table' };

  const results = [];
  const rowRe = /<tr>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRe.exec(tableMatch[1]))) {
    const cells = [...m[1].matchAll(/<td>\s*([\s\S]*?)\s*<\/td>/g)]
      .map(c => c[1].replace(/<[^>]+>/g, '').trim());
    if (cells.length < 8) continue;
    const carNum = parseInt(cells[2], 10);
    const points = parseInt(cells[7], 10);
    if (!Number.isFinite(carNum) || !Number.isFinite(points)) continue;
    results.push({ carNum, points });
  }

  if (results.length === 0) return { final: false, reason: 'final-table-no-rows' };
  return { final: true, results };
}

// Build the Cup driverPoints map shape the league state uses.
// Bonus series (Truck, OReilly, HighLimit) come from separate articles and
// are still entered manually by the admin.
export function buildCupDriverPoints(results) {
  const out = {};
  for (const r of results) out[`Cup:${r.carNum}`] = r.points;
  return out;
}
