import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./usuarios";

export const fotosTable = pgTable("fotos", {
  id: serial("id").primaryKey(),
  objectPath: text("object_path").notNull(),
  caption: text("caption"),
  uploadedBy: integer("uploaded_by").references(() => usuariosTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertFotoSchema = createInsertSchema(fotosTable).omit({
  id: true,
  createdAt: true,
});
export type InsertFoto = z.infer<typeof insertFotoSchema>;
export type Foto = typeof fotosTable.$inferSelect;
