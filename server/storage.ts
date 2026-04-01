import { db } from "./db";
import { 
  products, boxTypes, boxTypeProducts, palletTypes, palletTypeBoxes,
  cargoSpaces, loadPlans, placedUnits, orders, productFamilies,
  type Product, type BoxType, type BoxTypeProduct, type PalletType, type PalletTypeBox,
  type CargoSpace, type LoadPlan, type PlacedUnit, type Order, type ProductFamily,
  type InsertProduct, type InsertBoxType, type InsertBoxTypeProduct,
  type InsertPalletType, type InsertPalletTypeBox, type InsertCargoSpace,
  type InsertLoadPlan, type InsertPlacedUnit, type InsertOrder, type InsertProductFamily
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  getProductFamilies(): Promise<ProductFamily[]>;
  createProductFamily(f: InsertProductFamily): Promise<ProductFamily>;
  updateProductFamily(id: number, f: Partial<InsertProductFamily>): Promise<ProductFamily>;
  deleteProductFamily(id: number): Promise<void>;

  getProducts(): Promise<Product[]>;
  createProduct(p: InsertProduct): Promise<Product>;
  updateProduct(id: number, p: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;

  getBoxTypes(): Promise<BoxType[]>;
  createBoxType(b: InsertBoxType): Promise<BoxType>;
  updateBoxType(id: number, b: Partial<InsertBoxType>): Promise<BoxType>;
  deleteBoxType(id: number): Promise<void>;
  getBoxTypeProducts(boxTypeId: number): Promise<(BoxTypeProduct & { product: Product })[]>;
  addBoxTypeProduct(btp: InsertBoxTypeProduct): Promise<BoxTypeProduct>;
  removeBoxTypeProduct(boxTypeId: number, productId: number): Promise<void>;

  getPalletTypes(): Promise<PalletType[]>;
  createPalletType(p: InsertPalletType): Promise<PalletType>;
  updatePalletType(id: number, p: Partial<InsertPalletType>): Promise<PalletType>;
  deletePalletType(id: number): Promise<void>;
  getPalletTypeBoxes(palletTypeId: number): Promise<(PalletTypeBox & { boxType: BoxType })[]>;
  addPalletTypeBox(ptb: InsertPalletTypeBox): Promise<PalletTypeBox>;
  removePalletTypeBox(palletTypeId: number, boxTypeId: number): Promise<void>;

  getCargoSpaces(): Promise<CargoSpace[]>;
  createCargoSpace(s: InsertCargoSpace): Promise<CargoSpace>;
  updateCargoSpace(id: number, s: Partial<InsertCargoSpace>): Promise<CargoSpace>;
  deleteCargoSpace(id: number): Promise<void>;

  createLoadPlan(plan: InsertLoadPlan): Promise<LoadPlan>;
  bulkCreateProducts(items: InsertProduct[]): Promise<Product[]>;
  bulkCreateBoxTypes(items: InsertBoxType[]): Promise<BoxType[]>;
  bulkCreatePalletTypes(items: InsertPalletType[]): Promise<PalletType[]>;

  getOrders(userId: string): Promise<Order[]>;
  getOrder(id: number, userId: string): Promise<Order | undefined>;
  createOrder(o: InsertOrder): Promise<Order>;
  deleteOrder(id: number, userId: string): Promise<void>;
  getNextOrderNumber(userId: string): Promise<string>;
}

export class DatabaseStorage implements IStorage {
  async getProductFamilies(): Promise<ProductFamily[]> {
    return db.select().from(productFamilies).orderBy(productFamilies.sortOrder);
  }
  async createProductFamily(f: InsertProductFamily): Promise<ProductFamily> {
    const [r] = await db.insert(productFamilies).values(f).returning();
    return r;
  }
  async updateProductFamily(id: number, f: Partial<InsertProductFamily>): Promise<ProductFamily> {
    const [r] = await db.update(productFamilies).set(f).where(eq(productFamilies.id, id)).returning();
    return r;
  }
  async deleteProductFamily(id: number): Promise<void> {
    await db.delete(productFamilies).where(eq(productFamilies.id, id));
  }

  async getProducts(): Promise<Product[]> {
    return db.select().from(products).orderBy(products.name);
  }
  async createProduct(p: InsertProduct): Promise<Product> {
    const [r] = await db.insert(products).values(p).returning();
    return r;
  }
  async updateProduct(id: number, p: Partial<InsertProduct>): Promise<Product> {
    const [r] = await db.update(products).set(p).where(eq(products.id, id)).returning();
    return r;
  }
  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async getBoxTypes(): Promise<BoxType[]> {
    return db.select().from(boxTypes).orderBy(boxTypes.name);
  }
  async createBoxType(b: InsertBoxType): Promise<BoxType> {
    const [r] = await db.insert(boxTypes).values(b).returning();
    return r;
  }
  async updateBoxType(id: number, b: Partial<InsertBoxType>): Promise<BoxType> {
    const [r] = await db.update(boxTypes).set(b).where(eq(boxTypes.id, id)).returning();
    return r;
  }
  async deleteBoxType(id: number): Promise<void> {
    await db.delete(boxTypeProducts).where(eq(boxTypeProducts.boxTypeId, id));
    await db.delete(boxTypes).where(eq(boxTypes.id, id));
  }
  async getBoxTypeProducts(boxTypeId: number): Promise<(BoxTypeProduct & { product: Product })[]> {
    const rows = await db.select().from(boxTypeProducts)
      .innerJoin(products, eq(boxTypeProducts.productId, products.id))
      .where(eq(boxTypeProducts.boxTypeId, boxTypeId));
    return rows.map(r => ({ ...r.box_type_products, product: r.products }));
  }
  async addBoxTypeProduct(btp: InsertBoxTypeProduct): Promise<BoxTypeProduct> {
    const [r] = await db.insert(boxTypeProducts).values(btp).returning();
    return r;
  }
  async removeBoxTypeProduct(boxTypeId: number, productId: number): Promise<void> {
    await db.delete(boxTypeProducts)
      .where(and(eq(boxTypeProducts.boxTypeId, boxTypeId), eq(boxTypeProducts.productId, productId)));
  }

  async getPalletTypes(): Promise<PalletType[]> {
    return db.select().from(palletTypes).orderBy(palletTypes.name);
  }
  async createPalletType(p: InsertPalletType): Promise<PalletType> {
    const [r] = await db.insert(palletTypes).values(p).returning();
    return r;
  }
  async updatePalletType(id: number, p: Partial<InsertPalletType>): Promise<PalletType> {
    const [r] = await db.update(palletTypes).set(p).where(eq(palletTypes.id, id)).returning();
    return r;
  }
  async deletePalletType(id: number): Promise<void> {
    await db.delete(palletTypeBoxes).where(eq(palletTypeBoxes.palletTypeId, id));
    await db.delete(palletTypes).where(eq(palletTypes.id, id));
  }
  async getPalletTypeBoxes(palletTypeId: number): Promise<(PalletTypeBox & { boxType: BoxType })[]> {
    const rows = await db.select().from(palletTypeBoxes)
      .innerJoin(boxTypes, eq(palletTypeBoxes.boxTypeId, boxTypes.id))
      .where(eq(palletTypeBoxes.palletTypeId, palletTypeId));
    return rows.map(r => ({ ...r.pallet_type_boxes, boxType: r.box_types }));
  }
  async addPalletTypeBox(ptb: InsertPalletTypeBox): Promise<PalletTypeBox> {
    const [r] = await db.insert(palletTypeBoxes).values(ptb).returning();
    return r;
  }
  async removePalletTypeBox(palletTypeId: number, boxTypeId: number): Promise<void> {
    await db.delete(palletTypeBoxes)
      .where(and(eq(palletTypeBoxes.palletTypeId, palletTypeId), eq(palletTypeBoxes.boxTypeId, boxTypeId)));
  }

  async getCargoSpaces(): Promise<CargoSpace[]> {
    return db.select().from(cargoSpaces).orderBy(cargoSpaces.name);
  }
  async createCargoSpace(s: InsertCargoSpace): Promise<CargoSpace> {
    const [r] = await db.insert(cargoSpaces).values(s).returning();
    return r;
  }
  async updateCargoSpace(id: number, s: Partial<InsertCargoSpace>): Promise<CargoSpace> {
    const [r] = await db.update(cargoSpaces).set(s).where(eq(cargoSpaces.id, id)).returning();
    return r;
  }
  async deleteCargoSpace(id: number): Promise<void> {
    await db.delete(loadPlans).where(eq(loadPlans.cargoSpaceId, id));
    await db.delete(cargoSpaces).where(eq(cargoSpaces.id, id));
  }

  async createLoadPlan(plan: InsertLoadPlan): Promise<LoadPlan> {
    const [r] = await db.insert(loadPlans).values(plan).returning();
    return r;
  }

  async bulkCreateProducts(items: InsertProduct[]): Promise<Product[]> {
    if (items.length === 0) return [];
    const results = await db.insert(products).values(items).returning();
    return results;
  }

  async bulkCreateBoxTypes(items: InsertBoxType[]): Promise<BoxType[]> {
    if (items.length === 0) return [];
    const results = await db.insert(boxTypes).values(items).returning();
    return results;
  }

  async bulkCreatePalletTypes(items: InsertPalletType[]): Promise<PalletType[]> {
    if (items.length === 0) return [];
    const results = await db.insert(palletTypes).values(items).returning();
    return results;
  }

  async getOrders(userId: string): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: number, userId: string): Promise<Order | undefined> {
    const [r] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId)));
    return r;
  }

  async createOrder(o: InsertOrder): Promise<Order> {
    const [r] = await db.insert(orders).values(o).returning();
    return r;
  }

  async deleteOrder(id: number, userId: string): Promise<void> {
    await db.delete(orders).where(and(eq(orders.id, id), eq(orders.userId, userId)));
  }

  async getNextOrderNumber(userId: string): Promise<string> {
    const existing = await db.select().from(orders).where(eq(orders.userId, userId));
    const num = existing.length + 1;
    const year = new Date().getFullYear();
    return `CP-${year}-${String(num).padStart(4, "0")}`;
  }
}

export const storage = new DatabaseStorage();
