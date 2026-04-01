import { pgTable, text, serial, timestamp, integer, doublePrecision, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

// Product Families - user-defined families with name + color
export const productFamilies = pgTable("product_families", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Products - individual items (aquariums, terrariums, accessories)
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").default(""),
  width: doublePrecision("width").notNull(),
  height: doublePrecision("height").notNull(),
  length: doublePrecision("length").notNull(),
  weight: doublePrecision("weight").notNull(),
  fragile: boolean("fragile").notNull().default(false),
  canBearWeight: boolean("can_bear_weight").notNull().default(true),
  maxStackCount: integer("max_stack_count").notNull().default(6),
  allowedOrientations: text("allowed_orientations").array().notNull().default(["upright"]),
  color: text("color").notNull().default("#3b82f6"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Box Types - box templates that contain products
export const boxTypes = pgTable("box_types", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  width: doublePrecision("width").notNull(),
  height: doublePrecision("height").notNull(),
  length: doublePrecision("length").notNull(),
  emptyWeight: doublePrecision("empty_weight").notNull().default(0.5),
  fragile: boolean("fragile").notNull().default(false),
  canBearWeight: boolean("can_bear_weight").notNull().default(true),
  maxStackCount: integer("max_stack_count").notNull().default(6),
  allowedOrientations: text("allowed_orientations").array().notNull().default(["upright", "side"]),
  color: text("color").notNull().default("#3b82f6"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Box Type Products - which products go in which box type
export const boxTypeProducts = pgTable("box_type_products", {
  id: serial("id").primaryKey(),
  boxTypeId: integer("box_type_id").references(() => boxTypes.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull().default(1),
});

// Pallet Types - pallet templates that contain boxes
export const palletTypes = pgTable("pallet_types", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  width: doublePrecision("width").notNull(),
  height: doublePrecision("height").notNull(),
  length: doublePrecision("length").notNull(),
  tareWeight: doublePrecision("tare_weight").notNull().default(25),
  maxWeight: doublePrecision("max_weight").notNull().default(1000),
  fragile: boolean("fragile").notNull().default(false),
  canBearWeight: boolean("can_bear_weight").notNull().default(true),
  maxStackCount: integer("max_stack_count").notNull().default(6),
  allowedOrientations: text("allowed_orientations").array().notNull().default(["upright"]),
  color: text("color").notNull().default("#f59e0b"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Pallet Type Boxes - which boxes go on which pallet type
export const palletTypeBoxes = pgTable("pallet_type_boxes", {
  id: serial("id").primaryKey(),
  palletTypeId: integer("pallet_type_id").references(() => palletTypes.id).notNull(),
  boxTypeId: integer("box_type_id").references(() => boxTypes.id).notNull(),
  quantity: integer("quantity").notNull().default(1),
});

// Cargo Spaces - containers, trucks (keep from before)
export const cargoSpaces = pgTable("cargo_spaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("container"),
  width: doublePrecision("width").notNull(),
  height: doublePrecision("height").notNull(),
  length: doublePrecision("length").notNull(),
  maxWeight: doublePrecision("max_weight").notNull(),
  isPreset: boolean("is_preset").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Load Plans - calculation results
export const loadPlans = pgTable("load_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cargoSpaceId: integer("cargo_space_id").references(() => cargoSpaces.id).notNull(),
  efficiency: doublePrecision("efficiency"),
  totalWeight: doublePrecision("total_weight"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Placed Units - positioned items in a plan (pallets or loose boxes)
export const placedUnits = pgTable("placed_units", {
  id: serial("id").primaryKey(),
  loadPlanId: integer("load_plan_id").references(() => loadPlans.id).notNull(),
  unitType: text("unit_type").notNull(), // "pallet" or "box"
  unitId: integer("unit_id").notNull(),
  x: doublePrecision("x").notNull(),
  y: doublePrecision("y").notNull(),
  z: doublePrecision("z").notNull(),
  orientation: text("orientation").notNull().default("upright"),
});

// Orders - saved load plans with complete dossier
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull(),
  name: text("name").notNull(),
  userId: text("user_id").notNull(),
  cargoSpaceName: text("cargo_space_name").notNull(),
  cargoSpaceId: integer("cargo_space_id"),
  status: text("status").notNull().default("completed"),
  efficiency: doublePrecision("efficiency"),
  totalWeight: doublePrecision("total_weight"),
  totalVolume: doublePrecision("total_volume"),
  itemCount: integer("item_count"),
  dossier: jsonb("dossier").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert Schemas
export const insertProductFamilySchema = createInsertSchema(productFamilies).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export const insertBoxTypeSchema = createInsertSchema(boxTypes).omit({ id: true, createdAt: true });
export const insertBoxTypeProductSchema = createInsertSchema(boxTypeProducts).omit({ id: true });
export const insertPalletTypeSchema = createInsertSchema(palletTypes).omit({ id: true, createdAt: true });
export const insertPalletTypeBoxSchema = createInsertSchema(palletTypeBoxes).omit({ id: true });
export const insertCargoSpaceSchema = createInsertSchema(cargoSpaces).omit({ id: true, createdAt: true });
export const insertLoadPlanSchema = createInsertSchema(loadPlans).omit({ id: true, createdAt: true });
export const insertPlacedUnitSchema = createInsertSchema(placedUnits).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });

// Select Types
export type ProductFamily = typeof productFamilies.$inferSelect;
export type Product = typeof products.$inferSelect;
export type BoxType = typeof boxTypes.$inferSelect;
export type BoxTypeProduct = typeof boxTypeProducts.$inferSelect;
export type PalletType = typeof palletTypes.$inferSelect;
export type PalletTypeBox = typeof palletTypeBoxes.$inferSelect;
export type CargoSpace = typeof cargoSpaces.$inferSelect;
export type LoadPlan = typeof loadPlans.$inferSelect;
export type PlacedUnit = typeof placedUnits.$inferSelect;
export type Order = typeof orders.$inferSelect;

// Insert Types
export type InsertProductFamily = z.infer<typeof insertProductFamilySchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertBoxType = z.infer<typeof insertBoxTypeSchema>;
export type InsertBoxTypeProduct = z.infer<typeof insertBoxTypeProductSchema>;
export type InsertPalletType = z.infer<typeof insertPalletTypeSchema>;
export type InsertPalletTypeBox = z.infer<typeof insertPalletTypeBoxSchema>;
export type InsertCargoSpace = z.infer<typeof insertCargoSpaceSchema>;
export type InsertLoadPlan = z.infer<typeof insertLoadPlanSchema>;
export type InsertPlacedUnit = z.infer<typeof insertPlacedUnitSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
