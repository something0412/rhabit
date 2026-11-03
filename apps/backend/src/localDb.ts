import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// A tiny FAKE database, used only when there are no Supabase keys in .env.
// It understands the same calls our routes use, like:
//   supabase.from("tasks").select("*").eq("day_plan_id", 5).order("position")
// so the rest of the backend doesn't know (or care) which one it's talking to.
//
// Data is saved to apps/backend/.local-db.json, so it survives restarts.
// Delete that file to start fresh. Once you add Supabase keys, this file isn't used.

type Row = Record<string, any>;

// (LOCAL_DB_FILE lets tests use a separate file)
const DB_FILE = process.env.LOCAL_DB_FILE ?? fileURLToPath(new URL("../.local-db.json", import.meta.url));

// Default values for new rows (same defaults as schema.sql)
const defaults: Record<string, Row> = {
  profiles: {
    display_name: "Demo User",
    timezone: "UTC",
    xp: 0,
    coins: 0,
    work_start: "09:00",
    work_end: "17:00",
    work_days: [1, 2, 3, 4, 5],
    active_theme: "theme_classic",
    active_character: "char_sprout",
    free_day_off_month: null,
  },
  day_plans: {
    mode: "timer",
    deadline_at: null,
    status: "planning",
    started_at: null,
    paused_at: null,
    pause_type: null,
    total_paused_seconds: 0,
    regular_paused_seconds: 0,
    bonus_pause_seconds: 0,
    flexible_card_used: false,
    emergency_paid: false,
  },
  tasks: { details: "", is_break: false, status: "planned", started_at: null, paused_seconds: 0, completed_at: null },
  notes: { details: "", done: false, in_bucket: false, added_to_date: null, task_id: null },
  scheduled_tasks: { details: "", time: null, duration_minutes: null, status: "scheduled", task_id: null },
  reward_events: { xp: 0, coins: 0, day_plan_id: null, task_id: null },
  pause_events: { ended_at: null },
  inventory: { quantity: 0 },
};

// Bump this when the tables change, so an old .local-db.json is replaced with a fresh one
const VERSION = 4;

function emptyDb() {
  const tables: Record<string, Row[]> = {};
  for (const name of Object.keys(defaults)) tables[name] = [];
  return { version: VERSION, tables, nextId: 1 };
}

function loadDb() {
  if (!existsSync(DB_FILE)) return emptyDb();
  const saved = JSON.parse(readFileSync(DB_FILE, "utf8"));

  // Version 1 used "points" instead of XP/coins: too different, start fresh
  if (!saved.version || saved.version < 2) {
    console.log("The local demo database is from an older version, starting fresh.");
    return emptyDb();
  }

  // Newer versions only ADD tables/columns, so upgrade the saved data in place
  for (const [name, tableDefaults] of Object.entries(defaults)) {
    const rows: Row[] = saved.tables[name] ?? [];
    saved.tables[name] = rows.map((row) => ({ ...tableDefaults, ...row }));
  }
  saved.version = VERSION;
  return saved;
}

const db: { version: number; tables: Record<string, Row[]>; nextId: number } = loadDb();

function save() {
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// "2026-10-20" vs "2026-10-21", or 5 vs 7
function compare(a: unknown, b: unknown): number {
  if (typeof b === "number") return Number(a) - b;
  return String(a).localeCompare(String(b));
}

class LocalQuery {
  private action: "select" | "insert" | "update" | "delete" = "select";
  private values: Row = {};
  private filters: ((row: Row) => boolean)[] = [];
  private returnRows = false;
  private columns = "*";
  private countOnly = false;
  private sortBy: { column: string; ascending: boolean } | null = null;
  private maxRows: number | null = null;
  private resultMode: "many" | "single" | "maybeSingle" = "many";

  constructor(private table: string) {}

  // --- what to do ---
  select(columns = "*", options?: { count?: string; head?: boolean }) {
    if (this.action === "select") this.columns = columns;
    else this.returnRows = true; // .insert(...).select() returns the new rows
    if (options?.head) this.countOnly = true;
    return this;
  }
  insert(values: Row) {
    this.action = "insert";
    this.values = values;
    return this;
  }
  update(values: Row) {
    this.action = "update";
    this.values = values;
    return this;
  }
  delete() {
    this.action = "delete";
    return this;
  }

  // --- filters ---
  eq(column: string, value: unknown) {
    this.filters.push((row) => String(row[column]) === String(value));
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push((row) => String(row[column]) !== String(value));
    return this;
  }
  gt(column: string, value: unknown) {
    this.filters.push((row) => compare(row[column], value) > 0);
    return this;
  }
  gte(column: string, value: unknown) {
    this.filters.push((row) => compare(row[column], value) >= 0);
    return this;
  }
  lt(column: string, value: unknown) {
    this.filters.push((row) => compare(row[column], value) < 0);
    return this;
  }
  lte(column: string, value: unknown) {
    this.filters.push((row) => compare(row[column], value) <= 0);
    return this;
  }
  in(column: string, values: unknown[]) {
    const allowed = values.map(String);
    this.filters.push((row) => allowed.includes(String(row[column])));
    return this;
  }
  is(column: string, value: null) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  // --- shaping the result ---
  order(column: string, options?: { ascending?: boolean }) {
    this.sortBy = { column, ascending: options?.ascending ?? true };
    return this;
  }
  limit(count: number) {
    this.maxRows = count;
    return this;
  }
  single() {
    this.resultMode = "single";
    return this;
  }
  maybeSingle() {
    this.resultMode = "maybeSingle";
    return this;
  }

  // `await query` calls this. It runs the query and returns { data, error, count } like Supabase.
  then<T>(onDone: (result: { data: any; error: any; count: number | null }) => T, onError?: (e: unknown) => T) {
    return Promise.resolve()
      .then(() => this.run())
      .then(onDone, onError);
  }

  private run() {
    const table = db.tables[this.table];
    const matches = (row: Row) => this.filters.every((filter) => filter(row));
    let rows: Row[];

    if (this.action === "insert") {
      const row: Row = { ...defaults[this.table], created_at: new Date().toISOString(), ...this.values };
      if (this.table !== "profiles" && this.table !== "inventory") row.id = db.nextId++;
      table.push(row);
      rows = [row];
      save();
    } else if (this.action === "update") {
      rows = table.filter(matches);
      rows.forEach((row) => Object.assign(row, this.values));
      save();
    } else if (this.action === "delete") {
      rows = table.filter(matches);
      db.tables[this.table] = table.filter((row) => !matches(row));
      save();
    } else {
      rows = table.filter(matches);
    }

    if (this.sortBy) {
      const { column, ascending } = this.sortBy;
      rows = [...rows].sort((a, b) => compare(a[column], b[column]) * (ascending ? 1 : -1));
    }
    if (this.maxRows !== null) rows = rows.slice(0, this.maxRows);

    // Only keep the columns that were asked for, e.g. select("id, amount")
    if (this.columns !== "*") {
      const keep = this.columns.split(",").map((c) => c.trim());
      rows = rows.map((row) => Object.fromEntries(keep.map((c) => [c, row[c]])));
    }

    // Return copies, so changing the result doesn't change the "database"
    rows = structuredClone(rows);

    const count = rows.length;
    if (this.countOnly) return { data: null, error: null, count };
    if (this.action !== "select" && !this.returnRows) return { data: null, error: null, count };

    if (this.resultMode === "single") {
      if (rows.length !== 1) return { data: null, error: { message: `Expected 1 row, found ${rows.length}` }, count };
      return { data: rows[0], error: null, count };
    }
    if (this.resultMode === "maybeSingle") return { data: rows[0] ?? null, error: null, count };
    return { data: rows, error: null, count };
  }
}

export const localDb = {
  from(table: string) {
    if (!db.tables[table]) throw new Error(`Unknown table "${table}"`);
    return new LocalQuery(table);
  },
};
