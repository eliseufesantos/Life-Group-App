import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./usuarios";

export const convitesTable = pgTable("convites", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  createdBy: integer("created_by").references(() => usuariosTable.id, {
    onDelete: "set null",
  }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConviteSchema = createInsertSchema(convitesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertConvite = z.infer<typeof insertConviteSchema>;
export type Convite = typeof convitesTable.$inferSelect;
