import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./usuarios";

export const sessoesTable = pgTable("sessoes", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usuariosTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessaoSchema = createInsertSchema(sessoesTable).omit({
  createdAt: true,
});
export type InsertSessao = z.infer<typeof insertSessaoSchema>;
export type Sessao = typeof sessoesTable.$inferSelect;
