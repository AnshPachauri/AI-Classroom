import raw from "@/data/lesson.json";
import type { Chunk, Lesson, PublicLesson } from "@/lib/types";

export const lesson = raw as Lesson;

export function publicLesson(l: Lesson = lesson): PublicLesson {
  return { ...l, misconceptions: l.misconceptions.map(({ tag, label }) => ({ tag, label })) };
}

export function chunkAt(t: number, l: Pick<Lesson, "chunks"> = lesson): Chunk {
  return l.chunks.find((c) => t >= c.start && t < c.end) ?? l.chunks[l.chunks.length - 1];
}

export function conceptLabel(id: string, l: Pick<Lesson, "concepts"> = lesson): string {
  return l.concepts.find((c) => c.id === id)?.label ?? id;
}
