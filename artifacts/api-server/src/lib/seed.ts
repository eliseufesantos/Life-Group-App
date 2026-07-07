import { eq } from "drizzle-orm";
import { db, usuariosTable } from "@workspace/db";
import { logger } from "./logger";

export async function seedLeader(): Promise<void> {
  const [existingLeader] = await db
    .select()
    .from(usuariosTable)
    .where(eq(usuariosTable.role, "leader"));

  if (existingLeader) {
    return;
  }

  const name = process.env.SEED_LEADER_NAME;
  const email = process.env.SEED_LEADER_EMAIL?.trim().toLowerCase();

  if (!name || !email) {
    logger.warn(
      "No leader found and SEED_LEADER_NAME/SEED_LEADER_EMAIL not set. Skipping leader seed.",
    );
    return;
  }

  const [byEmail] = await db
    .select()
    .from(usuariosTable)
    .where(eq(usuariosTable.email, email));

  if (byEmail) {
    await db
      .update(usuariosTable)
      .set({ role: "leader", status: "member", active: true })
      .where(eq(usuariosTable.id, byEmail.id));
    logger.info({ email }, "Promoted existing user to leader via seed");
    return;
  }

  await db.insert(usuariosTable).values({
    name,
    email,
    role: "leader",
    status: "member",
    joinedAt: new Date(),
  });
  logger.info({ email }, "Seeded initial leader");
}
