import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  date,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./usuarios";
import { albunsTable } from "./albuns";

// Meeting record ("registro do encontro"): attendance, activities, donations.
export const registrosEncontroTable = pgTable("registros_encontro", {
  id: serial("id").primaryKey(),
  eventDate: date("event_date", { mode: "string" }).notNull(),
  // Sequential numbering, assigned as max+1 on creation
  seq: integer("seq").notNull().unique(),
  status: text("status").notNull().default("pending"), // 'pending' | 'published'
  createdBy: integer("created_by").references(() => usuariosTable.id, {
    onDelete: "set null",
  }),
  approvedBy: integer("approved_by").references(() => usuariosTable.id, {
    onDelete: "set null",
  }),
  // "Foto do dia" album
  albumId: integer("album_id").references(() => albunsTable.id, {
    onDelete: "set null",
  }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Attendance covers members AND guests (both live in usuarios)
export const presencasRegistroTable = pgTable(
  "presencas_registro",
  {
    id: serial("id").primaryKey(),
    registroId: integer("registro_id")
      .notNull()
      .references(() => registrosEncontroTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usuariosTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("presencas_registro_unique").on(table.registroId, table.userId),
  ],
);

// Activity catalog (7 builtin defaults + custom entries)
export const atividadesCatalogoTable = pgTable("atividades_catalogo", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  hasDuration: boolean("has_duration").notNull().default(true),
  builtin: boolean("builtin").notNull().default(false),
  active: boolean("active").notNull().default(true),
});

export const atividadesRegistroTable = pgTable("atividades_registro", {
  id: serial("id").primaryKey(),
  registroId: integer("registro_id")
    .notNull()
    .references(() => registrosEncontroTable.id, { onDelete: "cascade" }),
  atividadeId: integer("atividade_id").references(
    () => atividadesCatalogoTable.id,
    { onDelete: "set null" },
  ),
  // Snapshot of the activity name at registration time
  name: text("name").notNull(),
  responsavelId: integer("responsavel_id").references(() => usuariosTable.id, {
    onDelete: "set null",
  }),
  durationMin: integer("duration_min"),
});

export const insertRegistroEncontroSchema = createInsertSchema(
  registrosEncontroTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRegistroEncontro = z.infer<
  typeof insertRegistroEncontroSchema
>;
export type RegistroEncontro = typeof registrosEncontroTable.$inferSelect;

export const insertPresencaRegistroSchema = createInsertSchema(
  presencasRegistroTable,
).omit({ id: true });
export type InsertPresencaRegistro = z.infer<
  typeof insertPresencaRegistroSchema
>;
export type PresencaRegistro = typeof presencasRegistroTable.$inferSelect;

export const insertAtividadeCatalogoSchema = createInsertSchema(
  atividadesCatalogoTable,
).omit({ id: true });
export type InsertAtividadeCatalogo = z.infer<
  typeof insertAtividadeCatalogoSchema
>;
export type AtividadeCatalogo = typeof atividadesCatalogoTable.$inferSelect;

export const insertAtividadeRegistroSchema = createInsertSchema(
  atividadesRegistroTable,
).omit({ id: true });
export type InsertAtividadeRegistro = z.infer<
  typeof insertAtividadeRegistroSchema
>;
export type AtividadeRegistro = typeof atividadesRegistroTable.$inferSelect;
