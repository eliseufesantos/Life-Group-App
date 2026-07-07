import { Router, type IRouter } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import { db, relatoriosTable, usuariosTable, type Relatorio } from "@workspace/db";
import {
  GenerateReportBody,
  GetReportParams,
  DeleteReportParams,
  ExportReportCsvParams,
} from "@workspace/api-zod";
import {
  requireAuth,
  requirePrivileged,
  type AuthedRequest,
} from "../lib/auth";
import { generateAndStoreReport, reportToCsv } from "../lib/reports";

const router: IRouter = Router();

async function creatorNames(
  reports: Relatorio[],
): Promise<Map<number, string>> {
  const ids = Array.from(
    new Set(
      reports.map((r) => r.createdBy).filter((id): id is number => id !== null),
    ),
  );
  const names = new Map<number, string>();
  if (ids.length === 0) return names;
  const rows = await db
    .select({ id: usuariosTable.id, name: usuariosTable.name })
    .from(usuariosTable)
    .where(inArray(usuariosTable.id, ids));
  for (const r of rows) names.set(r.id, r.name);
  return names;
}

function reportDto(
  report: Relatorio,
  names: Map<number, string>,
  includeData: boolean,
): Record<string, unknown> {
  const dto: Record<string, unknown> = {
    id: report.id,
    type: report.type,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    createdByName:
      report.createdBy !== null ? (names.get(report.createdBy) ?? null) : null,
    createdAt: report.createdAt.toISOString(),
  };
  if (includeData) dto.data = report.data;
  return dto;
}

router.get(
  "/reports",
  requireAuth,
  requirePrivileged,
  async (_req, res): Promise<void> => {
    const reports = await db
      .select()
      .from(relatoriosTable)
      .orderBy(desc(relatoriosTable.createdAt));
    const names = await creatorNames(reports);
    res.json(reports.map((r) => reportDto(r, names, false)));
  },
);

router.post(
  "/reports/generate",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const parsed = GenerateReportBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (parsed.data.periodStart > parsed.data.periodEnd) {
      res.status(400).json({ error: "Período inválido: início após o fim" });
      return;
    }
    const report = await generateAndStoreReport({
      type: "on_demand",
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      createdBy: req.user!.id,
    });
    const names = await creatorNames([report]);
    res.status(201).json(reportDto(report, names, true));
  },
);

router.get(
  "/reports/:id",
  requireAuth,
  requirePrivileged,
  async (req, res): Promise<void> => {
    const params = GetReportParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [report] = await db
      .select()
      .from(relatoriosTable)
      .where(eq(relatoriosTable.id, params.data.id));
    if (!report) {
      res.status(404).json({ error: "Relatório não encontrado" });
      return;
    }
    const names = await creatorNames([report]);
    res.json(reportDto(report, names, true));
  },
);

router.delete(
  "/reports/:id",
  requireAuth,
  requirePrivileged,
  async (req, res): Promise<void> => {
    const params = DeleteReportParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db.delete(relatoriosTable).where(eq(relatoriosTable.id, params.data.id));
    res.json({ ok: true });
  },
);

router.get(
  "/reports/:id/csv",
  requireAuth,
  requirePrivileged,
  async (req, res): Promise<void> => {
    const params = ExportReportCsvParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [report] = await db
      .select()
      .from(relatoriosTable)
      .where(eq(relatoriosTable.id, params.data.id));
    if (!report) {
      res.status(404).json({ error: "Relatório não encontrado" });
      return;
    }
    const csv = reportToCsv(report);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="relatorio-${report.periodStart}-${report.periodEnd}.csv"`,
    );
    // BOM so Excel opens UTF-8 accents correctly
    res.send("\uFEFF" + csv);
  },
);

export default router;
