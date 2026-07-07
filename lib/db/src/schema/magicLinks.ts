import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./usuarios";

export const magicLinksTable = pgTable("magic_links", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: integer("user_id")
    .notNull()
    .references(() => usuariosTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMagicLinkSchema = createInsertSchema(magicLinksTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMagicLink = z.infer<typeof insertMagicLinkSchema>;
export type MagicLink = typeof magicLinksTable.$inferSelect;
