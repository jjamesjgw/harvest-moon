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

// Some race names repeat across the season — two different tracks host a race
// with the same sponsor title — so the name alone can't identify the article.
// Wikipedia files each colliding race at a track-parenthesized title and makes
// the bare title a disambiguation page, so BOTH weeks need an explicit slug
// (the bare slug would hit the disambiguation page and silently never ingest).
// Keyed by track — which the ingest always has from the schedule row — rather
// than wk, so a mid-season schedule shift renumbering the weeks can't
// mis-target it (the reason the old scheduleOverrides[wk] hint went stale).
const SLUG_BY_TRACK = {
  // 2026: wk 7 Martinsville (Mar 29) and wk 25 Richmond (Aug 15) are both
  // "Cook Out 400". Confirmed article titles:
  //   en.wikipedia.org/wiki/2026_Cook_Out_400_(Martinsville)
  //   en.wikipedia.org/wiki/2026_Cook_Out_400_(Richmond)
  'Cook Out 400': {
    Martinsville: 'Cook_Out_400_(Martinsville)',
    Richmond: 'Cook_Out_400_(Richmond)',
  },
};

// Build the article slug from a race's name + track. A per-wk override
// (state.scheduleOverrides[wk].wikiSlug) still wins if present; otherwise a
// known name collision is disambiguated by track, falling back to the bare
// "<year>_<Race_Name>" for the common unique-name case.
export function deriveWikiSlug(raceName, year, override, track) {
  if (override) return override;
  const disambiguated = track && SLUG_BY_TRACK[raceName]?.[track];
  const namePart = disambiguated || raceName.replace(/\s+/g, '_');
  return `${year}_${namePart}`;
}

// Fetch parsed article HTML via Wikipedia's parse API. Returns either
// { ok: true, html } or { ok: false, reason } so callers can surface
// the failure mode (missing page vs. transport error).
//
// 8s timeout is well below Vercel's serverless function limit (10s on
// Hobby, 60s on Pro) so a hung Wikipedia connection surfaces as a
// structured `wiki-timeout` instead of a raw 504 with no app-level
// breadcrumb. The route handler logs the reason and skips cleanly, and
// the next cron tick can retry without the silent gap (#46).
export async function fetchArticleHtml(slug) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(slug)}&prop=text&format=json&formatversion=2`;
  let res;
  try {
    res = await fetch(url, {
      headers: { 'user-agent': 'harvest-moon-fantasy/1.0 (https://github.com/jjamesjgw/harvest-moon)' },
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      return { ok: false, reason: 'wiki-timeout' };
    }
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
  // Match through </table> rather than </tbody>: Wikipedia's parse API
  // doesn't guarantee a serialized <tbody> across all editor formatting
  // choices, and a missing close tag would make this regex return null,
  // routing to `no-final-table` — indistinguishable from "race not posted
  // yet." </table> is the structural container and is always present
  // (#47). The captured group may now include a trailing </tbody> before
  // the </table>, but the row regex below only matches <tr>...</tr>
  // blocks so extraneous tags are ignored.
  const tableMatch = after.match(/<table[^>]*class="wikitable"[^>]*>([\s\S]*?)<\/table>/);
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
