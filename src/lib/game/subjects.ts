// Subjects players can choose (PLAN.md M9). Each is a row in `subjects`;
// maths has generated and hand-written questions, biology hand-written ones.
import { z } from "zod";

export const SUBJECTS = [
  { slug: "maths", name: "Maths" },
  { slug: "biology", name: "Biology" },
] as const;

export const SubjectSlugSchema = z.enum(["maths", "biology"]);
export type SubjectSlug = z.infer<typeof SubjectSlugSchema>;

/** A subject slug from a query string, falling back to maths. */
export function subjectFromParam(value: unknown): SubjectSlug {
  const parsed = SubjectSlugSchema.safeParse(value);
  return parsed.success ? parsed.data : "maths";
}
