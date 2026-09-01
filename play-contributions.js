/* ══ THE COMMIT BAND ═════════════════════════════════════════════════════════════════
   Renders data/commit-history.json into #pGitGraph, under the Play hero and above the
   games band. One square a day, in a line, for every day this site has existed.

   IT IS THIS REPOSITORY'S OWN HISTORY, NOT GITHUB'S CALENDAR, and the swap was the whole
   point of the second pass. The 12-month contribution graph measured 52 active days of
   367 with two empty stretches of 130 and 118 days -- eight idle months and then every
   commit bunched against the right edge. The same window read 73% active over the last
   45 days. A caption cannot rescue a picture like that, and this page's own history is
   better on every axis: it is the record of the page the visitor is standing on, it has
   no gaps because the project did not exist before 20 July, and it comes from `git log`,
   so there is no third party and nothing to be wrong about.
   tools/build-commit-calendar.py writes it. Its docstring carries the rest.

   THE DATE IS STILL THE CONDITION. A browser cannot run git, so this is still committed
   data and it can still go stale -- which is the objection that parked the whole idea in
   August, and the one mitigation that answered it. `generated` prints at the top of the
   section and NOTHING renders without it. If you are refactoring this and the date feels
   like clutter, delete the section instead.

   `n` IS A REAL COMMIT COUNT, and that is new. GitHub's cells carried an opaque 0-4
   bucket with no number behind it, so the old caption could only say what the shading was
   NOT. Here `l` is a fixed bucket OF `n` (levelFloors in the JSON), so the page can say
   plainly that a darker square is a busier day. Fixed, not quartiles: a ramp derived from
   the data would re-shade the past every time you commit.

   NO NETWORK, NO STATE, NO STORAGE. One same-origin JSON, three elements written. In
   particular it never touches hmCompanions.
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

  /* Same, minus the year, for a date the sentence has already put in context. */
  function humanShort(iso) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!p) return "";
    return parseInt(p[3], 10) + " " + MONTHS[parseInt(p[2], 10) - 1];
  }

  /* 1002 -> "1,002". Written out rather than toLocaleString: the separator is part
     of the copy and should not change with the visitor's locale. */
  function commas(n) {
    var s = String(n), out = "", i;
    for (i = 0; i < s.length; i++) {
      if (i && (s.length - i) % 3 === 0) out += ",";
      out += s.charAt(i);
    }
    return out;
  }

  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  function render(data) {
    var days = data && data.days;
    if (!days || !days.length) return false;
    var generated = human(data.generated);
    if (!generated) return false;          // no date, no section. See the header.

    var total = days.length;
    var active = 0, commits = 0, streak = 0, longest = 0, busiest = 0, i;
    for (i = 0; i < days.length; i++) {
      var n = days[i].n | 0;
      commits += n;
      if (n > busiest) busiest = n;
      if (n > 0) { active++; streak++; if (streak > longest) longest = streak; }
      else streak = 0;
    }

    /* ONE ROW, ONE SQUARE A DAY, IN ORDER. 44 days is a line, not a calendar: a
       seven-row weekday grid needs a year to read as one, and at six weeks it is
       just a lumpy block whose rows mean nothing. The column COUNT is written from
       the data rather than typed into the stylesheet -- one more commit-day and a
       hard-coded 44 would wrap a single square onto a second row and nobody would
       notice for a month. The stylesheet's literals are fallbacks, not the truth. */
    graph.style.setProperty("--pgit-cols", String(total));
    graph.style.setProperty("--pgit-fold", String(Math.ceil(total / 2)));

    var frag = document.createDocumentFragment(), cell;
    for (i = 0; i < days.length; i++) {
      var count = days[i].n | 0;
      var level = days[i].l | 0;
      if (level < 0) level = 0;
      if (level > 4) level = 4;
      cell = document.createElement("i");
      cell.className = "pGitCell";
      cell.setAttribute("data-l", String(level));
      cell.setAttribute("title", human(days[i].d) + ": " +
        (count ? plural(count, "commit") : "no commits"));
      frag.appendChild(cell);
    }
    graph.textContent = "";
    graph.appendChild(frag);

    /* THE TEXT ALTERNATIVE IS THE WHOLE GRAPH'S JOB, because 44 individually
       labelled squares is not an alternative, it is a maze. role="img" collapses
       the subtree and this sentence is what a screen reader gets instead. */
    graph.setAttribute("aria-label",
      "Commit history for this site. " + commas(commits) + " commits on " + active +
      " of the " + total + " days from " + human(days[0].d) + " to " +
      human(days[days.length - 1].d) + "; the longest unbroken run is " +
      plural(longest, "day") + ". Each square is a day, shaded by the commits it " +
      "carried; the busiest carried " + busiest + ".");

    stamp.textContent = "Snapshot taken " + generated;
    /* THE SENTENCE MAKES NO CLAIM THE DATA CANNOT CARRY. It says how long the WINDOW
       is and how many of its days carried work -- not that the site "started" on the
       first commit, which this repository cannot know and which is the kind of small
       invented fact a portfolio cannot afford.
       AND IT DOES NOT SAY "DARKER". It did, and dark mode caught it: the ramp runs on
       whatever the page's ink is, so on a night page the busiest days are the LIGHTEST
       squares and the sentence beside them was false. Naming the busiest day instead
       explains the shading in both themes and is a better fact than the adjective was. */
    note.textContent = commas(commits) + " commits to this site in the " + total +
      " days since " + humanShort(days[0].d) + ", on " + active +
      " of them. Each square is a day, shaded by the commits it carried. The busiest carried " +
      busiest + ".";

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
  xhr.open("GET", "data/commit-history.json", true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    if (xhr.status !== 200 && xhr.status !== 0) return;
    var data;
    try { data = JSON.parse(xhr.responseText); } catch (e) { return; }
    try { render(data); } catch (e2) { root.hidden = true; }
  };
  try { xhr.send(); } catch (e) { /* file:// and offline both land here; stay hidden */ }
}());
