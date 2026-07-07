import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Single-row cell configuration (name, photo)
export const configuracaoCelulaTable = pgTable("configuracao_celula", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Célula"),
  photoUrl: text("photo_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertConfiguracaoCelulaSchema = createInsertSchema(
  configuracaoCelulaTable,
).omit({ id: true, updatedAt: true });
export type InsertConfiguracaoCelula = z.infer<
  typeof insertConfiguracaoCelulaSchema
>;
export type ConfiguracaoCelula = typeof configuracaoCelulaTable.$inferSelect;
