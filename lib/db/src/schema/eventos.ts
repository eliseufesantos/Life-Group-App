import {
  pgTable,
  serial,
  text,
  integer,
  date,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./usuarios";

export const eventosTable = pgTable(
  "eventos",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull().default("free"),
    title: text("title"),
    category: text("category"),
    eventDate: date("event_date", { mode: "string" }).notNull(),
    time: text("time"),
    location: text("location"),
    description: text("description"),
    canceled: boolean("canceled").notNull().default(false),
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
  },
  (table) => [
    uniqueIndex("eventos_meeting_override_unique")
      .on(table.eventDate)
      .where(sql`${table.type} = 'meeting_override'`),
  ],
);

export const insertEventoSchema = createInsertSchema(eventosTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEvento = z.infer<typeof insertEventoSchema>;
export type Evento = typeof eventosTable.$inferSelect;
