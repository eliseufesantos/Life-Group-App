import { pgTable, serial, text, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./usuarios";

export const relacoesDiscipuladoTable = pgTable("relacoes_discipulado", {
  id: serial("id").primaryKey(),
  disciplerId: integer("discipler_id")
    .notNull()
    .references(() => usuariosTable.id, { onDelete: "cascade" }),
  discipleId: integer("disciple_id")
    .notNull()
    .references(() => usuariosTable.id, { onDelete: "cascade" }),
  startDate: date("start_date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRelacaoDiscipuladoSchema = createInsertSchema(
  relacoesDiscipuladoTable,
).omit({ id: true, createdAt: true });
export type InsertRelacaoDiscipulado = z.infer<
  typeof insertRelacaoDiscipuladoSchema
>;
export type RelacaoDiscipulado = typeof relacoesDiscipuladoTable.$inferSelect;
