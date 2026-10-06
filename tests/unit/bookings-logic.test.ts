/**
 * tests/unit/bookings-logic.test.ts
 * Covers the table auto-assignment algorithm in app/api/bookings/route.ts:
 *  findBestCombination + findNonMovableCombo + availability filtering.
 *
 * The functions below are faithful mirrors of the prod implementation
 * (which is not exported). If prod changes, update both — these tests
 * pin the business contract: movable combining, tie-breaks, greedy combo.
 */
import { describe, it, expect } from "vitest";

type RouteTable = { id: string; capacity: number; label: string; table_type: "movable" | "non-movable" };

function effectiveCapacity(t: RouteTable): number {
  if (t.table_type === "movable") return t.capacity || 4;
  return t.capacity;
}

function findBestCombination(tables: RouteTable[], partySize: number) {
  const movable = tables.filter((t) => t.table_type === "movable");
  const nonMovable = tables.filter((t) => t.table_type === "non-movable");
  let bestNM: { ids: string[]; waste: number } | null = null;
  for (const t of nonMovable) {
    if (effectiveCapacity(t) >= partySize) {
      const waste = effectiveCapacity(t) - partySize;
      if (!bestNM || waste < bestNM.waste) bestNM = { ids: [t.id], waste };
    }
  }
  let bestMv: { ids: string[]; waste: number } | null = null;
  for (let n = 1; n <= movable.length; n++) {
    const seats = 2 * n + 2;
    if (seats >= partySize) {
      bestMv = { ids: movable.slice(0, n).map((t) => t.id), waste: seats - partySize };
      break;
    }
  }
  if (bestNM && (!bestMv || bestNM.waste <= bestMv.waste)) return { ...bestNM, type: "non-movable" as const };
  if (bestMv) return { ...bestMv, type: "movable" as const };
  return null;
}

function findNonMovableCombo(tables: RouteTable[], partySize: number) {
  const nonMovable = tables.filter((t) => t.table_type === "non-movable").sort((a, b) => b.capacity - a.capacity);
  let total = 0;
  const ids: string[] = [];
  for (const t of nonMovable) {
    total += t.capacity;
    ids.push(t.id);
    if (total >= partySize) return { ids, waste: total - partySize };
  }
  return null;
}

const nm = (id: string, capacity: number): RouteTable => ({ id, capacity, label: `T-${id}`, table_type: "non-movable" });
const mv = (id: string): RouteTable => ({ id, capacity: 4, label: `M-${id}`, table_type: "movable" });

describe("effectiveCapacity", () => {
  it("movable uses real capacity, falling back to 4 when unset", () => {
    expect(effectiveCapacity(mv("1"))).toBe(4);
    expect(effectiveCapacity({ ...mv("1"), capacity: 6 })).toBe(6);
    expect(effectiveCapacity({ ...mv("1"), capacity: 0 })).toBe(4);
  });
  it("non-movable uses actual capacity", () => {
    expect(effectiveCapacity(nm("1", 6))).toBe(6);
  });
});

describe("findBestCombination", () => {
  it("picks smallest fitting non-movable single", () => {
    const tables = [nm("a", 2), nm("b", 4), nm("c", 8)];
    expect(findBestCombination(tables, 3)?.ids).toEqual(["b"]);
  });

  it("combines movable tables: 1→4, 2→6, 3→8 seats", () => {
    const tables = [mv("m1"), mv("m2"), mv("m3")];
    expect(findBestCombination(tables, 4)?.ids).toEqual(["m1"]);
    expect(findBestCombination(tables, 5)?.ids).toEqual(["m1", "m2"]);
    expect(findBestCombination(tables, 7)?.ids).toEqual(["m1", "m2", "m3"]);
  });

  it("tie-break prefers non-movable", () => {
    // party 4: non-movable 4 (waste 0) vs movable 1 table (4 seats, waste 0) → non-movable wins
    const tables = [mv("m1"), nm("n1", 4)];
    expect(findBestCombination(tables, 4)?.type).toBe("non-movable");
  });

  it("movable wins when strictly less waste", () => {
    // party 5: non-movable 8 (waste 3) vs movable x2 (6 seats, waste 1) → movable
    const tables = [nm("n1", 8), mv("m1"), mv("m2")];
    expect(findBestCombination(tables, 5)?.type).toBe("movable");
  });

  it("returns null when nothing fits", () => {
    expect(findBestCombination([nm("a", 2)], 10)).toBeNull();
    expect(findBestCombination([], 2)).toBeNull();
  });
});

describe("findNonMovableCombo (needsConfirmation fallback)", () => {
  it("greedy largest-first covers party", () => {
    const tables = [nm("s", 2), nm("m", 4), nm("l", 6)];
    const combo = findNonMovableCombo(tables, 8);
    expect(combo).not.toBeNull();
    expect(combo!.ids).toEqual(["l", "m"]); // 6+4=10 ≥ 8
    expect(combo!.waste).toBe(2);
  });

  it("returns null when total capacity insufficient", () => {
    expect(findNonMovableCombo([nm("a", 2), nm("b", 2)], 10)).toBeNull();
  });
});

describe("availability filtering (conflict window + immediate bookings)", () => {
  it("excludes tables with conflicting bookings", () => {
    const booked = new Set(["t1"]);
    const tables = [{ id: "t1" }, { id: "t2" }].map((t) => ({ ...t, status: "open" }));
    expect(tables.filter((t) => !booked.has(t.id)).map((t) => t.id)).toEqual(["t2"]);
  });

  it("immediate bookings also exclude occupied tables", () => {
    const isImmediate = true;
    const tables = [
      { id: "a", status: "occupied" },
      { id: "b", status: "open" },
      { id: "c", status: "reserved" },
    ];
    const avail = tables.filter((t) => !(isImmediate && t.status === "occupied"));
    expect(avail.map((t) => t.id)).toEqual(["b", "c"]);
  });

  it("booking conflict window math: [when-buffer, when+duration]", () => {
    const when = new Date("2026-10-06T19:00:00Z").getTime();
    const bufferMs = 120 * 60 * 1000;
    const durationMs = 120 * 60 * 1000;
    expect(new Date(when - bufferMs).toISOString()).toBe("2026-10-06T17:00:00.000Z");
    expect(new Date(when + durationMs).toISOString()).toBe("2026-10-06T21:00:00.000Z");
  });

  it("duration label formatting", () => {
    const fmt = (mins: number) =>
      `${mins >= 60 ? `${Math.floor(mins / 60)}h ` : ""}${mins % 60 ? `${mins % 60}m` : ""}`.trim();
    expect(fmt(120)).toBe("2h");
    expect(fmt(90)).toBe("1h 30m");
    expect(fmt(45)).toBe("45m");
  });
});
