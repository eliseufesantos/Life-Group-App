import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

// Single-row VAPID keypair generated on first use (internal, not user-editable)
export const chavesVapidTable = pgTable("chaves_vapid", {
  id: serial("id").primaryKey(),
  // Always 1 + unique: enforces a single keypair row at the DB level
  singleton: integer("singleton").notNull().default(1).unique(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ChaveVapid = typeof chavesVapidTable.$inferSelect;
