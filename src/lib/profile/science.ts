import { z } from "zod";
import { BOARD_SLUGS, TIERS } from "@/lib/engine/types";

/**
 * Science settings: one board, tier and course for all the sciences, which can
 * differ from maths (PLAN.md M9).
 */
export const ScienceInputSchema = z.object({
  board: z.enum(BOARD_SLUGS),
  tier: z.enum(TIERS),
  course: z.enum(["combined", "separate"]),
});
export type ScienceInput = z.infer<typeof ScienceInputSchema>;

export const COURSES = [
  {
    value: "combined",
    label: "Combined Science",
    hint: "Biology, chemistry and physics as one GCSE (two grades)",
  },
  {
    value: "separate",
    label: "Triple Science",
    hint: "Separate GCSEs in biology, chemistry and physics",
  },
] as const;
