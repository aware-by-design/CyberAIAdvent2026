/* Full briefing for one door: why it matters, verbatim rule excerpts, activities for every
   audience, all case studies, the whole incident lab, a share kit and further reading.
   Same security model as the calendar: textContent only, https-only links, validated input. */
"use strict";
(() => {
  const A = window.Advent;
  const { svg, h, getJSON, festive, guardFraming, store, sanitize } = A;
  const P = {
    star: "M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z",
    check: "M5 12.5l4.5 4.5L19 7.5", x: "M7 7l10 10M17 7L7 17",
    lock: "M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3",
    pin: "M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
  };
  const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const TRACK = { ai: "AI", cyber: "CYBER", both: "AI + CYBER" };
  const pad = (n) => (n < 10 ? "0" + n : String(n));
  const root = () => document.getElementById("brief");

  async function main() {
    festive("snow", "lights", 24);
    if (guardFraming()) return;
    let data, settings;
    try {
      [data, settings] = await Promise.all([getJSON("days.json"), getJSON("settings.json").catch(() => ({}))]);
      if (!data || !Array.isArray(data.days) || data.days.length !== 31 || !data.quotes) throw new Error("bad data");
      if (!settings || typeof settings !== "object") settings = {};
    } catch (err) {
      root().append(h("p", { text: "This briefing could not load. Please refresh the page." }));
      return;
    }
    const params = new URLSearchParams(window.location.search);
    /* Test mode (temporary): a date simulator; ?preview=all opens every door only while it is on. */
    const testMode = A.applyTestMode(settings);
    const preview = testMode && params.get("preview") === "all";
    const KEY = "cyber-advent:" + data.year;
    const saved = sanitize(store.get(KEY), data);
    // Same rule as the calendar page: a briefing for door 25-31 only exists in the 31-day mode.
    const mode = A.startMode(data, settings, params, saved.pick);
    const mq = A.modeParam(mode, settings);
    const total = data.modes[mode].doors;
    let today = A.todayFor(data); // refreshed at midnight by A.onNewDay below
    // Doors follow the dates for everyone (same rule as the calendar page).
    const isLocked = (n) => !preview && n > today;
    const state = { ...saved, country: saved.country || (data.countries.some((c) => c.id === settings.defaultCountry) ? settings.defaultCountry : "eu") };
    /* The visitor's calendar-length pick belongs to the calendar page: re-read it at save time so a stale copy
       from when this page loaded never overwrites a newer choice made in another tab. */
    const persist = () => {
      const cur = sanitize(store.get(KEY), data);
      store.set(KEY, { pick: cur.pick, opened: state.opened, answers: state.answers, acts: state.acts, team: state.team, aud: state.aud, country: state.country });
    };
    const q = (n) => `?day=${n}${mq ? "&" + mq : ""}${preview ? "&preview=all" : ""}`;

    let n = Number.parseInt(params.get("day") || "", 10);
    if (!Number.isInteger(n) || n < 1 || n > total) n = today >= 1 ? Math.min(today, total) : 1;
    const d = data.days[n - 1];

    function render() {
      const focused = A.focusKey();
      const r = root(); r.replaceChildren();
      const bar = h("nav", { class: "bf-bar", "aria-label": "Briefing navigation" },
        h("a", { class: "back", href: "index.html" + q(n) }, "← Back to the calendar"),
        h("span", { class: "grow" }),
        h("span", { class: "pos", text: isLocked(n) ? `DOOR ${n} OF ${total} · NOT OPEN YET` : `FULL BRIEFING · DOOR ${n} OF ${total}` }),
        n > 1 ? h("a", { class: "sq", href: "door.html" + q(n - 1), "aria-label": "Previous door" }, "←") : null,
        n < total && !isLocked(n + 1) ? h("a", { class: "sq", href: "door.html" + q(n + 1), "aria-label": "Next door" }, "→") : null,
        isLocked(n) ? null : h("button", { type: "button", class: "ghost", onclick: () => window.print() }, "Print or save as PDF"));
      r.append(bar);
      if (isLocked(n)) {
        r.append(h("div", { class: "locked-msg nestor-inline" }, ...A.nestorNote(data, n, today, "h1", null, { page: true }),
          h("p", { class: "nestor-links" }, h("a", { href: "index.html" + (mq ? "?" + mq : ""), text: "Back to the calendar and its reminders" }))));
        A.startTicker();
        return;
      }
      if (!state.opened[n]) { state.opened[n] = 1; persist(); } // write only when something changed
      document.title = `Door ${n}: ${d.title} · Winterwatch`;
      const dt = new Date(data.year, data.month - 1, n), occ = data.occasions[n], isAI = d.track !== "cyber";
      r.append(h("header", { class: "bf-hero" },
        h("div", { class: "ornament o" + (n % 4), "aria-hidden": "true" }, h("span", { class: "string" }), h("span", { class: "cap" }), h("span", { class: "ball" }, svg(data.icons[d.icon] || P.star)), h("span", { class: "shine" })),
        h("div", { class: "stack" },
          h("div", { class: "meta" }, h("span", { text: `DOOR ${pad(n)} OF ${total}` }), h("span", { "aria-hidden": "true", text: "·" }), h("span", { text: `${WD[dt.getDay()].toUpperCase()} ${n} DECEMBER ${data.year}${occ ? " · " + occ.toUpperCase() : ""}` })),
          h("h1", { tabindex: "-1", text: d.title }),
          h("div", { class: "labels" }, h("span", { class: "track" + (isAI ? " ai" : "") }, isAI ? svg(P.star) : null, TRACK[d.track]), h("span", { class: "topic", text: d.topic })),
          h("div", { class: "for" }, h("span", { class: "k", text: "FOR" }), d.for.map((id) => h("span", { class: "who" + (id === state.team ? " me" : ""), text: data.stakeholders[id] }))))));
      r.append(h("div", { class: "two" },
        h("div", { class: "dd" }, h("span", { class: "dot", "aria-hidden": "true" }, svg(P.check)), h("div", {}, h("span", { class: "lbl", text: "NICE LIST · DO" }), h("p", { text: d.do }))),
        h("div", { class: "dd dont" }, h("span", { class: "dot", "aria-hidden": "true" }, svg(P.x)), h("div", {}, h("span", { class: "lbl", text: "NAUGHTY LIST · DON’T" }), h("p", { text: d.dont })))));
      /* The sections are shared with the door popup on the calendar page (A.briefingSections). The public link
         never carries ?preview=all: an organiser previewing in November must not hand everyone who clicks a
         shared post a way round the one-door-a-day lock. */
      const link = new URL(`index.html?day=${n}${mq ? "&" + mq : ""}`, window.location.href).toString();
      r.append(...A.briefingSections({ data, n, d, state, persist, rerender: render, total, link, level: 2,
        activities: A.activitiesBlock({ data, n, d, acts: state.acts, gamified: settings.gamified !== false, P, note: A.santaState(data, total, state.answers, state.acts).status(n).note,
          onToggle: (i, on) => { const k = n + "-" + i; if (on) state.acts[k] = 1; else delete state.acts[k]; persist(); render(); } }) }));
      r.append(h("a", { class: "brief-cta", href: "index.html" + q(n) },
        h("span", { class: "bt" }, h("strong", { text: "Take today’s 20-second challenge" }), h("span", { text: "+20 pts in the calendar - and Clinker is waiting for wrong answers" })),
        h("span", { class: "arr", "aria-hidden": "true", text: "→" })));
      if (window.location.hash === "#share" && !focused) { const s = document.getElementById("share"); if (s) s.scrollIntoView(); }
      A.refocus(focused);
    }
    /* Pick up progress saved in another tab (see app.js). */
    window.addEventListener("storage", (e) => {
      if (e.key !== null && e.key !== KEY) return;
      const fresh = sanitize(store.get(KEY), data);
      Object.assign(state, { opened: fresh.opened, answers: fresh.answers, acts: fresh.acts, team: fresh.team, aud: fresh.aud, country: fresh.country || state.country });
      render();
    });
    /* Left open, a locked briefing opens by itself when its countdown reaches zero (or at midnight), without a
       reload; focus goes to the briefing's title so a screen reader announces it. */
    const moveOn = (newDay) => {
      const was = isLocked(n), t = A.todayFor(data);
      if (t === today && !newDay) return;
      today = t; render();
      if (was && !isLocked(n)) { const h1 = document.querySelector(".bf-hero h1"); if (h1) h1.focus({ preventScroll: true }); }
    };
    A.onNewDay(() => moveOn(true), data);
    document.addEventListener("advent:countdown-end", () => moveOn(false));
    const tb = A.testBar(data, settings);
    if (tb) document.body.append(tb);
    render();
    A.startTicker();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", main); else main();
})();
