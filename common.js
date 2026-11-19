/* Shared helpers for the calendar and the supplier toolkit.
   Security notes (see SECURITY.md):
   - h() only ever sets text via textContent / text nodes - never innerHTML (OWASP A05:2025).
   - safeUrl() lets through https: links only, so a malicious content change cannot inject
     javascript:, data: or http: links.
   - Everything here runs under a CSP with script-src/style-src 'self'; dynamic styling uses CSSOM. */
"use strict";
(function () {
  const SVGNS = "http://www.w3.org/2000/svg";
  const STAR = "M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z";
  /* Garland icons: cyber = shield, AI = sparkle, privacy = padlock (drawn with even-odd holes). */
  const GARLAND = [
    ["cyber", "M12 2.5l8 3v6.2c0 4.9-3.4 8.4-8 9.8-4.6-1.4-8-4.9-8-9.8V5.5z"],
    ["ai", STAR],
    ["privacy", "M7 10V7.5a5 5 0 0 1 10 0V10h1.5c.8 0 1.5.7 1.5 1.5v8c0 .8-.7 1.5-1.5 1.5h-13C4.7 21 4 20.3 4 19.5v-8c0-.8.7-1.5 1.5-1.5zM9.5 10h5V7.5a2.5 2.5 0 0 0-5 0zM12 13.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"]
  ];

  function svg(d, cls, label) {
    const s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    if (label) { s.setAttribute("role", "img"); s.setAttribute("aria-label", label); } else s.setAttribute("aria-hidden", "true");
    if (cls) s.setAttribute("class", cls);
    const p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", d);
    s.append(p);
    return s;
  }

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === false || v == null) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      /* Handlers are only ever attached as functions; an "on…" string is dropped, never set as an attribute. */
      else if (k.startsWith("on")) { if (typeof v === "function") el.addEventListener(k.slice(2), v); }
      else el.setAttribute(k, v === true ? "" : String(v));
    }
    for (const c of kids.flat()) {
      if (c == null || c === false) continue;
      el.append(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return el;
  }

  function safeUrl(u) {
    try {
      const url = new URL(String(u));
      return url.protocol === "https:" ? url.href : null;
    } catch (e) { return null; }
  }

  function extLink(u, cls, ...kids) {
    const href = safeUrl(u);
    if (!href) return h("span", { class: cls }, ...kids);
    return h("a", { class: cls, href, target: "_blank", rel: "noopener noreferrer" }, ...kids);
  }

  async function getJSON(path) {
    const res = await fetch(path, { cache: "no-cache", credentials: "same-origin" });
    if (!res.ok) throw new Error(path + " → HTTP " + res.status);
    return res.json();
  }

  /* Re-rendering replaces buttons, so remember which control had focus (its data-k) and move focus to
     its replacement - otherwise keyboard and screen-reader users are thrown back to the top of the page. */
  function focusKey() {
    const a = document.activeElement;
    return a && a.dataset && a.dataset.k ? a.dataset.k : null;
  }
  function refocus(key, fallback) {
    if (!key) return;
    const pick = (k) => { const t = k ? document.querySelector(`[data-k="${CSS.escape(k)}"]`) : null; return t && !t.disabled ? t : null; };
    const t = pick(key) || pick(fallback ? fallback(key) : null);
    if (t && t !== document.activeElement) t.focus({ preventScroll: true });
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function festive(snowId, lightsId, count) {
    const snow = document.getElementById(snowId);
    if (snow && !reducedMotion()) {
      for (let i = 0; i < count; i++) {
        const f = document.createElement("span");
        const sz = 2 + ((i * 7) % 5);
        f.className = "flake" + (i % 2 ? "" : " b");
        f.style.left = ((i * 37) % 100) + "%";
        f.style.width = f.style.height = sz + "px";
        f.style.opacity = String(0.45 + ((i * 11) % 5) / 10);
        f.style.animationDuration = (9 + ((i * 13) % 9)) + "s";
        f.style.animationDelay = (-((i * 29) % 15)) + "s";
        snow.append(f);
      }
    }
    /* The garland: instead of plain bulbs, little glowing cyber (shield), AI (sparkle) and privacy
       (padlock) icons in the four bulb colours, hanging along the wire's curve. */
    const lights = lightsId && document.getElementById(lightsId);
    if (lights) {
      const cols = ["#FF6B6B", "#F5C451", "#9EE6C4", "#F8F3E9"];
      for (let i = 0; i < 26; i++) {
        const [kind, d] = GARLAND[i % GARLAND.length], col = cols[i % 4];
        const b = document.createElement("span");
        const x = (2 * i) / 25 - 1;
        b.className = "bulb " + kind;
        b.style.marginTop = (Math.round(30 * (1 - x * x)) + 4) + "px";
        b.style.color = col;
        b.style.filter = "drop-shadow(0 0 4px " + col + ")";
        b.style.animationDuration = (1.4 + (i % 4) * 0.35).toFixed(2) + "s";
        b.style.animationDelay = (i * 0.13).toFixed(2) + "s";
        b.append(svg(d));
        lights.append(b);
      }
    }
  }

  /* Clickjacking defence-in-depth: GitHub Pages can't send frame-ancestors / X-Frame-Options,
     so if we are framed by another origin, warn and stop interactivity. */
  function guardFraming() {
    let framed = false;
    try { framed = window.top !== window.self; } catch (e) { framed = true; }
    if (framed) {
      document.body.prepend(h("div", { class: "framed-warning", role: "alert", text: "This calendar is being shown inside another website. Open it directly to use it safely." }));
      document.querySelectorAll("button, select").forEach((b) => { b.disabled = true; });
    }
    return framed;
  }

  /* Snow falling around the Winterwatch house, and warm lights with red and gold baubles hung along the
     garland over the calendar wall (31 hangings across 10 swags, dipping with the curve). */
  function houseFestive(snowId, eaveId) {
    const eave = document.getElementById(eaveId);
    if (eave && !eave.childElementCount) {
      for (let i = 0; i < 31; i++) {
        const b = document.createElement("span");
        const dip = Math.round(8 * Math.pow(Math.sin((Math.PI * i) / 3), 2));
        if (i % 3 === 1) { b.className = "bb" + (i % 2 ? "" : " g"); b.style.marginTop = (dip + 7) + "px"; }
        else {
          b.className = "wl";
          b.style.marginTop = (dip + 3) + "px";
          b.style.animationDuration = (1.3 + (i % 5) * 0.3).toFixed(2) + "s";
          b.style.animationDelay = (i * 0.11).toFixed(2) + "s";
        }
        eave.append(b);
      }
    }
    const snow = document.getElementById(snowId);
    if (snow && !reducedMotion() && !snow.childElementCount) {
      for (let i = 0; i < 46; i++) {
        const f = document.createElement("span");
        const sz = 2 + ((i * 5) % 4);
        f.className = "flake";
        f.style.left = ((i * 41 + 7) % 100) + "%";
        f.style.width = f.style.height = sz + "px";
        f.style.opacity = String(0.5 + ((i * 3) % 5) / 10);
        f.style.animationDuration = (14 + ((i * 7) % 12)) + "s";
        f.style.animationDelay = (-((i * 31) % 26)) + "s";
        snow.append(f);
      }
    }
  }

  /* Progress storage shared by the calendar and the briefing pages. Whatever comes back from
     localStorage is rebuilt from scratch, keeping only well-formed values (SECURITY.md #3). */
  const store = {
    get(key) { try { return JSON.parse(window.localStorage.getItem(key)); } catch (e) { return null; } },
    set(key, val) { try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage unavailable: play continues in memory */ } }
  };
  const AUDS = ["simple", "technical", "business"];
  function sanitize(saved, data) {
    const out = { opened: {}, answers: {}, acts: {}, team: "", pick: null, aud: "simple", country: null };
    if (!saved || typeof saved !== "object") return out;
    const days = data.days.length;
    const day = (k) => { const n = Number(k); return Number.isInteger(n) && n >= 1 && n <= days ? n : 0; };
    if (saved.opened && typeof saved.opened === "object") for (const k of Object.keys(saved.opened)) { const n = day(k); if (n) out.opened[n] = 1; }
    if (saved.answers && typeof saved.answers === "object") for (const [k, v] of Object.entries(saved.answers)) { const n = day(k); if (n && [0, 1, 2].includes(v)) out.answers[n] = v; }
    if (saved.acts && typeof saved.acts === "object") {
      for (const [k, v] of Object.entries(saved.acts)) {
        const m = /^([0-9]{1,2})-([0-3])$/.exec(k);
        if (m && day(m[1]) && v === 1) out.acts[Number(m[1]) + "-" + m[2]] = 1;
      }
    }
    if (typeof saved.team === "string" && Object.prototype.hasOwnProperty.call(data.stakeholders, saved.team)) out.team = saved.team;
    // "pick" is the calendar length the visitor chose with the switch. The older "mode" field was saved on every
    // visit, chosen or not, so it is ignored: otherwise everyone who looked before launch would keep the old default.
    if (saved.pick === "advent" || saved.pick === "full") out.pick = saved.pick;
    if (AUDS.includes(saved.aud)) out.aud = saved.aud;
    if (Array.isArray(data.countries) && data.countries.some((c) => c.id === saved.country)) out.country = saved.country;
    return out;
  }

  /* Calendar length. Advent (1-24 December) unless settings.json says "defaultMode": "full". A page starts in:
     the mode its link names (?mode=), else 31 days for a link to door 25-31 (those doors only exist there),
     else the visitor's own pick from the switch, else the default. Links only carry ?mode= when it isn't the default. */
  function defaultMode(settings) { return settings && settings.defaultMode === "full" ? "full" : "advent"; }
  function startMode(data, settings, params, pick) {
    const q = params.get("mode");
    if (q === "advent" || q === "full") return q;
    const day = Number.parseInt(params.get("day") || "", 10);
    if (Number.isInteger(day) && day > data.modes.advent.doors && day <= data.modes.full.doors) return "full";
    return pick || defaultMode(settings);
  }
  function modeParam(mode, settings) { return mode === defaultMode(settings) ? "" : "mode=" + mode; }

  /* TEST MODE (temporary; settings.json "testMode": true). A date simulator for checking the countdown, the door
     locks and the Nestor messages before December. With testMode off, a stored test date and ?preview=all links
     have no effect at all. Switch it off before launch (validate.py warns while it is on), then delete this block,
     testBar() and the .testbar styles. */
  let testOffset = 0;
  const TEST_KEY = "cyber-advent:test-date";
  function now() { return new Date(Date.now() + testOffset); }
  let testOn = false;
  function applyTestMode(settings) {
    testOffset = 0; testOn = false;
    if (!settings || settings.testMode !== true) return false;
    testOn = true;
    let v = null;
    try { v = window.localStorage.getItem(TEST_KEY); } catch (e) { v = null; }
    if (v && /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?$/.test(v)) { const t = new Date(v); if (!Number.isNaN(t.getTime())) testOffset = t.getTime() - Date.now(); }
    return true;
  }
  function testBar(data, settings) {
    if (!settings || settings.testMode !== true) return null;
    let cur = "";
    try { cur = window.localStorage.getItem(TEST_KEY) || ""; } catch (e) { cur = ""; }
    const y = data.year, two = (v) => String(v).padStart(2, "0");
    const opts = [["", "Real date and time"], [`${y}-11-25T10:00`, "25 Nov · countdown"], [`${y}-12-01T08:28:45`, "1 Dec 08:28:45 · watch Door 1 open"]];
    for (let d = 1; d <= 31; d++) opts.push([`${y}-12-${two(d)}T10:00`, `${d} Dec`]);
    opts.push([`${y}-12-06T08:28:45`, "6 Dec 08:28:45 · watch Door 6 open"], [`${y}-12-24T08:28:45`, "24 Dec 08:28:45 · Door 24 + Christmas note"], [`${y + 1}-01-02T10:00`, `2 Jan ${y + 1} · after December`]);
    const sel = h("select", { id: "testdate" }, opts.map(([v, t]) => h("option", { value: v, text: t })));
    sel.value = opts.some(([v]) => v === cur) ? cur : "";
    sel.addEventListener("change", () => {
      try { if (sel.value) window.localStorage.setItem(TEST_KEY, sel.value); else window.localStorage.removeItem(TEST_KEY); } catch (e) { /* storage blocked */ }
      window.location.reload();
    });
    const u = new URL(window.location.href), pv = u.searchParams.get("preview") === "all";
    if (pv) u.searchParams.delete("preview"); else u.searchParams.set("preview", "all");
    return h("details", { class: "testbar" },
      h("summary", {}, h("strong", { text: "TEST MODE" }), " ", h("span", { class: "tb-now", "data-clock": "1" })),
      h("div", { class: "tb-body" },
        h("label", { for: "testdate", text: "Pretend it is" }), sel,
        h("a", { href: u.pathname + u.search, text: pv ? "Lock the doors again" : "Open every door" }),
        h("span", { class: "tb-note", text: "Temporary · turn off testMode in settings.json before 1 December" })));
  }

  /* Live countdowns: an element with data-cd="<timestamp>" shows the time left, data-clock the current time;
     one timer refreshes them all every second. */
  function fmtLeft(ms) {
    if (!(ms > 0)) return "00:00:00";
    const t = Math.floor(ms / 1000), d = Math.floor(t / 86400);
    const clock = [Math.floor((t % 86400) / 3600), Math.floor((t % 3600) / 60), t % 60].map((v) => String(v).padStart(2, "0")).join(":");
    return d ? `${d} ${d === 1 ? "day" : "days"} ${clock}` : clock;
  }
  /* When a countdown reaches zero, the page hears "advent:countdown-end" once for it, so the door can open
     there and then instead of the clock sitting at 00:00:00. */
  function tick() {
    const t = now(), ms = t.getTime();
    let ended = false;
    document.querySelectorAll("[data-cd]").forEach((e) => {
      const v = Number(e.dataset.cd);
      if (!Number.isFinite(v)) return;
      e.textContent = fmtLeft(v - ms);
      if (v <= ms && !e.dataset.cdEnd) { e.dataset.cdEnd = "1"; ended = true; }
    });
    document.querySelectorAll("[data-clock]").forEach((e) => { e.textContent = t.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }); });
    if (ended) document.dispatchEvent(new CustomEvent("advent:countdown-end"));
  }
  let ticker = 0;
  function startTicker() { if (!ticker) ticker = window.setInterval(tick, 1000); tick(); }

  /* When a door opens. Door n opens at data.opens (08:29) on n December in data.timezone (Europe/Rome, so CET in
     December): one moment for everyone, wherever they are, so every door is open for exactly 24 hours before
     the next one. It is one minute before the calendar reminder (data.reminder, 08:30), so the door is already
     open when the reminder arrives. Visitors elsewhere see that moment in their own time (02:29 in New York,
     23:29 the evening before in Los Angeles, 16:29 in Tokyo). */
  const zoneFmt = {};
  function zoneOffset(tz, t) {
    const f = zoneFmt[tz] || (zoneFmt[tz] = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    const p = {}; f.formatToParts(t).forEach((x) => { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  }
  function zoneTime(data, n, hhmm, fallback) {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm || fallback) || /^(\d\d):(\d\d)$/.exec(fallback);
    const wall = Date.UTC(data.year, data.month - 1, n, +m[1], +m[2]);
    try {
      let t = wall - zoneOffset(data.timezone, wall);
      t = wall - zoneOffset(data.timezone, t); // second pass settles a clock change between the guess and the answer
      return new Date(t);
    } catch (e) { return new Date(data.year, data.month - 1, n, +m[1], +m[2]); } // unknown zone: local time
  }
  const reminderAt = (data, n) => zoneTime(data, n, data.reminder, "08:30");
  const opensAt = (data, n) => zoneTime(data, n, data.opens, "08:29");
  const clock = (t) => t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const DATE_LONG = { weekday: "long", day: "numeric", month: "long" };
  /* "Tuesday 1 December at 08:29", in the visitor's own time zone. */
  function opensLabel(data, n) {
    const t = opensAt(data, n);
    return `${t.toLocaleDateString("en-GB", DATE_LONG)} at ${clock(t)}`;
  }
  /* "A new door opens at 08:29" (the visitor's own time for 08:29 CET). */
  function nextOpensText(data, n) { return `A new door opens at ${clock(opensAt(data, n))}`; }
  function opensClock(data, n) { return clock(opensAt(data, n)); }

  /* The highest door that is open now (0 before the first one, 99 after the calendar year). */
  function todayFor(data) {
    const t = now();
    if (t.getFullYear() > data.year) return 99;
    let n = 0;
    while (n < 31 && opensAt(data, n + 1) <= t) n++;
    return n;
  }

  /* Whole calendar days from today to the day door n opens, in the visitor's own time zone. Both dates are
     local midnights; rounding absorbs the one-hour difference when clocks change in between. */
  function daysUntil(data, n) {
    const t = now(), o = opensAt(data, n);
    const t0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    return Math.round((new Date(o.getFullYear(), o.getMonth(), o.getDate()) - t0) / 86400000);
  }

  /* Calls back when the local date changes or a door opens, so a page left open moves on: a timer for the
     next midnight or door opening, whichever is sooner, plus a check whenever the tab comes back into view
     (timers sleep with the device). */
  function onNewDay(cb, data) {
    const key = () => now().toDateString() + (data ? "|" + todayFor(data) : "");
    let last = key(), timer = 0;
    const check = () => { const k = key(); if (k !== last) { last = k; cb(); } };
    const arm = () => {
      window.clearTimeout(timer);
      const t0 = now();
      let next = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + 1, 0, 0, 2);
      if (data) {
        const t = todayFor(data);
        if (t < 31) { const o = new Date(opensAt(data, t + 1).getTime() + 2000); if (o > t0 && o < next) next = o; }
      }
      timer = window.setTimeout(() => { check(); arm(); }, Math.min(next - t0, 2147483647));
    };
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { check(); arm(); } });
    window.addEventListener("focus", check);
    arm();
  }

  /* A note from NESTOR for a door that isn't open yet: when it opens, and a live countdown.
     Used by the calendar's "Come back tomorrow" popup and by the briefing page of a locked door ({ page: true },
     which says the briefing appears there). In test mode it also points testers to the test bar and a preview link. */
  function nestorNote(data, n, today, headTag, ids, opts) {
    const img = h("img", { class: "nestor-img", src: "img/nestor-family.webp", width: "760", height: "714", alt: "" });
    const eyebrow = h("p", { class: "nestor-eyebrow", text: "A NOTE FROM NESTOR" });
    /* The countdown has run out while the note was open: say so, and the page offers an "Open door n" button. */
    if (opensAt(data, n) <= now()) {
      return [img, eyebrow,
        h(headTag || "h2", { id: ids ? ids.head : null, class: "nestor-h", text: `Door ${n} is open!` }),
        h("p", { id: ids ? ids.text : null, class: "nestor-t", text: "The wait is over. Go on, open it: NESTOR wants to see what’s inside too." })];
    }
    const k = daysUntil(data, n), label = opensLabel(data, n), at = opensClock(data, n);
    const head = k <= 0 ? `Come back at ${at}!` : k === 1 ? "Come back tomorrow!" : `Come back in ${k} days!`;
    const when = (k <= 0 ? `Door ${n} opens today at ${at}.` : k === 1 ? `Door ${n} opens tomorrow, ${label}.` : `Door ${n} opens on ${label}.`)
      + (opts && opts.page ? " Its full briefing appears on this page then." : "");
    const why = today >= 1 ? `Today’s door is ${today}. One door a day keeps the surprise - see you then.`
      : n === 1 ? "Add the reminders to your calendar and we’ll tell you when it opens."
        : `The calendar starts with Door 1 on ${opensLabel(data, 1)}.`;
    return [img, eyebrow,
      h(headTag || "h2", { id: ids ? ids.head : null, class: "nestor-h", text: head }),
      h("p", { id: ids ? ids.text : null, class: "nestor-t" }, when, " ", why),
      h("p", { class: "nestor-cd" }, "Opens in ", h("strong", { "data-cd": String(opensAt(data, n).getTime()), text: fmtLeft(opensAt(data, n) - now()) })),
      testOn ? h("p", { class: "nestor-test" }, h("strong", { text: "Testing?" }), " Pick a December date in the test bar, or ",
        h("a", { href: previewHref(n), text: "preview this door" }), " (test mode only).") : null
    ];
  }
  /* THE FULL BRIEFING. Its sections are built here once and used by the briefing page (door.js) and by the door
     popup on the calendar page (app.js), so both always show the same thing. level is the heading level of the
     section titles: 2 on the briefing page, 3 inside the popup (whose door title is an h2). */
  const BP = {
    pin: "M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
  };
  const WHY = [["simple", "SIMPLE · FOR EVERYONE"], ["technical", "TECHNICAL · FOR IT AND SECURITY"], ["business", "BUSINESS · FOR LEADERS"]];
  function shareKitBlock(channels, lv) {
    const tabs = h("div", { class: "tabs", role: "tablist", "aria-label": "Channel" });
    const hint = h("span", {}), count = h("span", { class: "count" });
    const ta = h("textarea", { class: "kit-text", readonly: true, rows: "12", "aria-label": "Summary to share" });
    const copy = h("button", { type: "button", class: "copy", text: "Copy text" });
    const links = h("div", { class: "kit-links" });
    function show(i) {
      const c = channels[i];
      tabs.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-selected", String(j === i)));
      hint.textContent = c.hint;
      count.textContent = c.id === "x" ? `${c.text.length}/280 characters` : `${c.text.length} characters`;
      ta.value = c.text;
      copy.textContent = "Copy text";
      links.replaceChildren(...c.links.map((l) => (l.mailto ? h("a", { class: "share", href: l.mailto, text: l.label }) : extLink(l.url, "share", l.label))));
    }
    channels.forEach((c, i) => tabs.append(h("button", { type: "button", role: "tab", onclick: () => show(i) }, c.name)));
    copy.addEventListener("click", async () => {
      if (await copyText(ta.value)) copy.textContent = "Copied ✓";
      else { ta.focus(); ta.select(); copy.textContent = "Selected - press Ctrl+C or ⌘C"; }
    });
    show(0);
    return h("section", { class: "kit", id: "share", "aria-label": "Share kit" },
      h("div", { class: "shead" }, h("h" + lv, { class: "h3", text: "SHARE KIT · A SUMMARY FOR EVERY CHANNEL" }), h("span", { class: "note", text: "Check the text and add your name before posting" })),
      tabs, h("div", { class: "meta2" }, hint, count), ta, h("div", { class: "kit-links" }, copy, links));
  }
  function labFull(d, lv) {
    const L = d.lab, c0 = d.cases[0];
    return h("section", { class: "lab full", "aria-label": "Incident lab" },
      h("div", { class: "lhead" }, h("h" + lv, { class: "h3", text: "INCIDENT LAB" }), h("span", { class: "basis", text: `Based on: ${c0.name} (${c0.when})` })),
      h("div", { class: "lsec" }, h("span", { class: "lk", text: "TIMELINE · WHAT HAPPENED" }),
        h("ol", { class: "timeline" }, L.timeline.map((e) => h("li", {}, h("span", { class: "when", text: e.when }), h("span", { class: "what", text: e.what }))))),
      h("div", { class: "lsec two" },
        h("div", { class: "stack" }, h("span", { class: "lk", text: "HOW IT COULD HAVE BEEN PREVENTED" }), L.prevent.map((t) => h("span", { class: "li" }, svg(BP.shield), t))),
        h("div", { class: "stack" }, h("span", { class: "lk", text: "HOW IT COULD HAVE BEEN DETECTED" }), L.detect.map((t) => h("span", { class: "li" }, svg(BP.eye), t)))),
      h("div", { class: "lsec" }, h("span", { class: "lk", text: "AFTER IT · TUNE DETECTION (ILLUSTRATIVE - ADAPT TO YOUR SIEM OR EDR)" }), L.tune.map((t) => h("code", { class: "rule", text: t }))),
      h("div", { class: "lsec" }, h("span", { class: "lk", text: "RESPONSE PLAYBOOK" }), h("ol", { class: "steps" }, L.playbook.map((t) => h("li", { text: t })))),
      h("div", { class: "lsec" },
        h("div", { class: "inject" }, h("span", { class: "lk", text: "TABLETOP · 20-MINUTE INJECT" }), h("p", { text: L.tabletop.inject })),
        h("span", { class: "lk", text: "DISCUSS" }), L.tabletop.questions.map((q) => h("span", { class: "q-item" }, h("b", { "aria-hidden": "true", text: "?" }), q)),
        h("span", { class: "roles", text: "Roles: incident lead · IT & security · legal & privacy · comms · business owner. Capture decisions, owners and gaps - then update the playbook." })));
  }
  function countryLens(data, d, state, persist, rerender) {
    const box = h("section", { class: "lens", "aria-label": "Country lens" });
    const sel = h("select", { id: "country", "data-k": "country" });
    data.countries.forEach((c) => sel.append(h("option", { value: c.id, text: c.name })));
    sel.value = state.country;
    sel.addEventListener("change", () => { if (data.countries.some((c) => c.id === sel.value)) { state.country = sel.value; persist(); rerender(); } });
    box.append(h("div", { class: "lhead" }, h("label", { class: "h3", for: "country", text: "COUNTRY LENS" }), sel));
    const nat = data.national[state.country];
    if (state.country === "eu" || !nat) box.append(h("span", { class: "title", text: "EU baseline" }), h("span", { class: "t", text: "NIS2, DORA, GDPR, the Cyber Resilience Act and the EU AI Act set the common floor. Pick a country to see national standards and authorities." }));
    else box.append(h("span", { class: "title", text: nat.auth }), h("span", { class: "t", text: nat[d.category] || nat.general }), extLink(nat.url, null, String(nat.url).replace("https://", "") + " ↗"));
    return box;
  }
  function briefingSections(o) {
    const { data, n, d, state, persist, rerender, total, link } = o, lv = o.level === 3 ? 3 : 2;
    const sec = (title, note, ...kids) => h("section", { class: "bf-sec", "aria-label": title },
      h("div", { class: "shead" }, h("h" + lv, { class: "h3", text: title }), note ? h("span", { class: "note", text: note }) : null), ...kids);
    const out = [];
    // Role lines ("Make it relevant"): every role this door has a line for, the visitor's own role first.
    const notes = Object.entries(d.roleNotes || {}).sort(([a], [b]) => (b === state.team) - (a === state.team));
    if (notes.length) out.push(sec("FOR SPECIFIC ROLES", "Choose your role on the calendar to see your line first",
      h("ul", { class: "role-notes" }, notes.map(([id, text]) => h("li", { class: id === state.team ? "me" : null }, h("strong", { text: data.stakeholders[id] }), h("span", { text: " " + text }))))));
    out.push(sec("WHY IT MATTERS · THREE WAYS TO EXPLAIN IT", null,
      h("div", { class: "why" }, WHY.map(([k, label]) => h("div", {}, h("span", { class: "lk", text: label }), h("p", { text: d.explain[k] }))))));
    out.push(sec("WHAT THE RULES AND STANDARDS SAY", "Verbatim excerpts · […] marks a cut · not legal advice",
      quotesFor(data, d).map((qt) => h("figure", { class: "quote " + String(qt.src).replace(/[^A-Za-z0-9]/g, "") },
        h("div", { class: "qmeta" }, h("span", { class: "src", text: qt.src }), h("span", { class: "qref", text: qt.ref })),
        h("blockquote", { text: `“${qt.text}”` }),
        qt.note ? h("p", { class: "qnote", text: qt.note }) : null,
        extLink(qt.url, null, "Read the official text ↗")))));
    if (o.activities) out.push(o.activities);
    out.push(sec("CASE STUDIES · LESSONS LEARNT", null,
      h("div", { class: "cases-grid" }, d.cases.map((c) => h("article", { class: "case" },
        h("div", { class: "cmeta" }, h("span", { class: "kind " + String(c.kind).replace(/[^A-Za-z]/g, ""), text: String(c.kind).toUpperCase() }), h("span", { text: c.when }), h("span", { class: "loc" }, svg(BP.pin), c.location)),
        h("h" + (lv + 1), { class: "h4", text: c.name }), h("p", { text: c.text }), h("span", { class: "src", text: "Source: " + c.source }))))));
    out.push(labFull(d, lv));
    out.push(shareKitBlock(shareKit(data, d, total, link), lv));
    out.push(sec("READ MORE AT THE SOURCE", null,
      d.readMore.map((m) => extLink(m.url, "rm", h("span", { class: "top2" }, h("span", { class: "org", text: m.org }), h("span", { class: "ref", text: m.ref })), h("span", { class: "t", text: m.text }), h("span", { class: "go", text: "Read at source ↗" }))),
      toolkitReading(n)));
    out.push(countryLens(data, d, state, persist, rerender));
    out.push(h("div", { class: "refs" }, h("span", { class: "k", text: "GROUNDED IN" }), h("span", { class: "txt", text: d.refs }),
      d.owasp.length ? h("div", { class: "codes" }, d.owasp.map((c) => h("span", { class: "code", text: "OWASP " + c }))) : null));
    return out;
  }

  /* Doors 22 and 23 cover the supply chain: their briefings list the supplier toolkit as further reading. */
  function toolkitReading(n) {
    if (n !== 22 && n !== 23) return null;
    return h("a", { class: "rm", href: "supply.html" },
      h("span", { class: "top2" }, h("span", { class: "org", text: "WINTERWATCH" }), h("span", { class: "ref", text: "Supplier toolkit" })),
      h("span", { class: "t", text: "What to ask suppliers at every stage, what EU law expects when a supplier’s incident hits you, and a joint tabletop exercise." }),
      h("span", { class: "go", text: "Open the toolkit →" }));
  }
  /* This page, showing door n with every door open (only honoured while test mode is on). */
  function previewHref(n) {
    const u = new URL(window.location.href);
    u.searchParams.set("day", String(n)); u.searchParams.set("preview", "all"); u.hash = "";
    return u.pathname + u.search;
  }

  /* "in 12 days" / "tomorrow" / "later today", for locked doors (a door opens at 08:29 CET, see opensAt). */
  function inDays(k) { return k <= 0 ? "later today" : k === 1 ? "tomorrow" : `in ${k} days`; }

  /* Verbatim excerpts from regulations and standards for a door (ids resolved against data.quotes). */
  function quotesFor(data, d) {
    return (d.quotes || []).map((id) => data.quotes && data.quotes[id]).filter(Boolean);
  }

  function activitiesBlock(o) {
    const { data, n, d, acts, gamified, onToggle, P, note } = o;
    const done = (i) => !!acts[n + "-" + i];
    const count = (d.activities || []).filter((_, i) => done(i)).length;
    return h("section", { class: "acts", "aria-label": "Today’s activities" },
      h("div", { class: "ahead" },
        h("h3", { class: "h3", text: "TODAY’S ACTIVITIES · ONE FOR EVERY AUDIENCE" }),
        gamified ? h("span", { class: "acount", text: `${count}/4 done · +5 pts each` }) : null),
      note && note.text ? h("p", { class: "act-note" + (note.good ? " good" : ""), text: note.text }) : null,
      (d.activities || []).map((a, i) => {
        const aud = (data.audiences || []).find((x) => x.id === a.audience), on = done(i);
        return h("button", { type: "button", class: "act" + (on ? " done" : ""), "aria-pressed": String(on), "data-k": "act-" + i, onclick: () => onToggle(i, !on) },
          h("span", { class: "box", "aria-hidden": "true" }, on ? svg(P.check) : null),
          h("span", { class: "abody" },
            h("span", { class: "atags" },
              h("span", { class: "aud-name", text: (aud ? aud.name : a.audience).toUpperCase() }),
              h("span", { class: "hyg " + (["c", "a", "p"].includes(a.type) ? a.type : "c"), text: String((data.hygiene || {})[a.type] || "").toUpperCase() })),
            h("span", { class: "atext", text: a.text })));
      }));
  }

  /* Clinker, the grumpy lump of coal who turns up on wrong answers (an original character). */
  function art(viewBox, shapes, cls) {
    const s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("viewBox", viewBox);
    s.setAttribute("aria-hidden", "true");
    if (cls) s.setAttribute("class", cls);
    shapes.forEach(([tag, attrs]) => {
      const e = document.createElementNS(SVGNS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
      s.append(e);
    });
    return s;
  }
  const COAL = [
    ["circle", { cx: 10, cy: 22, r: 5, fill: "#6B6B72", opacity: ".5" }], ["circle", { cx: 4, cy: 11, r: 3, fill: "#6B6B72", opacity: ".35" }], ["circle", { cx: 80, cy: 74, r: 4, fill: "#6B6B72", opacity: ".4" }],
    ["path", { d: "M14 52L22 34L40 28L60 32L74 46L76 66L64 82L42 88L22 82L10 68Z", fill: "#232326" }],
    ["path", { d: "M22 34L40 28L44 46L26 52Z", fill: "#36363C" }], ["path", { d: "M60 32L74 46L58 54L44 46Z", fill: "#2D2D32" }],
    ["path", { d: "M10 68L26 52L36 70L22 82Z", fill: "#1A1A1D" }], ["path", { d: "M58 54L76 66L64 82L50 70Z", fill: "#2A2A2F" }],
    ["path", { d: "M30 40l3-2M64 42l2 2M18 64l2-1", stroke: "#9A9AA4", "stroke-width": 1.5, "stroke-linecap": "round" }],
    ["ellipse", { cx: 34, cy: 57, rx: 8, ry: 9, fill: "#FFFFFF" }], ["ellipse", { cx: 54, cy: 57, rx: 8, ry: 9, fill: "#FFFFFF" }],
    ["circle", { cx: 37.5, cy: 59, r: 3.6, fill: "#111", class: "pupil" }], ["circle", { cx: 57.5, cy: 59, r: 3.6, fill: "#111", class: "pupil" }],
    // Eyelids: coal-coloured, folded away (scaleY 0) until a blink drops them over the eyes.
    ["ellipse", { cx: 34, cy: 57, rx: 8.6, ry: 9.6, fill: "#232326", class: "lid" }], ["ellipse", { cx: 54, cy: 57, rx: 8.6, ry: 9.6, fill: "#232326", class: "lid" }],
    ["path", { d: "M25 46L41 51M63 46L47 51", stroke: "#111", "stroke-width": 3.2, "stroke-linecap": "round" }],
    ["path", { d: "M36 73Q46 77 57 68", fill: "none", stroke: "#E8E2D6", "stroke-width": 2.6, "stroke-linecap": "round" }],
    ["path", { d: "M24 34Q36 8 66 10Q58 18 60 30Z", fill: "#C8202F" }],
    ["path", { d: "M66 10Q78 6 76 18", fill: "none", stroke: "#C8202F", "stroke-width": 6, "stroke-linecap": "round" }],
    ["circle", { cx: 76, cy: 21, r: 5, fill: "#F4EFE6" }],
    ["path", { d: "M20 37Q42 25 64 31", fill: "none", stroke: "#F4EFE6", "stroke-width": 8, "stroke-linecap": "round" }]
  ];
  const QUIPS = ["Ho-ho-NO! Clinker grabbed that one.", "A lump of coal for that answer - but the explainer below is a proper gift.", "Clinker loves that answer. So do attackers.", "Soot happens. Read why, then try the next door.", "That one goes in Clinker’s stocking. Yours gets the lesson below."];
  function clinker(seed, line) {
    return h("div", { class: "clinker" }, art("0 0 86 92", COAL, "coal"),
      h("div", { class: "bubble" }, h("span", { class: "who", text: "CLINKER · THE GRUMPY LUMP OF COAL" }), QUIPS[Math.abs(seed) % QUIPS.length],
        line ? h("span", { class: "naughty-line", text: line }) : null));
  }

  /* Santa's list. Nice: a right answer, or all four activities on a door. Naughty: a wrong answer,
     until all four of that door's activities redeem it. Computed only from sanitised progress. */
  function santaState(data, total, answers, acts) {
    const all4 = (n) => [0, 1, 2, 3].every((i) => acts[n + "-" + i] === 1);
    const right = (n) => answers[n] !== undefined && answers[n] === data.days[n - 1].quiz.answer;
    const wrong = (n) => answers[n] !== undefined && !right(n);
    const nice = [], naughty = [];
    data.days.filter((d) => d.day <= total).forEach((d) => {
      const n = d.day, full = all4(n);
      if (right(n)) nice.push({ n, t: `Door ${n} · ${d.title} - right answer` });
      else if (wrong(n)) { if (full) nice.push({ n, t: `Door ${n} · ${d.title} - redeemed` }); else naughty.push({ n, t: `Door ${n} · ${d.title} - wrong answer.` }); }
      if (full && !wrong(n)) nice.push({ n, t: `Door ${n} · ${d.title} - all four activities` });
    });
    const status = (n) => {
      if (wrong(n) && all4(n)) return { line: `Redeemed - Door ${n} is back on the Nice list.`, note: { text: `Redeemed - Clinker has crossed Door ${n} off the Naughty list.`, good: true } };
      if (wrong(n)) return { line: `Door ${n} is on the Naughty list. Tick off all four activities below to redeem it.`, note: { text: `Door ${n} is on the Naughty list. Tick off all four activities to get back on the Nice list.`, good: false } };
      if (all4(n)) return { line: "", note: { text: "All four done - that’s a Nice-list deed.", good: true } };
      return { line: "", note: null };
    };
    const verdict = !nice.length && !naughty.length ? ["Santa hasn’t checked his list yet", ""] : !naughty.length ? ["You’re on the Nice list ✓", "nice"] : nice.length >= naughty.length * 2 ? ["Mostly nice - a door or two to redeem", "mostly"] : ["Naughty list - Clinker is delighted", "naughty"];
    return { nice, naughty, status, verdict };
  }



  /* Ready-made summaries of a door for five channels. `link` is this site's own URL for the door. */
  /* The AI disclosure every share text carries (Door 21 asks readers to label AI-assisted content too). */
  const AI_LABEL = "AI-assisted · an initiative of ENISA’s ARCH AHWG";
  const AI_SHORT = "AI-assisted · ENISA ARCH AHWG initiative";

  function shareKit(data, d, total, link) {
    const enc = encodeURIComponent;
    const firstSentence = (t) => { const m = String(t).match(/^.+?[.!?](?=\s|$)/); return m ? m[0] : String(t); };
    const dot = (t) => (/[.!?]$/.test(t) ? t : t + ".");
    const cut = (t, n) => (t.length <= n ? t : t.slice(0, Math.max(0, t.lastIndexOf(" ", n - 1))) + "…");
    const qs = quotesFor(data, d), shortRef = (q) => q.src + " " + q.ref.split(" · ").pop();
    const acts = (d.activities || []).map((a) => a.text);
    const c0 = d.cases[0], ai = d.track !== "cyber", n = d.day;
    const tags = ["#Cybersecurity", ai ? "#AI" : "", (d.activities || []).some((a) => a.type === "p") ? "#Privacy" : "", "#CyberHygiene", (d.owasp || []).length ? "#OWASP" : ""].filter(Boolean).join(" ");
    const q0 = qs[0];
    const li = `🎄 Door ${n} of ${total}: ${d.title}\n\n${dot(d.topic)}\n\n✅ DO: ${d.do}\n❌ DON’T: ${d.dont}\n\n📌 Lesson learnt: ${c0.name} (${c0.when}). ${firstSentence(c0.text)}\n\n` +
      (q0 ? `📜 ${shortRef(q0)}: “${cut(q0.text, 180)}”\n\n` : "") +
      `Try today’s 20-second challenge and read the full briefing: ${link}\n\n${tags}\n\n${AI_LABEL}`;
    const wa = `*Door ${n}/${total} · ${d.title}*\n✅ ${d.do}\n❌ ${d.dont}\n🏠 Try today: ${acts[0] || ""}\n👉 ${link}\n_${AI_SHORT}_`;
    const subj = `Door ${n}: ${d.title} - a two-minute security habit`;
    const body = `Hi all,\n\nToday’s habit: ${d.do}\nPlease avoid: ${d.dont}\n\nWhy it matters for us: ${d.explain.business}\n\nOne thing to do at work today: ${acts[1] || ""}\n\nThe full briefing, with the case study and what the rules say: ${link}\n\n(${AI_LABEL})\n\nThanks,`;
    const nl = `${d.title}\n\n${d.explain.simple}\n\nDo this: ${d.do}\nAvoid this: ${d.dont}\n\nWhat happened: ${c0.name} (${c0.when}, ${c0.location}). ${c0.text}\n\n` +
      `What the rules say: ${qs.map(shortRef).join("; ")}.\n\nToday’s activities\n• At home - ${acts[0]}\n• At work - ${acts[1]}\n• Leaders - ${acts[2]}\n• Tech teams - ${acts[3]}\n\n` +
      `Read more: ${d.readMore.map((m) => m.org + " - " + m.ref).join(" · ")}\nFull briefing: ${link}\n\n${AI_LABEL}`;
    const xHead = `Door ${n}: ${d.title}\n✅ `, xTail = `\n${link} #Cybersecurity${ai ? " #AI" : ""}\n${AI_SHORT}`;
    const x = xHead + cut(d.do, 270 - xHead.length - xTail.length) + xTail;
    return [
      { id: "li", name: "LinkedIn", hint: "Long-form post · paste into a new post", text: li, links: [{ label: "Share the link on LinkedIn ↗", url: "https://www.linkedin.com/sharing/share-offsite/?url=" + enc(link) }] },
      { id: "wa", name: "WhatsApp · Signal", hint: "Short chat message · *bold* works in WhatsApp and Signal", text: wa, links: [{ label: "Open in WhatsApp ↗", url: "https://wa.me/?text=" + enc(wa) }] },
      { id: "em", name: "Email · Teams", hint: "Team email or Teams post · subject line included", text: "Subject: " + subj + "\n\n" + body, links: [{ label: "Open in your email app ↗", mailto: "mailto:?subject=" + enc(subj) + "&body=" + enc(body) }] },
      { id: "nl", name: "Intranet · newsletter", hint: "A short article for an intranet page or newsletter", text: nl, links: [] },
      { id: "x", name: "X · Bluesky", hint: "Under 280 characters, link included", text: x, links: [{ label: "Post on X ↗", url: "https://x.com/intent/post?text=" + enc(x) }, { label: "Post on Bluesky ↗", url: "https://bsky.app/intent/compose?text=" + enc(x) }] }
    ];
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
  }

  window.Advent = { svg, h, safeUrl, extLink, getJSON, festive, houseFestive, guardFraming, reducedMotion, STAR, store, sanitize, defaultMode, startMode, modeParam, todayFor, daysUntil, opensClock, onNewDay, inDays, reminderAt, opensAt, opensLabel, nextOpensText, now, applyTestMode, testBar, fmtLeft, startTicker, nestorNote, toolkitReading, briefingSections, quotesFor, activitiesBlock, clinker, santaState, shareKit, copyText, art, focusKey, refocus };
})();
