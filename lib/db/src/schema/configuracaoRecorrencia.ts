import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const configuracaoRecorrenciaTable = pgTable("configuracao_recorrencia", {
  id: serial("id").primaryKey(),
  weekday: integer("weekday").notNull(),
  time: text("time").notNull(),
  location: text("location"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertConfiguracaoRecorrenciaSchema = createInsertSchema(
  configuracaoRecorrenciaTable,
).omit({ id: true, updatedAt: true });
export type InsertConfiguracaoRecorrencia = z.infer<
  typeof insertConfiguracaoRecorrenciaSchema
>;
export type ConfiguracaoRecorrencia =
  typeof configuracaoRecorrenciaTable.$inferSelect;
