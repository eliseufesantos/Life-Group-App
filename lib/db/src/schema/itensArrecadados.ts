import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campanhasTable } from "./campanhas";
import { usuariosTable } from "./usuarios";
import { registrosEncontroTable } from "./registrosEncontro";

// Aggregated donated items per campaign. Donor identity is NEVER stored.
export const itensArrecadadosTable = pgTable("itens_arrecadados", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id")
    .notNull()
    .references(() => campanhasTable.id, { onDelete: "cascade" }),
  // Meeting record that originated the entry, when applicable
  registroId: integer("registro_id").references(
    () => registrosEncontroTable.id,
    { onDelete: "set null" },
  ),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull(),
  unit: text("unit"),
  registeredBy: integer("registered_by").references(() => usuariosTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertItemArrecadadoSchema = createInsertSchema(
  itensArrecadadosTable,
).omit({ id: true, createdAt: true });
export type InsertItemArrecadado = z.infer<typeof insertItemArrecadadoSchema>;
export type ItemArrecadado = typeof itensArrecadadosTable.$inferSelect;
