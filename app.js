/* One door a day - festive cybersecurity & AI calendar (vanilla JS, no dependencies).
   Security: no innerHTML; https-only links; strict validation of everything read from
   localStorage and the URL; progress is per-browser and never leaves the device. */
"use strict";
(() => {
  const A = window.Advent;
  const { svg, h, getJSON, festive, houseFestive, guardFraming, store, sanitize } = A;
  const P = {
    star: "M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z",
    check: "M5 12.5l4.5 4.5L19 7.5", x: "M7 7l10 10M17 7L7 17",
    lock: "M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3",
    badge: "M12 2.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.1l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7z",
    left: "M15 6l-6 6 6 6", right: "M9 6l6 6-6 6",
    pin: "M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    gift: "M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM3 7h18v4H3zM12 7v14M12 7c-1.5-3-5-4-5.5-1.5S9.5 7 12 7zM12 7c1.5-3 5-4 5.5-1.5S14.5 7 12 7z"
  };
  const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const TRACK = { ai: "AI", cyber: "CYBER", both: "AI + CYBER" };
  const AUD = [["simple", "Simple"], ["technical", "Technical"], ["business", "Business"]];
  const pad = (n) => (n < 10 ? "0" + n : String(n));
  const el = (id) => document.getElementById(id);
  const plural = (k, one, many) => `${k} ${k === 1 ? one : many}`;

  function looksValid(data) {
    return data && Array.isArray(data.days) && data.days.length === 31 && data.modes && data.stakeholders && data.icons && data.pins && data.quotes && data.audiences;
  }

  async function main() {
    festive("snow", "lights", 36);
    houseFestive("hsnow", "eave");
    if (guardFraming()) return;
    let data, settings;
    try {
      /* A missing or broken settings.json falls back to the defaults instead of stopping the calendar. */
      [data, settings] = await Promise.all([getJSON("days.json"), getJSON("settings.json").catch(() => ({}))]);
      if (!looksValid(data)) throw new Error("bad data");
      if (!settings || typeof settings !== "object") settings = {};
    } catch (err) {
      el("house").after(h("p", { class: "load-error", text: "The calendar could not load. Please refresh the page." }));
      return;
    }
    const DAYS = data.days, STK = data.stakeholders;
    const params = new URLSearchParams(window.location.search);
    /* Test mode (temporary): a date simulator; ?preview=all opens every door only while it is on. */
    const testMode = A.applyTestMode(settings);
    const preview = testMode && params.get("preview") === "all";
    const KEY = "cyber-advent:" + data.year;
    const saved = sanitize(store.get(KEY), data);
    /* Advent (24 doors) unless settings.json or the visitor's own pick says 31 days; a link to door 25-31
       opens the 31-day calendar (A.startMode). Only a click on the switch is remembered as the visitor's pick. */
    const state = {
      mode: A.startMode(data, settings, params, saved.pick), pick: saved.pick,
      opened: saved.opened, answers: saved.answers, acts: saved.acts, team: saved.team, aud: saved.aud,
      country: saved.country || (data.countries.some((c) => c.id === settings.defaultCountry) ? settings.defaultCountry : "eu"),
      filter: "all", selected: 1, celebrate: false
    };
    const gamified = settings.gamified !== false;
    el("hud").hidden = !gamified;

    let today = A.todayFor(data); // refreshed at midnight by A.onNewDay below
    const total = () => data.modes[state.mode].doors;
    /* Doors follow the dates for everyone: today's door and the days before it are open, later doors stay shut
       and show a note from the NESTOR family instead. This is a convenience, not access control: all content is
       public in days.json (SECURITY.md). */
    const isLocked = (n) => !preview && n > today;
    const correct = (n) => state.answers[n] !== undefined && state.answers[n] === DAYS[n - 1].quiz.answer;
    const wrong = (n) => state.answers[n] !== undefined && !correct(n);
    const persist = () => store.set(KEY, { pick: state.pick, opened: state.opened, answers: state.answers, acts: state.acts, team: state.team, aud: state.aud, country: state.country });
    /* Same-origin link to a door's full briefing; n is always a validated integer. */
    const mq = () => { const m = A.modeParam(state.mode, settings); return m ? "&" + m : ""; };
    const briefHref = (n) => `door.html?day=${n}${mq()}${preview ? "&preview=all" : ""}`;

    const asked = Number.parseInt(params.get("day") || "", 10);
    let openOnLoad = 0, lockedOnLoad = 0;
    if (Number.isInteger(asked) && asked >= 1 && asked <= total()) { if (isLocked(asked)) lockedOnLoad = asked; else openOnLoad = asked; }
    if (today >= 1) state.selected = Math.min(today, total()); // after Advent / after December: the last door
    if (openOnLoad) state.selected = openOnLoad;

    const dlg = el("daydlg"), dbody = el("daybody"), down = el("daydown"), ndlg = el("nestordlg");
    /* A click on the backdrop closes a popup; a click on its own padding or scrollbar does not. */
    const onBackdrop = (d, close) => d.addEventListener("click", (e) => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
    });
    const setUrl = (n) => {
      const url = new URL(window.location.href);
      if (n) url.searchParams.set("day", String(n)); else url.searchParams.delete("day");
      if (A.modeParam(state.mode, settings)) url.searchParams.set("mode", state.mode); else url.searchParams.delete("mode");
      url.searchParams.delete("preview");
      if (preview) url.searchParams.set("preview", "all");
      window.history.replaceState(null, "", url);
    };
    /* Opening a door: it swings open on the house, then the whole day appears in a popup. A door that isn't
       open yet shows a note from the NESTOR family instead. In the popup, Previous / Next move between doors. */
    function select(n, open) {
      if (!Number.isInteger(n) || n < 1 || n > total()) return;
      if (isLocked(n)) { showNestor(n); return; }
      state.selected = n; state.opened[n] = 1; state.celebrate = false;
      persist(); setUrl(n); render();
      if (dlg.open) { dbody.scrollTop = 0; focusTitle(); updateDown(); }
      else if (open) window.setTimeout(openDay, open === "now" || A.reducedMotion() ? 0 : 650);
    }
    function focusTitle() { const t = el("daytitle"); if (t) t.focus({ preventScroll: true }); }
    function openDay() {
      if (!dlg.open) dlg.showModal();
      dbody.scrollTop = 0; focusTitle(); updateDown();
    }
    const atEnd = () => dbody.scrollTop + dbody.clientHeight >= dbody.scrollHeight - 8;
    function updateDown() {
      const end = atEnd();
      down.textContent = end ? "Back to top ↑" : "Scroll down ↓";
      down.dataset.arrow = end ? "↑" : "↓"; // phones show just the arrow (styles.css)
      down.setAttribute("aria-label", end ? "Back to the top of this door" : "Scroll down to the next part of this door");
    }
    /* Scroll down: jump to the next part of the day (challenge, activities, lesson, briefing...); at the end, back to the top. */
    down.addEventListener("click", () => {
      const behavior = A.reducedMotion() ? "auto" : "smooth";
      if (atEnd()) { dbody.scrollTo({ top: 0, behavior }); return; }
      const base = dbody.getBoundingClientRect().top - dbody.scrollTop;
      const tops = [...el("panel").children].map((c) => c.getBoundingClientRect().top - base);
      const next = tops.find((t) => t > dbody.scrollTop + 24);
      dbody.scrollTo({ top: next === undefined ? dbody.scrollHeight : next - 8, behavior });
    });
    dbody.addEventListener("scroll", updateDown, { passive: true });
    window.addEventListener("resize", () => { if (dlg.open) updateDown(); });
    el("dayclose").addEventListener("click", () => dlg.close());
    onBackdrop(dlg, () => dlg.close());
    dlg.addEventListener("close", () => {
      setUrl(0);
      const card = document.querySelector(`#doors [data-k="door-${state.selected}"]`);
      if (card) card.focus();
    });
    /* The note's button opens today's door; once the countdown runs out with the note still open, the note says
       "Door n is open!" and the button opens that door instead. */
    let nestorDoor = 0, nestorOpen = false, goDoor = 0;
    function fillNestor(n) {
      nestorOpen = !isLocked(n);
      el("nestorbody").replaceChildren(...A.nestorNote(data, n, today, "h2", { head: "nestorttl", text: "nestortext" }));
      const t = today >= 1 ? Math.min(today, total()) : 0, go = el("nestortoday");
      goDoor = nestorOpen ? n : t;
      go.hidden = !goDoor || (!nestorOpen && dlg.open && state.selected === t);
      go.textContent = nestorOpen ? `Open door ${n}` : `Open today’s door (${t})`;
    }
    function showNestor(n) {
      nestorDoor = n; el("nestorlive").textContent = "";
      fillNestor(n);
      ndlg.showModal(); A.startTicker();
      (el("nestortoday").hidden ? el("nestorclose") : el("nestortoday")).focus();
    }
    function refreshNestor() {
      const was = nestorOpen;
      fillNestor(nestorDoor);
      const go = el("nestortoday");
      if (nestorOpen && !was) { el("nestorlive").textContent = `Door ${nestorDoor} is open.`; go.focus(); }
      else if (!ndlg.contains(document.activeElement) || document.activeElement.hidden) (go.hidden ? el("nestorclose") : go).focus();
    }
    el("nestortoday").addEventListener("click", () => { ndlg.close(); if (goDoor >= 1) select(goDoor, "now"); });
    el("nestorclose").addEventListener("click", () => ndlg.close());
    ndlg.addEventListener("close", () => { nestorDoor = 0; });
    onBackdrop(ndlg, () => ndlg.close());

    function stats() {
      const days = DAYS.filter((d) => d.day <= total());
      let score = 0, opened = 0, top = 0;
      days.forEach((d) => {
        if (state.opened[d.day]) { opened++; score += 10; top = d.day; }
        if (correct(d.day)) { score += 20; if (state.team && d.for.includes(state.team)) score += 10; }
        for (let i = 0; i < 4; i++) if (state.acts[d.day + "-" + i]) score += 5;
      });
      let streak = 0;
      for (let n = top; n >= 1 && state.opened[n]; n--) streak++;
      const base = total() * 50; // open 10 + correct 20 + four activities × 5
      let ri = 0;
      data.ranks.forEach((r, i) => { if (score >= Math.ceil(r.share * base)) ri = i; });
      return { days, score, opened, streak, base, ri };
    }

    /* Day counter under the title: a countdown before 1 December, "Day N of 24/31" during the season,
       and one segment per door, filled up to today. */
    function renderDayCount() {
      const n = total(), dc = el("daycount");
      if (!dc) return;
      let num, text, filled;
      let next = 0; // the door the live countdown counts down to
      if (preview) { num = `All ${n} doors open`; text = "Test mode preview: every door is unlocked"; filled = n; }
      else if (today < 1) {
        const left = A.daysUntil(data, 1);
        num = left <= 0 ? "Opens tonight" : `${left} ${left === 1 ? "day" : "days"} to go`; text = `Door 1 opens on ${A.opensLabel(data, 1)}`; filled = 0; next = 1;
      } else if (today <= n) { num = `Day ${today} of ${n}`; text = today === n ? "The last door is open" : A.nextOpensText(data, today + 1); filled = today; next = today < n ? today + 1 : 0; }
      else { num = `All ${n} doors open`; text = "Catch up on any you missed"; filled = n; }
      el("dcnum").textContent = num;
      el("dctext").textContent = text;
      const tk = el("dctick");
      tk.replaceChildren(...(next ? [svg("M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"), next === 1 && today < 1 ? "Door 1 opens in " : `Door ${next} opens in `,
        h("strong", { "data-cd": String(A.opensAt(data, next).getTime()), text: A.fmtLeft(A.opensAt(data, next) - A.now()) })] : []));
      tk.hidden = !next;
      const bar = el("dcbar"); bar.replaceChildren();
      bar.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
      for (let i = 1; i <= n; i++) bar.append(h("span", { class: i <= filled ? (i === filled && !preview && today >= 1 && today <= n ? "on now" : "on") : "" }));
    }

    function renderTop(s) {
      renderDayCount();
      document.querySelectorAll("#mode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode)));
      el("eyebrow").textContent = state.mode === "advent" ? `ADVENT CALENDAR · 1–24 DECEMBER ${data.year} · CYBERSECURITY & AI` : `31 DAYS · 1–31 DECEMBER ${data.year} · CYBERSECURITY & AI`;
      el("ics").setAttribute("href", state.mode === "advent" ? "advent-24.ics" : "days-31.ics");
    }

    function renderHUD(s) {
      el("score").textContent = String(s.score);
      el("opened").textContent = String(s.opened);
      el("total").textContent = String(total());
      el("streak").textContent = String(s.streak);
      el("streakunit").textContent = s.streak === 1 ? "day" : "days";
      const rank = data.ranks[s.ri], next = data.ranks[s.ri + 1];
      const lo = Math.ceil(rank.share * s.base), hi = next ? Math.ceil(next.share * s.base) : s.base;
      el("rank").textContent = rank.name;
      el("rankbar").style.width = (next ? Math.max(4, Math.round(((s.score - lo) / (hi - lo)) * 100)) : 100) + "%";
      el("rankline").textContent = next ? `${hi - s.score} pts to ${next.name}` : "Top rank reached";
      const list = el("badges"); list.replaceChildren();
      let got = 0;
      data.badges.forEach((b) => {
        let ok = false;
        if (b.first) ok = s.opened > 0; else if (b.days) ok = b.days.every(correct); else if (b.streak) ok = s.streak >= b.streak; else if (b.all) ok = s.opened === total();
        if (ok) got++;
        list.append(h("li", { class: "badge" + (ok ? " got" : ""), title: b.hint }, svg(P.badge), b.name, h("span", { class: "sr", text: ok ? " (earned)" : " (not yet earned)" })));
      });
      el("badgecount").textContent = String(got);
      renderSanta();
      const team = el("team");
      if (!team.options.length) {
        team.append(h("option", { value: "", text: "Choose your role" }));
        Object.keys(STK).filter((id) => id !== "everyone").forEach((id) => team.append(h("option", { value: id, text: STK[id] })));
        team.addEventListener("change", () => { if (team.value === "" || Object.prototype.hasOwnProperty.call(STK, team.value)) { state.team = team.value; persist(); render(); } });
      }
      team.value = state.team;
      // Say what the role does: a "For your role" line on its doors, and +10 on a correct answer there. The lessons are the same for everyone.
      const tagged = state.team ? DAYS.filter((d) => d.day <= total() && d.for.includes(state.team)).length : 0;
      el("teamhint").textContent = state.team ? `${tagged} door${tagged === 1 ? "" : "s"} for you · +10 bonus each` : "Pick a role for tips and a +10 bonus";
    }

    // The "For your role" line under DO / DON'T, when the visitor's role is one of the door's roles.
    function roleNote(d) {
      const role = state.team;
      if (!role || !d.for.includes(role)) return null;
      const text = (d.roleNotes && d.roleNotes[role]) || `This door is written for ${STK[role]}.`;
      return h("div", { class: "role-note" }, h("span", { class: "lbl", text: `FOR YOUR ROLE · ${STK[role].toUpperCase()}` }), h("p", { text }));
    }

    function renderSanta() {
      const box = el("santa"); box.replaceChildren();
      const st = A.santaState(data, total(), state.answers, state.acts);
      const [verdict, tone] = st.verdict;
      box.append(
        h("div", { class: "shead2" }, h("span", { class: "stitle", text: "Santa’s list" }), h("span", { class: "verdict " + tone, text: verdict })),
        h("div", { class: "scol" }, h("span", { class: "sk nice", text: `NICE LIST · ${st.nice.length}` }),
          st.nice.slice(-4).reverse().map((e) => h("span", { class: "entry nice" }, h("b", { "aria-hidden": "true", text: "✓" }), e.t)),
          st.nice.length > 4 ? h("span", { class: "more", text: `+ ${st.nice.length - 4} more good ${st.nice.length - 4 === 1 ? "deed" : "deeds"}` }) : null,
          st.nice.length ? null : h("span", { class: "empty", text: "Nothing yet. Answer a challenge correctly or tick off all four activities on a door." })),
        h("div", { class: "scol" }, h("span", { class: "sk naughty", text: `NAUGHTY LIST · ${st.naughty.length} · KEPT BY CLINKER` }),
          st.naughty.slice(-3).reverse().map((e) => h("button", { type: "button", class: "entry naughty", "data-k": "naughty-" + e.n, onclick: () => select(e.n, true) }, h("b", { "aria-hidden": "true", text: "✗" }), h("span", {}, e.t + " ", h("span", { class: "redeem", text: "Redeem →" })))),
          st.naughty.length ? null : h("span", { class: "empty", text: "Empty. Clinker is sulking." })),
        h("p", { class: "how", text: "A correct answer, or all four activities on a door, puts you on the Nice list. A wrong answer goes on the Naughty list until you redeem it by ticking off all four of that door’s activities." }));
    }

    function renderChips(s) {
      const row = el("chips"); row.replaceChildren();
      [{ id: "all", name: "All", count: total() }].concat(Object.keys(STK).map((id) => ({ id, name: STK[id], count: s.days.filter((d) => d.for.includes(id)).length })))
        .filter((c) => c.count > 0)
        .forEach((c) => row.append(h("button", { type: "button", class: "chip", "aria-pressed": String(state.filter === c.id), "data-k": "chip-" + c.id, onclick: () => { state.filter = c.id; render(); } }, c.name, h("small", { text: String(c.count) }))));
    }

    /* Door cards on the calendar wall: double-leaf doors in a winter palette. Opening swings both
       leaves apart onto the explored card (title, who it is for, points and status). */
    const PAL = ["cream", "brick", "sage", "tan", "pine", "cream", "green", "sage", "brick", "cream", "pine", "tan"];
    const LOCK = "M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3";
    function bow() {
      return A.art("0 0 40 24", [["path", { d: "M20 12L4 3Q0 2 1 7L3 18Q4 21 8 19Z M20 12L36 3Q40 2 39 7L37 18Q36 21 32 19Z", fill: "#B3202F" }], ["circle", { cx: 20, cy: 12, r: 4.5, fill: "#8E1622" }], ["path", { d: "M18 15L13 24M22 15L27 24", stroke: "#B3202F", "stroke-width": 3, "stroke-linecap": "round" }]], "bw");
    }
    /* A closed door shows only its number and a status icon: a lock until its day, a gift once it can be opened.
       The title and topic appear only after opening (on the card behind the leaves and in the popup). */
    function face(n, locked, big) {
      return h("span", { class: "face" },
        h("span", { class: "pl" }), h("span", { class: "pr" }), h("span", { class: "seam" }), h("span", { class: "kn" }), h("span", { class: "stt", text: "✦" }),
        big ? bow() : null,
        h("span", { class: "mo", text: "DECEMBER" }), h("span", { class: "nu", text: pad(n) }),
        locked ? svg(LOCK, "ic st-lock") : svg(P.gift, "ic st-gift"),
        h("span", { class: "fs", text: locked ? "LOCKED" : "OPEN ME" }));
    }
    function renderDoors() {
      const grid = el("doors"); grid.replaceChildren();
      grid.className = "cards" + (state.mode === "advent" ? " m-advent" : "");
      const big = data.modes[state.mode].big;
      DAYS.filter((d) => d.day <= total()).forEach((d) => {
        const n = d.day, open = !!state.opened[n], locked = isLocked(n), isBig = big.includes(n);
        const acts = [0, 1, 2, 3].filter((i) => state.acts[n + "-" + i]).length;
        const pts = (open ? 10 : 0) + (correct(n) ? 20 : 0) + acts * 5, done = pts >= 50;
        const isToday = !locked && !preview && n === Math.min(today, total()) && today <= total();
        const cls = ["card", "p-" + PAL[(n - 1) % PAL.length], open && "open", done && "done", n === state.selected && "sel", locked && "locked", isToday && !open && "today", state.filter !== "all" && !d.for.includes(state.filter) && "dim"].filter(Boolean).join(" ");
        const name = locked ? `Door ${n}, locked until ${A.opensLabel(data, n)}` : open ? `Door ${n}: ${d.title}, opened${d.track !== "cyber" ? ", includes an AI lesson" : ""}` : `Door ${n}${isToday ? ", today’s door" : ""}, not opened yet`;
        grid.append(h("button", { type: "button", class: cls, "aria-pressed": String(n === state.selected), "data-k": "door-" + n,
          "aria-label": name, "aria-haspopup": "dialog", onclick: () => select(n, true) },
          h("span", { class: "inside", "aria-hidden": "true" },
            done ? h("span", { class: "tick", text: "✓" }) : null, wrong(n) ? h("span", { class: "ntag", text: "NAUGHTY" }) : null,
            h("span", { class: "sp", text: "✦" }), h("span", { class: "it", text: d.title }),
            h("span", { class: "if", text: d.for.slice(0, 2).map((id) => STK[id]).join(" · ") }),
            h("span", { class: "is", text: done ? "50 pts · fully explored ✓" : `${pts} of 50 pts · Play the day →` })),
          h("span", { class: "leaf l", "aria-hidden": "true" }, face(n, locked, isBig)),
          h("span", { class: "leaf r", "aria-hidden": "true" }, face(n, locked, isBig))));
      });
      if (total() === 31) grid.append(h("div", { class: "spare", "aria-hidden": "true" }, h("span", { class: "a", text: "✦" }), h("span", { class: "b", text: "Merry, safe & secure" }), h("span", { class: "c", text: "2027 AWAITS" })));
      el("boardsub").textContent = `Cyber & AI · ${total()} days of cyber, AI & privacy hygiene`;
      el("locknote").textContent = preview ? "Test mode preview: every door is open."
        : today < 1 ? "Doors open one a day from 1 December. Each locked door tells you when."
          : today > total() ? `All ${total()} doors are open - catch up on any you missed.` : `Today is door ${today}. Tap it to open; later doors stay locked until their day.`;
    }

    /* The Naughty list Clinker keeps in the attic: doors answered wrongly and not yet redeemed. */
    function renderScroll() {
      const box = el("scroll"); box.replaceChildren();
      const naughty = A.santaState(data, total(), state.answers, state.acts).naughty;
      box.append(h("span", { class: "st", text: "NAUGHTY LIST" }), h("span", { class: "sh", text: naughty.length ? "DOORS TO REDEEM" : "CLINKER IS WATCHING FOR" }));
      if (naughty.length) naughty.slice(-3).reverse().forEach((e) => box.append(h("button", { type: "button", class: "si", "data-k": "scroll-" + e.n, onclick: () => select(e.n, true) }, h("b", { "aria-hidden": "true", text: "✗ " }), DAYS[e.n - 1].title)));
      else ["Password reuse", "Oversharing", "Blind AI trust"].forEach((t) => box.append(h("span", { class: "si", text: "☐ " + t })));
    }

    function renderMap() {
      const d = DAYS[state.selected - 1];
      const active = new Set(d.cases.map((c) => c.pin).filter(Boolean));
      const doorsAt = {};
      DAYS.filter((x) => x.day <= total()).forEach((x) => x.cases.forEach((c) => { if (c.pin && data.pins[c.pin]) { (doorsAt[c.pin] = doorsAt[c.pin] || new Set()).add(x.day); } }));
      const map = el("map");
      map.querySelectorAll(".pin").forEach((p) => p.remove());
      const places = el("places"); places.replaceChildren();
      Object.keys(data.pins).filter((id) => doorsAt[id]).forEach((id) => {
        const p = data.pins[id], on = active.has(id), list = [...doorsAt[id]].sort((a, b) => a - b);
        const pin = h("span", { class: "pin" + (on ? " on" : ""), "aria-hidden": "true" }, h("span", { class: "ring" }), h("span", { class: "dot" }), h("span", { class: "lbl", text: p.short }));
        pin.style.left = Number(p.left) + "%"; pin.style.top = Number(p.top) + "%";
        map.append(pin);
        places.append(h("button", { type: "button", class: "place" + (on ? " on" : ""), "data-k": "place-" + id, onclick: () => { const nxt = list.find((n) => n > state.selected && !isLocked(n)) || list.find((n) => !isLocked(n)); if (nxt) select(nxt, true); } },
          h("span", { class: "n", text: p.name }), h("span", { class: "d", text: (list.length > 1 ? "Doors " : "Door ") + list.join(" · ") })));
      });
    }

    function quiz(n, d) {
      const answered = state.answers[n] !== undefined, chosen = state.answers[n], ok = answered && chosen === d.quiz.answer;
      const box = h("div", { class: "quiz" + (answered && !ok && state.celebrate ? " shake" : "") },
        h("div", { class: "qhead" }, h("strong", { text: "CHALLENGE" }), h("span", { text: "+20 PTS" })),
        h("p", { class: "q", text: d.quiz.question }));
      const opts = h("div", { class: "opts", role: "group", "aria-label": "Answers" });
      d.quiz.options.forEach((text, i) => {
        const right = i === d.quiz.answer, mine = answered && i === chosen;
        const cls = ["opt", answered && right && "right", mine && !right && "mine", answered && !right && !mine && "faded"].filter(Boolean).join(" ");
        opts.append(h("button", { type: "button", class: cls, disabled: answered, "data-k": "opt-" + i, onclick: () => { if (state.answers[n] !== undefined) return; state.answers[n] = i; state.opened[n] = 1; state.celebrate = true; persist(); render(); } },
          h("span", { class: "letter", "aria-hidden": "true", text: "ABC"[i] }), h("span", { class: "txt", text }),
          answered && right ? svg(P.check, null, "Correct answer") : null, mine && !right ? svg(P.x, null, "Your answer") : null));
      });
      box.append(opts);
      if (ok && state.celebrate && !A.reducedMotion()) {
        const c = h("div", { class: "confetti", "aria-hidden": "true" });
        const cols = ["#F5C451", "#FF6B6B", "#9EE6C4", "#F8F3E9"], anims = ["confA", "confB", "confC", "confD"];
        for (let i = 0; i < 20; i++) {
          const piece = document.createElement("i");
          piece.style.width = (i % 3 ? 8 : 6) + "px"; piece.style.height = (i % 2 ? 12 : 8) + "px";
          piece.style.borderRadius = i % 4 === 0 ? "99px" : "2px"; piece.style.background = cols[i % 4];
          piece.style.animationName = anims[i % 4]; piece.style.animationDuration = (1.1 + (i % 5) * 0.12).toFixed(2) + "s"; piece.style.animationDelay = (i * 0.025).toFixed(3) + "s";
          c.append(piece);
        }
        c.append(h("span", { class: "plus", text: "+20" }));
        box.append(c);
      }
      if (answered) {
        const bonus = ok && state.team && d.for.includes(state.team);
        box.append(h("div", { class: "explain" },
          ok ? null : A.clinker(n + chosen, A.santaState(data, total(), state.answers, state.acts).status(n).line),
          h("p", { class: "res" + (ok ? " ok" : ""), tabindex: "-1", "data-k": "res", text: ok ? `Correct · +20 pts${bonus ? " · +10 role bonus" : ""}` : "Not quite - the safe move is marked. Here’s why, in the words that suit you." }),
          h("div", { class: "bar2" }, h("span", { class: "k", text: ok ? "WHY IT MATTERS" : "HERE’S WHY" }),
            h("div", { class: "aud", role: "group", "aria-label": "Explain it for" }, AUD.map(([id, name]) => h("button", { type: "button", "aria-pressed": String(state.aud === id), "data-k": "aud-" + id, onclick: () => { state.aud = id; state.celebrate = false; persist(); render(); } }, name)))),
          h("p", { class: "txt", text: d.explain[state.aud] || d.explain.simple }),
          h("div", { class: "further" }, h("span", { class: "k", text: "FURTHER READING" }), d.readMore.slice(0, 2).map((m) => A.extLink(m.url, null, `${m.org} - ${m.ref} ↗`)))));
      }
      return box;
    }

    function renderPanel() {
      const p = el("panel"); p.replaceChildren();
      const n = state.selected, d = DAYS[n - 1];
      if (isLocked(n)) {
        p.append(h("div", { class: "locked-msg nestor-inline" }, ...A.nestorNote(data, n, today, "h2", { head: "daytitle", text: null })));
        return;
      }
      const dt = new Date(data.year, data.month - 1, n), occ = data.occasions[n], isAI = d.track !== "cyber";
      const c0 = d.cases[0], qs = A.quotesFor(data, d);
      p.append(
        h("div", { class: "head" },
          h("div", { class: "ornament o" + (n % 4), "aria-hidden": "true" }, h("span", { class: "string" }), h("span", { class: "cap" }), h("span", { class: "ball" }, svg(data.icons[d.icon] || P.star)), h("span", { class: "shine" })),
          h("div", { class: "stack" },
            h("div", { class: "meta" }, h("span", { text: `${WD[dt.getDay()].toUpperCase()} ${n} DECEMBER${occ ? " · " + occ.toUpperCase() : ""}` })),
            h("h2", { id: "daytitle", tabindex: "-1", text: d.title }),
            h("div", { class: "labels" }, h("span", { class: "track" + (isAI ? " ai" : "") }, isAI ? svg(P.star) : null, TRACK[d.track]), h("span", { class: "topic", text: d.topic })),
            h("div", { class: "for" }, h("span", { class: "k", text: "FOR" }), d.for.map((id) => h("span", { class: "who" + (id === state.team ? " me" : ""), text: STK[id] }))))),
        h("div", { class: "stack" },
          h("div", { class: "dd" }, h("span", { class: "dot", "aria-hidden": "true" }, svg(P.check)), h("div", {}, h("span", { class: "lbl", text: "NICE LIST · DO" }), h("p", { text: d.do }))),
          h("div", { class: "dd dont" }, h("span", { class: "dot", "aria-hidden": "true" }, svg(P.x)), h("div", {}, h("span", { class: "lbl", text: "NAUGHTY LIST · DON’T" }), h("p", { text: d.dont }))))
      );
      const rn = roleNote(d);
      if (rn) p.append(rn);
      if (gamified) p.append(quiz(n, d));
      p.append(A.activitiesBlock({ data, n, d, acts: state.acts, gamified, P, note: gamified ? A.santaState(data, total(), state.answers, state.acts).status(n).note : null,
        onToggle: (i, on) => { const k = n + "-" + i; if (on) state.acts[k] = 1; else delete state.acts[k]; state.opened[n] = 1; state.celebrate = false; persist(); render(); } }));
      p.append(
        h("article", { class: "case headline" },
          h("div", { class: "cmeta" }, h("span", { class: "kind " + String(c0.kind).replace(/[^A-Za-z]/g, ""), text: "LESSON LEARNT" }), h("span", { text: c0.when }), h("span", { class: "loc" }, svg(P.pin), c0.location)),
          h("h4", { text: c0.name }), h("p", { class: "clamp", text: c0.text })),
        h("a", { class: "brief-cta", href: briefHref(n) },
          h("span", { class: "bt" }, h("strong", { text: "Open the full briefing" }),
            h("span", { text: `${plural(qs.length, "rule excerpt", "rule excerpts")} · ${plural(d.cases.length, "case study", "case studies")} · incident lab · share kit` })),
          h("span", { class: "arr", "aria-hidden": "true", text: "→" })),
        h("div", { class: "nav" },
          h("button", { type: "button", class: "sq", "aria-label": "Previous door", "data-k": "prev", disabled: n <= 1, onclick: () => select(n - 1) }, svg(P.left)),
          h("button", { type: "button", class: "sq", "aria-label": isLocked(n + 1) ? `Next door (opens ${A.inDays(A.daysUntil(data, n + 1))})` : "Next door", "data-k": "next", disabled: n >= total(), onclick: () => select(n + 1) }, svg(P.right)),
          h("span", { class: "grow" }),
          h("a", { class: "share", href: `invites/door-${pad(n)}.ics`, type: "text/calendar", "aria-label": `Add door ${n} to your calendar (.ics file)`, text: "Add to calendar" }),
          h("a", { class: "share", href: briefHref(n) + "#share", text: "Share kit for 5 channels" }),
          h("button", { type: "button", class: "back-up", onclick: () => dlg.close() }, "Close")));
      el("daylabel").textContent = `DOOR ${pad(n)} OF ${total()}`;
    }

    /* After an answer the options are disabled, so focus moves to the result; at either end of the
       calendar the disabled arrow hands focus to the other one. */
    const FOCUS_FALLBACK = (k) => (k.startsWith("opt-") ? "res" : k === "next" ? "prev" : k === "prev" ? "next" : null);
    function render() {
      const focused = A.focusKey();
      if (state.selected > total()) state.selected = total();
      const s = stats();
      renderTop(s);
      if (gamified) renderHUD(s);
      renderChips(s);
      renderDoors();
      renderScroll();
      renderMap();
      renderPanel();
      A.refocus(focused, FOCUS_FALLBACK);
    }

    /* Keep several open tabs in step: progress saved in one tab is picked up by the others, instead of
       the next save in a stale tab silently overwriting it. */
    window.addEventListener("storage", (e) => {
      if (e.key !== null && e.key !== KEY) return;
      const fresh = sanitize(store.get(KEY), data);
      Object.assign(state, { opened: fresh.opened, answers: fresh.answers, acts: fresh.acts, team: fresh.team, aud: fresh.aud, celebrate: false });
      if (fresh.country) state.country = fresh.country;
      render();
    });

    document.querySelectorAll("#mode button").forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.mode !== "advent" && b.dataset.mode !== "full") return;
      state.mode = state.pick = b.dataset.mode; state.celebrate = false; persist(); setUrl(0); render();
    }));
    /* Resetting erases points, answers and Santa's list, so it asks first. "Keep my progress" has the focus,
       Escape or a click outside keeps everything, and only "Yes, reset" erases. */
    const reset = el("reset"), rdlg = el("resetdlg");
    const doReset = () => {
      state.opened = {}; state.answers = {}; state.acts = {}; state.celebrate = false;
      state.selected = Math.min(Math.max(today, 1), total());
      persist(); render();
    };
    reset.addEventListener("click", () => {
      if (typeof rdlg.showModal === "function") { rdlg.showModal(); el("resetno").focus(); return; }
      if (window.confirm("Reset your progress? This erases your points, answers, activities and Santa’s list on this device.")) doReset();
    });
    el("resetno").addEventListener("click", () => rdlg.close("keep"));
    el("resetyes").addEventListener("click", () => { rdlg.close("reset"); doReset(); reset.focus(); });
    onBackdrop(rdlg, () => rdlg.close("keep"));
    rdlg.addEventListener("close", () => { if (rdlg.returnValue !== "reset") reset.focus(); });
    /* 24-26 December: a once-a-year note from the NESTOR family (copy in days.json "holiday"), shown once per
       browser. In test mode it shows every time, so the date simulator can bring it up again. */
    const xdlg = el("xmasdlg"), HOLIDAY_KEY = "cyber-advent:holiday-" + data.year;
    let xmasDoor = 0;
    function maybeHoliday() {
      const t = A.now(), hd = data.holiday;
      if (!hd || !Array.isArray(hd.tips) || t.getFullYear() !== data.year || t.getMonth() !== data.month - 1 || t.getDate() < 24 || t.getDate() > 26) return;
      if (dlg.open || ndlg.open || rdlg.open || xdlg.open) return;
      if (!testMode && store.get(HOLIDAY_KEY) === 1) return;
      store.set(HOLIDAY_KEY, 1);
      const left = total() - Math.min(today, total());
      const outro = left > 0 ? String(hd.outroMore).replace("{left}", `${left} more ${left === 1 ? "door" : "doors"}`) : hd.outroLast;
      el("xmasbody").replaceChildren(
        h("img", { class: "nestor-img", src: "img/nestor-family.webp", width: "760", height: "714", alt: "" }),
        h("p", { class: "nestor-eyebrow", text: `${t.getDate()} DECEMBER · ${hd.eyebrow}` }),
        h("h2", { id: "xmasttl", class: "nestor-h", tabindex: "-1", text: hd.title }),
        h("p", { id: "xmasintro", class: "nestor-t", text: hd.intro }),
        h("ul", { class: "xmas-tips" }, hd.tips.map((tp) => h("li", {}, svg(data.icons[tp.icon] || P.star, "ic"),
          h("div", {}, h("span", { class: "lbl", text: tp.label }), h("p", { text: tp.text }))))),
        h("p", { class: "xmas-outro", text: outro }),
        h("p", { class: "xmas-sign" }, hd.sign, h("span", { class: "xmas-from", text: hd.from })),
        h("p", { class: "xmas-ps", text: hd.ps }));
      xmasDoor = today >= 1 ? Math.min(today, total()) : 0;
      const go = el("xmasgo");
      go.hidden = !xmasDoor; go.textContent = `Open door ${xmasDoor}`;
      xdlg.showModal(); xdlg.scrollTop = 0;
      el("xmasttl").focus({ preventScroll: true });
    }
    el("xmasgo").addEventListener("click", () => { xdlg.close(); if (xmasDoor) select(xmasDoor, "now"); });
    el("xmasclose").addEventListener("click", () => xdlg.close());
    onBackdrop(xdlg, () => xdlg.close());

    /* A page left open moves on by itself: when a countdown reaches zero or the date changes, the new door
       unlocks, the counter moves on and an open Nestor note turns into "Door n is open!", without a reload.
       The selected door stays as it is. */
    function moveOn(newDay) {
      const t = A.todayFor(data), changed = t !== today;
      today = t;
      if (changed || newDay) render();
      if (ndlg.open && nestorDoor) refreshNestor();
      if (newDay) maybeHoliday();
    }
    A.onNewDay(() => moveOn(true), data);
    document.addEventListener("advent:countdown-end", () => moveOn(false));
    const tb = A.testBar(data, settings);
    if (tb) document.body.append(tb);
    render();
    A.startTicker();
    /* A link to a door (reminders, invites, shared links) opens it straight away, or the Nestor note if it isn't open yet. */
    if (openOnLoad) select(openOnLoad, "now");
    else if (lockedOnLoad) showNestor(lockedOnLoad);
    else maybeHoliday();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", main); else main();
})();
