/* play-tournament.js -- Task 4: the cup travels to play.html.
   Ported verbatim from index.html's two tournament <script> blocks (bracket core, then the
   bracket/teams/UI module -- order is load-bearing: the UI module opens with
   `var BR = window.__hmBracket; if (!BR) return;`). One addition ahead of both: window.__hmTint,
   the egghead-dye function index.html only registers as a side effect of wiring its
   "Add an egghead" button -- a button play.html's menu does not have (spec 3.2). See that
   block's own comment for why porting just the function, not the button, is correct here.
   Consumes: window.__hmSess (play-engine.js:1308), window.__hmFillerData/__hmFillerAdd/
   __hmSlotFor/__hmSlots/__hmKill (play-engine.js), window.__EGGHEAD (egghead-seed.js),
   window.__hmSoccerStart/__hmSoccerEnd (play-engine.js), #gameBtn and .hero (play.html markup),
   #tHeadEdge (play.html's inline SVG filter defs). Produces: window.__hmTourStart, __hmTourStop,
   __hmTour, __hmTourWin, __hmTourAbort, window.__hmBracket, window.__hmChampFx, window.__hmTint. */

(function(){   // ===== TOURNAMENT: egghead dye, ported from index.html's "Add an egghead" module =====
// index.html registers window.__hmTint as a side effect of wiring the #addPlaceholder button
// (index.html:2717-2733). play.html's menu deliberately drops that button (spec 3.2 -- Task 3's
// gameMenu has no addPlaceholder, no #moodHeads, no "Show on home" toggle), but the tournament's
// squad-padding step (below, "no egg art: field the captain alone...") still calls
// window.__hmTint to dye spare eggheads into a team's colour. Without it, every team here would
// fall back to a captain-only roster -- fielding the same lone head that index.html only takes
// when EGG or __hmTint is missing entirely. So just the dye function is ported, standalone, with
// no COLORS bag and no button: nothing else in this module needs the "silly random new egghead"
// picker, only the ability to recolour the ONE egghead egghead-seed.js already ships.
function tint(cut,color,cb){var img=new Image();
 img.onload=function(){try{
  var w=img.naturalWidth||500,h=img.naturalHeight||600,c=document.createElement("canvas");c.width=w;c.height=h;var g=c.getContext("2d");
  g.drawImage(img,0,0,w,h);
  g.globalCompositeOperation="multiply";g.fillStyle=color;g.fillRect(0,0,w,h);   // dye the egg this colour, keeping every fold of its shading
  g.globalCompositeOperation="destination-in";g.drawImage(img,0,0,w,h);          // clip the flat dye back to the egg's own silhouette
  g.globalCompositeOperation="source-over";
  var out=c.toDataURL("image/webp",0.9);if(out.indexOf("data:image/webp")!==0)out=c.toDataURL("image/png");
  cb(out);
 }catch(_){cb(cut);}};
 img.onerror=function(){cb(cut);};img.src=cut;}
window.__hmTint=window.__hmTint||tint;   // guarded: harmless if some future page already defines it
})();

(function(){   // ===== TOURNAMENT: league core =====
// A LEAGUE, NOT A BRACKET, and the reason is the one thing Jayden complained about.
//
//   "The seeds don't really make sense -- like who is 1 and 8, and what does that mean.
//    Also we need to increase the head amount to 12 and the tournament mode, for the
//    fantasy football league."
//
// He is right, and the seed was not a labelling mistake -- it was a claim the data could
// not support. The competitors are randomly dyed eggheads drawn in a random order. A seed
// says "this one earned first place before a ball was kicked", and nothing here ever
// earned anything, so "1 v 8" was decoration wearing the clothes of information. A bracket
// cannot be fixed by renaming its seeds, because a bracket NEEDS a prior ranking to decide
// who meets whom; without one the whole first round is arbitrary and the shape of the cup
// is arbitrary with it.
//
// A LEAGUE TABLE HAS THE OPPOSITE PROPERTY. A position in it is a consequence of matches
// that were played, so the number is earned by the time you read it. Seeds become
// standings: the same 1..12 column, now meaning something. That is the whole design.
//
// The alternative considered and rejected was a 16-slot bracket with four byes -- which is
// exactly the phantom-round problem the field was cut from twelve to eight to avoid ("What's
// the round of 16? There are only 8 players"). Padding twelve teams back up to sixteen would
// have reinstated it.
//
// WHAT THIS CORE IS. Pure functions, no DOM, so the schedule and the table can be reasoned
// about (and driven) without a browser.
//
//  * THE SCHEDULE is the circle method: fix one team, rotate the rest. Over N-1 rounds it
//    produces a full round robin; over the first M of them it produces a partial season in
//    which every team plays exactly M matches and no pairing repeats. Nothing about twelve
//    is written down -- N comes from the field and M from SEASON.
//  * A SEASON IS THREE MATCHDAYS, and that number is argued in play-tournament's FIELD/SEASON
//    block rather than here, because it is a product decision and this file is arithmetic.
//  * SIDES ALTERNATE. `a` is the left-hand side on the pitch, and the left goal genuinely
//    concedes more today (measured 50:32 across ten matches -- see the soccer revamp spec
//    3.2). Alternating by (round + slot) parity means no team is systematically handed the
//    better end for a whole season, so a live engine asymmetry cannot bend the table.
//
// TWO KINDS OF EMPTY, still worth keeping apart: `winner === undefined` is "not played
// yet", and that is the ONLY empty a league has. There is no BYE, no TBD, and no
// propagation -- a result changes exactly one fixture and nothing downstream, which is why
// results may be recorded in any order.

/* ---- THE SCHEDULE. Circle method (the standard round-robin construction): team 0 is
   fixed and the rest rotate one place each round, so round r pairs arr[i] with
   arr[n-1-i]. Every team appears exactly once per round and no pair repeats inside the
   first n-1 rounds -- which is the property that makes "the first M rounds" a legitimate
   partial season rather than an arbitrary list of fixtures. */
function schedule(ids, rounds) {
  const n = ids.length;
  if (n < 2 || n % 2) throw new Error('the circle method needs an even field: ' + n);
  if (rounds < 1 || rounds > n - 1)
    throw new Error('a season is 1..' + (n - 1) + ' matchdays, not ' + rounds);
  let arr = ids.slice();
  const out = [];
  for (let r = 0; r < rounds; r++) {
    const ms = [];
    for (let i = 0; i < n / 2; i++) {
      const x = arr[i], y = arr[n - 1 - i];
      // alternate which team takes the left-hand side -- see the note above
      ms.push((r + i) % 2 ? { a: y, b: x, sa: undefined, sb: undefined, winner: undefined }
                          : { a: x, b: y, sa: undefined, sb: undefined, winner: undefined });
    }
    out.push(ms);
    arr = [arr[0], arr[n - 1]].concat(arr.slice(1, n - 1));   // rotate all but the first
  }
  return out;
}

/* `rounds` is the matchday array, and it is called `rounds` on purpose: play-engine.js
   reads `T.br.rounds.length` and `T.cur.round` to decide how long a fixture is (first to
   3, then 4, then 5 as the season closes). That coupling is in a file this lane does not
   own, so the shape it reads is preserved exactly -- and it happens to be right for a
   league too: matchday one is quick, the run-in is long. */
function buildSeason(teamIds, matchdays) {
  const N = teamIds.length;
  if (N < 2) throw new Error('need at least 2 teams');
  const rounds = schedule(teamIds, matchdays).map(function (ms, i) {
    return { label: 'Matchday ' + (i + 1), matches: ms };
  });
  return { N, teams: teamIds.slice(), matchdays, rounds };
}

/* Read any fixture through this rather than indexing `rounds`, for the same reason the
   bracket did: the callers should not know the storage. There is no '3p' any more -- a
   league has no playoff, because it has no semi-finals to lose. */
function matchAt(se, round, index) { return se.rounds[round].matches[index]; }

function fixtures(se) {
  const out = [];
  se.rounds.forEach(function (rd, r) {
    rd.matches.forEach(function (m, i) { out.push({ round: r, index: i, match: m }); });
  });
  return out;
}

// The first fixture still needing to be played, in schedule order, or null when the
// season is over. No jumping, no holding anything back: matchday one is played before
// matchday two, which is what a fixture list is.
function nextMatch(se) {
  for (let r = 0; r < se.rounds.length; r++) {
    const ms = se.rounds[r].matches;
    for (let i = 0; i < ms.length; i++)
      if (ms[i].winner === undefined) return { round: r, index: i, match: ms[i] };
  }
  return null;
}

function played(se) {
  let n = 0;
  se.rounds.forEach(function (rd) {
    rd.matches.forEach(function (m) { if (m.winner !== undefined) n++; }); });
  return n;
}
function total(se) { return se.rounds.length * se.rounds[0].matches.length; }
function complete(se) { return nextMatch(se) === null; }

/* ---- THE TABLE. Three points a win, none for a loss, and there is deliberately no draw
   column: the engine plays every fixture to a winner (first to N, win by two -- see
   play-engine.js's `S.target`), so a drawn match cannot occur and a D column of twelve
   zeroes would be a promise the game cannot keep. For the same reason W is not printed
   either: with no draws W is exactly Pts/3, and a column that restates another column is
   the "random unnecessary element" this screen has already been cut for once.

   THE TIE-BREAK IS GOAL DIFFERENCE, THEN GOALS SCORED, THEN THE DRAW. It is shown, not
   just applied -- the GD column is on the table and the rule is printed under its heading,
   because a position nobody can explain is the seed problem again in a new hat. The draw
   order is the last resort only; two teams reaching identical points, identical goal
   difference AND identical goals scored is the one case where nothing was earned either
   way, and something has to be deterministic. ---- */
function table(se) {
  const row = {};
  se.teams.forEach(function (id, i) {
    row[id] = { id: id, drawn: i, played: 0, won: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
  });
  se.rounds.forEach(function (rd) {
    rd.matches.forEach(function (m) {
      if (m.winner === undefined) return;
      const A = row[m.a], B = row[m.b];
      if (!A || !B) return;
      const sa = m.sa | 0, sb = m.sb | 0;
      A.played++; B.played++;
      A.gf += sa; A.ga += sb; B.gf += sb; B.ga += sa;
      if (m.winner === m.a) { A.won++; B.lost++; } else { B.won++; A.lost++; }
    });
  });
  const rows = se.teams.map(function (id) {
    const t = row[id]; t.gd = t.gf - t.ga; t.points = t.won * 3; return t;
  });
  rows.sort(function (x, y) {
    return (y.points - x.points) || (y.gd - x.gd) || (y.gf - x.gf) || (x.drawn - y.drawn);
  });
  rows.forEach(function (t, i) { t.rank = i + 1; });
  return rows;
}

/* WHERE A TEAM STANDS RIGHT NOW, by id -- the number that replaced the seed. Returns null
   before anybody has played, because on matchday one every position in the table is the
   draw order and printing it would be the seed all over again. That guard is the whole
   point of this function existing rather than callers indexing table(). */
function positionOf(se, id) {
  if (played(se) === 0) return null;
  const rows = table(se);
  for (let i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i].rank;
  return null;
}

// Top of the table, once every fixture has been played. Mid-season it is nobody: a leader
// is not a champion, and calling one that is how a league starts lying about itself.
function champion(se) { return complete(se) ? table(se)[0].id : undefined; }

/* ---- CHAMPION CONFETTI ----------------------------------------------------------------
   Not the one-shot burst the match win uses: this keeps falling for as long as the champion
   is on screen. Pieces land on the ground line, sit for a beat, fade, and respawn at the top,
   so the population is constant and nothing is allocated per frame.

   Colour comes from the winning team, lightened and darkened around the base so it reads as
   confetti rather than as one flat swatch.

   WCAG 2.2.2 is the reason for the reduced-motion bail: this auto-starts and runs well past
   five seconds, so anyone who has asked for less motion gets none of it rather than a
   shorter version. */
var __champFx = null;
function champConfetti(rgb){
  if (__champFx){ __champFx.stop(); __champFx = null; }
  if (!rgb) return;
  try{ if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; }catch(_){}
  var base = String(rgb).split(',').map(function(n){ return parseInt(n, 10) || 0; });
  function shade(k){   // k in -1..1, toward black or toward white
    return 'rgb(' + base.map(function(c){
      return Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
    }).join(',') + ')';
  }
  var cols = [shade(-0.28), shade(-0.12), shade(0), shade(0.18), shade(0.36)];
  var cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;'
                   + 'pointer-events:none;z-index:64';
  document.body.appendChild(cv);
  var g = cv.getContext('2d'), P = [], N = 190, dead = false, dpr = Math.min(2, devicePixelRatio || 1);
  /* THE VIEWPORT IS READ ON RESIZE, NEVER IN THE FRAME. innerWidth/innerHeight
     are layout-dependent: asking for either can flush pending style and layout,
     and this loop asked four times a frame plus twice for every particle it
     recycled -- with 190 confetti at 60fps that is hundreds of chances a second
     to stall on a tree somebody else just dirtied. size() already runs on
     `resize` and is already the one place this canvas learns how big it is, so
     it is the honest place to cache them. The loop below now only writes. */
  var W = 0, H = 0;
  function size(){ W = innerWidth; H = innerHeight;
                   cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
                   g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  size();
  function seed(p, high){
    p.x = Math.random() * W;
    p.y = high ? -20 - Math.random() * H : -20 - Math.random() * 140;
    p.vy = 70 + Math.random() * 110;
    p.ph = Math.random() * 6.28; p.sw = 14 + Math.random() * 30; p.fq = 0.8 + Math.random() * 1.4;
    p.w = 5 + Math.random() * 5; p.h = 3 + Math.random() * 4;
    p.c = cols[(Math.random() * cols.length) | 0]; p.rv = 1.6 + Math.random() * 3.6;
    p.landed = 0;
    return p;
  }
  for (var i = 0; i < N; i++) P.push(seed({}, true));
  var t = 0, last = performance.now();
  function frame(now){
    if (dead) return;
    var d = Math.min(0.05, (now - last) / 1000); last = now; t += d;
    var ground = H - 4;
    g.clearRect(0, 0, W, H);
    for (var i = 0; i < P.length; i++){
      var p = P[i];
      if (p.landed){
        /* landed: hold briefly, fade, then go back to the top. This is what makes it a loop
           rather than a burst -- nothing is created or destroyed. */
        p.landed += d;
        var a = p.landed < 0.35 ? 1 : Math.max(0, 1 - (p.landed - 0.35) / 0.55);
        if (a <= 0){ seed(p, false); continue; }
        g.globalAlpha = a;
        g.fillStyle = p.c;
        g.fillRect(p.lx - p.w / 2, ground - p.h * 0.6, p.w, p.h * 0.6);   // squashed flat on the deck
        continue;
      }
      p.y += p.vy * d;
      var px = p.x + Math.sin(t * p.fq + p.ph) * p.sw;
      if (p.y >= ground){ p.landed = 0.0001; p.lx = px; continue; }
      g.globalAlpha = 1;
      g.save(); g.translate(px, p.y); g.rotate(Math.sin(t * p.rv + p.ph));
      g.scale(1, Math.max(0.15, Math.abs(Math.cos(t * p.rv * 1.3 + p.ph))));
      g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  addEventListener('resize', size, { passive: true });
  __champFx = { stop: function(){ dead = true; removeEventListener('resize', size);
                                  try{ cv.remove(); }catch(_){} } };
}
/* champConfetti is defined in the bracket module; paint() and the teardown live in the
   tournament module. Exposed rather than duplicated so there is one confetti loop. */
window.__hmChampFx = champConfetti;

/* Append-only, and in a league that is literally true: a result changes one fixture and
   nothing else. There is no propagate() here and there must never be one -- the bracket
   needed it because a winner walked forward into a slot; a table is re-derived from the
   results every time it is asked for, so there is no downstream state to keep in step. */
function recordResult(se, round, index, winnerId, sa, sb) {
  const m = matchAt(se, round, index);
  if (m.winner !== undefined) throw new Error('fixture already played');
  if (winnerId !== m.a && winnerId !== m.b) throw new Error('winner not in this fixture');
  m.winner = winnerId;
  if (sa !== undefined) { m.sa = sa | 0; m.sb = sb | 0; }
  return se;
}

/* INVARIANT: no team may appear twice in one matchday, and no pairing may repeat across
   the season. Both are properties of the circle method rather than of anything this file
   does at runtime -- which is exactly why they are asserted. A comment is not an
   invariant; the schedule generator is the kind of thing a later "simplification" turns
   into `for (i) pair(random, random)`. */
function checkSchedule(se) {
  const seenPair = new Set();
  for (const rd of se.rounds) {
    const seen = new Set();
    for (const m of rd.matches) {
      for (const t of [m.a, m.b]) {
        if (seen.has(t)) return 'team ' + t + ' plays twice in ' + rd.label;
        seen.add(t);
      }
      const k = m.a < m.b ? m.a + '|' + m.b : m.b + '|' + m.a;
      if (seenPair.has(k)) return 'pairing ' + k + ' is scheduled twice';
      seenPair.add(k);
    }
    if (seen.size !== se.N) return rd.label + ' fields ' + seen.size + ' of ' + se.N + ' teams';
  }
  return null;
}
window.__hmLeague = { schedule: schedule, buildSeason: buildSeason, matchAt: matchAt,
  fixtures: fixtures, nextMatch: nextMatch, recordResult: recordResult, table: table,
  positionOf: positionOf, champion: champion, complete: complete, played: played,
  total: total, checkSchedule: checkSchedule };
})();

(function(){   // ===== TOURNAMENT: teams, squads, stats, bracket =====
// Exhibition (the old Soccer) is untouched. This mode fields the same two-sided engine one
// fixture at a time and keeps a record around it.
//
// NO BYES, and now not even the concept: a league has no empty slot to fill. The field is
// padded to an EVEN number with egghead-captained teams, which is all the circle method
// asks for -- against the bracket's demand for a power of two, which is what forced the
// field down to eight and would have forced twelve back up to sixteen.
var BR = window.__hmLeague; if (!BR) return;

// Eight team colours. Kept saturated enough to read against a near-monochrome pitch, and far
// enough apart in hue that two teams on the same pitch are never ambiguous.
var /* ---- Every team colour sits at relative luminance 0.150, so WHITE TEXT CLEARS 4.5:1 ON
   ALL EIGHT (measured 5.22-5.27:1). The old palette could not carry white anywhere -- best
   was Purple at 4.63 and Yellow was 1.93 -- which is why the scoreboard could not just copy
   the reference and use white numerals.
   Normalising also fixes a second problem: the old set spanned 2.8x in perceived intensity
   (Purple 0.177 -> Yellow 0.495), so a yellow team simply looked more important than a purple
   one. Stephen Few's rule is that identity colours "should look different without varying in
   perceived intensity". Spread is now 1.01x.
   Scaled in LINEAR RGB, which preserves hue and saturation exactly -- no hue drift. Yellow and
   Orange cannot survive that as yellow and orange, so they are named for what they now are. ---- */
PAL = [
  /* ---- Radix Colors steps (MIT, (c) 2021-2022 Modulz / 2022- WorkOS), chosen by a search
     that maximised minimum CIEDE2000 separation JOINTLY across normal, protan and deutan
     vision. Every colour clears 4.5:1 with its OWN paired text -- six take ink, two take
     white. That pairing is the point: white text is impossible on a real yellow (the most
     saturated yellow in the whole sRGB gamut that carries white at 4.5:1 is #727b00, olive),
     which is why Adobe Spectrum and Atlassian both name yellow as an explicit carve-out.
     The earlier equal-luminance palette was worse than wrong -- under deuteranopia, hue
     collapses and lightness is the only discriminator left, so equalising it made two teams
     measure ΔE00 0.36 apart, i.e. identical. This set holds 11.30 under deutan, which is on
     a par with Okabe-Ito (11.67), the CVD reference palette.
     `e` is a darker edge so a pale chip still has an outline on paper -- Carbon's fix. ---- */
  { n: 'Red',     c: '209,52,21',   ink: '255,255,255', e: '209,52,21'  , who: 'Gus' , who2: 'Stan'  },
  { n: 'Gold',    c: '255,220,0',   ink: '18,18,18',    e: '158,108,0'  , who: 'Milo', who2: 'Wally' },
  { n: 'Green',   c: '70,167,88',   ink: '18,18,18',    e: '42,126,59'  , who: 'Ozzy', who2: 'Pip'   },
  { n: 'Teal',    c: '13,155,138',  ink: '18,18,18',    e: '0,133,115'  , who: 'Dot' , who2: 'Rex'   },
  { n: 'Sky',     c: '116,218,248', ink: '18,18,18',    e: '0,116,158'  , who: 'Baz' , who2: 'Moe'   },
  { n: 'Blue',    c: '0,144,255',   ink: '18,18,18',    e: '13,116,206' , who: 'Kip' , who2: 'Dex'   },
  { n: 'Violet',  c: '101,77,196',  ink: '255,255,255', e: '101,80,185' , who: 'Fitz', who2: 'Bram'  },
  { n: 'Magenta', c: '233,61,130',  ink: '18,18,18',    e: '203,29,99'  , who: 'Chip', who2: 'Nubs'  }
];

/* ---- THE SECOND LAP. Twelve teams, eight colours. The brief (§3.3) already accepted that
   the palette wraps and asked only that the NAMES not wrap with it -- but a wrapped colour
   is worse than a repeated name: two teams drawn against each other with the identical fill
   set --tcol1 and --tcol2 to the same value, and the fixture became unreadable.
   So the second lap is the SAME HUE, DARKENED IN LINEAR LIGHT (x0.22). Linear-light scaling
   is what the original palette note describes and it moves lightness without touching hue or
   saturation, so a Deep Red is unmistakably still the red team's shirt. Measured on the
   resulting set: white text clears 4.5:1 on all eight deep fills (min 4.99, Deep Gold), the
   deep variant sits dE76 32.7 from its own parent at the closest, and the minimum separation
   across all sixteen colours is dE76 20.7. Darkening is also the one axis that SURVIVES
   deuteranopia -- under CVD hue collapses and lightness is the only discriminator left, so
   the pair a colour-blind viewer can least afford to confuse is the pair this splits widest.
   Derived, never hand-authored, so the two laps cannot drift apart. */
function s2l(v){ v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function l2s(v){ return Math.max(0, Math.min(255, Math.round(255 *
  (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)))); }
function deepen(c){ return c.split(',').map(function(v){ return l2s(s2l(+v) * 0.22); }).join(','); }
function palAt(pal8, i){
  var base = pal8[i % pal8.length];
  if (i < pal8.length) return base;
  if (!base.__deep){
    var d = deepen(base.c);
    // white ink on every deep fill -- measured above, and the edge IS the fill because a
    // colour this dark already has all the outline a pale chip needed the edge for
    base.__deep = { n: 'Deep ' + base.n, c: d, ink: '255,255,255', e: d, who: base.who2 || base.who };
  }
  return base.__deep;
}

// The cup is named after one of the case studies, picked when the tournament is built. It is a
// portfolio, so the trophy may as well point at the work.
var CUPS = ['Apollo', 'Bearings', 'Cluster', 'Strata', 'UC Davis',
            'Reshore', 'B2B', 'Blender'];

/* ---- LEAGUE IDENTITY. Eight recurring competitions, deterministic by name: same
   league -> same board paint, ticket stock, serial prefix, forever. Identity changes
   MATERIALS, never layout or information architecture.

   THE `voice` FIELD IS GONE. It named the last three rounds of a knockout
   ("Quarter-final", "Last Four", "The Final") and there are no such rounds any more --
   a season is matchdays, and a matchday is numbered, not christened. Eight bespoke
   synonyms for "Matchday 2" would be flavour standing exactly where the one piece of
   real information goes. --cupPaint / --cupStock / --cupSheen still reach the
   scoreboard, which is the surface that earns the broadcast register. */
var CUP_ID={
  'Apollo': {paint:'#232c34',stock:'#f1ece0',sheen:'rgba(205,222,248,.30)',pfx:'APL',tex:0},
  'Bearings':{paint:'#2a2f25',stock:'#f3eee2',sheen:'rgba(244,228,196,.30)',pfx:'BRG',tex:1},
  'Cluster': {paint:'#2a2433',stock:'#f0ece4',sheen:'rgba(224,212,246,.30)',pfx:'CLU',tex:2},
  'Strata':  {paint:'#243028',stock:'#efece0',sheen:'rgba(206,238,222,.30)',pfx:'STR',tex:0},
  'UC Davis':{paint:'#3b3c20',stock:'#f2eddd',sheen:'rgba(255,240,204,.30)',pfx:'UCD',tex:1},
  'Reshore': {paint:'#34302a',stock:'#f1ede3',sheen:'rgba(240,224,200,.30)',pfx:'RSH',tex:2},
  'B2B':     {paint:'#2b2b31',stock:'#eeece6',sheen:'rgba(220,224,238,.30)',pfx:'B2B',tex:0},
  'Blender': {paint:'#31262b',stock:'#f3ece2',sheen:'rgba(246,214,222,.30)',pfx:'BLN',tex:1}
};

/* A round is a MATCHDAY, numbered from the schedule's own shape. `total` is
   T.br.rounds.length, so nothing here knows how long a season is -- exactly the
   discipline roundName() already had when it derived "Quarter-final" from the bracket
   rather than from a constant. The "of N" is carried because on a league screen the
   thing a visitor cannot otherwise know is how much is left. */
function roundName(r,total){
  var n=(r|0)+1;
  return total>1 ? ('Matchday '+n+' of '+total) : 'Matchday '+n;
}
/* The bare label, for surfaces that already carry the count elsewhere (the round beat
   in the middle of the screen, and the fixture sheet's headings). */
function roundShort(r){ return 'Matchday '+((r|0)+1); }

var T = { live: false, teams: [], br: null, stats: {}, cur: null, phase: 'idle', log: [], cup: '' };
/* Exposed so the scoreboard block (a different script, in a file this lane does not own)
   can name the round without knowing the format. It gets the SHORT label: the scoreboard
   stamp is a two-word slot beside the score, and "Matchday 2 of 3" is a status line, not
   a stamp. The count belongs in band A, which has a whole strip for it. */
T.roundName = function(r){ return roundShort(r); };
window.__hmTour = T;

function mob()   { return innerWidth <= 640; }
function perTeam(){ return mob() ? 2 : 3; }        // 1 captain + 1 (mobile) or 2 (desktop) eggheads
function rgb(c)  { return 'rgb(' + c + ')'; }
// Squad-mates must not share a tint. Two eggheads dyed the identical colour produce the identical
// data URL, and __hmSlotFor then hands back the FIRST one's slot for the second -- so the second
// never spawned, and its touches were logged against team 0, which read as an own goal. Shading
// each member apart fixes the identity AND makes team-mates tellable apart on the pitch.
function shade(c, amt){ return c.split(',').map(function(v){
  return Math.max(0, Math.min(255, Math.round(+v + amt))); }).join(','); }

/* ---- THE TWO NUMBERS THAT DECIDE THE COMPETITION, and they are the only two.
   Everything else -- the fixture count, the matchday labels, the table's row count, the
   number of sub-columns it is drawn in, how long each match runs -- is derived from
   these. Setting FIELD to 10 or SEASON to 4 changes the whole screen correctly and
   changes nothing else.

   FIELD = 12, because Jayden asked for twelve heads. Under the bracket that was
   impossible without padding to sixteen and opening the cup with four walkovers, which
   is the "What's the round of 16? There are only 8 players" muddle the field was cut to
   eight to escape. A league only asks that the field be EVEN, so twelve is simply twelve.

   SEASON = 3 MATCHDAYS -> 18 fixtures, and the reasoning is worth keeping because a
   full round robin at twelve is 66 matches and unwatchable:

     * THERE ARE NO DRAWS IN THIS ENGINE. Every fixture is first-to-N, win by two
       (play-engine.js's S.target), so a match cannot end level and points are exactly
       3 x wins. Over TWO matchdays that leaves every team on 0, 3 or 6 -- twelve teams
       in three buckets, with the top bucket usually holding three or four of them and
       goal difference picking the champion. That is the seed complaint again: a number
       at the top that nobody earned outright. Three matchdays gives 0/3/6/9 and, on the
       measured win rate, usually a single team on nine.
     * THE ENGINE ALREADY PACES THREE ROUNDS. It reads T.br.rounds.length and sets the
       match to first-to-3, then 4, then 5 as the season closes (play-engine.js:2334).
       Matchday one is quick -- a measured first-to-3 fixture has a 16s median -- and the
       run-in is long. That curve was written for a three-round cup and lands exactly on
       a three-matchday season without touching a file this lane does not own.
     * DEAD TIME IS THE REAL BUDGET, and it is 5,600ms per result. That number is NOT
       arbitrary and must not be shortened here: play-engine.js runs its celebration and
       then calls finish() at 5,400ms, so anything under that paints the match-up screen
       over a live pitch. 18 fixtures is 101s of celebration; 66 would have been six
       minutes of it. That is what caps the season, not the matches.

   The circle method guarantees no pairing repeats inside SEASON <= FIELD-1 matchdays,
   so every one of the 18 fixtures is a different meeting. ---- */
var FIELD = 12;
var SEASON = 3;

function readHeads(){ try { return JSON.parse(localStorage.getItem('hmCompanions') || '[]') || []; } catch (_) { return []; } }

// Fisher-Yates. Every tournament should feel like a fresh draw: without this the palette was
// handed out as PAL[i % PAL.length] and the captains kept their saved order, so team 1 was ALWAYS
// Red, team 2 always Blue, and the same head always started in the same bracket slot. Every cup
// looked like a re-run of the last one.
function shuffled(a){ var r = a.slice(); for (var i = r.length - 1; i > 0; i--){
  var j = Math.floor(Math.random() * (i + 1)); var t = r[i]; r[i] = r[j]; r[j] = t; } return r; }

// ---------- build the field ----------
// Saved heads captain first (they are the "main players"); the rest of the twelve are
// captained by a dyed egghead so every team in the league has a face.
var PIDN = 0;   // player-id counter: monotonic for the life of the page, so no two players ever share one
function buildTeams(cb){
  var heads = readHeads().slice(0, FIELD);
  var EGG = window.__EGGHEAD;
  /* Without egg art nobody can be dyed a captain, so the field is only as big as the real
     heads on hand -- fielding twelve teams eleven of which have no captain would print a
     table of blanks. */
  var canEgg = !!(EGG && EGG.cut && window.__hmTint);
  var n = canEgg ? FIELD : Math.max(2, Math.min(FIELD, heads.length + 1));
  /* AN ODD FIELD CANNOT BE SCHEDULED, and this is the one line that says so. The circle
     method pairs arr[i] with arr[n-1-i]; with n odd somebody is left over every round and
     the real fix in league football is a ghost team you get a rest against -- a bye by
     another name, which is exactly what this competition was rebuilt to stop printing.
     Only the no-egg-art fallback can produce an odd n (FIELD is even by decree), so the
     smallest honest correction is to field one team fewer. */
  if (n % 2) n -= 1;
  if (n < 2) n = 2;
  var teams = [], pending = 0, done = false;
  var pal8 = shuffled(PAL);   // fresh colour draw per cup

  // Captains, in order: the visitor's saved heads first, then MINI-JAYDEN, then eggheads. He is
  // the house player -- if a side is short he takes the shirt before any anonymous egg does.
  var caps = heads.slice();
  if (caps.length < n){
    try { var mj = window.__hmFillerData && window.__hmFillerData();
      // His playing cut is baked into a 5:6 frame with the head in the TOP square, so in a square
      // portrait box he floated high and small against the eggheads. Use his square smile art for
      // the bracket instead -- same level as everyone else, and he is grinning, which is the point.
      if (mj){ mj.portrait = 'images/smile.webp'; caps.push(mj); } } catch (_) {}
  }

  caps = shuffled(caps);   // ...and a fresh draw for who starts where in the schedule
  if (!canEgg){ n = Math.max(2, Math.min(n, caps.length)); if (n % 2) n -= 1; if (n < 2) n = 2; }

  for (var i = 0; i < n; i++){
    // Past the eighth team the palette wraps onto its own darkened second lap -- see palAt().
    var pal = palAt(pal8, i);
    // A named head names its team. Colour is the fallback, and stays the visual identity either
    // way (the bar, the ring, the nets), so "Sam vs Grey" still reads unambiguously.
    var cap = caps[i] || null;
    // ONLY A HEAD THAT WEARS THE COLOUR MAY BE NAMED AFTER IT. A dyed egghead literally is that
    // colour, so "Green" is true. One of the visitor's own saved heads keeps its own colours --
    // calling its team "Yellow" while it renders blue is the confusing case Jayden flagged, and
    // it was hitting 5 of 8 teams. Mini-Jayden is always himself. Unnamed saved heads get an
    // ordinal instead of a colour they do not wear.
    var nm;
    if (cap && cap.name && String(cap.name).trim()) nm = String(cap.name).trim().slice(0, 14);
    else if (cap && cap.__mirror)                   nm = 'Jayden';
    // A dyed egghead is a CHARACTER, not a swatch. Naming it after its own colour is the
    // M&M's trap (their spokescandies are literally called Red and Blue); Power Rangers never
    // do it. The name is a pure function of the palette slot, so the red egghead is ALWAYS
    // Gus -- recognisable across every session -- while `colName` keeps carrying the colour
    // for the bar, the ring and the nets.
    else if (!cap || cap.__egg)                     nm = pal.who || pal.n;
    else                                            nm = 'Player ' + (i + 1);
    /* NO `seed`. It was `i + 1` -- the index of a shuffled array, printed on the
       match-up screen as "Seeds 3 and 7" -- and it is the thing Jayden called out: a
       number that looks like a ranking and is a loop counter. Its replacement is the
       team's LEAGUE POSITION, which is not stored on the team at all because it is not a
       property of the team; it is a fact about the results so far, so it is read from
       the table (BR.positionOf) at the moment it is drawn and it is null until somebody
       has actually played. */
    teams.push({ id: 'tm' + i, name: nm, col: pal.c, colName: pal.n,
                 ink: pal.ink, edge: pal.e,
                 captain: cap, squad: [], out: false });
  }

  /* WHO THIS PLAYER IS, decided once, here, where the roster is still in hand -- not later by
     comparing pictures. `i` is the index within playersOf(tm), so 0 is always the captain. */
  function playerName(tm, p, i){
    if (p && p.name && String(p.name).trim()) return String(p.name).trim().slice(0, 14);   // one of the visitor's own, named
    if (p && p.__mirror)                      return 'Jayden';                             // the house player, always himself
    if (i === 0)                              return tm.name;   // the captain IS the team's namesake -- a dyed egg captain is Gus,
    // an unnamed saved head is "Player 3" -- which is exactly what the board above the pitch says
    return null;   // an anonymous squad egghead has no name of its own; callers paint the team name
  }
  function finish(){ if (done) return; done = true;
    /* STABLE IDENTITY, minted once per cup and carried on the player object itself. Everything
       downstream (which slot a player was spawned into, and therefore who a goal belongs to)
       keys off __pid from here on. It used to key off the cut data-URL, which cannot work:
       a tournament re-encodes the art it hands to a respawn, so the same player's bytes differ
       across fixtures, and two eggheads dyed the same colour produce byte-identical cuts, so
       one player would answer to the other's identity. A goal could land on the wrong head --
       including the visitor's own, which was never even on the pitch. */
    teams.forEach(function(tm){
      playersOf(tm).forEach(function(p, i){
        if (!p) return;
        if (!p.__pid) p.__pid = 'p' + (++PIDN);
        if (p.__name === undefined) p.__name = playerName(tm, p, i);
      });
    });
    T.teams = teams; cb(teams); }

  teams.forEach(function(tm){
    var need = perTeam() - 1;                      // eggheads to dye for this team
    var wantCaptainEgg = !tm.captain;
    var total = need + (wantCaptainEgg ? 1 : 0);
    if (!EGG || !EGG.cut || !window.__hmTint){     // no egg art: field the captain alone rather than
      return;                                      // clone him, which put the same head on the pitch twice
    }
    pending += total;
    for (var k = 0; k < total; k++){
      (function(isCap, idx){
        window.__hmTint(EGG.cut, rgb(shade(tm.col, isCap ? 0 : (idx % 2 ? 26 : -26))), function(cut){
          // __filler is the mini-Jayden flag: "spawns already active, no intro". Without it a fresh
          // head waits on the big head's intro sequence before its toss-in -- and the big head is
          // hidden during a tournament, so squads spawned and then sat at opacity 0 forever.
          var d = { cut: cut, eyes: EGG.eyes || [], marks: EGG.marks || null, __noIntro: true, __egg: true };
          if (isCap && !tm.captain) tm.captain = d; else tm.squad.push(d);
          if (--pending <= 0) finish();
        });
      })(wantCaptainEgg && k === 0, k);
    }
  });
  if (pending === 0) finish();
}

/* Ending a match early left T.phase at 'match' with T.cur still set, so paint() rendered no
   Kick off and the season could never be resumed -- the only way out was to quit it.
   Abandoning a fixture now hands the schedule back intact, with that fixture still unplayed. */
window.__hmTourAbort = function(){
  if (!T.live || !T.cur) return;
  T.cur = null;
  if (T.phase === 'match'){ T.phase = 'table'; paint(); }
};
window.__hmTourWin = function(winSide, scoreR, scoreB){
  if (!T.live || !T.cur) return;
  var c = T.cur, winnerId = c.side[winSide];
  /* The scoreline travels with the result, and in a league it is not decoration: goal
     difference is the published tie-break, so `sa`/`sb` ARE table data. Side 1 is always
     the fixture's `a` and side 2 its `b` -- cast() built c.side from exactly that. */
  BR.recordResult(T.br, c.round, c.index, winnerId, scoreR, scoreB);
  /* SESSION MEMORY: record the pair result by captain slot. The captain is the first entry in
     tm.slots (startFixture builds slots in playersOf() order, captain first), so ka/kb are the
     two captains' head slots and kw is whichever of them just won. */
  try{
    var ka=c.a.slots[0], kb=c.b.slots[0], kw=(winnerId===c.a.id?ka:kb);
    var pk=(ka<kb?ka+'|'+kb:kb+'|'+ka), P=window.__hmSess.pair;
    P[pk]=P[pk]||{count:0,lastWinner:null}; P[pk].count++; P[pk].lastWinner=kw;
    window.__hmSess.head[ka]=window.__hmSess.head[ka]||{goals:0,played:0,titles:0};
    window.__hmSess.head[kb]=window.__hmSess.head[kb]||{goals:0,played:0,titles:0};
    window.__hmSess.head[ka].played++; window.__hmSess.head[kb].played++;
  }catch(_){}
  /* Repaint NOW, not only when between() fires. The screen comes back at the final whistle
     and was still showing the fixture that had just been decided -- a flash of the match-up
     after someone had already won. It also means the TABLE behind the celebration is already
     the new one, which is the payoff of a league: you look up and you have moved. */
  try{ paint(); }catch(_){}
  var bad = BR.checkSchedule(T.br);
  if (bad) { try { console.warn('[league]', bad); } catch (_) {} }
  T.cur = null;
  /* ---- 5,600ms, AND IT IS NOT PADDING. play-engine.js's win path fires the confetti, holds
     the call on screen to 4,600ms and only then runs `setTimeout(finish, 5400)` -- finish IS
     __hmSoccerEnd and it is the only thing that takes the pitch down. Painting the next
     match-up at, say, 2,600ms would draw it over a live match. So this number is slaved to
     the engine's and belongs to a file this lane does not own; shortening it is an engine
     change, not a tournament one. It is also why the season is three matchdays and not six
     (see SEASON): 5.6s x fixtures is the real cost of a longer league.
     The old `hmFinal ? 10500` branch is gone with hmFinal itself -- see cast(). ---- */
  var hold = (typeof T.holdMs === 'number' && T.holdMs >= 0) ? T.holdMs : 5600;
  setTimeout(function(){ if (T.live) between(); }, hold);
};

// ---------- running a fixture ----------
function teamById(id){ for (var i = 0; i < T.teams.length; i++) if (T.teams[i].id === id) return T.teams[i]; return null; }

function playersOf(tm){ var out = []; if (tm.captain) out.push(tm.captain); return out.concat(tm.squad); }

/* WHO IS IN THIS SLOT, answered by the only thing that actually knows: the fixture that put
   them there. startFixture builds tm.slots in playersOf() order, so slots[i] is player i --
   no picture comparison, no guessing. Returns null for a slot this fixture never filled and
   for an anonymous squad egghead (which HAS no name); both cases mean "say the team name".
   It deliberately cannot return the visitor's saved companion unless that companion is
   genuinely one of the two teams on the pitch right now. */
window.__hmTourPlayerAt = function(slot){
  try{
    if (slot == null || !T.live || !T.cur) return null;
    var c = T.cur;
    for (var s = 0; s < 2; s++){
      var tm = s ? c.b : c.a; if (!tm || !tm.slots) continue;
      var i = tm.slots.indexOf(slot); if (i < 0) continue;
      var p = playersOf(tm)[i]; if (!p) return null;
      return { name: p.__name || null, cut: p.cut || null, team: tm.name, pid: p.__pid || null };
    }
  }catch(_){}
  return null;
};

/* ---- CASTING A FIXTURE. This block used to run at KICK OFF; it now runs the
   moment the fixture becomes KNOWN, which is the whole of Jayden's third ask:

     "the mini heads should be there -- like the team that's about to play should
      be in that screen hanging out around the bottom like it would be on the
      home screen."

   The comment this replaces read "between fixtures nobody is on the pitch: the
   bracket screen is not a scene". That assumption is what is being overturned,
   and three things fall out of overturning it. The squads are already standing
   when play starts, so the 620ms pop-in wait that used to sit in front of
   __hmSoccerStart() is gone -- it existed only because they were not there a
   moment earlier. The versus ritual is performed by the real objects instead of
   depicted by a card. And the bottom 42svh of the screen, which is otherwise
   the empty space a full viewport hands you, becomes the stage.

   It is a MOVE, not a rewrite: every line below is the code that was already
   here. What changed is who calls it -- between() and start(), rather than
   startFixture() -- and therefore when. The three things that had to move with
   it and are easy to get wrong: clearSpawned() must fire at the START of the
   next between(), not before the next cast, or the squads are killed the moment
   they arrive; the __hmSlotForPid dedupe stays exactly as it is (the `taken`
   map is the fix for a real own-goal bug and must not be simplified).

   ---- hmFinal IS GONE, AND THAT IS A DELETION RATHER THAN AN OVERSIGHT.
   `body.hmFinal` bought three things from play-engine.js: the gold ball, the
   championship disco, and handTrophy() -- which puts the trophy in the hands of a
   player on the team that just won THAT MATCH. In a cup that team is the champion.
   In a league it is whoever happened to win the last fixture of matchday three,
   who may be eleventh. A trophy handed to eleventh place is worse than no trophy,
   and the alternative -- lighting all six of the last matchday's fixtures gold --
   spends the one colour nobody owns on six ordinary matches.

   So the league does not claim a final, because it does not have one: it has a
   table that stops moving. The payoff moved to where it is true, which is the
   champion screen -- the crown, the confetti and the finished table. The engine's
   own `classList.remove('hmFinal')` in finish() and the one in stop() below stay
   as they are; they now simply never have anything to remove. ---- */
function cast(nm){
  var A = teamById(nm.match.a), Bm = teamById(nm.match.b);
  if (!A || !Bm) return;
  var side = { 1: A.id, 2: Bm.id };
  T.cur = { round: nm.round, index: nm.index, side: side, a: A, b: Bm };

  // Bench every saved head; the captains that are playing get un-benched as they are assigned.
  var bench = {}; (window.__hmSlots ? window.__hmSlots() : []).forEach(function(s){ bench[s] = 1; });
  window.__hmBench = bench;

  var sel = {}, col = { 1: A.col, 2: Bm.col };
  window.__hmTeamCol = col;
  // On the ROOT, not on .hmScore: the scoreboard element is not built until the first match runs,
  // so setting it there left the very first fixture showing the old red/blue numerals.
  try {
    var rt = document.documentElement;
    rt.style.setProperty('--tcol1', rgb(A.col)); rt.style.setProperty('--tcol2', rgb(Bm.col));
    rt.style.setProperty('--tc1', A.col); rt.style.setProperty('--tc2', Bm.col);   // raw channels: the goal
    // nets need rgba(), and they were the one thing still hardwired to red/blue
  } catch (_) {}

  var SLOT = 9200; T.spawnedCuts = T.spawnedCuts || [];
  /* tm.slots is the fixture's ONLY record of who is standing where, and it is read back by
     index -- slots[i] is playersOf(tm)[i] -- so it has to be rebuilt from scratch each fixture
     and must never contain the same slot twice. `taken` enforces the second half: without it a
     cut collision (two eggheads dyed alike) handed the same slot to two players, and from then
     on the index lookup named the wrong one. */
  var taken = {};
  [[A, 1], [Bm, 2]].forEach(function(pair){
    var tm = pair[0], sideNo = pair[1];
    tm.slots = [];
    playersOf(tm).forEach(function(p){
      // IDENTITY IS THE pid, NOT THE IMAGE BYTES. A pid survives a respawn's re-encode and is
      // unique even between two identically dyed eggheads, which is exactly what the cut string
      // was not.
      var slot = (window.__hmSlotForPid && p.__pid) ? window.__hmSlotForPid(p.__pid) : null;
      if (slot != null && taken[slot]) slot = null;
      if (slot == null && window.__hmSlotFor){
        // A head the visitor already has on the pitch (their own saved companions, spawned at
        // page load) carries no pid, and reusing it rather than cloning it is deliberate: the
        // crowd survives the whole bracket and clearSpawned() must never kill it. The cut is the
        // only handle those heads have, so this lookup stays -- but only as the second question,
        // and only if nobody in this fixture has claimed that slot already.
        var s2 = window.__hmSlotFor(p.cut);
        if (s2 != null && !taken[s2]) slot = s2;
      }
      if (slot == null){ slot = SLOT++;
        // Carry __filler/__mirror through: mini-Jayden IS the big head cloned, and rebuilding his
        // data without them would spawn a generic head wearing his face -- no mirrored expressions,
        // no smile bake, wrong scale.
        var sp = { cut: p.cut, eyes: p.eyes || [], marks: p.marks || null, __noIntro: true, __pid: p.__pid };
        if (p.__filler) sp.__filler = true;
        if (p.__mirror) sp.__mirror = true;
        try { window.__hmSpawnOne(sp, slot); T.spawnedCuts.push(p.cut); } catch (_) {} }
      // Stamp the pid on whichever head ended up in the slot -- including a reused saved head, so
      // that next fixture it answers to its pid and never has to be matched by picture again.
      try { if (window.__hmTagSlot && p.__pid) window.__hmTagSlot(slot, p.__pid); } catch (_) {}
      taken[slot] = 1;
      delete bench[slot];
      sel[slot] = sideNo;
      tm.slots = tm.slots.concat([slot]);
    });
  });
  window.__hmTeamSel = sel;
}

/* Kick off. Everything this used to do before blowing the whistle now happened
   two beats ago in cast(), so all that is left is the whistle -- and the 620ms
   wait goes with it, because there is no longer a pop-in to hide. The cast()
   call is a guard, not a second path: it only fires if something started a
   fixture the screen was not already showing. */
function startFixture(nm){
  if (!T.cur || T.cur.round !== nm.round || T.cur.index !== nm.index) cast(nm);
  if (!T.cur) return;
  var A = T.cur.a, Bm = T.cur.b;
  paint();
  try { if (window.__hmSoccerStart) window.__hmSoccerStart(); } catch (_) {}
  // Name the fixture AFTER kickoff: the scoreboard element does not exist until dom() builds it
  // on the first start(), so setting it beforehand silently did nothing on fixture one.
  setTimeout(function(){ try { var tt = document.querySelector('.hmScore .sTitleTxt');
    if (tt) tt.textContent = A.name + ' vs ' + Bm.name; } catch (_) {} }, 60);
}

function clearSpawned(){
  // The eggheads this mode spawned are removed between fixtures; the visitor's own saved heads
  // are only ever BENCHED, never killed, so the home-screen crowd survives the whole tournament.
  (T.spawnedCuts || []).forEach(function(c){ try { window.__hmKill(c); } catch (_) {} });
  T.spawnedCuts = [];
  T.teams.forEach(function(tm){ tm.slots = []; });
}

/* Everyone off, then cast() calls the two squads that are about to play back on.
   The old comment here said the bracket screen is not a scene; it is one now, so
   this is the clean slate the cast is laid on rather than the resting state. */
function benchAll(){
  var b = {}; (window.__hmSlots ? window.__hmSlots() : []).forEach(function(s){ b[s] = 1; });
  window.__hmBench = b;
}
var lastRound = -1;
function between(){
  clearSpawned(); benchAll();
  // MATCHDAY BEAT: when the season moves up a matchday, announce it in the middle of the
  // screen the same way the countdown and the win call do, so the league has a rhythm
  // between fixtures rather than just swapping panels. The bare label here, not the
  // "of 3" one -- band A is already carrying the count two lines above.
  try{ var n0 = BR.nextMatch(T.br);
    if (n0 && n0.round !== lastRound){ lastRound = n0.round;
      var cE = document.querySelector('.hmCount'), _lbl = roundShort(n0.round);
      if (cE){ cE.classList.add('hmMsg'); cE.textContent = _lbl;
        cE.classList.remove('hmCountPulse'); void cE.offsetWidth; cE.classList.add('hmCountPulse');
        setTimeout(function(){ if (cE.textContent === _lbl){ cE.textContent=''; cE.classList.remove('hmMsg'); } }, 1900); } }
  }catch(_){}
  var nm = BR.nextMatch(T.br);
  if (!nm){ T.phase = 'done'; paint(); return; }
  T.phase = 'table';
  /* The squads walk on BEFORE the screen that is about to talk about them, so
     they are already standing there when it settles in. */
  cast(nm);
  paint();
}

// ---------- UI ----------
var host = null;
/* WHICH PANE THE PHONE IS SHOWING -- 'fixture' or 'table'. It lives out here rather than
   inside paint() because paint() runs after every result, and a visitor who switched to
   the table would be thrown back to the match-up by the very event they were watching
   for. Reset in start(), so a new season opens on the match-up like every other one. */
var pane = 'fixture';
function el(tag, cls, txt){ var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
/* THE SHARED CONTROL CLASSES, named once so a chip cannot be built two ways.
   controls.css owns the geometry, the material, the focus ring, the press scale
   and the motion rungs for both of these; tournament.css adds placement and the
   one state (.tvArmed) the library has no name for. `.ctl--sm` is the 36px rung
   -- legal here because it ships its own 44px ::after hit pad, which is the
   tokens rule for a control whose ink box is under the tap minimum. */
var CHIP = 'ctl ctl--secondary ctl--sm';
var GO   = 'ctl ctl--primary';

/* ---- THE SCREEN. One fixed element, banded off svh.

   It is a child of <body>, not of .hero, and that is the whole fix for the
   scroll: the old capsule lived inside the 60vh arena and had to be dragged up
   to the top of the window by --tourShift, a number measured with
   `hero.getBoundingClientRect().top + window.scrollY` so that it would clear
   index.html's nav. play.html has no nav in the flow and cannot scroll, so that
   expression returned half the leftover viewport (180px at 1440x900) and was
   then spent twice -- once as a negative `top`, once as padding inside the
   capsule -- producing a 460 x 1243 card in a 900px window whose Kick off
   button was not merely below the fold but unreachable, because the body has
   overflow:hidden. There is nothing left to measure now: tournament.css bands
   the screen off the site header's own height and svh, so syncHero() and
   --tourShift are both gone. ---- */
function ensureHost(){
  if (host) return host;
  host = el('div', 'tvScreen'); host.id = 'tvScreen';
  document.body.appendChild(host);
  return host;
}

/* Deterministic per-cup randomness: same cup name -> same board every repaint.
   Still exported on __bcMat for the SCOREBOARD, which jitters its own card
   (play-engine.js:1884). Nothing on the match-up screen is randomised any more. */
function cupRand(seed){var h=2166136261;
  for(var i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619);}
  return function(){h=Math.imul(h^(h>>>15),2246822507);
    h=Math.imul(h^(h>>>13),3266489909);return((h^=h>>>16)>>>0)/4294967296;};}

/* THE POSTER WIPE IS CANCELLED (2026-08-04). bcSting drove a full-viewport skewed
   sweep in the cup's paint, and under it the artwork went full-bleed for 700ms with
   one sheen pass, on every fixture. Jayden, having watched it: "The poster coming
   over the screen looks like a glitch more than something we should be using."
   A screen-covering flash that arrives unbidden between two still layouts reads as
   a repaint fault, not as a transition, and it was doing that seven times a cup.
   The wipe, the flash element, the sheen, the three poster assets, the per-asset
   head-placement table and the --fit alpha probe that sized heads into them are all
   gone with it. The columns still arrive on --sp-settle; that is the whole ceremony
   now, and it is the one nobody has to forgive. */

function bcJitter(el,rnd,rot,off){
  el.style.transform='rotate('+(((rnd()*2-1)*rot).toFixed(2))+'deg) translate('
    +(((rnd()*2-1)*off).toFixed(1))+'px,'+(((rnd()*2-1)*off).toFixed(1))+'px)';}

var _grainEl=null;
function bcGrainOn(host){
  if(!_grainEl){var c=document.createElement('canvas');c.width=c.height=256;
    var x=c.getContext('2d'),d=x.createImageData(256,256);
    for(var i=0;i<d.data.length;i+=4){var v=112+(Math.random()*64|0);
      d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255;}
    x.putImageData(d,0,0);
    _grainEl=document.createElement('div');_grainEl.className='bcGrain';
    _grainEl.style.backgroundImage='url('+c.toDataURL()+')';}
  host.appendChild(_grainEl);}
function bcGrainOff(){if(_grainEl&&_grainEl.parentNode)_grainEl.parentNode.removeChild(_grainEl);}

/* Materials, exported for the scoreboard (soccer block). CONDITIONAL global --
   consumers must guard (see Foundations contracts). */
window.__bcMat={grainOn:bcGrainOn,grainOff:bcGrainOff,jitter:bcJitter,rand:cupRand};

/* ---- THE SEASON'S RUNNING ORDER, in one place. It stays a function rather than an
   inlined `T.br.rounds.map` because it is the one place that decides what a section of
   the fixture list is, and because the sheet and any future surface must agree. */
function sections(){
  return T.br.rounds.map(function(rd, i){
    return { r:i, label:roundShort(i), ms:rd.matches }; });
}
/* How much season is left, counted in the only unit a league has: fixtures. It is the
   one number on this screen that is not a score or a position. */
function distText(){
  var left = BR.total(T.br) - BR.played(T.br);
  if (left <= 0) return 'the season is over';
  return left === 1 ? 'one match to play' : (left + ' matches to play');
}

/* ---- THE TALE OF THE TAPE, and this is where the seed complaint is actually answered.

   It used to open "Seeds 3 and 7." -- two loop indices dressed as a ranking, printed at
   the exact moment a visitor is trying to work out who to care about. The replacement is
   the pair's LEAGUE POSITIONS, which are the same two small numbers and are earned:
   "3rd v 9th" is a sentence about results.

   It says nothing at all on matchday one, deliberately. Before anybody has played, every
   position in the table is the draw order -- printing it would be the seed again, wearing
   the word "position". BR.positionOf returns null until the first result, so the line
   simply is not there, and .tvTape:empty is display:none. Zero lines is a legitimate
   state and the column does not shift, because it is centred rather than stacked.

   The second line is unchanged: __hmSess has been recording every captain pairing since
   the page loaded, and it is the only other true thing this screen can say. ---- */
function ord(n){
  var s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function buildTape(A, B){
  var p = el('p', 'tvTape');
  try{
    var pa = A && BR.positionOf(T.br, A.id), pb = B && BR.positionOf(T.br, B.id);
    if (pa && pb) p.appendChild(document.createTextNode(ord(pa) + ' in the table v ' + ord(pb) + '.'));
  }catch(_){}
  try{
    var ka = A && A.slots && A.slots[0], kb = B && B.slots && B.slots[0];
    if (ka != null && kb != null && window.__hmSessFlags){
      var f = window.__hmSessFlags(ka, kb);
      if (f && f.met){
        /* Only if there is a line above to break FROM. The positions line is absent on
           matchday one, and a leading <br> would open the tape with a blank line -- the
           kind of defect that is invisible in source and obvious on a phone. */
        if (p.childNodes.length) p.appendChild(el('br'));
        var w = (f.lastWinner === ka) ? A : (f.lastWinner === kb) ? B : null;
        if (w){ p.appendChild(document.createTextNode('They have met. '));
                p.appendChild(el('em', null, w.name));
                p.appendChild(document.createTextNode(' won.')); }
        else p.appendChild(document.createTextNode('They have met before.'));
      }
    }
  }catch(_){}
  return p;
}

/* ---- THE FIXTURE LIST. Jayden on the board this replaces: "Schedule looks out of place
   and confusing to navigate. Too much random unnecessary elements. Looks like a
   muddled mess that doesn't do the design system."

   All three complaints were the same object. The old rail was a dark painted
   plane carrying printed TICKETS -- each one jittered half a degree off true,
   grained, on stock, with a perforated stub, a four-character serial and a
   rubber-stamped score that tore into place. Nine materials to say "Gus beat
   Kip 2-1". Against a page whose every other surface is a hairline on white it
   read as a different application, and the jitter in particular is why it read
   as broken rather than as printed: nothing else on the site is off-axis, so a
   row at 0.5deg looks like a rendering fault.

   What a visitor actually asks a schedule is "who am I playing, and what happens
   next". So the rail answers exactly that and nothing else. A round is a heading
   and a list. A fixture is two rows. A row is the team's colour, the captain's
   face, the name, and the score once there is one. No serial, no stub, no stock,
   no grain, no tear, no jitter. The broadcast register stays where it earns its
   keep -- the scoreboard, which Jayden likes, and which still gets its paint,
   its grain and its split-flap digits from __bcMat.

   The only ink that is not a hairline is the team colour, which is the one thing
   here that is genuinely information.

   IT NO LONGER HAS AN EMPTY STATE. Under the bracket, rounds two and three were four
   rows of "—" until somebody qualified. A league knows all 18 fixtures on day one, so
   every row has two real teams from the first paint -- .tvFxTbd survives only as the
   guard for a team id that cannot be resolved, which is now a bug rather than a phase.
   ---- */
function buildDraw(into, nm2){
  var _now = (nm2 && nm2.round !== undefined) ? nm2.round : -1;
  var _nowIx = nm2 ? nm2.index : -1;
  sections().forEach(function(sec){
    var _ri = sec.r;
    var rd = el('section', 'tvRd');
    rd.appendChild(el('h3', 'tvRdH' + (_ri === _now ? ' tvRdNow' : ''), sec.label));
    var list = el('ol', 'tvRdL');
    sec.ms.forEach(function(m, _mi){
      var decided = (m.sa !== undefined && m.sb !== undefined);
      var isNext  = (_ri === _now && _mi === _nowIx);
      var fx = el('li', 'tvFx' + (isNext ? ' tvFxNext' : '') + (decided ? ' tvFxDone' : ''));
      /* One row per side, and the two rows are the same object -- which is what
         makes a column of them scannable. The old ticket put the two teams
         side by side with the score wedged between, so no two fixtures lined
         their names up and the eye had to re-find the column on every row. */
      [[m.a, m.sa], [m.b, m.sb]].forEach(function(pr){
        var tm = teamById(pr[0]);
        var won = (m.winner !== undefined && tm && m.winner === tm.id);
        var lost = decided && tm && !won;
        var row = el('div', 'tvFxT' + (tm ? '' : ' tvFxTbd')
                                    + (won ? ' tvFxWon' : '') + (lost ? ' tvFxLost' : ''));
        /* A slot nobody has qualified for yet gets no colour stripe: a grey bar
           is a team wearing grey, and the semi-finals were showing four of them. */
        var c = el('i', 'tvFxC');
        if (tm) c.style.setProperty('--tcx', tm.col);
        row.appendChild(c);
        var fc = el('span', 'tvFxF');
        var cut = tm && tm.captain && (tm.captain.portrait || tm.captain.cut);
        if (cut){ var im = el('img'); im.src = cut; im.alt = ''; im.draggable = false; fc.appendChild(im); }
        row.appendChild(fc);
        row.appendChild(el('span', 'tvFxN', tm ? tm.name : '—'));
        /* Archivo, tabular, on the numeral only -- the one place the broadcast
           face is allowed outside the scoreboard, and the reason a column of
           scores lines up. An unplayed fixture prints nothing rather than a
           placeholder dash: an empty score column IS "not yet". */
        row.appendChild(el('span', 'tvFxS bcNum', decided ? String(pr[1] | 0) : ''));
        fx.appendChild(row);
      });
      list.appendChild(fx);
    });
    rd.appendChild(list);
    into.appendChild(rd);
  });
}

/* ---- THE TABLE. The screen's spine, and the thing the whole format change is for.
   Seeds became standings, so this is where the number a visitor reads finally means
   something: it is a consequence of results rather than of a loop index.

   IT IS ONE COMPONENT, DRAWN TWICE. The live table mid-season and the final table on
   the champion screen are the same rows with the same arithmetic; the only difference
   is that one of them has stopped moving. Building a second "final standings" widget
   would guarantee they eventually disagree -- which is exactly what the old
   standingsElim() did, inventing four hand-written words ("Champion", "Runner-up") for
   ranks the bracket could not otherwise explain.

   WHAT IS IN IT, AND WHAT IS NOT. Position, colour, face, name, P, GD, Pts.
     * NO W/D/L. There are no draws in this engine (first to N, win by two), so D is
       always 0 and W is exactly Pts/3. Three columns restating one column is the
       "random unnecessary elements" note in numeric form.
     * GD IS NOT DECORATION -- it is the tie-break, and it is on the table so the
       ordering can be checked by eye rather than taken on trust. That is the whole
       difference between this number and the seed it replaces.
     * NO form guide, no goals-per-head, no rating. The Mario Kart rule: the ledger is
       not a dashboard.

   THE SHAPE COMES FROM THE FIELD. Two sub-columns reading downwards, so the row count
   is ceil(N/2) and it is published to CSS as --tvStandRows. Hardcoding 6 there would
   silently grow a third column the day FIELD stops being twelve -- the same bug the
   hardcoded 4 caused when the field went from eight. ---- */
function buildTable(into){
  var rows = BR.table(T.br);
  var grid = el('div', 'tvStandGrid');
  grid.style.setProperty('--tvStandRows', String(Math.ceil(rows.length / 2)));
  rows.forEach(function(t){
    var tm = teamById(t.id);
    var row = el('div', 'tvStandRow');
    row.appendChild(el('span', 'tvStandRk bcNum', String(t.rank)));
    var c = el('i', 'tvFxC'); if (tm) c.style.setProperty('--tcx', tm.col);
    row.appendChild(c);
    var fc = el('span', 'tvFxF');
    var cut = tm && tm.captain && (tm.captain.portrait || tm.captain.cut);
    if (cut){ var im = el('img'); im.src = cut; im.alt = ''; im.draggable = false; fc.appendChild(im); }
    row.appendChild(fc);
    row.appendChild(el('span', 'tvStandNm', tm ? tm.name : '—'));
    /* Archivo, tabular -- the same numeral treatment the fixture scores take, and the
       reason three columns of digits line up down twelve rows. */
    row.appendChild(el('span', 'tvStandP bcNum', String(t.played)));
    row.appendChild(el('span', 'tvStandGd bcNum', (t.gd > 0 ? '+' : '') + t.gd));
    row.appendChild(el('span', 'tvStandPts bcNum', String(t.points)));
    grid.appendChild(row);
  });
  into.appendChild(grid);
  return grid;
}
/* THE COLUMN KEY. It is built out of the table's own row, with the leading cells
   present but empty, and laid on a copy of the table's own two-column grid -- so the
   three letters sit over the three columns they name by construction rather than by a
   second set of hand-tuned widths that would drift the first time a rung moved. One key
   row per sub-column, because there are two sub-columns and each needs its own. */
function tableKey(){
  var g = el('div', 'tvKeyGrid');
  g.setAttribute('aria-hidden', 'true');   // the rows themselves carry no <th> to label
  for (var i = 0; i < 2; i++){
    var r = el('div', 'tvStandRow tvKeyRow');
    r.appendChild(el('span', 'tvStandRk', ''));
    r.appendChild(el('i', 'tvFxC'));
    r.appendChild(el('span', 'tvFxF'));
    r.appendChild(el('span', 'tvStandNm', ''));
    r.appendChild(el('span', 'tvStandP', 'P'));
    r.appendChild(el('span', 'tvStandGd', 'GD'));
    r.appendChild(el('span', 'tvStandPts', 'PTS'));
    g.appendChild(r);
  }
  return g;
}

/* ---- THE FIXTURES SHEET. It used to be a phone-only copy of the rail, hidden above
   760px on the grounds that opening a copy of what is already on screen is one of the
   unnecessary elements. That argument no longer holds: the rail is the TABLE now, so on
   every viewport this sheet is the only place the full fixture list lives. The chip is
   visible at all widths and says "Fixtures", because that is what it opens.

   It is still the one surface allowed to scroll, and for the unchanged reason: it is
   the only thing on screen when it is open. ---- */
function ensureSheet(){
  var s = document.getElementById('tvSheet');
  if (s) return s;
  var scrim = el('div','tvSheetScrim'); scrim.id = 'tvSheetScrim';
  scrim.addEventListener('click', closeSheet);
  document.body.appendChild(scrim);
  s = el('div','tvSheetPanel'); s.id = 'tvSheet';
  s.setAttribute('role','dialog'); s.setAttribute('aria-modal','true');
  s.setAttribute('aria-label','The fixtures');
  document.body.appendChild(s);
  addEventListener('keydown', function(e){
    if (e.key === 'Escape' && document.body.classList.contains('tvBoardOpen')) closeSheet(); });
  return s;
}
function openSheet(){
  var s = ensureSheet(); s.innerHTML = '';
  var hd = el('div','tvSheetHd');
  /* The sheet is where the league's name lives on a phone: the strip drops it under
     560px because it cannot carry the name, the matchday and two controls at once. */
  hd.appendChild(el('h2','tvSheetTitle', (T.cup || 'League') + ' · the fixtures'));
  var x = el('button','tvChip ' + CHIP,'Close'); x.type = 'button';
  x.addEventListener('click', closeSheet); hd.appendChild(x);
  s.appendChild(hd);
  var board = el('div','tvSheetBoard');
  buildDraw(board, BR.nextMatch(T.br));
  s.appendChild(board);
  document.body.classList.add('tvBoardOpen');
  try{ x.focus(); }catch(_){}
}
function closeSheet(){
  document.body.classList.remove('tvBoardOpen');
}

function paint(){
  var h = ensureHost();
  if (!T.live){
    h.innerHTML = ''; h.hidden = true;
    document.body.classList.remove('tvBoardOpen');
    return;
  }
  h.hidden = false; h.innerHTML = '';

  var nm2    = BR.nextMatch(T.br);
  var champ2 = BR.champion(T.br);
  var done2  = (champ2 !== undefined);
  var total  = T.br.rounds.length;
  var A2 = (nm2 && !done2) ? teamById(nm2.match.a) : null;
  var B2 = (nm2 && !done2) ? teamById(nm2.match.b) : null;

  try{ if (done2) window.__hmChampFx(teamById(champ2) && teamById(champ2).col);
       else       window.__hmChampFx(null); }catch(_){}

  /* ---------- BAND A: the identity strip ----------
     Cup, round, how far there is to go, and the way out. It used to also carry a
     photographic trophy at 1.5em and a four-character fixture serial in Archivo.
     Neither told anyone anything: the trophy is a 119x192 photograph shrunk into
     a line of 12px text, and "APL-0102" is a prop. Both gone. */
  var strip = el('header', 'tvStrip');
  var sl = el('div', 'tvStripL');
  sl.appendChild(el('span', 'tvCup', T.cup || 'League'));
  sl.appendChild(el('span', 'tvSep', '·'));
  sl.appendChild(el('span', 'tvRound',
    done2 ? 'Champion' : (nm2 ? roundName(nm2.round, total) : 'Complete')));
  strip.appendChild(sl);

  var sr = el('div', 'tvStripR');
  if (nm2 && !done2) sr.appendChild(el('span', 'tvDist', distText()));
  /* AT EVERY WIDTH NOW. It was phone-only, hidden above 760px because up there the
     rail already showed the whole draw and this opened a copy of it. The rail is the
     TABLE now, so the fixture list is not on screen at any width and this is the only
     door to it. */
  var boardBtn = el('button', 'tvChip tvChipDraw ' + CHIP); boardBtn.type = 'button';
  boardBtn.setAttribute('aria-label', 'The fixtures');
  boardBtn.appendChild(el('span', 'tvChipLbl', 'Fixtures'));
  boardBtn.appendChild(el('span', 'tvChipLblSm', 'Fixtures'));
  boardBtn.addEventListener('click', function(e){ e.stopPropagation(); openSheet(); });
  sr.appendChild(boardBtn);

  /* §1.8: opening the Play menu is a hard no-op for the whole duration of a season.
     On index.html that was a guard -- the rest of the portfolio was one section
     down. Here the league IS the page, so the guard had become a trap. This
     is the scoped replacement: it belongs to the league, so it can end the
     season without ending the visit. Two-tap arm, because it is destructive and
     it now sits next to a button people will actually press. */
  var quit = el('button', 'tvChip ' + CHIP); quit.type = 'button';
  quit.setAttribute('aria-label', 'Leave the league');
  var qLbl = el('span', 'tvChipLbl', 'Leave the league');
  /* The phone's copy of the same word. See tournament.css's .tvChipLblSm: under
     560px the strip cannot carry the round name and two full-length buttons, so
     the buttons shorten and the aria-label above keeps the whole phrase. */
  var qLblSm = el('span', 'tvChipLblSm', 'Leave');
  quit.appendChild(qLbl); quit.appendChild(qLblSm);
  var armed = false, armT = 0;
  /* The ARMED warning is written to BOTH spans, so the one thing on this strip
     that must never be truncated is the one thing that reads identically at
     every width. */
  function say(full, short){ qLbl.textContent = full; qLblSm.textContent = short; }
  quit.addEventListener('click', function(e){
    e.stopPropagation();
    if (done2 || armed){ stop(); return; }
    armed = true; say('Tap again to end', 'Tap again to end'); quit.classList.add('tvArmed');
    clearTimeout(armT);
    armT = setTimeout(function(){ armed = false; say('Leave the league', 'Leave');
      quit.classList.remove('tvArmed'); }, 3200);
  });
  sr.appendChild(quit);
  strip.appendChild(sr);
  h.appendChild(strip);

  /* ---------- BAND B: the two columns ---------- */
  var body = el('div', 'tvBody' + (done2 ? ' tvDone' : ''));

  var fix = el('section', 'tvFixture');
  fix.setAttribute('aria-label', done2 ? 'Champion' : 'The next fixture');

  if (done2){
    /* The champion takes the left column and the finished table the right. */
    var wt = teamById(champ2);
    var wrap = el('div', 'tvChampWrap');
    var hh = el('div', 'tvChampHead');
    var wcut = wt && wt.captain && (wt.captain.portrait || wt.captain.cut);
    if (wcut){ var wi = el('img'); wi.src = wcut; wi.alt = ''; wi.draggable = false; hh.appendChild(wi); }
    var crown = el('div', 'tvCrown');
    crown.innerHTML = '<svg viewBox="0 0 48 34" aria-hidden="true">'
      + '<path d="M4 30 L4 15 L13 22 L24 6 L35 22 L44 15 L44 30 Z" fill="#e8b53a" '
      +   'stroke="#c9962a" stroke-width="1.2" stroke-linejoin="round"/>'
      + '<circle cx="4" cy="13" r="3.4" fill="#f0c94e"/>'
      + '<circle cx="24" cy="4" r="3.8" fill="#f0c94e"/>'
      + '<circle cx="44" cy="13" r="3.4" fill="#f0c94e"/>'
      + '<rect x="4" y="30" width="40" height="3.4" rx="1.4" fill="#d7a531"/></svg>';
    hh.appendChild(crown); wrap.appendChild(hh);
    fix.classList.add('tvFixtureDone');   // one portrait over one line, not the two-track grid
    fix.appendChild(wrap);
    fix.appendChild(el('h2', 'tvChampNm', (wt ? wt.name : '—') + ' wins the league'));
  } else {
    /* ---- THE MATCH-UP. Two captains, one under the other, with the lowercase
       `v.` between them -- the 1950s programme team-sheet grammar rather than a
       giant angled VS, which is the one piece of cosplay this screen is most
       likely to reach for.

       The round is NOT repeated here. It is already the second thing band A
       says, four lines above, and the duplicate was one of the elements that
       made the column read as busier than it is. What is left is the two things
       a visitor is here for -- who, and against whom -- plus the two true lines
       this league can produce (where the pair stand, and whether they have met
       before), and one button.

       FLAT, deliberately: the face and the name text are appended straight to
       .tvFixture rather than nested in a per-side wrapper, because .tvFixture is
       a two-track grid and the tracks are what align the column. A wrapper
       around each side would have made the sides two grid ITEMS, and the names
       would have started on the wrapper's x instead of the shared one -- which
       is the ragged edge this is fixing. ---- */
    [A2, B2].forEach(function(tm, i){
      if (i === 1) fix.appendChild(el('div', 'tvV', 'v.'));
      var fw = el('span', 'tvFace');
      var cut = tm && tm.captain && (tm.captain.portrait || tm.captain.cut);
      if (cut){ var fi = el('img'); fi.src = cut; fi.alt = ''; fi.draggable = false; fw.appendChild(fi); }
      fix.appendChild(fw);
      var txt = el('span', 'tvSideT');
      txt.appendChild(el('span', 'tvName', tm ? tm.name : '—'));
      /* Colour as a flat bar under the name, never as a field behind the head:
         a blend implies a winner, and a saturated panel behind a photographic
         cut-out is the esports roster card this site is not. */
      var bar = el('i', 'tvBar');
      if (tm) bar.style.setProperty('--tcx', tm.col);
      txt.appendChild(bar);
      fix.appendChild(txt);
    });
    fix.appendChild(buildTape(A2, B2));

    /* THE MATCH-UP SCREEN ALWAYS HAS ITS ONE ACTION. This used to be gated on
       `T.phase === 'bracket'`, and phase is a variable that can be left behind:
       any path that ends a fixture WITHOUT running through __hmTourWin -- the
       engine stopping, a match abandoned, a result recorded twice -- leaves
       phase at 'match', and the screen then shows the next fixture with NOTHING
       TO PRESS and no way to continue the cup. Reproduced on the final while
       driving a full bracket.

       There is no condition worth testing here. The whole screen is
       `display:none` under body.hmSoccer, so this code cannot run during a live
       match; if the match-up screen is visible at all, the one thing it is for
       is starting the match. An ungated button cannot get stuck. */
    if (nm2){
      var go = el('button', 'tvGo ' + GO, 'Kick off'); go.type = 'button';
      go.addEventListener('click', function(e){
        e.stopPropagation(); T.phase = 'match'; startFixture(nm2); });
      fix.appendChild(go);
    }
  }
  body.appendChild(fix);

  /* ---------- BAND B, right: the table ----------
     The rail used to be the draw, because a bracket's interesting object is who plays
     whom next. A league's interesting object is the table, so that is what stands here
     -- live, and updated the instant a result lands, which is the whole feel of the
     format: you look up after a match and you have moved.

     The fixture list did not lose its home, it moved to the sheet behind the Fixtures
     chip in band A. That is the honest trade: the table is the thing a visitor comes
     back to between every match, the fixture list is the thing they consult once. */
  var rail = el('aside', 'tvRail');
  rail.setAttribute('aria-label', done2 ? 'Final table' : 'The table');
  var hd2 = el('div', 'tvBoardHd', done2 ? 'Final table' : 'The table');
  /* THE TIE-BREAK IS PRINTED, not just applied. A position nobody can explain is the
     seed complaint in a new hat, so the rule that produced the order is on screen with
     the order. It is the quietest line on the band -- --fs-micro, --c500 -- because it
     is read once. tournament.css drops it below 640px, where the GD column beside it is
     already carrying the same fact. */
  hd2.appendChild(el('span', 'tvBoardRule', 'Three points a win · level on points, goal difference'));
  rail.appendChild(hd2);
  rail.appendChild(tableKey());
  buildTable(rail);
  body.appendChild(rail);

  /* ---------- THE PHONE'S ONE-AT-A-TIME SWITCH ----------
     Two columns cannot survive a phone, and the established answer on this screen is
     reduction rather than stacking (stacking re-creates the scroll, which is the thing
     that was fixed). Until now the reduction was "hide the rail" -- acceptable when the
     rail was a draw you could re-open in a sheet, and NOT acceptable now that the rail
     is the league itself. A phone that never shows the table has not been given the
     feature.

     So the reduction is in TIME rather than in content: band B shows one pane at a
     time and these two tabs switch it. That is the Gradient Maker's own move -- thirty
     controls, no room, five groups shown one at a time -- and it is the only shape that
     fits twelve rows at 320x568, where band B is a measured 220px. Two sub-columns of
     six at ~34px a row fit that with room; the same twelve rows underneath a match-up
     do not fit it at all.

     The tabs are the shared library's `.ctl--tab`, not a private segmented control, and
     the pane is a class on .tvBody rather than a repaint -- so switching costs one class
     write and never rebuilds twelve rows. They are display:none above 760px, where both
     columns are on screen and a switch would be a control for nothing. */
  if (!done2){
    var panes = el('div', 'tvPanes ctl-group');
    panes.setAttribute('role', 'tablist');
    panes.setAttribute('aria-label', 'What band B shows');
    [['fixture', 'Next match'], ['table', 'The table']].forEach(function(p){
      /* `.ctl--tab`, NOT `.ctl--tab .ctl--sm`, and the two must never be combined.
         Both modifiers write ::after -- the same pseudo-element -- for different
         jobs: --sm uses it as a 44px hit pad (top:50%, translateY(-50%)), --tab uses
         it as the selected underline (bottom:0, height:--focus-w). Together they
         over-constrain, `top:50%` wins over `bottom:0`, and the underline is drawn
         straight through the middle of the label as a strikethrough. Measured on the
         first build of this row; it looked exactly like `text-decoration`. The full
         --ctl-h rung is the right size for a tab anyway. */
      var b = el('button', 'tvPane ctl ctl--tab', p[1]); b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', pane === p[0] ? 'true' : 'false');
      b.addEventListener('click', function(e){
        e.stopPropagation(); pane = p[0];
        body.classList.toggle('tvPaneTable', pane === 'table');
        [].forEach.call(panes.children, function(o, i){
          o.setAttribute('aria-selected', (i === (pane === 'table' ? 1 : 0)) ? 'true' : 'false'); });
      });
      panes.appendChild(b);
    });
    body.insertBefore(panes, body.firstChild);
    if (pane === 'table') body.classList.add('tvPaneTable');
  }
  h.appendChild(body);
}

// ---------- entry ----------
function start(){
  if (T.live) return;
  buildTeams(function(teams){
    T.live = true; T.phase = 'table'; pane = 'fixture';
    try{ var _pb=document.getElementById('gameBtn');
      if(_pb){_pb.setAttribute('aria-disabled','true');
              _pb.setAttribute('title','Finish the season first');} }catch(_){}
    T.cup = CUPS[Math.floor(Math.random() * CUPS.length)] + ' League';
    var idKey=T.cup.replace(/ League$/,'');
    T.id=CUP_ID[idKey]||CUP_ID['Apollo'];
    document.body.style.setProperty('--cupPaint',T.id.paint);
    document.body.style.setProperty('--cupStock',T.id.stock);
    document.body.style.setProperty('--cupSheen',T.id.sheen);
    /* THE SEASON LENGTH IS CLAMPED TO WHAT THE FIELD CAN CARRY. The circle method can
       only promise unrepeated pairings for N-1 matchdays, and the no-egg-art fallback
       can field as few as two teams -- where SEASON=3 would ask two heads to play each
       other three times and the core would (correctly) throw. Clamping here rather than
       relaxing the core's guard keeps "no fixture repeats" a hard property. */
    var ids = shuffled(teams.map(function(t){ return t.id; }));
    T.br = BR.buildSeason(ids, Math.max(1, Math.min(SEASON, ids.length - 1)));
    lastRound = -1;
    if(window.PlayViewportOwner) window.PlayViewportOwner.enter("tournament");
    document.body.classList.add('hmTour');
    benchAll();
    /* Fixture one is cast the same way every other fixture is -- the first
       match-up screen must not be the one screen with nobody standing on it. */
    var nm0 = BR.nextMatch(T.br);
    if (nm0) cast(nm0);
    paint();
  });
}
function stop(){
  T.live = false; T.cur = null; T.phase = 'idle';
  document.body.classList.remove('tvBoardOpen');
  try{ document.body.classList.remove('hmFinal'); }catch(_){}
  try{ var _pb2=document.getElementById('gameBtn');
    if(_pb2){_pb2.removeAttribute('aria-disabled');_pb2.removeAttribute('title');} }catch(_){}
  try{ window.__hmChampFx(null); }catch(_){}   // the fall must not outlive the tournament
  bcGrainOff();   // the grain must not outlive the board either
  try{ document.body.style.removeProperty('--cupPaint');
       document.body.style.removeProperty('--cupStock');
       document.body.style.removeProperty('--cupSheen'); }catch(_){}
  window.__hmBench = null; window.__hmTeamSel = null; window.__hmTeamCol = null;
  try { var rt2 = document.documentElement; ['--tcol1','--tcol2','--tc1','--tc2'].forEach(function(v){ rt2.style.removeProperty(v); }); } catch (_) {}
  document.body.classList.remove('hmTour');
  try { var tt2 = document.querySelector('.hmScore .sTitleTxt'); if (tt2) tt2.textContent = 'Soccer'; } catch (_) {}
  clearSpawned(); paint();
  if(window.PlayViewportOwner) window.PlayViewportOwner.leave("tournament");
}
window.__hmTourStart = start;
window.__hmTourStop = stop;
/* The table as data, for anyone who wants it without scraping the DOM (and for the test
   harness, which has to assert the order rather than read it off a screen). It is live,
   not final -- mid-season it is the current table, which is the honest answer to "what
   are the standings". Returns [] when no season is running: a conditional global with
   nothing to say. `seed` is gone from the row for the same reason it is gone from the
   team -- `rank` is what replaced it, and it is earned. */
window.__hmTourStandings = function(){
  if (!T.live || !T.br) return [];
  return BR.table(T.br).map(function(t){
    var tm = teamById(t.id);
    return { rank: t.rank, id: t.id, name: tm ? tm.name : null,
             played: t.played, won: t.won, lost: t.lost,
             gf: t.gf, ga: t.ga, gd: t.gd, points: t.points,
             colour: tm ? tm.colName : null };
  });
};
/* The season's shape and how far through it is -- one call, so a driver never has to
   count fixtures by hand or guess at the matchday. */
window.__hmTourSeason = function(){
  if (!T.live || !T.br) return null;
  return { teams: T.br.N, matchdays: T.br.rounds.length,
           fixtures: BR.total(T.br), played: BR.played(T.br),
           complete: BR.complete(T.br) };
};
})();
