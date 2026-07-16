import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./usuarios";

export const avisosTable = pgTable("avisos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  // 'manual' | 'birthday' | 'campaign' | 'registro_pending'
  origin: text("origin").notNull().default("manual"),
  // Id of the entity that originated the automatic aviso (for dedupe)
  refId: integer("ref_id"),
  createdBy: integer("created_by").references(() => usuariosTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAvisoSchema = createInsertSchema(avisosTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAviso = z.infer<typeof insertAvisoSchema>;
export type Aviso = typeof avisosTable.$inferSelect;
