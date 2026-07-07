import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usuariosTable = pgTable(
  "usuarios",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    status: text("status").notNull().default("member"),
    role: text("role"),
    categories: text("categories").array().notNull().default([]),
    formationTrack: text("formation_track"),
    invitedBy: text("invited_by"),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("usuarios_email_unique")
      .on(table.email)
      .where(sql`${table.email} IS NOT NULL`),
  ],
);

export const insertUsuarioSchema = createInsertSchema(usuariosTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUsuario = z.infer<typeof insertUsuarioSchema>;
export type Usuario = typeof usuariosTable.$inferSelect;
