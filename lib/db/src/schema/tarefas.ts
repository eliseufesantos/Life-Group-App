import {
  pgTable,
  serial,
  text,
  integer,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./usuarios";

export const tarefasTable = pgTable("tarefas", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  weekStart: date("week_start", { mode: "string" }).notNull(),
  assignedTo: integer("assigned_to").references(() => usuariosTable.id, {
    onDelete: "cascade",
  }),
  status: text("status").notNull().default("proposed"),
  proposedBy: integer("proposed_by").references(() => usuariosTable.id, {
    onDelete: "set null",
  }),
  doneAt: timestamp("done_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertTarefaSchema = createInsertSchema(tarefasTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTarefa = z.infer<typeof insertTarefaSchema>;
export type Tarefa = typeof tarefasTable.$inferSelect;
