import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./usuarios";

export const enquetesTable = pgTable("enquetes", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  closed: boolean("closed").notNull().default(false),
  createdBy: integer("created_by").references(() => usuariosTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const opcoesEnqueteTable = pgTable("opcoes_enquete", {
  id: serial("id").primaryKey(),
  enqueteId: integer("enquete_id")
    .notNull()
    .references(() => enquetesTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
});

export const votosEnqueteTable = pgTable(
  "votos_enquete",
  {
    id: serial("id").primaryKey(),
    enqueteId: integer("enquete_id")
      .notNull()
      .references(() => enquetesTable.id, { onDelete: "cascade" }),
    opcaoId: integer("opcao_id")
      .notNull()
      .references(() => opcoesEnqueteTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usuariosTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("votos_enquete_user_unique").on(table.enqueteId, table.userId),
  ],
);

export const insertEnqueteSchema = createInsertSchema(enquetesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertEnquete = z.infer<typeof insertEnqueteSchema>;
export type Enquete = typeof enquetesTable.$inferSelect;
export type OpcaoEnquete = typeof opcoesEnqueteTable.$inferSelect;
export type VotoEnquete = typeof votosEnqueteTable.$inferSelect;
