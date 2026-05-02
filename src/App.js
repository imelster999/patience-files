import { useState, useEffect, useRef, useCallback } from "react";

// ── 🗄️ Supabase Configuration ──────────────────────────────────────────────
// Replace these two values with your own from Supabase dashboard
const SUPABASE_URL = "https://qdrlztyeergkogwbixrx.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkcmx6dHllZXJna29nd2JpeHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyODQ1MzAsImV4cCI6MjA5Mjg2MDUzMH0.uXxOx9xmhNSmQ1dBERznQezfI9y-vBFtJHpFELPqK5U";

// Lightweight Supabase REST client (no npm needed)
// Uses only the apikey header — compatible with both legacy anon keys and new sb_publishable_ keys

// Convert camelCase keys to snake_case for Supabase columns
// Uses an explicit map for tricky fields, falls back to auto-conversion
const FIELD_MAP = {
  discussedIn1on1: "discussed_in_1on1",
  confirmedInWritingDate: "confirmed_in_writing_date",
  acknowledgedVerbally: "acknowledged_verbally",
  emailReceived: "email_received",
  reporteeResponded: "reportee_responded",
  promisedDate: "promised_date",
  melTookOver: "mel_took_over",
  excuseLog: "excuse_log",
  excuseAccepted: "excuse_accepted",
  discussedDate: "discussed_date",
  escalationDate: "escalation_date",
  verbalWarningDate: "verbal_warning_date",
  writtenWarningDate: "written_warning_date",
  managerNotes: "manager_notes",
  feedbackShared: "feedback_shared",
  feedbackSharedDate: "feedback_shared_date",
  feedbackSharedHow: "feedback_shared_how",
  qualityRating: "quality_rating",
  qualityNotes: "quality_notes",
  reviewPeriod: "review_period",
  taskSource: "task_source",
  taskSize: "task_size",
  emailSubject: "email_subject",
  briefingDate: "briefing_date",
  briefingContext: "briefing_context",
};
const FIELD_MAP_REVERSE = Object.fromEntries(
  Object.entries(FIELD_MAP).map(([k, v]) => [v, k])
);

const toSnake = (str) =>
  FIELD_MAP[str] || str.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
const toCamel = (str) =>
  FIELD_MAP_REVERSE[str] || str.replace(/_([a-z])/g, (_, l) => l.toUpperCase());

const rowToSnake = (obj) => {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    out[toSnake(k)] = v;
  });
  return out;
};
const rowToCamel = (obj) => {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    out[toCamel(k)] = v;
  });
  return out;
};

const sbHeaders = (extra = {}) => ({
  apikey: SUPABASE_ANON_KEY,
  ...extra,
});

const sb = {
  async get(table) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: sbHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    const rows = await res.json();
    return rows.map(rowToCamel);
  },
  async upsert(table, rows) {
    // Send one row at a time to avoid "all object keys must match" error
    for (const row of rows) {
      const snakeRow = rowToSnake(row);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: sbHeaders({
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        }),
        body: JSON.stringify(snakeRow),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("Supabase error detail:", errText);
        console.error("Sent columns:", Object.keys(snakeRow));
        throw new Error(errText);
      }
    }
  },
  async del(table, id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: sbHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
  },
};

const USE_SUPABASE = SUPABASE_URL !== "YOUR_SUPABASE_URL";

// ── 🎨 Bright Cheerful Palette ─────────────────────────────────────────────
const C = {
  bg: "#f5f0ff",
  surface: "#ffffff",
  border: "#ddd5f8",
  text: "#1e1a3c",
  muted: "#8078a8",
  faint: "#ede8ff",
  rose: { bg: "#ffe0ed", text: "#b5124a", border: "#ffaacc" },
  sage: { bg: "#ccfbe0", text: "#0b7a3e", border: "#5ddba0" },
  amber: { bg: "#fff5b8", text: "#7a5200", border: "#ffd84d" },
  sky: { bg: "#d0eaff", text: "#004eb0", border: "#70bbff" },
  lilac: { bg: "#eeddff", text: "#6610c8", border: "#c07aff" },
  peach: { bg: "#ffe5cc", text: "#9a3800", border: "#ffb06a" },
  slate: { bg: "#dde5ff", text: "#263480", border: "#99aaf5" },
  mint: { bg: "#bbfbea", text: "#076b50", border: "#3dddb0" },
  pink: { bg: "#ffd6f0", text: "#a01070", border: "#ff88d0" },
  lemon: { bg: "#feffc0", text: "#6a5500", border: "#ffe033" },
};

const STATUS_CONFIG = {
  "on-time": { label: "✅ On Time", ...C.sage },
  late: { label: "🔴 Late", ...C.rose },
  pending: { label: "⏳ Pending", ...C.amber },
  "no-response": { label: "👻 No Response", ...C.peach },
  incomplete: { label: "🚫 Not Delivered", ...C.slate },
};

const COMPLETION_CONFIG = {
  incomplete: { label: "To Do", icon: "○", ...C.slate },
  "in-progress": { label: "In Progress", icon: "◑", ...C.sky },
  complete: { label: "Done! 🎉", icon: "●", ...C.mint },
};
const COMPLETION_CYCLE = ["incomplete", "in-progress", "complete"];

const ESCALATION_CONFIG = {
  none: { label: "😌 None", ...C.slate },
  informal: { label: "💬 Informal Chat", ...C.amber },
  verbal: { label: "⚠️ Verbal Warning", ...C.peach },
  written: { label: "📄 Written Warning", ...C.rose },
  hr: { label: "🚨 HR Involved", ...C.lilac },
};

const TASK_SIZE_CONFIG = {
  small: {
    label: "🟡 Small",
    desc: "Under ~1 hr · low stakes · procedural (e.g. getting a quote, raising a PO)",
    ...{ bg: "#fffac0", text: "#7a6200", border: "#ffe033" },
    points: 1,
  },
  medium: {
    label: "🟠 Medium",
    desc: "1–4 hrs · requires judgment or coordination (e.g. drafting a brief, coordinating a vendor)",
    ...{ bg: "#ffe5cc", text: "#9a3800", border: "#ffb06a" },
    points: 2,
  },
  large: {
    label: "🔴 Large",
    desc: "Half day+ · high stakes or strategic (e.g. client proposal, budget forecast, senior stakeholder)",
    ...{ bg: "#ffe0ed", text: "#b5124a", border: "#ffaacc" },
    points: 3,
  },
};

const QUALITY_CONFIG = {
  standard: {
    label: "✅ Up to Standard",
    desc: "Submitted as expected, no changes needed",
    ...{ bg: "#bbfbea", text: "#076b50", border: "#3dddb0" },
  },
  revisions: {
    label: "🔄 Required Revisions",
    desc: "Needed some changes before it was acceptable",
    ...{ bg: "#fff5b8", text: "#7a5200", border: "#ffd84d" },
  },
  rework: {
    label: "❌ Significant Rework",
    desc: "Required major changes or was largely redone",
    ...{ bg: "#ffe0ed", text: "#b5124a", border: "#ffaacc" },
  },
};

const MEETING_TYPE_CONFIG = {
  "one-on-one": {
    label: "🗣️ 1:1",
    ...{ bg: "#d0eaff", text: "#004eb0", border: "#70bbff" },
  },
  "manager-review": {
    label: "👔 Manager Review",
    ...{ bg: "#eeddff", text: "#6610c8", border: "#c07aff" },
  },
  performance: {
    label: "📊 Performance Discussion",
    ...{ bg: "#ffe0ed", text: "#b5124a", border: "#ffaacc" },
  },
  informal: {
    label: "☕ Informal Chat",
    ...{ bg: "#fff5b8", text: "#7a5200", border: "#ffd84d" },
  },
  team: {
    label: "👥 Team Meeting",
    ...{ bg: "#bbfbea", text: "#076b50", border: "#3dddb0" },
  },
  other: {
    label: "📌 Other",
    ...{ bg: "#dde5ff", text: "#263480", border: "#99aaf5" },
  },
};

const MEETING_TONE_CONFIG = {
  collaborative: {
    label: "🤝 Collaborative",
    ...{ bg: "#bbfbea", text: "#076b50", border: "#3dddb0" },
  },
  mixed: {
    label: "😐 Mixed",
    ...{ bg: "#fff5b8", text: "#7a5200", border: "#ffd84d" },
  },
  defensive: {
    label: "🛡️ Defensive",
    ...{ bg: "#ffe5cc", text: "#9a3800", border: "#ffb06a" },
  },
  emotional: {
    label: "😢 Emotional",
    ...{ bg: "#ffd6f0", text: "#a01070", border: "#ff88d0" },
  },
  hostile: {
    label: "😤 Hostile",
    ...{ bg: "#ffe0ed", text: "#b5124a", border: "#ffaacc" },
  },
};

const MEETING_ACKNOWLEDGE_CONFIG = {
  yes: {
    label: "✅ Yes",
    ...{ bg: "#bbfbea", text: "#076b50", border: "#3dddb0" },
  },
  partially: {
    label: "🤏 Partially",
    ...{ bg: "#fff5b8", text: "#7a5200", border: "#ffd84d" },
  },
  no: {
    label: "❌ No",
    ...{ bg: "#ffe0ed", text: "#b5124a", border: "#ffaacc" },
  },
};

const INITIAL_MEETINGS = [];

const MEETING_BLANK = {
  id: null,
  date: "",
  type: "one-on-one",
  attendees: "",
  givenNotice: false,
  agendaShared: false,
  whatDiscussed: "",
  tone: "",
  observations: "",
  directQuotes: "",
  claimsMade: "",
  deflected: false,
  mentionedOthers: false,
  visibleDistress: false,
  acknowledgedFeedback: "",
  committedToActions: "",
  behaviourAfter: "",
  followedUpInWriting: false,
  followUpRequired: false,
  followUpDate: "",
  escalationTriggered: false,
  managerNotes: "",
};

const TAG_COLORS = [
  C.sky,
  C.lilac,
  C.mint,
  C.peach,
  C.rose,
  C.amber,
  C.pink,
  C.lemon,
];

const INITIAL_LD = [];

const LD_BLANK = {
  id: null,
  type: "homework",
  title: "",
  date: "",
  description: "",
  outcome: "",
  followUpDate: "",
  followedUp: false,
  reporteeEngaged: false,
  managerNotes: "",
  status: "pending",
};

const LD_TYPES = {
  plan: {
    label: "📋 L&D Plan",
    ...{ bg: "#eeddff", text: "#6610c8", border: "#c07aff" },
  },
  homework: {
    label: "📚 Homework",
    ...{ bg: "#d0eaff", text: "#004eb0", border: "#70bbff" },
  },
  agreement: {
    label: "🤝 Agreement",
    ...{ bg: "#fff5b8", text: "#7a5200", border: "#ffd84d" },
  },
  opportunity: {
    label: "🌟 Opportunity Offered",
    ...{ bg: "#bbfbea", text: "#076b50", border: "#3dddb0" },
  },
  feedback: {
    label: "💬 Feedback Given",
    ...{ bg: "#ffd6f0", text: "#a01070", border: "#ff88d0" },
  },
};

const LD_STATUS = {
  pending: {
    label: "⏳ Pending",
    ...{ bg: "#fff5b8", text: "#7a5200", border: "#ffd84d" },
  },
  complete: {
    label: "✅ Completed",
    ...{ bg: "#bbfbea", text: "#076b50", border: "#3dddb0" },
  },
  overdue: {
    label: "🔴 Overdue",
    ...{ bg: "#ffe0ed", text: "#b5124a", border: "#ffaacc" },
  },
  "no-action": {
    label: "😶 No Action Taken",
    ...{ bg: "#ffe5cc", text: "#9a3800", border: "#ffb06a" },
  },
  declined: {
    label: "🚫 Declined",
    ...{ bg: "#dde5ff", text: "#263480", border: "#99aaf5" },
  },
};

const INITIAL_DATA = [];

const BLANK = {
  id: null,
  task: "",
  description: "",
  tags: [],
  reviewPeriod: "",
  taskSize: "medium",
  taskSource: "email",
  emailReceived: "",
  reporteeResponded: "",
  emailSubject: "",
  briefingDate: "",
  briefingContext: "",
  acknowledgedVerbally: false,
  confirmedInWritingDate: "",
  promisedDate: "",
  deadline: "",
  delivered: "",
  melTookOver: "",
  status: "pending",
  completion: "incomplete",
  chasers: 0,
  excuseLog: "",
  excuseAccepted: false,
  discussedIn1on1: false,
  discussedDate: "",
  escalation: "none",
  escalationDate: "",
  verbalWarningDate: "",
  writtenWarningDate: "",
  impact: "",
  managerNotes: "",
  notes: "",
  feedbackShared: false,
  feedbackSharedDate: "",
  feedbackSharedHow: "",
  qualityRating: "",
  qualityNotes: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(d) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function daysDiff(a, b) {
  if (!a || !b) return null;
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
function allTags(tasks) {
  const s = new Set();
  tasks.forEach((t) => (t.tags || []).forEach((tg) => s.add(tg)));
  return [...s].sort();
}
function tagColor(tag, list) {
  const idx = list.indexOf(tag) % TAG_COLORS.length;
  return TAG_COLORS[idx < 0 ? 0 : idx];
}
function useWindowWidth() {
  const [w, setW] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

const btn = {
  borderRadius: 10,
  padding: "7px 15px",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  border: "none",
};

// ── Small UI ───────────────────────────────────────────────────────────────
function Pill({ bg, text, border, children, small, onClick, style = {} }) {
  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        background: bg,
        color: text,
        border: `1.5px solid ${border}`,
        borderRadius: 99,
        padding: small ? "2px 10px" : "4px 13px",
        fontSize: small ? 11 : 12,
        fontWeight: 700,
        lineHeight: 1.4,
        cursor: onClick ? "pointer" : "default",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
function DeltaBadge({ deadline, delivered }) {
  const diff = daysDiff(deadline, delivered);
  if (diff === null) return null;
  if (diff === 0)
    return (
      <Pill {...C.mint} small>
        🎯 on day
      </Pill>
    );
  if (diff > 0)
    return (
      <Pill {...C.rose} small>
        🐌 +{diff}d late
      </Pill>
    );
  return (
    <Pill {...C.sage} small>
      🚀 {Math.abs(diff)}d early
    </Pill>
  );
}
function CompletionToggle({ value, onChange, compact }) {
  const cfg = COMPLETION_CONFIG[value] || COMPLETION_CONFIG.incomplete;
  const next = () => {
    const idx = COMPLETION_CYCLE.indexOf(value);
    onChange(COMPLETION_CYCLE[(idx + 1) % COMPLETION_CYCLE.length]);
  };
  return (
    <button
      onClick={next}
      title="Click to cycle status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 4 : 6,
        background: cfg.bg,
        color: cfg.text,
        border: `2px solid ${cfg.border}`,
        borderRadius: 99,
        padding: compact ? "3px 10px" : "5px 13px",
        fontSize: compact ? 11 : 12,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: compact ? 12 : 14 }}>{cfg.icon}</span>
      {cfg.label}
    </button>
  );
}
function TagInput({ tags, setTags, allTagsList }) {
  const [input, setInput] = useState("");
  const add = (t) => {
    const c = t.trim();
    if (c && !tags.includes(c)) setTags([...tags, c]);
    setInput("");
  };
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        alignItems: "center",
        border: `2px solid ${C.border}`,
        borderRadius: 10,
        padding: "6px 8px",
        background: C.faint,
        minHeight: 36,
      }}
    >
      {tags.map((t) => (
        <Pill key={t} {...tagColor(t, allTagsList)} small>
          {t}
          <span
            onClick={() => setTags(tags.filter((x) => x !== t))}
            style={{ cursor: "pointer", marginLeft: 3, opacity: 0.5 }}
          >
            ×
          </span>
        </Pill>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(input);
          }
        }}
        onBlur={() => {
          if (input.trim()) add(input);
        }}
        placeholder="Type + Enter 🏷️"
        style={{
          border: "none",
          outline: "none",
          fontSize: 13,
          background: "transparent",
          width: 120,
          color: C.text,
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}

// ── DASHBOARD PANELS ────────────────────────────────────────────────────────
function ScorePanel({
  title,
  emoji,
  score,
  scoreLabel,
  trackLeft,
  trackRight,
  color,
  pct,
  children,
  isMobile,
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `2px solid ${C.border}`,
        borderRadius: 16,
        padding: isMobile ? "14px 16px" : "18px 22px",
        flex: "1 1 240px",
        boxShadow: "0 4px 20px rgba(100,80,220,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: C.muted,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 3,
            }}
          >
            {emoji} {title}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color }}>
            {scoreLabel}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1 }}>
            {score}
          </div>
        </div>
      </div>
      {pct !== undefined && (
        <>
          <div
            style={{
              position: "relative",
              height: 14,
              borderRadius: 99,
              background:
                "linear-gradient(to right, #ff7eb6 0%, #ffd966 50%, #5ddba0 100%)",
              border: `1.5px solid ${C.border}`,
              overflow: "visible",
              marginBottom: 4,
            }}
          >
            {pct !== null && (
              <div
                style={{
                  position: "absolute",
                  left: `${Math.max(2, Math.min(98, pct))}%`,
                  top: "50%",
                  transform: "translate(-50%,-50%)",
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "#fff",
                  border: `3px solid ${color}`,
                  boxShadow: "0 3px 10px rgba(0,0,0,0.18)",
                  zIndex: 2,
                }}
              />
            )}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: C.muted,
              fontWeight: 700,
            }}
          >
            <span>{trackLeft}</span>
            <span>{trackRight}</span>
          </div>
        </>
      )}
      {children && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

function DeadlineScoreBar({ tasks, isMobile }) {
  const today = new Date().toISOString().slice(0, 10);
  const scored = tasks.filter((t) => t.deadline && t.delivered);
  const overdue = tasks.filter(
    (t) => t.deadline && !t.delivered && t.deadline < today
  );
  let totalPoints = 0,
    maxPoints = 0;
  scored.forEach((t) => {
    const diff = Math.round(
      (new Date(t.delivered) - new Date(t.deadline)) / 86400000
    );
    maxPoints += 1;
    totalPoints += diff <= 0 ? 1 : Math.max(1 - Math.min(diff * 0.15, 1), 0);
  });
  overdue.forEach(() => {
    maxPoints += 1;
  });
  const score =
    maxPoints === 0 ? null : Math.round((totalPoints / maxPoints) * 100);
  const color =
    score === null
      ? C.muted
      : score >= 80
      ? "#0b7a3e"
      : score >= 55
      ? "#7a5200"
      : "#b5124a";
  const label =
    score === null
      ? "No data yet ✨"
      : score >= 80
      ? "Smashing it! 🌟"
      : score >= 55
      ? "Room to grow 🌱"
      : "Needs a nudge 💪";
  const onTime = scored.filter(
    (t) =>
      Math.round((new Date(t.delivered) - new Date(t.deadline)) / 86400000) <= 0
  ).length;
  const lateCount = scored.filter(
    (t) =>
      Math.round((new Date(t.delivered) - new Date(t.deadline)) / 86400000) > 0
  ).length;
  return (
    <ScorePanel
      title="Deadline Adherence"
      emoji="🎯"
      score={score === null ? "—" : `${score}%`}
      scoreLabel={label}
      color={color}
      pct={score}
      trackLeft="😬 Always late"
      trackRight="🌟 Always on time"
      isMobile={isMobile}
    >
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {onTime > 0 && (
          <Pill {...C.mint} small>
            ✅ {onTime} on time
          </Pill>
        )}
        {lateCount > 0 && (
          <Pill {...C.rose} small>
            🐢 {lateCount} late
          </Pill>
        )}
        {overdue.length > 0 && (
          <Pill {...C.peach} small>
            ⏰ {overdue.length} overdue
          </Pill>
        )}
      </div>
    </ScorePanel>
  );
}

function ResponseTimePanel({ tasks, isMobile }) {
  const withBoth = tasks.filter(
    (t) =>
      (t.taskSource || "email") === "email" &&
      t.emailReceived &&
      t.reporteeResponded
  );
  const diffs = withBoth
    .map((t) => daysDiff(t.emailReceived, t.reporteeResponded))
    .filter((d) => d !== null && d >= 0);
  const avg =
    diffs.length === 0
      ? null
      : Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10;
  const noReply = tasks.filter(
    (t) =>
      (t.taskSource || "email") === "email" &&
      t.emailReceived &&
      !t.reporteeResponded
  ).length;
  const color =
    avg === null
      ? C.muted
      : avg <= 1
      ? "#0b7a3e"
      : avg <= 3
      ? "#7a5200"
      : "#b5124a";
  const label =
    avg === null
      ? "No data ✨"
      : avg <= 1
      ? "Lightning fast ⚡"
      : avg <= 3
      ? "A bit slow 🐢"
      : "Playing hide & seek 🙈";
  const pct =
    avg === null ? null : Math.max(0, Math.min(100, 100 - (avg / 7) * 100));
  return (
    <ScorePanel
      title="Avg Response Time"
      emoji="📬"
      score={avg === null ? "—" : `${avg}d`}
      scoreLabel={label}
      color={color}
      pct={pct}
      trackLeft="🙈 MIA"
      trackRight="⚡ Same day"
      isMobile={isMobile}
    >
      {noReply > 0 && (
        <Pill {...C.peach} small>
          👻 {noReply} never replied
        </Pill>
      )}
    </ScorePanel>
  );
}

function AccountabilityPanel({ tasks, isMobile }) {
  const totalChasers = tasks.reduce((s, t) => s + (t.chasers || 0), 0);
  const excusedTasks = tasks.filter(
    (t) => t.excuseLog && t.excuseLog.trim()
  ).length;
  const rejectedExcuses = tasks.filter(
    (t) => t.excuseLog && !t.excuseAccepted
  ).length;
  const discussed = tasks.filter((t) => t.discussedIn1on1).length;
  const warnings = {
    verbal: tasks.filter((t) => t.verbalWarningDate).length,
    written: tasks.filter((t) => t.writtenWarningDate).length,
    hr: tasks.filter((t) => t.escalation === "hr").length,
  };
  const escLevel = warnings.hr
    ? "hr"
    : warnings.written
    ? "written"
    : warnings.verbal
    ? "verbal"
    : discussed
    ? "informal"
    : "none";
  const escCfg = ESCALATION_CONFIG[escLevel];
  const excuses = tasks.map((t) => t.excuseLog || "").filter(Boolean);
  const keywords = [
    "laptop",
    "internet",
    "connection",
    "wifi",
    "sick",
    "unwell",
    "meeting",
    "busy",
    "forgot",
    "system",
    "update",
    "power",
    "outage",
    "access",
  ];
  const repeated = keywords.filter(
    (kw) => excuses.filter((e) => e.toLowerCase().includes(kw)).length > 1
  );
  return (
    <div
      style={{
        background: C.surface,
        border: `2px solid ${C.border}`,
        borderRadius: 16,
        padding: isMobile ? "14px 16px" : "18px 22px",
        flex: "1 1 240px",
        boxShadow: "0 4px 20px rgba(100,80,220,0.08)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: C.muted,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 12,
        }}
      >
        📋 Accountability Trail
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px 18px",
          marginBottom: 12,
        }}
      >
        {[
          [
            "📣 Chasers",
            totalChasers,
            totalChasers > 5 ? C.rose : totalChasers > 2 ? C.amber : C.mint,
          ],
          ["🎭 Excuses", excusedTasks, excusedTasks > 2 ? C.rose : C.slate],
          [
            "🚫 Rejected",
            rejectedExcuses,
            rejectedExcuses > 1 ? C.rose : C.slate,
          ],
          ["🗣️ 1:1 Chats", discussed, discussed > 0 ? C.sky : C.slate],
          [
            "⚠️ Verbal",
            warnings.verbal,
            warnings.verbal > 0 ? C.peach : C.slate,
          ],
          [
            "📄 Written",
            warnings.written,
            warnings.written > 0 ? C.rose : C.slate,
          ],
        ].map(([label, val, col]) => (
          <div key={label}>
            <div
              style={{
                fontSize: 10,
                color: C.muted,
                fontWeight: 700,
                marginBottom: 2,
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: col.text }}>
              {val}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginBottom: repeated.length > 0 ? 8 : 0,
        }}
      >
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>
          Highest escalation:
        </span>
        <Pill bg={escCfg.bg} text={escCfg.text} border={escCfg.border} small>
          {escCfg.label}
        </Pill>
      </div>
      {repeated.length > 0 && (
        <div
          style={{
            background: C.rose.bg,
            border: `1.5px solid ${C.rose.border}`,
            borderRadius: 10,
            padding: "8px 11px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: C.rose.text,
              marginBottom: 2,
            }}
          >
            🔁 Repeated excuses detected!
          </div>
          <div style={{ fontSize: 11, color: C.rose.text }}>
            {repeated.map((k) => `"${k}"`).join(" · ")}
          </div>
        </div>
      )}
    </div>
  );
}

function ImpactPanel({ tasks, isMobile }) {
  const impacted = tasks.filter((t) => t.impact && t.impact.trim());
  const avgDaysLate = (() => {
    const diffs = tasks
      .filter((t) => t.deadline && t.delivered)
      .map((t) => daysDiff(t.deadline, t.delivered))
      .filter((d) => d > 0);
    return diffs.length === 0
      ? null
      : Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10;
  })();
  return (
    <div
      style={{
        background: C.surface,
        border: `2px solid ${C.border}`,
        borderRadius: 16,
        padding: isMobile ? "14px 16px" : "18px 22px",
        flex: "1 1 240px",
        boxShadow: "0 4px 20px rgba(100,80,220,0.08)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: C.muted,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 12,
        }}
      >
        💥 Business Impact
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px 18px",
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              fontWeight: 700,
              marginBottom: 2,
            }}
          >
            😬 Tasks w/ Impact
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: impacted.length > 0 ? C.rose.text : C.muted,
            }}
          >
            {impacted.length}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              fontWeight: 700,
              marginBottom: 2,
            }}
          >
            🐌 Avg Days Late
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color:
                avgDaysLate > 2
                  ? C.rose.text
                  : avgDaysLate > 0
                  ? C.amber.text
                  : C.sage.text,
            }}
          >
            {avgDaysLate === null ? "—" : `${avgDaysLate}d`}
          </div>
        </div>
      </div>
      {impacted.length === 0 && (
        <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>
          🌈 No impact logged yet!
        </div>
      )}
      {impacted.slice(0, 2).map((t) => (
        <div
          key={t.id}
          style={{
            background: C.rose.bg,
            border: `1.5px solid ${C.rose.border}`,
            borderRadius: 10,
            padding: "7px 10px",
            marginBottom: 7,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: C.rose.text,
              marginBottom: 2,
            }}
          >
            💢 {t.task}
          </div>
          <div style={{ fontSize: 11, color: C.rose.text, lineHeight: 1.4 }}>
            {t.impact}
          </div>
        </div>
      ))}
      {impacted.length > 2 && (
        <div style={{ fontSize: 11, color: C.muted }}>
          +{impacted.length - 2} more tasks with impact logged
        </div>
      )}
    </div>
  );
}

// ── Edit Form ──────────────────────────────────────────────────────────────
function EditForm({ row, onSave, onCancel, allTagsList, isMobile }) {
  const [d, setD] = useState({ ...row, chasers: row.chasers || 0 });
  const f = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));
  const fBool = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.checked }));
  const inp = {
    width: "100%",
    border: `2px solid ${C.border}`,
    borderRadius: 10,
    padding: "7px 10px",
    fontFamily: "inherit",
    fontSize: 13,
    background: C.faint,
    color: C.text,
    outline: "none",
  };
  const lbl = {
    display: "block",
    fontSize: 10,
    fontWeight: 800,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    marginBottom: 3,
  };
  const fld = { marginBottom: 12 };
  const sec = (emoji, title) => (
    <div
      style={{
        fontSize: 12,
        fontWeight: 800,
        color: C.text,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 10,
        marginTop: 18,
        paddingBottom: 6,
        borderBottom: `2px solid ${C.border}`,
      }}
    >
      {emoji} {title}
    </div>
  );
  const melSuggestion = d.melTookOver && d.completion !== "incomplete";

  const formContent = (
    <div>
      {sec("📝", "Task Details")}
      <div style={fld}>
        <label style={lbl}>Task Name</label>
        <input
          style={inp}
          value={d.task}
          onChange={f("task")}
          placeholder="What needs to get done?"
        />
      </div>
      <div style={fld}>
        <label style={lbl}>Description & Action Required</label>
        <textarea
          style={{ ...inp, minHeight: 64, resize: "vertical" }}
          value={d.description}
          onChange={f("description")}
          placeholder="What it's about & what she needs to do 🎯"
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>⚖️ Task Size</label>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {Object.entries(TASK_SIZE_CONFIG).map(([key, cfg]) => {
            const active = (d.taskSize || "medium") === key;
            return (
              <button
                key={key}
                onClick={() => setD((x) => ({ ...x, taskSize: key }))}
                title={cfg.desc}
                style={{
                  flex: 1,
                  ...btn,
                  fontSize: 12,
                  padding: "9px 6px",
                  background: active ? cfg.text : cfg.bg,
                  color: active ? "#fff" : cfg.text,
                  border: `2px solid ${cfg.border}`,
                  flexDirection: "column",
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 16 }}>{cfg.label.split(" ")[0]}</span>
                <span style={{ fontWeight: 800 }}>
                  {cfg.label.split(" ").slice(1).join(" ")}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    opacity: 0.75,
                    fontWeight: 400,
                    lineHeight: 1.3,
                    textAlign: "center",
                  }}
                >
                  {cfg.desc.split("·")[0].trim()}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <label style={lbl}>🏷️ Tags</label>
          <TagInput
            tags={d.tags}
            setTags={(v) => setD((x) => ({ ...x, tags: v }))}
            allTagsList={allTagsList}
          />
        </div>
        <div>
          <label style={lbl}>📅 Review Period</label>
          <input
            style={inp}
            value={d.reviewPeriod}
            onChange={f("reviewPeriod")}
            placeholder="e.g. Q1 2026"
          />
        </div>
      </div>

      {sec("📨", "How Was This Task Given?")}
      {/* Source toggle */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 16,
          borderRadius: 12,
          overflow: "hidden",
          border: `2px solid ${C.border}`,
        }}
      >
        {[
          ["email", "📧 Email"],
          ["in-person", "🗣️ In Person"],
        ].map(([val, label]) => {
          const active = (d.taskSource || "email") === val;
          return (
            <button
              key={val}
              onClick={() => setD((x) => ({ ...x, taskSource: val }))}
              style={{
                flex: 1,
                ...btn,
                borderRadius: 0,
                fontSize: 14,
                padding: "11px 8px",
                background: active ? C.lilac.text : C.faint,
                color: active ? "#fff" : C.muted,
                border: "none",
                borderRight: val === "email" ? `2px solid ${C.border}` : "none",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Email fields */}
      {(d.taskSource || "email") === "email" && (
        <div
          style={{
            background: C.sky.bg,
            border: `2px solid ${C.sky.border}`,
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: C.sky.text,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            📧 Email Details
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div>
              <label style={lbl}>📨 Email Received</label>
              <input
                style={inp}
                type="date"
                value={d.emailReceived || ""}
                onChange={f("emailReceived")}
              />
            </div>
            <div>
              <label style={lbl}>💬 Date First Responded</label>
              <input
                style={inp}
                type="date"
                value={d.reporteeResponded || ""}
                onChange={f("reporteeResponded")}
              />
            </div>
            <div style={{ gridColumn: isMobile ? "1 / -1" : "auto" }}>
              <label style={lbl}>📝 Subject / Summary</label>
              <input
                style={inp}
                value={d.emailSubject || ""}
                onChange={f("emailSubject")}
                placeholder="e.g. Q1 Report — action required"
              />
            </div>
          </div>
        </div>
      )}

      {/* In-person fields */}
      {(d.taskSource || "email") === "in-person" && (
        <div
          style={{
            background: C.lilac.bg,
            border: `2px solid ${C.lilac.border}`,
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: C.lilac.text,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 4,
            }}
          >
            🗣️ Briefing Details
          </div>
          <div style={{ fontSize: 11, color: C.lilac.text, marginBottom: 12 }}>
            ⚠️ Verbal briefings are harder to prove — log as much detail as
            possible and try to follow up in writing.
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div>
              <label style={lbl}>📅 Date of Briefing</label>
              <input
                style={inp}
                type="date"
                value={d.briefingDate || ""}
                onChange={f("briefingDate")}
              />
            </div>
            <div>
              <label style={lbl}>📍 Context / Meeting</label>
              <input
                style={inp}
                value={d.briefingContext || ""}
                onChange={f("briefingContext")}
                placeholder="e.g. Weekly 1:1, team meeting"
              />
            </div>
            <div>
              <label style={lbl}>✅ Confirmed in Writing</label>
              <input
                style={inp}
                type="date"
                value={d.confirmedInWritingDate || ""}
                onChange={f("confirmedInWritingDate")}
                placeholder="Date she confirmed by email/message"
              />
            </div>
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              color: C.lilac.text,
            }}
          >
            <input
              type="checkbox"
              checked={d.acknowledgedVerbally || false}
              onChange={fBool("acknowledgedVerbally")}
              style={{ width: 16, height: 16, accentColor: C.lilac.text }}
            />
            🗣️ She verbally acknowledged the task in the meeting
          </label>
        </div>
      )}

      {/* Shared dates */}
      {sec("📆", "Deadlines & Delivery")}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
          gap: 10,
          marginBottom: 12,
        }}
      >
        {[
          ["promisedDate", "🤞 Promised Date"],
          ["deadline", "⏰ Deadline"],
          ["delivered", "📦 Date Delivered"],
          ["melTookOver", "🤝 Date Mel Took Over"],
        ].map(([k, l]) => (
          <div key={k}>
            <label style={lbl}>{l}</label>
            <input style={inp} type="date" value={d[k] || ""} onChange={f(k)} />
          </div>
        ))}
      </div>
      {melSuggestion && (
        <div
          style={{
            background: C.amber.bg,
            border: `2px solid ${C.amber.border}`,
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 12,
            display: "flex",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 20 }}>💡</span>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: C.amber.text,
                marginBottom: 2,
              }}
            >
              Mel took over — mark as Incomplete?
            </div>
            <div style={{ fontSize: 12, color: C.amber.text }}>
              This task is no longer under this reportee's responsibility.
            </div>
            <button
              onClick={() => setD((x) => ({ ...x, completion: "incomplete" }))}
              style={{
                marginTop: 7,
                ...btn,
                fontSize: 12,
                padding: "4px 12px",
                background: C.amber.text,
                color: "#fff",
              }}
            >
              Mark Incomplete
            </button>
          </div>
        </div>
      )}

      {sec("🚦", "Status")}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <label style={lbl}>📊 Delivery Status</label>
          <select style={inp} value={d.status} onChange={f("status")}>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>🔄 Completion</label>
          <div style={{ display: "flex", gap: 6 }}>
            {COMPLETION_CYCLE.map((key) => {
              const cfg = COMPLETION_CONFIG[key];
              const active = d.completion === key;
              return (
                <button
                  key={key}
                  onClick={() => setD((x) => ({ ...x, completion: key }))}
                  style={{
                    flex: 1,
                    ...btn,
                    fontSize: 11,
                    padding: "6px 4px",
                    background: active ? cfg.text : cfg.bg,
                    color: active ? "#fff" : cfg.text,
                    border: `2px solid ${cfg.border}`,
                  }}
                >
                  {cfg.icon} {cfg.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {sec("📣", "Accountability")}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <label style={lbl}>📣 Chasers Sent</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() =>
                setD((x) => ({
                  ...x,
                  chasers: Math.max(0, (x.chasers || 0) - 1),
                }))
              }
              style={{
                ...btn,
                padding: "5px 13px",
                background: C.faint,
                border: `2px solid ${C.border}`,
                color: C.text,
                fontSize: 16,
              }}
            >
              −
            </button>
            <span
              style={{
                fontWeight: 900,
                fontSize: 20,
                minWidth: 28,
                textAlign: "center",
                color: d.chasers > 3 ? C.rose.text : C.text,
              }}
            >
              {d.chasers || 0}
            </span>
            <button
              onClick={() =>
                setD((x) => ({ ...x, chasers: (x.chasers || 0) + 1 }))
              }
              style={{
                ...btn,
                padding: "5px 13px",
                background: C.faint,
                border: `2px solid ${C.border}`,
                color: C.text,
                fontSize: 16,
              }}
            >
              +
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <input
              type="checkbox"
              checked={d.excuseAccepted}
              onChange={fBool("excuseAccepted")}
              style={{
                width: 16,
                height: 16,
                cursor: "pointer",
                accentColor: C.mint.text,
              }}
            />
            ✅ Excuse Accepted
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <input
              type="checkbox"
              checked={d.discussedIn1on1}
              onChange={fBool("discussedIn1on1")}
              style={{
                width: 16,
                height: 16,
                cursor: "pointer",
                accentColor: C.sky.text,
              }}
            />
            🗣️ Discussed in 1:1
          </label>
        </div>
        {d.discussedIn1on1 && (
          <div>
            <label style={lbl}>🗓️ 1:1 Date</label>
            <input
              style={inp}
              type="date"
              value={d.discussedDate || ""}
              onChange={f("discussedDate")}
            />
          </div>
        )}
      </div>
      <div style={fld}>
        <label style={lbl}>🎭 Excuse Log (what she said)</label>
        <textarea
          style={{ ...inp, minHeight: 60, resize: "vertical" }}
          value={d.excuseLog}
          onChange={f("excuseLog")}
          placeholder="Record her reason for being late… 🙄"
        />
      </div>
      <div style={fld}>
        <label style={lbl}>💥 Impact of Lateness</label>
        <textarea
          style={{ ...inp, minHeight: 52, resize: "vertical" }}
          value={d.impact}
          onChange={f("impact")}
          placeholder="Who or what was affected? e.g. blocked client presentation…"
        />
      </div>
      <div style={fld}>
        <label style={lbl}>🔒 Manager's Private Notes</label>
        <textarea
          style={{ ...inp, minHeight: 52, resize: "vertical" }}
          value={d.managerNotes}
          onChange={f("managerNotes")}
          placeholder="Your own observations — only visible here 👀"
        />
      </div>

      {sec("🚨", "Escalation & Warnings")}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ gridColumn: isMobile ? "1 / -1" : "auto" }}>
          <label style={lbl}>📈 Escalation Level</label>
          <select style={inp} value={d.escalation} onChange={f("escalation")}>
            {Object.entries(ESCALATION_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        {d.escalation !== "none" && (
          <div>
            <label style={lbl}>🗓️ Escalation Date</label>
            <input
              style={inp}
              type="date"
              value={d.escalationDate || ""}
              onChange={f("escalationDate")}
            />
          </div>
        )}
        <div>
          <label style={lbl}>⚠️ Verbal Warning Date</label>
          <input
            style={inp}
            type="date"
            value={d.verbalWarningDate || ""}
            onChange={f("verbalWarningDate")}
          />
        </div>
        <div>
          <label style={lbl}>📄 Written Warning Date</label>
          <input
            style={inp}
            type="date"
            value={d.writtenWarningDate || ""}
            onChange={f("writtenWarningDate")}
          />
        </div>
      </div>
      <div style={fld}>
        <label style={lbl}>📝 Notes</label>
        <input
          style={inp}
          value={d.notes}
          onChange={f("notes")}
          placeholder="Anything else worth noting…"
        />
      </div>

      {sec("⭐", "Quality of Submission")}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {Object.entries(QUALITY_CONFIG).map(([key, cfg]) => {
            const active = (d.qualityRating || "") === key;
            return (
              <button
                key={key}
                onClick={() =>
                  setD((x) => ({ ...x, qualityRating: active ? "" : key }))
                }
                title={cfg.desc}
                style={{
                  flex: 1,
                  ...btn,
                  fontSize: 12,
                  padding: "9px 6px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  background: active ? cfg.text : cfg.bg,
                  color: active ? "#fff" : cfg.text,
                  border: `2px solid ${cfg.border}`,
                }}
              >
                <span style={{ fontSize: 15 }}>{cfg.label.split(" ")[0]}</span>
                <span style={{ fontWeight: 800, fontSize: 11 }}>
                  {cfg.label.split(" ").slice(1).join(" ")}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    opacity: 0.75,
                    fontWeight: 400,
                    textAlign: "center",
                    lineHeight: 1.3,
                  }}
                >
                  {cfg.desc}
                </span>
              </button>
            );
          })}
        </div>
        {d.qualityRating && (
          <div>
            <label style={lbl}>📝 Quality Notes (what needed changing?)</label>
            <textarea
              style={{ ...inp, minHeight: 52, resize: "vertical" }}
              value={d.qualityNotes || ""}
              onChange={f("qualityNotes")}
              placeholder="Describe what changes or revisions were required…"
            />
          </div>
        )}
      </div>

      {sec("👁️", "Feedback Shared with Reportee")}
      <div
        style={{
          background: d.feedbackShared ? "#ccfbe0" : C.faint,
          border: `2px solid ${d.feedbackShared ? "#5ddba0" : C.border}`,
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 12,
          transition: "all 0.2s",
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: C.muted,
            lineHeight: 1.6,
            marginBottom: 10,
          }}
        >
          ⚠️ <strong>Keep this tracker private.</strong> Use this toggle to
          record when you have verbally or in writing shared feedback about{" "}
          <em>this specific task</em> with your reportee — without sharing the
          tracker itself.
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            marginBottom: d.feedbackShared ? 12 : 0,
          }}
        >
          <input
            type="checkbox"
            checked={d.feedbackShared}
            onChange={fBool("feedbackShared")}
            style={{
              width: 18,
              height: 18,
              cursor: "pointer",
              accentColor: "#0b7a3e",
            }}
          />
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: d.feedbackShared ? "#0b7a3e" : C.text,
            }}
          >
            {d.feedbackShared
              ? "✅ Feedback has been shared"
              : "⬜ Feedback not yet shared"}
          </span>
        </label>
        {d.feedbackShared && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 10,
            }}
          >
            <div>
              <label style={lbl}>📅 Date Shared</label>
              <input
                style={inp}
                type="date"
                value={d.feedbackSharedDate || ""}
                onChange={f("feedbackSharedDate")}
              />
            </div>
            <div>
              <label style={lbl}>📡 How Was it Shared?</label>
              <select
                style={inp}
                value={d.feedbackSharedHow || ""}
                onChange={f("feedbackSharedHow")}
              >
                <option value="">Select method…</option>
                <option value="verbal-1on1">🗣️ Verbal — 1:1 meeting</option>
                <option value="verbal-informal">
                  💬 Verbal — informal conversation
                </option>
                <option value="email">📧 Email</option>
                <option value="written-formal">
                  📄 Written — formal letter
                </option>
                <option value="performance-review">
                  📊 Performance review
                </option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <button
          onClick={() => onSave(d)}
          style={{
            ...btn,
            flex: 1,
            background: C.mint.text,
            color: "#fff",
            fontSize: 14,
            padding: "11px",
          }}
        >
          💾 Save
        </button>
        <button
          onClick={onCancel}
          style={{
            ...btn,
            flex: 1,
            background: C.faint,
            color: C.muted,
            border: `2px solid ${C.border}`,
            fontSize: 14,
            padding: "11px",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  if (isMobile) return formContent;
  return (
    <tr>
      <td
        colSpan={18}
        style={{
          padding: "22px 26px",
          background: "#f8f6ff",
          borderBottom: `2px solid ${C.border}`,
        }}
      >
        <div style={{ maxWidth: 920 }}>{formContent}</div>
      </td>
    </tr>
  );
}

// ── Mobile Card ────────────────────────────────────────────────────────────
function TaskCard({
  task,
  tagList,
  filterTag,
  setFilterTag,
  onEdit,
  onDelete,
  onToggleCompletion,
}) {
  const [expanded, setExpanded] = useState(false);
  const s = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const esc = ESCALATION_CONFIG[task.escalation || "none"];
  const done = task.completion === "complete";
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 16,
        border: `2px solid ${done ? C.mint.border : C.border}`,
        marginBottom: 12,
        overflow: "hidden",
        boxShadow: "0 4px 16px rgba(100,80,220,0.08)",
        opacity: done ? 0.85 : 1,
      }}
    >
      <div
        style={{
          padding: "13px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <div style={{ flexShrink: 0, paddingTop: 2 }}>
          <CompletionToggle
            value={task.completion}
            onChange={(v) => onToggleCompletion(task.id, v)}
            compact
          />
        </div>
        <div
          style={{ flex: 1, minWidth: 0 }}
          onClick={() => setExpanded((e) => !e)}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: 15,
              marginBottom: 6,
              color: C.text,
              textDecoration: done ? "line-through" : "none",
              opacity: done ? 0.55 : 1,
            }}
          >
            {task.task}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <Pill bg={s.bg} text={s.text} border={s.border} small>
              {s.label}
            </Pill>
            {task.taskSize &&
              (() => {
                const sz = TASK_SIZE_CONFIG[task.taskSize];
                return sz ? (
                  <Pill bg={sz.bg} text={sz.text} border={sz.border} small>
                    {sz.label}
                  </Pill>
                ) : null;
              })()}
            <DeltaBadge deadline={task.deadline} delivered={task.delivered} />
            {task.escalation && task.escalation !== "none" && (
              <Pill bg={esc.bg} text={esc.text} border={esc.border} small>
                {esc.label}
              </Pill>
            )}
            {(task.tags || []).map((tag) => (
              <Pill
                key={tag}
                {...tagColor(tag, tagList)}
                small
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterTag(filterTag === tag ? null : tag);
                }}
              >
                {tag}
              </Pill>
            ))}
          </div>
        </div>
        <div
          onClick={() => setExpanded((e) => !e)}
          style={{ fontSize: 20, color: C.muted, flexShrink: 0 }}
        >
          {expanded ? "🔼" : "🔽"}
        </div>
      </div>
      <div
        style={{
          padding: "6px 14px",
          background: C.faint,
          borderTop: `1.5px solid ${C.border}`,
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <span>⏰ {task.deadline ? fmt(task.deadline) : "No deadline"}</span>
        <span>
          📦 {task.delivered ? fmt(task.delivered) : "Not delivered yet"}
        </span>
        {task.chasers > 0 && (
          <span
            style={{ color: task.chasers > 3 ? C.rose.text : C.amber.text }}
          >
            📣 {task.chasers} chaser{task.chasers !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {expanded && (
        <div
          style={{ padding: "14px 14px", borderTop: `1.5px solid ${C.border}` }}
        >
          {task.description && (
            <div
              style={{
                marginBottom: 12,
                fontSize: 13,
                color: C.muted,
                lineHeight: 1.6,
              }}
            >
              {task.description}
            </div>
          )}
          {task.qualityRating &&
            (() => {
              const q = QUALITY_CONFIG[task.qualityRating];
              return q ? (
                <div
                  style={{
                    background: q.bg,
                    border: `1.5px solid ${q.border}`,
                    borderRadius: 10,
                    padding: "8px 11px",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: q.text,
                      marginBottom: task.qualityNotes ? 3 : 0,
                    }}
                  >
                    ⭐ Quality: {q.label}
                  </div>
                  {task.qualityNotes && (
                    <div style={{ fontSize: 12, color: q.text }}>
                      {task.qualityNotes}
                    </div>
                  )}
                </div>
              ) : null;
            })()}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px 14px",
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            {/* Source badge */}
            <div style={{ marginBottom: 10 }}>
              {(task.taskSource || "email") === "email" ? (
                <div
                  style={{
                    background: C.sky.bg,
                    border: `1.5px solid ${C.sky.border}`,
                    borderRadius: 10,
                    padding: "8px 11px",
                  }}
                >
                  <Pill {...C.sky} small style={{ marginBottom: 4 }}>
                    📧 Email
                  </Pill>
                  {task.emailSubject && (
                    <div
                      style={{
                        fontSize: 12,
                        color: C.sky.text,
                        fontStyle: "italic",
                        marginTop: 4,
                      }}
                    >
                      {task.emailSubject}
                    </div>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "4px 12px",
                      marginTop: 6,
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <span style={{ color: C.muted, fontWeight: 700 }}>
                        Received:{" "}
                      </span>
                      {task.emailReceived ? fmt(task.emailReceived) : "—"}
                    </div>
                    <div>
                      <span style={{ color: C.muted, fontWeight: 700 }}>
                        Replied:{" "}
                      </span>
                      {task.reporteeResponded ? (
                        fmt(task.reporteeResponded)
                      ) : (
                        <Pill {...C.peach} small>
                          👻 No reply
                        </Pill>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: C.lilac.bg,
                    border: `1.5px solid ${C.lilac.border}`,
                    borderRadius: 10,
                    padding: "8px 11px",
                  }}
                >
                  <Pill {...C.lilac} small style={{ marginBottom: 4 }}>
                    🗣️ Briefed in Person
                  </Pill>
                  {task.briefingContext && (
                    <div
                      style={{
                        fontSize: 12,
                        color: C.lilac.text,
                        fontStyle: "italic",
                        marginTop: 4,
                      }}
                    >
                      {task.briefingContext}
                    </div>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "4px 12px",
                      marginTop: 6,
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <span style={{ color: C.muted, fontWeight: 700 }}>
                        Date:{" "}
                      </span>
                      {task.briefingDate ? fmt(task.briefingDate) : "—"}
                    </div>
                    <div>
                      {task.confirmedInWritingDate ? (
                        <span>
                          ✅ Confirmed {fmt(task.confirmedInWritingDate)}
                        </span>
                      ) : (
                        <Pill {...C.amber} small>
                          ⚠️ Not confirmed in writing
                        </Pill>
                      )}
                    </div>
                    {task.acknowledgedVerbally && (
                      <div
                        style={{
                          gridColumn: "1/-1",
                          color: C.lilac.text,
                          fontWeight: 600,
                        }}
                      >
                        🗣️ Verbally acknowledged
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {[
              ["🤞 Promised", task.promisedDate],
              ["📅 Period", task.reviewPeriod, false, true],
            ].map(([label, val, isReply, plain]) => (
              <div key={label}>
                <div
                  style={{
                    color: C.muted,
                    fontWeight: 800,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 2,
                  }}
                >
                  {label}
                </div>
                {isReply && !val ? (
                  <Pill {...C.peach} small>
                    👻 No reply
                  </Pill>
                ) : (
                  <span>
                    {val ? (
                      plain ? (
                        val
                      ) : (
                        fmt(val)
                      )
                    ) : (
                      <em style={{ color: C.muted }}>—</em>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
          {task.excuseLog && (
            <div
              style={{
                background: C.amber.bg,
                border: `1.5px solid ${C.amber.border}`,
                borderRadius: 10,
                padding: "8px 11px",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: C.amber.text,
                  marginBottom: 2,
                }}
              >
                🎭 Excuse{" "}
                {task.excuseAccepted ? "✅ Accepted" : "🚫 Not accepted"}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: C.amber.text,
                  fontStyle: "italic",
                }}
              >
                {task.excuseLog}
              </div>
            </div>
          )}
          {task.impact && (
            <div
              style={{
                background: C.rose.bg,
                border: `1.5px solid ${C.rose.border}`,
                borderRadius: 10,
                padding: "8px 11px",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: C.rose.text,
                  marginBottom: 2,
                }}
              >
                💥 Business Impact
              </div>
              <div style={{ fontSize: 12, color: C.rose.text }}>
                {task.impact}
              </div>
            </div>
          )}
          {task.managerNotes && (
            <div
              style={{
                background: C.lilac.bg,
                border: `1.5px solid ${C.lilac.border}`,
                borderRadius: 10,
                padding: "8px 11px",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: C.lilac.text,
                  marginBottom: 2,
                }}
              >
                🔒 Manager Notes (Private)
              </div>
              <div style={{ fontSize: 12, color: C.lilac.text }}>
                {task.managerNotes}
              </div>
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            {task.feedbackShared ? (
              <div
                style={{
                  background: C.mint.bg,
                  border: `1.5px solid ${C.mint.border}`,
                  borderRadius: 10,
                  padding: "8px 11px",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: C.mint.text,
                    marginBottom: 2,
                  }}
                >
                  ✅ Feedback shared with reportee
                </div>
                <div style={{ fontSize: 11, color: C.mint.text }}>
                  {task.feedbackSharedDate &&
                    `📅 ${fmt(task.feedbackSharedDate)}`}
                  {task.feedbackSharedHow &&
                    ` · ${
                      {
                        "verbal-1on1": "🗣️ 1:1 meeting",
                        "verbal-informal": "💬 Informal chat",
                        email: "📧 Email",
                        "written-formal": "📄 Formal letter",
                        "performance-review": "📊 Performance review",
                      }[task.feedbackSharedHow] || task.feedbackSharedHow
                    }`}
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: C.faint,
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 10,
                  padding: "8px 11px",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>
                  ⬜ Feedback not yet shared with reportee
                </div>
              </div>
            )}
          </div>
          {task.melTookOver && task.completion !== "incomplete" && (
            <div
              style={{
                background: C.amber.bg,
                border: `1.5px solid ${C.amber.border}`,
                borderRadius: 10,
                padding: "9px 11px",
                marginBottom: 8,
              }}
            >
              <div
                style={{ fontSize: 12, fontWeight: 800, color: C.amber.text }}
              >
                🤝 Mel took over {fmt(task.melTookOver)} — mark as Incomplete?
              </div>
              <button
                onClick={() => onToggleCompletion(task.id, "incomplete")}
                style={{
                  marginTop: 6,
                  ...btn,
                  fontSize: 11,
                  padding: "4px 12px",
                  background: C.amber.text,
                  color: "#fff",
                }}
              >
                Mark Incomplete
              </button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button
              onClick={() => onEdit(task.id)}
              style={{
                ...btn,
                flex: 1,
                background: C.sky.bg,
                color: C.sky.text,
                border: `2px solid ${C.sky.border}`,
                padding: "9px",
              }}
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => onDelete(task.id)}
              style={{
                ...btn,
                flex: 1,
                background: C.rose.bg,
                color: C.rose.text,
                border: `2px solid ${C.rose.border}`,
                padding: "9px",
              }}
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── L&D Summary Panel (for dashboard) ─────────────────────────────────────

// ── Productivity Panel (weighted points per week — goldfish to workhorse) ───
function ProductivityPanel({ tasks, isMobile }) {
  const completed = tasks.filter(
    (t) => t.completion === "complete" && t.delivered
  );
  const weekMap = {};
  completed.forEach((t) => {
    const key = getWeekKey(t.delivered);
    const pts = (
      TASK_SIZE_CONFIG[t.taskSize || "medium"] || TASK_SIZE_CONFIG.medium
    ).points;
    weekMap[key] = (weekMap[key] || 0) + pts;
  });
  const weeks = Object.values(weekMap);
  // Average weighted points per week (small=1, medium=2, large=3)
  // Workhorse threshold: 8 pts/week (~4 medium tasks or 2-3 large)
  const avg =
    weeks.length === 0
      ? null
      : Math.round((weeks.reduce((a, b) => a + b, 0) / weeks.length) * 10) / 10;
  const max = weeks.length === 0 ? 0 : Math.max(...weeks);
  const pct = avg === null ? null : Math.min(100, Math.round((avg / 8) * 100));
  const color =
    avg === null
      ? "#8078a8"
      : avg >= 7
      ? "#076b50"
      : avg >= 4
      ? "#7a5200"
      : "#b5124a";
  const label =
    avg === null
      ? "No completed tasks yet 🐣"
      : avg >= 8
      ? "Total workhorse 🐎💨"
      : avg >= 6
      ? "Strong performer 💪"
      : avg >= 4
      ? "Steady pace 🚶"
      : avg >= 2
      ? "Slow but moving 🐢"
      : avg >= 1
      ? "Almost a goldfish 🐠"
      : "Goldfish mode 🐟";

  return (
    <ScorePanel
      title="Weekly Productivity"
      emoji="📊"
      score={avg === null ? "—" : `${avg}pts/wk`}
      scoreLabel={label}
      color={color}
      pct={pct}
      trackLeft="🐟 Goldfish"
      trackRight="🐎 Workhorse"
      isMobile={isMobile}
    >
      <div
        style={{
          fontSize: 10,
          color: C.muted,
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        🟡 Small=1pt · 🟠 Medium=2pts · 🔴 Large=3pts
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {completed.length > 0 && (
          <Pill {...C.mint} small>
            ✅ {completed.length} done
          </Pill>
        )}
        {max > 0 && (
          <Pill {...C.sky} small>
            🏆 Best week: {max}pts
          </Pill>
        )}
        {weeks.length > 0 && (
          <Pill {...C.slate} small>
            📅 {weeks.length} week{weeks.length !== 1 ? "s" : ""} tracked
          </Pill>
        )}
      </div>
    </ScorePanel>
  );
}

// ── Task Weight Overview Panel ─────────────────────────────────────────────
function TaskWeightPanel({ tasks, isMobile }) {
  const active = tasks.filter((t) => t.completion !== "complete");
  const counts = { small: 0, medium: 0, large: 0 };
  active.forEach((t) => {
    const s = t.taskSize || "medium";
    if (counts[s] !== undefined) counts[s]++;
  });
  const total = active.length;
  const totalPts = counts.small * 1 + counts.medium * 2 + counts.large * 3;

  return (
    <div
      style={{
        background: C.surface,
        border: `2px solid ${C.border}`,
        borderRadius: 16,
        padding: isMobile ? "14px 16px" : "18px 22px",
        flex: "1 1 200px",
        boxShadow: "0 4px 20px rgba(100,80,220,0.08)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: C.muted,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 12,
        }}
      >
        ⚖️ What's On Her Plate
      </div>
      {total === 0 ? (
        <div style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>
          No active tasks 🎉
        </div>
      ) : (
        <>
          {/* Visual bar */}
          <div
            style={{
              display: "flex",
              borderRadius: 8,
              overflow: "hidden",
              height: 18,
              marginBottom: 10,
              gap: 2,
            }}
          >
            {counts.large > 0 && (
              <div
                title={`${counts.large} large`}
                style={{
                  flex: counts.large * 3,
                  background: TASK_SIZE_CONFIG.large.text,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: "#fff",
                  fontWeight: 800,
                  minWidth: 18,
                }}
              >
                {counts.large}
              </div>
            )}
            {counts.medium > 0 && (
              <div
                title={`${counts.medium} medium`}
                style={{
                  flex: counts.medium * 2,
                  background: TASK_SIZE_CONFIG.medium.text,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: "#fff",
                  fontWeight: 800,
                  minWidth: 18,
                }}
              >
                {counts.medium}
              </div>
            )}
            {counts.small > 0 && (
              <div
                title={`${counts.small} small`}
                style={{
                  flex: counts.small * 1,
                  background: TASK_SIZE_CONFIG.small.text,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: "#fff",
                  fontWeight: 800,
                  minWidth: 18,
                }}
              >
                {counts.small}
              </div>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              marginBottom: 10,
            }}
          >
            {Object.entries(TASK_SIZE_CONFIG).map(([key, cfg]) => (
              <div
                key={key}
                style={{
                  background: cfg.bg,
                  border: `2px solid ${cfg.border}`,
                  borderRadius: 10,
                  padding: "8px 6px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 900, color: cfg.text }}>
                  {counts[key]}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: cfg.text }}>
                  {cfg.label}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: C.muted,
              fontWeight: 600,
            }}
          >
            <span>
              📋 {total} active task{total !== 1 ? "s" : ""}
            </span>
            <span>⚖️ {totalPts} total pts</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Helper: get ISO week label for a date string ───────────────────────────
function getWeekLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const weekNum = Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7);
  // Get Monday of that week
  const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - dayOfWeek + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmtShort = (dt) =>
    dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `w/c ${fmtShort(monday)} – ${fmtShort(sunday)}`;
}

function getWeekKey(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const weekNum = Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function LDSummaryPanel({ ldItems, isMobile }) {
  const total = ldItems.length;
  const engaged = ldItems.filter((i) => i.reporteeEngaged).length;
  const noAction = ldItems.filter(
    (i) => i.status === "no-action" || i.status === "declined"
  ).length;
  const overdue = ldItems.filter((i) => i.status === "overdue").length;
  const pending = ldItems.filter(
    (i) => i.status === "pending" && !i.followedUp
  ).length;
  const pct = total === 0 ? null : Math.round((engaged / total) * 100);
  const color =
    pct === null
      ? C.muted
      : pct >= 70
      ? "#076b50"
      : pct >= 40
      ? "#7a5200"
      : "#b5124a";
  const label =
    pct === null
      ? "No entries yet"
      : pct >= 70
      ? "Actively engaging 🌟"
      : pct >= 40
      ? "Patchy engagement 🤔"
      : "Not engaging 😶";
  return (
    <div
      style={{
        background: C.surface,
        border: `2px solid ${C.border}`,
        borderRadius: 16,
        padding: isMobile ? "14px 16px" : "18px 22px",
        flex: "1 1 240px",
        boxShadow: "0 4px 20px rgba(100,80,220,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: C.muted,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 3,
            }}
          >
            📚 L&D Engagement
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color }}>{label}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1 }}>
            {pct === null ? "—" : `${pct}%`}
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            {engaged} of {total} engaged
          </div>
        </div>
      </div>
      <div
        style={{
          position: "relative",
          height: 14,
          borderRadius: 99,
          background:
            "linear-gradient(to right, #ff7eb6 0%, #ffd966 50%, #5ddba0 100%)",
          border: `1.5px solid ${C.border}`,
          marginBottom: 4,
        }}
      >
        {pct !== null && (
          <div
            style={{
              position: "absolute",
              left: `${Math.max(2, Math.min(98, pct))}%`,
              top: "50%",
              transform: "translate(-50%,-50%)",
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "#fff",
              border: `3px solid ${color}`,
              boxShadow: "0 3px 10px rgba(0,0,0,0.18)",
              zIndex: 2,
            }}
          />
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: C.muted,
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        <span>😶 Not engaging</span>
        <span>🌟 Fully engaged</span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {overdue > 0 && (
          <Pill {...C.rose} small>
            🔴 {overdue} overdue
          </Pill>
        )}
        {noAction > 0 && (
          <Pill {...C.peach} small>
            😶 {noAction} no action
          </Pill>
        )}
        {pending > 0 && (
          <Pill {...C.amber} small>
            ⏳ {pending} awaiting follow-up
          </Pill>
        )}
        {engaged > 0 && (
          <Pill {...C.mint} small>
            ✅ {engaged} completed
          </Pill>
        )}
      </div>
    </div>
  );
}

// ── L&D Log Entry Form ─────────────────────────────────────────────────────
function LDForm({ row, onSave, onCancel, isMobile }) {
  const [d, setD] = useState({ ...row });
  const f = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));
  const fBool = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.checked }));
  const inp = {
    width: "100%",
    border: `2px solid ${C.border}`,
    borderRadius: 10,
    padding: "7px 10px",
    fontFamily: "inherit",
    fontSize: 13,
    background: C.faint,
    color: C.text,
    outline: "none",
  };
  const lbl = {
    display: "block",
    fontSize: 10,
    fontWeight: 800,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    marginBottom: 3,
  };
  return (
    <div
      style={{
        background: "#f8f6ff",
        border: `2px solid ${C.border}`,
        borderRadius: 14,
        padding: "18px 20px",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: 15,
          marginBottom: 14,
          color: C.text,
        }}
      >
        {row.id ? "✏️ Edit Entry" : "➕ New L&D Entry"}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div>
          <label style={lbl}>📂 Type</label>
          <select style={inp} value={d.type} onChange={f("type")}>
            {Object.entries(LD_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>🚦 Status</label>
          <select style={inp} value={d.status} onChange={f("status")}>
            {Object.entries(LD_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: isMobile ? "auto" : "1 / -1" }}>
          <label style={lbl}>📝 Title</label>
          <input
            style={inp}
            value={d.title}
            onChange={f("title")}
            placeholder="e.g. Homework: Review 3 competitor media plans"
          />
        </div>
        <div>
          <label style={lbl}>📅 Date Set / Offered</label>
          <input
            style={inp}
            type="date"
            value={d.date || ""}
            onChange={f("date")}
          />
        </div>
        <div>
          <label style={lbl}>🗓️ Follow-up Due Date</label>
          <input
            style={inp}
            type="date"
            value={d.followUpDate || ""}
            onChange={f("followUpDate")}
          />
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>📋 Description / What was agreed</label>
        <textarea
          style={{ ...inp, minHeight: 60, resize: "vertical" }}
          value={d.description}
          onChange={f("description")}
          placeholder="What exactly was set, agreed, or offered?"
        />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>📤 Outcome / Her Response</label>
        <textarea
          style={{ ...inp, minHeight: 52, resize: "vertical" }}
          value={d.outcome}
          onChange={f("outcome")}
          placeholder="What happened? Did she complete it, decline, ignore it?"
        />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>🔒 Manager Notes (Private)</label>
        <textarea
          style={{ ...inp, minHeight: 48, resize: "vertical" }}
          value={d.managerNotes}
          onChange={f("managerNotes")}
          placeholder="Your private observations…"
        />
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <input
            type="checkbox"
            checked={d.followedUp}
            onChange={fBool("followedUp")}
            style={{ width: 16, height: 16, accentColor: C.sky.text }}
          />
          ✅ I have followed up
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <input
            type="checkbox"
            checked={d.reporteeEngaged}
            onChange={fBool("reporteeEngaged")}
            style={{ width: 16, height: 16, accentColor: C.mint.text }}
          />
          🌟 Reportee engaged / completed
        </label>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => onSave(d)}
          style={{
            ...btn,
            flex: 1,
            background: C.mint.text,
            color: "#fff",
            fontSize: 14,
            padding: "10px",
          }}
        >
          💾 Save
        </button>
        <button
          onClick={onCancel}
          style={{
            ...btn,
            flex: 1,
            background: C.faint,
            color: C.muted,
            border: `2px solid ${C.border}`,
            fontSize: 14,
            padding: "10px",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── L&D Log Card ───────────────────────────────────────────────────────────
function LDCard({ item, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const type = LD_TYPES[item.type] || LD_TYPES.homework;
  const status = LD_STATUS[item.status] || LD_STATUS.pending;
  const isOverdue =
    !item.followedUp &&
    item.followUpDate &&
    item.followUpDate < new Date().toISOString().slice(0, 10);
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 14,
        border: `2px solid ${
          item.reporteeEngaged ? "#3dddb0" : isOverdue ? "#ffaacc" : C.border
        }`,
        marginBottom: 10,
        overflow: "hidden",
        boxShadow: "0 3px 14px rgba(100,80,220,0.07)",
      }}
    >
      <div
        style={{
          padding: "13px 16px",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          cursor: "pointer",
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 6,
            }}
          >
            <Pill bg={type.bg} text={type.text} border={type.border} small>
              {type.label}
            </Pill>
            <Pill
              bg={status.bg}
              text={status.text}
              border={status.border}
              small
            >
              {status.label}
            </Pill>
            {item.reporteeEngaged && (
              <Pill {...C.mint} small>
                🌟 Engaged
              </Pill>
            )}
            {isOverdue && !item.followedUp && (
              <Pill {...C.rose} small>
                ⚠️ Follow-up overdue
              </Pill>
            )}
          </div>
          <div
            style={{
              fontWeight: 800,
              fontSize: 14,
              color: C.text,
              marginBottom: 3,
            }}
          >
            {item.title}
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            {item.date ? `Set: ${fmt(item.date)}` : ""}
            {item.followUpDate ? ` · Follow-up: ${fmt(item.followUpDate)}` : ""}
          </div>
        </div>
        <div style={{ fontSize: 18, color: C.muted, flexShrink: 0 }}>
          {expanded ? "🔼" : "🔽"}
        </div>
      </div>
      {expanded && (
        <div
          style={{
            padding: "0 16px 14px",
            borderTop: `1.5px solid ${C.border}`,
            paddingTop: 12,
          }}
        >
          {item.description && (
            <div
              style={{
                fontSize: 13,
                color: C.text,
                lineHeight: 1.6,
                marginBottom: 10,
              }}
            >
              {item.description}
            </div>
          )}
          {item.outcome && (
            <div
              style={{
                background: item.reporteeEngaged ? C.mint.bg : C.peach.bg,
                border: `1.5px solid ${
                  item.reporteeEngaged ? C.mint.border : C.peach.border
                }`,
                borderRadius: 10,
                padding: "8px 11px",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: item.reporteeEngaged ? C.mint.text : C.peach.text,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 2,
                }}
              >
                📤 Outcome / Her Response
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: item.reporteeEngaged ? C.mint.text : C.peach.text,
                }}
              >
                {item.outcome}
              </div>
            </div>
          )}
          {item.managerNotes && (
            <div
              style={{
                background: C.lilac.bg,
                border: `1.5px solid ${C.lilac.border}`,
                borderRadius: 10,
                padding: "8px 11px",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: C.lilac.text,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 2,
                }}
              >
                🔒 Manager Notes (Private)
              </div>
              <div style={{ fontSize: 12, color: C.lilac.text }}>
                {item.managerNotes}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() => onEdit(item)}
              style={{
                ...btn,
                flex: 1,
                background: C.sky.bg,
                color: C.sky.text,
                border: `2px solid ${C.sky.border}`,
                padding: "8px",
              }}
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => onDelete(item.id)}
              style={{
                ...btn,
                flex: 1,
                background: C.rose.bg,
                color: C.rose.text,
                border: `2px solid ${C.rose.border}`,
                padding: "8px",
              }}
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Meeting Summary Panel ──────────────────────────────────────────────────
function MeetingSummaryPanel({ meetings, isMobile }) {
  const total = meetings.length;
  const tones = {
    collaborative: 0,
    mixed: 0,
    defensive: 0,
    emotional: 0,
    hostile: 0,
  };
  meetings.forEach((m) => {
    if (m.tone && tones[m.tone] !== undefined) tones[m.tone]++;
  });
  const concerning =
    (tones.defensive || 0) + (tones.emotional || 0) + (tones.hostile || 0);
  const pct =
    total === 0
      ? null
      : Math.round(((tones.collaborative + tones.mixed * 0.5) / total) * 100);
  const color =
    pct === null
      ? "#8078a8"
      : pct >= 70
      ? "#076b50"
      : pct >= 40
      ? "#7a5200"
      : "#b5124a";
  const label =
    pct === null
      ? "No meetings logged yet"
      : pct >= 70
      ? "Generally receptive 🙂"
      : pct >= 40
      ? "Often defensive 😐"
      : "Consistently resistant 😤";
  return (
    <div
      style={{
        background: C.surface,
        border: `2px solid ${C.border}`,
        borderRadius: 16,
        padding: isMobile ? "14px 16px" : "18px 22px",
        flex: "1 1 220px",
        boxShadow: "0 4px 20px rgba(100,80,220,0.08)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: C.muted,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 10,
        }}
      >
        🗓️ Meeting Behaviour
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>
          {total === 0 ? "—" : `${total}`}
          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>
            {" "}
            mtgs
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {Object.entries(tones)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => {
            const cfg = MEETING_TONE_CONFIG[k];
            return (
              <Pill
                key={k}
                bg={cfg.bg}
                text={cfg.text}
                border={cfg.border}
                small
              >
                {cfg.label} {v}
              </Pill>
            );
          })}
        {total === 0 && (
          <span style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>
            Add your first meeting below
          </span>
        )}
      </div>
      {concerning > 0 && (
        <div
          style={{
            marginTop: 8,
            background: C.rose.bg,
            border: `1.5px solid ${C.rose.border}`,
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 11,
            fontWeight: 700,
            color: C.rose.text,
          }}
        >
          ⚠️ {concerning} meeting{concerning !== 1 ? "s" : ""} with defensive,
          emotional or hostile behaviour
        </div>
      )}
    </div>
  );
}

// ── Meeting Form ───────────────────────────────────────────────────────────
function MeetingForm({ row, onSave, onCancel, isMobile }) {
  const [d, setD] = useState({ ...row });
  const f = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));
  const fBool = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.checked }));
  const inp = {
    width: "100%",
    border: `2px solid ${C.border}`,
    borderRadius: 10,
    padding: "7px 10px",
    fontFamily: "inherit",
    fontSize: 13,
    background: C.faint,
    color: C.text,
    outline: "none",
  };
  const lbl = {
    display: "block",
    fontSize: 10,
    fontWeight: 800,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    marginBottom: 3,
  };
  const fld = { marginBottom: 12 };
  const sec = (emoji, title) => (
    <div
      style={{
        fontSize: 12,
        fontWeight: 800,
        color: C.text,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 10,
        marginTop: 18,
        paddingBottom: 6,
        borderBottom: `2px solid ${C.border}`,
      }}
    >
      {emoji} {title}
    </div>
  );
  const chk = (k, label) => (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 700,
        marginBottom: 8,
      }}
    >
      <input
        type="checkbox"
        checked={d[k] || false}
        onChange={fBool(k)}
        style={{ width: 16, height: 16, accentColor: C.lilac.text }}
      />
      {label}
    </label>
  );

  return (
    <div
      style={{
        background: "#f8f6ff",
        border: `2px solid ${C.border}`,
        borderRadius: 14,
        padding: "18px 20px",
        marginBottom: 14,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 14 }}>
        {row.id ? "✏️ Edit Meeting" : "➕ Log a Meeting"}
      </div>

      {sec("📋", "Meeting Details")}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <label style={lbl}>📅 Date</label>
          <input
            style={inp}
            type="date"
            value={d.date || ""}
            onChange={f("date")}
          />
        </div>
        <div style={{ gridColumn: isMobile ? "1 / -1" : "auto" }}>
          <label style={lbl}>📌 Meeting Type</label>
          <select
            style={inp}
            value={d.type || "one-on-one"}
            onChange={f("type")}
          >
            {Object.entries(MEETING_TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>👥 Who Was Present</label>
          <input
            style={inp}
            value={d.attendees || ""}
            onChange={f("attendees")}
            placeholder="e.g. You, Reportee, Manager A"
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        {chk("givenNotice", "📢 She was given advance notice")}
        {chk("agendaShared", "📄 Agenda was shared beforehand")}
      </div>
      <div style={fld}>
        <label style={lbl}>💬 What Was Discussed</label>
        <textarea
          style={{ ...inp, minHeight: 72, resize: "vertical" }}
          value={d.whatDiscussed || ""}
          onChange={f("whatDiscussed")}
          placeholder="Summary of topics covered in the meeting…"
        />
      </div>

      {sec("🎭", "Her Behaviour & Reaction")}
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Overall Tone</label>
        <div
          style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}
        >
          {Object.entries(MEETING_TONE_CONFIG).map(([key, cfg]) => {
            const active = d.tone === key;
            return (
              <button
                key={key}
                onClick={() => setD((x) => ({ ...x, tone: active ? "" : key }))}
                style={{
                  ...{
                    borderRadius: 10,
                    padding: "7px 15px",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "none",
                  },
                  background: active ? cfg.text : cfg.bg,
                  color: active ? "#fff" : cfg.text,
                  border: `2px solid ${cfg.border}`,
                }}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={fld}>
        <label style={lbl}>
          👁️ Specific Observations (body language, engagement, demeanour)
        </label>
        <textarea
          style={{ ...inp, minHeight: 60, resize: "vertical" }}
          value={d.observations || ""}
          onChange={f("observations")}
          placeholder="e.g. Avoided eye contact, arms crossed, became tearful when asked about deadlines…"
        />
      </div>
      <div style={fld}>
        <label style={lbl}>💬 Direct Quotes (verbatim things she said)</label>
        <textarea
          style={{ ...inp, minHeight: 60, resize: "vertical" }}
          value={d.directQuotes || ""}
          onChange={f("directQuotes")}
          placeholder='e.g. "My manager is aware of everything I do"…'
        />
      </div>
      <div style={fld}>
        <label style={lbl}>
          ⚠️ Claims She Made (assertions about workload, others, the company)
        </label>
        <textarea
          style={{ ...inp, minHeight: 52, resize: "vertical" }}
          value={d.claimsMade || ""}
          onChange={f("claimsMade")}
          placeholder="e.g. Claimed she had been given extra projects not in her job scope…"
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        {chk("deflected", "↩️ She deflected or redirected questions")}
        {chk("mentionedOthers", "👥 She brought up other colleagues")}
        {chk("visibleDistress", "😢 Visible emotional distress (tears etc.)")}
      </div>

      {sec("✅", "Accountability")}
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Did She Acknowledge the Feedback?</label>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          {Object.entries(MEETING_ACKNOWLEDGE_CONFIG).map(([key, cfg]) => {
            const active = d.acknowledgedFeedback === key;
            return (
              <button
                key={key}
                onClick={() =>
                  setD((x) => ({
                    ...x,
                    acknowledgedFeedback: active ? "" : key,
                  }))
                }
                style={{
                  flex: 1,
                  ...{
                    borderRadius: 10,
                    padding: "8px",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  },
                  background: active ? cfg.text : cfg.bg,
                  color: active ? "#fff" : cfg.text,
                  border: `2px solid ${cfg.border}`,
                }}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={fld}>
        <label style={lbl}>🤝 Actions She Committed To</label>
        <textarea
          style={{ ...inp, minHeight: 52, resize: "vertical" }}
          value={d.committedToActions || ""}
          onChange={f("committedToActions")}
          placeholder="e.g. Agreed to send weekly progress updates every Friday…"
        />
      </div>

      {sec("🔍", "After the Meeting")}
      <div style={fld}>
        <label style={lbl}>🚶 Her Behaviour Immediately After</label>
        <textarea
          style={{ ...inp, minHeight: 52, resize: "vertical" }}
          value={d.behaviourAfter || ""}
          onChange={f("behaviourAfter")}
          placeholder="e.g. Disappeared from desk, did not respond to messages, silent with the team…"
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        {chk(
          "followedUpInWriting",
          "📧 She followed up in writing after the meeting"
        )}
        {chk("followUpRequired", "📅 Follow-up required from me")}
        {chk("escalationTriggered", "🚨 This meeting triggered an escalation")}
      </div>
      {d.followUpRequired && (
        <div style={fld}>
          <label style={lbl}>📅 Follow-up Date</label>
          <input
            style={inp}
            type="date"
            value={d.followUpDate || ""}
            onChange={f("followUpDate")}
          />
        </div>
      )}

      {sec("🔒", "Private Manager Notes")}
      <div style={fld}>
        <label style={lbl}>Your Private Observations (not shared)</label>
        <textarea
          style={{ ...inp, minHeight: 60, resize: "vertical" }}
          value={d.managerNotes || ""}
          onChange={f("managerNotes")}
          placeholder="Your own read of the situation, things you noticed that weren't said aloud…"
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <button
          onClick={() => onSave(d)}
          style={{
            ...{
              borderRadius: 10,
              padding: "7px 15px",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              border: "none",
            },
            flex: 1,
            background: C.lilac.text,
            color: "#fff",
            padding: "11px",
          }}
        >
          💾 Save
        </button>
        <button
          onClick={onCancel}
          style={{
            ...{
              borderRadius: 10,
              padding: "7px 15px",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              border: "none",
            },
            flex: 1,
            background: C.faint,
            color: C.muted,
            border: `2px solid ${C.border}`,
            padding: "11px",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Meeting Card ───────────────────────────────────────────────────────────
function MeetingCard({ meeting, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const type = MEETING_TYPE_CONFIG[meeting.type] || MEETING_TYPE_CONFIG.other;
  const tone = meeting.tone ? MEETING_TONE_CONFIG[meeting.tone] : null;
  const ack = meeting.acknowledgedFeedback
    ? MEETING_ACKNOWLEDGE_CONFIG[meeting.acknowledgedFeedback]
    : null;
  const flags = [
    meeting.deflected && "↩️ Deflected",
    meeting.mentionedOthers && "👥 Mentioned others",
    meeting.visibleDistress && "😢 Visible distress",
    meeting.escalationTriggered && "🚨 Escalation triggered",
  ].filter(Boolean);

  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 14,
        border: `2px solid ${tone ? tone.border : C.border}`,
        marginBottom: 10,
        overflow: "hidden",
        boxShadow: "0 3px 14px rgba(100,80,220,0.07)",
      }}
    >
      <div
        style={{
          padding: "13px 16px",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          cursor: "pointer",
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 6,
            }}
          >
            <Pill bg={type.bg} text={type.text} border={type.border} small>
              {type.label}
            </Pill>
            {tone && (
              <Pill bg={tone.bg} text={tone.text} border={tone.border} small>
                {tone.label}
              </Pill>
            )}
            {ack && (
              <Pill bg={ack.bg} text={ack.text} border={ack.border} small>
                Acknowledged: {ack.label}
              </Pill>
            )}
            {meeting.followUpRequired && !meeting.followedUpInWriting && (
              <Pill {...C.amber} small>
                📅 Follow-up due
              </Pill>
            )}
          </div>
          <div
            style={{
              fontWeight: 800,
              fontSize: 14,
              color: C.text,
              marginBottom: 2,
            }}
          >
            {meeting.date ? fmt(meeting.date) : "No date set"}
            {meeting.attendees && (
              <span style={{ fontWeight: 400, color: C.muted, fontSize: 12 }}>
                {" "}
                · {meeting.attendees}
              </span>
            )}
          </div>
          {meeting.whatDiscussed && (
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
              {meeting.whatDiscussed.length > 80
                ? meeting.whatDiscussed.slice(0, 80) + "…"
                : meeting.whatDiscussed}
            </div>
          )}
          {flags.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 5,
                flexWrap: "wrap",
                marginTop: 6,
              }}
            >
              {flags.map((f) => (
                <span
                  key={f}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.rose.text,
                    background: C.rose.bg,
                    border: `1px solid ${C.rose.border}`,
                    borderRadius: 99,
                    padding: "1px 7px",
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ fontSize: 18, color: C.muted, flexShrink: 0 }}>
          {expanded ? "🔼" : "🔽"}
        </div>
      </div>

      {expanded && (
        <div
          style={{
            padding: "0 16px 14px",
            borderTop: `1.5px solid ${C.border}`,
            paddingTop: 12,
          }}
        >
          {meeting.directQuotes && (
            <div
              style={{
                background: C.amber.bg,
                border: `1.5px solid ${C.amber.border}`,
                borderRadius: 10,
                padding: "8px 11px",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: C.amber.text,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 3,
                }}
              >
                💬 Direct Quotes
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: C.amber.text,
                  fontStyle: "italic",
                }}
              >
                "{meeting.directQuotes}"
              </div>
            </div>
          )}
          {meeting.claimsMade && (
            <div
              style={{
                background: C.peach.bg,
                border: `1.5px solid ${C.peach.border}`,
                borderRadius: 10,
                padding: "8px 11px",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: C.peach.text,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 3,
                }}
              >
                ⚠️ Claims Made
              </div>
              <div style={{ fontSize: 12, color: C.peach.text }}>
                {meeting.claimsMade}
              </div>
            </div>
          )}
          {meeting.observations && (
            <div
              style={{
                background: C.lilac.bg,
                border: `1.5px solid ${C.lilac.border}`,
                borderRadius: 10,
                padding: "8px 11px",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: C.lilac.text,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 3,
                }}
              >
                👁️ Observations
              </div>
              <div style={{ fontSize: 12, color: C.lilac.text }}>
                {meeting.observations}
              </div>
            </div>
          )}
          {meeting.committedToActions && (
            <div
              style={{
                background: C.mint.bg,
                border: `1.5px solid ${C.mint.border}`,
                borderRadius: 10,
                padding: "8px 11px",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: C.mint.text,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 3,
                }}
              >
                🤝 Committed To
              </div>
              <div style={{ fontSize: 12, color: C.mint.text }}>
                {meeting.committedToActions}
              </div>
            </div>
          )}
          {meeting.behaviourAfter && (
            <div
              style={{
                background: C.rose.bg,
                border: `1.5px solid ${C.rose.border}`,
                borderRadius: 10,
                padding: "8px 11px",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: C.rose.text,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 3,
                }}
              >
                🚶 Behaviour After
              </div>
              <div style={{ fontSize: 12, color: C.rose.text }}>
                {meeting.behaviourAfter}
              </div>
            </div>
          )}
          {meeting.managerNotes && (
            <div
              style={{
                background: C.slate.bg,
                border: `1.5px solid ${C.slate.border}`,
                borderRadius: 10,
                padding: "8px 11px",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: C.slate.text,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 3,
                }}
              >
                🔒 Private Notes
              </div>
              <div style={{ fontSize: 12, color: C.slate.text }}>
                {meeting.managerNotes}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() => onEdit(meeting)}
              style={{
                ...{
                  borderRadius: 10,
                  padding: "7px 15px",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                },
                flex: 1,
                background: C.sky.bg,
                color: C.sky.text,
                border: `2px solid ${C.sky.border}`,
                padding: "8px",
              }}
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => onDelete(meeting.id)}
              style={{
                ...{
                  borderRadius: 10,
                  padding: "7px 15px",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                },
                flex: 1,
                background: C.rose.bg,
                color: C.rose.text,
                border: `2px solid ${C.rose.border}`,
                padding: "8px",
              }}
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        onClick={onClose}
        style={{ flex: "0 0 50px", background: "rgba(30,26,60,0.4)" }}
      />
      <div
        style={{
          flex: 1,
          background: C.surface,
          overflowY: "auto",
          borderRadius: "20px 20px 0 0",
          padding: "18px 16px 40px",
        }}
      >
        <div
          style={{
            width: 40,
            height: 5,
            background: C.border,
            borderRadius: 9,
            margin: "0 auto 16px",
          }}
        />
        {children}
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const width = useWindowWidth();
  const isMobile = width < 768;
  const [tasks, setTasks] = useState(() => {
    try {
      const s = localStorage.getItem("tasktracker_v4");
      return s ? JSON.parse(s) : INITIAL_DATA;
    } catch {
      return INITIAL_DATA;
    }
  });
  const [ldItems, setLdItems] = useState(() => {
    try {
      const s = localStorage.getItem("tasktracker_ld_v1");
      return s ? JSON.parse(s) : INITIAL_LD;
    } catch {
      return INITIAL_LD;
    }
  });
  const [meetingItems, setMeetingItems] = useState(() => {
    try {
      const s = localStorage.getItem("tasktracker_meetings_v1");
      return s ? JSON.parse(s) : INITIAL_MEETINGS;
    } catch {
      return INITIAL_MEETINGS;
    }
  });
  const [activeTab, setActiveTab] = useState("tasks");
  const [editingId, setEditingId] = useState(null);
  const [editingLd, setEditingLd] = useState(null);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [meetingFilterTone, setMeetingFilterTone] = useState(null);
  const [filterTag, setFilterTag] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterCompletion, setFilterCompletion] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState(null);
  const [ldFilterType, setLdFilterType] = useState(null);
  const [ldFilterStatus, setLdFilterStatus] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle"); // "idle" | "saving" | "saved" | "error" | "loading"
  const fileRef = useRef();

  // ── Load from Supabase on mount ──
  // Use a ref to track whether the initial load is complete before allowing saves
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!USE_SUPABASE) {
      loadedRef.current = true;
      return;
    }
    setSyncStatus("loading");
    Promise.all([sb.get("tasks"), sb.get("ld_items"), sb.get("meeting_items")])
      .then(([t, l, m]) => {
        if (t.length > 0)
          setTasks(t.map((r) => ({ ...r, tags: r.tags || [] })));
        if (l.length > 0) setLdItems(l);
        if (m.length > 0) setMeetingItems(m);
        setSyncStatus("idle");
        loadedRef.current = true;
      })
      .catch(() => {
        setSyncStatus("error");
        loadedRef.current = true;
      });
  }, []);

  // ── Keep-alive ping every 5 days to prevent Supabase free tier pausing ──
  useEffect(() => {
    if (!USE_SUPABASE) return;
    const ping = () => sb.get("tasks").catch(() => {});
    const id = setInterval(ping, 1000 * 60 * 60 * 24 * 5);
    return () => clearInterval(id);
  }, []);

  // ── Sync tasks to Supabase + localStorage on change ──
  // Only runs after initial load is complete to prevent overwriting cloud data
  useEffect(() => {
    try {
      localStorage.setItem("tasktracker_v4", JSON.stringify(tasks));
    } catch {}
    if (!USE_SUPABASE || !loadedRef.current) return;
    setSyncStatus("saving");
    sb.upsert("tasks", tasks)
      .then(() => setSyncStatus("saved"))
      .catch(() => setSyncStatus("error"));
  }, [tasks]);

  // ── Sync ldItems to Supabase + localStorage on change ──
  useEffect(() => {
    try {
      localStorage.setItem("tasktracker_ld_v1", JSON.stringify(ldItems));
    } catch {}
    if (!USE_SUPABASE || !loadedRef.current) return;
    sb.upsert("ld_items", ldItems)
      .then(() => {})
      .catch(() => {});
  }, [ldItems]);

  const saveLd = (draft) => {
    if (!draft.id || editingLd === "new")
      setLdItems((ls) => [...ls, { ...draft, id: Date.now() }]);
    else setLdItems((ls) => ls.map((l) => (l.id === draft.id ? draft : l)));
    setEditingLd(null);
  };
  const deleteLd = (id) => {
    if (!window.confirm("🗑️ Delete this L&D entry?")) return;
    setLdItems((ls) => ls.filter((l) => l.id !== id));
    if (USE_SUPABASE) sb.del("ld_items", id).catch(() => {});
  };

  const saveMeeting = (draft) => {
    if (!draft.id || editingMeeting === "new")
      setMeetingItems((ms) => [...ms, { ...draft, id: Date.now() }]);
    else
      setMeetingItems((ms) => ms.map((m) => (m.id === draft.id ? draft : m)));
    setEditingMeeting(null);
  };
  const deleteMeeting = (id) => {
    if (!window.confirm("🗑️ Delete this meeting log?")) return;
    setMeetingItems((ms) => ms.filter((m) => m.id !== id));
    if (USE_SUPABASE) sb.del("meeting_items", id).catch(() => {});
  };

  useEffect(() => {
    try {
      localStorage.setItem(
        "tasktracker_meetings_v1",
        JSON.stringify(meetingItems)
      );
    } catch {}
    if (!USE_SUPABASE || !loadedRef.current) return;
    sb.upsert("meeting_items", meetingItems).catch(() => {});
  }, [meetingItems]);

  const tagList = allTags(tasks);
  const periods = [
    ...new Set(tasks.map((t) => t.reviewPeriod).filter(Boolean)),
  ].sort();
  const visible = tasks.filter((t) => {
    if (filterTag && !(t.tags || []).includes(filterTag)) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterCompletion && (t.completion || "incomplete") !== filterCompletion)
      return false;
    if (filterPeriod && t.reviewPeriod !== filterPeriod) return false;
    return true;
  });

  const saveRow = (draft) => {
    if (editingId === "new")
      setTasks((ts) => [...ts, { ...draft, id: Date.now() }]);
    else
      setTasks((ts) =>
        ts.map((t) => (t.id === editingId ? { ...draft, id: t.id } : t))
      );
    setEditingId(null);
  };
  const deleteRow = (id) => {
    if (!window.confirm("🗑️ Delete this task?")) return;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    if (USE_SUPABASE) sb.del("tasks", id).catch(() => {});
  };
  const toggleCompletion = (id, v) =>
    setTasks((ts) =>
      ts.map((t) => (t.id === id ? { ...t, completion: v } : t))
    );
  const exportData = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" })
    );
    a.download = "tasks-backup.json";
    a.click();
  };
  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        const p = JSON.parse(ev.target.result);
        if (Array.isArray(p)) {
          setTasks(p);
          alert("✅ Imported!");
        } else alert("❌ Invalid file.");
      } catch {
        alert("❌ Could not read file.");
      }
    };
    r.readAsText(file);
    e.target.value = "";
  };

  const editingTask =
    editingId === "new"
      ? { ...BLANK }
      : tasks.find((t) => t.id === editingId) || null;
  const anyFilter =
    filterTag || filterStatus || filterCompletion || filterPeriod;

  const css = `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap'); *{box-sizing:border-box;} input,select,textarea{font-family:inherit;} input[type=date]::-webkit-calendar-picker-indicator{opacity:0.4;cursor:pointer;} button{transition:filter 0.12s;} button:hover{filter:brightness(0.9);}`;

  const Header = () => (
    <div
      style={{
        background:
          "linear-gradient(135deg, #e8e0ff 0%, #d4edff 50%, #ccfbe8 100%)",
        borderBottom: `2px solid ${C.border}`,
        padding: isMobile ? "16px 16px 14px" : "22px 32px 18px",
      }}
    >
      <div style={{ maxWidth: 1900, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: C.muted,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 3,
              }}
            >
              🗂️ Accountability Log
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: isMobile ? 22 : 26,
                fontWeight: 900,
                letterSpacing: "-0.02em",
                color: C.text,
              }}
            >
              📁 The Patience Files
            </h1>
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {Object.entries(STATUS_CONFIG).map(([k, s]) => {
              const active = filterStatus === k;
              const count = tasks.filter((t) => t.status === k).length;
              return (
                <Pill
                  key={k}
                  bg={active ? s.text : s.bg}
                  text={active ? "#fff" : s.text}
                  border={s.border}
                  onClick={() => setFilterStatus(active ? null : k)}
                  small
                  style={{ cursor: "pointer" }}
                >
                  {s.label} <strong style={{ marginLeft: 2 }}>{count}</strong>
                </Pill>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <DeadlineScoreBar tasks={tasks} isMobile={isMobile} />
          <ProductivityPanel tasks={tasks} isMobile={isMobile} />
          <TaskWeightPanel tasks={tasks} isMobile={isMobile} />
          <ResponseTimePanel tasks={tasks} isMobile={isMobile} />
          <AccountabilityPanel tasks={tasks} isMobile={isMobile} />
          <ImpactPanel tasks={tasks} isMobile={isMobile} />
          <LDSummaryPanel ldItems={ldItems} isMobile={isMobile} />
          <MeetingSummaryPanel meetings={meetingItems} isMobile={isMobile} />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[
            ["tasks", "📋 Task Log"],
            ["ld", "📚 L&D Log"],
            ["meetings", "🗓️ Meeting Log"],
          ].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...btn,
                padding: "8px 20px",
                fontSize: 14,
                background: activeTab === tab ? C.lilac.text : C.surface,
                color: activeTab === tab ? "#fff" : C.muted,
                border: `2px solid ${
                  activeTab === tab ? C.lilac.text : C.border
                }`,
                borderRadius: 12,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 10, color: C.muted, fontWeight: 800 }}>
            🔄 PROGRESS:
          </span>
          {COMPLETION_CYCLE.map((key) => {
            const cfg = COMPLETION_CONFIG[key];
            const active = filterCompletion === key;
            const count = tasks.filter(
              (t) => (t.completion || "incomplete") === key
            ).length;
            return (
              <button
                key={key}
                onClick={() => setFilterCompletion(active ? null : key)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: active ? cfg.text : cfg.bg,
                  color: active ? "#fff" : cfg.text,
                  border: `2px solid ${cfg.border}`,
                  borderRadius: 99,
                  padding: "3px 11px",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {cfg.icon} {cfg.label}{" "}
                <strong style={{ marginLeft: 1 }}>{count}</strong>
              </button>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 10, color: C.muted, fontWeight: 800 }}>
            📅 PERIOD:
          </span>
          {periods.map((p) => (
            <Pill
              key={p}
              bg={filterPeriod === p ? C.sky.text : C.sky.bg}
              text={filterPeriod === p ? "#fff" : C.sky.text}
              border={C.sky.border}
              onClick={() => setFilterPeriod(filterPeriod === p ? null : p)}
              small
              style={{ cursor: "pointer" }}
            >
              {p}
            </Pill>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 10, color: C.muted, fontWeight: 800 }}>
            🏷️ TAGS:
          </span>
          {tagList.map((tag) => {
            const col = tagColor(tag, tagList);
            const active = filterTag === tag;
            return (
              <Pill
                key={tag}
                bg={active ? col.text : col.bg}
                text={active ? "#fff" : col.text}
                border={col.border}
                onClick={() => setFilterTag(active ? null : tag)}
                small
                style={{ cursor: "pointer" }}
              >
                {tag}
              </Pill>
            );
          })}
          {anyFilter && (
            <button
              onClick={() => {
                setFilterTag(null);
                setFilterStatus(null);
                setFilterCompletion(null);
                setFilterPeriod(null);
              }}
              style={{
                ...btn,
                background: "#fff",
                color: C.muted,
                border: `2px solid ${C.border}`,
                fontSize: 11,
                padding: "2px 10px",
              }}
            >
              ✕ Clear all
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const Toolbar = () => (
    <div
      style={{
        maxWidth: 1900,
        margin: "0 auto",
        padding: isMobile ? "10px 16px" : "12px 32px",
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <button
        onClick={() => setEditingId("new")}
        disabled={editingId !== null}
        style={{
          ...btn,
          background: C.mint.text,
          color: "#fff",
          opacity: editingId ? 0.5 : 1,
        }}
      >
        ✨ Add Task
      </button>
      <button
        onClick={exportData}
        style={{
          ...btn,
          background: C.sky.bg,
          color: C.sky.text,
          border: `2px solid ${C.sky.border}`,
        }}
      >
        💾 Export
      </button>
      <button
        onClick={() => fileRef.current.click()}
        style={{
          ...btn,
          background: C.lilac.bg,
          color: C.lilac.text,
          border: `2px solid ${C.lilac.border}`,
        }}
      >
        📂 Import
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={importData}
      />
      {!isMobile && (
        <span
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: C.muted,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          Showing {visible.length} of {tasks.length} tasks 🎯
          {USE_SUPABASE && (
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                background:
                  syncStatus === "saved"
                    ? "#bbfbea"
                    : syncStatus === "saving"
                    ? "#fff5b8"
                    : syncStatus === "error"
                    ? "#ffe0ed"
                    : syncStatus === "loading"
                    ? "#d0eaff"
                    : "#ede8ff",
                color:
                  syncStatus === "saved"
                    ? "#076b50"
                    : syncStatus === "saving"
                    ? "#7a5200"
                    : syncStatus === "error"
                    ? "#b5124a"
                    : syncStatus === "loading"
                    ? "#004eb0"
                    : "#8078a8",
              }}
            >
              {syncStatus === "saved"
                ? "☁️ Saved to cloud"
                : syncStatus === "saving"
                ? "⏳ Saving…"
                : syncStatus === "error"
                ? "❌ Sync error"
                : syncStatus === "loading"
                ? "⏳ Loading…"
                : "☁️ Cloud sync on"}
            </span>
          )}
          {!USE_SUPABASE && (
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                background: "#fff5b8",
                color: "#7a5200",
              }}
            >
              💾 Local storage only
            </span>
          )}
        </span>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          fontFamily: "'Plus Jakarta Sans',sans-serif",
          color: C.text,
        }}
      >
        <style>{css}</style>
        <Header />
        <Toolbar />
        {activeTab === "tasks" ? (
          <div style={{ padding: "0 16px 80px" }}>
            <div
              style={{
                fontSize: 12,
                color: C.muted,
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              {visible.length} of {tasks.length} tasks · Tap 🔽 to expand
            </div>
            {visible.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: 48,
                  color: C.muted,
                  fontSize: 15,
                }}
              >
                🌈 No tasks match the current filters!
              </div>
            )}
            {(() => {
              // Split into incomplete/in-progress and completed
              const active = visible.filter((t) => t.completion !== "complete");
              const done = visible.filter(
                (t) => t.completion === "complete" && t.delivered
              );
              const doneNoDate = visible.filter(
                (t) => t.completion === "complete" && !t.delivered
              );

              // Group done tasks by week
              const weekGroups = {};
              done.forEach((t) => {
                const key = getWeekKey(t.delivered);
                if (!weekGroups[key])
                  weekGroups[key] = {
                    label: getWeekLabel(t.delivered),
                    tasks: [],
                  };
                weekGroups[key].tasks.push(t);
              });
              const sortedWeeks = Object.entries(weekGroups).sort((a, b) =>
                b[0].localeCompare(a[0])
              );

              return (
                <>
                  {/* Active tasks */}
                  {active.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      tagList={tagList}
                      filterTag={filterTag}
                      setFilterTag={setFilterTag}
                      onEdit={setEditingId}
                      onDelete={deleteRow}
                      onToggleCompletion={toggleCompletion}
                    />
                  ))}
                  {doneNoDate.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      tagList={tagList}
                      filterTag={filterTag}
                      setFilterTag={setFilterTag}
                      onEdit={setEditingId}
                      onDelete={deleteRow}
                      onToggleCompletion={toggleCompletion}
                    />
                  ))}

                  {/* Completed tasks grouped by week */}
                  {sortedWeeks.map(([key, group]) => (
                    <div key={key}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          margin: "14px 0 8px",
                        }}
                      >
                        <div
                          style={{ flex: 1, height: 1.5, background: C.border }}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: C.muted,
                            whiteSpace: "nowrap",
                          }}
                        >
                          ✅ {group.label} · {group.tasks.length} completed
                        </span>
                        <div
                          style={{ flex: 1, height: 1.5, background: C.border }}
                        />
                      </div>
                      {group.tasks.map((t) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          tagList={tagList}
                          filterTag={filterTag}
                          setFilterTag={setFilterTag}
                          onEdit={setEditingId}
                          onDelete={deleteRow}
                          onToggleCompletion={toggleCompletion}
                        />
                      ))}
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        ) : activeTab === "ld" ? (
          <div style={{ padding: "0 16px 80px" }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 12,
                alignItems: "center",
              }}
            >
              <button
                onClick={() => setEditingLd("new")}
                style={{ ...btn, background: C.lilac.text, color: "#fff" }}
              >
                ➕ Add Entry
              </button>
              {Object.entries(LD_STATUS).map(([k, v]) => (
                <Pill
                  key={k}
                  bg={ldFilterStatus === k ? v.text : v.bg}
                  text={ldFilterStatus === k ? "#fff" : v.text}
                  border={v.border}
                  small
                  onClick={() =>
                    setLdFilterStatus(ldFilterStatus === k ? null : k)
                  }
                  style={{ cursor: "pointer" }}
                >
                  {v.label}
                </Pill>
              ))}
              {ldFilterStatus && (
                <button
                  onClick={() => setLdFilterStatus(null)}
                  style={{
                    ...btn,
                    background: "transparent",
                    color: C.muted,
                    border: `2px solid ${C.border}`,
                    fontSize: 11,
                    padding: "2px 9px",
                  }}
                >
                  ✕ Clear
                </button>
              )}
            </div>
            {editingLd && (
              <LDForm
                row={editingLd === "new" ? { ...LD_BLANK } : editingLd}
                onSave={saveLd}
                onCancel={() => setEditingLd(null)}
                isMobile
              />
            )}
            {ldItems.filter(
              (i) => !ldFilterStatus || i.status === ldFilterStatus
            ).length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: C.muted }}>
                📚 No L&D entries yet — add one above!
              </div>
            )}
            {ldItems
              .filter((i) => !ldFilterStatus || i.status === ldFilterStatus)
              .map((item) => (
                <LDCard
                  key={item.id}
                  item={item}
                  onEdit={(i) => setEditingLd(i)}
                  onDelete={deleteLd}
                />
              ))}
          </div>
        ) : (
          <div style={{ padding: "0 16px 80px" }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 12,
                alignItems: "center",
              }}
            >
              <button
                onClick={() => setEditingMeeting("new")}
                style={{ ...btn, background: C.lilac.text, color: "#fff" }}
              >
                ➕ Log Meeting
              </button>
              {Object.entries(MEETING_TONE_CONFIG).map(([k, v]) => (
                <Pill
                  key={k}
                  bg={meetingFilterTone === k ? v.text : v.bg}
                  text={meetingFilterTone === k ? "#fff" : v.text}
                  border={v.border}
                  small
                  onClick={() =>
                    setMeetingFilterTone(meetingFilterTone === k ? null : k)
                  }
                  style={{ cursor: "pointer" }}
                >
                  {v.label}
                </Pill>
              ))}
              {meetingFilterTone && (
                <button
                  onClick={() => setMeetingFilterTone(null)}
                  style={{
                    ...btn,
                    background: "transparent",
                    color: C.muted,
                    border: `2px solid ${C.border}`,
                    fontSize: 11,
                    padding: "2px 9px",
                  }}
                >
                  ✕ Clear
                </button>
              )}
            </div>
            {editingMeeting && (
              <MeetingForm
                row={
                  editingMeeting === "new"
                    ? { ...MEETING_BLANK }
                    : editingMeeting
                }
                onSave={saveMeeting}
                onCancel={() => setEditingMeeting(null)}
                isMobile
              />
            )}
            {meetingItems.filter(
              (m) => !meetingFilterTone || m.tone === meetingFilterTone
            ).length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: C.muted }}>
                🗓️ No meetings logged yet — add one above!
              </div>
            )}
            {meetingItems
              .filter((m) => !meetingFilterTone || m.tone === meetingFilterTone)
              .sort((a, b) => b.date?.localeCompare(a.date || "") || 0)
              .map((m) => (
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  onEdit={(mt) => setEditingMeeting(mt)}
                  onDelete={deleteMeeting}
                />
              ))}
          </div>
        )}
        {editingId !== null && editingTask && (
          <Modal onClose={() => setEditingId(null)}>
            <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 900 }}>
              {editingId === "new" ? "✨ Add Task" : "✏️ Edit Task"}
            </h2>
            <EditForm
              row={editingTask}
              onSave={saveRow}
              onCancel={() => setEditingId(null)}
              allTagsList={tagList}
              isMobile
            />
          </Modal>
        )}
      </div>
    );
  }

  const thS = {
    padding: "9px 12px",
    textAlign: "left",
    fontSize: 10,
    fontWeight: 800,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    background: C.faint,
    borderBottom: `2px solid ${C.border}`,
    whiteSpace: "nowrap",
  };
  const tdS = (i, done) => ({
    padding: "11px 12px",
    verticalAlign: "top",
    borderBottom: `1px solid ${C.border}`,
    background: done ? "#edfff6" : i % 2 === 0 ? C.surface : "#f8f5ff",
    fontSize: 12,
    color: C.text,
    opacity: done ? 0.75 : 1,
  });
  // Pre-compute grouped rows for desktop table
  const desktopRows = (() => {
    const active = visible.filter((t) => t.completion !== "complete");
    const done = visible.filter(
      (t) => t.completion === "complete" && t.delivered
    );
    const doneNoDate = visible.filter(
      (t) => t.completion === "complete" && !t.delivered
    );
    const weekGroups = {};
    done.forEach((t) => {
      const key = getWeekKey(t.delivered);
      if (!weekGroups[key])
        weekGroups[key] = { label: getWeekLabel(t.delivered), tasks: [] };
      weekGroups[key].tasks.push(t);
    });
    const sortedWeeks = Object.entries(weekGroups).sort((a, b) =>
      b[0].localeCompare(a[0])
    );
    return [
      ...active.map((t, i) => ({ t, i, weekHeader: null })),
      ...doneNoDate.map((t, i) => ({
        t,
        i: active.length + i,
        weekHeader: null,
      })),
      ...sortedWeeks.flatMap(([key, group], wi) =>
        group.tasks.map((t, i) => ({
          t,
          i: active.length + doneNoDate.length + wi * 100 + i,
          weekHeader: i === 0 ? group : null,
        }))
      ),
    ];
  })();

  const COLS = [
    "",
    "Task",
    "Period",
    "Tags",
    "📨 Source",
    "🤞 Promised",
    "⏰ Deadline",
    "📦 Delivered",
    "Status",
    "⭐ Quality",
    "📣",
    "🎭 Excuse",
    "💥 Impact",
    "Escalation",
    "Warnings",
    "🤝 Mel",
    "👁️ Shared",
    "",
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        fontFamily: "'Plus Jakarta Sans',sans-serif",
        color: C.text,
      }}
    >
      <style>
        {css +
          ` tr:hover td{filter:brightness(0.97);} ::-webkit-scrollbar{height:6px;width:6px;} ::-webkit-scrollbar-track{background:${C.faint};} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:9px;}`}
      </style>
      <Header />
      <Toolbar />
      {activeTab === "ld" ? (
        <div
          style={{ maxWidth: 1300, margin: "0 auto", padding: "0 32px 56px" }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 16,
              alignItems: "center",
            }}
          >
            <button
              onClick={() => setEditingLd("new")}
              style={{
                ...btn,
                background: C.lilac.text,
                color: "#fff",
                fontSize: 14,
                padding: "8px 18px",
              }}
            >
              ➕ Add L&D Entry
            </button>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>
              FILTER:
            </span>
            {Object.entries(LD_STATUS).map(([k, v]) => (
              <Pill
                key={k}
                bg={ldFilterStatus === k ? v.text : v.bg}
                text={ldFilterStatus === k ? "#fff" : v.text}
                border={v.border}
                small
                onClick={() =>
                  setLdFilterStatus(ldFilterStatus === k ? null : k)
                }
                style={{ cursor: "pointer" }}
              >
                {v.label}
              </Pill>
            ))}
            {Object.entries(LD_TYPES).map(([k, v]) => (
              <Pill
                key={k}
                bg={ldFilterType === k ? v.text : v.bg}
                text={ldFilterType === k ? "#fff" : v.text}
                border={v.border}
                small
                onClick={() => setLdFilterType(ldFilterType === k ? null : k)}
                style={{ cursor: "pointer" }}
              >
                {v.label}
              </Pill>
            ))}
            {(ldFilterStatus || ldFilterType) && (
              <button
                onClick={() => {
                  setLdFilterStatus(null);
                  setLdFilterType(null);
                }}
                style={{
                  ...btn,
                  background: "transparent",
                  color: C.muted,
                  border: `2px solid ${C.border}`,
                  fontSize: 11,
                  padding: "2px 10px",
                }}
              >
                ✕ Clear
              </button>
            )}
            <span
              style={{
                marginLeft: "auto",
                fontSize: 12,
                color: C.muted,
                fontWeight: 600,
              }}
            >
              {
                ldItems.filter(
                  (i) =>
                    (!ldFilterStatus || i.status === ldFilterStatus) &&
                    (!ldFilterType || i.type === ldFilterType)
                ).length
              }{" "}
              of {ldItems.length} entries
            </span>
          </div>
          {editingLd && (
            <LDForm
              row={editingLd === "new" ? { ...LD_BLANK } : editingLd}
              onSave={saveLd}
              onCancel={() => setEditingLd(null)}
              isMobile={false}
            />
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(560px, 1fr))",
              gap: 12,
            }}
          >
            {ldItems.filter(
              (i) =>
                (!ldFilterStatus || i.status === ldFilterStatus) &&
                (!ldFilterType || i.type === ldFilterType)
            ).length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: 60,
                  color: C.muted,
                  fontSize: 15,
                  gridColumn: "1 / -1",
                }}
              >
                📚 No L&D entries yet — click ➕ Add L&D Entry to get started!
              </div>
            )}
            {ldItems
              .filter(
                (i) =>
                  (!ldFilterStatus || i.status === ldFilterStatus) &&
                  (!ldFilterType || i.type === ldFilterType)
              )
              .map((item) => (
                <LDCard
                  key={item.id}
                  item={item}
                  onEdit={(i) => setEditingLd(i)}
                  onDelete={deleteLd}
                />
              ))}
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 11,
              color: C.muted,
              fontWeight: 600,
            }}
          >
            📚 L&D Log is private — for your records only · 🔒 Manager Notes
            visible in Edit only · 🌟 = reportee engaged/completed
          </div>
        </div>
      ) : activeTab === "meetings" ? (
        <div
          style={{ maxWidth: 1300, margin: "0 auto", padding: "0 32px 56px" }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 16,
              alignItems: "center",
            }}
          >
            <button
              onClick={() => setEditingMeeting("new")}
              style={{
                ...btn,
                background: C.lilac.text,
                color: "#fff",
                fontSize: 14,
                padding: "8px 18px",
              }}
            >
              ➕ Log Meeting
            </button>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>
              FILTER BY TONE:
            </span>
            {Object.entries(MEETING_TONE_CONFIG).map(([k, v]) => (
              <Pill
                key={k}
                bg={meetingFilterTone === k ? v.text : v.bg}
                text={meetingFilterTone === k ? "#fff" : v.text}
                border={v.border}
                small
                onClick={() =>
                  setMeetingFilterTone(meetingFilterTone === k ? null : k)
                }
                style={{ cursor: "pointer" }}
              >
                {v.label}
              </Pill>
            ))}
            {meetingFilterTone && (
              <button
                onClick={() => setMeetingFilterTone(null)}
                style={{
                  ...btn,
                  background: "transparent",
                  color: C.muted,
                  border: `2px solid ${C.border}`,
                  fontSize: 11,
                  padding: "2px 10px",
                }}
              >
                ✕ Clear
              </button>
            )}
            <span
              style={{
                marginLeft: "auto",
                fontSize: 12,
                color: C.muted,
                fontWeight: 600,
              }}
            >
              {meetingItems.length} meeting
              {meetingItems.length !== 1 ? "s" : ""} logged
            </span>
          </div>
          {editingMeeting && (
            <MeetingForm
              row={
                editingMeeting === "new" ? { ...MEETING_BLANK } : editingMeeting
              }
              onSave={saveMeeting}
              onCancel={() => setEditingMeeting(null)}
              isMobile={false}
            />
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(560px, 1fr))",
              gap: 12,
            }}
          >
            {meetingItems.filter(
              (m) => !meetingFilterTone || m.tone === meetingFilterTone
            ).length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: 60,
                  color: C.muted,
                  fontSize: 15,
                  gridColumn: "1 / -1",
                }}
              >
                🗓️ No meetings logged yet — click ➕ Log Meeting to get started!
              </div>
            )}
            {meetingItems
              .filter((m) => !meetingFilterTone || m.tone === meetingFilterTone)
              .sort((a, b) => b.date?.localeCompare(a.date || "") || 0)
              .map((m) => (
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  onEdit={(mt) => setEditingMeeting(mt)}
                  onDelete={deleteMeeting}
                />
              ))}
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 11,
              color: C.muted,
              fontWeight: 600,
            }}
          >
            🗓️ Meeting Log is private — for your records only · 🔒 Private Notes
            visible in Edit only · Sorted most recent first
          </div>
        </div>
      ) : (
        <div
          style={{
            maxWidth: 1900,
            margin: "0 auto",
            padding: "0 32px 56px",
            overflowX: "auto",
          }}
        >
          <div
            style={{
              borderRadius: 16,
              border: `2px solid ${C.border}`,
              overflow: "hidden",
              boxShadow: "0 6px 30px rgba(100,80,220,0.1)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 1700,
              }}
            >
              <thead>
                <tr>
                  {COLS.map((h, i) => (
                    <th
                      key={i}
                      style={{
                        ...thS,
                        ...(i === 0 ? { width: 48, textAlign: "center" } : {}),
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {editingId === "new" && (
                  <EditForm
                    row={{ ...BLANK }}
                    onSave={saveRow}
                    onCancel={() => setEditingId(null)}
                    allTagsList={tagList}
                    isMobile={false}
                  />
                )}
                {visible.length === 0 && editingId !== "new" && (
                  <tr>
                    <td
                      colSpan={COLS.length}
                      style={{
                        padding: 52,
                        textAlign: "center",
                        color: C.muted,
                        fontSize: 15,
                      }}
                    >
                      🌈 No tasks match the current filters!
                    </td>
                  </tr>
                )}
                {desktopRows.map(({ t, i, weekHeader }) => {
                  const s = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending;
                  const esc = ESCALATION_CONFIG[t.escalation || "none"];
                  const done = t.completion === "complete";
                  if (editingId === t.id)
                    return (
                      <EditForm
                        key={t.id}
                        row={t}
                        onSave={saveRow}
                        onCancel={() => setEditingId(null)}
                        allTagsList={tagList}
                        isMobile={false}
                      />
                    );
                  return (
                    <>
                      {weekHeader && (
                        <tr key={`header-${weekHeader.label}`}>
                          <td
                            colSpan={COLS.length}
                            style={{
                              padding: "10px 16px",
                              background:
                                "linear-gradient(90deg, #ccfbe0, #d0eaff)",
                              borderTop: `2px solid ${C.mint.border}`,
                              borderBottom: `1px solid ${C.mint.border}`,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: C.mint.text,
                                }}
                              >
                                ✅ {weekHeader.label}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: C.muted,
                                  fontWeight: 600,
                                }}
                              >
                                {weekHeader.tasks.length} task
                                {weekHeader.tasks.length !== 1 ? "s" : ""}{" "}
                                completed
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr key={t.id}>
                        <td
                          style={{
                            ...tdS(i, done),
                            textAlign: "center",
                            padding: "11px 6px",
                          }}
                        >
                          <CompletionToggle
                            value={t.completion || "incomplete"}
                            onChange={(v) => toggleCompletion(t.id, v)}
                            compact
                          />
                        </td>
                        <td
                          style={{
                            ...tdS(i, done),
                            fontWeight: 800,
                            minWidth: 140,
                            maxWidth: 190,
                            textDecoration: done ? "line-through" : "none",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                            }}
                          >
                            <span>{t.task}</span>
                            {t.taskSize &&
                              (() => {
                                const sz = TASK_SIZE_CONFIG[t.taskSize];
                                return sz ? (
                                  <Pill
                                    bg={sz.bg}
                                    text={sz.text}
                                    border={sz.border}
                                    small
                                  >
                                    {sz.label}
                                  </Pill>
                                ) : null;
                              })()}
                            {t.qualityRating &&
                              (() => {
                                const q = QUALITY_CONFIG[t.qualityRating];
                                return q ? (
                                  <Pill
                                    bg={q.bg}
                                    text={q.text}
                                    border={q.border}
                                    small
                                  >
                                    {q.label}
                                  </Pill>
                                ) : null;
                              })()}
                          </div>
                        </td>
                        <td style={tdS(i, done)}>
                          {t.reviewPeriod ? (
                            <Pill {...C.sky} small>
                              {t.reviewPeriod}
                            </Pill>
                          ) : (
                            <span
                              style={{ color: C.muted, fontStyle: "italic" }}
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdS(i, done), minWidth: 110 }}>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 3,
                            }}
                          >
                            {(t.tags || []).map((tag) => (
                              <Pill
                                key={tag}
                                {...tagColor(tag, tagList)}
                                small
                                onClick={() =>
                                  setFilterTag(filterTag === tag ? null : tag)
                                }
                                style={{ cursor: "pointer" }}
                              >
                                {tag}
                              </Pill>
                            ))}
                          </div>
                        </td>
                        <td style={{ ...tdS(i, done), minWidth: 160 }}>
                          {(t.taskSource || "email") === "email" ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              <Pill {...C.sky} small>
                                📧 Email
                              </Pill>
                              {t.emailSubject && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: C.muted,
                                    fontStyle: "italic",
                                  }}
                                >
                                  {t.emailSubject.length > 30
                                    ? t.emailSubject.slice(0, 30) + "…"
                                    : t.emailSubject}
                                </span>
                              )}
                              <span style={{ fontSize: 11 }}>
                                Rcvd:{" "}
                                {t.emailReceived ? (
                                  fmt(t.emailReceived)
                                ) : (
                                  <em style={{ color: C.muted }}>—</em>
                                )}
                              </span>
                              <span style={{ fontSize: 11 }}>
                                First replied:{" "}
                                {t.reporteeResponded ? (
                                  fmt(t.reporteeResponded)
                                ) : (
                                  <Pill {...C.peach} small>
                                    👻 No reply
                                  </Pill>
                                )}
                              </span>
                            </div>
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              <Pill {...C.lilac} small>
                                🗣️ In Person
                              </Pill>
                              {t.briefingContext && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: C.muted,
                                    fontStyle: "italic",
                                  }}
                                >
                                  {t.briefingContext}
                                </span>
                              )}
                              <span style={{ fontSize: 11 }}>
                                Briefed:{" "}
                                {t.briefingDate ? (
                                  fmt(t.briefingDate)
                                ) : (
                                  <em style={{ color: C.muted }}>—</em>
                                )}
                              </span>
                              {t.confirmedInWritingDate ? (
                                <span style={{ fontSize: 11 }}>
                                  ✅ Confirmed {fmt(t.confirmedInWritingDate)}
                                </span>
                              ) : (
                                <Pill {...C.amber} small>
                                  ⚠️ Not confirmed in writing
                                </Pill>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={tdS(i, done)}>
                          {t.promisedDate ? (
                            fmt(t.promisedDate)
                          ) : (
                            <span style={{ color: C.muted }}>—</span>
                          )}
                        </td>
                        <td style={{ ...tdS(i, done), fontWeight: 800 }}>
                          {t.deadline ? (
                            fmt(t.deadline)
                          ) : (
                            <span style={{ color: C.muted }}>—</span>
                          )}
                        </td>
                        <td style={tdS(i, done)}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                            }}
                          >
                            <span>
                              {t.delivered ? (
                                fmt(t.delivered)
                              ) : (
                                <span
                                  style={{
                                    color: C.muted,
                                    fontStyle: "italic",
                                  }}
                                >
                                  Not yet
                                </span>
                              )}
                            </span>
                            <DeltaBadge
                              deadline={t.deadline}
                              delivered={t.delivered}
                            />
                          </div>
                        </td>
                        <td style={tdS(i, done)}>
                          <Pill bg={s.bg} text={s.text} border={s.border} small>
                            {s.label}
                          </Pill>
                        </td>
                        <td style={{ ...tdS(i, done), minWidth: 130 }}>
                          {t.qualityRating ? (
                            (() => {
                              const q = QUALITY_CONFIG[t.qualityRating];
                              return q ? (
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                  }}
                                >
                                  <Pill
                                    bg={q.bg}
                                    text={q.text}
                                    border={q.border}
                                    small
                                  >
                                    {q.label}
                                  </Pill>
                                  {t.qualityNotes && (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        color: C.muted,
                                        fontStyle: "italic",
                                        lineHeight: 1.4,
                                      }}
                                    >
                                      {t.qualityNotes.length > 50
                                        ? t.qualityNotes.slice(0, 50) + "…"
                                        : t.qualityNotes}
                                    </span>
                                  )}
                                </div>
                              ) : null;
                            })()
                          ) : (
                            <span
                              style={{ color: C.muted, fontStyle: "italic" }}
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdS(i, done), textAlign: "center" }}>
                          {t.chasers > 0 ? (
                            <span
                              style={{
                                fontWeight: 900,
                                fontSize: 16,
                                color:
                                  t.chasers > 3
                                    ? C.rose.text
                                    : t.chasers > 1
                                    ? C.amber.text
                                    : C.muted,
                              }}
                            >
                              {"📣".repeat(Math.min(t.chasers, 3))}
                              {t.chasers > 3 ? `+${t.chasers - 3}` : ""}
                            </span>
                          ) : (
                            <span style={{ color: C.muted }}>—</span>
                          )}
                        </td>
                        <td style={{ ...tdS(i, done), maxWidth: 180 }}>
                          {t.excuseLog ? (
                            <div style={{ fontSize: 11 }}>
                              <div
                                style={{
                                  color: t.excuseAccepted
                                    ? C.sage.text
                                    : C.rose.text,
                                  fontWeight: 800,
                                  marginBottom: 2,
                                }}
                              >
                                {t.excuseAccepted
                                  ? "✅ Accepted"
                                  : "🚫 Rejected"}
                              </div>
                              <div
                                style={{
                                  color: C.muted,
                                  fontStyle: "italic",
                                  lineHeight: 1.4,
                                }}
                              >
                                {t.excuseLog.length > 80
                                  ? t.excuseLog.slice(0, 80) + "…"
                                  : t.excuseLog}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: C.muted }}>—</span>
                          )}
                        </td>
                        <td style={{ ...tdS(i, done), maxWidth: 160 }}>
                          {t.impact ? (
                            <div
                              style={{
                                fontSize: 11,
                                color: C.rose.text,
                                fontWeight: 600,
                                lineHeight: 1.4,
                              }}
                            >
                              {t.impact.length > 70
                                ? t.impact.slice(0, 70) + "…"
                                : t.impact}
                            </div>
                          ) : (
                            <span style={{ color: C.muted }}>—</span>
                          )}
                        </td>
                        <td style={tdS(i, done)}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                            }}
                          >
                            <Pill
                              bg={esc.bg}
                              text={esc.text}
                              border={esc.border}
                              small
                            >
                              {esc.label}
                            </Pill>
                            {t.discussedIn1on1 && (
                              <Pill {...C.sky} small>
                                🗣️ 1:1{" "}
                                {t.discussedDate ? fmt(t.discussedDate) : ""}
                              </Pill>
                            )}
                          </div>
                        </td>
                        <td style={tdS(i, done)}>
                          <div
                            style={{
                              fontSize: 11,
                              display: "flex",
                              flexDirection: "column",
                              gap: 3,
                            }}
                          >
                            {t.verbalWarningDate && (
                              <span
                                style={{ color: C.peach.text, fontWeight: 700 }}
                              >
                                ⚠️ Verbal {fmt(t.verbalWarningDate)}
                              </span>
                            )}
                            {t.writtenWarningDate && (
                              <span
                                style={{ color: C.rose.text, fontWeight: 800 }}
                              >
                                📄 Written {fmt(t.writtenWarningDate)}
                              </span>
                            )}
                            {!t.verbalWarningDate && !t.writtenWarningDate && (
                              <span style={{ color: C.muted }}>😌 None</span>
                            )}
                          </div>
                        </td>
                        <td style={{ ...tdS(i, done), minWidth: 130 }}>
                          {t.melTookOver ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 5,
                              }}
                            >
                              <span style={{ fontSize: 12 }}>
                                🤝 {fmt(t.melTookOver)}
                              </span>
                              {t.completion !== "incomplete" ? (
                                <div
                                  style={{
                                    background: C.amber.bg,
                                    border: `1.5px solid ${C.amber.border}`,
                                    borderRadius: 8,
                                    padding: "5px 8px",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: 10,
                                      color: C.amber.text,
                                      fontWeight: 800,
                                      marginBottom: 3,
                                    }}
                                  >
                                    💡 Mark incomplete?
                                  </div>
                                  <button
                                    onClick={() =>
                                      toggleCompletion(t.id, "incomplete")
                                    }
                                    style={{
                                      ...btn,
                                      fontSize: 10,
                                      padding: "2px 8px",
                                      background: C.amber.text,
                                      color: "#fff",
                                    }}
                                  >
                                    Mark
                                  </button>
                                </div>
                              ) : (
                                <Pill {...C.slate} small>
                                  ✅ Handed over
                                </Pill>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: C.muted }}>—</span>
                          )}
                        </td>
                        <td style={{ ...tdS(i, done), minWidth: 110 }}>
                          {t.feedbackShared ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              <Pill {...C.mint} small>
                                ✅ Shared
                              </Pill>
                              {t.feedbackSharedDate && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: C.muted,
                                    fontWeight: 600,
                                  }}
                                >
                                  {fmt(t.feedbackSharedDate)}
                                </span>
                              )}
                              {t.feedbackSharedHow && (
                                <span style={{ fontSize: 10, color: C.muted }}>
                                  {{
                                    "verbal-1on1": "🗣️ 1:1",
                                    "verbal-informal": "💬 Chat",
                                    email: "📧 Email",
                                    "written-formal": "📄 Formal",
                                    "performance-review": "📊 Review",
                                  }[t.feedbackSharedHow] || t.feedbackSharedHow}
                                </span>
                              )}
                            </div>
                          ) : (
                            <Pill {...C.slate} small style={{ opacity: 0.6 }}>
                              ⬜ Not yet
                            </Pill>
                          )}
                        </td>
                        <td style={{ ...tdS(i, done), whiteSpace: "nowrap" }}>
                          <button
                            onClick={() => setEditingId(t.id)}
                            style={{
                              ...btn,
                              fontSize: 11,
                              padding: "4px 10px",
                              background: C.sky.bg,
                              color: C.sky.text,
                              border: `2px solid ${C.sky.border}`,
                              marginRight: 5,
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => deleteRow(t.id)}
                            style={{
                              ...btn,
                              fontSize: 11,
                              padding: "4px 10px",
                              background: C.rose.bg,
                              color: C.rose.text,
                              border: `2px solid ${C.rose.border}`,
                            }}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 11,
              color: C.muted,
              fontWeight: 600,
            }}
          >
            ○ To Do · ◑ In Progress · 🎉 Done · Click toggle to cycle · 📣 =
            chasers sent · 🟡🟠🔴 = task size · Excuse truncated — click ✏️ to
            see full · 🔒 Manager Notes in Edit only · 👁️ Shared = feedback
            communicated verbally or in writing
          </div>
        </div>
      )}
    </div>
  );
}
