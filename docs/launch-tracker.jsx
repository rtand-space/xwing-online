import React, { useState, useEffect, useMemo, useRef } from "react";

/* ------------------------------------------------------------------ *
 *  LAUNCH TRACKER
 *  Two projects, one shared track: web MVP -> App Store launch.
 *  State persists via window.storage so progress survives reloads.
 * ------------------------------------------------------------------ */

const STORAGE_KEY = "launch-tracker:v7";

// Project Two still targets the App Store, so it keeps the full journey.
// (Project One diverges below into a web-only fan project.)
const APP_STORE_PHASES = [
  {
    label: "Concept & Validation",
    blurb: "Prove the idea is worth building before you write code.",
    tasks: [
      "Write the one-sentence problem statement",
      "Define the target user",
      "List the top 3 competitors",
      "Name the riskiest assumption",
      "Talk to 5 potential users",
    ],
  },
  {
    label: "Web MVP",
    blurb: "The smallest thing that delivers the core value in a browser.",
    tasks: [
      "Lock the core feature set — cut everything non-essential",
      "Choose the tech stack",
      "Map the main user flow",
      "Build the MVP",
      "Add analytics",
    ],
  },
  {
    label: "Web Launch",
    blurb: "Get it in front of real people and start the feedback loop.",
    tasks: [
      "Set up hosting & domain",
      "Add accounts / auth if needed",
      "Write the landing page",
      "Soft-launch to first users",
      "Collect feedback & iterate",
    ],
  },
  {
    label: "App Store Prep",
    blurb: "Turn the web product into something Apple will accept.",
    tasks: [
      "Decide native vs. wrapper (React Native / Capacitor)",
      "Enroll in the Apple Developer Program ($99/yr)",
      "Produce the mobile build",
      "Prepare screenshots & app preview",
      "Write the listing & privacy policy",
    ],
  },
  {
    label: "App Store Launch",
    blurb: "Ship it, then keep it alive.",
    tasks: [
      "Check against App Store Review guidelines",
      "Submit for review",
      "Plan the launch announcement",
      "Monitor crashes & reviews",
      "Ship the first update",
    ],
  },
];

let _id = 0;
const uid = () => `t${Date.now().toString(36)}${(_id++).toString(36)}`;

// Project One: a free, web-only X-Wing fan project. No App Store — the back
// half is about community and longevity instead of store submission.
const XWING_PHASES = [
  {
    label: "Concept & Validation",
    blurb: "Settle what it is and who it's for.",
    tasks: [
      { text: "Write the problem statement — hard to find local opponents", done: true },
      { text: "Define the target user — X-Wing players without a local scene", done: true },
      { text: "Set the IP approach — free, non-commercial fan project", done: true },
      { text: "Study Fly Casual, Vassal & Tabletop Simulator for what to match or beat", done: true },
      { text: "Confirm the core loop: secret maneuver dial → reveal → resolve", done: true },
      { text: "Lock the points standard — XWA (2.5 loadout) first, Legacy maybe later", done: true },
    ],
  },
  {
    label: "Web MVP",
    blurb: "The smallest playable dogfight in a browser.",
    tasks: [
      { text: "Lock MVP scope: 1v1, two or three ships each, move + attack only", done: true },
      { text: "Choose the stack — server-authoritative game state over websockets", done: true },
      { text: "Record games as a deterministic event log — the foundation for replays", done: true },
      { text: "Model the round: planning → activation by initiative → engagement → end", done: true },
      { text: "Design win conditions so 2.5 scenario play can slot in after the dogfight MVP", done: true },
      { text: "Build the board, maneuver dial & template movement", done: true },
      { text: "Build the data layer on xwing-data2 + the XWS squad format", done: true },
      { text: "Pull XWA community points dynamically — versioned & cached", done: true },
      { text: "Design mobile-first controls — thumb-reachable dial, drag-to-place templates", done: true },
      { text: "Implement attack/defense dice, range and damage", done: true },
      { text: "Add hidden simultaneous dial submission, then reveal", done: true },
      { text: "Get a hot-seat prototype working before networking", done: true },
    ],
  },
  {
    label: "Web Launch",
    blurb: "Put it online and start the feedback loop.",
    tasks: [
      { text: "Add online play with invite codes — join a game by code or link", done: true },
      { text: "Persist game state so turns can be taken asynchronously", done: true },
      { text: "Add an account system — guest play first, then sign-in to save squads & history", done: true },
      { text: "Build the squad builder & ship roster", done: true },
      { text: "Support squad import/export via XWS (interop with YASB & Launch Bay Next)", done: true },
      { text: "Set up websocket-capable hosting", done: true },
      { text: 'Add the "fan project, not endorsed — buy the real models" disclaimer', done: true },
      { text: "Soft-launch to the X-Wing community", done: false },
    ],
  },
  {
    label: "Community & Growth",
    blurb: "Solve the real problem — help players find each other.",
    tasks: [
      { text: "Add matchmaking or an open challenge board (the core problem)", done: false },
      { text: 'Send "your turn" notifications so async games keep moving', done: true },
      { text: "Set up a Discord or community hub", done: false },
      { text: "Add player profiles & a simple ladder or ranking", done: false },
      { text: "Build the replay viewer — scrub, step through & share past games", done: false },
      { text: "Recruit a few regulars to seed active games", done: false },
    ],
  },
  {
    label: "Sustain & Open-Source",
    blurb: "Keep it alive — and resilient if the license holder ever calls.",
    tasks: [
      { text: "Open-source the code so the community can keep it going", done: false },
      { text: "Document how to self-host & contribute", done: false },
      { text: "Track official points/rules updates to stay current", done: false },
      { text: "Cover hosting costs without charging (donations)", done: false },
      { text: "Plan a graceful response if asked to take it down", done: false },
    ],
  },
];

function buildProject(name, oneLiner, phaseDefs) {
  return {
    id: uid(),
    name,
    oneLiner,
    phases: phaseDefs.map((p) => ({
      label: p.label,
      blurb: p.blurb,
      tasks: p.tasks.map((t) =>
        typeof t === "string"
          ? { id: uid(), text: t, done: false }
          : { id: uid(), text: t.text, done: !!t.done }
      ),
    })),
  };
}

function defaultState() {
  const a = buildProject(
    "X-Wing Online",
    "Turn-based, browser-based X-Wing — play remote opponents when there's no local scene.",
    XWING_PHASES
  );
  const b = buildProject("Project Two", "The newer idea — tap to describe it.", APP_STORE_PHASES);
  return { projects: [a, b], activeId: a.id };
}

/* ---------- progress helpers ---------- */
function phaseStats(phase) {
  const total = phase.tasks.length;
  const done = phase.tasks.filter((t) => t.done).length;
  return { total, done, complete: total > 0 && done === total };
}
function projectStats(project) {
  let total = 0,
    done = 0;
  project.phases.forEach((ph) => {
    total += ph.tasks.length;
    done += ph.tasks.filter((t) => t.done).length;
  });
  // current phase = first incomplete phase, else the last one
  let current = project.phases.findIndex((ph) => !phaseStats(ph).complete);
  if (current === -1) current = project.phases.length - 1;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, pct, current };
}

/* ================================================================== */

export default function LaunchTracker() {
  const [state, setState] = useState(null); // null = loading
  const [openPhase, setOpenPhase] = useState(0);
  const [saveErr, setSaveErr] = useState(false);
  const firstLoad = useRef(true);

  // Load once on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY);
        setState(res && res.value ? JSON.parse(res.value) : defaultState());
      } catch {
        setState(defaultState()); // nothing saved yet
      }
    })();
  }, []);

  // Persist on change (skip the initial hydration)
  useEffect(() => {
    if (state === null) return;
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    (async () => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify(state));
        setSaveErr(false);
      } catch {
        setSaveErr(true);
      }
    })();
  }, [state]);

  const active = useMemo(
    () => state?.projects.find((p) => p.id === state.activeId) ?? state?.projects[0],
    [state]
  );

  /* ---------- mutations ---------- */
  const mutateProject = (pid, fn) =>
    setState((s) => ({
      ...s,
      projects: s.projects.map((p) => (p.id === pid ? fn(structuredClone(p)) : p)),
    }));

  const toggleTask = (pid, phaseIdx, taskId) =>
    mutateProject(pid, (p) => {
      const t = p.phases[phaseIdx].tasks.find((x) => x.id === taskId);
      if (t) t.done = !t.done;
      return p;
    });

  const addTask = (pid, phaseIdx, text) =>
    mutateProject(pid, (p) => {
      p.phases[phaseIdx].tasks.push({ id: uid(), text, done: false });
      return p;
    });

  const editTask = (pid, phaseIdx, taskId, text) =>
    mutateProject(pid, (p) => {
      const t = p.phases[phaseIdx].tasks.find((x) => x.id === taskId);
      if (t) t.text = text;
      return p;
    });

  const removeTask = (pid, phaseIdx, taskId) =>
    mutateProject(pid, (p) => {
      p.phases[phaseIdx].tasks = p.phases[phaseIdx].tasks.filter((x) => x.id !== taskId);
      return p;
    });

  const editMeta = (pid, field, value) =>
    mutateProject(pid, (p) => {
      p[field] = value;
      return p;
    });

  const resetAll = () => {
    if (window.confirm("Reset both projects to the starting template? This clears your changes.")) {
      const d = defaultState();
      setState(d);
      setOpenPhase(0);
    }
  };

  /* ---------- loading ---------- */
  if (!state || !active) {
    return (
      <div style={S.shell}>
        <Style />
        <div style={S.loading}>Loading your track…</div>
      </div>
    );
  }

  const aStats = projectStats(active);

  return (
    <div style={S.shell}>
      <Style />

      <header style={S.header}>
        <div style={S.eyebrow}>MISSION TRACK · TWO LAUNCHES</div>
        <h1 style={S.h1}>Two ideas, one launch window.</h1>
        <p style={S.sub}>
          Both projects move through the same five phases. Check tasks off as you go — the track fills
          on its own and saves automatically.
        </p>
      </header>

      {/* At-a-glance comparison */}
      <div style={S.chipRow}>
        {state.projects.map((p) => {
          const st = projectStats(p);
          const isActive = p.id === active.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                setState((s) => ({ ...s, activeId: p.id }));
                setOpenPhase(st.current);
              }}
              className="chip"
              style={{
                ...S.chip,
                ...(isActive ? S.chipActive : {}),
              }}
            >
              <div style={S.chipTop}>
                <span style={S.chipName}>{p.name}</span>
                <span style={S.chipPct}>{st.pct}%</span>
              </div>
              <div style={S.chipPhase}>
                Phase {st.current + 1} · {p.phases[st.current].label}
              </div>
              <div style={S.barTrack}>
                <div style={{ ...S.barFill, width: `${st.pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Active project detail */}
      <section style={S.detail}>
        <EditableText
          value={active.name}
          onChange={(v) => editMeta(active.id, "name", v)}
          style={S.projName}
          ariaLabel="Project name"
        />
        <EditableText
          value={active.oneLiner}
          onChange={(v) => editMeta(active.id, "oneLiner", v)}
          style={S.projLine}
          ariaLabel="Project description"
          muted
        />

        <div style={S.metaRow}>
          <span style={S.metaPill}>
            {aStats.done}/{aStats.total} tasks done
          </span>
          <span style={{ ...S.metaPill, ...S.metaPillAccent }}>
            On Phase {aStats.current + 1}
          </span>
        </div>

        {/* The journey spine — the signature element */}
        <div style={S.track}>
          {active.phases.map((phase, i) => {
            const st = phaseStats(phase);
            const isCurrent = i === aStats.current;
            const isOpen = openPhase === i;
            const nodeState = st.complete ? "done" : isCurrent ? "current" : "upcoming";
            return (
              <div key={i} style={S.phaseWrap}>
                {/* connector line */}
                {i < active.phases.length - 1 && (
                  <span
                    style={{
                      ...S.connector,
                      background: st.complete ? "var(--pine)" : "var(--line)",
                    }}
                  />
                )}

                <button
                  className="phaseHead"
                  style={S.phaseHead}
                  onClick={() => setOpenPhase(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                >
                  <span
                    className={nodeState === "current" ? "node pulse" : "node"}
                    style={{ ...S.node, ...nodeStyles[nodeState] }}
                  >
                    {st.complete ? "✓" : i + 1}
                  </span>
                  <span style={S.phaseText}>
                    <span style={S.phaseLabel}>{phase.label}</span>
                    <span style={S.phaseBlurb}>{phase.blurb}</span>
                  </span>
                  <span style={S.phaseCount}>
                    {st.done}/{st.total}
                  </span>
                </button>

                {isOpen && (
                  <div style={S.taskArea}>
                    {phase.tasks.length === 0 && (
                      <div style={S.empty}>No tasks yet — add the first one below.</div>
                    )}
                    {phase.tasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        onToggle={() => toggleTask(active.id, i, t.id)}
                        onEdit={(v) => editTask(active.id, i, t.id, v)}
                        onRemove={() => removeTask(active.id, i, t.id)}
                      />
                    ))}
                    <AddTask onAdd={(text) => addTask(active.id, i, text)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <footer style={S.footer}>
        <span style={S.footNote}>
          {saveErr ? "⚠ Couldn't save your last change — try again." : "Saved automatically."}
        </span>
        <button className="reset" style={S.reset} onClick={resetAll}>
          Reset template
        </button>
      </footer>
    </div>
  );
}

/* ---------------- sub-components ---------------- */

function TaskRow({ task, onToggle, onEdit, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(task.text);
  return (
    <div style={S.taskRow}>
      <button
        className="check"
        aria-label={task.done ? "Mark incomplete" : "Mark complete"}
        onClick={onToggle}
        style={{ ...S.check, ...(task.done ? S.checkDone : {}) }}
      >
        {task.done ? "✓" : ""}
      </button>
      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            onEdit(val.trim() || task.text);
            setEditing(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          style={S.taskInput}
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          style={{ ...S.taskText, ...(task.done ? S.taskTextDone : {}) }}
        >
          {task.text}
        </span>
      )}
      <button className="kill" style={S.kill} onClick={onRemove} aria-label="Delete task">
        ×
      </button>
    </div>
  );
}

function AddTask({ onAdd }) {
  const [val, setVal] = useState("");
  const submit = () => {
    const t = val.trim();
    if (t) {
      onAdd(t);
      setVal("");
    }
  };
  return (
    <div style={S.addRow}>
      <input
        value={val}
        placeholder="Add a task…"
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={S.addInput}
      />
      <button className="add" style={S.addBtn} onClick={submit}>
        Add
      </button>
    </div>
  );
}

function EditableText({ value, onChange, style, ariaLabel, muted }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  useEffect(() => setVal(value), [value]);
  if (editing) {
    return (
      <input
        autoFocus
        aria-label={ariaLabel}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          onChange(val.trim() || value);
          setEditing(false);
        }}
        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
        style={{ ...style, ...S.inlineEditing }}
      />
    );
  }
  return (
    <span
      tabIndex={0}
      role="button"
      onClick={() => setEditing(true)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setEditing(true)}
      style={{ ...style, ...(muted ? { color: "var(--ink-soft)" } : {}), cursor: "text" }}
    >
      {value}
    </span>
  );
}

/* ---------------- styles ---------------- */

const nodeStyles = {
  done: { background: "var(--pine)", color: "var(--ink-on-accent)", borderColor: "var(--pine)" },
  current: { background: "var(--panel)", color: "var(--amber)", borderColor: "var(--amber)" },
  upcoming: { background: "var(--panel)", color: "var(--ink-soft)", borderColor: "var(--line)" },
};

const S = {
  shell: {
    fontFamily: "'Inter', system-ui, sans-serif",
    background: "transparent",
    color: "var(--ink)",
    minHeight: "100vh",
    padding: "clamp(18px, 4vw, 44px)",
    boxSizing: "border-box",
    maxWidth: 760,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },
  loading: { fontFamily: "'JetBrains Mono', monospace", color: "var(--ink-soft)", padding: 40 },

  header: { marginBottom: 26 },
  eyebrow: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.18em",
    color: "var(--pine)",
    marginBottom: 12,
  },
  h1: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "clamp(28px, 6vw, 40px)",
    lineHeight: 1.04,
    fontWeight: 600,
    letterSpacing: "-0.02em",
    margin: "0 0 10px",
  },
  sub: { fontSize: 15, lineHeight: 1.5, color: "var(--ink-soft)", margin: 0, maxWidth: 520 },

  chipRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 },
  chip: {
    textAlign: "left",
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 14,
    padding: "14px 14px 12px",
    cursor: "pointer",
    font: "inherit",
    color: "inherit",
    transition: "border-color .15s, box-shadow .15s, transform .1s",
  },
  chipActive: {
    borderColor: "var(--pine)",
    boxShadow: "0 0 0 1px var(--pine), 0 8px 26px -12px rgba(63,224,197,.45)",
  },
  chipTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  chipName: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: "-0.01em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  chipPct: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--pine)" },
  chipPhase: {
    fontSize: 11.5,
    color: "var(--ink-soft)",
    margin: "4px 0 10px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  barTrack: { height: 5, background: "var(--line)", borderRadius: 99, overflow: "hidden" },
  barFill: { height: "100%", background: "var(--pine)", borderRadius: 99, transition: "width .4s ease" },

  detail: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 18,
    padding: "clamp(16px, 4vw, 26px)",
  },
  projName: {
    display: "inline-block",
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: "-0.02em",
    marginBottom: 4,
  },
  projLine: { display: "block", fontSize: 14.5, lineHeight: 1.45, marginBottom: 14 },
  inlineEditing: {
    border: "1px solid var(--pine)",
    borderRadius: 8,
    padding: "2px 8px",
    outline: "none",
    background: "var(--paper)",
    font: "inherit",
    width: "100%",
    boxSizing: "border-box",
  },

  metaRow: { display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" },
  metaPill: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    padding: "5px 10px",
    borderRadius: 99,
    background: "var(--paper)",
    color: "var(--ink-soft)",
    border: "1px solid var(--line)",
  },
  metaPillAccent: { color: "var(--amber)", borderColor: "var(--amber-soft)", background: "var(--amber-bg)" },

  track: { position: "relative" },
  phaseWrap: { position: "relative", paddingLeft: 4 },
  connector: {
    position: "absolute",
    left: 19,
    top: 38,
    bottom: -6,
    width: 2,
    zIndex: 0,
  },
  phaseHead: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    width: "100%",
    background: "transparent",
    border: "none",
    padding: "8px 0",
    cursor: "pointer",
    textAlign: "left",
    font: "inherit",
    color: "inherit",
  },
  node: {
    flexShrink: 0,
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "2px solid",
    display: "grid",
    placeItems: "center",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    fontWeight: 600,
    background: "var(--panel)",
  },
  phaseText: { display: "flex", flexDirection: "column", gap: 2, paddingTop: 2, flex: 1 },
  phaseLabel: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 15.5,
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
  phaseBlurb: { fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.35 },
  phaseCount: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    color: "var(--ink-soft)",
    paddingTop: 6,
    flexShrink: 0,
  },

  taskArea: { padding: "2px 0 14px 44px" },
  empty: { fontSize: 13, color: "var(--ink-soft)", fontStyle: "italic", padding: "4px 0 8px" },
  taskRow: { display: "flex", alignItems: "center", gap: 10, padding: "5px 0" },
  check: {
    flexShrink: 0,
    width: 20,
    height: 20,
    borderRadius: 6,
    border: "1.5px solid var(--line)",
    background: "var(--panel)",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    fontSize: 12,
    color: "var(--ink-on-accent)",
    lineHeight: 1,
  },
  checkDone: { background: "var(--pine)", borderColor: "var(--pine)" },
  taskText: { fontSize: 14, lineHeight: 1.4, flex: 1, cursor: "text" },
  taskTextDone: { textDecoration: "line-through", color: "var(--ink-soft)" },
  taskInput: {
    flex: 1,
    font: "inherit",
    fontSize: 14,
    border: "1px solid var(--pine)",
    borderRadius: 6,
    padding: "3px 8px",
    outline: "none",
  },
  kill: {
    flexShrink: 0,
    width: 24,
    height: 24,
    border: "none",
    background: "transparent",
    color: "var(--ink-soft)",
    fontSize: 18,
    lineHeight: 1,
    cursor: "pointer",
    borderRadius: 6,
    opacity: 0.5,
  },
  addRow: { display: "flex", gap: 8, marginTop: 8 },
  addInput: {
    flex: 1,
    font: "inherit",
    fontSize: 13.5,
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "8px 10px",
    outline: "none",
    background: "var(--paper)",
  },
  addBtn: {
    flexShrink: 0,
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 16px",
    border: "none",
    borderRadius: 8,
    background: "var(--pine)",
    color: "var(--ink-on-accent)",
    cursor: "pointer",
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    gap: 12,
  },
  footNote: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--ink-soft)" },
  reset: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    background: "transparent",
    border: "1px solid var(--line)",
    color: "var(--ink-soft)",
    padding: "6px 12px",
    borderRadius: 99,
    cursor: "pointer",
  },
};

function Style() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap');
      :root{
        --paper:#121A36;
        --panel:#0F1838;
        --ink:#E9ECF7;
        --ink-soft:#8A92B4;
        --line:rgba(255,255,255,0.12);
        --pine:#3FE0C5;
        --amber:#F7C457;
        --amber-soft:rgba(247,196,87,0.5);
        --amber-bg:rgba(247,196,87,0.10);
        --ink-on-accent:#06121A;
      }
      html,body{ background:#05070F; }
      body{
        background:
          radial-gradient(1100px 680px at 80% -10%, rgba(124,108,240,0.20), transparent 60%),
          radial-gradient(820px 560px at 8% 6%, rgba(63,224,197,0.10), transparent 55%),
          linear-gradient(180deg, #0A0F26 0%, #070A18 62%, #05070F 100%);
        background-attachment: fixed;
      }
      body::after{
        content:""; position:fixed; inset:0; pointer-events:none; z-index:0;
        background-image:
          radial-gradient(1.5px 1.5px at 30% 22%, #fff, transparent 60%),
          radial-gradient(1px 1px at 78% 42%, rgba(255,255,255,.85), transparent 60%),
          radial-gradient(1.2px 1.2px at 52% 72%, rgba(255,255,255,.75), transparent 60%),
          radial-gradient(1px 1px at 12% 64%, rgba(255,255,255,.7), transparent 60%);
        background-size: 210px 210px, 320px 320px, 170px 170px, 260px 260px;
        opacity:.6;
      }
      *{ -webkit-tap-highlight-color: transparent; }
      .chip:hover{ transform: translateY(-1px); }
      .chip:active{ transform: translateY(0); }
      .phaseHead:hover .node{ box-shadow:0 0 0 4px rgba(63,224,197,.12); }
      .check:hover{ border-color: var(--pine); }
      .kill:hover{ opacity:1; background: var(--line); }
      .add:hover{ opacity:.88; }
      .reset:hover{ border-color: var(--ink-soft); color: var(--ink); }
      input:focus-visible, button:focus-visible, [role="button"]:focus-visible{
        outline: 2px solid var(--pine); outline-offset: 2px;
      }
      .pulse{ animation: pulse 2.2s ease-in-out infinite; }
      @keyframes pulse{
        0%,100%{ box-shadow:0 0 0 0 rgba(247,196,87,.40); }
        50%{ box-shadow:0 0 0 7px rgba(247,196,87,0); }
      }
      @media (max-width:520px){
        .chip{ padding:12px 12px 10px; }
      }
      @media (prefers-reduced-motion: reduce){
        *{ animation:none !important; transition:none !important; }
      }
    `}</style>
  );
}
