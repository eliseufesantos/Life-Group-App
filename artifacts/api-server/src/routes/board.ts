import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import {
  db,
  usuariosTable,
  avisosTable,
  enquetesTable,
  opcoesEnqueteTable,
  votosEnqueteTable,
  tarefasTable,
  fotosTable,
  albunsTable,
  eventosTable,
  type Album,
  type Aviso,
  type Enquete,
  type Foto,
  type Tarefa,
} from "@workspace/db";
import {
  CreateAnnouncementBody,
  UpdateAnnouncementBody,
  UpdateAnnouncementParams,
  DeleteAnnouncementParams,
  CreatePollBody,
  VotePollBody,
  VotePollParams,
  ClosePollParams,
  DeletePollParams,
  ListTasksQueryParams,
  CreateTaskBody,
  ApproveTaskParams,
  CompleteTaskParams,
  DeleteTaskParams,
  CreatePhotoBody,
  DeletePhotoParams,
  CreateAlbumBody,
  UpdateAlbumBody,
  UpdateAlbumParams,
  DeleteAlbumParams,
} from "@workspace/api-zod";
import { requireAuth, requirePrivileged, isPrivileged, type AuthedRequest } from "../lib/auth";
import { ObjectStorageService } from "../lib/objectStorage";
import { isSafeHttpUrl } from "../lib/validation";
import { notifyUsers } from "../lib/push";
import { ensureBirthdayAvisos } from "../lib/automations";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

async function nameMap(ids: Array<number | null>): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  const unique = Array.from(new Set(ids.filter((id): id is number => id !== null)));
  if (unique.length === 0) return names;
  const people = await db
    .select({ id: usuariosTable.id, name: usuariosTable.name })
    .from(usuariosTable)
    .where(inArray(usuariosTable.id, unique));
  for (const p of people) names.set(p.id, p.name);
  return names;
}

// --- Avisos ---

function avisoDto(a: Aviso, authorName: string | null): Record<string, unknown> {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    origin: a.origin,
    authorName,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

router.get("/board/announcements", requireAuth, async (_req, res): Promise<void> => {
  // Lazy check: post today's birthday avisos before listing
  await ensureBirthdayAvisos();
  const avisos = await db
    .select()
    .from(avisosTable)
    .orderBy(desc(avisosTable.createdAt));
  const names = await nameMap(avisos.map((a) => a.createdBy));
  res.json(
    avisos.map((a) =>
      avisoDto(a, a.createdBy !== null ? (names.get(a.createdBy) ?? null) : null),
    ),
  );
});

router.post(
  "/board/announcements",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const parsed = CreateAnnouncementBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [aviso] = await db
      .insert(avisosTable)
      .values({
        title: parsed.data.title,
        body: parsed.data.body,
        createdBy: req.user!.id,
      })
      .returning();
    void notifyUsers({
      userIds: null,
      excludeUserId: req.user!.id,
      type: "announcement",
      title: "Novo aviso no mural",
      body: aviso.title,
      link: "/mural",
    });
    res.status(201).json(avisoDto(aviso, req.user!.name));
  },
);

router.patch(
  "/board/announcements/:id",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = UpdateAnnouncementParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateAnnouncementBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const update: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) update.title = parsed.data.title;
    if (parsed.data.body !== undefined) update.body = parsed.data.body;

    let aviso: Aviso | undefined;
    if (Object.keys(update).length === 0) {
      [aviso] = await db
        .select()
        .from(avisosTable)
        .where(eq(avisosTable.id, params.data.id));
    } else {
      [aviso] = await db
        .update(avisosTable)
        .set(update)
        .where(eq(avisosTable.id, params.data.id))
        .returning();
    }
    if (!aviso) {
      res.status(404).json({ error: "Aviso não encontrado" });
      return;
    }
    const names = await nameMap([aviso.createdBy]);
    res.json(
      avisoDto(
        aviso,
        aviso.createdBy !== null ? (names.get(aviso.createdBy) ?? null) : null,
      ),
    );
  },
);

router.delete(
  "/board/announcements/:id",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = DeleteAnnouncementParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db.delete(avisosTable).where(eq(avisosTable.id, params.data.id));
    res.json({ ok: true });
  },
);

// --- Enquetes ---

interface PollVoterDto {
  id: number;
  name: string;
  avatarPath: string | null;
}

interface PollDto {
  id: number;
  question: string;
  closed: boolean;
  endsAt: string | null;
  anonymous: boolean;
  options: Array<{ id: number; text: string; votes: number; voters: PollVoterDto[] }>;
  myVote: number | null;
  totalVotes: number;
  authorName: string | null;
  createdAt: string;
}

async function buildPolls(polls: Enquete[], userId: number): Promise<PollDto[]> {
  if (polls.length === 0) return [];
  const pollIds = polls.map((p) => p.id);
  const options = await db
    .select()
    .from(opcoesEnqueteTable)
    .where(inArray(opcoesEnqueteTable.enqueteId, pollIds))
    .orderBy(asc(opcoesEnqueteTable.id));
  const votes = await db
    .select()
    .from(votosEnqueteTable)
    .where(inArray(votosEnqueteTable.enqueteId, pollIds));
  const names = await nameMap(polls.map((p) => p.createdBy));

  const voters = new Map<number, PollVoterDto>();
  const voterIds = Array.from(new Set(votes.map((v) => v.userId)));
  if (voterIds.length > 0) {
    const people = await db
      .select({
        id: usuariosTable.id,
        name: usuariosTable.name,
        avatarPath: usuariosTable.avatarPath,
      })
      .from(usuariosTable)
      .where(inArray(usuariosTable.id, voterIds));
    for (const p of people) voters.set(p.id, p);
  }

  return polls.map((poll) => {
    const pollOptions = options.filter((o) => o.enqueteId === poll.id);
    const pollVotes = votes.filter((v) => v.enqueteId === poll.id);
    const myVote = pollVotes.find((v) => v.userId === userId)?.opcaoId ?? null;
    return {
      id: poll.id,
      question: poll.question,
      closed: poll.closed,
      endsAt: poll.endsAt ? poll.endsAt.toISOString() : null,
      anonymous: poll.anonymous,
      options: pollOptions.map((o) => {
        const optionVotes = pollVotes.filter((v) => v.opcaoId === o.id);
        return {
          id: o.id,
          text: o.text,
          votes: optionVotes.length,
          // Anonymous polls only expose counts, never who voted
          voters: poll.anonymous
            ? []
            : optionVotes
                .map((v) => voters.get(v.userId))
                .filter((p): p is PollVoterDto => p !== undefined),
        };
      }),
      myVote,
      totalVotes: pollVotes.length,
      authorName:
        poll.createdBy !== null ? (names.get(poll.createdBy) ?? null) : null,
      createdAt: poll.createdAt.toISOString(),
    };
  });
}

router.get("/board/polls", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  // Expired polls are removed for good (product decision: no history kept)
  await db.delete(enquetesTable).where(lt(enquetesTable.endsAt, new Date()));
  const polls = await db
    .select()
    .from(enquetesTable)
    .orderBy(desc(enquetesTable.createdAt));
  res.json(await buildPolls(polls, req.user!.id));
});

router.post(
  "/board/polls",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const parsed = CreatePollBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (parsed.data.endsAt && parsed.data.endsAt.getTime() <= Date.now()) {
      res.status(400).json({ error: "O término deve ser no futuro" });
      return;
    }
    // Enquete + opções numa transação: sem isso, uma falha após o primeiro
    // insert deixaria uma enquete sem opções, que o GET ainda listaria
    // (buildPolls tolera lista vazia) — uma enquete quebrada e visível.
    const poll = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(enquetesTable)
        .values({
          question: parsed.data.question,
          endsAt: parsed.data.endsAt ?? null,
          anonymous: parsed.data.anonymous ?? false,
          createdBy: req.user!.id,
        })
        .returning();
      await tx
        .insert(opcoesEnqueteTable)
        .values(
          parsed.data.options.map((text) => ({ enqueteId: created.id, text })),
        );
      return created;
    });
    const [dto] = await buildPolls([poll], req.user!.id);
    res.status(201).json(dto);
  },
);

router.post("/board/polls/:id/vote", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = VotePollParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = VotePollBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [poll] = await db
    .select()
    .from(enquetesTable)
    .where(eq(enquetesTable.id, params.data.id));
  if (!poll) {
    res.status(404).json({ error: "Enquete não encontrada" });
    return;
  }
  if (poll.closed || (poll.endsAt !== null && poll.endsAt.getTime() <= Date.now())) {
    res.status(400).json({ error: "Enquete encerrada" });
    return;
  }
  const [option] = await db
    .select()
    .from(opcoesEnqueteTable)
    .where(
      and(
        eq(opcoesEnqueteTable.id, parsed.data.optionId),
        eq(opcoesEnqueteTable.enqueteId, poll.id),
      ),
    );
  if (!option) {
    res.status(400).json({ error: "Opção inválida" });
    return;
  }
  await db
    .insert(votosEnqueteTable)
    .values({ enqueteId: poll.id, opcaoId: option.id, userId: req.user!.id })
    .onConflictDoUpdate({
      target: [votosEnqueteTable.enqueteId, votosEnqueteTable.userId],
      set: { opcaoId: option.id },
    });
  const [dto] = await buildPolls([poll], req.user!.id);
  res.json(dto);
});

router.post(
  "/board/polls/:id/close",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = ClosePollParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [poll] = await db
      .update(enquetesTable)
      .set({ closed: true })
      .where(eq(enquetesTable.id, params.data.id))
      .returning();
    if (!poll) {
      res.status(404).json({ error: "Enquete não encontrada" });
      return;
    }
    const [dto] = await buildPolls([poll], req.user!.id);
    res.json(dto);
  },
);

router.delete(
  "/board/polls/:id",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = DeletePollParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db.delete(enquetesTable).where(eq(enquetesTable.id, params.data.id));
    res.json({ ok: true });
  },
);

// --- Tarefas ---

function currentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (day + 6) % 7; // days since Monday
  now.setUTCDate(now.getUTCDate() - diff);
  return now.toISOString().slice(0, 10);
}

async function toTaskDto(task: Tarefa): Promise<Record<string, unknown>> {
  const names = await nameMap([task.assignedTo, task.proposedBy]);
  return taskDtoWithNames(task, names);
}

function taskDtoWithNames(
  task: Tarefa,
  names: Map<number, string>,
): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title,
    weekStart: task.weekStart,
    assignedTo: task.assignedTo,
    assigneeName:
      task.assignedTo !== null ? (names.get(task.assignedTo) ?? null) : null,
    status: task.status,
    proposedByName:
      task.proposedBy !== null ? (names.get(task.proposedBy) ?? null) : null,
    doneAt: task.doneAt ? task.doneAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
  };
}

router.get("/board/tasks", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const parsed = ListTasksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const weekStart = parsed.data.weekStart ?? currentWeekStart();
  const tasks = await db
    .select()
    .from(tarefasTable)
    .where(eq(tarefasTable.weekStart, weekStart))
    .orderBy(asc(tarefasTable.createdAt));
  const names = await nameMap(
    tasks.flatMap((t) => [t.assignedTo, t.proposedBy]),
  );
  res.json(tasks.map((t) => taskDtoWithNames(t, names)));
});

router.post(
  "/board/tasks",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const parsed = CreateTaskBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [assignee] = await db
      .select({ id: usuariosTable.id, status: usuariosTable.status })
      .from(usuariosTable)
      .where(eq(usuariosTable.id, parsed.data.assignedTo));
    if (!assignee) {
      res.status(400).json({ error: "Responsável não encontrado" });
      return;
    }
    if (assignee.status === "guest") {
      res
        .status(400)
        .json({ error: "Convidado não pode receber tarefas" });
      return;
    }
    const status = req.user!.role === "leader" ? "approved" : "proposed";
    const [task] = await db
      .insert(tarefasTable)
      .values({
        title: parsed.data.title,
        weekStart: parsed.data.weekStart,
        assignedTo: parsed.data.assignedTo,
        status,
        proposedBy: req.user!.id,
      })
      .returning();
    if (task.assignedTo !== null) {
      void notifyUsers({
        userIds: [task.assignedTo],
        excludeUserId: req.user!.id,
        type: "task",
        title: "Você foi alocado na tarefa",
        body: task.title,
        link: "/mural",
      });
    }
    res.status(201).json(await toTaskDto(task));
  },
);

router.post("/board/tasks/:id/approve", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  if (req.user!.role !== "leader") {
    res.status(403).json({ error: "Apenas o líder pode aprovar tarefas" });
    return;
  }
  const params = ApproveTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [task] = await db
    .update(tarefasTable)
    .set({ status: "approved" })
    .where(
      and(eq(tarefasTable.id, params.data.id), eq(tarefasTable.status, "proposed")),
    )
    .returning();
  if (!task) {
    res.status(404).json({ error: "Tarefa não encontrada ou já aprovada" });
    return;
  }
  if (task.assignedTo !== null) {
    void notifyUsers({
      userIds: [task.assignedTo],
      excludeUserId: req.user!.id,
      type: "task",
      title: "Tarefa atribuída a você foi aprovada",
      body: task.title,
      link: "/mural",
    });
  }
  res.json(await toTaskDto(task));
});

router.post("/board/tasks/:id/done", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = CompleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(tarefasTable)
    .where(eq(tarefasTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Tarefa não encontrada" });
    return;
  }
  if (existing.status !== "approved") {
    res.status(400).json({ error: "Apenas tarefas aprovadas podem ser concluídas" });
    return;
  }
  const canComplete =
    isPrivileged(req.user) || existing.assignedTo === req.user!.id;
  if (!canComplete) {
    res.status(403).json({ error: "Apenas o responsável pode concluir esta tarefa" });
    return;
  }
  const [task] = await db
    .update(tarefasTable)
    .set({ status: "done", doneAt: new Date() })
    .where(eq(tarefasTable.id, existing.id))
    .returning();
  res.json(await toTaskDto(task));
});

router.delete(
  "/board/tasks/:id",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = DeleteTaskParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db.delete(tarefasTable).where(eq(tarefasTable.id, params.data.id));
    res.json({ ok: true });
  },
);

// --- Fotos ---

function photoDto(f: Foto, uploaderName: string | null): Record<string, unknown> {
  return {
    id: f.id,
    objectPath: f.objectPath,
    url: f.objectPath ? `/api/storage${f.objectPath}` : (f.externalUrl ?? ""),
    sourceType: f.sourceType,
    externalUrl: f.externalUrl,
    albumId: f.albumId,
    caption: f.caption,
    uploaderName,
    uploadedBy: f.uploadedBy,
    createdAt: f.createdAt.toISOString(),
  };
}

router.get("/board/photos", requireAuth, async (_req, res): Promise<void> => {
  const fotos = await db
    .select()
    .from(fotosTable)
    .orderBy(desc(fotosTable.createdAt));
  const names = await nameMap(fotos.map((f) => f.uploadedBy));
  res.json(
    fotos.map((f) =>
      photoDto(f, f.uploadedBy !== null ? (names.get(f.uploadedBy) ?? null) : null),
    ),
  );
});

router.post("/board/photos", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const parsed = CreatePhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { sourceType } = parsed.data;
  let objectPath: string | null = null;
  let externalUrl: string | null = null;

  if (sourceType === "drive") {
    if (!parsed.data.externalUrl || !parsed.data.externalUrl.startsWith("https://")) {
      res.status(400).json({
        error: "Fotos do Drive exigem um link https válido (externalUrl)",
      });
      return;
    }
    externalUrl = parsed.data.externalUrl;
  } else {
    if (!parsed.data.objectPath) {
      res.status(400).json({ error: "Fotos enviadas exigem objectPath" });
      return;
    }
    if (!parsed.data.objectPath.startsWith("/objects/")) {
      res.status(400).json({ error: "Caminho de objeto inválido" });
      return;
    }
    try {
      await objectStorageService.trySetObjectEntityAclPolicy(parsed.data.objectPath, {
        owner: String(req.user!.id),
        visibility: "public",
      });
    } catch (error) {
      req.log.error({ err: error }, "Falha ao definir ACL da foto");
      res.status(400).json({ error: "Objeto não encontrado no armazenamento" });
      return;
    }
    objectPath = parsed.data.objectPath;
  }

  if (parsed.data.albumId !== undefined) {
    const [album] = await db
      .select({ id: albunsTable.id })
      .from(albunsTable)
      .where(eq(albunsTable.id, parsed.data.albumId));
    if (!album) {
      res.status(400).json({ error: "Álbum não encontrado" });
      return;
    }
  }

  const [foto] = await db
    .insert(fotosTable)
    .values({
      objectPath,
      sourceType,
      externalUrl,
      albumId: parsed.data.albumId ?? null,
      caption: parsed.data.caption ?? null,
      uploadedBy: req.user!.id,
    })
    .returning();
  res.status(201).json(photoDto(foto, req.user!.name));
});

router.delete("/board/photos/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = DeletePhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [foto] = await db
    .select()
    .from(fotosTable)
    .where(eq(fotosTable.id, params.data.id));
  if (!foto) {
    res.status(404).json({ error: "Foto não encontrada" });
    return;
  }
  if (!isPrivileged(req.user) && foto.uploadedBy !== req.user!.id) {
    res.status(403).json({ error: "Sem permissão para excluir esta foto" });
    return;
  }
  await db.delete(fotosTable).where(eq(fotosTable.id, foto.id));
  res.json({ ok: true });
});

// --- Álbuns ---

function albumDto(
  album: Album,
  eventTitle: string | null,
  photoCount: number,
  createdByName: string | null,
): Record<string, unknown> {
  return {
    id: album.id,
    title: album.title,
    eventId: album.eventoId,
    eventTitle,
    driveUrl: album.driveUrl,
    photoCount,
    createdBy: album.createdBy,
    createdByName,
    createdAt: album.createdAt.toISOString(),
  };
}

async function albumDtoById(album: Album): Promise<Record<string, unknown>> {
  let eventTitle: string | null = null;
  if (album.eventoId !== null) {
    const [event] = await db
      .select({ title: eventosTable.title })
      .from(eventosTable)
      .where(eq(eventosTable.id, album.eventoId));
    eventTitle = event?.title ?? null;
  }
  const [count] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(fotosTable)
    .where(eq(fotosTable.albumId, album.id));
  const names = await nameMap([album.createdBy]);
  return albumDto(
    album,
    eventTitle,
    count?.count ?? 0,
    album.createdBy !== null ? (names.get(album.createdBy) ?? null) : null,
  );
}

router.get("/board/albums", requireAuth, async (_req, res): Promise<void> => {
  const albums = await db
    .select()
    .from(albunsTable)
    .orderBy(desc(albunsTable.createdAt));

  const albumIds = albums.map((a) => a.id);
  const counts = new Map<number, number>();
  if (albumIds.length > 0) {
    const rows = await db
      .select({
        albumId: fotosTable.albumId,
        count: sql<number>`count(*)::int`,
      })
      .from(fotosTable)
      .where(inArray(fotosTable.albumId, albumIds))
      .groupBy(fotosTable.albumId);
    for (const r of rows) {
      if (r.albumId !== null) counts.set(r.albumId, r.count);
    }
  }

  const eventIds = Array.from(
    new Set(
      albums.map((a) => a.eventoId).filter((id): id is number => id !== null),
    ),
  );
  const eventTitles = new Map<number, string | null>();
  if (eventIds.length > 0) {
    const rows = await db
      .select({ id: eventosTable.id, title: eventosTable.title })
      .from(eventosTable)
      .where(inArray(eventosTable.id, eventIds));
    for (const r of rows) eventTitles.set(r.id, r.title);
  }

  const names = await nameMap(albums.map((a) => a.createdBy));
  res.json(
    albums.map((a) =>
      albumDto(
        a,
        a.eventoId !== null ? (eventTitles.get(a.eventoId) ?? null) : null,
        counts.get(a.id) ?? 0,
        a.createdBy !== null ? (names.get(a.createdBy) ?? null) : null,
      ),
    ),
  );
});

router.post("/board/albums", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const parsed = CreateAlbumBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (
    parsed.data.driveUrl != null &&
    !isSafeHttpUrl(parsed.data.driveUrl)
  ) {
    res.status(400).json({ error: "URL do Drive inválida" });
    return;
  }
  if (parsed.data.eventId !== undefined) {
    const [event] = await db
      .select({ id: eventosTable.id })
      .from(eventosTable)
      .where(eq(eventosTable.id, parsed.data.eventId));
    if (!event) {
      res.status(400).json({ error: "Evento não encontrado" });
      return;
    }
  }
  const [album] = await db
    .insert(albunsTable)
    .values({
      title: parsed.data.title,
      eventoId: parsed.data.eventId ?? null,
      driveUrl: parsed.data.driveUrl ?? null,
      createdBy: req.user!.id,
    })
    .returning();
  res.status(201).json(await albumDtoById(album));
});

router.patch("/board/albums/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = UpdateAlbumParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAlbumBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(albunsTable)
    .where(eq(albunsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Álbum não encontrado" });
    return;
  }
  if (!isPrivileged(req.user) && existing.createdBy !== req.user!.id) {
    res.status(403).json({ error: "Sem permissão para editar este álbum" });
    return;
  }
  const update: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.eventId !== undefined) {
    if (parsed.data.eventId !== null) {
      const [event] = await db
        .select({ id: eventosTable.id })
        .from(eventosTable)
        .where(eq(eventosTable.id, parsed.data.eventId));
      if (!event) {
        res.status(400).json({ error: "Evento não encontrado" });
        return;
      }
    }
    update.eventoId = parsed.data.eventId;
  }
  if (parsed.data.driveUrl !== undefined) {
    if (
      parsed.data.driveUrl != null &&
      !isSafeHttpUrl(parsed.data.driveUrl)
    ) {
      res.status(400).json({ error: "URL do Drive inválida" });
      return;
    }
    update.driveUrl = parsed.data.driveUrl;
  }

  let album = existing;
  if (Object.keys(update).length > 0) {
    [album] = await db
      .update(albunsTable)
      .set(update)
      .where(eq(albunsTable.id, existing.id))
      .returning();
  }
  res.json(await albumDtoById(album));
});

router.delete("/board/albums/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = DeleteAlbumParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [album] = await db
    .select()
    .from(albunsTable)
    .where(eq(albunsTable.id, params.data.id));
  if (!album) {
    res.status(404).json({ error: "Álbum não encontrado" });
    return;
  }
  if (!isPrivileged(req.user) && album.createdBy !== req.user!.id) {
    res.status(403).json({ error: "Sem permissão para excluir este álbum" });
    return;
  }
  // Photos keep existing with albumId null (FK set null)
  await db.delete(albunsTable).where(eq(albunsTable.id, album.id));
  res.json({ ok: true });
});

export default router;
