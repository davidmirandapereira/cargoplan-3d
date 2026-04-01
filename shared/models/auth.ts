import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  licenseTier: varchar("license_tier").notNull().default("trial"),
  licenseExpiresAt: timestamp("license_expires_at"),
  maxProducts: varchar("max_products").notNull().default("10"),
  maxLoadPlans: varchar("max_load_plans").notNull().default("5"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const LICENSE_TIERS = {
  trial: {
    name: "trial",
    maxProducts: 10,
    maxBoxTypes: 3,
    maxPalletTypes: 2,
    maxLoadPlans: 5,
    csvExport: false,
    csvImport: false,
  },
  basic: {
    name: "basic",
    maxProducts: 100,
    maxBoxTypes: 20,
    maxPalletTypes: 10,
    maxLoadPlans: 50,
    csvExport: true,
    csvImport: false,
  },
  pro: {
    name: "pro",
    maxProducts: -1,
    maxBoxTypes: -1,
    maxPalletTypes: -1,
    maxLoadPlans: -1,
    csvExport: true,
    csvImport: true,
  },
} as const;

export type LicenseTier = keyof typeof LICENSE_TIERS;
