import { and, eq, gte, lte, isNull, or, sql } from "drizzle-orm";
import {
  db,
  usuariosTable,
  eventosTable,
  tarefasTable,
  relacoesDiscipuladoTable,
  configuracaoRecorrenciaTable,
  campanhasTable,
  itensArrecadadosTable,
  relatoriosTable,
  type Relatorio,
} from "@workspace/db";

export interface ReportCampaignItem {
  itemName: string;
  quantity: number;
  unit: string | null;
}

export interface ReportCampaign {
  campaignId: number;
  title: string;
  status: string;
  items: ReportCampaignItem[];
}

export interface ReportData {
  membersTotal: number;
  membersNew: number;
  guestsNew: number;
  guestsTotal: number;
  meetingsHeld: number;
  eventsCount: number;
  tasksTotal: number;
  tasksDone: number;
  discipleshipTotal: number;
  discipleshipActive: number;
  campaigns: ReportCampaign[];
}

function parseDateUTC(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Count occurrences of a weekday between two dates (inclusive). */
function countWeekday(start: Date, end: Date, weekday: number): number {
  let count = 0;
  const cursor = new Date(start);
  const offset = (weekday - cursor.getUTCDay() + 7) % 7;
  cursor.setUTCDate(cursor.getUTCDate() + offset);
  while (cursor <= end) {
    count++;
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return count;
}

export async function computeReportData(
  periodStart: string,
  periodEnd: string,
): Promise<ReportData> {
  const startDate = parseDateUTC(periodStart);
  const endDate = parseDateUTC(periodEnd);

  const [
    members,
    events,
    tasks,
    relations,
    [recurrence],
    campaigns,
  ] = await Promise.all([
    db.select().from(usuariosTable).where(eq(usuariosTable.active, true)),
    db
      .select()
      .from(eventosTable)
      .where(
        and(
          gte(eventosTable.eventDate, periodStart),
          lte(eventosTable.eventDate, periodEnd),
        ),
      ),
    db
      .select()
      .from(tarefasTable)
      .where(
        and(
          gte(tarefasTable.weekStart, periodStart),
          lte(tarefasTable.weekStart, periodEnd),
        ),
      ),
    db.select().from(relacoesDiscipuladoTable),
    db.select().from(configuracaoRecorrenciaTable).limit(1),
    db
      .select()
      .from(campanhasTable)
      .where(
        and(
          lte(campanhasTable.startDate, periodEnd),
          or(
            isNull(campanhasTable.endDate),
            gte(campanhasTable.endDate, periodStart),
          ),
        ),
      ),
  ]);

  const membersOnly = members.filter((m) => m.status === "member");
  const guests = members.filter((m) => m.status === "guest");
  const inPeriod = (d: Date | null): boolean =>
    d !== null && d >= startDate && d < new Date(endDate.getTime() + 86400000);

  const membersNew = membersOnly.filter((m) =>
    inPeriod(m.joinedAt ?? m.createdAt),
  ).length;
  const guestsNew = guests.filter((g) => inPeriod(g.createdAt)).length;

  let meetingsHeld = 0;
  if (recurrence) {
    meetingsHeld = countWeekday(startDate, endDate, recurrence.weekday);
    const canceledOverrides = events.filter(
      (e) => e.type === "meeting_override" && e.canceled,
    ).length;
    meetingsHeld = Math.max(0, meetingsHeld - canceledOverrides);
  }
  const eventsCount = events.filter(
    (e) => e.type === "free" && !e.canceled,
  ).length;

  const tasksTotal = tasks.length;
  const tasksDone = tasks.filter((t) => t.status === "done").length;

  const reportCampaigns: ReportCampaign[] = [];
  for (const campaign of campaigns) {
    const items = await db
      .select({
        itemName: itensArrecadadosTable.itemName,
        unit: itensArrecadadosTable.unit,
        quantity: sql<number>`sum(${itensArrecadadosTable.quantity})::int`,
      })
      .from(itensArrecadadosTable)
      .where(eq(itensArrecadadosTable.campaignId, campaign.id))
      .groupBy(itensArrecadadosTable.itemName, itensArrecadadosTable.unit);
    reportCampaigns.push({
      campaignId: campaign.id,
      title: campaign.title,
      status: campaign.status,
      items: items.map((i) => ({
        itemName: i.itemName,
        quantity: i.quantity,
        unit: i.unit,
      })),
    });
  }

  return {
    membersTotal: membersOnly.length,
    membersNew,
    guestsNew,
    guestsTotal: guests.length,
    meetingsHeld,
    eventsCount,
    tasksTotal,
    tasksDone,
    discipleshipTotal: relations.length,
    discipleshipActive: relations.filter((r) => r.status === "active").length,
    campaigns: reportCampaigns,
  };
}

export async function generateAndStoreReport(options: {
  type: "monthly" | "on_demand";
  periodStart: string;
  periodEnd: string;
  createdBy: number | null;
}): Promise<Relatorio> {
  const data = await computeReportData(options.periodStart, options.periodEnd);
  const [report] = await db
    .insert(relatoriosTable)
    .values({
      type: options.type,
      periodStart: options.periodStart,
      periodEnd: options.periodEnd,
      data,
      createdBy: options.createdBy,
    })
    .onConflictDoNothing()
    .returning();
  if (report) return report;
  // Monthly report for this period was created concurrently; return it
  const [existing] = await db
    .select()
    .from(relatoriosTable)
    .where(
      and(
        eq(relatoriosTable.type, options.type),
        eq(relatoriosTable.periodStart, options.periodStart),
        eq(relatoriosTable.periodEnd, options.periodEnd),
      ),
    )
    .limit(1);
  return existing;
}

function csvEscape(value: string | number | null): string {
  const s = value === null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function reportToCsv(report: Relatorio): string {
  const data = report.data as unknown as ReportData;
  const lines: string[] = [];
  const row = (...cells: Array<string | number | null>): void => {
    lines.push(cells.map(csvEscape).join(","));
  };

  row("Relatório da Célula");
  row("Período", `${report.periodStart} a ${report.periodEnd}`);
  row("Gerado em", report.createdAt.toISOString());
  row(
    "Tipo",
    report.type === "monthly" ? "Automático mensal" : "Sob demanda",
  );
  row();
  row("Seção", "Métrica", "Valor");
  row("Membros", "Total de membros", data.membersTotal);
  row("Membros", "Novos membros no período", data.membersNew);
  row("Membros", "Total de convidados", data.guestsTotal);
  row("Membros", "Novos convidados no período", data.guestsNew);
  row("Frequência", "Encontros realizados", data.meetingsHeld);
  row("Frequência", "Eventos avulsos", data.eventsCount);
  row("Tarefas", "Tarefas no período", data.tasksTotal);
  row("Tarefas", "Tarefas concluídas", data.tasksDone);
  row("Discipulado", "Relações de discipulado", data.discipleshipTotal);
  row("Discipulado", "Relações ativas", data.discipleshipActive);
  row();
  row("Campanhas — itens arrecadados (agregado, sem identificação de doador)");
  row("Campanha", "Status", "Item", "Quantidade", "Unidade");
  for (const campaign of data.campaigns) {
    if (campaign.items.length === 0) {
      row(campaign.title, campaign.status, "(nenhum item registrado)", 0, "");
      continue;
    }
    for (const item of campaign.items) {
      row(
        campaign.title,
        campaign.status,
        item.itemName,
        item.quantity,
        item.unit ?? "",
      );
    }
  }
  return lines.join("\r\n") + "\r\n";
}

/** First and last day of the month before the given date (UTC). */
export function previousMonthRange(now: Date): {
  periodStart: string;
  periodEnd: string;
} {
  const firstOfCurrent = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const lastOfPrevious = new Date(firstOfCurrent.getTime() - 86400000);
  const firstOfPrevious = new Date(
    Date.UTC(lastOfPrevious.getUTCFullYear(), lastOfPrevious.getUTCMonth(), 1),
  );
  return {
    periodStart: toDateString(firstOfPrevious),
    periodEnd: toDateString(lastOfPrevious),
  };
}
