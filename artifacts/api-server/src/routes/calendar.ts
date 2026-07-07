import { Router, type IRouter } from "express";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import {
  db,
  configuracaoRecorrenciaTable,
  eventosTable,
  type ConfiguracaoRecorrencia,
  type Evento,
} from "@workspace/db";
import {
  SetRecurrenceBody,
  ListCalendarEventsQueryParams,
  CreateEventBody,
  UpdateEventBody,
  UpdateEventParams,
  DeleteEventParams,
  OverrideOccurrenceBody,
  OverrideOccurrenceParams,
  ClearOccurrenceOverrideParams,
} from "@workspace/api-zod";
import { requireAuth, requirePrivileged, type AuthedRequest } from "../lib/auth";
import { notifyUsers } from "../lib/push";

const router: IRouter = Router();

export const MEETING_TITLE = "Reunião da Célula";

interface CalendarEventDto {
  id: number | null;
  type: "meeting" | "free";
  title: string;
  category: string | null;
  date: string;
  time: string | null;
  location: string | null;
  description: string | null;
  canceled: boolean;
  overridden: boolean;
}

async function getConfig(): Promise<ConfiguracaoRecorrencia | null> {
  const [config] = await db.select().from(configuracaoRecorrenciaTable).limit(1);
  return config ?? null;
}

function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function meetingDatesBetween(
  weekday: number,
  from: string,
  to: string,
): string[] {
  const dates: string[] = [];
  let current = from;
  const offset = (weekday - weekdayOf(from) + 7) % 7;
  current = addDays(from, offset);
  while (current <= to) {
    dates.push(current);
    current = addDays(current, 7);
  }
  return dates;
}

function toMeetingEvent(
  config: ConfiguracaoRecorrencia,
  date: string,
  override: Evento | undefined,
): CalendarEventDto {
  return {
    id: override?.id ?? null,
    type: "meeting",
    title: MEETING_TITLE,
    category: null,
    date,
    time: override?.time ?? config.time,
    location: override?.location ?? config.location,
    description: null,
    canceled: override?.canceled ?? false,
    overridden: !!override,
  };
}

function toFreeEvent(evento: Evento): CalendarEventDto {
  return {
    id: evento.id,
    type: "free",
    title: evento.title ?? "",
    category: evento.category,
    date: evento.eventDate,
    time: evento.time,
    location: evento.location,
    description: evento.description,
    canceled: false,
    overridden: false,
  };
}

router.get("/calendar/recurrence", requireAuth, async (_req, res): Promise<void> => {
  const config = await getConfig();
  res.json({
    configured: !!config,
    weekday: config?.weekday ?? null,
    time: config?.time ?? null,
    location: config?.location ?? null,
  });
});

router.put(
  "/calendar/recurrence",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const parsed = SetRecurrenceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { weekday, time, location } = parsed.data;
    const existing = await getConfig();
    let config: ConfiguracaoRecorrencia;
    if (existing) {
      [config] = await db
        .update(configuracaoRecorrenciaTable)
        .set({ weekday, time, location: location ?? null })
        .where(eq(configuracaoRecorrenciaTable.id, existing.id))
        .returning();
    } else {
      [config] = await db
        .insert(configuracaoRecorrenciaTable)
        .values({ weekday, time, location: location ?? null })
        .returning();
    }
    res.json({
      configured: true,
      weekday: config.weekday,
      time: config.time,
      location: config.location,
    });
  },
);

router.get("/calendar/next-meeting", requireAuth, async (_req, res): Promise<void> => {
  const config = await getConfig();
  if (!config) {
    res.json({
      configured: false,
      date: null,
      time: null,
      location: null,
      overridden: false,
    });
    return;
  }
  const from = todayStr();
  const to = addDays(from, 8 * 7);
  const dates = meetingDatesBetween(config.weekday, from, to);
  const overrides = await db
    .select()
    .from(eventosTable)
    .where(
      and(
        eq(eventosTable.type, "meeting_override"),
        gte(eventosTable.eventDate, from),
        lte(eventosTable.eventDate, to),
      ),
    );
  const overrideByDate = new Map(overrides.map((o) => [o.eventDate, o]));
  for (const date of dates) {
    const event = toMeetingEvent(config, date, overrideByDate.get(date));
    if (!event.canceled) {
      res.json({
        configured: true,
        date: event.date,
        time: event.time,
        location: event.location,
        overridden: event.overridden,
      });
      return;
    }
  }
  res.json({
    configured: true,
    date: null,
    time: null,
    location: null,
    overridden: false,
  });
});

router.get("/calendar/events", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const parsed = ListCalendarEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { from, to } = parsed.data;
  if (from > to) {
    res.status(400).json({ error: "Período inválido" });
    return;
  }

  const rows = await db
    .select()
    .from(eventosTable)
    .where(and(gte(eventosTable.eventDate, from), lte(eventosTable.eventDate, to)))
    .orderBy(asc(eventosTable.eventDate));

  const overrideByDate = new Map(
    rows.filter((r) => r.type === "meeting_override").map((r) => [r.eventDate, r]),
  );
  const events: CalendarEventDto[] = rows
    .filter((r) => r.type === "free")
    .map(toFreeEvent);

  const config = await getConfig();
  if (config) {
    for (const date of meetingDatesBetween(config.weekday, from, to)) {
      events.push(toMeetingEvent(config, date, overrideByDate.get(date)));
    }
  }

  events.sort((a, b) =>
    a.date === b.date
      ? (a.time ?? "").localeCompare(b.time ?? "")
      : a.date.localeCompare(b.date),
  );
  res.json(events);
});

router.post(
  "/calendar/events",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const parsed = CreateEventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { title, category, date, time, location, description } = parsed.data;
    const [evento] = await db
      .insert(eventosTable)
      .values({
        type: "free",
        title,
        category,
        eventDate: date,
        time: time ?? null,
        location: location ?? null,
        description: description ?? null,
        createdBy: req.user!.id,
      })
      .returning();
    void notifyUsers({
      userIds: null,
      excludeUserId: req.user!.id,
      type: "event",
      title: "Novo evento no calendário",
      body: `${title}${date ? ` — ${date}` : ""}`,
      link: "/calendario",
    });
    res.status(201).json(toFreeEvent(evento));
  },
);

router.patch(
  "/calendar/events/:id",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = UpdateEventParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateEventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const update: Partial<typeof eventosTable.$inferInsert> = {};
    if (parsed.data.title !== undefined) update.title = parsed.data.title;
    if (parsed.data.category !== undefined) update.category = parsed.data.category;
    if (parsed.data.date !== undefined) update.eventDate = parsed.data.date;
    if (parsed.data.time !== undefined) update.time = parsed.data.time || null;
    if (parsed.data.location !== undefined)
      update.location = parsed.data.location || null;
    if (parsed.data.description !== undefined)
      update.description = parsed.data.description || null;

    const [evento] = await db
      .update(eventosTable)
      .set(update)
      .where(and(eq(eventosTable.id, params.data.id), eq(eventosTable.type, "free")))
      .returning();
    if (!evento) {
      res.status(404).json({ error: "Evento não encontrado" });
      return;
    }
    res.json(toFreeEvent(evento));
  },
);

router.delete(
  "/calendar/events/:id",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = DeleteEventParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db
      .delete(eventosTable)
      .where(and(eq(eventosTable.id, params.data.id), eq(eventosTable.type, "free")));
    res.json({ ok: true });
  },
);

router.put(
  "/calendar/occurrences/:date",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = OverrideOccurrenceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = OverrideOccurrenceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const config = await getConfig();
    if (!config) {
      res.status(400).json({ error: "Recorrência não configurada" });
      return;
    }
    const date = params.data.date;
    if (weekdayOf(date) !== config.weekday) {
      res.status(400).json({ error: "Data não é uma ocorrência da reunião semanal" });
      return;
    }

    const values = {
      time: parsed.data.time ?? null,
      location: parsed.data.location ?? null,
      canceled: parsed.data.canceled ?? false,
      createdBy: req.user!.id,
    };

    const [existing] = await db
      .select()
      .from(eventosTable)
      .where(
        and(
          eq(eventosTable.type, "meeting_override"),
          eq(eventosTable.eventDate, date),
        ),
      );

    let override: Evento;
    if (existing) {
      [override] = await db
        .update(eventosTable)
        .set(values)
        .where(eq(eventosTable.id, existing.id))
        .returning();
    } else {
      [override] = await db
        .insert(eventosTable)
        .values({ type: "meeting_override", eventDate: date, ...values })
        .returning();
    }
    res.json(toMeetingEvent(config, date, override));
  },
);

router.delete(
  "/calendar/occurrences/:date",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = ClearOccurrenceOverrideParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db
      .delete(eventosTable)
      .where(
        and(
          eq(eventosTable.type, "meeting_override"),
          eq(eventosTable.eventDate, params.data.date),
        ),
      );
    res.json({ ok: true });
  },
);

export default router;
