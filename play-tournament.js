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

(function(){   // ===== TOURNAMENT: knockout core =====
// SINGLE ELIMINATION. One game, you lose, you are out. Jayden, on the league that
// briefly replaced it:
//
//   "I do think the change to the tournament mode was pretty bad and not really what
//    I had in mind. I liked the original tournament format we had. I just want to add
//    it so you could add an additional optional 4 more heads so I can use it to do the
//    fantasy order. I still did like the one game elimination format."
//
// He asked for room for four more heads. That was turned into a twelve-team, three-
// matchday league, which is a different game. The format is back; the four heads are
// the feature, and they are the only thing that is new.
//
// THE FIELD IS 8 BY DEFAULT -- quarter-final, semi-final, final. Seven fixtures, three
// rounds, no empty slots. That is the shape the cup had before the league and the shape
// he says he likes.
//
// TWELVE IS THE OPTION, AND A PLAY-IN IS HOW IT IS HONEST. Twelve is not a power of two,
// so a knockout cannot simply pair it off, and the two ways out are not equal:
//
//   * A 16-SLOT BRACKET WITH FOUR BYES. Rejected, twice, and the second time in his own
//     words: "What's the round of 16? There are only 8 players." It names a round for
//     competitors who do not exist and prints four fixtures nobody plays, and a bye is
//     free advancement handed to whoever the draw happened to favour.
//   * A PLAY-IN. Eight of the twelve play four real matches for the last four
//     quarter-final places; four enter at the quarter-final. Every fixture on the board
//     is played by two real teams, nothing is a walkover, and the BRACKET is still the
//     eight-team quarter -> semi -> final it is at the default field. No phantom round
//     is ever named, because no phantom round exists.
//
// It is not free, and the honest statement of the cost is that four teams play one match
// fewer than the other eight. That is arithmetic, not a design choice: twelve into a
// knockout means somebody plays more. What the play-in buys is that the extra match is a
// REAL match rather than a walkover somebody else was excused from, and that the round is
// called what it is.
//
// THE CONSTRUCTION GENERALISES, AND THAT IS WHY THERE IS NO `BYE` IN THIS FILE AT ALL.
// Take M = the largest power of two <= N. Then N - M teams-worth of matches make up the
// play-in: 2(N - M) teams play (N - M) matches, and the (N - M) winners join the
// (M - (N - M)) teams that entered directly to fill M slots. For N = 8 the play-in is
// empty and the bracket is the plain eight. For N = 12 it is four matches. For N = 5, 6,
// 7 -- which only the no-egg-art fallback can produce -- it is 1, 2 and 3 matches, and
// every one of those fields also comes out with no byes, where the old core had to place
// them by the ITTF rule. A whole category of empty slot, and the two kinds of empty that
// had to be told apart, are gone with it.
//
// NOTHING IS HARDCODED. The round names come from how many teams are left in the round,
// the tab labels come from the same number, the number of rounds comes from the field,
// and the play-in exists or does not exist according to the arithmetic above. Setting the
// field to 8 or 12 changes the whole screen correctly and changes nothing else.

/* The largest power of two that fits inside the field. This is the bracket proper --
   the part that is a clean knockout -- and everything else is the play-in. */
function mainSize(N) { let M = 1; while (M * 2 <= N) M *= 2; return M; }

/* A ROUND IS NAMED FOR HOW MANY TEAMS ARE IN IT, which is the property that keeps the
   label honest at every field size. Eight left is a quarter-final because a quarter-final
   is what eight teams playing off is called -- not because the cup was told to have one. */
function roundLabel(teamsLeft) {
  if (teamsLeft === 2) return 'Final';
  if (teamsLeft === 4) return 'Semi-final';
  if (teamsLeft === 8) return 'Quarter-final';
  return 'Round of ' + teamsLeft;
}
/* The short form, for the tab row -- same number, fewer characters, because five tabs
   have to share a 272px phone. "Last 8" is the same fact as "Quarter-final" and it is
   the form that fits; the long name is still the pane's own heading and the tab's
   accessible name, so nothing is lost to the abbreviation. */
function roundShortLabel(teamsLeft) {
  return teamsLeft === 2 ? 'Final' : 'Last ' + teamsLeft;
}

/* Read a fixture through this rather than indexing rounds, so callers do not know the
   storage. There is no '3p' any more: the third-place playoff was opt-in, nothing asked
   for it, and Jayden's "too much random unnecessary elements" was aimed squarely at a
   fourth labelled group whose winner goes on to nothing. */
function matchAt(br, round, index) { return br.rounds[round].matches[index]; }

/* Recompute every round from the one before it. Append-only: a result is written to one
   fixture and everything downstream is DERIVED, never patched, which is what makes
   recording a result in the wrong order impossible to corrupt.

   The play-in feeds the first bracket round differently from the way a bracket round
   feeds the next one, and that is the only special case in the file. A bracket round
   takes both its sides from the two matches beneath it; the first bracket round takes one
   side from a team that entered directly and the other from a play-in winner. Pairing a
   direct entrant against a qualifier in every fixture (rather than, say, putting all four
   qualifiers on one side of the draw) is deliberate: it is the shape every real play-in
   uses, and it means no half of the bracket is systematically the easier one. */
function propagate(br) {
  const first = br.playIn ? 1 : 0;   // index of the first BRACKET round
  if (br.playIn) {
    /* ---- THE FIRST BRACKET ROUND IS FILLED BY THE FOLD, and the first version of this was
       wrong at five field sizes. It read `a = direct[i]` and `b = qualifier[i] ?? direct[4+i]`,
       which silently assumed there are as many direct entrants as slots AND as many
       qualifiers as slots. That is true at twelve (4 and 4) and false everywhere else: at
       nine there are seven direct entrants and one qualifier, so slot 3 asked for direct[7]
       in a seven-long array and got `undefined` -- a bracket slot nobody could ever fill, on
       a screen whose whole promise is that no fixture is a walkover. Nine, ten and eleven
       heads are all reachable from the roster now that the field is derived from it, and
       five and seven are reachable from the no-egg-art fallback.

       The fold is the standard construction and it is correct for every field by
       construction rather than by cases: lay the M entrants out as one list -- direct
       entrants first, then the play-in's qualifiers -- and pair the outermost two, then the
       next two, inward. Every source is used exactly once because i and M-1-i together
       enumerate the whole list, and because direct entrants are at one end and qualifiers at
       the other, a fixture is direct-versus-qualifier wherever the counts allow it and only
       falls back to like-versus-like when arithmetic forces it.

       Checked at every field this can produce:
         12 -> 4 direct, 4 qualifiers: all four ties are direct v qualifier
         11 -> 5 and 3   10 -> 6 and 2   9 -> 7 and 1   7 -> 1 and 3   5 -> 3 and 1
       and in each the sources are consumed exactly once with no undefined slot. ---- */
    const pi = br.rounds[0].matches, ms = br.rounds[first].matches;
    const src = br.direct.concat(pi.map(function (m) { return m.winner; }));
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i], kept = m.winner;
      /* A placement match appended to this round is fed by LOSERS and must not be folded --
         the fold would hand it the same two entrants a championship slot already has. */
      if (m.feed) { m.a = feedOf(br, m.feed[0]); m.b = feedOf(br, m.feed[1]); }
      else { m.a = src[i]; m.b = src[src.length - 1 - i]; }
      m.winner = (kept !== undefined && (kept === m.a || kept === m.b)) ? kept : undefined;
    }
  }
  for (let r = first + 1; r < br.rounds.length; r++) {
    const prev = br.rounds[r - 1].matches, ms = br.rounds[r].matches;
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i], kept = m.winner;
      if (m.feed) { m.a = feedOf(br, m.feed[0]); m.b = feedOf(br, m.feed[1]); }
      else {
        m.a = prev[i * 2].winner;         // undefined => nobody has qualified yet
        m.b = prev[i * 2 + 1].winner;
      }
      m.winner = (kept !== undefined && (kept === m.a || kept === m.b)) ? kept : undefined;
    }
  }
  return br;
}

/* teamIds: the draw order. There is no `seed` on a team and there must never be one
   again -- it was `i + 1`, the index of a shuffled array, printed on the match-up screen
   as "Seeds 3 and 7", and it is the thing Jayden called out: a number that looks like a
   ranking and is a loop counter. A knockout does not need one. Who meets whom is the
   draw, the draw is random, and a random draw is an honest answer to "why these two?" in
   a way that a fabricated ranking is not.

   ---- opts.tail: PLACES THIS BRACKET DID NOT DECIDE ----------------------------------
   The qualifying race (see the UI module) sends eight teams into a clean eight-team cup
   and settles the remaining places itself. Those teams are not in the draw, play no
   fixture and can win nothing, so they must not be in `rounds` -- but a draft order needs
   a number for every head, so they cannot simply be dropped either.

   `tail` is therefore EXOGENOUS: an ordered list of ids that standings() appends after
   the bracket's own places and that nothing else in this core reads. br.N stays the
   number of teams in the BRACKET, which is what keeps every round name, the fixture
   count and the play-in arithmetic correct -- eight in, no play-in, quarter/semi/final.
   check() refuses a tail that overlaps the draw, because a team counted twice would be
   ranked twice. Callers that have no tail pass nothing and get exactly what they got
   before. ---- */
/* ===========================================================================
   THE PLACEMENT BRACKET. Jayden: "for the fantasy tournment the games need to
   specifically say what draft position they are playing for. Like loser gets '6' pick
   for instance."

   THAT SENTENCE CANNOT BE SATISFIED BY A LABEL, and working out why is the whole of this
   block. A knockout resolves exactly two places. Everybody else shares an EXIT ROUND: four
   teams all lost in the quarters, and the bracket has no opinion at all about which of them
   picks fifth and which picks eighth. standings() ordered them by goal difference, which is
   a reasonable tie-break and is not a result -- so a label reading "loser takes the 1.06"
   on a quarter-final would have been a lie about a number nobody had played for. He settles
   a real draft with this. A screen that invents four of its twelve answers is worse than no
   screen.

   SO THE LOSERS KEEP PLAYING. Every place in the field is decided by a match, which is the
   ordinary full-placement bracket that wrestling, judo and every esports LAN uses: the
   quarter-final losers play their own four-team bracket for 5th to 8th, the semi-final
   losers play for 3rd, and where there is a play-in its four losers play for 9th to 12th.
   Eight heads go from 7 fixtures to 12, twelve go from 11 to 20. That is the cost and it
   buys the thing the mode exists for -- every fixture has a slot on it, and at the end the
   order is read off results rather than off a sort.

   THIS REOPENS A CLOSED DECISION, AND SAYS SO. matchAt()'s note above records that the
   third-place playoff was removed because "nothing asked for it" and Jayden's "too much
   random unnecessary elements" was aimed at a group whose winner goes on to nothing. Both
   were true of the SOCCER cup and remain true of it: none of this is built there. It is
   gated on opts.place, which only the Yowmings League passes, and in the League the third
   place match's winner goes on to the 1.03, which is the opposite of nothing.

   THE FEED IS EXPLICIT because a consolation match is fed by a LOSER and propagate()'s
   positional fold cannot express that. A placement match carries `feed`, two {r, i, s}
   descriptors, and propagate() honours it where it exists and falls through to the fold
   where it does not -- so the championship path is byte-for-byte the bracket that already
   shipped.

   EVERY MATCH ALSO CARRIES ITS STAKE, as `wp` and `lp`: the range of draft slots still
   reachable by its winner and by its loser. A terminal match has both collapsed to one slot
   and carries `place`. That is what the screen prints, so the sentence on a fixture is
   derived from the bracket rather than written next to it, and the two cannot disagree.
   =========================================================================== */
function feedOf(br, f) {
  const s = br.rounds[f.r].matches[f.i];
  if (s.winner === undefined) return undefined;
  return f.s === 'w' ? s.winner : (s.winner === s.a ? s.b : s.a);
}
/* `con` MARKS A MATCH THAT IS PLAYED BUT NOT WATCHED. Jayden: "I like the idea of
   consolation rounds but I dont want those games to be played more of just a simulation so
   the storytelling can be good like focusing on making it short but enjoyable."

   So it is a rendering decision and NOT a scoring one. A con match runs through the same
   clock-cranked Simulate the visitor can press on any fixture -- the real engine, the real
   physics, the real ball -- with drawing skipped. It is a played game that nobody sat
   through, which is exactly what he asked for and is why the slot it settles is still
   earned. Every placement match carries it; the championship path never does. */
function pmatch(feed, wp, lp, place) {
  return { a: undefined, b: undefined, sa: undefined, sb: undefined, winner: undefined,
           feed: feed, wp: wp, lp: lp, place: place, con: true };
}
/* A four-team placement bracket for places P..P+3, fed by four losers. The two semis pair
   the OUTERMOST losers against each other (0 v 3, 1 v 2), which is the same fold the main
   draw uses -- so where the field was seeded, the consolation bracket inherits the seeding
   instead of scrambling it, and the 5 seed does not meet the 8 seed twice in a row. */
function place4(br, src, P, semiR, finR) {
  const sm = br.rounds[semiR].matches, fm = br.rounds[finR].matches, i0 = sm.length;
  sm.push(pmatch([{ r: src[0].r, i: src[0].i, s: 'l' }, { r: src[3].r, i: src[3].i, s: 'l' }],
                 [P, P + 1], [P + 2, P + 3]));
  sm.push(pmatch([{ r: src[1].r, i: src[1].i, s: 'l' }, { r: src[2].r, i: src[2].i, s: 'l' }],
                 [P, P + 1], [P + 2, P + 3]));
  fm.push(pmatch([{ r: semiR, i: i0, s: 'w' }, { r: semiR, i: i0 + 1, s: 'w' }],
                 [P, P], [P + 1, P + 1], P));
  fm.push(pmatch([{ r: semiR, i: i0, s: 'l' }, { r: semiR, i: i0 + 1, s: 'l' }],
                 [P + 2, P + 2], [P + 3, P + 3], P + 2));
}
function addPlacement(br) {
  const first = br.playIn ? 1 : 0, last = br.rounds.length - 1;
  /* THE STAKE OF EVERY CHAMPIONSHIP MATCH IS ARITHMETIC, not a table: a round contesting
     `teams` places sends its winners into the top half of them and its losers into the
     bottom half. Correct at every M by construction. */
  for (let r = first; r <= last; r++) {
    const teams = br.rounds[r].teams, half = teams / 2;
    br.rounds[r].matches.forEach(function (m) { m.wp = [1, half]; m.lp = [half + 1, teams]; });
  }
  if (br.playIn)
    br.rounds[0].matches.forEach(function (m) { m.wp = [1, br.M]; m.lp = [br.M + 1, br.N]; });
  br.rounds[last].matches[0].place = 1;
  // 3rd, from the two championship semi-finals. Pushed FIRST so the final round reads
  // Final, third, fifth, seventh -- which is also the order they are worth watching in.
  if (last - 1 >= first)
    br.rounds[last].matches.push(pmatch(
      [{ r: last - 1, i: 0, s: 'l' }, { r: last - 1, i: 1, s: 'l' }], [3, 3], [4, 4], 3));
  // 5th-8th, from the four quarter-final losers
  if (br.M >= 8)
    place4(br, [{ r: first, i: 0 }, { r: first, i: 1 }, { r: first, i: 2 }, { r: first, i: 3 }],
           5, first + 1, last);
  /* 9th-12th, from the play-in's losers. Four of them get the same four-team bracket; two
     get a single match. One or three losers is only reachable on the no-egg-art fallback,
     where the field is however many real heads exist -- those places are left unplayed and
     standings() marks them as unearned rather than pretending a match decided them. */
  if (br.playIn) {
    const pin = br.rounds[0].matches;
    if (pin.length === 4)
      place4(br, [{ r: 0, i: 0 }, { r: 0, i: 1 }, { r: 0, i: 2 }, { r: 0, i: 3 }],
             br.M + 1, first, first + 1);
    else if (pin.length === 2)
      br.rounds[first].matches.push(pmatch(
        [{ r: 0, i: 0, s: 'l' }, { r: 0, i: 1, s: 'l' }],
        [br.M + 1, br.M + 1], [br.M + 2, br.M + 2], br.M + 1));
  }
  return br;
}

function buildCup(teamIds, opts) {
  const N = teamIds.length;
  if (N < 2) throw new Error('need at least 2 teams');
  const M = mainSize(N);
  const playIn = N - M;                       // fixtures in the play-in; 0 at any power of two
  const ids = teamIds.slice();
  const rounds = [];

  /* The play-in takes the LAST 2 x playIn teams of the draw and the direct entrants are
     the first (M - playIn). Which end is arbitrary and the draw is already shuffled, so
     this is a slicing convention rather than a decision about who is favoured. */
  const direct = ids.slice(0, M - playIn);
  const contest = ids.slice(M - playIn);
  if (playIn > 0) {
    const ms = [];
    for (let i = 0; i < playIn; i++)
      ms.push({ a: contest[i * 2], b: contest[i * 2 + 1], sa: undefined, sb: undefined,
                winner: undefined });
    rounds.push({ label: 'Play-in', short: 'Play-in', teams: playIn * 2, playIn: true,
                  matches: ms });
  }
  for (let count = M / 2; count >= 1; count /= 2) {
    const ms = [];
    for (let i = 0; i < count; i++)
      ms.push({ a: undefined, b: undefined, sa: undefined, sb: undefined, winner: undefined });
    rounds.push({ label: roundLabel(count * 2), short: roundShortLabel(count * 2),
                  teams: count * 2, playIn: false, matches: ms });
  }
  /* With no play-in the bracket's first round is the draw itself, folded by the same rule
     the play-in case uses -- one construction, so the two cannot disagree about which slot
     a team lands in. */
  if (playIn === 0) {
    const ms = rounds[0].matches;
    for (let i = 0; i < ms.length; i++) { ms[i].a = ids[i]; ms[i].b = ids[ids.length - 1 - i]; }
  }
  /* `seeds` is the field in SEED ORDER when a qualifier decided one -- seeds[0] is the
     1 seed. It is carried rather than derived because nothing about a built bracket can
     recover it (the draw is the fold of it, not the order itself), and check() needs it
     to assert the property the seeding exists for. Absent on every unseeded path. */
  const br = { N: N, M: M, playIn: playIn > 0, draw: ids, direct: direct, rounds: rounds,
               tail: (opts && opts.tail) ? opts.tail.slice() : [],
               seeds: (opts && opts.seeds) ? opts.seeds.slice() : null,
               place: !!(opts && opts.place) };
  if (br.place) addPlacement(br);
  return propagate(br);
}

/* ---- THE SEEDED DRAW. Jayden: "i think the race should determine the seed order coming
   the tournament I would research into that".

   THIS REVERSES A DECISION MADE TWICE, and the reasoning that was behind it has to be
   satisfied rather than deleted. The eight who qualified used to be SHUFFLED before the
   draw, on the grounds that handing a finishing order straight to buildCup() would print
   a ranking the bracket then threw away -- the same "number that looks like a ranking"
   this file has removed twice. That objection was about an ADVERTISED seed that did
   nothing. It disappears the moment the seed genuinely decides who plays whom, which is
   exactly what he is asking for, so the seed stops being a decoration and becomes the
   structure. What must not come back is a number that claims more than it does.

   STANDARD SEEDING, which is the ordering everybody already recognises: 1 v 8, 4 v 5,
   2 v 7, 3 v 6 (Wikipedia, "Single-elimination tournament", which states the pairing as
   highest against lowest, second-highest against second-lowest, and so on).

   IT IS GENERATED, NOT TABULATED, by the standard recursion -- S(1) = [1], and each
   doubling replaces every seed s with the pair (s, 2k+1-s):

       [1] -> [1,2] -> [1,4,2,3] -> [1,8,4,5,2,7,3,6]

   (the construction as given in Possibly Wrong, "Pretty-printing a single-elimination
   tournament bracket", 2019). Written this way it is right at 4, 8, 16 and 32 without a
   table to get wrong, which matters because ADVANCE is a constant somebody will change.

   THE PROPERTY THIS BUYS is the whole reason to do it: seeds 1 and 2 land in opposite
   halves and cannot meet before the final, none of the top four can meet before the
   semi-final, and so on -- "the top two seeds could not possibly meet until the final
   round" (Wikipedia, ibid.). check() asserts it rather than trusting this comment.

   IT IS NOT UNCONTESTED, and the honest note is that Schwenk (American Mathematical
   Monthly 107(2), 2000, "What Is the Correct Way to Seed a Knockout Tournament?") showed
   standard seeding is not fairness-optimal -- it can make seed 2 likelier to win than
   seed 1, since seed 1 always draws a 4/5 in the semi -- and proposed randomising within
   cohorts instead. That is a real result about adversarial probability models and a
   twelve-head cup between eggheads is not one; what standard seeding has that cohort
   randomisation does not is that a viewer can look at the bracket and see why.

   WHY THE FOLD RATHER THAN A NEW BUILDER. buildCup() lays its first round out by pairing
   the outermost entries of `draw` inward (a = ids[i], b = ids[N-1-i]), and that fold is
   shared with the play-in path. So the seeding is expressed as the arrangement of `draw`
   that makes that existing fold produce the standard bracket, and buildCup is untouched.
   At eight: draw = [1,4,2,3,6,7,5,8] folds to (1,8) (4,5) (2,7) (3,6). ---- */
function seedSlots(M) {
  var s = [1];
  while (s.length < M) {
    var n = s.length * 2, out = [];
    for (var i = 0; i < s.length; i++) { out.push(s[i]); out.push(n + 1 - s[i]); }
    s = out;
  }
  return s;
}
/* `order` is the finishing order, order[0] being the 1 seed. Returns the draw array.
   A field that is not a power of two has no standard bracket -- buildCup would give it a
   play-in, whose fold this arrangement does not describe -- so it is handed back
   untouched rather than silently mis-seeded. On the race path M is ADVANCE and is 8. */
function seedDraw(order) {
  var M = order.length;
  if (M < 2 || (M & (M - 1)) !== 0) return order.slice();
  var s = seedSlots(M), ids = new Array(M);
  for (var i = 0; i < M / 2; i++) {
    ids[i] = order[s[i * 2] - 1];
    ids[M - 1 - i] = order[s[i * 2 + 1] - 1];
  }
  return ids;
}

/* The first fixture still needing to be played, in board order, or null when the cup is
   won. Both sides must be known -- a bracket round whose feeders are still open is not
   playable, and that is the ONLY kind of empty this core has. */
function nextMatch(br) {
  for (let r = 0; r < br.rounds.length; r++) {
    const ms = br.rounds[r].matches;
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (m.winner === undefined && m.a !== undefined && m.b !== undefined)
        return { round: r, index: i, match: m };
    }
  }
  return null;
}

function champion(br) { return br.rounds[br.rounds.length - 1].matches[0].winner; }
/* ===== A PLACEMENT CUP IS NOT DONE WHEN THE FINAL IS. The Final sits at index 0 of the
   last round, so nextMatch() reaches it BEFORE the third-place, fifth-place and
   seventh-place matches beside it -- and champion() is satisfied the moment it is played.
   Left as it was, the champion screen arrived with four slots of the draft order still
   unplayed, and the order he acts on carried four "nobody earned this" markers. In a
   knockout "the champion is known" and "the cup is over" are the same statement; in a
   placement bracket they are not, and this is the one every caller means. */
function complete(br) {
  if (br.place) { for (const rd of br.rounds) for (const m of rd.matches)
    if (m.winner === undefined) return false; return true; }
  return champion(br) !== undefined;
}
function played(br) { let n = 0; br.rounds.forEach(function (rd) {
  rd.matches.forEach(function (m) { if (m.winner !== undefined) n++; }); }); return n; }
function total(br) { let n = 0; br.rounds.forEach(function (rd) { n += rd.matches.length; });
  return n; }
/* How many fixtures are left, which is the one number this screen can say about distance.
   A knockout halves, so "3 matches to play" is not the same shape of fact a league's is --
   it is the run-in itself. */
function remaining(br) { return total(br) - played(br); }

/* WHAT A TEAM DID IN THIS CUP, from the results and nothing else. Every field here is a
   count of things that happened on the pitch, which is what makes it safe to print. */
function record(br, id) {
  const r = { played: 0, won: 0, gf: 0, ga: 0, gd: 0, out: undefined };
  br.rounds.forEach(function (rd, i) {
    rd.matches.forEach(function (m) {
      if (m.a !== id && m.b !== id) return;
      if (m.winner === undefined) return;
      const mine = (m.a === id) ? m.sa : m.sb, theirs = (m.a === id) ? m.sb : m.sa;
      r.played++;
      r.gf += mine | 0; r.ga += theirs | 0;
      if (m.winner === id) r.won++; else r.out = i;
    });
  });
  r.gd = r.gf - r.ga;
  return r;
}

/* ---- THE FINISHING ORDER, 1..N, WITH NO GAPS -- and it is a FULL ordering rather than a
   list of survivors, because a draft needs a number for every head. It sorts br.draw, which
   is the whole field, not the winners.

   HOW FAR YOU GOT IS THE FIRST KEY, and it is the only one the bracket establishes
   outright: the final settles 1 and 2, and below that nobody outside a given round played
   each other, so "reached the semi-final" is the strongest true statement about a team.

   INSIDE A ROUND, GOAL DIFFERENCE THEN GOALS SCORED. This was the draw order -- the index of
   a shuffled array -- which is the seed problem wearing a third hat: four quarter-finalists
   would be handed 5, 6, 7 and 8 by nothing at all, and a draft order is exactly the place
   that matters. GD and GF are things the teams DID in the matches they played, so most
   positions become explainable. The draw is the last resort only, for two teams that went
   out in the same round having scored and conceded identically; something has to be
   deterministic, and at that point nothing was earned either way.

   `tiedFromDraw` is published rather than hidden. The UI must not print a number as if it
   were earned when it was not, so the row that is separated from the one above it ONLY by
   the draw says so. ---- */
/* ---- THE ORDER IS READ OFF THE RESULTS, NOT SORTED OUT OF THEM. In a placement bracket
   every slot has a match that decided it, so there is nothing here to rank: walk the
   matches that carry a `place`, hand the winner that slot and the loser the next one, and
   the draft order IS the bracket. `earned` is true on every row that came from a played
   match, which in a full field is all of them.

   THE FALLBACK EXISTS FOR ONE PATH AND SAYS SO. A play-in of one or three -- reachable only
   when there is no egg art and the field is however many real heads exist -- leaves those
   losers without a bracket of their own. They keep the knockout's ordering, they are placed
   after everyone a match placed, and `earned:false` makes the screen mark them. A draft
   order that quietly presents an unplayed slot as a won one is the exact lie this file has
   been cleaned of twice. ---- */
function placedStandings(br) {
  const place = new Map(), rec = new Map();
  br.draw.forEach(function (id) { rec.set(id, record(br, id)); });
  br.rounds.forEach(function (rd) {
    rd.matches.forEach(function (m) {
      if (m.place === undefined || m.winner === undefined) return;
      const lo = (m.winner === m.a) ? m.b : m.a;
      place.set(m.winner, m.place);
      if (lo !== undefined) place.set(lo, m.place + 1);
    });
  });
  const placed = br.draw.filter(function (id) { return place.has(id); })
                        .sort(function (x, y) { return place.get(x) - place.get(y); });
  const rest = knockoutOrder(br).order.filter(function (id) { return !place.has(id); });
  const ids = placed.concat(rest);
  const rows = ids.map(function (id, i) {
    return { id: id, rank: i + 1, out: undefined, record: rec.get(id), fromTail: false,
             earned: place.has(id), tiedFromDraw: !place.has(id) };
  });
  (br.tail || []).forEach(function (id) {
    rows.push({ id: id, rank: rows.length + 1, out: undefined, record: record(br, id),
                fromTail: true, earned: false, tiedFromDraw: false });
  });
  return rows;
}

/* THE KNOCKOUT'S OWN ORDERING, LIFTED OUT OF standings() SO THERE IS ONE COPY OF IT.
   Deepest round reached, then goal difference, then goals scored, then the draw -- byte for
   byte the sort that shipped, and still the whole answer for the soccer cup. It is a
   function now because the placement bracket's fallback needs the same order for the
   handful of teams no match could place, and two copies of a tie-break is two tie-breaks
   waiting to disagree. The maps come back with it because standings() needs `deepest` for
   the round it prints and `rec` for the row. */
function knockoutOrder(br) {
  const deepest = new Map(), drawn = new Map(), rec = new Map();
  br.draw.forEach(function (id, i) {
    deepest.set(id, -1); drawn.set(id, i); rec.set(id, record(br, id)); });
  br.rounds.forEach(function (rd, r) {
    rd.matches.forEach(function (m) {
      [m.a, m.b].forEach(function (t) {
        if (t === undefined || !deepest.has(t)) return;
        if (r > deepest.get(t)) deepest.set(t, r);
      });
    });
  });
  const order = br.draw.slice().sort(function (x, y) {
    const rx = rec.get(x), ry = rec.get(y);
    return (deepest.get(y) - deepest.get(x))
        || (ry.gd - rx.gd) || (ry.gf - rx.gf) || (drawn.get(x) - drawn.get(y));
  });
  return { order: order, deepest: deepest, rec: rec };
}

function standings(br) {
  if (br.place) return placedStandings(br);
  const ko = knockoutOrder(br), deepest = ko.deepest, rec = ko.rec, order = ko.order;
  const fin = br.rounds[br.rounds.length - 1].matches[0], ch = fin.winner;
  let ids = order;
  if (ch !== undefined) {
    const ru = (ch === fin.a) ? fin.b : fin.a;
    const head = [ch]; if (ru !== undefined) head.push(ru);
    ids = head.concat(order.filter(function (id) { return head.indexOf(id) < 0; }));
  }
  /* Only the draw separated these two if they are level on every key above it. Computed
     against the row ABOVE, because that is the claim the number makes. */
  const rows = ids.map(function (id, i) {
    const prev = i > 0 ? ids[i - 1] : null;
    const a = rec.get(id), b = prev ? rec.get(prev) : null;
    return { id: id, rank: i + 1, out: deepest.get(id), record: a, fromTail: false,
             tiedFromDraw: !!(b && deepest.get(prev) === deepest.get(id)
                              && b.gd === a.gd && b.gf === a.gf) };
  });
  /* ---- AND THEN THE PLACES THIS BRACKET DID NOT DECIDE, in the order they were handed
     in. They come after all of the bracket's, unconditionally, because everybody in the
     cup outranks everybody who did not make it into it -- that is the whole statement the
     qualifier makes, and it is the one thing about these rows that IS earned.

     `out` is undefined and stays undefined: there is no round to name, so the UI prints
     the provenance it actually has rather than borrowing a round's name for a team that
     never played one. `record` is the real one, which for a team that played nothing is
     all zeros -- computed rather than written, so it cannot drift from the bracket's. ---- */
  (br.tail || []).forEach(function (id, i) {
    rows.push({ id: id, rank: rows.length + 1, out: undefined, record: record(br, id),
                fromTail: true, tiedFromDraw: false });
  });
  return rows;
}

/* WHICH ROUND KNOCKED A TEAM OUT, or undefined if it is still in. The ending screen says
   "Out - Semi-final" rather than a position, because in a knockout that is the true thing:
   there is no table, there is only how far you got. */
function outAt(br, id) {
  for (let r = 0; r < br.rounds.length; r++) {
    const ms = br.rounds[r].matches;
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (m.winner !== undefined && (m.a === id || m.b === id) && m.winner !== id) return r;
    }
  }
  return undefined;
}

function recordWinner(br, round, index, winnerId, sa, sb) {
  const m = matchAt(br, round, index);
  if (m.winner !== undefined) throw new Error('match already final');
  if (winnerId !== m.a && winnerId !== m.b) throw new Error('winner not in this match');
  m.winner = winnerId;
  if (sa !== undefined) { m.sa = sa | 0; m.sb = sb | 0; }
  return propagate(br);
}

/* INVARIANTS, asserted rather than commented, because a comment is not an invariant and
   both of these are properties a later simplification would quietly break.
     * No team may sit in two un-eliminated slots in one round -- the classic
       double-advance, which is what a hand-patched propagate() produces.
     * Every team must appear exactly once in the round it enters at, so the play-in and
       the direct entrants together account for the whole field with nobody counted twice
       and nobody dropped. That second one is the new construction's own risk. */
function check(br) {
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
  const entry = new Set();
  if (br.playIn) br.rounds[0].matches.forEach(function (m) { entry.add(m.a); entry.add(m.b); });
  br.direct.forEach(function (id) { entry.add(id); });
  if (entry.size !== br.N)
    return 'the field is ' + br.N + ' but ' + entry.size + ' teams enter the cup';
  for (const id of br.draw) if (!entry.has(id)) return 'team ' + id + ' never enters the cup';
  /* THE TAIL MUST BE DISJOINT FROM THE BRACKET. A team in both would be ranked twice by
     standings() -- once for how far it got and once for where it finished the race -- and
     a draft order with a duplicate is worse than one with a gap, because the gap is
     visible. Asserted rather than commented, for the same reason everything else here is. */
  /* ===== THE PLACEMENT INVARIANTS. "Eliminated" now means "has taken a slot", not "has
     lost a match", so the thing that must be asserted changed shape with it -- and it is
     asserted rather than assumed, for the same reason the two above are. A draft order with
     a duplicate slot is worse than one with a gap, because the gap is visible.
       * no two matches may settle the same place
       * the places settled must run 1, 3, 5, ... with no hole, or a slot exists that
         nothing can ever fill
       * a team may not be handed two slots
     The seeding invariant below is untouched and still asserts that seeds 1 and 2 can only
     meet in the final: the consolation bracket is fed entirely by losers, so no seed can
     reach it while it is still on the championship path, and the property is unaffected. */
  if (br.place) {
    const slots = new Set(), owner = new Map();
    for (const rd of br.rounds) for (const m of rd.matches) {
      if (m.place === undefined) continue;
      if (slots.has(m.place)) return 'two matches settle place ' + m.place;
      slots.add(m.place);
      if (m.winner === undefined) continue;
      const lo = (m.winner === m.a) ? m.b : m.a;
      for (const t of [m.winner, lo]) {
        if (t === undefined) continue;
        if (owner.has(t)) return 'team ' + t + ' is placed twice';
        owner.set(t, m.place);
      }
    }
    for (let p = 1; p <= Math.max(0, ...slots); p += 2)
      if (!slots.has(p) && p <= br.M) return 'no match settles place ' + p;
  }
  const tail = br.tail || [], seenTail = new Set(), inDraw = new Set(br.draw);
  for (const id of tail) {
    if (inDraw.has(id)) return 'team ' + id + ' is in the bracket and in the tail';
    if (seenTail.has(id)) return 'team ' + id + ' appears twice in the tail';
    seenTail.add(id);
  }
  /* ---- AND THE SEEDING DOES WHAT SEEDING IS FOR. This is the whole justification for
     reversing the shuffle: if the bracket does not actually keep the top seeds apart then
     the seed is decoration again, only now it is decoration that a race was run to earn.
     A comment cannot hold that -- the fold, seedSlots() and ADVANCE are three separate
     things a later edit could put out of step -- so it is asserted.

     WHERE TWO TEAMS MEET, from the structure alone: in the first bracket round a team's
     match index is its slot; every round after that halves it, so two teams meet in the
     first round where their halved indices coincide. Seeds 1 and 2 must not coincide
     until the last round, and no two of the top four before the round before it. ---- */
  const seeds = br.seeds;
  if (seeds && seeds.length >= 2 && !br.playIn) {
    const ms = br.rounds[0].matches, at = new Map();
    ms.forEach(function (m, i) { at.set(m.a, i); at.set(m.b, i); });
    const last = br.rounds.length - 1;
    const meet = function (x, y) {
      let a = at.get(x), b = at.get(y), r = 0;
      if (a === undefined || b === undefined) return -1;
      while (a !== b) { a = Math.floor(a / 2); b = Math.floor(b / 2); r++; }
      return r;
    };
    if (meet(seeds[0], seeds[1]) !== last)
      return 'seeds 1 and 2 can meet in round ' + meet(seeds[0], seeds[1])
           + ', not the final (' + last + ')';
    const top = Math.min(4, seeds.length);
    for (let i = 0; i < top; i++) for (let j = i + 1; j < top; j++)
      if (meet(seeds[i], seeds[j]) < last - 1)
        return 'seeds ' + (i + 1) + ' and ' + (j + 1) + ' can meet in round '
             + meet(seeds[i], seeds[j]) + ', before the semi-final';
  }
  return null;
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

window.__hmBracket = { buildCup: buildCup, mainSize: mainSize, matchAt: matchAt,
  nextMatch: nextMatch, recordWinner: recordWinner, champion: champion, complete: complete,
  played: played, total: total, remaining: remaining, standings: standings, outAt: outAt,
  record: record,
  roundLabel: roundLabel, roundShortLabel: roundShortLabel, check: check,
  seedSlots: seedSlots, seedDraw: seedDraw };
})();


(function(){   // ===== TOURNAMENT: teams, squads, stats, bracket =====
// Exhibition (the old Soccer) is untouched. This mode fields the same two-sided engine one
// fixture at a time and keeps a record around it.
//
// NO BYES, and not because they are handled -- because the core's play-in construction
// cannot produce one at any field size. See its header. The field is padded to FIELD with
// egghead-captained teams and then simply drawn.
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
  /* The League is not one of the eight case-study cups -- it is a named competition of its
     own, so it carries its own materials rather than borrowing Apollo's by falling through
     the lookup. Turf and chalk: the one place in this file where the identity is literal. */
  'Yowmings':{paint:'#1d2a22',stock:'#f2efe4',sheen:'rgba(214,238,216,.30)',pfx:'YOW',tex:1},
  'Blender': {paint:'#31262b',stock:'#f3ece2',sheen:'rgba(246,214,222,.30)',pfx:'BLN',tex:1}
};

/* THE ROUND'S NAME IS THE ROUND'S OWN, and it is read off the bracket rather than
   computed here, because the core already had to know how many teams are in each round in
   order to build it. Nothing in this file counts rounds or names them; asking the round
   is the whole mechanism, and it is what makes a field of 8 and a field of 12 print
   correct labels without a branch anywhere in the UI. */
function roundName(r){ var rd = T.br && T.br.rounds[r]; return rd ? rd.label : ''; }
function roundShort(r){ var rd = T.br && T.br.rounds[r]; return rd ? rd.short : ''; }

var T = { live: false, teams: [], br: null, stats: {}, cur: null, phase: 'idle', log: [], cup: '' };
/* Exposed so the scoreboard block (a different script, in a file this lane does not own)
   can name the round without knowing the format. It gets the SHORT label: the scoreboard
   stamp is a two-word slot beside the score, and "Matchday 2 of 3" is a status line, not
   a stamp. The count belongs in band A, which has a whole strip for it. */
T.roundName = function(r){ return roundName(r); };
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

/* ---- THE FIELD IS DERIVED FROM THE ROSTER, AND NOBODY IS ASKED ABOUT IT. Jayden:
   "the tournament mode it shouldn't be like you pick 8 or 12 it should just be like based
   on how many heads you have built like before 8 it would be 8 more than 8 it would be 12."

   He is right, and the 8/12 control this replaces was the wrong shape of question: a visitor
   who has built eleven heads has already answered it. So eight or fewer heads gives an
   eight-team cup and more than eight gives a twelve-team cup with the play-in, and the
   control is deleted rather than defaulted.

   THE FIELD IS STILL THE ONE NUMBER THAT DECIDES THE COMPETITION. The rounds, their names,
   the fixture count and whether there is a play-in at all are derived from it by the core,
   which is exactly why this change is one line at the source and nothing downstream moved.

   WHAT HAPPENS BELOW EIGHT, said plainly rather than left to be discovered. The field is
   still eight; the shortfall is captained by DYED EGGHEADS, which is what this mode has
   always done. They are not strangers and not filler in the pejorative sense -- they are the
   cast, named deterministically from the palette slot, so the red egghead is always Gus and
   the gold one always Milo across every session. Mini-Jayden takes a shirt before any
   anonymous egg does. With one saved head you get your head, Jayden, and six eggheads.

   AND THE SCREEN SAYS SO. The match-up prints how the field was made until the first result
   lands -- "3 yours - 5 eggheads" -- because a cup that silently presents six strangers as
   your roster is the kind of quiet lie this screen has been cleaned of twice. It occupies
   exactly the slot the 8/12 control used to, so nothing moved to make room for it.

   The one case this cannot cover is no egg art at all (__EGGHEAD or __hmTint missing), where
   the field is only as big as the real heads on hand. The core takes any N >= 2 and is
   bye-free at every one of them -- verified at 2..16 -- so that path degrades to a smaller
   real cup rather than to a broken eight. ---- */
function fieldFor(built){ return built > 8 ? 12 : 8; }
var FIELD = 8;
/* ---- AND IT IS NO LONGER CAPPED UPSTREAM. This note used to say the opposite and it was
   true when it was written: play-engine.js and play-games.js both read hmCompanions,
   `.slice(0,8)` and WROTE THE TRUNCATED LIST BACK, so a ninth head was destroyed on the
   next load and fieldFor() could never see more than eight. Both files now declare
   `__HM_MAX_HEADS = 12` and cap without persisting -- "HEALING WRITES BACK. CAPPING DOES
   NOT" -- so a twelve-head roster survives a reload and a twelve-team cup is reachable by
   a real visitor. That is what makes the qualifying race below a feature rather than dead
   code, and it is why the rule was written to the ROSTER rather than to the cap. ---- */
window.__hmTourField = fieldFor;

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
  var all = readHeads();
  FIELD = fieldFor(all.length);
  var heads = all.slice(0, FIELD);
  var EGG = window.__EGGHEAD;
  /* Without egg art nobody can be dyed a captain, so the field is only as big as the real
     heads on hand -- fielding twelve teams eleven of which have no captain would print a
     table of blanks. */
  var canEgg = !!(EGG && EGG.cut && window.__hmTint);
  var n = canEgg ? FIELD : Math.max(2, Math.min(FIELD, heads.length + 1));
  /* NO PARITY GUARD, AND NONE IS NEEDED. The league needed an even field because the
     circle method pairs arr[i] with arr[n-1-i] and an odd field leaves somebody out every
     round. The knockout core takes ANY n >= 2: it plays the remainder above the nearest
     power of two off in a play-in, so 5, 6, 7 and 12 all come out with no byes and no
     phantom fixtures. The only floor left is that a cup needs two teams. */
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

  caps = shuffled(caps);   // ...and a fresh draw for who starts where in the cup
  if (!canEgg){ n = Math.max(2, Math.min(n, caps.length)); if (n < 2) n = 2; }

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
    /* NO `seed`, and there is nothing that replaced it. It was `i + 1` -- the index of
       a shuffled array, printed on the match-up screen as "Seeds 3 and 7" -- and it is
       the thing Jayden called out: a number that looks like a ranking and is a loop
       counter. The league's answer was to replace it with a league position, which meant
       replacing the format to have one. A knockout does not need either: who meets whom
       is the DRAW, the draw is random, and "these two were drawn together" is a complete
       and honest answer in a way that a fabricated ranking is not. */
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
    /* HOW THE FIELD WAS MADE, counted here where the roster is still in hand rather than
       inferred later from the pictures. `mine` is the visitor's own saved heads that got a
       shirt, `house` is mini-Jayden (he is neither theirs nor an anonymous egg), and the
       rest are dyed eggheads. */
    T.roster = { field: teams.length, mine: Math.min(heads.length, teams.length),
                 house: 0, eggs: 0 };
    teams.forEach(function(tm){
      var c = tm.captain;
      if (c && c.__mirror) T.roster.house++;
      else if (!c || c.__egg) T.roster.eggs++;
    });
    T.roster.mine = Math.max(0, teams.length - T.roster.house - T.roster.eggs);
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

/* ===========================================================================
   THE QUALIFYING RACE. Jayden:

     "what if tournament mode is more than just soccer because the top 8 should be
      soccer but finding out the bottom 4 positions seems to be giving us problems...
      if there 12 players there should be a marble race just to determine who will
      make it to the knockout soccer tournament and who will not."

   So: MORE THAN EIGHT HEADS AND THEY ALL RACE ONCE. The first eight enter a clean
   eight-team knockout -- quarter, semi, final, seven fixtures, no play-in and no
   phantom round -- and the rest take the places below it. It is one call to
   window.__hmRaceQualify (play-engine.js), made once, after the roster is known and
   before the cup is built, and never from a paint path.

   IT REPLACES THE PLAY-IN ON THIS PATH RATHER THAN JOINING IT. The play-in exists
   because twelve is not a power of two; the race answers the same arithmetic with a
   real event instead of four extra fixtures, which is the thing he says was "giving
   us problems". The play-in is still the code that runs when the race cannot -- see
   the ladder -- so nothing was deleted, it was demoted to the fallback it is good at.

   ---- THE DEGRADATION LADDER, AND IT IS THE POINT OF THIS BLOCK ----------------
   Measured today, 3 runs in 6 complete. The remaining failures are diagnosed (a head
   at rest above a sliding gate wall at one particular gap) and they are a physics
   change in a game whose feel is guarded, so they are not fixed here. A partial or
   an abandoned race is therefore the COMMON case, not the edge case, and this screen
   is built for it:

     1. finished AND complete            -> use the order. Every place was raced.
     2. any other reason, but every team
        still got a placing              -> use the PARTIAL order, and SAY SO, on the
                                           race pane and on the draft pane.
     3. a team could not be placed at
        all, or busy / nofield / no race
        module                           -> do not race. Fall straight back to the
                                           twelve-team play-in bracket that already
                                           ships, which needs nothing from the race.

   NEVER INVENT A PLACING. Path 2 is honest because __hmRaceQualify ranks a racer who
   did not cross by how far down the course it had got, which is a measurement; it
   marks every one of them `finished:false` and counts them in `resolved`. What would
   NOT be honest is filling a gap with a team the race never placed, so a single
   unresolved team drops the whole thing to path 3. He uses this to decide a real
   fantasy draft order; a fabricated position costs somebody something.

   ---- WHY THE QUALIFIED EIGHT ARE SHUFFLED BEFORE THEY ARE DRAWN. The race decides
   MEMBERSHIP -- "who will make it and who will not", which is the whole of the ask --
   and it does not decide fixtures. Handing the finishing order to buildCup() straight
   would pair 1st with 8th and 2nd with 7th, which is a seeded bracket: the same
   "number that looks like a ranking" this file has removed twice, only earned this
   time. Earned or not, nobody asked for it, and the draw being random is what makes
   "why these two?" answerable. So the eight are shuffled, exactly as an eight-head
   cup's are.
   =========================================================================== */
var ADVANCE = 8;          // how many the race sends into the knockout
/* ---- AND HOW MANY IT SENDS THROUGH FOR A GIVEN FIELD. Soccer's cup only ever races when
   there are more heads than places, so ADVANCE was a constant and this was arithmetic
   nobody had to do. The Yowmings League races EVERY time -- see start() for why -- and with
   eight heads there are exactly eight places, so the race stops eliminating anybody and
   becomes pure seeding. One expression covers both: you cannot advance more than the field.
   Everything downstream (`whole`, the tail, seedDraw) reads this rather than the constant,
   so a race with nobody to eliminate is a normal race with an empty tail and not a special
   case. ---- */
function advFor(n){ return Math.min(ADVANCE, n); }
var QRACE_MS = 90000;     // the backstop. The mode's own stall detector gives up after
// ~7s of no progress and its natural line race measures 35-38s at twelve, so this is a
// last line under all of that rather than the thing that normally ends a race. Never 0.
var Q = null;             // {state:'ready'|'running'|'skipped', teams:[]} while qualifying

/* THE RACERS HAVE TO BE STANDING ON THE PLANET, because the race is run on live heads
   and not on team records. This is cast()'s slot resolution with the squads left out:
   a captain the visitor already has on the pitch keeps its slot (never cloned), anyone
   else is spawned, and `taken` stops two identically dyed eggheads sharing one slot --
   the bug that once logged a goal against the wrong team.

   It also clears the bench. A benched head returns early out of the engine's per-frame
   law before it ever reads me.raceX, so it would be a racer that never moves and never
   appears; benchAll() puts the bench back the moment the cup opens. */
function castQualifiers(teams){
  var SLOT = 9400, taken = {};   // 9400, not cast()'s 9200: these heads are still standing
  // when the first fixture is cast, and two spawns into one slot make the index lookup lie
  T.spawnedCuts = T.spawnedCuts || [];
  window.__hmBench = null;
  teams.forEach(function(tm){
    var p = tm.captain;
    if (!p){ tm.__qslot = null; return; }
    var slot = (window.__hmSlotForPid && p.__pid) ? window.__hmSlotForPid(p.__pid) : null;
    if (slot != null && taken[slot]) slot = null;
    if (slot == null && window.__hmSlotFor){
      var s2 = window.__hmSlotFor(p.cut);
      if (s2 != null && !taken[s2]) slot = s2;
    }
    if (slot == null){ slot = SLOT++;
      var sp = { cut: p.cut, eyes: p.eyes || [], marks: p.marks || null,
                 __noIntro: true, __pid: p.__pid };
      if (p.__filler) sp.__filler = true;
      if (p.__mirror) sp.__mirror = true;
      try { window.__hmSpawnOne(sp, slot); T.spawnedCuts.push(p.cut); } catch (_) {}
    }
    try { if (window.__hmTagSlot && p.__pid) window.__hmTagSlot(slot, p.__pid); } catch (_) {}
    taken[slot] = 1; tm.__qslot = slot;
  });
}

/* JOINING THE RESULT BACK TO THE TEAMS, and `cut` leads because the seam says so: teams
   are built from readHeads(), the race's `slot` is null for filler and placeholder heads,
   and a slot is only ever this file's own bookkeeping. The slot it minted is the second
   question, not the first. A row that answers to neither is simply not placed -- which is
   what sends the whole thing down to path 3 rather than leaving a hole. */
function rankTeams(teams, order){
  if (!order || !order.length) return [];
  var byCut = {}, bySlot = {}, i, tm, p;
  for (i = 0; i < teams.length; i++){
    tm = teams[i]; p = tm.captain;
    if (p && p.cut && byCut[p.cut] === undefined) byCut[p.cut] = i;
    if (tm.__qslot != null && bySlot[tm.__qslot] === undefined) bySlot[tm.__qslot] = i;
  }
  var used = {}, out = [];
  for (i = 0; i < order.length; i++){
    var row = order[i], ix;
    ix = (row && row.cut != null && byCut[row.cut] !== undefined) ? byCut[row.cut] : undefined;
    if (ix === undefined && row && row.slot != null && bySlot[row.slot] !== undefined)
      ix = bySlot[row.slot];
    if (ix === undefined || used[ix]) continue;
    used[ix] = 1; out.push(teams[ix]);
  }
  return out;
}

/* ONE CALL, ONE SETTLEMENT. __hmRaceQualify hands the result back through BOTH a callback
   and a promise, so `settled` is not defensive tidiness -- without it the ladder would run
   twice and build two cups. Anything that throws (no race module at all, which is what a
   host without play-engine.js's race block looks like) lands on path 3 rather than on the
   floor. */
function runQualifier(){
  if (!Q || Q.state !== 'ready') return;
  Q.state = 'running'; paint();
  var slots = [];
  Q.teams.forEach(function(tm){ if (tm.__qslot != null) slots.push(tm.__qslot); });
  var settled = false;
  function done(res){ if (settled) return; settled = true; qualified(res || null); }
  try {
    var r = window.__hmRaceQualify({ slots: slots, advance: advFor(Q.teams.length), format: 'line',
                                     timeout: QRACE_MS }, done);
    if (r && typeof r.then === 'function') r.then(done, function(){ done(null); });
  } catch (_) { done(null); }
}

function qualified(res){
  if (!T.live || !Q) return;   // the cup was left while the race was still running
  var teams = Q.teams;
  var ranked = rankTeams(teams, res && res.order);
  var advN = advFor(teams.length);
  /* WAS `teams.length > ADVANCE`, and that was the same statement while a race could only
     ever happen with a surplus. It cannot mean that any more: a League of eight races all
     eight for eight places, and `>` would have called a complete, finished, fully ranked
     race 'skipped' and thrown its result away. What `whole` has always been asking is
     "did every head get a place out of this", so it asks exactly that. */
  var whole  = (ranked.length === teams.length && teams.length >= advN);
  var mode = (whole && res && res.reason === 'finished' && res.complete) ? 'full'
           : whole ? 'partial' : 'skipped';
  T.race = { mode: mode, reason: (res && res.reason) || 'unavailable',
             field: teams.length, advance: advN,
             resolved: res ? (res.resolved | 0) : 0 };
  if (mode === 'skipped'){
    /* THE RACE DID NOT HAPPEN, AND THE SCREEN SAYS SO RATHER THAN QUIETLY CHANGING ITS
       MIND. Falling straight through to a twelve-team bracket would leave a visitor who
       had just pressed "Start the race" looking at a play-in with no explanation. The
       pane it is already on stays put and takes one different sentence and one different
       button; nothing new is drawn and nothing is timed. */
    Q.state = 'skipped'; paint(); return;
  }
  Q = null;
  T.raceOrder = ranked.map(function(t){ return t.id; });
  clearSpawned(); benchAll();   // the racers come off before the first fixture casts, so
  // the two squads walk on to an empty ground and no slot is claimed twice
  /* ---- THE RACE SEEDS THE CUP, and the shuffle that used to be here is gone. Jayden:
     "i think the race should determine the seed order coming the tournament". The eight
     qualifiers go in as seeds 1..8 in the order they crossed, and seedDraw() arranges
     them so the bracket is the standard one -- see its header for the construction, the
     property it guarantees and the check() that asserts it.

     THE SEED IS NOW LOAD-BEARING RATHER THAN PRINTED, which is what makes this different
     from the ranking this file removed twice: it decides who plays whom. Winning the race
     buys the 8 seed as a first opponent and a half of the draw with no other top-two
     team in it. That is a real reward for a real result, and it is checkable on the
     board -- which is the standard the old shuffle was protecting and this meets. ---- */
  var advQ = advFor(T.raceOrder.length);
  var qual = T.raceOrder.slice(0, advQ);
  T.seedOf = {};
  qual.forEach(function(id, i){ T.seedOf[id] = i + 1; });
  openCup(BR.seedDraw(qual), T.raceOrder.slice(advQ), qual);
}

/* The cup opens the same way whether a race decided its field or not: one place that
   builds the bracket, checks it, casts fixture one and paints. Two paths into buildCup()
   was how the first draft ended up with the play-in casting and the raced field not. */
function openCup(ids, tail, seeds){
  var opts = null;
  if ((tail && tail.length) || (seeds && seeds.length) || T.yow){
    opts = {};
    if (tail && tail.length) opts.tail = tail;
    if (seeds && seeds.length) opts.seeds = seeds;
    /* ONLY THE LEAGUE PLACES EVERYBODY. The soccer cup is a knockout and Jayden has
       defended that twice -- "I still did like the one game elimination format" -- so it
       keeps its seven fixtures and its exit-round ordering. The League needs a slot for
       every head because a draft does, which is a different question with a different
       right answer. One flag, one bracket builder, no second cup. */
    if (T.yow) opts.place = true;
  }
  T.br = BR.buildCup(ids, opts);
  var bad = BR.check(T.br);
  if (bad) { try { console.warn('[cup]', bad); } catch (_) {} }
  lastRound = -1;
  T.phase = 'table'; view = 'next';
  var nm0 = BR.nextMatch(T.br);
  if (nm0) cast(nm0);
  paint();
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
  /* The scoreline travels with the result. In a knockout it is not a tie-break -- there
     is nothing to break, you are out -- but it is what the bracket prints beside a tie
     that has been played, which is how a board tells a 2-1 from a 5-0. Side 1 is always
     the fixture's `a` and side 2 its `b` -- cast() built c.side from exactly that. */
  BR.recordWinner(T.br, c.round, c.index, winnerId, scoreR, scoreB);
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
  var bad = BR.check(T.br);
  if (bad) { try { console.warn('[cup]', bad); } catch (_) {} }
  T.cur = null;
  /* ---- 5,600ms, AND IT IS NOT PADDING. play-engine.js's win path fires the confetti, holds
     the call on screen to 4,600ms and only then runs `setTimeout(finish, 5400)` -- finish IS
     __hmSoccerEnd and it is the only thing that takes the pitch down. Painting the next
     match-up at, say, 2,600ms would draw it over a live match. So this number is slaved to
     the engine's and belongs to a file this lane does not own; shortening it is an engine
     change, not a tournament one.

     THE FINAL GETS 10,500, and that branch is back because the final is back. hmFinal
     buys the gold ball and the championship disco from play-engine.js, and the disco runs
     long; cutting to the champion screen at 5,600 would take the pitch down in the middle
     of it. The league deleted this because a league has no final -- it has a table that
     stops moving -- and handTrophy() would have given the trophy to whoever won the last
     ordinary fixture. A knockout's last fixture IS the final and its winner IS the
     champion, so the trophy lands in the right hands again. ---- */
  var hold = (typeof T.holdMs === 'number' && T.holdMs >= 0) ? T.holdMs
           : (document.body.classList.contains('hmFinal') ? 10500 : 5600);
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

   ---- hmFinal IS BACK, BECAUSE THE FINAL IS BACK. `body.hmFinal` buys three
   things from play-engine.js: the gold ball, the championship disco, and
   handTrophy(), which puts the trophy in the hands of a player on the team that
   just won THAT MATCH.

   The league deleted all three, and it was right to: in a league the team that
   wins the last fixture may be eleventh, so handTrophy would have crowned the
   wrong head, and lighting the last matchday's six fixtures gold would have spent
   the one colour nobody owns on six ordinary matches.

   A knockout has none of that problem. Its last fixture IS the final, its winner
   IS the champion, and gold is reserved for exactly one match out of seven. The
   toggle is set HERE rather than at kick-off so the ball is already gold on the
   final's match-up screen -- the ceremony starts when you can see who is in it. ---- */
function cast(nm){
  var A = teamById(nm.match.a), Bm = teamById(nm.match.b);
  if (!A || !Bm) return;
  /* The last round is the final by construction -- one match, two teams -- so this asks
     the bracket rather than a constant, and it is correct whether the cup opened with a
     play-in or not. */
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
function between(){
  clearSpawned(); benchAll();
  // ROUND BEAT: when the cup moves up a round, announce it in the middle of the screen
  // the same way the countdown and the win call do, so the competition has a rhythm
  // between fixtures rather than just swapping panels. The FULL name here -- "Semi-final"
  // is the moment, and it is the one place on the screen with room to say it whole.
  try{ var n0 = BR.nextMatch(T.br);
    if (n0 && n0.round !== lastRound){ lastRound = n0.round;
      var cE = document.querySelector('.hmCount'), _lbl = roundName(n0.round);
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

/* ===========================================================================
   SIMULATING -- THE SAME MATCH, NOBODY WATCHING. Jayden: "for the tournment mode
   there should be an option to simulate games so you dont have to watch everyone
   if you dont want to."

   THE ONE RULE, AND EVERYTHING ELSE FOLLOWS FROM IT: a simulated result is the
   REAL MATCH, run fast, with nobody looking. It is never a dice roll. He uses this
   screen to settle an actual fantasy draft, so if "Simulate" invented a scoreline
   from Math.random then the bracket, the head-to-head count on the tape, the goal
   difference inside standings() and the draft order would all be fiction, and the
   one thing this screen is for would be the one thing it could not do.

   HOW, given the soccer engine has no headless step. The race has one -- `__race.sim`
   steps the world with `draw=false` and a whole race costs milliseconds (see
   tools/race-fairness-probe.py). The match has nothing equivalent, and it could not
   easily: the ball lives in one rAF loop, every player is a separate rAF closure in
   another, and the phases (the 3-2-1, the drop-in after a goal, the whistle 5,400ms
   after the winning goal) are setTimeout chains. There is no single tickWorld() to
   call, and manufacturing one would be a rewrite of a file this lane does not own.

   SO THE CLOCK IS CRANKED INSTEAD OF THE WORLD. requestAnimationFrame,
   setTimeout and performance.now are swapped for a virtual clock that this module
   advances by hand, exactly 1/60 of a second per frame -- which is the dt a
   viewer's rAF hands those same loops. Every line of physics, every player's AI,
   the goal detection, win-by-two and the engine's own first-to-N curve run
   untouched and unaware. The ONLY difference between a simulated fixture and a
   watched one is how much wall-clock time passes between two frames.

   MEASURED, not asserted. 20 simulated first-round fixtures against 6 watched ones,
   same field, same viewport, driven through the same Kick off button:

                    match length (simulated seconds)      goals    went to
                    mean   median   min    max            /match   deuce
       watched      68.0   38.8     18.5   142.1          4.7      33%
       simulated    50.5   45.0     14.5   116.8          5.0      35%

   The two are the same distribution. (The watched arm ran at 51-60fps throughout,
   so its wall seconds really are match seconds -- below ~20fps the loops' dt clamp
   bites and that reading would have overstated the match.)

   1/60 EXACTLY IS A CHOICE AND IT IS THE RACE PROBE'S CHOICE, for the reason
   recorded there: "a finer step would integrate a DIFFERENT race". A watched frame's
   dt wobbles around 1/60; a cranked one does not. Two runs of one seeded match
   therefore diverge within seconds, which is why the table above compares
   distributions and not scorelines -- there is no reproduction to check, and
   claiming one would be the dishonest version of this measurement.

   WHAT IS SUPPRESSED, AND WHY. `window.__hmFx` is the engine's own FX budget:
   goalBurst and winConfetti both bail at their own guard when it is already spent.
   Pinned high for the duration, neither confetti canvas is ever made.

   THE REASON IS PRESENTATION, NOT SPEED, and the distinction matters because the
   speed version of this claim is one I tried to make and could not support. Both
   canvases are appended to the BODY at z-index 62 -- above this screen's panel at
   47 -- so unlike everything else the match draws they are not covered by the
   `body.hmTourSim .hero{visibility:hidden}` rule in tournament.css. Left alone they
   would fire full-viewport confetti over the panel, once per goal, at thirty times
   speed. That is the "looks like a glitch" failure this file has already cancelled
   one feature for.

   ON SPEED IT IS A WASH. A controlled A/B -- 16 fixtures, flag alternating inside
   one browser session so machine drift hits both arms -- could not separate them:
   cost per simulated second is dominated by match LENGTH (a 13s fixture ran at
   28 ms/simulated-second, a 111s one at 135) and the two arms happened to draw
   different lengths. An earlier cross-process comparison appeared to show
   suppression making things WORSE, which is how the noise floor announced itself:
   the first runs of any session cost three to four times the settled ones.
   Not one line of physics is behind the flag either way, and the fidelity table
   above was measured with it set.

   THE PUMP YIELDS. A round is thousands of virtual frames and pumping them in one
   synchronous burst would lock the tab for the whole of it, so the crank turns in
   short chunks with a real frame between them -- which is also what lets the
   bracket fill in while you watch, and what leaves Stop able to respond.
   =========================================================================== */
var CLOCK = (function(){
  /* ---- THE CLOCK ONLY EVER GOES FORWARD, and `offset` is the whole reason this module
     is not a bug factory.

     A simulation spends minutes of match inside seconds of wall time, so when it ends
     the virtual clock is far AHEAD of the real one. Simply putting performance.now()
     back would step the page's clock backwards by that difference -- and the engine is
     full of absolute deadlines taken off it: a head's next decision, the mouth and blink
     timers, setHold, the hitstop's __hmFreeze, the shot cooldowns. Every one of those
     would land minutes in the future, and the heads would stand there not deciding
     anything for as long as the simulation had been worth. Restoring the clock honestly
     is a worse bug than never restoring it.

     So time is CONTINUOUS instead. When the crank stops, the gap it opened is kept as a
     permanent offset and the page's clock carries on from where the simulation left it:
     monotonic, never rewound, every stored deadline still meaning what it meant. rAF
     timestamps carry the same offset, because the loops derive dt by differencing a rAF
     timestamp against a value they took from performance.now() -- if only one of the two
     were shifted, every loop on the page would compute one enormous or one negative dt
     at the handover. ---- */
  var installed = false, warped = false, vt = 0, offset = 0;
  var rafQ = [], rafId = 1, timers = [], tid = 1;
  var realRAF, realCAF, realST, realCT, realNow, perfObj;
  function vnow(){ return warped ? vt : realNow() + offset; }

  /* INSTALLED ONCE, LAZILY, AND LEFT IN PLACE -- which is a deliberate choice over
     swapping the globals back afterwards. A timer armed during a simulation carries
     an id minted by THIS module; if the real functions were restored underneath it,
     a later clearTimeout(id) would hand that id to the browser, which would either
     ignore it or -- worse -- cancel an unrelated real timer that happened to be
     wearing the same small integer. Staying installed means every id keeps being
     interpreted by the thing that issued it. The cost when idle is one boolean test
     per call, and nothing is patched at all until the first press of Simulate. */
  function install(){
    if (installed) return; installed = true;
    perfObj = window.performance;
    realRAF = window.requestAnimationFrame.bind(window);
    realCAF = window.cancelAnimationFrame.bind(window);
    realST  = window.setTimeout.bind(window);
    realCT  = window.clearTimeout.bind(window);
    realNow = perfObj.now.bind(perfObj);

    try{ perfObj.now = function(){ return vnow(); }; }catch(_){}
    window.requestAnimationFrame = function(fn){
      /* Unwarped, this is a pass-through that shifts the browser's timestamp onto the
         page's clock. It stays installed for the life of the page for the same reason
         the timer shim does -- see install()'s header. */
      if (!warped) return realRAF(function(ts){ fn(ts + offset); });
      var id = rafId++; rafQ.push({ id: id, fn: fn }); return id; };
    window.cancelAnimationFrame = function(id){
      if (!warped) return realCAF(id);
      for (var i = 0; i < rafQ.length; i++) if (rafQ[i].id === id){ rafQ.splice(i, 1); return; } };
    window.setTimeout = function(fn, ms){
      if (!warped) return realST.apply(null, arguments);
      var t = { id: 'v' + (tid++), at: vt + (+ms || 0), fn: fn,
                args: Array.prototype.slice.call(arguments, 2), real: 0 };
      timers.push(t); return t.id; };
    window.clearTimeout = function(id){
      if (typeof id === 'string' && id.charAt(0) === 'v'){
        for (var i = 0; i < timers.length; i++) if (timers[i].id === id){
          if (timers[i].real) realCT(timers[i].real);   // already handed back to the real clock
          timers.splice(i, 1); return; }
        return;
      }
      return realCT(id); };
    /* setInterval is deliberately NOT patched. Nothing the match depends on is on
       one -- the countdown, the drop-in and the whistle are all setTimeout -- and
       the page's real intervals (the head engine's 500ms hero-box refresh, the
       race's hidden-tab catch-up, which no-ops while the document is visible) are
       cheap and harmless running at wall rate. Leaving them alone means there is no
       repeating timer to hand back at the end, which is one whole class of leak
       this module simply does not have. */
  }

  function fireDue(){
    var guard = 0;
    for(;;){
      var best = -1;
      for (var i = 0; i < timers.length; i++)
        if (timers[i].at <= vt && (best < 0 || timers[i].at < timers[best].at)) best = i;
      if (best < 0 || guard++ > 5000) return;
      var t = timers[best]; timers.splice(best, 1);
      try{ t.fn.apply(null, t.args); }catch(_){}
    }
  }

  /* THE HANDOVER FRAME, and it is not politeness -- without it nothing moves at all.
     Every loop on this page is currently parked in the BROWSER's rAF queue, not this
     module's, and a loop only re-registers with the patched function the next time it
     runs. Pumping never yields, so the queue would stay empty and a "simulated" match
     would sit at 0-0 forever while the crank turned. Two real frames, then the world
     is ours. */
  function on(){
    install();
    if (warped) return Promise.resolve();
    warped = true;
    return new Promise(function(res){
      realRAF(function(){ realRAF(function(){ vt = realNow() + offset; res(); }); }); });
  }

  /* GIVING THE CLOCK BACK. Every timer still pending is re-armed on the REAL clock
     for whatever virtual time it had left, because the engine parks the things that
     end a match on exactly these: stop a simulation between the winning goal and the
     whistle and, without this, finish() never runs, the pitch never comes down and
     the cup is wedged with no way out but Leave. The id is kept so a later
     clearTimeout still finds it. */
  function off(){
    if (!warped) return;
    /* The gap the simulation opened becomes permanent, and `warped` drops only after it
       is banked -- everything below re-arms through the unwarped paths and must see the
       new offset, or it would be scheduled against a clock that no longer exists. */
    offset = vt - realNow();
    warped = false;
    var pendRaf = rafQ.slice(); rafQ.length = 0;
    var pend = timers.slice(); timers.length = 0;
    /* ---- PENDING FRAMES ARE HANDED BACK, NOT DROPPED, and dropping them was a real
       defect rather than a tidiness point: every animation loop on this page re-registers
       from inside its own callback, so at the instant the crank stops, the whole page --
       the ball, every head, the scoreboard -- is sitting in this queue waiting for the
       next frame. Clearing it would have stopped all of them permanently, and the page
       would look alive only until the next thing that happened to restart a loop. ---- */
    pendRaf.forEach(function(c){ try{ window.requestAnimationFrame(c.fn); }catch(_){} });
    pend.forEach(function(t){
      var wait = Math.max(0, t.at - vt);
      t.real = realST(function(){
        for (var i = 0; i < timers.length; i++) if (timers[i] === t){ timers.splice(i, 1); break; }
        try{ t.fn.apply(null, t.args); }catch(_){}
      }, wait);
      timers.push(t);
    });
  }

  function pump(n){
    for (var i = 0; i < n; i++){
      vt += 1000 / 60;   // the dt a viewer's rAF hands these same loops
      fireDue();
      var q = rafQ; rafQ = [];
      for (var j = 0; j < q.length; j++){ try{ q[j].fn(vt); }catch(_){} }
    }
  }

  /* A REAL frame, explicitly. The driver below needs one to schedule its next chunk
     on, and it cannot use the global: while the crank is turning, the global is this
     module's own queue, so a callback parked there would only ever be run by the very
     pump it is supposed to schedule. That deadlocks at the first chunk. */
  return { on: on, off: off, pump: pump,
           frame: function(fn){ return installed ? realRAF(fn) : requestAnimationFrame(fn); },
           active: function(){ return warped; },
           /* REAL wall time, for the backstop that asks how long a human has been
              waiting. Everything else on this page should be asking vnow(). */
           now: function(){ return installed ? realNow() : (window.performance ? performance.now() : 0); } };
})();

/* ---- HOW MUCH CRANK PER REAL FRAME. 24 virtual frames is 0.4s of match, and it
   measured 5-25ms of real work depending on how much is on the pitch -- about one
   frame's budget, so the tab keeps painting and Stop keeps answering. Higher was
   tested and is a false economy: the win is bounded by the DOM writes the head
   loops do either way, and a chunk long enough to drop frames makes the bracket
   filling in look like a hang rather than a run. */
var SIM_CHUNK = 24;
/* ---- TWO BACKSTOPS, AND THE FIRST ONE FIRES IN PRACTICE.

   A MATCH MIGHT NOT END, and the cap is insurance rather than a diagnosis. One run
   did show a semi-final apparently goalless for a very long time -- but the counters
   were round-scoped at the time (see below), so that reading is contaminated and is
   NOT offered here as evidence of an engine defect. With the accounting fixed, 34
   simulated fixtures across both field sizes completed without a cap ever firing.
   What is true regardless is that the crank REACHES the tail of the distribution in
   seconds rather than in real minutes, so if a wedge exists this control is what
   would meet it, and it needs an answer either way.

   SIX MINUTES IS THE LINE, and it is drawn off measurement rather than taste: the
   longest match seen anywhere in this work is 142 simulated seconds, so six minutes
   is 2.5x past it and nothing legitimate should be near the cap.

   AND WHEN IT FIRES, NOTHING IS INVENTED. The clock goes back and the wedged match
   is simply LIVE, which is exactly the state pressing Kick off would have produced,
   with the same End control to abandon it. Forcing a winner here would be the one
   thing this whole module exists not to do: a fabricated scoreline would go into the
   bracket, the head-to-head count and the draft order and could never be told from a
   real one. A simulation that gives up honestly is worth more than one that lies.

   BOTH CAPS ARE PER FIXTURE, and the first version of this got that wrong in a way
   worth recording because it looked exactly like the defect it was meant to catch. The
   counters ran for the whole ROUND while the numbers were reasoned about per MATCH, so
   four ordinary quarter-finals -- four times a ~50s median, plus four countdowns and
   four whistles -- sailed past a "generous" six minutes and reported a wedge on a round
   in which nothing whatsoever was wrong. A cap that fires on healthy input is worse than
   no cap: it had me hunting an engine bug that the third fixture did not have.

   The real-time cap is the second failure and a different one: "this device cannot do
   this fast enough to be worth doing", which is the honest reason to stop on a phone
   that is struggling. And because a round is at most four fixtures, per-fixture caps
   bound the round too -- with a whole-round backstop underneath them for the case where
   each fixture is individually fine and the total is still not worth anyone's evening. */
var SIM_MAX_SIM_MS = 6 * 60 * 1000;    // one fixture's match time
var SIM_MAX_REAL_MS = 30 * 1000;       // one fixture's share of the viewer's patience
var SIM_MAX_ROUND_MS = 120 * 1000;     // and the whole round's
var sim = null;   // {round, stop, fx0, t0, vms} while a simulation is running

function simRunning(){ return !!sim; }

/* ---- WHAT "SIMULATE" SIMULATES: THE REST OF THIS ROUND. See the button in paint()
   for why the round is the unit rather than one fixture or the whole cup. ---- */
function simulateRound(){
  if (sim) return;
  var nm0 = BR.nextMatch(T.br);
  if (!nm0) return;
  sim = { round: nm0.round, stop: false, fx0: window.__hmFx, told: conTold(),
          t0: CLOCK.now(), t1: CLOCK.now(), vms: 0, wall0: Date.now() };
  window.__hmFx = 99;             // the engine's own FX budget -- see the header
  view = nm0.round;               // the round's own pane, so the scores land where you can see them
  /* THE CLASS BEFORE THE PAINT, or the very first rebuild still plays the entrance
     animation the class exists to suppress -- one fade from zero, at the exact moment
     the button was pressed. Sampling caught it as a single frame; it is the one frame
     a viewer is guaranteed to be looking at. */
  try{ document.body.classList.add('hmTourSim'); }catch(_){}
  paint();
  CLOCK.on().then(function(){ if (sim) step(); });
}

/* ---- AND THE QUALIFIER GETS THE SAME BUTTON, because it is the same complaint.
   The marble race runs 16-20 seconds in front of a twelve-head cup and it is part of
   the same flow; "you don't have to watch everyone" plainly covers the thing you have
   to sit through before anyone has played at all.

   IT IS THE REAL RACE, on the same terms as a fixture. This does not reach past
   __hmRaceQualify to invent a finishing order -- it presses the same Start the race
   the visitor would press and then turns the clock, so the course is generated the
   same way, the same twelve heads fall down it and the same standings() decides who
   crossed where. THE DEGRADATION LADDER IS THEREFORE COMPLETELY UNTOUCHED: a
   simulated race that finishes complete lands on 'full', one that stalls lands on
   'partial' and says so, and one that cannot resolve a team lands on 'skipped' and
   falls back to the play-in. NEVER an invented placing -- there is nowhere in this
   path that a placing could be invented, which is the point of doing it this way. ---- */
function simulateRace(){
  if (sim || !Q || Q.state !== 'ready') return;
  sim = { round: -1, race: true, stop: false, fx0: window.__hmFx, told: conTold(),
          t0: CLOCK.now(), t1: CLOCK.now(), vms: 0, wall0: Date.now() };
  window.__hmFx = 99;
  try{ document.body.classList.add('hmTourSim'); }catch(_){}
  CLOCK.on().then(function(){
    if (!sim) return;
    runQualifier();   // the same call the button makes, on a clock that is being turned
    step();
  });
}

/* ---- THE CONSOLATION SET RUNS ITSELF. Jayden: "I dont want those games to be played more
   of just a simulation so the storytelling can be good like focusing on making it short but
   enjoyable."

   THIS IS simulateRound() WITH A DIFFERENT STOPPING RULE and nothing else. It presses the
   same Kick off the visitor would press, on the same cranked clock, through the same
   step() -- so a consolation slot is settled by the real engine, the real physics and the
   real ball, with drawing skipped. It is a played match nobody sat through, never a dice
   roll, which is the only reason the slot it decides is worth anything to him.

   IT STOPS ON THE MATCH, NOT ON THE ROUND, because a round holds both kinds: the Last 4
   pane carries two championship semi-finals AND the two 5-8 semi-finals under them. The
   drain runs until the next fixture is one somebody is meant to watch. ---- */
function simulateConsolation(){
  if (sim) return false;
  var nm0 = BR.nextMatch(T.br);
  if (!nm0 || !nm0.match.con) return false;
  sim = { round: nm0.round, con: true, stop: false, fx0: window.__hmFx, told: conTold(),
          t0: CLOCK.now(), t1: CLOCK.now(), vms: 0, wall0: Date.now() };
  window.__hmFx = 99;
  view = 'next';
  try{ document.body.classList.add('hmTourSim'); }catch(_){}
  paint();
  CLOCK.on().then(function(){ if (sim) step(); });
  return true;
}
/* The set of consolation results already settled, so a drain can tell the difference
   between "this was decided just now" and "this was decided two rounds ago". */
function conTold(){
  var seen = {};
  if (T.br) T.br.rounds.forEach(function(rd, r){ rd.matches.forEach(function(m, i){
    if (m.con && m.winner !== undefined) seen[r + ':' + i] = 1; }); });
  return seen;
}
function simStop(){ if (sim) sim.stop = true; }

/* THE STATE MACHINE IS ONE LINE OF IT: whenever the screen is sitting on a cast
   fixture with no match live, press its Kick off for it. Everything else -- the
   countdown, the goals, the whistle, __hmTourWin, the hold, between() casting the
   next one -- is the cup running itself, exactly as it does for a viewer. */
function step(){
  if (!sim) return;
  var S = window.__hmSoccer;
  var done = false, why = '';
  try{
    /* ===== A DRAIN CRANKS HARDER, AND THE NOTE ABOVE SIM_CHUNK IS WHY IT CAN.
       That note rejects a bigger chunk for a WATCHED simulation on the grounds that "a
       chunk long enough to drop frames makes the bracket filling in look like a hang
       rather than a run" -- which is a statement about somebody looking at it. Nobody is
       looking at a consolation drain: it is the case the note did not have. Measured
       before this, two consolation fixtures took 62 SECONDS of real time to resolve, which
       is a wait and not the reveal Jayden asked for ("short but enjoyable").
       Four times the crank, only while sim.con is set. Every cap, every backstop and the
       watched path are untouched. ===== */
    var chunk = sim.con ? SIM_CHUNK * 4 : SIM_CHUNK;
    CLOCK.pump(chunk);
    sim.vms += chunk * 1000 / 60;   // this FIXTURE's match time; reset at each kick-off
    if      (sim.stop)                  { done = true; why = 'stopped'; }
    else if (sim.vms > SIM_MAX_SIM_MS)  { done = true; why = 'simcap'; }
    else if (CLOCK.now() - sim.t1 > SIM_MAX_REAL_MS)  { done = true; why = 'realcap'; }
    else if (CLOCK.now() - sim.t0 > SIM_MAX_ROUND_MS) { done = true; why = 'roundcap'; }
    else if (sim.race){
      /* The qualifier settles itself -- qualified() either opens the cup (Q goes
         null) or drops to the skipped rung (Q.state changes). Either is the end of
         the thing this simulation was asked to do. */
      if (!Q || Q.state !== 'running'){ done = true; why = 'race'; }
    } else {
      var nm = BR.nextMatch(T.br);
      /* A drain ends when the next fixture is one to WATCH; a round simulation ends when
         the round does. Same driver, same caps, same hand-back. */
      if (!nm || (sim.con ? !nm.match.con : nm.round !== sim.round)){
        /* ---- THE ROUND'S LAST RESULT IS NOT THE ROUND'S END, and stopping here was
           a real bug rather than a tidiness point. __hmTourWin records the result at
           the WINNING GOAL; the engine's whistle is 5,400ms after it and this file's
           own hold is 5,600. Handing the clock back at the goal left both of those
           to run at wall speed -- so hmTourSim came off while body.hmSoccer was still
           on, the panel went away under `body.hmSoccer .tvScreen{display:none}`, and
           the screen showed five and a half real seconds of a frozen pitch mid-
           celebration before coming back. Cranking through it costs 14 more chunks.
           T.phase leaves 'match' only when between() (or the champion path) has
           repainted, so it is the honest test for "the screen is back". ---- */
        if (!(S && S.on) && T.phase !== 'match'){ done = true; why = 'round'; }
      }
      else if (T.phase === 'table' && T.cur && !(S && S.on)
               && T.cur.round === nm.round && T.cur.index === nm.index){
        if (sim.con) sim.round = nm.round;   // a drain may run past a round boundary
        /* A NEW FIXTURE RESETS THE PER-FIXTURE CLOCKS. Without this the caps are the
           round's, which is the bug recorded above the constants. */
        sim.vms = 0; sim.t1 = CLOCK.now();
        T.phase = 'match'; startFixture(nm);
      }
    }
  }catch(err){ done = true; why = 'threw';
    try{ console.warn('[cup] simulation threw', err); }catch(_){} }
  if (done){ simEnd(why); return; }
  CLOCK.frame(step);   // a REAL frame -- see CLOCK.frame for why the global would deadlock
}

/* ---- STOPPING, and it is the part that has to be right whatever went wrong.
   A simulation can end four ways -- the round finished, Stop was pressed, a backstop
   fired, or something threw -- and all four land here, because the one thing that
   must always happen is that the clock goes back. A cup left running on a virtual
   clock nobody is turning is a dead page. ---- */
function simEnd(why){
  if (!sim) return;
  var was = sim; sim = null;
  /* Only the two clean exits are silent. Everything else is a backstop or a throw,
     which is a thing somebody debugging this screen needs to be told rather than
     left to infer from a round that half ran -- the same reason check()'s findings
     are warned rather than swallowed. */
  if (why !== 'round' && why !== 'stopped' && why !== 'race'){
    try{ console.warn('[cup] simulation stopped:', why,
                      Math.round(was.vms / 1000) + 's simulated,',
                      Math.round(CLOCK.now() - was.t0) + 'ms real'); }catch(_){}
  }
  try{ window.__hmFx = was.fx0 || 0; }catch(_){}
  try{ CLOCK.off(); }catch(_){}
  try{ document.body.classList.remove('hmTourSim'); }catch(_){}
  /* Back to the match-up, because that is where the one action is. Staying on the
     round pane after the last fixture of it would show a finished round and no way on. */
  if (why === 'round' || why === 'stopped') view = 'next';
  /* A race that was cranked and did not settle has to be put down, or __hmRaceOn stays
     true with nothing driving it and the screen behind it never comes back. */
  if (was.race && why !== 'race'){
    try{ if (window.__hmRaceOn && window.__hmRaceEnd) window.__hmRaceEnd(); }catch(_){}
  }
  /* ===== WHAT THE DRAIN SETTLED, TURNED INTO SENTENCES. `was.told` is the snapshot taken
     when the drain started, so this is exactly the matches THIS drain decided and not the
     whole history -- the next championship match-up shows what just happened below it and
     nothing older.
     AND IT COUNTS ITS OWN FAILURES. A drain that resolves nothing means a consolation
     fixture the simulation could not get through; two of those and paint() stops draining
     and hands the fixture back as an ordinary one with a Kick off on it, rather than
     re-entering forever. ===== */
  /* ANY simulation can settle a consolation match, not just a drain: pressing Simulate on
     a round plays the placement fixtures sitting under it in the same pass. So the story is
     built from what CHANGED rather than from which button was pressed -- `told` is the
     snapshot every sim takes when it starts, and the difference is the set of matches this
     one decided. Keying it on the drain was why a round-simulated consolation set was
     played and then never mentioned. */
  if (T.yow && T.br){
    /* WALL TIME, NOT CLOCK TIME. CLOCK.now() is the VIRTUAL clock while a simulation is
       running, so t0..now across a drain measures SIMULATED seconds -- it reported 100.6s
       for two matches that took a couple of seconds to resolve. The number this wants to
       be is how long the reveal made somebody wait. */
    var told = was.told || {}, lines = [],
        secs = Math.round((Date.now() - (was.wall0 || Date.now())) / 100) / 10;
    try{
      T.br.rounds.forEach(function(rd, r){ rd.matches.forEach(function(m, i){
        if (m.con && m.winner !== undefined && !told[r + ':' + i]) lines.push(toldLine(m)); }); });
    }catch(_){}
    if (lines.length){ T.story = lines; T.storySecs = secs; }
    if (was.con) T.conFail = lines.length ? 0 : ((T.conFail | 0) + 1);
  }
  try{ paint(); }catch(_){}
}

// ---------- UI ----------
var host = null;
function el(tag, cls, txt){ var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
/* THE CONTROL CLASSES ARE NAMED AT THE CALL SITE NOW, not held in two constants
   here, because there are only three controls left on this screen and each is
   emitted once: the tabs (`ctl ctl--tab`), Leave (`ctl ctl--secondary ctl--sm`)
   and the primary (`ctl ctl--primary`). controls.css owns the geometry, the
   material, the focus ring, the press scale and the motion rungs for all three;
   tournament.css adds placement and the one state the library has no name for
   (.tvArmed). Two constants pointing at three call sites was how the chip and the
   button drifted apart in the first place. */

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

/* ===========================================================================
   THE SCREEN, REMADE. Jayden, having been told twice that it had been brought
   onto the system:

     "My biggest problem was the UI, and it still looks the exact same on mobile.
      The button isn't even centred. Nothing about the current tournament UI looks
      premium or up to par with anything on the site. It needs to be remade, not
      tweaked. It needs to look like Apple and what we have already. I'm looking
      for innovation, not a lazy patch."

   HE IS RIGHT, AND THE REPORTS WERE WRONG. Screenshotting it at 390 and 320
   before touching anything found a defect nobody had named, and it is the reason
   none of the tuning ever helped:

     THE SCREEN HAD NO SURFACE. `.tvScreen` was a transparent fixed layer and
     every element on it -- the round name, the tabs, the two captains, Kick off
     -- was ink floating directly on the page. Measured at 390x844,
     `elementsFromPoint` at the centre of the Kick off button returned
     tvGo -> tvFixture -> pCard -> pCards -> hero: the primary action of this
     screen was painted on top of a Play-hub card. body.hmTour collapses the hero
     (min-height 772px -> 0), the hub rides up to y=0 behind it, and for the whole
     of its fade the tournament reads as two pages printed on the same paper.

   You cannot tune your way out of that, which is why three passes of tuning did
   not. Everything below follows from giving the screen an object.

   WHAT IT IS NOW. One panel. `.surface` from the shared library -- the same
   ground, the same hairline rim, the same --r-xl 28 as every other big surface on
   the site -- width-capped and centred, sitting above the ground band where the
   heads stand. Inside it, three things in a column:

     tabs      Next, then one per round, named by the bracket
     pane      whichever of those you are looking at
     foot      Leave, and the one primary action

   THE REFERENCE IS THE GRADIENT MAKER, which is the page he called amazing, and
   this is its grammar rather than a new one: a single panel with a hairline and no
   shadow; underlined text tabs with no pill and no box around them; the primary
   action full-width at the foot with a small secondary beside it; and generous,
   even vertical rhythm inside. Measured off that page, its whole control panel
   uses two weights and four sizes, and the dominant size carries 41 of its nodes.

   WHAT WAS SUBTRACTED, because premium is subtraction and this is the list:

     * THE SECOND COLUMN. Band B was a two-track grid -- match-up left, a rail
       right. The rail is gone; the bracket is a tab. One column at every width
       means the phone is no longer a different layout, it is the same layout.
     * THE PANE SWITCH. A phone-only segmented control in a bordered pill,
       measured as the loudest object on the screen at 390. Its job is now done by
       the tab row, which had to exist anyway.
     * THE FIXTURES CHIP, THE SHEET, THE SCRIM, AND THE ESCAPE HANDLER. A whole
       modal, and the only surface on this screen that was ever allowed to scroll.
       The bracket is a pane now, so there is nothing to open and nothing to
       scroll. Three components and an exception, deleted.
     * THE DISTANCE LINE ("18 matches to play"). A bracket shows you how far it is
       by being a bracket.
     * THE COLUMN KEY (P / GD / PTS) and the printed tie-break, which were the
       league's and have no meaning in a knockout.
     * THE CUP'S NAME from the chrome. It is flavour; it survives on the ending,
       where there is room and a reason.

   AND THE BUTTON IS CENTRED, structurally rather than by a nudge. It was
   `justify-self:start` on the second track of a two-track grid, so it began at the
   captains' text column and ran to the gutter -- measured at 390, 91.7px of inset
   on the left against 24px on the right, which is the 67.7px asymmetry he could
   see without measuring. It is now the full width of a panel that is itself
   centred, so there is no number to get wrong.

   NOTHING SCROLLS, at any size. Where it does not fit, it is reduced: a round pane
   holds at most half the field's fixtures, which is four at twelve teams and four
   at eight, and that is bounded by the format rather than by hope.
   =========================================================================== */

/* WHICH PANE IS OPEN: the string 'next', or a round INDEX. It lives out here
   rather than inside paint() because paint() runs after every result, and a
   visitor who had opened the bracket would otherwise be thrown back to the
   match-up by the very event they were watching for. Reset in start(). */
var view = 'next';

/* ---- THE TALE OF THE TAPE, REBUILT. Jayden liked the intent -- "setting the stage" --
   and not the execution: "i would research what actual sports people do to hype up matches
   and put that."

   WHAT BROADCAST MATCH PREVIEWS ACTUALLY DO. Match-centre and pre-match graphics are built
   from a small, repeated set: the HEAD-TO-HEAD record between these two, recent FORM, the
   STAKES (what the result decides), and a storyline -- the rematch, the streak, the run.
   The advanced end of it is xG, heat maps, possession and player ratings.

   SO THE RULE HERE IS: TAKE THE SHAPES, REFUSE THE STATS WE DO NOT HAVE. A fabricated
   rivalry is worse than a flat line, and this tournament tracks no possession, no shots and
   no ratings -- inventing them would be the seed problem again in its most dishonest form.
   What it DOES track is enough for three of the four shapes, and they are printed in the
   order a preview uses them:

     1. THE STAKES, which is the one thing a knockout has more of than a league and the old
        line never said. It is derived from the round -- the winner of a semi-final is in the
        final, and that is a fact about the bracket, not a claim about the teams. Every
        fixture has it, so the tape is never empty from the first round on.
     2. FORM, as the route each side took to get here: how many they have won in this cup and
        what they scored doing it. Real counts from recorded results.
     3. HEAD-TO-HEAD, which is the line this replaces. __hmSess.pair has been recording every
        captain pairing since the page loaded; it now prints the COUNT as well as the last
        winner, because "they have met four times" is a different story from "they have met",
        and the count is the thing a broadcast graphic leads with.

   Round one has no form and usually no history, so it gets the stakes alone -- which is
   correct: before anybody has played, the stakes ARE the story. ---- */
function ord(n){ var s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]); }

/* ---- HOW LONG THIS MATCH IS, SAID BEFORE IT STARTS. Jayden: "make that clear."
   The scoreboard already says it DURING a match -- play-engine.js paints `.sbRule` and keeps
   it honest through deuce ("Win by 2", then "First to N+2" at the cap). What was missing is
   before kick-off, which is exactly when a viewer is deciding whether to watch.

   THE RULE IS NOT WHAT THE BRIEF SAID. It is not "every match first to 3, the final first to
   5": play-engine.js:2411 computes `left = (rounds.length - 1) - cur.round` and takes
   first-to-5 at the final, first-to-4 one round out, first-to-3 everywhere else. So a semi is
   4, and printing 3 there would have been a confident lie on the one screen that exists to
   explain the match.

   IT IS A SECOND COPY OF A NUMBER THIS LANE DOES NOT OWN, and that is the real risk here --
   the engine could change its curve and this label would go on saying the old one. The
   expression is mirrored exactly, and play-screens-contract asserts the label against the
   scoreboard's own `.sbRule` on a LIVE match, so the two cannot drift without the gate
   failing. A comment is not an invariant. ---- */
function matchLength(round){
  /* THE LEAGUE IS ONE SCORE, AND THIS LANE STILL DOES NOT OWN THE NUMBER.
     2026-08-27. play-engine.js takes t=1 whenever YOW is on, before the
     stepped ladder can apply; the same short-circuit is mirrored here, in the
     same order, for the same reason the ladder below is mirrored -- the label
     must never state a rule the engine is not running. play-screens-contract
     checks this against a LIVE match, so the two cannot drift silently. */
  if (window.__hmYowLeague) return 1;
  var left = (T.br.rounds.length - 1) - (round | 0);
  return (left <= 0) ? 5 : (left === 1 ? 4 : 3);
}

/* WHAT THE WINNER EARNS. Read off the bracket rather than named, so it is right at any
   field size and says "quarter-final" only when a quarter-final is what comes next. */
function stakesLine(round){
  var last = T.br.rounds.length - 1;
  /* ── THE FINAL IS FOR THE 1.01, AND IT SHOULD SAY SO.  2026-08-27 ──────────
     Jayden: "the final game should be the 101 game" -- and, asked what 101 is,
     "the 101 is the first pick in the draft".
     "The winner takes the cup" was naming a trophy that does not exist. This
     bracket has one purpose and the file already says so three hundred lines
     down: it settles the order of a real twelve-team draft, and what the final
     is worth is the first overall pick. The consolation ladder has been telling
     the truth about its stakes all along -- "Winner takes the 1.01, first
     overall" -- while the one screen a viewer reads BEFORE the biggest match of
     the cup called it a cup.
     slot() is the sourced notation, round dot pick, and it is a hoisted
     function declaration so it is in scope here despite living below. "first
     overall" stays beside it because that is how the number is said out loud
     and it is the half a non-drafter can read. */
  if (round >= last) return 'The winner takes the ' + slot(1) + ', first overall.';
  var next = T.br.rounds[round + 1];
  if (!next) return '';
  return round + 1 === last ? 'The winner is in the final.'
                            : 'The winner goes to the ' + next.label.toLowerCase() + '.';
}

/* THE ROUTE, which is this cup's form guide. Wins and goals only -- both counted from
   results that were actually played.

   IT COLLAPSES WHEN THE TWO RECORDS MATCH, and that is the difference between a line that
   reads written and one that reads generated. In a knockout the two sides of a semi-final
   have by definition won the same number of matches, so the naive version printed "X has
   won 2, scoring 4. Y has won 2, scoring 4." on every fixture past the first round -- the
   same sentence twice, which is precisely the "weak execution" being fixed. When the wins
   match, the wins are said once and only the goals are compared, which is also the more
   interesting half. */
function formOf(tm){
  if (!tm) return null;
  var r = BR.record(T.br, tm.id);
  return r.played ? r : null;
}
function formLine(A, B){
  var a = formOf(A), b = formOf(B);
  if (!a || !b || (!a.won && !b.won)) return '';
  if (a.won === b.won){
    var n = a.won === 1 ? 'one' : a.won === 2 ? 'two' : String(a.won);
    if (a.gf === b.gf)
      return 'Both have won ' + n + ', scoring ' + a.gf + '.';
    return 'Both have won ' + n + '. ' + (a.gf > b.gf ? A.name : B.name)
         + (window.__hmYowLeague ? ' has the points, ' : ' has the goals, ') + Math.max(a.gf, b.gf) + ' to ' + Math.min(a.gf, b.gf) + '.';
  }
  var hi = a.won > b.won ? A : B, lo = a.won > b.won ? B : A;
  var hr = a.won > b.won ? a : b, lr = a.won > b.won ? b : a;
  return hi.name + ' has won ' + hr.won + ' to ' + lo.name + '\u2019s ' + lr.won + '.';
}

function buildTape(A, B, nm2){
  var p = el('p', 'tvTape');
  function line(txt){
    if (!txt) return;
    if (p.childNodes.length) p.appendChild(el('br'));
    p.appendChild(document.createTextNode(txt));
  }
  /* "Win by two" cannot be said about a target of one, and "First to 1" reads
     like a bug rather than a rule. One score wins is the whole sentence. */
  try{ if (nm2){
    var _len = matchLength(nm2.round);
    /* AND IN THE LEAGUE THE TAPE DOES NOT REPEAT THE STAKE LINE.  stakeOf() prints
       "Winner takes the 1.01, first overall . loser the 1.02" four lines above,
       and stakesLine() on the final returns "The winner takes the 1.01, first
       overall" -- the same sentence twice on the one screen that matters most.
       Screenshotted at 1440 on 2026-08-28. The League has a stake line of its own,
       so the tape says only the thing the stake line does not: how the match ends. */
    line((_len <= 1 ? 'One score wins.' : 'First to ' + _len + ', win by two.')
         + (T.yow ? '' : ' ' + stakesLine(nm2.round)));
  } }catch(_){}
  try{ line(formLine(A, B)); }catch(_){}
  try{
    var ka = A && A.slots && A.slots[0], kb = B && B.slots && B.slots[0];
    if (ka != null && kb != null && window.__hmSessFlags){
      var h = window.__hmSessFlags(ka, kb);
      if (h && h.met){
        /* THE COUNT COMES FROM __hmSess.pair DIRECTLY, because __hmSessFlags
           (play-engine.js:2027, not this lane) returns met/revenge/lastWinner and does not
           expose it -- and the count is the thing a broadcast head-to-head graphic leads
           with. The key is built with the same expression __hmTourWin uses to WRITE it, so
           the two cannot disagree; if the shape ever changes, `n` falls back to 1 and the
           line degrades to "They have met before" rather than printing a wrong number. */
        var n = 1;
        try{ var pk = (ka < kb ? ka + '|' + kb : kb + '|' + ka);
             var pr = window.__hmSess && window.__hmSess.pair && window.__hmSess.pair[pk];
             if (pr && pr.count) n = pr.count | 0; }catch(_){}
        var say = (n > 1) ? 'They have met ' + (n === 2 ? 'twice' : n + ' times') + '.'
                          : 'They have met before.';
        if (p.childNodes.length) p.appendChild(el('br'));
        p.appendChild(document.createTextNode(say + ' '));
        var w = (h.lastWinner === ka) ? A : (h.lastWinner === kb) ? B : null;
        if (w){ p.appendChild(el('em', null, w.name));
                p.appendChild(document.createTextNode(' won the last one.')); }
      }
    }
  }catch(_){}
  return p;
}

/* ---- ONE SIDE OF A FIXTURE, and it is the SAME object everywhere it appears:
   the match-up's two captains and every row of every round pane are this function.
   Building the bracket's rows a second way is how the two eventually disagree,
   which is exactly what the league's separate table widget did.

   `big` is the match-up's rendering -- a larger face and the name at the panel's
   one heading size. Everything else about it is identical, including which cells
   exist, so the two read as the same object at two scales rather than as two
   designs. ---- */
/* WHERE AN UNFILLED SLOT COMES FROM, read off the bracket the same two ways
   propagate() fills it: a placement match carries `feed` -- two {r,i,s}
   descriptors, and `s` is what makes "Loser of Last 8" expressible at all -- and
   a championship match is fed by the fold, match i of round r taking the winners
   of matches 2i and 2i+1 of the round before. The opening round is fed by the
   draw rather than by a fixture, so it has nothing to name and says so by
   returning empty. Mirroring propagate() rather than inventing a second reading
   is the point: if the two ever disagree the screen is lying about the draw. */
function sourceOf(r, i, side){
  /* ---- AND IT GOES AT 640, on the same rule the tape goes by at 700 and the
     drain report at 640: at this height it costs more than it carries. Below
     640 the round pane lays its ties out two-up, which leaves a name column of
     ~110px -- measured at 320x568, "Winner of 1.01-1.04" truncated to
     "Winner ..." in all eight cells, which is a label that has stopped being
     one. The em-dash comes back and the tie's own tag carries the fact, because
     the tag is the shorter of the two statements and the one a drafter reads. */
  var shortVp = false; try{ shortVp = innerHeight <= 640; }catch(_){}
  if (shortVp) return '';
  var br = T.br; if (!br) return '';
  var rd = br.rounds[r], m = rd && rd.matches[i]; if (!m) return '';
  if (m.feed && m.feed[side]){
    var f = m.feed[side], src = br.rounds[f.r];
    if (!src) return '';
    return (f.s === 'w' ? 'Winner of ' : 'Loser of ')
         + srcName(src, src.matches[f.i]);
  }
  var first = br.playIn ? 1 : 0;
  if (r <= first) return '';
  var prev = br.rounds[r - 1];
  var pm = prev && prev.matches[i * 2 + side];
  return pm ? ('Winner of ' + srcName(prev, pm)) : '';
}
/* WHAT TO CALL THE MATCH A SLOT IS WAITING ON, and the round's name is not
   always enough. The League's last round is four fixtures, and three of them are
   fed out of the SAME round as the fourth: the 1.05 decider takes the winner of
   a placement semi that sits in Last 4 beside the championship semis. Labelled
   by round, two different ties both read "Winner of Last 4" and mean different
   matches -- which is worse than the dash it replaced, because it is confidently
   wrong rather than blank.
   So in the League a source is named by WHAT IT IS PLAYING FOR: its own wp/lp
   collapsed to the range of picks it covers. "Winner of 1.01-1.04" and "Winner
   of 1.05-1.08" are two different sentences about two different matches, in the
   notation the tie tag, the stake line and the draft order all already use.
   Soccer's cup has no draft slots, so it keeps the round's name. */
function srcName(rd, m){
  if (T.yow && m && m.wp && m.lp){
    var lo = Math.min(m.wp[0], m.lp[0]), hi = Math.max(m.wp[1], m.lp[1]);
    if (lo !== hi) return slot(lo) + '\u2013' + slot(hi);
    return 'the ' + slot(lo);
  }
  return rd.short;
}

function sideRow(tm, opts){
  opts = opts || {};
  /* `tvTBD` IS THE CLASS THE COMMENT BELOW ALWAYS NEEDED. It says "no colour
     stripe on a slot nobody has qualified for", and that was never true: leaving
     --tcx unset falls through to .tvChipC's OWN fallback, rgb(117,117,117), so
     every empty slot wore grey -- eight of them on the League's last round pane.
     A class is what lets the stylesheet tell the two states apart. */
  var row = el('div', 'tvSide' + (opts.big ? ' tvSideBig' : '')
                    + (tm ? '' : ' tvTBD')
                    + (opts.won ? ' tvWon' : '') + (opts.lost ? ' tvLost' : ''));
  /* No colour stripe on a slot nobody has qualified for: a grey bar is a team
     wearing grey, and an unplayed semi-final used to show four of them. */
  var c = el('i', 'tvChipC');
  if (tm) c.style.setProperty('--tcx', tm.col);
  row.appendChild(c);
  var fc = el('span', 'tvFaceC');
  var cut = tm && tm.captain && (tm.captain.portrait || tm.captain.cut);
  if (cut){ var im = el('img'); im.src = cut; im.alt = ''; im.draggable = false; fc.appendChild(im); }
  row.appendChild(fc);
  /* AND AN EMPTY SLOT NAMES WHAT WILL FILL IT. §4 of the League's visual
     standard asks an undecided side to say something rather than wear grey, and
     an em-dash on its own is the smallest possible nothing: the League's last
     round pane was eight of them. The bracket knows the answer -- a placement
     fixture carries an explicit `feed`, and a championship one is fed by the
     fold -- so "Winner of Last 4" is read off the draw rather than written
     beside it, exactly as the stake sentence and the draft order are. */
  row.appendChild(el('span', 'tvNm', tm ? tm.name : (opts.src || '\u2014')));
  /* Archivo, tabular, on the numeral only -- the one place the broadcast face is
     allowed outside the scoreboard, and the reason a column of scores lines up. An
     unplayed tie prints nothing rather than a dash: an empty score column IS
     "not yet", and a column of dashes says the same thing louder. */
  if (opts.score !== undefined || opts.scoreSlot)
    row.appendChild(el('span', 'tvSc bcNum',
      opts.score === undefined ? '' : String(opts.score | 0)));
  return row;
}

/* ---- A ROUND, AS A PANE. At most half the field's fixtures -- four at eight
   teams, four at twelve -- so its height is bounded by the format rather than by
   hope, which is what lets this screen keep its promise that nothing scrolls.

   The fixture that is next is washed and rimmed, never elevated: it is the one
   place the two halves of this screen say they are about the same subject. ---- */
function buildRound(into, r, nm2){
  var rd = T.br.rounds[r];
  if (!rd) return;
  var head = el('div', 'tvHead');
  head.appendChild(el('p', 'tvEyebrow', rd.label));
  into.appendChild(head);
  var list = el('ol', 'tvTies');
  rd.matches.forEach(function(m, i){
    var decided = (m.winner !== undefined);
    var isNext = !!(nm2 && nm2.round === r && nm2.index === i);
    var tie = el('li', 'tvTie' + (isNext ? ' tvTieNext' : ''));
    [[m.a, m.sa], [m.b, m.sb]].forEach(function(pr, side){
      var tm = teamById(pr[0]);
      var won = decided && tm && m.winner === tm.id;
      tie.appendChild(sideRow(tm, { won: won, lost: decided && tm && !won,
                                    src: tm ? '' : sourceOf(r, i, side),
                                    score: decided ? pr[1] : undefined,
                                    scoreSlot: true }));
    });
    /* ===== THE RIGHT-HAND CELL, AND IT SAYS ONE OF TWO THINGS. §3 and §4 of the
       League's visual standard (play.css). The tinted, rimmed, outdented wash
       that used to mark the next fixture is gone -- it was a second frame inside
       the panel and it invented a fourth left edge -- so the mark is a word in
       the cell the score column vacated when one score started winning.

       WHEN THE TIE IS NOT NEXT AND ITS SLOTS ARE ALREADY DECIDED, the cell says
       WHICH SLOTS. `wp`/`lp` are the draft picks still reachable by the winner
       and the loser; a terminal fixture has both collapsed to a single number,
       and every fixture in the League's last round is one. That pane used to be
       four ties of two dashes each with nothing to distinguish them -- four
       different pairs of picks, and not one of them named. Now each row carries
       the two seats it decides. Non-terminal rounds print nothing: "1.01-1.08"
       on a quarter-final is the whole field and would be clutter, not a fact.

       Nothing is invented here: slot() is the same function the stake sentence
       and the draft order already print, so the three cannot disagree. ===== */
    if (isNext){
      tie.appendChild(el('span', 'tvTieTag', 'Next'));
    } else if (T.yow && m.wp && m.lp && m.wp[0] === m.wp[1] && m.lp[0] === m.lp[1]){
      tie.appendChild(el('span', 'tvTieTag tvTieStake',
                         slot(m.wp[0]) + ' \u00b7 ' + slot(m.lp[0])));
    }
    list.appendChild(tie);
  });
  into.appendChild(list);
}

/* ---- HOW THE FIELD WAS MADE, in the slot the 8/12 control used to hold.
   The control is gone -- the field follows the roster now -- but the honesty it was standing
   next to is not: if six of the eight captains are eggheads, the screen should say six, not
   let a visitor assume the cup is full of heads they built. One quiet line, on until the
   first result lands, then it is history and the round name has the row to itself.

   It is a fragment rather than a sentence because it is a legend, not prose: "3 yours -
   5 eggheads" reads at a glance in a 248px row, which "Three of your heads and five
   eggheads" does not. ---- */
function rosterLine(){
  var r = T.roster; if (!r) return '';
  var bits = [];
  if (r.mine)  bits.push(r.mine + ' yours');
  if (r.house) bits.push('Jayden');
  if (r.eggs)  bits.push(r.eggs + ' egghead' + (r.eggs === 1 ? '' : 's'));
  return bits.join(' \u00b7 ');
}

/* ---- THE FINAL GETS THE POSTER, AND IT IS NOT THE WIPE COMING BACK.
   Jayden wants "that finals poster design implemented into the UI of the final matchup".

   READ THE CANCELLATION FIRST, because this is the feature that grew back once already. On
   2026-08-04 `bcSting` drove a full-viewport skewed sweep in the cup's paint, on every
   fixture: "The poster coming over the screen looks like a glitch more than something we
   should be using." A screen-covering flash arriving unbidden between two still layouts
   reads as a repaint fault. NOTHING BELOW ANIMATES, nothing covers the screen, and nothing
   here can appear on a semi-final -- `isFinal` is `round === rounds.length - 1`, the same
   expression that sets hmFinal, so the treatment and the gold ball turn on together.

   THE SECOND HALF OF THAT CANCELLATION ALSO MATTERED and it is why this is a BANNER rather
   than a print: the old poster COMPOSITED THE REAL HEADS into the artwork (there was a
   per-asset head-placement table and an alpha probe to size them), so it was "a picture of
   the two captains twelve inches above the two captains". images/poster-final.webp is the
   backdrop on its own -- stylised, generic, nobody's face -- so used as art it duplicates
   nothing. The two real captains are underneath it, photographic and unmistakable.

   WHAT IT ACTUALLY IS: a still picture in a card, --r-lg (the cards-and-images rung),
   standing to the right of the two captains. It is a thing this site already does everywhere.

   ---- IT WAS A BAND ACROSS THE TOP AND THAT WAS THE BUG. Jayden, looking at the screen:
   "the finals matchup screen doesnt look good the poster isint even showing and it looks
   really bad and not balanced." The poster was in the DOM, the file returned 200 and the
   image decoded -- so "isn't even showing" was not a load failure and chasing one would
   have found nothing. It is a CROP failure, and the arithmetic is decisive.

   images/poster-final.webp is 1000x1295: two heads facing each other over a gold ball, a
   trophy and flames, composed VERTICALLY. The band was 388x99 -- an aperture of 3.9:1 --
   and cover fitted the width, so what reached the screen was 255 source pixels of the
   1295. EIGHTY PERCENT OF THE PICTURE WAS OUTSIDE THE FRAME, both heads included. What was
   left was an unreadable gold smear, and he is right that it is not the poster showing.
   Re-aiming object-position could not fix it either: the subject the crop has to contain
   -- both faces down to the ball -- is 470 source pixels, which is 2.1:1, and at 388 wide
   that is a 182px band the pane's height budget does not have.

   SO THE APERTURE TAKES THE PICTURE'S OWN PROPORTIONS, 1000/1295, and the whole artwork is
   inside the frame at every size. That is the subtraction: the band is gone rather than
   re-tuned, and the thing left behind is the picture itself.

   AND IT BALANCES THE PANE FOR FREE, because a portrait card is exactly the shape of the
   space the match-up was leaving empty. The heavy full-width saturated band sat on top of a
   sparse left-hugging column; side by side, the two halves of the row hold each other up.
   The captains' column is untouched -- its single left edge was a deliberate fix ("the old
   column had THREE left edges for five elements") and nothing here reopens it.

   IT NO LONGER HAS TO BE DROPPED ON A SHORT VIEWPORT, and that is a consequence rather than
   a second decision. Beside the captains the picture costs the pane no height of its own
   until it is taller than they are, so at 320x568 it simply narrows to their height instead
   of disappearing. Measured, the pane got SHORTER at every size -- see tournament.css. ---- */
/* ===========================================================================
   THE DRAFT'S OWN LANGUAGE. Jayden: "research into the language of it."

   SOURCED, not paraphrased. A slot is written ROUND DOT PICK -- 1.01 through 1.12 -- and
   drafters say "the 1.01", "I've got the 1.06", "picking sixth" and "first overall"
   (FantasyPros, RotoWire, FTN, Fantasy Life all use the notation in running prose). THE
   TURN is the last pick of a round, and it matters because a snake draft reverses: in a
   twelve-team league the 1.12 is followed immediately by the 2.01, so that manager takes
   two picks back to back with nobody able to cut in between (Yahoo Sports, DraftKings
   Network, Athlon). That is why the 1.01 is not unarguably the best seat, and it is why
   the last slot in this field gets named rather than treated as the booby prize.

   "The wheel" was checked and is NOT used here. It turns up as a synonym for the turn in
   some rooms, but it did not appear in any of the glossaries searched, and a term half the
   audience reads as something else is worse than the term everybody knows. The turn is the
   one that is unambiguous.

   The vocabulary lives in these three functions so the fixture screen, the consolation
   story and the draft order all speak with one voice and cannot drift apart.
   =========================================================================== */
function slot(n){ return '1.' + (n < 10 ? '0' : '') + n; }
var ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
           'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
function ordWord(n){ return ORD[n] || (n + 'th'); }
/* WHAT THIS FIXTURE IS FOR, read off the bracket rather than written beside it. `wp`/`lp`
   are the slot ranges still reachable by the winner and the loser, stamped by
   addPlacement(); a terminal match has both collapsed to one number. */
function stakeOf(m){
  if (!m || !m.wp) return '';
  var N = T.br ? T.br.N : 12, w = m.wp, l = m.lp;
  /* ---- THE SHORT FORM AT 360, and it is the same reduction roundShortLabel and the
     qualifying screen's "Start" already make, for the same measured reason. At 320 the
     pane is 248px wide and the FINAL's pane -- which also carries the still poster -- has
     139px of height; the long sentence wraps to two lines there and took the content to
     143. Four pixels, and the contract says nothing on this screen scrolls.
     The verbs are what go. "Winner 1.01 · loser 1.02" is the same two facts in the
     notation a drafter reads anyway, and it is one line at 248px. Nothing is dropped --
     dropping it would have cost the small phone the one sentence this mode was asked
     for. ---- */
  var tight = false; try{ tight = innerWidth <= 360; }catch(_){}
  if (w[0] === w[1] && l[0] === l[1]){
    if (tight) return 'Winner ' + slot(w[0]) + ' \u00b7 loser ' + slot(l[0])
                    + (l[0] === N ? ' (the turn)' : '');
    if (w[0] === 1)
      return 'Winner takes the ' + slot(1) + ', first overall \u00b7 loser the ' + slot(2) + '.';
    return 'Winner takes the ' + slot(w[0]) + ' \u00b7 loser the ' + slot(l[0])
         + (l[0] === N ? ', and the turn.' : '.');
  }
  if (tight) return 'Winner ' + slot(w[0]) + '\u2013' + slot(w[1])
                  + ' \u00b7 loser ' + slot(l[0]) + '\u2013' + slot(l[1]);
  return 'Winner picks ' + slot(w[0]) + '\u2013' + slot(w[1])
       + ' \u00b7 loser ' + slot(l[0]) + '\u2013' + slot(l[1]) + '.';
}
/* ONE LINE FOR A MATCH NOBODY WATCHED. The result has to be TOLD rather than shown, so it
   carries the two things a drafter would actually say out loud: who beat whom, and which
   seat that bought. Short enough to read a whole consolation round in a couple of seconds,
   which is the brief -- "short but enjoyable" -- and it is not a score table. */
function toldLine(m){
  var N = T.br ? T.br.N : 12;
  var wA = (m.winner === m.a), w = teamById(wA ? m.a : m.b), l = teamById(wA ? m.b : m.a);
  var ws = wA ? m.sa : m.sb, ls = wA ? m.sb : m.sa;
  var wn = w ? w.name : '\u2014', ln = l ? l.name : '\u2014';
  var head = wn + ' ' + (ws | 0) + '\u2013' + (ls | 0) + ' ' + ln;
  if (m.place !== undefined){
    var lp = m.place + 1;
    return head + ' \u2014 the ' + slot(m.place) + '. ' + ln + ' '
         + (lp === N ? 'takes the turn at ' + slot(lp) : 'picks ' + ordWord(lp)) + '.';
  }
  return head + ' \u2014 ' + wn + ' plays for the ' + slot(m.wp[0]) + ', '
       + ln + ' for the ' + slot(m.lp[0]) + '.';
}

/* ---- THE PICK IS THE LEAGUE'S ACCENT, so it is a node and not a substring.
   Every sentence this screen prints -- the stake, the drain report, the champion's
   prize -- has a draft slot in it, and the slot is the only thing on these screens
   that matters more than the prose around it. Wrapping it in <em> reuses the
   emphasis the tape has always had for a winner's name, so there is ONE emphasis
   mechanism on the panel rather than a second colour or a third weight rung.
   league.css draws it: ink, 600, tabular figures.
   Built from text nodes rather than innerHTML because these strings carry team
   names, which come off the roster and are not this lane's to trust. ---- */
function pickText(into, txt){
  var re = /1\.\d\d/g, at = 0, m;
  while ((m = re.exec(txt))){
    if (m.index > at) into.appendChild(document.createTextNode(txt.slice(at, m.index)));
    into.appendChild(el('em', null, m[0]));
    at = m.index + m[0].length;
  }
  if (at < txt.length) into.appendChild(document.createTextNode(txt.slice(at)));
  return into;
}

function isFinalRound(round){ return round === T.br.rounds.length - 1; }

function buildNext(into, A2, B2, nm2){
  /* The round's name and the field control share one line rather than taking two.
     At 320x568 the pane has a measured 108px to spend and a row of its own is 44
     of them -- see tournament.css's short-viewport block. The eyebrow flexes and
     the control is hard right, which is the Lab's header row exactly. */
  var head = el('div', 'tvHead');
  var rd = nm2 ? T.br.rounds[nm2.round] : null;
  var first = (BR.played(T.br) === 0);
  /* THE ROUND TAKES ITS SHORT NAME WHEN IT IS SHARING THE LINE, and that is a
     measured reduction rather than a preference. At 320 the panel's inner width is
     248px; "QUARTER-FINAL" in --tr-caps is ~130 of it, and with the label and the
     two buttons the row came to 272 -- so the "12" button was clipped by the
     panel's own edge. "LAST 8" is 55, which brings the row to 213. It is the same
     name its own tab is showing two lines above, so nothing is lost. */
  var fin = !!(nm2 && isFinalRound(nm2.round));
  var eb = el('p', 'tvEyebrow' + (fin ? ' tvEyebrowGold' : ''),
              rd ? (first ? rd.short : rd.label) : '');
  head.appendChild(eb);
  if (first){ var rl = rosterLine();
    if (rl) head.appendChild(el('span', 'tvOptL', rl)); }
  into.appendChild(head);
  /* ===== THE STAKE, AND IT IS ONE LINE OF TYPE. Jayden: "the games need to specifically
     say what draft position they are playing for. Like loser gets '6' pick for instance."
     It sits directly under the round's name because that is the sentence that answers
     "why does this match matter", and it is derived from the bracket (stakeOf reads the
     match's own wp/lp) so it cannot say one thing while the draw does another.
     .tvQual is the pane's existing body line -- the same type, size and colour the
     qualifying screen uses. No new class, no new chrome, nothing to style. ===== */
  /* THE STAKE IS COMPUTED HERE AND APPENDED BELOW THE MATCH-UP.  It answers
     "what is this for", which is a question you ask AFTER you have seen who is
     playing; above the captains it read as a caption on the round's name. It is
     still COMPUTED before them, because __hmStakeNow is what the match bar reads
     to put the pick beside the round. */
  var stakeP = null;
  if (T.yow && nm2){
    var st = stakeOf(nm2.match || BR.matchAt(T.br, nm2.round, nm2.index));
    try{ window.__hmStakeNow = st || ''; }catch(_){}
    if (st) stakeP = pickText(el('p', 'tvQual'), st);
  }
  var vs = el('div', 'tvVs');
  vs.appendChild(sideRow(A2, { big: true }));
  vs.appendChild(el('div', 'tvV', T.yow ? 'v' : 'v.'));   // the League's hairline carries the mark; a full stop after it is a stray glyph
  vs.appendChild(sideRow(B2, { big: true }));
  /* THE POSTER STANDS BESIDE THE TWO CAPTAINS, and that is one change fixing two
     complaints -- see the note above buildNext for why the band it replaces could not
     work. The captains keep their own column and their single left edge exactly as they
     had it; the picture takes the empty half of the row that was making the pane read
     left-heavy. Nothing about the non-final match-up is touched: `fin` gates the wrapper,
     so every other round emits the same `.tvVs` straight into the pane it always did. */
  if (fin){
    var meet = el('div', 'tvMeet');
    meet.appendChild(vs);
    var b = el('div', 'tvPoster');
    var im = el('img'); im.src = 'images/poster-final.webp'; im.alt = '';
    im.draggable = false; im.decoding = 'async';
    b.appendChild(im);
    meet.appendChild(b);
    into.appendChild(meet);
  } else {
    into.appendChild(vs);
  }
  if (stakeP) into.appendChild(stakeP);
  /* ===== THE STORY TAKES THE TAPE'S SLOT, IT DOES NOT ADD A ROW. Appended under the tape
     it overflowed: this pane's height is bounded and the two lines went behind the footer's
     own buttons -- the capsule trap, and play-screens-contract asserts that nothing here
     scrolls. The pane has room for exactly one block of small type between the captains and
     the foot, so the two of them share it.

     AND THE SWAP IS THE RIGHT WAY ROUND. The tape is a form guide -- "both have won two,
     scoring 8" -- which is flavour about a match that has not happened. The story is the
     result of a match that HAS, and it carries two draft slots he is going to act on. When
     there is one to tell it is the more valuable use of the same six lines of space, and
     when there is not, the tape has it back.

     The match-up screen only ever holds two of these: the consolation set that lands with
     the final -- third, fifth and seventh place -- arrives when there is no next fixture at
     all, so its three lines go to the champion screen, which has the room. ===== */
  /* The swap is conditional on the story actually rendering: buildStory() declines on a
     short viewport, and a pane that dropped the tape for a story that never arrived would
     be a row emptier than the one that shipped. */
  var told9 = false;
  if (T.yow && T.story && T.story.length){
    var before9 = into.childNodes.length;
    buildStory(into);
    told9 = into.childNodes.length > before9;
  }
  if (!told9) into.appendChild(buildTape(A2, B2, nm2));
}

/* ---- THE CONSOLATION SET, TOLD. These matches were played for real and nobody watched
   them, so the only thing that can carry them is the sentence. One line each, in the voice
   a drafter would use -- "Milo 3-1 Gus - the 1.05. Gus picks sixth." -- under a quiet
   eyebrow, and gone again as soon as the next set lands.
   It is type on the pane's own ground: .tvEyebrow and .tvQual, both already there, no rule
   and no box. A stranger reads two facts a line and needs no legend for either. ---- */
/* ===== AND IT IS DROPPED ON A SHORT VIEWPORT, WHICH IS ARITHMETIC RATHER THAN TASTE.
   Measured at 320x568 with the real pane: the panel has 139px of pane to spend, and two
   story lines took it to 231 -- 92px over, because at 248px of inner width each sentence
   wraps to three lines. One line would still overrun. The stake line above fits at every
   size and stays; this does not fit at this one and goes.

   NOTHING IS LOST, and that is what makes it a drop rather than a truncation. The Draft tab
   carries the whole order, 1 through 12, with the slot beside every name, and that is the
   screen he actually acts on -- the story is the telling, not the record. 640px of height
   is tournament.css's own short-viewport threshold, matched rather than invented, so this
   turns off exactly where the stylesheet already starts shedding rows. ===== */
function buildStory(into){
  if (!T.yow || !T.story || !T.story.length) return;
  var shortVp = false; try{ shortVp = innerHeight <= 640; }catch(_){}
  if (shortVp) return;
  /* NOT `.tvEyebrow`, AND THAT IS §6 RATHER THAN A PREFERENCE. The pane this
     lands in already has one: buildNext's head prints the round's name in caps
     at the top of it. A second caps run four lines below the first is two
     eyebrows arguing about which group they head, and the standard allows one
     per pane. `.tvStoryL` is the same words as a caption -- sentence case, one
     rung down, muted -- which is what a label on a report is. */
  /* "Below the line" removed 2026-08-27 -- he named it as clutter. The rows
     under it are already visually separated and already say what they are;
     a label announcing a boundary the layout draws is one more thing to read
     for no new information. */
  /* ONE PARAGRAPH, NOT N. The pane is a flex column with a gap, so a line per element pays
     that gap between every pair -- and on the FINAL, which also carries the poster, that
     was measured at 294px of content in a 289px pane. Five pixels, but the contract says
     nothing on this screen scrolls and five is enough to make it. The report is one thing
     anyway; <br> between its lines is what it always should have been. */
  /* `.tvStory` IS A FIX, NOT A RENAME.  tournament.css shrank the champion's
     portrait for `.tvPane:has(.tvStoryL)` and this function has always emitted a
     bare `.tvQual` -- so that rule never fired once, and the overrun its own
     comment describes as fixed was still shipping: screenshotted 2026-08-28 at
     1440x900 and 390x844, the last line of the report drawn UNDER the Leave
     button. A selector that matches nothing fails in silence. The class the JS
     writes and the class the stylesheet asks for are one string now.
     One <span> per line rather than <br>: the report is a list of results, so it
     is a grid of rows and its gap is a token. */
  var pEl = el('p', 'tvQual tvStory');
  T.story.forEach(function(line){
    pEl.appendChild(pickText(el('span'), line));
  });
  into.appendChild(pEl);
}

/* ---- THE DRAFT ORDER. This is what the whole tournament is FOR. Jayden: "after the cup
   finishes can see clear number order to make sure everyone knows the draft order at the
   end it can be another tab to make it more clean and optional to check out."

   So it is a TAB, it appears only when the cup is complete, and it is 1..N with no gaps --
   a draft needs a number for every head, not a list of survivors. standings() sorts the
   whole draw, so it already yields that.

   EVERY POSITION SAYS WHERE IT CAME FROM, which is the difference between this and the seed.
   The right-hand cell is the round the team went out in -- "Semi-final" -- because in a
   knockout how far you got IS your result, and it is the fact the bracket actually
   established. Inside a round the order is goal difference then goals scored, both counted
   from matches that were played.

   AND WHERE IT DID NOT COME FROM ANYTHING. Two teams that went out in the same round having
   scored and conceded identically are separated by the draw, and nothing was earned either
   way. Those rows carry a marker and the pane prints the key once at the foot. A draft order
   that quietly presents a coin-toss as a ranking is the seed problem in the one place it
   would actually cost somebody something. ---- */
function buildDraft(into){
  var rows = BR.standings(T.br);
  var head = el('div', 'tvHead');
  head.appendChild(el('p', 'tvEyebrow', 'Draft order'));
  into.appendChild(head);
  var list = el('ol', 'tvDraft');
  /* THE ROW COUNT IS NOT WRITTEN IN THE STYLESHEET. It is ceil(N/2), set from the length
     of the order just built, for the same reason the round names derive from the bracket:
     six is what twelve heads happen to need today, and a hardcoded six grows a third and
     fourth column the moment the field changes. That is not hypothetical -- it is exactly
     what the league's hardcoded four did when the field went eight to twelve, and it hid
     half a table silently. */
  list.style.setProperty('--tvDraftRows', String(Math.ceil(rows.length / 2)));
  var anyDrawn = false, anyRace = false,
      racePart = !!(T.race && T.race.mode === 'partial');
  rows.forEach(function(row){
    var tm = teamById(row.id);
    var li = el('li', 'tvDraftRow' + (row.tiedFromDraw ? ' tvDrawn' : ''));
    li.appendChild(el('span', 'tvDraftN bcNum', String(row.rank)));
    var c = el('i', 'tvChipC'); if (tm) c.style.setProperty('--tcx', tm.col);
    li.appendChild(c);
    li.appendChild(el('span', 'tvNm', tm ? tm.name : '\u2014'));
    /* WON IT, or the round it went out in. "Champion" rather than "Final", because losing
       the final and winning it are the same round and opposite results. */
    var out = row.out;
    /* "Race" IS A PROVENANCE, NOT A ROUND. These teams never played a fixture, so naming
       one would be the first lie this pane has ever told. The race pane carries the whole
       finishing order; this cell says which competition put the number here. */
    /* ===== IN THE LEAGUE THE RIGHT-HAND CELL IS THE SLOT ITSELF, and that is a change of
       fact rather than of wording. A knockout's honest answer is the round you went out in,
       because that is all it established. A placement bracket establishes the SEAT: every
       row here was won in a match played for that exact pick, so printing "Quarter-final"
       would name the round a team stopped being in the championship half and say nothing
       about the number beside it. The rank and the slot are the two notations a drafter
       already uses for one fact, side by side, which is why this needs no legend. ===== */
    var where = T.yow ? slot(row.rank)
              : (row.rank === 1) ? 'Champion'
              : row.fromTail ? 'Race'
              : (T.br.rounds[out] ? T.br.rounds[out].label : '\u2014');
    li.appendChild(el('span', 'tvDraftOut', where));
    /* ---- THE MARKER MEANS "THIS NUMBER WAS NOT EARNED", and it now has two causes
       rather than one. A row separated from the one above it only by the draw was
       always one. A row that came out of a race that never reached the line is the
       other, and it is exactly the same claim about the number: it is a measurement
       of where a head had got to, not a result it played for.

       ONE MARKER AND ONE KEY, not two of each, and that is a MEASURED decision. See
       draftKey() for the arithmetic; the short version is that a second key
       paragraph costs 30px of a pane that is already 8px short at twelve rows, and
       it bought a distinction the row's own provenance cell already draws -- "Race"
       against a round's name. ---- */
    /* THE TWO CAUSES ARE COUNTED SEPARATELY, and that is not tidiness. The key
       below was gated on `racePart` -- whether the race stopped short -- rather
       than on whether any ROW came out of it, so an eight-head field, which has
       no tail at all and therefore no marked row, still printed "* not raced to
       the line" under a list where that dot appears nowhere. A legend for a
       symbol that is not on the screen is worse than no legend: it makes a
       reader look for something that is not there. Counted, not inferred. */
    var unearned = row.tiedFromDraw || (racePart && row.fromTail);
    if (row.tiedFromDraw) anyDrawn = true;
    if (racePart && row.fromTail) anyRace = true;
    /* ── THE ROW SAYS IT, INSTEAD OF A DOT AND A LEGEND.  2026-08-27 ───────
       This printed a bare "\u00b7" whose only explanation was a tooltip, and a
       key line under the table decoding it. That pairing is what he called
       clutter -- and it was the WORSE half of the trade, because the dot is
       meaningless on sight while the key cost the pane the room it needed for
       twelve rows (the note below this function records the over-run, and his
       screenshot shows DRAFT ORDER printing over row 1 because of it).
       A word in the row costs the same space as the dot and needs no legend
       at all: "Draw" for a position separated by the draw, "Race" for one
       ranked by distance because the race did not reach the line. The title
       stays for the full sentence. */
    if (unearned){
      var d = el('span', 'tvDraftTie', row.tiedFromDraw ? 'Draw' : 'Race');
      d.setAttribute('title', row.tiedFromDraw
        ? 'Level on goal difference and goals -- separated by the draw'
        : 'The qualifying race did not reach the line -- ranked by how far this head got');
      li.appendChild(d); }
    list.appendChild(li);
  });
  into.appendChild(list);
  /* ── NO KEY UNDER THE DRAFT ORDER.  2026-08-27 ──────────────────────────
     Jayden: "remove the 'Below the line' its clutter find clutter like that
     and remove just make it clean." And the comment below this function has
     been admitting the real cost for a while: "the shipping twelve-team
     play-in cup already over-runs its own box by 8px top and bottom", which
     is exactly the collision in his screenshot -- DRAFT ORDER printing over
     row 1 and the key printing over row 12.
     A previous pass answered that by compressing the key to one line. The
     honest answer is that the pane has twelve rows to show and no room for
     footnotes: the key explains a distinction the row's own provenance cell
     already makes ("Race", or the round's name), so it was restating
     something the table says better, in the space the table needed.
     draftKey() is left in the file -- the race pane still uses that
     vocabulary through raceKey() -- it is simply not printed here. */
}

/* ---- THE KEY IS ONE LINE, ALWAYS, AND THAT IS ARITHMETIC RATHER THAN TASTE.
   Measured at 390x844 with a twelve-row order: the pane has 290px, the list needs 255,
   and the eyebrow, the gaps and ONE key line leave it 239 -- so the shipping twelve-team
   play-in cup already over-runs its own box by 8px top and bottom. A second key paragraph
   costs 14px of text, a 6px margin and a 10px pane gap; measured, it took that over-run
   to 23px and the champion's row visibly collided with DRAFT ORDER above it. Nothing on
   this screen scrolls, so the reduction has to come out of the text.

   So the two facts share the line the pane already spends, because they are the same
   fact -- this number was not earned -- with two causes. Which cause applies to which row
   is not lost: the row's own provenance cell says "Race" or names a round.

   The long sentence still exists, on the race pane, which has one list and no second key
   and can afford it. Both are built from T.race, so they cannot describe different
   races. ---- */
/* ---- AND THE SEEDED CUP NEEDS DIFFERENT WORDS, because on that path the last-resort
   separator is no longer a coin toss. standings() breaks a dead heat with the draw
   index, and the draw is now the SEED ORDER the race produced -- so two teams level on
   everything the bracket measured are split by where they finished a race they both ran.
   That is earned, and calling it "separated by the draw, not earned" would be this
   pane's first false statement. The marker still appears, because the number still was
   not settled on the pitch; only the reason changes. ---- */
function draftKey(drawn, racePart){
  var seeded = !!(T.br && T.br.seeds && T.br.seeds.length);
  var byWhat = seeded ? 'separated by the race' : 'separated by the draw';
  if (drawn && racePart)
    return '\u00b7 not settled on the pitch \u2014 ' + byWhat
         + ', or not raced to the line';
  if (racePart) return '\u00b7 not raced to the line \u2014 ranked by distance, not earned';
  if (drawn)    return (window.__hmYowLeague ? '\u00b7 level on points \u2014 ' : '\u00b7 level on goals \u2014 ') + byWhat
         + (seeded ? '' : ', not earned');
  return '';
}
/* The race pane's own. It says the thing the draft pane's marker can only point at --
   what the ranking IS, given it is not a finishing order -- and it is held to ONE LINE at
   390 and above for the same measured reason the draft key is: this pane's list is the
   draft pane's list, twelve rows deep, and it already bleeds without help. The first
   draft of this ran to two lines and measured 18.3px of bleed against the draft pane's
   7.8; that is a new pane rendering worse than the one it is a copy of. */
function raceKey(){
  var r = T.race;
  if (!r || r.mode !== 'partial') return '';
  return 'Places ' + (r.advance + 1) + '\u2013' + r.field
       + ' are how far each head got, not where it crossed.';
}

/* ---- THE QUALIFYING RACE, AS A PANE. It is the answer to the question Jayden actually
   asked -- who made it and who did not -- so once the race has run it must stay
   readable, not vanish until the cup is over.

   IT IS NOT A NEW WIDGET. It is the draft pane's own list: the same grid, the same row,
   the same number cell, the same two-column reduction below 640. The only thing it adds
   is which side of the cut a row is on, said twice over -- the eight that got in are ink
   and the rest are muted, and where the layout is one column there is a hairline between
   them. A count of eight would have been a third way of saying it.

   AND IT COSTS THE TAB ROW NOTHING. On this path the bracket is a clean eight, so there
   is no Play-in tab; Race takes the slot Play-in used to have and in the same place in
   the order, because it happened at the same point in the competition. The finished cup
   therefore carries the same six tabs a twelve-team play-in cup already carried, which
   is the count the 360px block was measured against. ---- */
/* THE RACE ONLY DECIDES WHO IS OUT. Jayden: "race doesnt matter it should just be
   placement so 12-9 should be shown but the 8-1 is decided with the tournement."
   He is right, and the old pane made a claim the competition does not honour: the
   eight who qualify are SHUFFLED into the draw, so printing them 1..8 in race
   order implied a seeding that is thrown away one screen later. Only the places
   the race actually awards are listed now -- 9th to 12th, in the order they went
   out. The eight who got through are a COUNT, not a list, because their ranking
   has not happened yet; that is what the rest of the cup is for.

   IT ALSO FIXES THE CLIPPING, which is the same defect from the other side.
   Twelve rows plus an eyebrow, a stake line and a footnote did not fit the pane
   at the height this screen actually runs at: the eyebrow overlapped the first
   row, the footnote overlapped the last two, and the twelfth name sat behind the
   Kick off button. Four rows fit with room to spare. Reduction rather than a
   scrollport -- the answer this file uses everywhere else, and the one Jayden has
   asked for four separate times. */
function buildRace(into){
  /* THE LIST IS standings(), NOT A STORED ORDER, and that is the mechanism rather than a
     convenience. standings() already sorts the whole field by how far each team has got,
     then goal difference, then goals -- which during a live cup is exactly "where does
     everyone stand right now" -- and appends the race's non-qualifiers after it. Keeping
     a second ordering in this pane is how the board and the draft order would eventually
     disagree, which is the bug the draft pane's own header warns about. */
  var rows = BR.standings(T.br);
  var live = 0;
  rows.forEach(function(r){ if (!settledRow(r)) live++; });

  var head = el('div', 'tvHead');
  head.appendChild(el('p', 'tvEyebrow', 'Running order'));
  /* Before a ball is kicked the order IS the race's, so the line says what put it there;
     after that the interesting number is how many are left. One slot, two facts, and
     never both at once. */
  head.appendChild(el('span', 'tvOptL', BR.played(T.br) === 0
    ? 'seeded by the race' : live + ' still in'));
  into.appendChild(head);

  var list = el('ol', 'tvDraft tvOrder');
  list.style.setProperty('--tvDraftRows', String(Math.ceil(rows.length / 2)));
  rows.forEach(function(row){
    var tm = teamById(row.id);
    var fixed = settledRow(row);
    var li = el('li', 'tvDraftRow ' + (fixed ? 'tvFixed' : 'tvMoving'));
    li.appendChild(el('span', 'tvDraftN bcNum', String(row.rank)));
    var c = el('i', 'tvChipC'); if (tm) c.style.setProperty('--tcx', tm.col);
    li.appendChild(c);
    li.appendChild(el('span', 'tvNm', tm ? tm.name : '—'));
    /* The accessible name carries what the fill says, because a hollow chip is not
       readable by a screen reader and "settled" is the whole point of this pane. */
    li.setAttribute('aria-label', (tm ? tm.name : 'unknown') + ', ' + ord(row.rank)
      + (fixed ? ', settled' : ', still playing'));
    list.appendChild(li);
  });
  into.appendChild(list);
  var rk = raceKey();
  if (rk) into.appendChild(el('p', 'tvDraftKey tvRaceKey', rk));
}

/* ---- WHOSE POSITION CANNOT MOVE AGAIN, and it is a PROVABLE claim rather than a
   presentational one, which is why this is a function and not a class name chosen at
   the call site. Jayden: "once someone is eliminated they are easily solidified on the
   list while the others can move with wins and such."

   A row is fixed when the team is out -- knocked out of the cup, or never in it because
   the race eliminated it. It is fixed because of how standings() sorts: the first key is
   the deepest round a team reached, and every team still alive is in a round at least as
   deep as any team already out and will only ever go deeper. So nobody still playing can
   fall below somebody already eliminated, and two teams eliminated in the same round are
   separated by goal difference and goals scored, both of which stopped changing when
   they went out. The champion and runner-up head-swap at the end only reorders two teams
   that were both in the final, so it cannot move anyone either.

   That is the "layer of fantasy order goodness": the list resolves from the bottom up
   while the cup runs, and a row that has gone solid has genuinely stopped moving. ---- */
function settledRow(row){
  return !!row.fromTail || BR.outAt(T.br, row.id) !== undefined;
}

/* ---- THE ENDING. The champion, crowned, and under it how everybody else's cup
   finished -- "Out - Semi-final", which in a knockout is the whole truth about a
   team and is a fact the competition actually established. There is no table,
   because there was never a table.

   It reuses sideRow() for the also-rans, so the ending is the same object as the
   bracket and the match-up rather than a third drawing of a team. ---- */
function buildChampion(into, champ2){
  var wt = teamById(champ2);
  into.appendChild((function(){ var h = el('div','tvHead');
    h.appendChild(el('p','tvEyebrow','Champion')); return h; })());
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
  into.appendChild(wrap);
  into.appendChild(el('h2', 'tvChampNm', (wt ? wt.name : '—') + ' wins the ' + (T.cup || 'cup')));
  /* AND IN THE LEAGUE IT SAYS WHAT WAS WON.  There is no trophy here -- the prize
     is the first overall pick, and the screen that ends the cup was the only one
     that never named it. slot() is the same function the stake sentence, the tie
     tags and the draft board already print, so the four cannot disagree. */
  if (T.yow) into.appendChild(pickText(el('p', 'tvPrize'),
    'Takes the ' + slot(1) + ', first overall.'));
  /* The last consolation set lands at the same moment the final does, so the champion
     screen carries it too -- otherwise the bottom of the draft order is settled by matches
     whose result is never said out loud anywhere. */
  buildStory(into);
}

/* THE WAY OUT, and it is one function because it is one control. It was written inline in
   paint(); the qualifying screen is a second foot that needs the identical two-tap arm, and
   two copies of a destructive control is exactly how a confirm step goes missing from one of
   them.

   "Sure?" rather than "Tap again", and .tvQuit carries a min-width in the CSS, because the
   armed label swap is a WIDTH change on the one element sitting left of the primary -- so
   the primary slid sideways under the finger that had just armed it. Two short words inside
   a fixed box move nothing, and the accessible name carries the whole phrase in both
   states. */
/* ---- THE LEAGUE'S SECONDARIES ARE THE LIBRARY'S QUIET VARIANT, NOT ITS
   OUTLINED ONE.  The League's visual standard (play.css, §1) allows exactly one
   framed object per screen and that object is the panel. `.ctl--secondary`
   paints an inset hairline and a ground, so a foot of Leave + Simulate + the
   primary put THREE rimmed boxes inside a rimmed box -- measured at 1440, three
   different treatments in a 388px row. `.ctl--quiet` is the same control at the
   same 44px rung with the ground and the rim taken off, so this is a variant
   swap out of the shared library rather than a private de-paint: the geometry,
   the press feedback, the focus ring and the disabled dim all still come from
   controls.css. The soccer cup keeps the outlined pair -- the standard is the
   League's and this branch is where it applies. */
function ctlSecondary(){ return T.yow ? 'ctl ctl--quiet' : 'ctl ctl--secondary'; }

function quitBtn(){
  var quit = el('button', 'tvQuit ' + ctlSecondary(), 'Leave'); quit.type = 'button';
  quit.setAttribute('aria-label', 'Leave the cup');
  var armed = false, armT = 0;
  quit.addEventListener('click', function(e){
    e.stopPropagation();
    if (armed){ stop(); return; }
    armed = true; quit.textContent = 'Sure?'; quit.classList.add('tvArmed');
    clearTimeout(armT);
    armT = setTimeout(function(){ armed = false; quit.textContent = 'Leave';
      quit.classList.remove('tvArmed'); }, 3200);
  });
  return quit;
}

/* ---- THE SIMULATE CONTROL, AND WHY IT IS ONE BUTTON WITH A ROUND'S SCOPE.

   The three obvious scopes are this fixture, this round, and the whole cup, and
   shipping all three would be three buttons where the foot at 320px can carry one:
   Leave is already there and the primary has to stay obviously the primary.

   PER-FIXTURE WAS REJECTED because it makes the common case the laborious one.
   His sentence is "so you dont have to watch everyone", and a control that needs
   seven presses to get through a seven-fixture cup has not really answered it.

   THE WHOLE CUP WAS REJECTED because it takes the final away. The final is the one
   match anybody would actually want to watch -- it is the only one that gets the
   gold ball, the poster and the trophy -- and a button that makes it unreachable
   is a button fighting its own screen.

   THE ROUND IS THE UNIT THIS SCREEN IS ALREADY BUILT ON. It is what the eyebrow
   names, what each tab is, and what the fixture list is grouped by, so the scope
   needs no explaining. It is three presses from an empty bracket to a champion at
   either field size, it never costs more than four fixtures at once, and it stops
   on the final's match-up with Kick off sitting right there. "Watch some, skip the
   rest" and "skip the lot" are both reachable, and neither needed a second control.

   IT IS SECONDARY AND IT LOOKS IT. `.ctl--secondary` beside a `.ctl--primary` that
   still fills the rest of the row: Kick off remains the main thing, which is what
   was asked for. The label does not change with the round -- a button that grows
   from "Simulate" to "Simulate the quarter-final" would shove the primary sideways
   under the finger reaching for it, which is the exact bug .tvQuit's min-width
   exists to prevent. The round is named in the accessible name instead, where
   length costs nothing. ---- */
function simBtn(nm2){
  var b = el('button', 'tvSim ' + ctlSecondary(), simRunning() ? 'Stop' : 'Simulate');
  b.type = 'button';
  if (simRunning()){
    b.classList.add('tvArmed');
    b.setAttribute('aria-label', 'Stop simulating');
  } else {
    var rd = nm2 && T.br && T.br.rounds[nm2.round];
    b.setAttribute('aria-label', rd ? ('Simulate the rest of the ' + rd.label.toLowerCase())
                                    : 'Simulate the rest of the round');
  }
  b.addEventListener('click', function(e){
    e.stopPropagation();
    if (simRunning()) simStop(); else simulateRound();
  });
  return b;
}

/* ---- THE QUALIFYING SCREEN. The same panel, one pane short: no tab row, because there is
   no bracket yet and a row of one tab is a tab row pretending. What is left is the eyebrow,
   one sentence and the foot -- which is the smallest this screen has ever been, and that is
   the right shape for a step whose whole job is to say what is about to happen and give you
   the button that starts it.

   IT IS NOT AUTOMATIC, and that is deliberate. Every other thing that takes over this
   viewport is started by pressing the primary; dropping a visitor into a forty-second race
   they did not ask for would be the one place this screen surprises you.

   THE SENTENCE IS NOT `.tvTape`. The tape is this screen's "see more that costs nothing"
   and it is hidden below 700px of height -- correct for a form guide, wrong for the only
   text that explains why twelve heads are about to roll down a hill. `.tvQual` is the same
   type at the same colour and it survives, which it can afford to because this pane has
   nothing else in it. ---- */
function paintQualify(h){
  var state = Q ? Q.state : 'skipped';
  var teams = (Q && Q.teams) || T.teams || [];
  var n = teams.length;
  var panel = el('div', 'tvPanel surface');
  var pane  = el('div', 'tvPane');

  var head = el('div', 'tvHead');
  head.appendChild(el('p', 'tvEyebrow', 'Qualifying'));
  var advP = advFor(n), cut = n - advP;
  head.appendChild(el('span', 'tvOptL', cut ? (n + ' heads · top ' + advP) : (n + ' heads · for seeding')));
  pane.appendChild(head);

  pane.appendChild(el('p', 'tvQual', state === 'skipped'
    /* THE PLAY-IN CLAUSE IS CONDITIONAL NOW, and it has to be. openCup() below builds a
       bracket from whatever ids it is handed: twelve gives a play-in, eight does not. The
       sentence promised one unconditionally, which was true while a race only ever happened
       with a surplus and became a quiet lie the moment the League started racing a field of
       eight. Both halves of the fallback are the same otherwise -- the race did not run, the
       draw decides instead. */
    ? ('The race could not run, so nobody is ranked by it. All ' + n
      + ' heads are in the cup instead'
      + (n > ADVANCE ? ' and it opens with a play-in, so every place is decided on the pitch.'
                     : ', drawn at random, so every place is decided on the pitch.'))
    /* NOT "the draft order", AND THAT IS A SCOPE CORRECTION RATHER THAN A WORDING ONE.
       Jayden: "It shouldnt bring up draft order because this mode isnt only meant for
       fantasy football." The race is a game mode in its own right that a fantasy draft
       sometimes borrows; the screen that starts it has to speak the game's language --
       who qualifies for the cup and who does not. The Draft tab on a FINISHED cup is a
       different screen, it is the one place a draft order has actually been earned, and
       it is untouched. */
    /* NOBODY IS OUT WHEN THERE IS NOTHING TO CUT, and the sentence says so rather than
       printing "the other 0 are out" -- which is the kind of quietly wrong number this
       screen has been cleaned of twice. With a field the size of the bracket the race is
       still the whole reason to watch: it decides who meets whom, and in the League it is
       the first roll of the dice the draft order is built out of. */
    : cut ? ('One marble race, all ' + n + ' heads. The first ' + advP
      + ' qualify for the cup. The other ' + cut + ' are out.')
    : ('One marble race, all ' + n + ' heads. Where you finish is your seed, and the seed '
      + 'decides who you meet. Nobody goes out down the hill.')));
  panel.appendChild(pane);

  var foot = el('div', 'tvFoot');
  if (!simRunning()) foot.appendChild(quitBtn());
  /* Only on the rung that has a race to skip. The 'skipped' pane's action is "open the
     cup", which is instant and has nothing to sit through. */
  if (state !== 'skipped'){
    var sb = el('button', 'tvSim ' + ctlSecondary(), simRunning() ? 'Stop' : 'Simulate');
    sb.type = 'button';
    if (simRunning()) sb.classList.add('tvArmed');
    sb.setAttribute('aria-label', simRunning() ? 'Stop simulating'
                                              : 'Run the qualifying race without watching it');
    sb.addEventListener('click', function(e){
      e.stopPropagation();
      if (simRunning()) simStop(); else simulateRace();
    });
    foot.appendChild(sb);
  }
  /* ---- THE SHORT FORM AT 320, and it is the same reduction `roundShortLabel` already
     makes for the same reason one row up: three controls cannot share a 248px foot
     while one of them carries fourteen characters. Measured, "Start the race" overran
     the panel there even after both secondaries gave up their width. "Start" is not
     vague in place -- the eyebrow above it says QUALIFYING and the sentence between
     them says "One marble race, all 12 heads" -- and 360 is where the panel stops
     being able to hold the long form, not a phone-shaped guess. ---- */
  var narrow = false; try{ narrow = innerWidth <= 360; }catch(_){}
  var go = el('button', 'tvGo ctl ctl--primary',
              state === 'skipped' ? 'Open the cup'
              : simRunning() ? 'Simulating…'
              : narrow ? 'Start' : 'Start the race');
  go.type = 'button';
  go.disabled = (state === 'running') || simRunning();
  go.addEventListener('click', function(e){
    e.stopPropagation();
    if (!Q || simRunning()) return;
    if (Q.state === 'skipped'){
      var ids = Q.teams.map(function(t){ return t.id; });
      Q = null; T.raceOrder = null; T.seedOf = null;
      clearSpawned(); benchAll();
      openCup(shuffled(ids), null);   // the twelve-team play-in, exactly as it already ships
      return;
    }
    runQualifier();
  });
  foot.appendChild(go);
  panel.appendChild(foot);
  h.appendChild(panel);
}

function paint(){
  var h = ensureHost();
  if (!T.live){ h.innerHTML = ''; h.hidden = true; return; }
  h.hidden = false; h.innerHTML = '';
  /* NO BRACKET YET MEANS THE QUALIFIER OWNS THE SCREEN. It is an early return rather than a
     branch further down because every line below this reads T.br. */
  if (!T.br){ paintQualify(h); return; }

  /* ===== A CONSOLATION FIXTURE IS NEVER SHOWN, IT IS DRAINED. The next thing on the sheet
     is either a match to watch or one to resolve, and if it is the latter the screen does
     not stop for it -- simulateConsolation() takes the clock, plays it for real with
     drawing skipped, and paints the story when it lands. Guarded three ways so this can
     never become a loop: it does nothing while a simulation is already running, nothing
     while a match is live, and it gives up after two failed drains and lets the fixture be
     kicked off by hand rather than retrying forever. ===== */
  if ((T.conFail | 0) < 3){
    var nmc = BR.nextMatch(T.br);
    if (nmc && nmc.match.con){
      var free = !sim && T.phase !== 'match' && !(window.__hmSoccer && window.__hmSoccer.on);
      if (free && simulateConsolation()) return;
      /* NOT FREE YET IS NOT THE SAME AS CANNOT. The engine holds body.hmSoccer through its
         own 5,400ms whistle and this file holds T.phase through a 5,600ms celebration, so
         the first paint after a watched fixture always lands while both are still true.
         Giving up there is what left the 5-8 bracket unplayed and put four "nobody earned
         this" markers in a draft order. So it comes back and asks again rather than
         treating a busy moment as a failure -- and the counter only advances on a drain
         that genuinely resolved nothing (see simEnd), so a real stall still stops. */
      if (!free && !T.conRetry){
        T.conRetry = setTimeout(function(){ T.conRetry = null;
          try{ if (T.live) paint(); }catch(_){} }, 450);
      }
    }
  }
  var nm2    = BR.nextMatch(T.br);
  var champ2 = BR.champion(T.br);
  /* ===== "THE CHAMPION IS KNOWN" IS NOT "THE CUP IS OVER" IN A PLACEMENT BRACKET, and
     reading the first as the second was the last real bug in this mode. The Final sits at
     index 0 of the last round, so champion() is satisfied the moment it is played -- with
     the third, fifth and seventh place matches still unplayed beside it. This screen then
     went straight to the champion pane, the drain never got another paint to fire on, and
     the cup ended 9 fixtures out of 12 with four slots of the draft order undecided.
     BR.complete() is the honest test and it is identical to the old expression on a
     knockout, so the soccer cup does not notice. ===== */
  var done2  = BR.complete(T.br);
  /* The Order tab is gone at the whistle (see the tab row), so anyone standing on it
     is moved to the pane that answers the same question rather than being dropped
     through the catch-all onto a champion screen with no tab selected. */
  if (view === 'race' && done2) view = 'draft';
  var A2 = (nm2 && !done2) ? teamById(nm2.match.a) : null;
  var B2 = (nm2 && !done2) ? teamById(nm2.match.b) : null;

  try{ if (done2) window.__hmChampFx(teamById(champ2) && teamById(champ2).col);
       else       window.__hmChampFx(null); }catch(_){}

  /* ONE PANEL, and `.surface` is the shared library's -- same ground, same
     hairline, same --r-xl as every other big surface on this site. No shadow: the
     heads cast contact shadows because they stand on something, and chrome
     separates with a hairline and translucency. */
  var panel = el('div', 'tvPanel surface');

  /* ---------- THE TABS ----------
     `Next`, then one per round, LABELLED BY THE BRACKET. Nothing here counts
     rounds or names them -- rd.short is "Last 8", "Last 4", "Final", or "Play-in"
     when a field of twelve opens with one -- so a cup of eight and a cup of twelve
     both print correct tabs with no branch.

     `.ctl--tab` and never `.ctl--tab .ctl--sm`: both write ::after for different
     jobs -- --sm as a 44px hit pad (top:50%), --tab as the selected underline
     (bottom:0) -- and together `top:50%` wins, drawing the underline through the
     middle of its own label as a strikethrough. Measured on the league's first
     build of this row; it looked exactly like text-decoration.

     AND NOT `.ctl-group` EITHER, which was the first draft here and was wrong for
     the same reason the thing it replaced was wrong: the group draws a container
     rim, so the tab row came out as a bordered rounded box -- the exact pill this
     pass exists to delete, rebuilt out of the shared library instead of by hand.
     The Lab's tabs sit on the panel's own ground with nothing around them. The
     hairline under the row is the only edge, and it belongs to the row rather than
     boxing it. */
  var tabs = el('div', 'tvTabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'The cup');
  function tab(key, label, aria){
    var b = el('button', 'tvTab ctl ctl--tab', label); b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', view === key ? 'true' : 'false');
    if (aria) b.setAttribute('aria-label', aria);
    b.addEventListener('click', function(e){ e.stopPropagation(); view = key; paint(); });
    tabs.appendChild(b);
  }
  /* "Cup", not "Champion", and it is a width rather than a wording preference: five
     tabs share a 342px panel at 390, so a column is 62px and "Champion" is ~72 at the
     control rung -- measured, it overran into "Play-in" beside it. The pane's own
     eyebrow says CHAMPION in full, and the accessible name here does too. */
  tab('next', done2 ? 'Cup' : 'Next', done2 ? 'The champion' : 'The next match');
  /* THE RACE TAB EXISTS WHEN A RACE DECIDED THE FIELD, and never otherwise -- the same
     conditional the Draft tab uses. It sits second because that is when it happened, and
     it is standing in the slot Play-in occupies on the other twelve-head path, so the tab
     count is unchanged at every field this screen can produce. */
  /* ---- AND IT STANDS DOWN WHEN THE CUP IS OVER, which is a subtraction the live
     board earned. While the cup runs, this pane and the Draft pane answer different
     questions -- "where does everyone stand, and who has stopped moving" against "here
     is the final order and what put each row there". At the final whistle they are the
     same twelve rows in the same sequence, and two tabs showing one list is exactly the
     "too much random unnecessary elements" this screen has been cleaned of before. So
     Order hands over to Draft rather than sitting beside it. It also means the race path
     never carries more than five tabs, where the play-in path still reaches six -- so
     the 320px tab arithmetic is unchanged at its worst case and better at this one. */
  var hasRace = !!(T.br.tail && T.br.tail.length && T.raceOrder && T.raceOrder.length)
                && !done2;
  if (hasRace) tab('race', 'Order', 'The running order');
  T.br.rounds.forEach(function(rd, i){ tab(i, rd.short, rd.label); });
  /* THE DRAFT ORDER IS THE LAST TAB AND ONLY EXISTS AT THE END. Before the cup is finished
     there is no order to publish -- printing a provisional one would be the seed again --
     so the tab is not there rather than there and empty. It is last because it is the thing
     you go to once, after everything else has stopped moving. */
  if (done2) tab('draft', 'Draft', 'The draft order');
  panel.appendChild(tabs);

  /* ---------- THE PANE ---------- */
  var pane = el('div', 'tvPane');
  if (view === 'draft' && done2){
    buildDraft(pane);
  } else if (view === 'race' && hasRace){
    /* BEFORE the catch-all below, which claims any view that is not a round index -- and
       'race' is not one. */
    buildRace(pane);
  } else if (view === 'next' || T.br.rounds[view] === undefined){
    if (done2) buildChampion(pane, champ2);
    else       buildNext(pane, A2, B2, nm2);
  } else {
    buildRound(pane, view, nm2);
  }
  panel.appendChild(pane);

  /* ---------- THE FOOT ----------
     The Gradient Maker's own: a small secondary, then the primary filling the rest
     of the row. The primary is the full remaining width of a panel that is itself
     centred, which is why there is no centring number anywhere in this file.

     §1.8: opening the Play menu is a hard no-op for the duration of a cup. On
     index.html that was a guard -- the rest of the portfolio was one section down.
     Here the cup IS the page, so the guard had become a trap, and this is the
     scoped replacement. Two-tap arm, because it is destructive and it sits next to
     a button people will actually press. */
  var foot = el('div', 'tvFoot');
  /* One way out is enough on the ending: the primary IS the way out there, so the secondary
     beside it would be the same door twice. It is therefore not built rather than built and
     removed -- which is what this did, and a control that exists for one statement is a
     control a listener can still be attached to. */
  /* Leave stands down while a simulation is running. It is the one destructive
     control on the screen and its two-tap arm cannot survive a repaint every frame;
     Stop is in the row beside it and takes one tap, so the way out is never more
     than two presses away. */
  if (!done2 && !simRunning()) foot.appendChild(quitBtn());
  if (nm2 && !done2) foot.appendChild(simBtn(nm2));

  /* THE MATCH-UP SCREEN ALWAYS HAS ITS ONE ACTION, and it is never gated on
     T.phase. phase is a variable that can be left behind: any path that ends a
     fixture WITHOUT running through __hmTourWin -- the engine stopping, a match
     abandoned, a result recorded twice -- left it at 'match', and the screen then
     showed the next fixture with nothing to press and no way to continue the cup.
     Reproduced on a final while driving a full bracket. The whole screen is
     display:none under body.hmSoccer, so this code cannot run during a live match;
     if it is visible at all, the one thing it is for is starting the match. */
  if (nm2 && !done2){
    var go = el('button', 'tvGo ctl ctl--primary',
                simRunning() ? 'Simulating…' : 'Kick off'); go.type = 'button';
    /* Disabled rather than absent while the crank turns: the row must not change
       shape under a finger, and the primary going missing mid-simulation is exactly
       the kind of jump this screen was remade to stop doing. */
    go.disabled = simRunning();
    go.addEventListener('click', function(e){
      e.stopPropagation(); if (simRunning()) return;
      T.phase = 'match'; view = 'next'; startFixture(nm2); });
    foot.appendChild(go);
  } else if (done2){
    var dn = el('button', 'tvGo ctl ctl--primary', 'Leave the cup'); dn.type = 'button';
    dn.addEventListener('click', function(e){ e.stopPropagation(); stop(); });
    foot.appendChild(dn);
  }
  panel.appendChild(foot);

  h.appendChild(panel);
}

// ---------- entry ----------
/* ---- THE YOWMINGS LEAGUE IS THIS TOURNAMENT, WITH TWO THINGS DIFFERENT.
   Jayden: "literally the tournement mode but better catered to the fantasy football draft
   ... using the football and calling it the Yowmings league ... pretty much the exact same".

   So it is one argument, not a second file. The bracket, the seeding, the match lengths,
   Simulate, the standings, the Draft tab and every screen in this file are shared code on a
   shared path; `yow` sets the competition's name and identity, and it sets the flag
   play-engine.js reads at kickoff to play the match with uprights and a football.

   THE RACE ALWAYS RUNS. It is the second difference and it is the answer to "make draft
   order feel super random and fun": the marble race is the most genuinely random thing on
   this site, every head is in it, and its finishing order is the SEED order the whole cup
   is built on. Soccer's cup only races when there are more heads than places; the League
   races at eight as well, where it eliminates nobody and purely decides who meets whom.
   Nothing about it is theatre -- it is the real race, run on the real heads, and the number
   it produces is load-bearing all the way to the last row of the draft order.

   THE POSTERS ARE NOT HERE, AND THAT IS DELIBERATE. They were asked for on 2026-08-26
   ("bring back the posters") and withdrawn the same day, in the same conversation: "you are
   right just remove the posters make it clean." The 2026-08-04 cancellation therefore
   stands unamended -- see the note above bcJitter. This headstone exists so the next reader
   does not find the request in the log and restore a feature as a missing one. The soccer
   FINAL's still poster (buildNext, `fin`) is a different thing and is untouched. ---- */
function start(yow){
  if (T.live) return;
  buildTeams(function(teams){
    T.live = true; T.phase = 'board'; view = 'next';
    T.br = null; T.race = null; T.raceOrder = null; T.seedOf = null; Q = null;   // nothing survives the last cup
    T.story = null; T.conFail = 0;
    try{ if (T.conRetry){ clearTimeout(T.conRetry); T.conRetry = null; } }catch(_){}
    try{ var _pb=document.getElementById('gameBtn');
      if(_pb){_pb.setAttribute('aria-disabled','true');
              _pb.setAttribute('title','Finish the cup first');} }catch(_){}
    T.yow = !!yow;
    /* The engine reads this at kickoff and at no other time, so it is set before the first
       fixture can cast and cleared in stop() -- see play-engine.js's start(). */
    try{ window.__hmYowLeague = T.yow; }catch(_){}
    /* ── A CLASS FOR THE WHOLE CUP, NOT JUST ITS MATCHES.  2026-08-27 ─────────
       body.hmYow is toggled by play-engine.js at KICKOFF, so it is absent on
       every League screen that is not a live match -- qualifying, the race, the
       bracket, the drains. That is why the race's position board survived four
       rounds of "remove the scoreboard": every rule I wrote was scoped to a
       class that is not on the body when that board is up.
       hmYowCup is on from the moment the cup starts until stop() clears it, so
       League chrome can be styled on any of its screens. */
    try{ document.body.classList.toggle('hmYowCup', !!T.yow); }catch(_){}
    /* ── THE STAKE, EXPOSED FOR THE PITCH.  2026-08-27 ────────────────────────
       "all the games should make it clear in game what draft pick its for."
       stakeOf() is already the one place that turns a fixture's wp/lp into the
       draft's own words, and the fixture screen has been using it before
       kick-off. The MATCH had no way to reach it -- play-engine.js is a
       different file and does not know what a bracket is -- so the sentence
       stopped at the moment the whistle went, which is exactly when it starts
       mattering. Publishing the string rather than the numbers keeps the
       vocabulary in one place: the pitch cannot invent its own phrasing. */
    try{ window.__hmStakeNow = ''; }catch(_){}
    T.cup = T.yow ? 'Yowmings League' : (CUPS[Math.floor(Math.random() * CUPS.length)] + ' Cup');
    var idKey=T.yow ? 'Yowmings' : T.cup.replace(/ Cup$/,'');
    T.id=CUP_ID[idKey]||CUP_ID['Apollo'];
    document.body.style.setProperty('--cupPaint',T.id.paint);
    document.body.style.setProperty('--cupStock',T.id.stock);
    document.body.style.setProperty('--cupSheen',T.id.sheen);
    if(window.PlayViewportOwner) window.PlayViewportOwner.enter("tournament");
    document.body.classList.add('hmTour');
    /* MORE THAN EIGHT AND THE FIELD IS QUALIFIED FOR, not drawn. The captains stand up
       first -- the qualifying screen is a scene for the same reason the match-up is one --
       and the race is started by a press, never from here. See the ladder above for what
       happens when it does not finish, which is often. */
    if (teams.length > ADVANCE || (T.yow && teams.length >= 2)){
      Q = { state: 'ready', teams: teams };
      T.phase = 'qualify';
      castQualifiers(teams);
      paint();
      return;
    }
    benchAll();
    /* THE DRAW IS THE ONLY ORDERING, and it is random. There is no seed and there
       must never be one again: it was `i + 1`, the index of a shuffled array,
       printed as "Seeds 3 and 7" -- a loop counter wearing a ranking. A knockout
       does not need one, because who meets whom IS the draw.
       Fixture one is cast inside openCup() the same way every other fixture is -- the
       first match-up screen must not be the one screen with nobody standing on it. */
    openCup(shuffled(teams.map(function(t){ return t.id; })), null);
  });
}
/* `restart()` IS DELETED WITH THE CONTROL IT SERVED. It existed so the 8/12 buttons could
   rebuild the cup, and the field is derived from the roster now -- there is nothing on this
   screen that can change it, so there is nothing to rebuild. A visitor who wants a different
   field builds another head, which is the whole point of the change. */
function stop(){
  T.live = false; T.cur = null; T.phase = 'idle';
  /* T.live goes first and Q goes with it, so a qualifier settling after this call finds
     the cup gone and does nothing. __hmRaceEnd settles it as `aborted` and cannot settle
     twice, so ending the race here is safe whether or not one is running. */
  Q = null; T.race = null; T.raceOrder = null; T.seedOf = null; T.yow = false;
  T.story = null; T.conFail = 0;
  /* The retry is the one thing in this file that can outlive the cup: a timer scheduled by
     the drain, fired 450ms later into a screen that has gone. */
  try{ if (T.conRetry){ clearTimeout(T.conRetry); T.conRetry = null; } }catch(_){}
  try{ window.__hmYowLeague = false; }catch(_){}
  try{ document.body.classList.remove('hmYowCup'); }catch(_){}
  try{ if (window.__hmRaceOn && window.__hmRaceEnd) window.__hmRaceEnd(); }catch(_){}
  try{ document.body.classList.remove('hmFinal'); }catch(_){}
  try{ var _pb2=document.getElementById('gameBtn');
    if(_pb2){_pb2.removeAttribute('aria-disabled');_pb2.removeAttribute('title');} }catch(_){}
  try{ window.__hmChampFx(null); }catch(_){}   // the fall must not outlive the cup
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
window.__hmTourStart = function(){ return start(false); };
/* The League gets its own name on the launcher rather than a truthy argument at the call
   site: one door, one global, and a driver (or a contract) can start either competition
   without knowing that they share a function. */
window.__hmYowStart   = function(){ return start(true); };
window.__hmTourStop = stop;
/* THE CUP AS DATA, for anyone who wants it without scraping the DOM -- and for the
   contracts, which have to assert the shape rather than read it off a screen.

   It is `standings`, not a table: in a knockout the only honest ordering is how far
   each team got, so every row carries the round it went out in and nothing it did
   not earn. `seed` is gone for the same reason it is gone from the team object, and
   `points`, `gd` and `played` are gone with the league that invented them. */
window.__hmTourStandings = function(){
  if (!T.live || !T.br) return [];
  return BR.standings(T.br).map(function(row){
    var tm = teamById(row.id), out = BR.outAt(T.br, row.id);
    return { rank: row.rank, id: row.id, name: tm ? tm.name : null,
             outAt: out === undefined ? null : out,
             /* A race-derived row names the race, never a round: it played no fixture, so
                there is no round it could honestly be said to have gone out in. */
             outIn: row.fromTail ? 'Race'
                  : (out === undefined ? null : T.br.rounds[out].label),
             fromRace: !!row.fromTail,
             played: row.record.played, won: row.record.won,
             gf: row.record.gf, ga: row.record.ga, gd: row.record.gd,
             tiedFromDraw: row.tiedFromDraw,
             colour: tm ? tm.colName : null };
  });
};
/* WHAT THE QUALIFIER DID, for a driver that would otherwise have to infer it from the
   screen. `mode` is which rung of the degradation ladder was taken -- 'full', 'partial' or
   'skipped' -- and `reason` is __hmRaceQualify's own word for how the race ended. Null when
   the field never needed one. Conditional global: consumers must guard. */
window.__hmTourRace = function(){
  if (!T.live || !T.race) return null;
  var r = T.race;
  return { mode: r.mode, reason: r.reason, field: r.field, advance: r.advance,
           resolved: r.resolved,
           order: (T.raceOrder || []).map(function(id){
             var tm = teamById(id); return tm ? tm.name : null; }) };
};
/* The cup's shape and how far through it is -- one call, so a driver never has to
   count fixtures by hand or work out whether there is a play-in. */
window.__hmTourCup = function(){
  if (!T.live || !T.br) return null;
  return { teams: T.br.N, bracket: T.br.M, playIn: !!T.br.playIn,
           /* Places carried alongside the bracket rather than decided by it -- the
              qualifying race's non-qualifiers. 0 on every other path. */
           tail: (T.br.tail || []).length,
           rounds: T.br.rounds.map(function(rd){
             return { label: rd.label, short: rd.short, teams: rd.teams,
                      playIn: !!rd.playIn, matches: rd.matches.length }; }),
           fixtures: BR.total(T.br), played: BR.played(T.br),
           remaining: BR.remaining(T.br), complete: BR.complete(T.br) };
};
/* The league's name for the same call, kept so a driver written against it does not
   silently get `undefined` and assert nothing. It is a conditional global with a
   knockout's answer. */
window.__hmTourSeason = window.__hmTourCup;
})();
