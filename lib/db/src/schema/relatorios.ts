import {
  pgTable,
  serial,
  text,
  integer,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./usuarios";

export const relatoriosTable = pgTable(
  "relatorios",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(), // 'monthly' | 'on_demand'
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    data: jsonb("data").notNull(),
    createdBy: integer("created_by").references(() => usuariosTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Only one automatic monthly report per period
    uniqueIndex("relatorios_monthly_period_unique")
      .on(table.type, table.periodStart, table.periodEnd)
      .where(sql`${table.type} = 'monthly'`),
  ],
);

export const insertRelatorioSchema = createInsertSchema(relatoriosTable).omit({
  id: true,
  createdAt: true,
});
export type InsertRelatorio = z.infer<typeof insertRelatorioSchema>;
export type Relatorio = typeof relatoriosTable.$inferSelect;
