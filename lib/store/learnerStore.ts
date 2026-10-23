import fs from "node:fs/promises";
import path from "node:path";
import { lesson } from "@/lib/lesson";
import type { ConceptState, ConceptView, LearnerState, LearnerSummary, MasteryStatus } from "@/lib/types";

/**
 * Persistence boundary. Swap the implementation (e.g. DynamoDB) without
 * touching routes or tutor logic.
 */
export interface LearnerStore {
  get(id: string): Promise<LearnerState>;
  save(state: LearnerState): Promise<void>;
  reset(id: string): Promise<LearnerState>;
}

// ---------- Mastery helpers ----------

export const GOOD_AT = 0.7;

export function statusOf(c: ConceptState): MasteryStatus {
  if (c.attempts === 0 && c.mastery === 0) return "unseen";
  return c.mastery >= GOOD_AT ? "good" : "weak";
}

/** Lowest-mastery prerequisite of a concept (the one most likely missing). */
export function weakestPrerequisite(learner: LearnerState, conceptId: string): string | null {
  const prereqs = lesson.concepts.find((c) => c.id === conceptId)?.prerequisites ?? [];
  if (!prereqs.length) return null;
  return [...prereqs].sort((a, b) => learner.concepts[a].mastery - learner.concepts[b].mastery)[0];
}

export function summarize(learner: LearnerState): LearnerSummary {
  const concepts: Record<string, ConceptView> = {};
  const misconceptions: LearnerSummary["misconceptions"] = [];
  for (const node of lesson.concepts) {
    const c = learner.concepts[node.id];
    concepts[node.id] = {
      mastery: Number(c.mastery.toFixed(2)),
      status: statusOf(c),
      flagged: c.flagged,
      misconceptions: c.misconceptions,
    };
    for (const tag of c.misconceptions) {
      const label = lesson.misconceptions.find((m) => m.tag === tag)?.label ?? tag;
      misconceptions.push({ tag, label, concept: node.id });
    }
  }
  return { concepts, misconceptions, eventCount: learner.events.length };
}

/** A student who knows the basics, is shaky on back EMF / power factor, and hasn't seen the rest. */
export function seedLearner(id: string): LearnerState {
  const seed: Record<string, [number, number]> = {
    phasors: [0.8, 3],
    sync_speed: [0.75, 2],
    back_emf: [0.55, 2],
    power_factor: [0.3, 1],
    excitation: [0.45, 1],
  };
  const concepts: Record<string, ConceptState> = {};
  for (const node of lesson.concepts) {
    const [mastery, attempts] = seed[node.id] ?? [0, 0];
    concepts[node.id] = { mastery, attempts, misconceptions: [], lastSeen: null, flagged: false };
  }
  return { id, position: 0, concepts, events: [], pending: null };
}

// ---------- Default implementation: in-memory + best-effort JSON file ----------
// The cache lives on globalThis because Next may bundle each route separately.
// On serverless hosts the file write is skipped (read-only FS) and state is
// per-instance only. Use a real store (DynamoDB) there.

const g = globalThis as unknown as { __learnerCache?: Map<string, LearnerState>; __learnerStore?: LearnerStore };
const cache = (g.__learnerCache ??= new Map<string, LearnerState>());

class FileLearnerStore implements LearnerStore {
  constructor(private file: string | null) {}

  async get(id: string) {
    let s = cache.get(id);
    if (!s) {
      s = (await this.read(id)) ?? seedLearner(id);
      cache.set(id, s);
    }
    return structuredClone(s);
  }

  async save(state: LearnerState) {
    state.events = state.events.slice(-200);
    cache.set(state.id, structuredClone(state));
    await this.write();
  }

  async reset(id: string) {
    const fresh = seedLearner(id);
    await this.save(fresh);
    return structuredClone(fresh);
  }

  private async read(id: string): Promise<LearnerState | null> {
    if (!this.file) return null;
    try {
      const all = JSON.parse(await fs.readFile(this.file, "utf8")) as Record<string, LearnerState>;
      return all[id] ?? null;
    } catch {
      return null;
    }
  }

  private async write() {
    if (!this.file) return;
    try {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file, JSON.stringify(Object.fromEntries(cache), null, 2));
    } catch {
      /* read-only filesystem: stay in memory */
    }
  }
}

export function getLearnerStore(): LearnerStore {
  return (g.__learnerStore ??= new FileLearnerStore(
    process.env.LEARNER_STORE === "memory" ? null : path.join(process.cwd(), ".data", "learners.json"),
  ));
}
