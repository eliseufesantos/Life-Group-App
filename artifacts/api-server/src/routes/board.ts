import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  usuariosTable,
  avisosTable,
  enquetesTable,
  opcoesEnqueteTable,
  votosEnqueteTable,
  tarefasTable,
  fotosTable,
  type Enquete,
  type Tarefa,
} from "@workspace/db";
import {
  CreateAnnouncementBody,
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
} from "@workspace/api-zod";
import { requireAuth, requirePrivileged, isPrivileged, type AuthedRequest } from "../lib/auth";
import { ObjectStorageService } from "../lib/objectStorage";

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

router.get("/board/announcements", requireAuth, async (_req, res): Promise<void> => {
  const avisos = await db
    .select()
    .from(avisosTable)
    .orderBy(desc(avisosTable.createdAt));
  const names = await nameMap(avisos.map((a) => a.createdBy));
  res.json(
    avisos.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      authorName: a.createdBy !== null ? (names.get(a.createdBy) ?? null) : null,
      createdAt: a.createdAt.toISOString(),
    })),
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
    res.status(201).json({
      id: aviso.id,
      title: aviso.title,
      body: aviso.body,
      authorName: req.user!.name,
      createdAt: aviso.createdAt.toISOString(),
    });
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

interface PollDto {
  id: number;
  question: string;
  closed: boolean;
  options: Array<{ id: number; text: string; votes: number }>;
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

  return polls.map((poll) => {
    const pollOptions = options.filter((o) => o.enqueteId === poll.id);
    const pollVotes = votes.filter((v) => v.enqueteId === poll.id);
    const myVote = pollVotes.find((v) => v.userId === userId)?.opcaoId ?? null;
    return {
      id: poll.id,
      question: poll.question,
      closed: poll.closed,
      options: pollOptions.map((o) => ({
        id: o.id,
        text: o.text,
        votes: pollVotes.filter((v) => v.opcaoId === o.id).length,
      })),
      myVote,
      totalVotes: pollVotes.length,
      authorName:
        poll.createdBy !== null ? (names.get(poll.createdBy) ?? null) : null,
      createdAt: poll.createdAt.toISOString(),
    };
  });
}

router.get("/board/polls", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
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
    const [poll] = await db
      .insert(enquetesTable)
      .values({ question: parsed.data.question, createdBy: req.user!.id })
      .returning();
    await db
      .insert(opcoesEnqueteTable)
      .values(parsed.data.options.map((text) => ({ enqueteId: poll.id, text })));
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
  if (poll.closed) {
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
    const status = req.user!.role === "leader" ? "approved" : "proposed";
    const [task] = await db
      .insert(tarefasTable)
      .values({
        title: parsed.data.title,
        weekStart: parsed.data.weekStart,
        assignedTo: parsed.data.assignedTo ?? null,
        status,
        proposedBy: req.user!.id,
      })
      .returning();
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

router.get("/board/photos", requireAuth, async (_req, res): Promise<void> => {
  const fotos = await db
    .select()
    .from(fotosTable)
    .orderBy(desc(fotosTable.createdAt));
  const names = await nameMap(fotos.map((f) => f.uploadedBy));
  res.json(
    fotos.map((f) => ({
      id: f.id,
      objectPath: f.objectPath,
      url: `/api/storage${f.objectPath}`,
      caption: f.caption,
      uploaderName:
        f.uploadedBy !== null ? (names.get(f.uploadedBy) ?? null) : null,
      uploadedBy: f.uploadedBy,
      createdAt: f.createdAt.toISOString(),
    })),
  );
});

router.post("/board/photos", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const parsed = CreatePhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
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
  const [foto] = await db
    .insert(fotosTable)
    .values({
      objectPath: parsed.data.objectPath,
      caption: parsed.data.caption ?? null,
      uploadedBy: req.user!.id,
    })
    .returning();
  res.status(201).json({
    id: foto.id,
    objectPath: foto.objectPath,
    url: `/api/storage${foto.objectPath}`,
    caption: foto.caption,
    uploaderName: req.user!.name,
    uploadedBy: foto.uploadedBy,
    createdAt: foto.createdAt.toISOString(),
  });
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

export default router;
