import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./usuarios";

export const subscricoesPushTable = pgTable("subscricoes_push", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usuariosTable.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSubscricaoPushSchema = createInsertSchema(
  subscricoesPushTable,
).omit({ id: true, createdAt: true });
export type InsertSubscricaoPush = z.infer<typeof insertSubscricaoPushSchema>;
export type SubscricaoPush = typeof subscricoesPushTable.$inferSelect;
