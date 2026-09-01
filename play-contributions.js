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

  /* "2026-08-31" -> weekday index, 0 = Sunday. Computed rather than parsed, for the
     same reason human() splits: new Date("2026-08-31") is UTC midnight and its local
     getDay() is the PREVIOUS day west of Greenwich, which would rotate the whole
     calendar by one row for Jayden and for nobody testing in London. Zeller's, on the
     numbers straight out of the string. */
  function weekday(iso) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!p) return -1;
    var y = parseInt(p[1], 10), m = parseInt(p[2], 10), d = parseInt(p[3], 10);
    if (m < 3) { m += 12; y -= 1; }
    var k = y % 100, j = Math.floor(y / 100);
    var h = (d + Math.floor(13 * (m + 1) / 5) + k + Math.floor(k / 4) +
             Math.floor(j / 4) + 5 * j) % 7;      // 0 = Saturday
    return (h + 6) % 7;                            // 0 = Sunday
  }

  var INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

  function render(data) {
    var days = data && data.days;
    if (!days || !days.length) return false;
    var generated = human(data.generated);
    if (!generated) return false;          // no date, no section. See the header.

    /* THE TOTAL COMES FROM THE DATA, NOT FROM SUMMING THE SQUARES. GitHub publishes a
       0-4 LEVEL per day and no per-day count -- it has not carried data-count for years
       -- so there is nothing to add up here and the headline figure is the one its own
       profile prints. Everything the page says is either that number or a count of days,
       and a count of days is something a level can carry. */
    var total = days.length;
    var commits = data.commits | 0;
    var active = 0, streak = 0, longest = 0, i;
    for (i = 0; i < days.length; i++) {
      if ((days[i].l | 0) > 0) { active++; streak++; if (streak > longest) longest = streak; }
      else streak = 0;
    }

    /* ONE COLUMN A WEEK, SEVEN WEEKDAY ROWS. He asked on 2026-09-01 for the band to be
       structured like a contribution calendar, so the window widened from the project's
       own 44 days to a trailing year of whole weeks (see the builder). The first day is
       a Sunday by construction, which is what lets the cells be appended in date order
       and land on the right rows under grid-auto-flow:column -- but it is ASSERTED here
       rather than assumed, because a hand-edited JSON that starts mid-week would draw a
       year rotated by a few days and look entirely plausible. */
    var lead = weekday(days[0].d);
    if (lead !== 0) {
      for (i = 0; i < lead; i++) days.unshift({ d: "", n: 0, l: 0, pad: true });
    }
    var weeks = Math.ceil((days.length) / 7);
    graph.style.setProperty("--pgit-weeks", String(weeks));
    var months = document.getElementById("pGitMonths");
    if (months) months.style.setProperty("--pgit-weeks", String(weeks));
    /* The phone scrollport's floor: a week column never goes under 11px, so 53 weeks
       want 53*11 of scrollable width. One number, derived from the count the grid is
       actually using rather than typed beside it. */
    var cal = graph.parentNode;
    if (cal && cal.style) cal.style.setProperty("--pgit-floor", (weeks * 12) + "px");

    var frag = document.createDocumentFragment(), cell;
    for (i = 0; i < days.length; i++) {
      cell = document.createElement("i");
      cell.className = "pGitCell";
      if (days[i].pad) {
        cell.setAttribute("data-l", "0");
        cell.style.visibility = "hidden";
      } else {
        var level = days[i].l | 0;
        if (level < 0) level = 0;
        if (level > 4) level = 4;
        cell.setAttribute("data-l", String(level));
        cell.setAttribute("title", human(days[i].d) + ": " +
          (level ? "contributions" : "no contributions"));
      }
      frag.appendChild(cell);
    }
    graph.textContent = "";
    graph.appendChild(frag);

    /* THE MONTH LETTERS SIT OVER THE WEEK THE MONTH OPENS IN, and only where the month
       actually changes -- so the row reads J J A S O N D J F M A M like the reference
       rather than repeating a letter over every column. The first column is skipped when
       its month is only a few days old: a letter there would sit over a week that is
       mostly the previous month. */
    if (months) {
      var mfrag = document.createDocumentFragment(), seen = -1, w, day, mi, tick;
      for (w = 0; w < weeks; w++) {
        day = days[w * 7];
        if (!day || !day.d) continue;
        mi = parseInt(day.d.slice(5, 7), 10) - 1;
        if (mi === seen) continue;
        seen = mi;
        if (w === 0 && parseInt(day.d.slice(8, 10), 10) > 7) continue;
        tick = document.createElement("i");
        tick.style.gridColumn = String(w + 1) + " / span 4";
        tick.textContent = INITIALS[mi];
        mfrag.appendChild(tick);
      }
      months.textContent = "";
      months.appendChild(mfrag);
    }

    /* THE TEXT ALTERNATIVE IS THE WHOLE GRAPH'S JOB, because 371 individually labelled
       squares is not an alternative, it is a maze. role="img" collapses the subtree and
       this sentence is what a screen reader gets instead. */
    graph.setAttribute("aria-label",
      "Contribution calendar. " + commas(commits) + " contributions on " + active +
      " days in the year to " + human(data.last) + "; the longest unbroken run is " +
      plural(longest, "day") + ". Each square is a day, shaded by how busy it was.");

    /* THE FIGURE IS THE HEADLINE NOW, which is the reference's structure: a label, then
       the number, then the picture. The heading element and its id are unchanged, so the
       section is still labelled by the thing that names it. */
    var count = document.getElementById("pGitCount");
    if (count) count.textContent = commas(commits) + " contributions";

    stamp.textContent = "Snapshot taken " + generated;
    /* THE SENTENCE MAKES NO CLAIM THE DATA CANNOT CARRY, and it now has to be careful
       about a new one: most of this window predates the repository, so it says how many
       days carried work rather than anything about the empty ones, and it names the span
       as a year to the last commit rather than calling it "the site's life".
       AND IT DOES NOT SAY "DARKER". It did, and dark mode caught it: the ramp runs on
       whatever the page's ink is, so on a night page the busiest days are the LIGHTEST
       squares and the sentence beside them was false. Naming the busiest day instead
       explains the shading in both themes and is a better fact than the adjective was. */
    /* AND IT DOES NOT SAY "DARKER". It did, and dark mode caught it: the ramp runs on
       whatever the page's ink is, so on a night page the busiest days are the LIGHTEST
       squares and the sentence beside them was false. The key under the graph carries
       the direction instead, in the ramp's own colours, and is right in both themes. */
    note.textContent = commas(commits) + " contributions on " + active +
      " days in the last year. Each square is a day. The longest unbroken run is " +
      plural(longest, "day") + ".";

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
