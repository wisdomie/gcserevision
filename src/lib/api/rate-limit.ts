import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "./handler";
import {
  clientIp,
  LIMITS,
  tooManyMessage,
  type ActionLimits,
  type LimitedAction,
} from "./limits";

/** IPs are stored only as a keyed hash, and only for a day. */
function hashIp(ip: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHmac("sha256", secret).update(ip).digest("base64url").slice(0, 22);
}

/**
 * Counts this request against the action's limits for the user and their IP.
 * Throws a 429 ApiError when either is used up.
 */
export async function enforceRateLimit(
  action: LimitedAction,
  userId: string,
  request: Request,
): Promise<void> {
  const limits: ActionLimits = LIMITS[action];
  const rules: { key: string; window_seconds: number; max: number }[] = [
    {
      key: `${action}:u:${userId}`,
      window_seconds: limits.perUser.windowSeconds,
      max: limits.perUser.max,
    },
  ];
  const ip = clientIp(request.headers);
  if (ip && limits.perIp) {
    rules.push({
      key: `${action}:ip:${hashIp(ip)}`,
      window_seconds: limits.perIp.windowSeconds,
      max: limits.perIp.max,
    });
  }

  const { data: retryAfter, error } = await createAdminClient().rpc("rate_limit_check", {
    p_rules: rules,
  });
  // Never lock players out because the limiter itself failed
  if (error) {
    console.error("rate limit check failed", error);
    return;
  }
  if (retryAfter > 0) throw new ApiError(429, tooManyMessage(retryAfter), retryAfter);
}
