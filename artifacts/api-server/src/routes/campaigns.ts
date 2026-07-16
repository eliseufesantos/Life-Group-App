import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  campanhasTable,
  itensArrecadadosTable,
  usuariosTable,
  type Campanha,
} from "@workspace/db";
import {
  CreateCampaignBody,
  UpdateCampaignParams,
  UpdateCampaignBody,
  DeleteCampaignParams,
  CloseCampaignParams,
  ListCampaignItemsParams,
  AddCampaignItemParams,
  AddCampaignItemBody,
  DeleteCampaignItemParams,
} from "@workspace/api-zod";
import {
  requireAuth,
  requirePrivileged,
  type AuthedRequest,
} from "../lib/auth";
import { announceCampaignActivated } from "../lib/automations";
import { isSafeHttpUrl } from "../lib/validation";

const router: IRouter = Router();

/** Tipos de campanha que recebem itens — uma campanha só de dinheiro não. */
const ITEM_CAMPAIGN_TYPES = ["items", "both"] as const;
const acceptsItems = (type: string): boolean =>
  (ITEM_CAMPAIGN_TYPES as readonly string[]).includes(type);

async function campaignDto(
  campaign: Campanha,
  itemCount?: number,
): Promise<Record<string, unknown>> {
  let createdByName: string | null = null;
  if (campaign.createdBy !== null) {
    const [user] = await db
      .select({ name: usuariosTable.name })
      .from(usuariosTable)
      .where(eq(usuariosTable.id, campaign.createdBy));
    createdByName = user?.name ?? null;
  }
  if (itemCount === undefined) {
    const [count] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(itensArrecadadosTable)
      .where(eq(itensArrecadadosTable.campaignId, campaign.id));
    itemCount = count?.count ?? 0;
  }
  return {
    id: campaign.id,
    title: campaign.title,
    description: campaign.description,
    type: campaign.type,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    externalLink: campaign.externalLink,
    status: campaign.status,
    createdByName,
    itemCount,
    createdAt: campaign.createdAt.toISOString(),
  };
}

router.get("/campaigns", requireAuth, async (_req, res): Promise<void> => {
  const campaigns = await db
    .select()
    .from(campanhasTable)
    .orderBy(desc(campanhasTable.createdAt));

  const ids = campaigns.map((c) => c.id);
  const counts = new Map<number, number>();
  if (ids.length > 0) {
    const rows = await db
      .select({
        campaignId: itensArrecadadosTable.campaignId,
        count: sql<number>`count(*)::int`,
      })
      .from(itensArrecadadosTable)
      .where(inArray(itensArrecadadosTable.campaignId, ids))
      .groupBy(itensArrecadadosTable.campaignId);
    for (const r of rows) counts.set(r.campaignId, r.count);
  }
  const creatorIds = Array.from(
    new Set(
      campaigns
        .map((c) => c.createdBy)
        .filter((id): id is number => id !== null),
    ),
  );
  const names = new Map<number, string>();
  if (creatorIds.length > 0) {
    const rows = await db
      .select({ id: usuariosTable.id, name: usuariosTable.name })
      .from(usuariosTable)
      .where(inArray(usuariosTable.id, creatorIds));
    for (const r of rows) names.set(r.id, r.name);
  }

  res.json(
    campaigns.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      type: c.type,
      startDate: c.startDate,
      endDate: c.endDate,
      externalLink: c.externalLink,
      status: c.status,
      createdByName: c.createdBy !== null ? (names.get(c.createdBy) ?? null) : null,
      itemCount: counts.get(c.id) ?? 0,
      createdAt: c.createdAt.toISOString(),
    })),
  );
});

router.post(
  "/campaigns",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const parsed = CreateCampaignBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (
      parsed.data.externalLink != null &&
      !isSafeHttpUrl(parsed.data.externalLink)
    ) {
      res.status(400).json({ error: "Link externo inválido" });
      return;
    }
    const [campaign] = await db
      .insert(campanhasTable)
      .values({
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        type: parsed.data.type,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate ?? null,
        externalLink: parsed.data.externalLink ?? null,
        createdBy: req.user!.id,
      })
      .returning();
    if (campaign.status === "active") {
      void announceCampaignActivated(campaign, req.user!.id);
    }
    res.status(201).json(await campaignDto(campaign, 0));
  },
);

router.patch(
  "/campaigns/:id",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = UpdateCampaignParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateCampaignBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(campanhasTable)
      .where(eq(campanhasTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Campanha não encontrada" });
      return;
    }

    const updates: Partial<typeof campanhasTable.$inferInsert> = {};
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.description !== undefined)
      updates.description = parsed.data.description;
    if (parsed.data.type !== undefined) updates.type = parsed.data.type;
    if (parsed.data.startDate !== undefined)
      updates.startDate = parsed.data.startDate;
    if (parsed.data.endDate !== undefined) updates.endDate = parsed.data.endDate;
    if (parsed.data.externalLink !== undefined) {
      if (
        parsed.data.externalLink != null &&
        !isSafeHttpUrl(parsed.data.externalLink)
      ) {
        res.status(400).json({ error: "Link externo inválido" });
        return;
      }
      updates.externalLink = parsed.data.externalLink;
    }
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;

    let campaign = before;
    if (Object.keys(updates).length > 0) {
      [campaign] = await db
        .update(campanhasTable)
        .set(updates)
        .where(eq(campanhasTable.id, params.data.id))
        .returning();
    }
    if (!campaign) {
      res.status(404).json({ error: "Campanha não encontrada" });
      return;
    }
    // Reactivation announces the campaign again (deduped by origin+refId)
    if (campaign.status === "active" && before.status !== "active") {
      void announceCampaignActivated(campaign, req.user!.id);
    }
    res.json(await campaignDto(campaign));
  },
);

router.post(
  "/campaigns/:id/close",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = CloseCampaignParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [campaign] = await db
      .update(campanhasTable)
      .set({ status: "closed" })
      .where(eq(campanhasTable.id, params.data.id))
      .returning();
    if (!campaign) {
      res.status(404).json({ error: "Campanha não encontrada" });
      return;
    }
    res.json(await campaignDto(campaign));
  },
);

router.delete(
  "/campaigns/:id",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = DeleteCampaignParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db.delete(campanhasTable).where(eq(campanhasTable.id, params.data.id));
    res.json({ ok: true });
  },
);

// --- Items (aggregated only, never donor identity) ---

router.get(
  "/campaigns/:id/items",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = ListCampaignItemsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const items = await db
      .select()
      .from(itensArrecadadosTable)
      .where(eq(itensArrecadadosTable.campaignId, params.data.id))
      .orderBy(asc(itensArrecadadosTable.createdAt));
    res.json(
      items.map((i) => ({
        id: i.id,
        campaignId: i.campaignId,
        itemName: i.itemName,
        quantity: i.quantity,
        unit: i.unit,
        createdAt: i.createdAt.toISOString(),
      })),
    );
  },
);

router.post(
  "/campaigns/:id/items",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = AddCampaignItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = AddCampaignItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [campaign] = await db
      .select()
      .from(campanhasTable)
      .where(eq(campanhasTable.id, params.data.id));
    if (!campaign) {
      res.status(404).json({ error: "Campanha não encontrada" });
      return;
    }
    if (campaign.status !== "active") {
      res
        .status(400)
        .json({ error: "Não é possível registrar itens em campanha encerrada" });
      return;
    }
    // Uma campanha só de dinheiro não recebe itens: a tela de Campanhas não
    // renderiza itens para `money`, então esses registros ficariam invisíveis
    // mas contando nos totais/relatórios (RF-6.4: o app não lida com valores).
    if (!acceptsItems(campaign.type)) {
      res
        .status(400)
        .json({ error: "Esta campanha não recebe itens" });
      return;
    }
    const [item] = await db
      .insert(itensArrecadadosTable)
      .values({
        campaignId: campaign.id,
        itemName: parsed.data.itemName,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit ?? null,
        registeredBy: req.user!.id,
      })
      .returning();
    res.status(201).json({
      id: item.id,
      campaignId: item.campaignId,
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      createdAt: item.createdAt.toISOString(),
    });
  },
);

router.delete(
  "/campaigns/:id/items/:itemId",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = DeleteCampaignItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [deleted] = await db
      .delete(itensArrecadadosTable)
      .where(
        and(
          eq(itensArrecadadosTable.id, params.data.itemId),
          eq(itensArrecadadosTable.campaignId, params.data.id),
        ),
      )
      .returning({ id: itensArrecadadosTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Item não encontrado nesta campanha" });
      return;
    }
    res.json({ ok: true });
  },
);

export default router;
