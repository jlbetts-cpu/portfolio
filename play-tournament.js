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

(function(){   // ===== TOURNAMENT: bracket core =====
// Unit-tested outside the browser before it landed here (58 assertions: slot order for 4/8/16,
// bye COUNT and bye RECIPIENTS for N=3/5/6/7 against the ITTF rule, no BYE-vs-BYE for any N,
// full play-throughs for every N=2..8 with a no-double-advance invariant checked after every
// result, and the immutability guards).
// Single-elimination bracket core. Pure functions, no DOM -- so it can be unit-tested
// outside the browser before it goes anywhere near index.html.
//
// Rules implemented (sourced):
//  * bracket size B = smallest power of two >= N; byes = B - N
//  * seed slot order is the recursive rule: order(2n) = for each s in order(n): s, then (2n+1-s)
//    -> order(4)=[1,4,2,3]  order(8)=[1,8,4,5,2,7,3,6]   (ITTF handbook; matches NCAA pairings)
//  * byes are NOT placed by hand. Pair seed s with seed B+1-s and they land on seeds 1,2,3...
//    in seeding order automatically, which is exactly the ITTF rule.
//  * BYE-vs-BYE is impossible when B is the SMALLEST power of two >= N, because that forces
//    N > B/2. Asserted, because over-padding (hard-coding B=8 for 3 teams) is the known bug.
//
// TWO DIFFERENT KINDS OF EMPTY, and conflating them was a real bug caught by the tests:
//   BYE (null)      -- round 1 only. There is no opponent and never will be.
//   TBD (undefined) -- rounds 2+. Nobody has qualified for this slot YET.
// Two TBDs facing each other is the normal state of an unplayed semi-final. Two BYEs facing
// each other is an over-padded bracket. Only the second is an error.

const BYE = null;

function slotOrder(B) {
  if (B === 1) return [1];
  if (B === 2) return [1, 2];
  const half = slotOrder(B / 2), out = [];
  for (const s of half) { out.push(s); out.push(B + 1 - s); }
  return out;
}

function bracketSize(N) { let B = 1; while (B < N) B *= 2; return B; }

function roundLabel(teamsLeft) {
  if (teamsLeft === 2) return 'Final';
  if (teamsLeft === 4) return 'Semi-final';
  if (teamsLeft === 8) return 'Quarter-final';
  return 'Round of ' + teamsLeft;
}

/* THE THIRD-PLACE PLAYOFF lives OUTSIDE br.rounds, addressed by the round id '3p'.
   It is OPT-IN as of 2026-08-04 (`buildBracket(seeds, {third:true})`) and the cup does not
   ask for it. Jayden, looking at the shipped board: "Too much random unnecessary elements."
   A bronze match is a fourth labelled group wedged between the semi-finals and the final, and
   it is the one group on the board whose winner does not go on to anything -- so the schedule
   read as four rounds when the cup has three. The core still builds and propagates it
   correctly for any caller that wants it; nothing here does.
   It is not a round: it has one match, it is not fed by the round before it, and nothing
   is fed by it. Putting it in the array would have made br.rounds.length lie -- and
   `nm.round === br.rounds.length - 1` is what the whole UI uses to mean "this is the
   final" (gold ball, poster, 10.5s celebration). A string round id can never equal a
   number, so every one of those tests answers "no" for the playoff without being touched.
   Read any match through matchAt() rather than indexing br.rounds directly. */
function matchAt(br, round, index) {
  return round === '3p' ? br.third : br.rounds[round].matches[index];
}

// Recompute every round after the first from the round before it. Byes auto-advance here,
// recursively, which is why this runs at BUILD time and again after every recorded result --
// "setting a BYE is not enough", the opponent has to be walked forward.
function propagate(br) {
  for (let r = 1; r < br.rounds.length; r++) {
    const prev = br.rounds[r - 1].matches, ms = br.rounds[r].matches;
    for (let i = 0; i < ms.length; i++) {
      const a = prev[i * 2].winner, b = prev[i * 2 + 1].winner;   // undefined => still TBD
      const m = ms[i];
      const kept = m.winner;
      m.a = (a === undefined || a === BYE) ? undefined : a;
      m.b = (b === undefined || b === BYE) ? undefined : b;
      // a slot can only be a walkover in round 1; later rounds just wait for qualifiers
      m.bye = false;
      m.winner = (kept !== undefined && kept !== null && (kept === m.a || kept === m.b)) ? kept : undefined;
    }
  }
  /* The playoff is re-derived the same way every other downstream node is: from the two
     semi-final results, never patched in place. A semi that is still open, or one decided
     by a walkover, yields no loser -- so the playoff simply stays unplayable rather than
     inventing a competitor. */
  if (br.third) {
    const sf = br.rounds[br.rounds.length - 2].matches, kept = br.third.winner;
    const lose = function (m) {
      return (m.winner === undefined || m.winner === BYE || m.a === undefined || m.b === undefined)
        ? undefined : (m.winner === m.a ? m.b : m.a);
    };
    br.third.a = lose(sf[0]); br.third.b = lose(sf[1]);
    br.third.winner = (kept !== undefined && kept !== null
      && (kept === br.third.a || kept === br.third.b)) ? kept : undefined;
  }
  return br;
}

// seeds: array of team ids in seed order (index 0 = seed 1).
function buildBracket(seeds, opts) {
  const N = seeds.length;
  if (N < 2) throw new Error('need at least 2 teams');
  const B = bracketSize(N);
  if (!(B / 2 < N && N <= B)) throw new Error('bracket padding invariant broken: ' + N + '/' + B);

  const slots = slotOrder(B).map(seed => (seed <= N ? seeds[seed - 1] : BYE));

  const rounds = [];
  for (let count = B / 2; count >= 1; count /= 2) {
    const matches = [];
    for (let i = 0; i < count; i++) {
      if (rounds.length === 0) {
        const a = slots[i * 2], b = slots[i * 2 + 1];
        if (a === BYE && b === BYE) throw new Error('BYE vs BYE — over-padded bracket');
        const bye = (a === BYE || b === BYE);
        matches.push({ a: a === BYE ? undefined : a, b: b === BYE ? undefined : b,
                       bye, winner: bye ? (a === BYE ? b : a) : undefined });
      } else {
        matches.push({ a: undefined, b: undefined, bye: false, winner: undefined });
      }
    }
    rounds.push({ label: roundLabel(count * 2), matches });
  }
  /* seeds are kept so the finishing table can tiebreak by seed without being handed the
     roster a second time -- the bracket already knows the draw order. */
  const br = { N, B, byes: B - N, seeds: seeds.slice(), rounds };
  /* A playoff needs two REAL semi-final losers. Skipped when the semi-final IS round one
     and round one carries byes (N=3), because a walkover has no loser to field. Off unless
     the caller asks -- see the note on '3p' above. */
  if (opts && opts.third && rounds.length >= 2 && !(rounds.length === 2 && B - N > 0))
    br.third = { a: undefined, b: undefined, bye: false, winner: undefined, third: true };
  return propagate(br);
}

// The first match still needing to be played (both sides known), or null when done.
// THE PLAYOFF JUMPS THE FINAL. Both become playable on the same whistle (the second semi),
// and a cup that crowns its champion and then goes back to decide third place has thrown
// away its own ending. So the final is held back until the playoff has been played --
// which is also the order every real tournament uses.
function nextMatch(br) {
  const last = br.rounds.length - 1;
  let fin = null;
  for (let r = 0; r <= last && !fin; r++) {
    const ms = br.rounds[r].matches;
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (m.winner === undefined && m.a !== undefined && m.b !== undefined) {
        if (r === last) { fin = { round: r, index: i, match: m }; break; }
        return { round: r, index: i, match: m };
      }
    }
  }
  const t = br.third;
  if (t && t.winner === undefined && t.a !== undefined && t.b !== undefined)
    return { round: '3p', index: 0, match: t };
  return fin;
}

function champion(br) { return br.rounds[br.rounds.length - 1].matches[0].winner; }

/* ---- FINAL STANDINGS: every competitor, 1..N, no gaps and no ties.
   Ranks 1-4 are decided by matches that were actually played -- the final settles 1 and 2,
   the playoff settles 3 and 4. Below that nobody played each other, so the only honest
   ordering left is HOW FAR THEY GOT, tiebroken by the seed they were drawn at (§3.7:
   "order by round eliminated, tiebroken by seed"). A bye is not progress that anyone
   earned, but it IS a round survived, and the seeds that received the byes are the top
   seeds, so seed order breaks that tie the same way it was made.
   Safe to call mid-tournament: with no results in, it degrades to pure seed order. ---- */
function standings(br) {
  const deepest = new Map();
  br.seeds.forEach(function (id) { deepest.set(id, -1); });
  br.rounds.forEach(function (rd, r) {
    rd.matches.forEach(function (m) {
      [m.a, m.b].forEach(function (t) {
        if (t === undefined || t === BYE || !deepest.has(t)) return;
        if (r > deepest.get(t)) deepest.set(t, r);
      });
    });
  });
  const seedOf = function (id) { return br.seeds.indexOf(id); };
  const order = br.seeds.slice().sort(function (x, y) {
    const d = deepest.get(y) - deepest.get(x);
    return d || (seedOf(x) - seedOf(y));
  });
  const fin = br.rounds[br.rounds.length - 1].matches[0];
  const ch = fin.winner;
  const head = [];
  if (ch !== undefined && ch !== BYE) {
    head.push(ch);
    const ru = (ch === fin.a) ? fin.b : fin.a;
    if (ru !== undefined && ru !== BYE) head.push(ru);
  }
  const t = br.third;
  if (t && t.winner !== undefined && t.winner !== BYE) {
    head.push(t.winner);
    const t4 = (t.winner === t.a) ? t.b : t.a;
    if (t4 !== undefined && t4 !== BYE) head.push(t4);
  }
  return head.concat(order.filter(function (id) { return head.indexOf(id) < 0; }));
}

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


// Append-only: record a winner, then re-derive everything downstream. Never patch one node.
function recordWinner(br, round, index, winnerId) {
  const m = matchAt(br, round, index);
  if (m.winner !== undefined) throw new Error('match already final');
  if (winnerId !== m.a && winnerId !== m.b) throw new Error('winner not in this match');
  m.winner = winnerId;
  return propagate(br);
}

// INVARIANT: no team may sit in more than one un-eliminated slot within a round.
function checkNoDoubleAdvance(br) {
  for (const rd of br.rounds) {
    const seen = new Set();
    for (const m of rd.matches) {
      for (const t of [m.a, m.b]) {
        if (t === undefined) continue;
        if (seen.has(t)) return 'team ' + t + ' appears twice in ' + rd.label;
        seen.add(t);
      }
    }
  }
  return null;
}
 window.__hmBracket={slotOrder:slotOrder,bracketSize:bracketSize,buildBracket:buildBracket,
  nextMatch:nextMatch,recordWinner:recordWinner,checkNoDoubleAdvance:checkNoDoubleAdvance,
  roundLabel:roundLabel,champion:champion,matchAt:matchAt,standings:standings};
})();

(function(){   // ===== TOURNAMENT: teams, squads, stats, bracket =====
// Exhibition (the old Soccer) is untouched. This mode fields the same two-sided engine one
// fixture at a time and keeps a record around it.
//
// NO BYES, by construction. The team count is padded to a power of two with egghead-captained
// teams, so every slot is filled and the bracket never needs a walkover. The bracket core still
// handles byes correctly if it is ever fed an odd field -- it is just never asked to.
var BR = window.__hmBracket; if (!BR) return;

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

/* ---- CUP IDENTITY. Eight recurring events, deterministic by name: same cup ->
   same board paint, ticket stock, serial prefix, label voice, forever. Identity
   changes MATERIALS AND VOICE, never layout or information architecture. */
var CUP_ID={
  'Apollo': {paint:'#232c34',stock:'#f1ece0',sheen:'rgba(205,222,248,.30)',pfx:'APL',voice:['Quarter-final','Semi-final','The Final'],tex:0},
  'Bearings':{paint:'#2a2f25',stock:'#f3eee2',sheen:'rgba(244,228,196,.30)',pfx:'BRG',voice:['Last Eight','Last Four','The Final'],tex:1},
  'Cluster': {paint:'#2a2433',stock:'#f0ece4',sheen:'rgba(224,212,246,.30)',pfx:'CLU',voice:['Quarter-final','Semi-final','Grand Final'],tex:2},
  'Strata':  {paint:'#243028',stock:'#efece0',sheen:'rgba(206,238,222,.30)',pfx:'STR',voice:['Round of Eight','Semi-final','The Final'],tex:0},
  'UC Davis':{paint:'#3b3c20',stock:'#f2eddd',sheen:'rgba(255,240,204,.30)',pfx:'UCD',voice:['Quarter-final','Semi-final','Championship'],tex:1},
  'Reshore': {paint:'#34302a',stock:'#f1ede3',sheen:'rgba(240,224,200,.30)',pfx:'RSH',voice:['Quarter-final','Semi-final','The Final'],tex:2},
  'B2B':     {paint:'#2b2b31',stock:'#eeece6',sheen:'rgba(220,224,238,.30)',pfx:'B2B',voice:['Last Eight','Semi-final','The Final'],tex:0},
  'Blender': {paint:'#31262b',stock:'#f3ece2',sheen:'rgba(246,214,222,.30)',pfx:'BLN',voice:['Quarter-final','Last Four','The Final'],tex:1}
};

/* Round labels speak the CUP's voice. voice = [quarter, semi, final] naming the
   LAST THREE rounds; earlier rounds fall back to 'Round of N'. */
function roundName(r,total){
  if(r==='3p')return 'Third place';   // the playoff has no round of its own -- see matchAt()
  var fromEnd=total-1-r;
  var v=(T.id&&T.id.voice)||['Quarter-final','Semi-final','The Final'];
  if(fromEnd===0)return v[2];
  if(fromEnd===1)return v[1];
  if(fromEnd===2)return v[0];
  return 'Round of '+Math.pow(2,total-r);
}

var T = { live: false, teams: [], br: null, stats: {}, cur: null, phase: 'idle', log: [], cup: '' };
T.roundName = roundName;   // exposed so the scoreboard block (a different script) can speak the same voice
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

/* THE FIELD IS EIGHT, and the round names follow from it rather than the other way round.
   It was twelve, which needs a sixteen-slot bracket, which opens the cup with a round called
   "Round of 16" containing four walkovers. Jayden, looking at it: "What's the round of 16?
   There are only 8 players -- just have them all play each other in quarter finals, no point
   of round of 16." He is right, and the fault was the field size, not the label: a bracket
   whose first round is named for teams that do not exist is the muddle, and no amount of
   renaming fixes it while four of the sixteen slots are empty.

   Eight is the smallest field that is also a power of two, so B=8, byes=0, and the cup is
   exactly quarter-final -> semi-final -> final. Seven fixtures, three rounds, no ghost cards.
   roundName() already derives every label from T.br.rounds.length, so this number is the ONLY
   place the shape of the cup is decided -- set it to 16 and the board says Round of 16 truly. */
var FIELD = 8;

function readHeads(){ try { return JSON.parse(localStorage.getItem('hmCompanions') || '[]') || []; } catch (_) { return []; } }

// Fisher-Yates. Every tournament should feel like a fresh draw: without this the palette was
// handed out as PAL[i % PAL.length] and the captains kept their saved order, so team 1 was ALWAYS
// Red, team 2 always Blue, and the same head always started in the same bracket slot. Every cup
// looked like a re-run of the last one.
function shuffled(a){ var r = a.slice(); for (var i = r.length - 1; i > 0; i--){
  var j = Math.floor(Math.random() * (i + 1)); var t = r[i]; r[i] = r[j]; r[j] = t; } return r; }

// ---------- build the field ----------
// Saved heads captain first (they are the "main players"); any remaining slots needed to reach a
// power of two are captained by an egghead so the bracket is always full.
var PIDN = 0;   // player-id counter: monotonic for the life of the page, so no two players ever share one
function buildTeams(cb){
  var heads = readHeads().slice(0, FIELD);
  var EGG = window.__EGGHEAD;
  /* Without egg art nobody can be dyed a captain, so the field is only as big as the real
     heads on hand -- fielding twelve teams eleven of which have no captain would print a
     draw board of blanks. */
  var canEgg = !!(EGG && EGG.cut && window.__hmTint);
  var n = canEgg ? FIELD : Math.max(2, Math.min(FIELD, heads.length + 1));
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

  caps = shuffled(caps);   // ...and a fresh draw for who starts where in the bracket
  if (!canEgg) n = Math.max(2, Math.min(n, caps.length));   // only as many teams as there are real captains

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
    teams.push({ id: 'tm' + i, name: nm, col: pal.c, colName: pal.n, seed: i + 1,
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
   Kick off and the tournament could never be resumed -- the only way out was to quit it.
   Abandoning a fixture now hands the draw back intact, with that tie still unplayed. */
window.__hmTourAbort = function(){
  if (!T.live || !T.cur) return;
  T.cur = null;
  if (T.phase === 'match'){ T.phase = 'bracket'; paint(); }
};
window.__hmTourWin = function(winSide, scoreR, scoreB){
  if (!T.live || !T.cur) return;
  var c = T.cur, winnerId = c.side[winSide];
  // Keep the scoreline on the fixture. Side 1 is always the match's `a`, side 2 its `b`,
  // so the schedule can render a real result rather than just who advanced.
  try{ var _m = BR.matchAt(T.br, c.round, c.index);
    if (_m && scoreR !== undefined){ _m.sa = scoreR|0; _m.sb = scoreB|0; }
  }catch(_){}
  BR.recordWinner(T.br, c.round, c.index, winnerId);
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
  /* Repaint NOW, not only when between() fires. The panel comes back at the final whistle and
     was still showing the fixture that had just been decided -- a flash of the VS card after
     someone had already won. Lengthening the final's celebration to 10.5s stretched that stale
     window rather than causing it. */
  try{ paint(); }catch(_){}
  var bad = BR.checkNoDoubleAdvance(T.br);
  if (bad) { try { console.warn('[tour]', bad); } catch (_) {} }
  T.cur = null;
  /* Longer for the final: the championship gets the dark, the ball and the spotlight, and
     cutting to the next screen at 5.6s talked over its own celebration. */
  setTimeout(function(){ if (T.live) between(); },
    document.body.classList.contains('hmFinal') ? 10500 : 5600);
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
   map is the fix for a real own-goal bug and must not be simplified); and
   hmFinal now lands before the final's match-up screen rather than after it,
   which is correct -- the gold ball should already be on when you are looking
   at the fixture that will use it. ---- */
function cast(nm){
  var A = teamById(nm.match.a), Bm = teamById(nm.match.b);
  if (!A || !Bm) return;
  /* The final gets the gold ball. One class on <body>, so the pitch texture and the ball in
     the scoreboard footer both switch from a single source of truth. */
  try{ document.body.classList.toggle('hmFinal', nm.round === T.br.rounds.length - 1); }catch(_){}
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
/* The bracket's own plain label for a round id, playoff included. Anything reading
   T.br.rounds[r].label directly breaks on '3p', which has no entry in that array. */
function rdLabel(r){ return r === '3p' ? 'Third place' : T.br.rounds[r].label; }
function between(){
  clearSpawned(); benchAll();
  // ROUND BEAT: when the bracket moves up a round, announce it in the middle of the screen the
  // same way the countdown and the win call do, so the tournament has a rhythm between fixtures
  // rather than just swapping panels.
  try{ var n0 = BR.nextMatch(T.br);
    if (n0 && n0.round !== lastRound){ lastRound = n0.round;
      var cE = document.querySelector('.hmCount'), _lbl = rdLabel(n0.round);
      if (cE){ cE.classList.add('hmMsg'); cE.textContent = _lbl;
        cE.classList.remove('hmCountPulse'); void cE.offsetWidth; cE.classList.add('hmCountPulse');
        setTimeout(function(){ if (cE.textContent === _lbl){ cE.textContent=''; cE.classList.remove('hmMsg'); } }, 1900); } }
  }catch(_){}
  var nm = BR.nextMatch(T.br);
  if (!nm){ T.phase = 'done'; paint(); return; }
  T.phase = 'bracket';
  /* The squads walk on BEFORE the screen that is about to talk about them, so
     they are already standing there when it settles in. */
  cast(nm);
  paint();
}

// ---------- UI ----------
var host = null;
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

/* HOW EACH TEAM'S CUP ENDED, in the cup's own voice. The top four are named by the result
   that settled them (the final and the playoff are real matches, so they get real words);
   everyone else is named by the round they went out of, which is the only thing the bracket
   actually knows about them. Returns a lookup rather than a table so paint() stays a
   renderer. */
function standingsElim(){
  var out = {}, total = T.br.rounds.length;
  T.br.rounds.forEach(function(rd, r){
    rd.matches.forEach(function(m){
      if (m.winner === undefined || m.a === undefined || m.b === undefined) return;
      out[m.winner === m.a ? m.b : m.a] = r;
    });
  });
  return function(id, rank){
    if (rank === 0) return 'Champion';
    if (rank === 1) return 'Runner-up';
    if (T.br.third && T.br.third.winner !== undefined){
      if (rank === 2) return 'Third place';
      if (rank === 3) return 'Fourth place';
    }
    var r = out[id];
    return (r === undefined) ? '—' : ('Out · ' + roundName(r, total));
  };
}

/* ---- THE CUP'S RUNNING ORDER, in one place. With the bronze match gone this is
   just the rounds, in order -- but it stays a function rather than an inlined
   `T.br.rounds.map`, because it is the one place that decides what a "section" of
   the board is, and the core can still be handed {third:true} by a future caller. */
function sections(){
  var total = T.br.rounds.length;
  var secs = T.br.rounds.map(function(rd, i){
    return { r:i, label:roundName(i, total), ms:rd.matches }; });
  if (T.br.third)
    secs.splice(secs.length - 1, 0, { r:'3p', label:roundName('3p', total), ms:[T.br.third] });
  return secs;
}
/* How far there is left to go, in the cup's own arithmetic. One short line, and it
   is the only number on the screen that is not a score. */
function distText(nm, total){
  if (!nm) return '';
  if (nm.round === '3p') return 'the bronze, then the cup';
  var left = total - 1 - nm.round;
  return left === 0 ? 'winner takes the cup' : (total - nm.round) + ' wins to the cup';
}

/* ---- THE TALE OF THE TAPE. §4.1's "see more that costs nothing": __hmSess has
   been recording every captain pairing and every head's matches since the page
   loaded, and nothing has ever read it back. Real data only -- no win
   probability, no form guide, no power ranking, because those are borrowed
   numeric economies implying a ladder that does not exist. Zero extra lines is
   a legitimate state, and the sheet does not shift, because it is centred rather
   than stacked. ---- */
function buildTape(A, B){
  var p = el('p', 'tvTape');
  if (A && B && A.seed && B.seed)
    p.appendChild(document.createTextNode('Seeds ' + A.seed + ' and ' + B.seed + '.'));
  try{
    var ka = A && A.slots && A.slots[0], kb = B && B.slots && B.slots[0];
    if (ka != null && kb != null && window.__hmSessFlags){
      var f = window.__hmSessFlags(ka, kb);
      if (f && f.met){
        p.appendChild(el('br'));
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

/* ---- THE DRAW. Jayden on the board this replaces: "Schedule looks out of place
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
   here that is genuinely information. ---- */
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

/* ---- THE FULL-DRAW SHEET. It exists for the phone and only for the phone.
   Desktop shows all three rounds in the rail, so a button that opens a copy of
   what is already on screen is one of the "random unnecessary elements" -- its
   chip is display:none above 760px. Below it the rail is reduced to the round
   being played, and this is where the other two live. ---- */
function ensureSheet(){
  var s = document.getElementById('tvSheet');
  if (s) return s;
  var scrim = el('div','tvSheetScrim'); scrim.id = 'tvSheetScrim';
  scrim.addEventListener('click', closeSheet);
  document.body.appendChild(scrim);
  s = el('div','tvSheetPanel'); s.id = 'tvSheet';
  s.setAttribute('role','dialog'); s.setAttribute('aria-modal','true');
  s.setAttribute('aria-label','The full draw');
  document.body.appendChild(s);
  addEventListener('keydown', function(e){
    if (e.key === 'Escape' && document.body.classList.contains('tvBoardOpen')) closeSheet(); });
  return s;
}
function openSheet(){
  var s = ensureSheet(); s.innerHTML = '';
  var hd = el('div','tvSheetHd');
  /* The sheet is where the cup's name lives on a phone: the strip drops it under
     560px because it cannot carry the name, the round and two controls at once. */
  hd.appendChild(el('h2','tvSheetTitle', (T.cup || 'Cup') + ' · the draw'));
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
  sl.appendChild(el('span', 'tvCup', T.cup || 'Cup'));
  sl.appendChild(el('span', 'tvSep', '·'));
  sl.appendChild(el('span', 'tvRound',
    done2 ? 'Champion' : (nm2 ? roundName(nm2.round, total) : 'Complete')));
  strip.appendChild(sl);

  var sr = el('div', 'tvStripR');
  if (nm2 && !done2) sr.appendChild(el('span', 'tvDist', distText(nm2, total)));
  /* Phone only -- above 760px the rail already shows all three rounds, so this
     opens a copy of what is on screen. tournament.css hides it there. */
  var boardBtn = el('button', 'tvChip tvChipDraw ' + CHIP); boardBtn.type = 'button';
  boardBtn.setAttribute('aria-label', 'The draw');
  boardBtn.appendChild(el('span', 'tvChipLbl', 'The draw'));
  boardBtn.appendChild(el('span', 'tvChipLblSm', 'Draw'));
  boardBtn.addEventListener('click', function(e){ e.stopPropagation(); openSheet(); });
  sr.appendChild(boardBtn);

  /* §1.8: opening the Play menu is a hard no-op for the whole duration of a cup.
     On index.html that was a guard -- the rest of the portfolio was one section
     down. Here the tournament IS the page, so the guard had become a trap. This
     is the scoped replacement: it belongs to the tournament, so it can end the
     cup without ending the visit. Two-tap arm, because it is destructive and
     it now sits next to a button people will actually press. */
  var quit = el('button', 'tvChip ' + CHIP); quit.type = 'button';
  quit.setAttribute('aria-label', 'Leave the cup');
  var qLbl = el('span', 'tvChipLbl', 'Leave the cup');
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
    armT = setTimeout(function(){ armed = false; say('Leave the cup', 'Leave');
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
    /* The champion takes the left column and the standings the right. */
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
    fix.appendChild(el('h2', 'tvChampNm', (wt ? wt.name : '—') + ' wins the cup'));
  } else {
    /* ---- THE MATCH-UP. Two captains, one under the other, with the lowercase
       `v.` between them -- the 1950s programme team-sheet grammar rather than a
       giant angled VS, which is the one piece of cosplay this screen is most
       likely to reach for.

       The round is NOT repeated here. It is already the second thing band A
       says, four lines above, and the duplicate was one of the elements that
       made the column read as busier than it is. What is left is the two things
       a visitor is here for -- who, and against whom -- plus the one true line
       of history this cup can produce, and one button.

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

  /* ---------- BAND B, right: the cup ledger ---------- */
  var rail = el('aside', 'tvRail');
  rail.setAttribute('aria-label', done2 ? 'Final standings' : 'The draw');
  if (done2){
    rail.appendChild(el('div', 'tvBoardHd', 'Final standings'));
    var grid = el('div', 'tvStandGrid');
    var elimAt = standingsElim();
    var order = BR.standings(T.br);
    /* THE TABLE'S SHAPE COMES FROM THE FIELD, not from a number in a stylesheet.
       Two columns reading downwards, so the rows are half the teams rounded up.
       tournament.css consumes this as --tvStandRows; hardcoding 4 there would
       have silently grown a third column the day FIELD stopped being eight,
       which is the exact class of bug the old `column-fill:auto` had. */
    grid.style.setProperty('--tvStandRows', String(Math.ceil(order.length / 2)));
    order.forEach(function(id, i){
      var tm = teamById(id);
      var row = el('div', 'tvStandRow');
      row.appendChild(el('span', 'tvStandRk', String(i + 1)));
      var c3 = el('i', 'tvFxC'); if (tm) c3.style.setProperty('--tcx', tm.col);
      row.appendChild(c3);
      var dt = el('span', 'tvFxF');
      var cu = tm && tm.captain && (tm.captain.portrait || tm.captain.cut);
      if (cu){ var im2 = el('img'); im2.src = cu; im2.alt = ''; im2.draggable = false; dt.appendChild(im2); }
      row.appendChild(dt);
      row.appendChild(el('span', 'tvStandNm', tm ? tm.name : '—'));
      row.appendChild(el('span', 'tvStandOut', elimAt(id, i)));
      grid.appendChild(row);
    });
    rail.appendChild(grid);
  } else {
    rail.appendChild(el('div', 'tvBoardHd', 'The draw'));
    var board = el('div', 'tvDraw');
    buildDraw(board, nm2);
    rail.appendChild(board);
  }
  body.appendChild(rail);
  h.appendChild(body);
}

// ---------- entry ----------
function start(){
  if (T.live) return;
  buildTeams(function(teams){
    T.live = true; T.phase = 'bracket';
    try{ var _pb=document.getElementById('gameBtn');
      if(_pb){_pb.setAttribute('aria-disabled','true');
              _pb.setAttribute('title','Finish the tournament first');} }catch(_){}
    T.cup = CUPS[Math.floor(Math.random() * CUPS.length)] + ' Cup';
    var idKey=T.cup.replace(/ Cup$/,'');
    T.id=CUP_ID[idKey]||CUP_ID['Apollo'];
    document.body.style.setProperty('--cupPaint',T.id.paint);
    document.body.style.setProperty('--cupStock',T.id.stock);
    document.body.style.setProperty('--cupSheen',T.id.sheen);
    T.br = BR.buildBracket(teams.map(function(t){ return t.id; })); lastRound = -1;
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
/* The finishing table as data, for anyone who wants it without scraping the DOM (and for
   the test harness, which has to assert the order rather than read it off a screen).
   Returns [] when no cup is running -- a conditional global with nothing to say. */
window.__hmTourStandings = function(){
  if (!T.live || !T.br) return [];
  return BR.standings(T.br).map(function(id, i){
    var tm = teamById(id);
    return { rank: i + 1, id: id, name: tm ? tm.name : null, seed: tm ? tm.seed : null,
             colour: tm ? tm.colName : null };
  });
};
})();
