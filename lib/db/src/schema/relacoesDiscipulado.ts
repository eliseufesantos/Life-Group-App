import { pgTable, serial, text, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./usuarios";

// Each side of the relationship is EITHER an internal member (FK) OR a
// free-text name of a person from another Life Group. At least one side must
// be internal (validated at the API layer, not in the database).
export const relacoesDiscipuladoTable = pgTable("relacoes_discipulado", {
  id: serial("id").primaryKey(),
  disciplerId: integer("discipler_id").references(() => usuariosTable.id, {
    onDelete: "cascade",
  }),
  discipleId: integer("disciple_id").references(() => usuariosTable.id, {
    onDelete: "cascade",
  }),
  externalDisciplerName: text("external_discipler_name"),
  externalDiscipleName: text("external_disciple_name"),
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
