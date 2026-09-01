/* ══ THE CONTRIBUTION BAND ═══════════════════════════════════════════════════════════
   Renders data/contributions.json into #pGitGraph, under the Play hero and above the
   games band.

   THE DATA IS BUILT, NOT FETCHED FROM GITHUB, and tools/fetch-contributions.py explains
   why in full: the calendar is CORS-blocked HTML and the GraphQL endpoint that returns it
   as data needs a token, which a static site cannot ship. So the graph is fetched at build
   time, committed as JSON, and drawn from that.

   WHICH MEANS IT CAN GO STALE, and that is the one objection that parked this idea in
   August: a panel that LOOKS live while being a snapshot is worse than no panel. So the
   `generated` date is not optional decoration -- it is the condition the section exists on.
   Nothing here renders unless the JSON carries it, and it is printed at the top of the
   section rather than buried under the graph. If you are refactoring this and the date
   feels like clutter, delete the section instead.

   `l` IS GITHUB'S 0-4 BUCKET, NOT A COMMIT COUNT. The build tool refuses to invent a total
   and so does this: every number on the page is a count of DAYS, and the note says out
   loud what the shading is. Do not print `l` as commits.

   NO NETWORK, NO STATE, NO STORAGE. This file reads one same-origin JSON and writes into
   three elements. In particular it never touches hmCompanions.
   ═══════════════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var root = document.getElementById("pGit");
  if (!root) return;
  var graph = document.getElementById("pGitGraph");
  var stamp = document.getElementById("pGitStamp");
  var note = document.getElementById("pGitNote");
  if (!graph || !stamp || !note) return;

  var MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];

  /* "2026-09-01" -> "1 September 2026". Split rather than `new Date(str)`: a bare
     ISO date parses as UTC midnight and then prints in local time, which is the
     previous day for everyone west of Greenwich -- i.e. for Jayden. A snapshot
     date that is off by one is exactly the kind of quiet wrongness this section
     exists to avoid. */
  function human(iso) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!p) return "";
    var m = parseInt(p[2], 10) - 1;
    if (m < 0 || m > 11) return "";
    return parseInt(p[3], 10) + " " + MONTHS[m] + " " + p[1];
  }

  /* Day of the week, 0 = Sunday, from the string. Date.UTC keeps it off the local
     clock for the same reason as above. */
  function weekday(iso) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!p) return 0;
    return new Date(Date.UTC(+p[1], +p[2] - 1, +p[3])).getUTCDay();
  }

  function render(data) {
    var days = data && data.days;
    if (!days || !days.length) return false;
    var generated = human(data.generated);
    if (!generated) return false;          // no date, no section. See the header.

    var total = days.length;
    var active = 0, streak = 0, longest = 0, i;
    for (i = 0; i < days.length; i++) {
      if (days[i].l > 0) { active++; streak++; if (streak > longest) longest = streak; }
      else streak = 0;
    }

    /* THE GRID IS COLUMN-MAJOR, SEVEN DEEP, like the calendar it comes from: CSS
       does the flow (`grid-auto-flow:column` over seven rows), so the markup is a
       flat list and there is no per-week wrapper to keep in sync. The series starts
       on a Sunday today, but pad anyway -- a re-run that starts mid-week would
       otherwise silently rotate every weekday row by a day or two. */
    var frag = document.createDocumentFragment();
    var pad = weekday(days[0].d), cell;
    for (i = 0; i < pad; i++) {
      cell = document.createElement("i");
      cell.className = "pGitPad";
      cell.setAttribute("aria-hidden", "true");
      frag.appendChild(cell);
    }
    for (i = 0; i < days.length; i++) {
      var level = days[i].l | 0;
      if (level < 0) level = 0;
      if (level > 4) level = 4;
      cell = document.createElement("i");
      cell.className = "pGitCell";
      cell.setAttribute("data-l", String(level));
      /* The hover string, and it names the bucket rather than pretending to a count. */
      cell.setAttribute("title", human(days[i].d) + " — " +
        (level ? "level " + level + " of 4" : "no contributions"));
      frag.appendChild(cell);
    }
    graph.textContent = "";
    graph.appendChild(frag);

    /* THE TEXT ALTERNATIVE IS THE WHOLE GRAPH'S JOB, because 367 individually
       labelled squares is not an alternative, it is a maze. role="img" collapses
       the subtree and this sentence is what a screen reader gets instead. */
    graph.setAttribute("aria-label",
      "GitHub contribution graph. " + active + " of " + total + " days from " +
      human(days[0].d) + " to " + human(days[days.length - 1].d) +
      " carried a commit; the longest run is " + longest +
      " day" + (longest === 1 ? "" : "s") + ".");

    stamp.textContent = "Snapshot taken " + generated;
    note.textContent = active + " of the last " + total +
      " days carried a commit, in stretches rather than a trickle — the longest run is " +
      longest + " day" + (longest === 1 ? "" : "s") +
      " straight. Shading is GitHub’s own 0–4 bucket, not a commit count.";

    root.hidden = false;
    /* One frame, so the class lands as a transition rather than as the initial
       value. The fade itself is --dur-reveal and reduced motion switches it off in
       the stylesheet. */
    if (window.requestAnimationFrame) {
      requestAnimationFrame(function () { root.className += " isReady"; });
    } else {
      root.className += " isReady";
    }
    return true;
  }

  /* XHR rather than fetch: this page is ES5 throughout and the request is one
     same-origin GET with no headers, no credentials and no streaming. If it fails
     for any reason the section simply never appears -- a heading over an empty box
     is the stale-dashboard failure in another costume. */
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "data/contributions.json", true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    if (xhr.status !== 200 && xhr.status !== 0) return;
    var data;
    try { data = JSON.parse(xhr.responseText); } catch (e) { return; }
    try { render(data); } catch (e2) { root.hidden = true; }
  };
  try { xhr.send(); } catch (e) { /* file:// and offline both land here; stay hidden */ }
}());
