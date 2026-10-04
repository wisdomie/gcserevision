import { z } from "zod";
import { BOARD_SLUGS, TIERS } from "@/lib/engine/types";
import { AVATARS } from "./avatars";

export const ProfileInputSchema = z.object({
  username: z.string().trim(),
  avatar: z.enum(AVATARS),
  board: z.enum(BOARD_SLUGS),
  tier: z.enum(TIERS),
});
export type ProfileInput = z.infer<typeof ProfileInputSchema>;
