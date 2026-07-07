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

export const campanhasTable = pgTable("campanhas", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'money' | 'items' | 'both'
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }),
  externalLink: text("external_link"),
  status: text("status").notNull().default("active"), // 'active' | 'closed'
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

export const insertCampanhaSchema = createInsertSchema(campanhasTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCampanha = z.infer<typeof insertCampanhaSchema>;
export type Campanha = typeof campanhasTable.$inferSelect;
