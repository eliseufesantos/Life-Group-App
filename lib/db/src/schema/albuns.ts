import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventosTable } from "./eventos";
import { usuariosTable } from "./usuarios";

export const albunsTable = pgTable("albuns", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  eventoId: integer("evento_id").references(() => eventosTable.id, {
    onDelete: "set null",
  }),
  // Link to a shared Google Drive folder with the album photos
  driveUrl: text("drive_url"),
  createdBy: integer("created_by").references(() => usuariosTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAlbumSchema = createInsertSchema(albunsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAlbum = z.infer<typeof insertAlbumSchema>;
export type Album = typeof albunsTable.$inferSelect;
