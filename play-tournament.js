/* play-tournament.js -- Task 4: the cup travels to play.html.
   Ported verbatim from index.html's two tournament <script> blocks (bracket core, then the
   bracket/teams/UI module -- order is load-bearing: the UI module opens with
   `var BR = window.__hmBracket; if (!BR) return;`). One addition ahead of both: window.__hmTint,
   the egghead-dye function index.html only registers as a side effect of wiring its
   "Add an egghead" button -- a button play.html's menu does not have (spec 3.2). See that
   block's own comment for why porting just the function, not the button, is correct here.
   Consumes: window.__hmSess (play-engine.js:1308), window.__hmFillerData/__hmFillerAdd/
   __hmSlotFor/__hmSlots/__hmKill (play-engine.js), window.__EGGHEAD (egghead-seed.js),
   window.__hmSoccerStart/__hmSoccerEnd (play-engine.js), #moodBtn and .hero (play.html markup),
   #tHeadEdge (play.html's inline SVG filter defs). Produces: window.__hmTourStart, __hmTourStop,
   __hmTour, __hmTourWin, __hmTourAbort, window.__hmBracket, window.__hmChampFx, window.__hmTint. */

(function(){   // ===== TOURNAMENT: egghead dye, ported from index.html's "Add an egghead" module =====
// index.html registers window.__hmTint as a side effect of wiring the #addPlaceholder button
// (index.html:2717-2733). play.html's menu deliberately drops that button (spec 3.2 -- Task 3's
// moodMenu has no addPlaceholder, no #moodHeads, no "Show on home" toggle), but the tournament's
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
function buildBracket(seeds) {
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
     and round one carries byes (N=3), because a walkover has no loser to field. */
  if (rounds.length >= 2 && !(rounds.length === 2 && B - N > 0))
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
  function size(){ cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
                   g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  size();
  function seed(p, high){
    p.x = Math.random() * innerWidth;
    p.y = high ? -20 - Math.random() * innerHeight : -20 - Math.random() * 140;
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
    var ground = innerHeight - 4;
    g.clearRect(0, 0, innerWidth, innerHeight);
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

/* THE FIELD IS TWELVE (§3.7). It used to be padded up to a power of two so the bracket was
   always full and no walkover could ever happen -- which is the same thing as saying the
   field size was chosen by the bracket rather than by the cup. Twelve is not a power of two,
   so the bracket core's bye machinery (written and unit-tested long before it was needed)
   finally gets used: B=16, four byes, and the ITTF pairing rule puts all four on seeds 1-4
   with no BYE-vs-BYE, exactly as the brief asks. Eleven matches, plus the third-place
   playoff, is twelve fixtures. */
var FIELD = 12;

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

function startFixture(nm){
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


  paint();
  setTimeout(function(){
    try { if (window.__hmSoccerStart) window.__hmSoccerStart(); } catch (_) {}
    // Name the fixture AFTER kickoff: the scoreboard element does not exist until dom() builds it
    // on the first start(), so setting it beforehand silently did nothing on fixture one.
    setTimeout(function(){ try { var tt = document.querySelector('.hmScore .sTitleTxt');
      if (tt) tt.textContent = A.name + ' vs ' + Bm.name; } catch (_) {} }, 60);
  }, 620);
}

function clearSpawned(){
  // The eggheads this mode spawned are removed between fixtures; the visitor's own saved heads
  // are only ever BENCHED, never killed, so the home-screen crowd survives the whole tournament.
  (T.spawnedCuts || []).forEach(function(c){ try { window.__hmKill(c); } catch (_) {} });
  T.spawnedCuts = [];
  T.teams.forEach(function(tm){ tm.slots = []; });
}

function benchAll(){   // between fixtures nobody is on the pitch: the bracket screen is not a scene
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
  T.phase = 'bracket'; paint();
}

// ---------- UI ----------
var host = null;
function el(tag, cls, txt){ var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function dot(c){ var s = el('span', 'tDot'); s.style.background = rgb(c); return s; }
// A colour name alone does not say whose team it is -- the captain's face does. Every place a team
// is named shows the head that leads it, ringed in the team colour.
function faceOf(tm, cls){
  // The heads on this site are transparent cut-outs, not avatars. Cropping them into a circle
  // fought their own silhouette and clipped hair and chins at every size. Show the whole head,
  // contained, and let the colour bar carry the team identity instead.
  var w = el('span', 'tFaceW' + (cls ? ' ' + cls : ''));
  if (tm && tm.captain && tm.captain.cut){
    var im = el('img'); im.src = tm.captain.portrait || tm.captain.cut; im.alt = ''; im.draggable = false;
    w.appendChild(im);
  }
  return w;
}

/* ---- THE STADIUM. Two decorative layers behind the draw, both built from things
   the site already owns. The PITCH is one receding hairline plane: BUCK built the
   VALORANT Champions package on "a flexible, three-dimensional perspective grid"
   and moved a camera through it, and a perspective plane is where the depth comes
   from -- not from shadows stacked on cards. The CROWD is the real head cut-outs,
   the same ones playing the fixture, sat in the stand bobbing on the site's 8fps
   clock. Both are aria-hidden: they carry no information, and the names are
   already in the cards. Seeded off the cup name so a repaint does not reshuffle
   the crowd mid-tournament. ---- */
function paintStadium(h){
  if (!h || h.querySelector('.tPitch')) return;
  var br = h.querySelector('.tBrMir'); if (!br) return;
  var pitch = el('div', 'tPitch'); pitch.setAttribute('aria-hidden', 'true');
  br.insertBefore(pitch, br.firstChild);

  var faces = (T.teams || []).map(function(t){ return t && t.captain && (t.captain.portrait || t.captain.cut); }).filter(Boolean);
  if (!faces.length) return;
  var crowd = el('div', 'tCrowd'); crowd.setAttribute('aria-hidden', 'true');
  // a tiny deterministic PRNG: the same cup always seats the same crowd
  var seed = 0, cup = String(T.cup || 'cup');
  for (var c = 0; c < cup.length; c++) seed = (seed * 31 + cup.charCodeAt(c)) >>> 0;
  function rnd(){ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  // Three tiers, so it reads as a stand rather than a dotted line: the front row is
  // bigger, darker and cropped by the edge; the back rows sit higher, smaller and
  // fainter. Heads overlap horizontally on purpose -- a crowd is packed, not spaced.
  // Three REAL rows. The old code cycled tiers with i%3, so the rows interleaved
  // left-to-right and the bottoms were only 25px apart inside a 74px box -- it measured
  // as three tiers and read as one jittered line. Now each tier is laid out as its own
  // row, back to front, with a genuine size/height/softness gradient between them.
  var TIERS = [
    { n:13, w:30, b:66, o:0.13, fb:3.2 },   // back  -- small, high, softest
    { n:11, w:42, b:34, o:0.19, fb:1.9 },   // middle
    { n: 9, w:58, b: 2, o:0.24, fb:0.9 }    // front -- big and low, but NEVER fully sharp:
    // a photographic head keeps real mid-tone detail under grayscale, so at blur 0 it was the
    // one recognisable face in the stand and read as a person standing in front of the bracket
  ];
  var fi = 0;
  TIERS.forEach(function(t, ti){
    for (var i = 0; i < t.n; i++){
      var f = el('span', 'tFan');
      var w = t.w + Math.round(rnd() * (t.w * 0.18));
      f.style.backgroundImage = 'url("' + faces[fi % faces.length] + '")'; fi++;
      f.style.width  = w + 'px';
      f.style.height = Math.round(w * 1.25) + 'px';
      // spread across the full width, then jitter, so a row never looks like a ruler
      f.style.left   = ((i + 0.5) / t.n * 108 - 4 + (rnd() - 0.5) * 6).toFixed(2) + '%';
      f.style.bottom = (t.b + Math.round(rnd() * 6)) + 'px';
      f.style.zIndex = String(ti + 1);          // front row paints over the back
      f.style.setProperty('--fb', t.fb.toFixed(1) + 'px');
      // flat-coloured eggheads collapse to a solid shape under grayscale and read heavier
      // than a photographic head at the same luminance, so they carry less opacity
      var flat = /^data:/.test(faces[(fi - 1) % faces.length]) ? 0 : 0.04;
      f.style.opacity = (t.o + rnd() * 0.04 - flat).toFixed(3);
      crowd.appendChild(f);
    }
  });
  br.insertBefore(crowd, br.firstChild.nextSibling);
}
function ensureHost(){
  if (host) return host;
  host = el('div', 'tourPanel'); host.id = 'tourPanel';
  (document.querySelector('.hero') || document.body).appendChild(host);
  if(!document.getElementById('bcSting')){
    var st=document.createElement('div');st.id='bcSting';st.className='bcSting';
    st.innerHTML='<b></b>';document.body.appendChild(st);}
  return host;
}

/* Deterministic per-cup randomness: same cup name -> same board every repaint. */
function cupRand(seed){var h=2166136261;
  for(var i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619);}
  return function(){h=Math.imul(h^(h>>>15),2246822507);
    h=Math.imul(h^(h>>>13),3266489909);return((h^=h>>>16)>>>0)/4294967296;};}

function bcSheenOnce(el){el.classList.add('bcSheen');
  requestAnimationFrame(function(){el.classList.add('on');
    setTimeout(function(){el.classList.remove('on');},800);});}

function bcSting(onCovered){
  var rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var el=document.getElementById('bcSting');
  if(rm||!el){try{onCovered();}catch(_){ } return;}
  el.classList.add('on');
  setTimeout(function(){try{onCovered();}catch(_){}},350);
  setTimeout(function(){el.classList.remove('on');},760);}

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

/* A team never contributes just a fill. It contributes a fill, the text colour that is
   guaranteed to clear 4.5:1 ON that fill, and a darker edge so a pale chip still has an
   outline on paper. Setting them together is the only way they cannot drift apart. */
function tint(node, tm){
  if (!node || !tm) return node;
  node.style.setProperty('--tc', tm.col);
  node.style.setProperty('--ti', tm.ink  || '18,18,18');
  node.style.setProperty('--te', tm.edge || tm.col);
  return node;
}
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

function paint(){
  var h = ensureHost();
  if (!T.live){
    h.innerHTML = ''; h.hidden = true;
    document.body.classList.remove('tSchedOpen');
    try{ var _hero = document.querySelector('.hero'); if (_hero) _hero.style.minHeight = ''; }catch(_){}
    return;
  }
  h.hidden = false;
  h.innerHTML = '';

  // ---- ONE CAPSULE: title, matchup, kick off, collapsible schedule ----
  var nm2 = BR.nextMatch(T.br);
  var champ2 = BR.champion(T.br);
  var cup = el('div', 'tCup');


  // header: the trophy, then a single h1 carrying BOTH the cup name and the round
  var head = el('div', 'tCupHead');
  var trophy = el('span', 'tCupTrophy');
  var timg = el('img'); timg.src = 'images/trophy.webp'; timg.alt = ''; timg.draggable = false;
  trophy.appendChild(timg);
  trophy.appendChild(el('i', 'tCupGlint'));
  // the glisten is masked by the trophy's own shape, so it sweeps the cup and not its box
  trophy.style.setProperty('--tropMask', 'url("images/trophy.webp")');
  head.appendChild(trophy);
  var h1 = el('h1', 'tCupH1', T.cup || 'Cup');
  // NOT named roundName -- that identifier is the module-level voice-aware helper (Step 1);
  // shadowing it here with a plain string would have quietly broken every call below it.
  var roundTxt = champ2 !== undefined ? 'Champion'
               : (nm2 ? roundName(nm2.round, T.br.rounds.length) : 'Complete');
  /* The capsule shows the final's matchup BEFORE kickoff, and body.hmFinal is only set once
     the match starts -- so the poster needs its own flag for "this screen is the final". */
  /* Which poster this round gets, and where its heads sit. The FINAL has its own artwork;
     ordinary matchups draw from a pool, picked per fixture so it does not reshuffle on every
     repaint. Head positions are measured off each poster and travel WITH it, because every
     artwork frames its heads differently. */
  var POSTERS = {
    /* Sizes are deliberately large. A head cutout carries transparent margin, so the VISIBLE
       face is a good deal smaller than the image box -- percentages that look right on paper
       render small. And the heads go in each poster's EMPTY space, never over artwork that
       already has heads in it. */
    fin:   { src:'images/poster-final.webp',   hx:'23%', hx2:'77%', hy:'76%', hw:'46%' },
    match:[{ src:'images/poster-match-1.webp', hx:'25%', hx2:'75%', hy:'79%', hw:'46%' },
           { src:'images/poster-match-2.webp', hx:'24%', hx2:'76%', hy:'78%', hw:'46%' }]
  };
  try{
    var isFin = !!(nm2 && champ2 === undefined && nm2.round === T.br.rounds.length - 1);
    var isMatch = !!(nm2 && champ2 === undefined && !isFin);
    document.body.classList.toggle('tourFinal', isFin);
    document.body.classList.toggle('tourPoster', isFin || isMatch);
    var P = null;
    if (isFin) P = POSTERS.fin;
    else if (isMatch){
      var pool = POSTERS.match;
      /* RANDOM per fixture, and remembered. Deriving it from the fixture index gave a fixed
         rotation -- quarter-final 1 was always the same poster -- which is not what a pool of
         artwork is for. The pick is cached on the match object so a repaint keeps the poster
         it already showed rather than reshuffling under you mid-matchup. Only the final is
         fixed, because the final has its own artwork. */
      var mm = nm2.match || nm2;
      if (mm.__poster === undefined) mm.__poster = Math.floor(Math.random() * pool.length);
      P = pool[mm.__poster % pool.length];
    }
    if (P){
      var st = document.body.style;
      st.setProperty('--poster', 'url("'+P.src+'")');
      st.setProperty('--hx', P.hx); st.setProperty('--hx2', P.hx2);
      st.setProperty('--hy', P.hy); st.setProperty('--hw', P.hw);
    }
  }catch(_){}
  h1.appendChild(el('span', 'tCupRound', roundTxt));
  head.appendChild(h1);
  cup.appendChild(head);

  // matchup, or the champion once it is decided
  var card = el('div', 'tCupCard');
  function cupSide(tm, scoreTxt){
    var side = el('div', 'tCupSide');
    if (tm){ side.style.setProperty('--tc', tm.col);
             side.style.setProperty('--ti', tm.ink || '255,255,255');
             side.style.setProperty('--te', tm.edge || tm.col); }
    var pan  = el('div', 'tCupPanel');
    var cut = tm && tm.captain && (tm.captain.portrait || tm.captain.cut);
    if (cut){ var bi = el('img'); bi.className = 'tCupBig'; bi.src = cut; bi.alt = '';
              bi.draggable = false; pan.appendChild(bi);     // INSIDE, so the panel crops it
              /* The head is recoloured to its OWN team's hue. The captains are dyed
                 independently of the palette, so a yellow panel was drawing a purple head and
                 a blue panel an orange one -- two sources of truth for "what colour is this
                 team". The ring used to hide that seam; with the ring gone the mismatch was
                 the loudest thing on the screen. A colour-blended layer masked to the same cut
                 takes the team's hue and keeps the head's own shading, so it reads as the same
                 head, lit differently -- not as a flat swatch. */
              var tint = el('div', 'tCupTint');
              tint.setAttribute('aria-hidden','true');
              tint.style.webkitMaskImage = 'url("' + cut + '")';
              tint.style.maskImage = 'url("' + cut + '")';
              /* Wrapped WITH the image rather than positioned beside it. My first version gave
                 the tint its own width and a guessed aspect-ratio, so it missed the head's box
                 by a few pixels and left an untinted band along the top. inset:0 inside a
                 wrapper the image itself sizes cannot drift. */
              var wrap = el('div', 'tCupBigWrap');
              /* Measure how much of this cut is actually face. Cached by src -- the alpha scan
                 is one 64px canvas read, and only once per distinct head. */
              (function(w, src){
                try{
                  window.__hmFit = window.__hmFit || {};
                  var apply = function(f){ w.style.setProperty('--fit', f.toFixed(3)); };
                  if (window.__hmFit[src] !== undefined){ apply(window.__hmFit[src]); return; }
                  var probe = new Image();
                  probe.onload = function(){
                    try{
                      var N = 64, c = document.createElement('canvas');
                      c.width = c.height = N;
                      var g = c.getContext('2d', {willReadFrequently:true});
                      g.drawImage(probe, 0, 0, N, N);
                      var d = g.getImageData(0, 0, N, N).data;
                      /* HORIZONTAL extent -- the wrap is sized by width, so width is the axis
                         that has to match. I measured the vertical fraction first, which is not
                         comparable between cuts of different aspect ratios and left mini-Jayden
                         still visibly small. Measured: his face fills 0.547 of its width, an
                         ordinary cut 0.813. */
                      var minX = N, maxX = -1;
                      for (var x = 0; x < N; x++){
                        for (var y = 0; y < N; y++){
                          if (d[(y*N + x)*4 + 3] > 24){ if (x < minX) minX = x; if (x > maxX) maxX = x; break; }
                        }
                      }
                      var frac = (maxX >= minX) ? (maxX - minX + 1) / N : 1;
                      var fit = Math.max(1, Math.min(1.9, 0.81 / Math.max(0.3, frac)));
                      window.__hmFit[src] = fit; apply(fit);
                    }catch(_){}
                  };
                  probe.src = src;
                }catch(_){}
              })(wrap, cut);
              pan.removeChild(bi); wrap.appendChild(bi); wrap.appendChild(tint);
              pan.appendChild(wrap); }
    side.appendChild(pan);
    var meta = el('div', 'tCupMeta');
    meta.appendChild(el('div', 'tCupNm', tm ? tm.name : '\u2014'));
    // no score here: it is 0-0 until the whistle, which says nothing. The live score lives on
    // the scoreboard during the match, and the result lives in the schedule afterwards.
    if (scoreTxt) meta.appendChild(el('span', 'tCupSc', scoreTxt));
    side.appendChild(meta);
    return side;
  }
  if (champ2 !== undefined){
    var wt = teamById(champ2);
    var solo = el('div', 'tCupMatch'); solo.style.gridTemplateColumns = '1fr';
    var champSide = cupSide(wt, null);
    /* Crown and cup go INSIDE the panel. The card clips to its 28px radius, so anything
       positioned above the panel would simply be cut off. */
    var cpan = champSide.querySelector('.tCupPanel');
    if (cpan){
      /* Head and crown into one wrapper, so the sway carries both and the crown is
         positioned against the HEAD's box rather than the panel's -- that is what makes it
         sit ON the head instead of floating at some fraction of the panel. */
      var cel = el('div', 'tCupCelebrate');
      var bigImg = cpan.querySelector('.tCupBigWrap') || cpan.querySelector('.tCupBig');
      if (bigImg) cel.appendChild(bigImg);
      cpan.appendChild(cel);
      var crown = el('div', 'tCupCrown');
      // the same path the heads already wear when they win, so the two cannot drift apart
      crown.innerHTML = '<svg viewBox="0 0 48 34" aria-hidden="true">'
        + '<path d="M4 30 L4 15 L13 22 L24 6 L35 22 L44 15 L44 30 Z" fill="#e8b53a" '
        +   'stroke="#c9962a" stroke-width="1.2" stroke-linejoin="round"/>'
        + '<circle cx="4" cy="13" r="3.4" fill="#f0c94e"/>'
        + '<circle cx="24" cy="4" r="3.8" fill="#f0c94e"/>'
        + '<circle cx="44" cy="13" r="3.4" fill="#f0c94e"/>'
        + '<rect x="4" y="30" width="40" height="3.4" rx="1.4" fill="#d7a531"/></svg>';
      cel.appendChild(crown);
    }
    solo.appendChild(champSide);
    card.appendChild(solo);
    try{ window.__hmChampFx(wt && wt.col); }catch(_){}
  } else {
    try{ window.__hmChampFx(null); }catch(_){}   // any non-champion repaint stops the fall
  }
  if (nm2 && champ2 === undefined){
    var A2 = teamById(nm2.match.a), B2 = teamById(nm2.match.b);
    var mrow = el('div', 'tCupMatch');
    mrow.appendChild(cupSide(A2, null));
    mrow.appendChild(el('div', 'tCupVs', 'VS'));
    mrow.appendChild(cupSide(B2, null));
    card.appendChild(mrow);
    /* On the final, the names live UNDER the poster rather than on it. Built as their own row
       instead of repositioning .tCupMeta, so the artwork carries no text layer at all. */
    if (document.body.classList.contains('tourPoster')){
      var names = el('div', 'tCupNames');
      names.appendChild(el('span', null, (A2 && A2.name) || '\u2014'));
      names.appendChild(el('span', null, (B2 && B2.name) || '\u2014'));
      card.appendChild(names);
    }
  }
  cup.appendChild(card);

  // Kick off AND the way out both sit in the matchup container -- neither should have to be
  // hunted for, and the quit was previously stranded at the very bottom of the panel.
  var acts = el('div', 'tCupActs');
  if (nm2 && champ2 === undefined && T.phase === 'bracket'){
    var go2 = el('button', 'tCupGo hmBtn hmBtnPrimary', 'Kick off'); go2.type = 'button';
    go2.addEventListener('click', function(e){ e.stopPropagation(); T.phase = 'match'; startFixture(nm2); });
    acts.appendChild(go2);
  }
  var done2 = (champ2 !== undefined);
  /* On the champion screen this is the ONLY action left, so it is the primary one. Mid-
     tournament it sits under Kick off and stays quiet -- same button, different job. */
  var quit = el('button', 'tCupQuit hmBtn' + (done2 ? ' hmBtnPrimary' : ''),
                done2 ? 'Back to the hero' : 'End tournament');
  quit.type = 'button';
  var armed2 = false, armT2 = 0;
  quit.addEventListener('click', function(e){
    e.stopPropagation();
    if (done2 || armed2){ stop(); return; }
    armed2 = true; quit.textContent = 'Tap again to end'; quit.classList.add('tQuitArmed');
    clearTimeout(armT2);
    armT2 = setTimeout(function(){ armed2 = false; quit.textContent = 'End tournament';
      quit.classList.remove('tQuitArmed'); }, 3200);
  });
  acts.appendChild(quit);
  cup.appendChild(acts);

  /* ---- FINAL STANDINGS (§3.8). Quiet by instruction: a 1-N table, one row per competitor,
     no medals, no confetti of its own, no mention of what anyone might use it for. It is the
     cup's own record of who finished where, printed once the cup is decided, and it is
     copyable because a list you can only look at is a list you have to retype. ---- */
  if (champ2 !== undefined){
    var order = BR.standings(T.br);
    var elimAt = standingsElim();
    var st = document.createElement('section');
    st.className = 'tStand'; st.setAttribute('aria-label', 'Final standings');
    var sh = el('div', 'tCupSchedHd');
    sh.appendChild(document.createTextNode('Final standings'));
    var copy = el('button', 'tStandCopy hmBtn', 'Copy'); copy.type = 'button';
    copy.addEventListener('click', function(e){
      e.stopPropagation();
      var txt = order.map(function(id, i){
        var tm = teamById(id); return (i + 1) + '. ' + (tm ? tm.name : '—'); }).join('\n');
      var ok = function(){ copy.textContent = 'Copied';
        setTimeout(function(){ copy.textContent = 'Copy'; }, 1600); };
      try{
        if (navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(txt).then(ok, function(){ fallback(); });
        } else fallback();
      }catch(_){ fallback(); }
      function fallback(){
        try{ var ta = document.createElement('textarea'); ta.value = txt;
          ta.setAttribute('readonly',''); ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select(); document.execCommand('copy');
          ta.remove(); ok(); }catch(_){}
      }
    });
    sh.appendChild(copy);
    st.appendChild(sh);
    var tbl = document.createElement('table'); tbl.className = 'tStandTbl';
    var tb = document.createElement('tbody');
    order.forEach(function(id, i){
      var tm = teamById(id);
      var tr = document.createElement('tr');
      tr.className = 'tStandRow' + (i < 3 ? ' tStandTop' : '');
      var c1 = document.createElement('td'); c1.className = 'tStandRk';
      c1.textContent = String(i + 1); tr.appendChild(c1);
      var c2 = document.createElement('td'); c2.className = 'tStandWho';
      var dt = el('span', 'tCupDot');
      if (tm){ tint(dt, tm);
        var cu = tm.captain && (tm.captain.portrait || tm.captain.cut);
        if (cu){ var im2 = el('img'); im2.src = cu; im2.alt = ''; im2.draggable = false; dt.appendChild(im2); } }
      c2.appendChild(dt);
      c2.appendChild(el('span', 'tCupFxNm', tm ? tm.name : '—'));
      tr.appendChild(c2);
      var c3 = document.createElement('td'); c3.className = 'tStandOut';
      c3.textContent = elimAt(id, i); tr.appendChild(c3);
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    st.appendChild(tbl);
    cup.appendChild(st);
  }

  // ---- the schedule. Always open, ON THE CHAMPION SCREEN TOO -- the completed, all-torn
  // record stays on screen behind the trophy card. Saved scores render here. ----
  /* A plain section, not a <details>. The schedule does not collapse any more, so the
     disclosure was an affordance for a state that no longer exists -- and dropping it also
     drops the <details> flex trap that cost three wrong fixes. */
  var sched = document.createElement('section'); sched.className = 'tCupSched';
  sched.setAttribute('aria-label', 'Schedule');
  /* Sizes the block and the schedule scroller against the page. .tourPanel is absolutely
     positioned, so it contributes nothing to the hero's layout and has to be told. */
  function syncHero(){
    var hero = document.querySelector('.hero'); if (!hero) return;
    requestAnimationFrame(function(){
      /* Cleared FIRST, so the hero is measured at its own CSS height rather than at whatever
         a previous pass forced on it. The hero is never measured back to the block: the block
         takes its height from the hero, so the reverse would be a circle -- block grows, hero
         grows to fit, block fills the new hero. */
      hero.style.minHeight = '';
      /* How far the hero sits below the top of the page. Taken from the hero's own document
         offset rather than the block's, so it does not depend on the shift already applied --
         reading a value you are about to change is how the last three of these went wrong.
         rect + scrollY is a document coordinate, so it is the same at any scroll position. */
      var shift = Math.max(0, Math.round(hero.getBoundingClientRect().top + window.scrollY));
      document.body.style.setProperty('--tourShift', shift + 'px');
      /* Size the scroller explicitly rather than by flex -- the parent used to be a
         <details>, whose light-DOM children are not reliable flex items, and measuring is
         deterministic regardless.
         Always as the difference between two rects --
         that is scroll-invariant, because both shift by the same amount. The old
         `window.innerHeight - top` was not, which is exactly why the block stopped lining up
         the moment you scrolled. CSS bottom:0 only gets us to #main, and the hero actually
         overflows #main by a few px, so the anchor has to be measured. */
      var heroBottom = hero.getBoundingClientRect().bottom;
      /* The block runs PAST the tab row; the schedule inside it stops just ABOVE that row.
         The tabs now sit in front of the block, so a list that ran under them would have its
         last rows hidden behind the labels. Two anchors, one element apart. */
      var tabs = document.querySelector('.csTabs');
      var tabsR = tabs ? tabs.getBoundingClientRect() : null;
      var footAnchor = tabsR ? tabsR.bottom : heroBottom;
      var listAnchor = tabsR ? tabsR.top    : heroBottom;
      cup.style.minHeight =
        Math.max(0, Math.round(footAnchor - cup.getBoundingClientRect().top)) + 'px';
      {
        /* Read live off the DOM (querySelector) -- the row heights are whatever the ticket
           CSS renders THIS repaint (padding/margin changed with the ticket restyle), never
           assumed or cached. sched has no .tCupSchedIn on the champion screen, so inn is
           simply null there and this whole block is skipped -- no special-casing needed. */
        var inn = sched.querySelector('.tCupSchedIn');
        if (inn){
          /* The scroller absorbs the leftover room, which is what keeps the block ending
             flush with the hero rather than running past it -- but snapped DOWN to a whole
             row. Filling the space exactly sliced the last fixture through the middle of its
             name, which just reads as broken. Rows are snapped to rather than multiplied out
             because the round headings between them mean they are not on a fixed pitch. */
          var innTop = inn.getBoundingClientRect().top;
          var avail  = listAnchor - innTop - 16;
          var snap = 0, first = 0;
          [].forEach.call(inn.querySelectorAll('.tCupFx'), function(row){
            var edge = row.getBoundingClientRect().bottom - innTop + inn.scrollTop;
            if (!first || edge < first) first = edge;
            if (edge <= avail && edge > snap) snap = edge;
          });
          /* The floor is one whole row, not a round number -- a fixed 96px was not on a row
             boundary, so on a short screen it beat the snap and sliced the row anyway. */
          inn.style.maxHeight = Math.round(snap || first || avail) + 'px';
        }
      }
    });
  }
  document.body.classList.add('tSchedOpen');
  requestAnimationFrame(syncHero);
  if (!T._schedResize){ T._schedResize = true;
    addEventListener('resize', function(){ try{ syncHero(); }catch(_){} }, {passive:true}); }

  /* The champion screen keeps the Draw Board -- this was mis-scoped in the original brief
     (which assumed a "no schedule on champion" state that never existed pre-Plan-2): the
     completed, all-torn ticket record stays on screen behind the trophy card, same as the
     pre-Plan-2 layout. Grain stays on with it; the only teardown is stop(). */
  {
    var totalRds = T.br.rounds.length;
    /* nm2 (already computed above for the VS card) IS the schedule's own "you are here" -- it
       stays correct across the one frame where T.cur still lags it (the repaint fired mid-
       __hmTourWin, right after a result lands but before T.cur is nulled), which is exactly
       when the dot should already have moved to the NEXT fixture rather than lingering on the
       one just torn. */
    var sum = el('div', 'tCupSchedHd');
    sum.appendChild(document.createTextNode('Schedule'));
    /* The distance line only makes sense while there IS a distance -- once nm2 is gone (the
       cup is won, or the no-next-match 'Complete' edge case) there is no next round to name and
       no wins left to count, so the line goes quiet rather than freezing on stale text ("The
       Final . winner takes the cup" printed under a champion who already has it). */
    if (nm2){
      var curRd = nm2.round;
      /* The playoff is off the ladder -- nobody in it can still win the cup, so counting
         wins-to-the-cup from it would print a number that is not true of either side. */
      sum.appendChild(el('span', 'tkDist',
        roundName(curRd, totalRds) + ' \u00b7 ' +
        (curRd === '3p'                ? 'the bronze, then the cup'
         : (totalRds - 1 - curRd === 0) ? 'winner takes the cup'
                                        : (totalRds - curRd) + ' wins to the cup')));
    }
    sched.appendChild(sum);
    var schedIn = el('div', 'tCupSchedIn');
    /* T.__decided is the one-time tear/stamp ledger -- start() creates it fresh, stop() clears
       it, and this is a defensive re-arm in case paint() is ever reached before start() runs. */
    T.__decided = T.__decided || {};
    /* The h1 names the round and the schedule names it again a few hundred pixels below. I
       first tried dropping the heading, which was wrong twice over: T.br.rounds always holds
       every round so the condition never fired, and the headings are what make the list
       scannable. Marking WHICH round is live is the better answer -- it turns the repetition
       into a position indicator instead of an echo. */
    var _now = (T.cur && T.cur.round !== undefined) ? T.cur.round : -1;
    /* The list is built from SECTIONS rather than straight off T.br.rounds, because the
       third-place playoff is not a round (see matchAt) and yet has to appear in playing
       order -- after the semi-finals, before the final, which is when nextMatch() serves
       it. Splicing it into a section list keeps that in one place; T.br.rounds itself is
       never touched, so nothing that measures rounds.length is disturbed. */
    var secs = T.br.rounds.map(function(rd, _ri){
      return { r: _ri, label: roundName(_ri, totalRds), ms: rd.matches }; });
    if (T.br.third)
      secs.splice(secs.length - 1, 0, { r: '3p', label: roundName('3p', totalRds), ms: [T.br.third] });
    /* The auto-advance beat for the byes: they resolve before a ball is kicked, so without
       this the very first paint of the board shows four fixtures that were already over and
       never says why. Tearing their stubs off in sequence, once, is the beat -- the same
       tear the played fixtures get, so it reads as "these were settled", not as an effect. */
    var byeBeat = !T.__byeBeat, byeN = 0;
    if (byeBeat) T.__byeBeat = 1;
    secs.forEach(function(sec, _si){
      var rd = { matches: sec.ms }, _ri = sec.r;
      var rdBox = el('div', 'tCupRd');
      rdBox.appendChild(el('div', 'tCupRdH' + (_ri === _now ? ' tRdNow' : ''), sec.label));
      rd.matches.forEach(function(m, _mi){
        // round x fixture-index key: the one identity a ticket keeps across every repaint, so
        // its serial, its tear-once state and its jitter all agree with each other and with
        // themselves on the next paint.
        var key = _ri + '-' + _mi;
        var tbd = (m.a === undefined && m.b === undefined);
        var decided = (m.sa !== undefined && m.sb !== undefined);
        /* A BYE IS NOT A FIXTURE AND NOT A BLANK. It has exactly one competitor, it was
           settled by the draw, and it can never be played -- so it gets its own ticket
           state rather than borrowing "TBD" (which means nobody has qualified YET and is
           a lie about a slot nobody will ever fill) or "decided" (which promises a score).
           \u00a73.7: ghost cards with an auto-advance beat, never empty boxes. */
        var isBye = !!m.bye;
        var isLive = !!(nm2 && nm2.round === _ri && nm2.index === _mi);
        var freshTear = false;
        if (decided && !T.__decided[key]){ T.__decided[key] = 1; freshTear = true; }
        var freshBye = false;
        if (isBye && byeBeat && !T.__decided[key]){ T.__decided[key] = 1; freshBye = true; }
        /* Neither side decided yet: no ring on the empty thumbnails. Filled, they read as
           "not played"; hollow, they read as a real fixture with the heads missing. .tkPend
           is the same TBD state wearing the ticket's faded-stock look. */
        var fx = el('div', 'tCupFx'
          + (tbd ? ' tFxTbd tkPend' : '')
          + (isBye ? ' tFxBye' : '')
          + (decided || isBye ? ' tkTorn' : '')
          + (freshTear || freshBye ? ' tkTear' : ''));
        if (isLive) fx.appendChild(el('span', 'tkDot'));
        function fxSide(id){
          var tm = teamById(id);
          var won = (m.winner !== undefined && m.winner === id);
          var sd = el('div', 'tCupFxSide' + (won ? ' tCupWon' : '')
                                          + (isBye && !tm ? ' tFxByeSide' : ''));
          var dot = el('span', 'tCupDot');
          if (tm){ tint(dot, tm);
            var cut2 = tm.captain && (tm.captain.portrait || tm.captain.cut);
            if (cut2){ var di = el('img'); di.src = cut2; di.alt = ''; di.draggable = false; dot.appendChild(di); } }
          sd.appendChild(dot);
          // the empty half of a bye names the thing that happened, not an em-dash placeholder
          sd.appendChild(el('span', 'tCupFxNm', tm ? tm.name : (isBye ? 'Bye' : '\u2014')));
          return sd;
        }
        fx.appendChild(fxSide(m.a));
        fx.appendChild(fxSide(m.b));
        // the stub: ADMIT-ONE serial plus the score/arrow region, torn edge once decided
        var stub = el('div', 'tkStub');
        var pfx = (T.id && T.id.pfx) || 'CUP';
        // serial counts SECTIONS, not round indices -- '3p' is a string and 100*'3p' is NaN
        var serial = pfx + '-' + ('000' + (100 * (_si + 1) + _mi)).slice(-4);
        stub.appendChild(el('span', 'tkSerial', serial));
        var aWon = (m.winner !== undefined && m.winner === m.a);
        var bWon = (m.winner !== undefined && m.winner === m.b);
        var sc = el('span', 'tCupFxSc' + (decided || isBye ? '' : ' tCupPend'));
        if (aWon) sc.appendChild(el('i', 'tCupArrow tArrL'));
        if (decided) sc.appendChild(el('span', 'tkStamp bcNum', m.sa + ' \u2013 ' + m.sb));
        else if (isBye) sc.appendChild(el('span', 'tkStamp tkByeStamp', 'BYE'));
        else sc.appendChild(document.createTextNode('\u2013'));
        if (bWon) sc.appendChild(el('i', 'tCupArrow tArrR'));
        stub.appendChild(sc);
        fx.appendChild(stub);
        /* The beat is a stagger, not a chorus: the four byes tear a fifth of a second apart
           so the eye can follow which seeds were carried through. Delay is set on the node
           because the tear keyframes are shared with the played fixtures and must not learn
           about byes. */
        if (freshBye){
          var d = (byeN++ * 0.18 + 0.25).toFixed(2) + 's';
          try{ stub.style.animationDelay = d;
               var _st = sc.querySelector('.tkStamp');
               if (_st) _st.style.animationDelay = (byeN * 0.18 + 0.25).toFixed(2) + 's'; }catch(_){}
        }
        // jitter, seeded per fixture so a repaint never reshuffles it (T.rnd is NEVER touched here)
        var jr = cupRand(T.cup + key);
        bcJitter(fx, jr, 0.5, 1);
        rdBox.appendChild(fx);
      });
      schedIn.appendChild(rdBox);
    });
    sched.appendChild(schedIn);
    cup.appendChild(sched);
    bcGrainOn(schedIn);
  }
  h.appendChild(cup);
  paintStadium(h);

  // (The way out lives in the matchup container now -- see .tCupQuit above.)


}

// ---------- entry ----------
function start(){
  if (T.live) return;
  buildTeams(function(teams){
    T.live = true; T.phase = 'bracket';
    try{ var _pb=document.getElementById('moodBtn');
      if(_pb){_pb.setAttribute('aria-disabled','true');
              _pb.setAttribute('title','Finish the tournament first');} }catch(_){}
    T.cup = CUPS[Math.floor(Math.random() * CUPS.length)] + ' Cup';
    var idKey=T.cup.replace(/ Cup$/,'');
    T.id=CUP_ID[idKey]||CUP_ID['Apollo'];
    T.rnd=cupRand(T.cup);
    T.__decided = {};   // one-time tear/stamp ledger, fresh for this tournament
    T.__byeBeat = 0;    // ...and the byes get their auto-advance beat once, on the first board
    document.body.style.setProperty('--cupPaint',T.id.paint);
    document.body.style.setProperty('--cupStock',T.id.stock);
    document.body.style.setProperty('--cupSheen',T.id.sheen);
    T.br = BR.buildBracket(teams.map(function(t){ return t.id; })); lastRound = -1;
    document.body.classList.add('hmTour');
    benchAll(); paint();
  });
}
function stop(){
  T.live = false; T.cur = null; T.phase = 'idle';
  T.__decided = {};   // next tournament's tickets tear fresh, not pre-marked from this one
  T.__byeBeat = 0;
  try{ document.body.classList.remove('hmFinal'); }catch(_){}
  try{ var _pb2=document.getElementById('moodBtn');
    if(_pb2){_pb2.removeAttribute('aria-disabled');_pb2.removeAttribute('title');} }catch(_){}
  try{ window.__hmChampFx(null); }catch(_){}   // the fall must not outlive the tournament
  bcGrainOff();   // the grain must not outlive the board either
  try{ document.body.style.removeProperty('--cupPaint');
       document.body.style.removeProperty('--cupStock');
       document.body.style.removeProperty('--cupSheen'); }catch(_){}
  window.__hmBench = null; window.__hmTeamSel = null; window.__hmTeamCol = null;
  try { var rt2 = document.documentElement; ['--tcol1','--tcol2','--tc1','--tc2'].forEach(function(v){ rt2.style.removeProperty(v); }); } catch (_) {}
  document.body.classList.remove('hmTour');
  document.body.classList.remove('tourFinal');
  document.body.classList.remove('tourPoster');
  try { var tt2 = document.querySelector('.hmScore .sTitleTxt'); if (tt2) tt2.textContent = 'Soccer'; } catch (_) {}
  clearSpawned(); paint();
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
