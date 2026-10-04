export const dynamic = "force-dynamic";

/** Server time for client clock-offset calibration (PLAN.md 10). No sign-in needed. */
export function GET() {
  return Response.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
