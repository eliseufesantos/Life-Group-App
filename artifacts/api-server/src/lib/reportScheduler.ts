import { and, eq } from "drizzle-orm";
import { db, relatoriosTable } from "@workspace/db";
import { generateAndStoreReport, previousMonthRange } from "./reports";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

async function ensureMonthlyReport(): Promise<void> {
  const { periodStart, periodEnd } = previousMonthRange(new Date());
  const [existing] = await db
    .select({ id: relatoriosTable.id })
    .from(relatoriosTable)
    .where(
      and(
        eq(relatoriosTable.type, "monthly"),
        eq(relatoriosTable.periodStart, periodStart),
        eq(relatoriosTable.periodEnd, periodEnd),
      ),
    )
    .limit(1);
  if (existing) return;
  const report = await generateAndStoreReport({
    type: "monthly",
    periodStart,
    periodEnd,
    createdBy: null,
  });
  logger.info(
    { reportId: report.id, periodStart, periodEnd },
    "Monthly report generated automatically",
  );
}

export function startReportScheduler(): void {
  const run = (): void => {
    ensureMonthlyReport().catch((err) => {
      logger.error({ err }, "Monthly report generation failed");
    });
  };
  run();
  setInterval(run, CHECK_INTERVAL_MS);
}
