import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import type { BoxType, PalletType } from "@shared/schema";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";

interface PlacedUnitResult {
  unitType: "pallet" | "box";
  unitId: number;
  name: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  length: number;
  weight: number;
  color: string;
  orientation: string;
  fragile: boolean;
  canBearWeight: boolean;
  maxStackCount: number;
  loadOrder: number;
}

function getOrientationDims(
  w: number, h: number, l: number,
  orientation: string
): { w: number; h: number; l: number } {
  switch (orientation) {
    case "upright": return { w, h, l };
    case "side": return { w: l, h, l: w };
    case "front": return { w, h: l, l: h };
    case "back": return { w: h, h: w, l };
    default: return { w, h, l };
  }
}

function calculateLoadPlan(
  space: { width: number; height: number; length: number; maxWeight: number },
  units: Array<{
    unitType: "pallet" | "box";
    unitId: number;
    name: string;
    width: number;
    height: number;
    length: number;
    weight: number;
    color: string;
    allowedOrientations: string[];
    fragile: boolean;
    canBearWeight: boolean;
    maxStackCount: number;
    quantity: number;
  }>
) {
  const placed: PlacedUnitResult[] = [];
  let totalWeight = 0;
  const spaceVolume = space.width * space.height * space.length;

  const expanded: typeof units = [];
  for (const u of units) {
    for (let i = 0; i < u.quantity; i++) {
      expanded.push({ ...u, quantity: 1 });
    }
  }

  const hasPallets = expanded.some(u => u.unitType === "pallet");
  const hasBoxes = expanded.some(u => u.unitType === "box");
  const isPalletMode = hasPallets && !hasBoxes;

  if (isPalletMode) {
    expanded.sort((a, b) => {
      const volA = a.width * a.height * a.length;
      const volB = b.width * b.height * b.length;
      return volB - volA;
    });
  } else {
    expanded.sort((a, b) => {
      const scoreA = (a.width * a.height * a.length) + a.weight * 0.01;
      const scoreB = (b.width * b.height * b.length) + b.weight * 0.01;
      return scoreB - scoreA;
    });
  }

  const occupiedBoxes: Array<{
    x: number; y: number; z: number; w: number; h: number; l: number;
    canBearWeight: boolean; fragile: boolean; maxStackCount: number; stackLevel: number;
    unitType: string; unitId: number;
  }> = [];

  function overlaps(ax: number, ay: number, az: number, aw: number, ah: number, al: number,
                     bx: number, by: number, bz: number, bw: number, bh: number, bl: number): boolean {
    const eps = 0.001;
    return ax < bx + bw - eps && ax + aw > bx + eps &&
           ay < by + bh - eps && ay + ah > by + eps &&
           az < bz + bl - eps && az + al > bz + eps;
  }

  function getStackLevel(py: number, px: number, pz: number, pw: number, pl: number): number {
    if (py < 0.001) return 0;
    let maxLevel = 0;
    for (const box of occupiedBoxes) {
      const topOfBox = box.y + box.h;
      if (Math.abs(py - topOfBox) < 0.02) {
        if (px < box.x + box.w - 0.001 && px + pw > box.x + 0.001 && pz < box.z + box.l - 0.001 && pz + pl > box.z + 0.001) {
          maxLevel = Math.max(maxLevel, box.stackLevel + 1);
        }
      }
    }
    return maxLevel;
  }

  function canPlaceAt(px: number, py: number, pz: number, pw: number, ph: number, pl: number,
                       unitFragile: boolean, unitMaxStack: number, unitType?: string): boolean {
    if (isPalletMode && py > 0.001) return false;
    const margin = 0.01;
    if (px + pw > space.width - margin + 0.001 || py + ph > space.height + 0.01 || pz + pl > space.length - margin + 0.001) return false;
    if (px < margin - 0.001 || pz < margin - 0.001) return false;

    for (const box of occupiedBoxes) {
      if (overlaps(px, py, pz, pw, ph, pl, box.x, box.y, box.z, box.w, box.h, box.l)) return false;
    }

    if (py > 0.001) {
      let hasSupport = false;
      let supportArea = 0;
      const itemArea = pw * pl;
      for (const box of occupiedBoxes) {
        const topOfBox = box.y + box.h;
        if (Math.abs(py - topOfBox) < 0.02) {
          const overlapX = Math.max(0, Math.min(px + pw, box.x + box.w) - Math.max(px, box.x));
          const overlapZ = Math.max(0, Math.min(pz + pl, box.z + box.l) - Math.max(pz, box.z));
          if (overlapX > 0.001 && overlapZ > 0.001) {
            hasSupport = true;
            supportArea += overlapX * overlapZ;
            if (!box.canBearWeight) return false;
            if (box.fragile) return false;
            if (box.stackLevel + 1 >= box.maxStackCount) return false;
          }
        }
      }
      if (!hasSupport) return false;
      if (supportArea / itemArea < 0.5) return false;
    }

    const stackLevel = getStackLevel(py, px, pz, pw, pl);
    if (stackLevel >= unitMaxStack) return false;

    return true;
  }

  const margin = 0.01;
  const candidatePositions: Array<{ x: number; y: number; z: number }> = [{ x: margin, y: 0, z: margin }];
  const r = (v: number) => Math.round(v * 1000) / 1000;

  function addCandidate(x: number, y: number, z: number) {
    x = r(x); y = r(y); z = r(z);
    if (x >= margin - 0.001 && x < space.width - 0.005 && y >= -0.001 && y < space.height - 0.005 && z >= margin - 0.001 && z < space.length - 0.005) {
      if (!candidatePositions.some(c => Math.abs(c.x - x) < 0.005 && Math.abs(c.y - y) < 0.005 && Math.abs(c.z - z) < 0.005)) {
        candidatePositions.push({ x, y, z });
      }
    }
  }

  function addCandidates(px: number, py: number, pz: number, pw: number, ph: number, pl: number) {
    addCandidate(px + pw, py, pz);
    addCandidate(px, py, pz + pl);
    addCandidate(px + pw, py, pz + pl);
    addCandidate(px, py + ph, pz);
    addCandidate(px + pw, py + ph, pz);
    addCandidate(px, py + ph, pz + pl);
    addCandidate(px + pw, py + ph, pz + pl);
    addCandidate(margin, py, pz);
    addCandidate(px, py, margin);
    addCandidate(margin, py + ph, pz);
    addCandidate(px, py + ph, margin);
  }

  function placeUnit(unit: typeof expanded[0]): boolean {
    if (totalWeight + unit.weight > space.maxWeight) return false;

    const preferredOrder = ["upright", "side", "front", "back"];
    const rawOrientations = unit.allowedOrientations.length > 0 ? unit.allowedOrientations : ["upright", "side"];
    const orientations = rawOrientations.slice().sort((a, b) => preferredOrder.indexOf(a) - preferredOrder.indexOf(b));

    const zSlice = Math.max(0.5, space.length / 6);
    const sortedCandidates = candidatePositions
      .slice()
      .sort((a, b) => {
        const zA = Math.floor(a.z / zSlice);
        const zB = Math.floor(b.z / zSlice);
        if (zA !== zB) return zB - zA;
        if (Math.abs(a.y - b.y) > 0.005) return a.y - b.y;
        return a.x - b.x;
      });

    for (const orient of orientations) {
      const dims = getOrientationDims(unit.width, unit.height, unit.length, orient);

      for (const pos of sortedCandidates) {
        if (canPlaceAt(pos.x, pos.y, pos.z, dims.w, dims.h, dims.l, unit.fragile, unit.maxStackCount, unit.unitType)) {
          const stackLevel = getStackLevel(pos.y, pos.x, pos.z, dims.w, dims.l);
          placed.push({
            unitType: unit.unitType,
            unitId: unit.unitId,
            name: unit.name,
            x: pos.x, y: pos.y, z: pos.z,
            width: dims.w, height: dims.h, length: dims.l,
            weight: unit.weight,
            color: unit.color,
            orientation: orient,
            fragile: unit.fragile,
            canBearWeight: unit.canBearWeight,
            maxStackCount: unit.maxStackCount,
            loadOrder: placed.length + 1,
          });
          occupiedBoxes.push({
            x: pos.x, y: pos.y, z: pos.z, w: dims.w, h: dims.h, l: dims.l,
            canBearWeight: unit.canBearWeight, fragile: unit.fragile,
            maxStackCount: unit.maxStackCount, stackLevel,
            unitType: unit.unitType, unitId: unit.unitId,
          });
          totalWeight += unit.weight;
          addCandidates(pos.x, pos.y, pos.z, dims.w, dims.h, dims.l);
          return true;
        }
      }
    }
    return false;
  }

  const sorted = expanded.slice().sort((a, b) => {
    const volA = a.width * a.height * a.length;
    const volB = b.width * b.height * b.length;
    return volB - volA || b.weight - a.weight;
  });

  const failed: typeof expanded = [];
  for (const unit of sorted) {
    if (!placeUnit(unit)) {
      failed.push(unit);
    }
  }

  if (failed.length > 0) {
    const stillFailed: typeof expanded = [];
    for (const unit of failed) {
      if (!placeUnit(unit)) {
        stillFailed.push(unit);
      }
    }
    if (stillFailed.length > 0) {
      for (const unit of stillFailed) {
        placeUnit(unit);
      }
    }
  }

  const usedVolume = placed.reduce((acc, p) => acc + p.width * p.height * p.length, 0);
  const efficiency = spaceVolume > 0 ? Math.round((usedVolume / spaceVolume) * 1000) / 10 : 0;
  const totalRequested = expanded.length;
  const unplacedCount = totalRequested - placed.length;

  return { placed, efficiency, totalWeight, usedVolume, spaceVolume, totalRequested, unplacedCount };
}

async function seedDatabase() {
  const existingFamilies = await storage.getProductFamilies();
  if (existingFamilies.length === 0) {
    const defaults = [
      { name: "Vidro / Aquários", color: "#3b82f6", sortOrder: 0 },
      { name: "Madeira / Natural", color: "#d97706", sortOrder: 1 },
      { name: "Metal / Industrial", color: "#6b7280", sortOrder: 2 },
      { name: "Plástico / Acessórios", color: "#10b981", sortOrder: 3 },
      { name: "Electrónica", color: "#8b5cf6", sortOrder: 4 },
      { name: "Frágil / Especial", color: "#ef4444", sortOrder: 5 },
      { name: "Têxtil / Embalagem", color: "#ec4899", sortOrder: 6 },
      { name: "Químico / Líquidos", color: "#06b6d4", sortOrder: 7 },
    ];
    for (const f of defaults) {
      await storage.createProductFamily(f);
    }
  }

  const existingSpaces = await storage.getCargoSpaces();
  if (existingSpaces.length === 0) {
    await storage.createCargoSpace({ name: "Contentor 20'", width: 2.35, height: 2.39, length: 5.9, maxWeight: 21770 });
    await storage.createCargoSpace({ name: "Contentor 40'", width: 2.35, height: 2.39, length: 12.03, maxWeight: 26780 });
    await storage.createCargoSpace({ name: "Camião Standard", width: 2.45, height: 2.7, length: 13.6, maxWeight: 24000 });
  }

  const existingProducts = await storage.getProducts();
  if (existingProducts.length === 0) {
    await storage.createProduct({ code: "AQ-060", name: "Aquário 60cm", width: 0.61, height: 0.36, length: 0.31, weight: 12, fragile: true, canBearWeight: false, maxStackCount: 1, allowedOrientations: ["upright"] });
    await storage.createProduct({ code: "AQ-080", name: "Aquário 80cm", width: 0.81, height: 0.46, length: 0.36, weight: 18, fragile: true, canBearWeight: false, maxStackCount: 1, allowedOrientations: ["upright"] });
    await storage.createProduct({ code: "AQ-120", name: "Aquário 120cm", width: 1.21, height: 0.51, length: 0.41, weight: 35, fragile: true, canBearWeight: false, maxStackCount: 1, allowedOrientations: ["upright"] });
    await storage.createProduct({ code: "TR-060", name: "Terrário 60cm", width: 0.61, height: 0.46, length: 0.46, weight: 15, fragile: true, canBearWeight: false, maxStackCount: 1, allowedOrientations: ["upright"] });
    await storage.createProduct({ code: "TR-090", name: "Terrário 90cm", width: 0.91, height: 0.46, length: 0.46, weight: 22, fragile: true, canBearWeight: false, maxStackCount: 1, allowedOrientations: ["upright"] });
    await storage.createProduct({ code: "AC-FLT", name: "Filtro Externo", width: 0.2, height: 0.4, length: 0.2, weight: 3, fragile: false, canBearWeight: true, maxStackCount: 4, allowedOrientations: ["upright", "side"] });
    await storage.createProduct({ code: "AC-LMP", name: "Calha Iluminação LED", width: 0.65, height: 0.08, length: 0.12, weight: 1.5, fragile: true, canBearWeight: false, maxStackCount: 3, allowedOrientations: ["upright", "side"] });
  }

  const existingBoxes = await storage.getBoxTypes();
  if (existingBoxes.length === 0) {
    await storage.createBoxType({ code: "CX-AQ60", name: "Caixa Aquário 60", width: 0.65, height: 0.42, length: 0.36, emptyWeight: 0.8, fragile: true, canBearWeight: false, maxStackCount: 1, allowedOrientations: ["upright"], color: "#3b82f6" });
    await storage.createBoxType({ code: "CX-AQ80", name: "Caixa Aquário 80", width: 0.85, height: 0.52, length: 0.42, emptyWeight: 1.0, fragile: true, canBearWeight: false, maxStackCount: 1, allowedOrientations: ["upright"], color: "#06b6d4" });
    await storage.createBoxType({ code: "CX-AQ120", name: "Caixa Aquário 120", width: 1.25, height: 0.57, length: 0.47, emptyWeight: 1.5, fragile: true, canBearWeight: false, maxStackCount: 1, allowedOrientations: ["upright"], color: "#8b5cf6" });
    await storage.createBoxType({ code: "CX-TR60", name: "Caixa Terrário 60", width: 0.65, height: 0.52, length: 0.52, emptyWeight: 0.9, fragile: true, canBearWeight: false, maxStackCount: 1, allowedOrientations: ["upright"], color: "#10b981" });
    await storage.createBoxType({ code: "CX-ACC", name: "Caixa Acessórios", width: 0.40, height: 0.30, length: 0.30, emptyWeight: 0.3, fragile: false, canBearWeight: true, maxStackCount: 5, allowedOrientations: ["upright", "side", "front"], color: "#f59e0b" });
  }

  const existingPallets = await storage.getPalletTypes();
  if (existingPallets.length === 0) {
    await storage.createPalletType({ code: "EUR-STD", name: "Europalete Standard", width: 0.8, height: 1.6, length: 1.2, tareWeight: 25, maxWeight: 800, fragile: true, canBearWeight: false, maxStackCount: 1, allowedOrientations: ["upright"], color: "#d97706" });
    await storage.createPalletType({ code: "EUR-IND", name: "Europalete Industrial", width: 1.0, height: 1.8, length: 1.2, tareWeight: 30, maxWeight: 1200, fragile: false, canBearWeight: true, maxStackCount: 2, allowedOrientations: ["upright"], color: "#92400e" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await setupAuth(app);
  registerAuthRoutes(app);

  await seedDatabase();

  // Product Families
  app.get("/api/product-families", async (_req, res) => {
    const data = await storage.getProductFamilies();
    res.json(data);
  });

  app.post("/api/product-families", async (req, res) => {
    try {
      const { name, color, sortOrder } = req.body;
      const f = await storage.createProductFamily({ name, color, sortOrder: sortOrder || 0 });
      res.status(201).json(f);
    } catch (err) {
      res.status(500).json({ message: "Erro ao criar família" });
    }
  });

  app.put("/api/product-families/:id", async (req, res) => {
    try {
      const { name, color, sortOrder } = req.body;
      const f = await storage.updateProductFamily(Number(req.params.id), { name, color, sortOrder });
      res.json(f);
    } catch (err) {
      res.status(500).json({ message: "Erro ao atualizar família" });
    }
  });

  app.delete("/api/product-families/:id", async (req, res) => {
    await storage.deleteProductFamily(Number(req.params.id));
    res.status(204).send();
  });

  // Products
  app.get(api.products.list.path, async (_req, res) => {
    const data = await storage.getProducts();
    res.json(data);
  });

  app.post(api.products.create.path, async (req, res) => {
    try {
      const input = api.products.create.input.parse(req.body);
      const p = await storage.createProduct(input);
      res.status(201).json(p);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Erro ao criar produto" });
    }
  });

  app.put(api.products.update.path, async (req, res) => {
    try {
      const input = api.products.update.input.parse(req.body);
      const p = await storage.updateProduct(Number(req.params.id), input);
      res.json(p);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Erro ao atualizar produto" });
    }
  });

  app.delete(api.products.delete.path, async (req, res) => {
    await storage.deleteProduct(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/products/export/csv", async (_req, res) => {
    const data = await storage.getProducts();
    const headers = ["code", "name", "description", "width_cm", "height_cm", "length_cm", "weight_kg", "fragile", "canBearWeight", "maxStackCount", "allowedOrientations"];
    const rows = data.map(p => [
      p.code, 
      `"${(p.name || "").replace(/"/g, '""')}"`, 
      `"${(p.description || "").replace(/"/g, '""')}"`,
      Math.round(p.width * 100), 
      Math.round(p.height * 100), 
      Math.round(p.length * 100),
      p.weight, 
      p.fragile ? "true" : "false", 
      p.canBearWeight ? "true" : "false",
      p.maxStackCount, 
      `"${p.allowedOrientations.join("|")}"`,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=products.csv");
    res.send("\uFEFF" + csv);
  });

  app.post("/api/products/import/csv", async (req, res) => {
    try {
      const { rows } = req.body as { rows: any[] };
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No data provided" });
      }

      const validItems: any[] = [];
      const errors: { row: number; message: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const code = String(r.code || "").trim();
        const name = String(r.name || "").trim();
        const widthCm = parseFloat(r.width_cm);
        const heightCm = parseFloat(r.height_cm);
        const lengthCm = parseFloat(r.length_cm);
        const weightKg = parseFloat(r.weight_kg);

        if (!code) { errors.push({ row: i + 1, message: `Missing code` }); continue; }
        if (!name) { errors.push({ row: i + 1, message: `Missing name` }); continue; }
        if (isNaN(widthCm) || widthCm <= 0) { errors.push({ row: i + 1, message: `Invalid width_cm` }); continue; }
        if (isNaN(heightCm) || heightCm <= 0) { errors.push({ row: i + 1, message: `Invalid height_cm` }); continue; }
        if (isNaN(lengthCm) || lengthCm <= 0) { errors.push({ row: i + 1, message: `Invalid length_cm` }); continue; }
        if (isNaN(weightKg) || weightKg <= 0) { errors.push({ row: i + 1, message: `Invalid weight_kg` }); continue; }

        const fragile = r.fragile === "true" || r.fragile === true || r.fragile === "1" || r.fragile === "sim" || r.fragile === "yes";
        const canBearWeight = r.canBearWeight === "true" || r.canBearWeight === true || r.canBearWeight === "1" || r.canBearWeight === "sim" || r.canBearWeight === "yes";
        const maxStackCount = parseInt(r.maxStackCount) || 1;
        const orientationsRaw = String(r.allowedOrientations || "upright");
        const allowedOrientations = orientationsRaw.split("|").map((s: string) => s.trim()).filter((s: string) => ["upright", "side", "front", "back"].includes(s));

        validItems.push({
          code,
          name,
          description: String(r.description || ""),
          width: widthCm / 100,
          height: heightCm / 100,
          length: lengthCm / 100,
          weight: weightKg,
          fragile,
          canBearWeight,
          maxStackCount,
          allowedOrientations: allowedOrientations.length > 0 ? allowedOrientations : ["upright"],
        });
      }

      let imported = 0;
      if (validItems.length > 0) {
        const created = await storage.bulkCreateProducts(validItems);
        imported = created.length;
      }

      res.json({ imported, errors, total: rows.length });
    } catch (err) {
      res.status(500).json({ message: "Erro ao importar produtos" });
    }
  });

  app.get("/api/box-types/export/csv", async (_req, res) => {
    const data = await storage.getBoxTypes();
    const headers = ["code", "name", "width_cm", "height_cm", "length_cm", "emptyWeight_kg", "fragile", "canBearWeight", "maxStackCount", "allowedOrientations", "color"];
    const rows = data.map(b => [
      b.code, `"${(b.name || "").replace(/"/g, '""')}"`,
      Math.round(b.width * 100), Math.round(b.height * 100), Math.round(b.length * 100),
      b.emptyWeight, b.fragile ? "true" : "false", b.canBearWeight ? "true" : "false",
      b.maxStackCount, b.allowedOrientations.join("|"), b.color,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=box-types.csv");
    res.send("\uFEFF" + csv);
  });

  app.post("/api/box-types/import/csv", async (req, res) => {
    try {
      const { rows } = req.body as { rows: any[] };
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No data provided" });
      }

      const validItems: any[] = [];
      const errors: { row: number; message: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const code = String(r.code || "").trim();
        const name = String(r.name || "").trim();
        const widthCm = parseFloat(r.width_cm);
        const heightCm = parseFloat(r.height_cm);
        const lengthCm = parseFloat(r.length_cm);
        const emptyWeight = parseFloat(r.emptyWeight_kg);

        if (!code || !name) { errors.push({ row: i + 1, message: `Missing code or name` }); continue; }
        if (isNaN(widthCm) || widthCm <= 0 || isNaN(heightCm) || heightCm <= 0 || isNaN(lengthCm) || lengthCm <= 0) {
          errors.push({ row: i + 1, message: `Invalid dimensions` }); continue;
        }

        validItems.push({
          code, name,
          width: widthCm / 100, height: heightCm / 100, length: lengthCm / 100,
          emptyWeight: isNaN(emptyWeight) ? 0.5 : emptyWeight,
          fragile: r.fragile === "true" || r.fragile === true,
          canBearWeight: r.canBearWeight === "true" || r.canBearWeight === true,
          maxStackCount: parseInt(r.maxStackCount) || 1,
          allowedOrientations: String(r.allowedOrientations || "upright").split("|").filter((s: string) => ["upright", "side", "front", "back"].includes(s)),
          color: String(r.color || "#3b82f6"),
        });
      }

      let imported = 0;
      if (validItems.length > 0) {
        const created = await storage.bulkCreateBoxTypes(validItems);
        imported = created.length;
      }

      res.json({ imported, errors, total: rows.length });
    } catch (err) {
      res.status(500).json({ message: "Erro ao importar tipos de caixa" });
    }
  });

  app.get("/api/pallet-types/export/csv", async (_req, res) => {
    const data = await storage.getPalletTypes();
    const headers = ["code", "name", "width_cm", "height_cm", "length_cm", "tareWeight_kg", "maxWeight_kg", "fragile", "canBearWeight", "maxStackCount", "allowedOrientations", "color"];
    const rows = data.map(p => [
      p.code, `"${(p.name || "").replace(/"/g, '""')}"`,
      Math.round(p.width * 100), Math.round(p.height * 100), Math.round(p.length * 100),
      p.tareWeight, p.maxWeight, p.fragile ? "true" : "false", p.canBearWeight ? "true" : "false",
      p.maxStackCount, p.allowedOrientations.join("|"), p.color,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=pallet-types.csv");
    res.send("\uFEFF" + csv);
  });

  app.post("/api/pallet-types/import/csv", async (req, res) => {
    try {
      const { rows } = req.body as { rows: any[] };
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No data provided" });
      }

      const validItems: any[] = [];
      const errors: { row: number; message: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const code = String(r.code || "").trim();
        const name = String(r.name || "").trim();
        const widthCm = parseFloat(r.width_cm);
        const heightCm = parseFloat(r.height_cm);
        const lengthCm = parseFloat(r.length_cm);

        if (!code || !name) { errors.push({ row: i + 1, message: `Missing code or name` }); continue; }
        if (isNaN(widthCm) || widthCm <= 0 || isNaN(heightCm) || heightCm <= 0 || isNaN(lengthCm) || lengthCm <= 0) {
          errors.push({ row: i + 1, message: `Invalid dimensions` }); continue;
        }

        validItems.push({
          code, name,
          width: widthCm / 100, height: heightCm / 100, length: lengthCm / 100,
          tareWeight: parseFloat(r.tareWeight_kg) || 25,
          maxWeight: parseFloat(r.maxWeight_kg) || 1000,
          fragile: r.fragile === "true" || r.fragile === true,
          canBearWeight: r.canBearWeight === "true" || r.canBearWeight === true,
          maxStackCount: parseInt(r.maxStackCount) || 1,
          allowedOrientations: String(r.allowedOrientations || "upright").split("|").filter((s: string) => ["upright", "side", "front", "back"].includes(s)),
          color: String(r.color || "#f59e0b"),
        });
      }

      let imported = 0;
      if (validItems.length > 0) {
        const created = await storage.bulkCreatePalletTypes(validItems);
        imported = created.length;
      }

      res.json({ imported, errors, total: rows.length });
    } catch (err) {
      res.status(500).json({ message: "Erro ao importar tipos de palete" });
    }
  });

  // Box Types
  app.get(api.boxTypes.list.path, async (_req, res) => {
    const data = await storage.getBoxTypes();
    res.json(data);
  });

  app.post(api.boxTypes.create.path, async (req, res) => {
    try {
      const input = api.boxTypes.create.input.parse(req.body);
      const b = await storage.createBoxType(input);
      res.status(201).json(b);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Erro ao criar tipo de caixa" });
    }
  });

  app.put(api.boxTypes.update.path, async (req, res) => {
    try {
      const input = api.boxTypes.update.input.parse(req.body);
      const b = await storage.updateBoxType(Number(req.params.id), input);
      res.json(b);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Erro ao atualizar tipo de caixa" });
    }
  });

  app.delete(api.boxTypes.delete.path, async (req, res) => {
    await storage.deleteBoxType(Number(req.params.id));
    res.status(204).send();
  });

  app.get(api.boxTypes.getProducts.path, async (req, res) => {
    const data = await storage.getBoxTypeProducts(Number(req.params.id));
    res.json(data);
  });

  app.post(api.boxTypes.addProduct.path, async (req, res) => {
    try {
      const input = api.boxTypes.addProduct.input.parse(req.body);
      const r = await storage.addBoxTypeProduct({ boxTypeId: Number(req.params.id), ...input });
      res.status(201).json(r);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Erro ao adicionar produto à caixa" });
    }
  });

  app.delete(api.boxTypes.removeProduct.path, async (req, res) => {
    await storage.removeBoxTypeProduct(Number(req.params.boxTypeId), Number(req.params.productId));
    res.status(204).send();
  });

  // Pallet Types
  app.get(api.palletTypes.list.path, async (_req, res) => {
    const data = await storage.getPalletTypes();
    res.json(data);
  });

  app.post(api.palletTypes.create.path, async (req, res) => {
    try {
      const input = api.palletTypes.create.input.parse(req.body);
      const p = await storage.createPalletType(input);
      res.status(201).json(p);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Erro ao criar tipo de palete" });
    }
  });

  app.put(api.palletTypes.update.path, async (req, res) => {
    try {
      const input = api.palletTypes.update.input.parse(req.body);
      const p = await storage.updatePalletType(Number(req.params.id), input);
      res.json(p);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Erro ao atualizar tipo de palete" });
    }
  });

  app.delete(api.palletTypes.delete.path, async (req, res) => {
    await storage.deletePalletType(Number(req.params.id));
    res.status(204).send();
  });

  app.get(api.palletTypes.getBoxes.path, async (req, res) => {
    const data = await storage.getPalletTypeBoxes(Number(req.params.id));
    res.json(data);
  });

  app.post(api.palletTypes.addBox.path, async (req, res) => {
    try {
      const input = api.palletTypes.addBox.input.parse(req.body);
      const r = await storage.addPalletTypeBox({ palletTypeId: Number(req.params.id), ...input });
      res.status(201).json(r);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Erro ao adicionar caixa à palete" });
    }
  });

  app.delete(api.palletTypes.removeBox.path, async (req, res) => {
    await storage.removePalletTypeBox(Number(req.params.palletTypeId), Number(req.params.boxTypeId));
    res.status(204).send();
  });

  // Cargo Spaces
  app.get(api.cargo.spaces.list.path, async (_req, res) => {
    const data = await storage.getCargoSpaces();
    res.json(data);
  });

  app.post(api.cargo.spaces.create.path, async (req, res) => {
    try {
      const input = api.cargo.spaces.create.input.parse(req.body);
      const s = await storage.createCargoSpace(input);
      res.status(201).json(s);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Erro ao criar espaço" });
    }
  });

  app.put(api.cargo.spaces.update.path, async (req, res) => {
    try {
      const input = api.cargo.spaces.update.input.parse(req.body);
      const s = await storage.updateCargoSpace(Number(req.params.id), input);
      res.json(s);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Erro ao atualizar espaço" });
    }
  });

  app.delete(api.cargo.spaces.delete.path, async (req, res) => {
    await storage.deleteCargoSpace(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/cargo/recommend", async (req, res) => {
    try {
      const input = z.object({
        products: z.array(z.object({ productId: z.number(), quantity: z.number().min(1) })),
      }).parse(req.body);

      const allProducts = await storage.getProducts();
      const allBoxTypes = await storage.getBoxTypes();
      const allPalletTypes = await storage.getPalletTypes();

      const orderProducts = input.products.map((op) => {
        const prod = allProducts.find((p) => p.id === op.productId);
        return prod ? { ...prod, orderQty: op.quantity } : null;
      }).filter(Boolean) as (typeof allProducts[0] & { orderQty: number })[];

      if (orderProducts.length === 0) {
        return res.json({ boxes: [], pallets: [] });
      }

      interface BoxInstance {
        boxNumber: string;
        boxTypeId: number;
        boxTypeCode: string;
        boxTypeName: string;
        color: string;
        width: number;
        height: number;
        length: number;
        emptyWeight: number;
        fragile: boolean;
        canBearWeight: boolean;
        maxStackCount: number;
        allowedOrientations: string[];
        contents: Array<{ productId: number; code: string; name: string; quantity: number; weight: number }>;
        totalWeight: number;
        fillPercent: number;
      }

      interface PalletInstance {
        palletNumber: string;
        palletTypeId: number;
        palletTypeCode: string;
        palletTypeName: string;
        color: string;
        width: number;
        length: number;
        actualHeight: number;
        maxHeight: number;
        tareWeight: number;
        maxWeight: number;
        fragile: boolean;
        canBearWeight: boolean;
        maxStackCount: number;
        allowedOrientations: string[];
        boxes: Array<{ boxNumber: string; boxTypeCode: string; width: number; height: number; length: number; weight: number }>;
        totalWeight: number;
        fillPercent: number;
      }

      const productFitsInBox = (prod: typeof allProducts[0], bt: typeof allBoxTypes[0]): boolean => {
        const pw = prod.width, ph = prod.height, pl = prod.length;
        const bw = bt.width, bh = bt.height, bl = bt.length;
        return (pw <= bw && ph <= bh && pl <= bl) ||
               (pw <= bw && pl <= bh && ph <= bl) ||
               (pl <= bw && ph <= bh && pw <= bl) ||
               (pl <= bw && pw <= bh && ph <= bl) ||
               (ph <= bw && pw <= bh && pl <= bl) ||
               (ph <= bw && pl <= bh && pw <= bl);
      }

      const howManyFit = (prod: typeof allProducts[0], bt: typeof allBoxTypes[0]): number => {
        const bw = bt.width, bh = bt.height, bl = bt.length;
        const pw = prod.width, ph = prod.height, pl = prod.length;
        let best = 0;
        const rotations = [
          [pw, ph, pl], [pw, pl, ph], [ph, pw, pl], [ph, pl, pw], [pl, pw, ph], [pl, ph, pw]
        ];
        for (const [rw, rh, rl] of rotations) {
          const nx = Math.floor(bw / rw);
          const ny = Math.floor(bh / rh);
          const nz = Math.floor(bl / rl);
          best = Math.max(best, nx * ny * nz);
        }
        return best;
      }

      const remaining = new Map<number, number>();
      for (const op of orderProducts) {
        remaining.set(op.id, op.orderQty);
      }

      const boxInstances: BoxInstance[] = [];
      let boxCounter = 0;

      const sortedBoxTypes = [...allBoxTypes].sort((a, b) => {
        const volA = a.width * a.height * a.length;
        const volB = b.width * b.height * b.length;
        return volA - volB;
      });

      for (const prod of orderProducts) {
        let rem = remaining.get(prod.id) ?? 0;
        if (rem <= 0) continue;

        let bestBox: typeof allBoxTypes[0] | null = null;
        let bestCap = 0;
        for (const bt of sortedBoxTypes) {
          if (!productFitsInBox(prod, bt)) continue;
          const cap = howManyFit(prod, bt);
          if (cap > 0) {
            bestBox = bt;
            bestCap = cap;
            break;
          }
        }

        if (!bestBox || bestCap <= 0) continue;

        while (rem > 0) {
          const qty = Math.min(rem, bestCap);
          boxCounter++;
          const bt = bestBox;
          boxInstances.push({
            boxNumber: `CX-${String(boxCounter).padStart(3, "0")}`,
            boxTypeId: bt.id,
            boxTypeCode: bt.code,
            boxTypeName: bt.name,
            color: bt.color,
            width: bt.width,
            height: bt.height,
            length: bt.length,
            emptyWeight: bt.emptyWeight,
            fragile: bt.fragile,
            canBearWeight: bt.canBearWeight,
            maxStackCount: bt.maxStackCount,
            allowedOrientations: bt.allowedOrientations,
            contents: [{
              productId: prod.id,
              code: prod.code,
              name: prod.name,
              quantity: qty,
              weight: Math.round(prod.weight * qty * 100) / 100,
            }],
            totalWeight: Math.round((bt.emptyWeight + prod.weight * qty) * 100) / 100,
            fillPercent: Math.min(100, Math.round((prod.width * prod.height * prod.length * qty) / (bt.width * bt.height * bt.length) * 100)),
          });
          rem -= qty;
        }
        remaining.set(prod.id, 0);
      }

      const mergedBoxInstances: BoxInstance[] = [];
      let mergeCounter = 0;
      const unmatchedBoxes = [...boxInstances];

      for (let i = 0; i < unmatchedBoxes.length; i++) {
        const boxA = unmatchedBoxes[i];
        if (!boxA) continue;
        if (boxA.fillPercent >= 70) {
          mergeCounter++;
          boxA.boxNumber = `CX-${String(mergeCounter).padStart(3, "0")}`;
          mergedBoxInstances.push(boxA);
          unmatchedBoxes[i] = null as any;
          continue;
        }

        const bt = allBoxTypes.find(b => b.id === boxA.boxTypeId)!;
        const boxVol = bt.width * bt.height * bt.length;
        let usedVol = boxA.contents.reduce((s, c) => {
          const p = orderProducts.find(op => op.id === c.productId);
          return s + (p ? p.width * p.height * p.length * c.quantity : 0);
        }, 0);

        for (let j = i + 1; j < unmatchedBoxes.length; j++) {
          const boxB = unmatchedBoxes[j];
          if (!boxB || boxB.boxTypeId !== boxA.boxTypeId) continue;

          const bVol = boxB.contents.reduce((s, c) => {
            const p = orderProducts.find(op => op.id === c.productId);
            return s + (p ? p.width * p.height * p.length * c.quantity : 0);
          }, 0);

          if (usedVol + bVol <= boxVol * 1.0) {
            for (const c of boxB.contents) {
              const existing = boxA.contents.find(e => e.productId === c.productId);
              if (existing) {
                existing.quantity += c.quantity;
                existing.weight = Math.round((existing.weight + c.weight) * 100) / 100;
              } else {
                boxA.contents.push({ ...c });
              }
            }
            boxA.totalWeight = Math.round((boxA.totalWeight + boxB.totalWeight - bt.emptyWeight) * 100) / 100;
            usedVol += bVol;
            boxA.fillPercent = Math.min(100, Math.round((usedVol / boxVol) * 100));
            unmatchedBoxes[j] = null as any;
          }
        }

        mergeCounter++;
        boxA.boxNumber = `CX-${String(mergeCounter).padStart(3, "0")}`;
        mergedBoxInstances.push(boxA);
        unmatchedBoxes[i] = null as any;
      }

      const finalBoxInstances = mergedBoxInstances;

      const palletInstances: PalletInstance[] = [];
      let palletCounter = 0;
      const unassignedBoxes = [...finalBoxInstances];

      const sortedPalletTypes = [...allPalletTypes].sort((a, b) => {
        const areaA = a.width * a.length;
        const areaB = b.width * b.length;
        return areaB - areaA;
      });

      for (const pt of sortedPalletTypes) {
        let keepStacking = true;
        while (keepStacking && unassignedBoxes.length > 0) {
          const palletBoxes: PalletInstance["boxes"] = [];
          let currentHeight = 0.15;
          let palletWeight = pt.tareWeight;
          const palletArea = pt.width * pt.length;

          const layerBoxes: number[] = [];
          let i = 0;
          while (i < unassignedBoxes.length) {
            const box = unassignedBoxes[i];
            const boxFitsFloor = (box.width <= pt.width && box.length <= pt.length) ||
                                  (box.length <= pt.width && box.width <= pt.length);
            const newHeight = currentHeight + box.height;

            if (boxFitsFloor && newHeight <= pt.height && palletWeight + box.totalWeight <= pt.maxWeight) {
              palletBoxes.push({
                boxNumber: box.boxNumber,
                boxTypeCode: box.boxTypeCode,
                width: box.width,
                height: box.height,
                length: box.length,
                weight: box.totalWeight,
              });
              currentHeight = newHeight;
              palletWeight += box.totalWeight;
              layerBoxes.push(i);
            }
            i++;
          }

          if (palletBoxes.length === 0) {
            keepStacking = false;
            break;
          }

          for (let j = layerBoxes.length - 1; j >= 0; j--) {
            unassignedBoxes.splice(layerBoxes[j], 1);
          }

          palletCounter++;
          const palletVol = pt.width * pt.length * pt.height;
          const usedVol = palletBoxes.reduce((s, b) => s + b.width * b.height * b.length, 0);
          palletInstances.push({
            palletNumber: `PAL-${String(palletCounter).padStart(3, "0")}`,
            palletTypeId: pt.id,
            palletTypeCode: pt.code,
            palletTypeName: pt.name,
            color: pt.color,
            width: pt.width,
            length: pt.length,
            actualHeight: Math.round(currentHeight * 100) / 100,
            maxHeight: pt.height,
            tareWeight: pt.tareWeight,
            maxWeight: pt.maxWeight,
            fragile: pt.fragile,
            canBearWeight: pt.canBearWeight,
            maxStackCount: pt.maxStackCount,
            allowedOrientations: pt.allowedOrientations,
            boxes: palletBoxes,
            totalWeight: Math.round(palletWeight * 100) / 100,
            fillPercent: Math.round((usedVol / palletVol) * 100),
          });
        }
      }

      res.json({
        boxes: finalBoxInstances,
        pallets: palletInstances,
        unassignedBoxes: unassignedBoxes.map((b) => b.boxNumber),
        summary: {
          totalBoxes: finalBoxInstances.length,
          totalPallets: palletInstances.length,
          totalWeight: Math.round((finalBoxInstances.reduce((s, b) => s + b.totalWeight, 0) + palletInstances.reduce((s, p) => s + p.tareWeight, 0)) * 100) / 100,
          productsNotPacked: Array.from(remaining.entries()).filter(([, q]) => q > 0).map(([id, qty]) => {
            const p = allProducts.find((pr) => pr.id === id);
            return { productId: id, code: p?.code ?? "", name: p?.name ?? "", remaining: qty };
          }),
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Erro ao calcular recomendações" });
    }
  });

  app.post("/api/cargo/seed-presets", async (req, res) => {
    const presets = [
      { name: "Contentor 20'", category: "container" as const, width: 2.35, height: 2.39, length: 5.90, maxWeight: 28000, isPreset: true },
      { name: "Contentor 40'", category: "container" as const, width: 2.35, height: 2.39, length: 12.03, maxWeight: 28500, isPreset: true },
      { name: "Contentor 40' HC", category: "container" as const, width: 2.35, height: 2.70, length: 12.03, maxWeight: 28500, isPreset: true },
      { name: "Camião 7.5t", category: "truck" as const, width: 2.45, height: 2.30, length: 6.20, maxWeight: 4500, isPreset: true },
      { name: "Camião 12t", category: "truck" as const, width: 2.45, height: 2.50, length: 7.70, maxWeight: 7500, isPreset: true },
      { name: "Camião TIR", category: "truck" as const, width: 2.45, height: 2.70, length: 13.60, maxWeight: 24000, isPreset: true },
    ];
    
    const existing = await storage.getCargoSpaces();
    const existingNames = new Set(existing.map(s => s.name));
    let created = 0;
    
    for (const preset of presets) {
      if (!existingNames.has(preset.name)) {
        await storage.createCargoSpace(preset);
        created++;
      }
    }
    
    res.json({ created });
  });

  // Calculate Load Plan
  app.post(api.cargo.calculate.path, async (req, res) => {
    try {
      const input = api.cargo.calculate.input.parse(req.body);
      const spaces = await storage.getCargoSpaces();

      if (!input.spaceId && !input.category) {
        return res.status(400).json({ message: "spaceId ou category é obrigatório" });
      }

      let space: typeof spaces[0] | undefined;
      if (input.spaceId) {
        space = spaces.find(s => s.id === input.spaceId);
      }
      if (!space && !input.category) {
        return res.status(404).json({ message: "Espaço não encontrado" });
      }

      const allBoxTypes = await storage.getBoxTypes();
      const allPalletTypes = await storage.getPalletTypes();

      const loadUnits: Array<{
        unitType: "pallet" | "box";
        unitId: number;
        name: string;
        width: number; height: number; length: number;
        weight: number; color: string;
        allowedOrientations: string[];
        fragile: boolean; canBearWeight: boolean; maxStackCount: number;
        quantity: number;
      }> = [];

      const allProducts = await storage.getProducts();

      for (const item of input.items) {
        if (item.type === "pallet") {
          const pt = allPalletTypes.find(p => p.id === item.id);
          if (!pt) continue;
          const palletBoxes = await storage.getPalletTypeBoxes(pt.id);
          let contentsWeight = 0;
          for (const pb of palletBoxes) {
            const bt = allBoxTypes.find(b => b.id === pb.boxTypeId);
            if (!bt) continue;
            const boxProducts = await storage.getBoxTypeProducts(bt.id);
            let boxContentsWeight = 0;
            for (const bp of boxProducts) {
              const prod = allProducts.find(p => p.id === bp.productId);
              if (prod) boxContentsWeight += prod.weight * bp.quantity;
            }
            contentsWeight += (bt.emptyWeight + boxContentsWeight) * pb.quantity;
          }
          const totalPalletWeight = pt.tareWeight + contentsWeight;
          loadUnits.push({
            unitType: "pallet", unitId: pt.id, name: pt.name,
            width: pt.width, height: pt.height, length: pt.length,
            weight: Math.min(totalPalletWeight, pt.maxWeight), color: pt.color,
            allowedOrientations: pt.allowedOrientations,
            fragile: pt.fragile, canBearWeight: pt.canBearWeight,
            maxStackCount: pt.maxStackCount, quantity: item.quantity,
          });
        } else if (item.type === "product") {
          const prod = allProducts.find(p => p.id === item.id);
          if (!prod) continue;
          loadUnits.push({
            unitType: "box", unitId: prod.id, name: `${prod.code} - ${prod.name}`,
            width: prod.width, height: prod.height, length: prod.length,
            weight: prod.weight, color: prod.color,
            allowedOrientations: prod.allowedOrientations,
            fragile: prod.fragile, canBearWeight: prod.canBearWeight,
            maxStackCount: prod.maxStackCount, quantity: item.quantity,
          });
        } else {
          const bt = allBoxTypes.find(b => b.id === item.id);
          if (!bt) continue;
          const boxProducts = await storage.getBoxTypeProducts(bt.id);
          let boxContentsWeight = 0;
          for (const bp of boxProducts) {
            const prod = allProducts.find(p => p.id === bp.productId);
            if (prod) boxContentsWeight += prod.weight * bp.quantity;
          }
          loadUnits.push({
            unitType: "box", unitId: bt.id, name: bt.name,
            width: bt.width, height: bt.height, length: bt.length,
            weight: bt.emptyWeight + boxContentsWeight, color: bt.color,
            allowedOrientations: bt.allowedOrientations,
            fragile: bt.fragile, canBearWeight: bt.canBearWeight,
            maxStackCount: bt.maxStackCount, quantity: item.quantity,
          });
        }
      }

      const category = input.category || (space as any).category || "container";
      const categorySpaces = spaces
        .filter(s => (s as any).category === category)
        .sort((a, b) => (a.width * a.height * a.length) - (b.width * b.height * b.length));

      if (categorySpaces.length === 0) {
        return res.status(404).json({ message: "Nenhum espaço de carga disponível nesta categoria" });
      }

      let bestResult: ReturnType<typeof calculateLoadPlan> | null = null;
      let bestSpace: typeof spaces[0] = space || categorySpaces[0];
      let bestEfficiency = 0;

      const spacesToTry = space ? [space] : categorySpaces;
      for (const candidate of spacesToTry) {
        const tryResult = calculateLoadPlan(candidate, loadUnits);
        if (tryResult.unplacedCount === 0) {
          if (!bestResult || tryResult.efficiency > bestEfficiency) {
            bestResult = tryResult;
            bestSpace = candidate;
            bestEfficiency = tryResult.efficiency;
          }
        }
      }

      if (!bestResult) {
        for (const candidate of categorySpaces) {
          const tryResult = calculateLoadPlan(candidate, loadUnits);
          if (!bestResult || tryResult.unplacedCount < bestResult.unplacedCount ||
              (tryResult.unplacedCount === bestResult.unplacedCount && tryResult.efficiency > bestEfficiency)) {
            bestResult = tryResult;
            bestSpace = candidate;
            bestEfficiency = tryResult.efficiency;
          }
        }
      }

      if (!bestResult) {
        bestResult = calculateLoadPlan(bestSpace, loadUnits);
      }

      const containers: Array<{
        space: typeof space;
        items: typeof bestResult.placed;
        efficiency: number;
        totalWeight: number;
        usedVolume: number;
        spaceVolume: number;
        totalItems: number;
        remainingWeight: number;
      }> = [];

      containers.push({
        space: bestSpace,
        items: bestResult.placed,
        efficiency: bestResult.efficiency,
        totalWeight: bestResult.totalWeight,
        usedVolume: bestResult.usedVolume,
        spaceVolume: bestResult.spaceVolume,
        totalItems: bestResult.placed.length,
        remainingWeight: bestSpace.maxWeight - bestResult.totalWeight,
      });

      if (bestResult.unplacedCount > 0) {
        const totalExpanded = loadUnits.reduce((s, u) => s + u.quantity, 0);
        const placedCounts = new Map<string, number>();
        for (const p of bestResult.placed) {
          const key = `${p.unitType}-${p.unitId}`;
          placedCounts.set(key, (placedCounts.get(key) || 0) + 1);
        }

        const remainingUnits = loadUnits.map(u => {
          const key = `${u.unitType}-${u.unitId}`;
          const alreadyPlaced = placedCounts.get(key) || 0;
          const remaining = u.quantity - alreadyPlaced;
          placedCounts.set(key, 0);
          return { ...u, quantity: Math.max(0, remaining) };
        }).filter(u => u.quantity > 0);

        let containerNum = 2;
        let leftover = remainingUnits;
        while (leftover.length > 0 && containerNum <= 10) {
          const extraResult = calculateLoadPlan(bestSpace, leftover);
          if (extraResult.placed.length === 0) break;

          containers.push({
            space: bestSpace,
            items: extraResult.placed,
            efficiency: extraResult.efficiency,
            totalWeight: extraResult.totalWeight,
            usedVolume: extraResult.usedVolume,
            spaceVolume: extraResult.spaceVolume,
            totalItems: extraResult.placed.length,
            remainingWeight: bestSpace.maxWeight - extraResult.totalWeight,
          });

          if (extraResult.unplacedCount === 0) break;

          const nextPlacedCounts = new Map<string, number>();
          for (const p of extraResult.placed) {
            const key = `${p.unitType}-${p.unitId}`;
            nextPlacedCounts.set(key, (nextPlacedCounts.get(key) || 0) + 1);
          }
          leftover = leftover.map(u => {
            const key = `${u.unitType}-${u.unitId}`;
            const placed = nextPlacedCounts.get(key) || 0;
            nextPlacedCounts.set(key, 0);
            return { ...u, quantity: Math.max(0, u.quantity - placed) };
          }).filter(u => u.quantity > 0);

          containerNum++;
        }
      }

      const totalPlacedAll = containers.reduce((s, c) => s + c.totalItems, 0);
      const totalWeightAll = containers.reduce((s, c) => s + c.totalWeight, 0);
      const totalUsedVolumeAll = containers.reduce((s, c) => s + c.usedVolume, 0);
      const totalSpaceVolumeAll = containers.reduce((s, c) => s + c.spaceVolume, 0);
      const overallEfficiency = totalSpaceVolumeAll > 0 ? Math.round((totalUsedVolumeAll / totalSpaceVolumeAll) * 1000) / 10 : 0;

      const plan = await storage.createLoadPlan({
        name: `Plano - ${bestSpace.name}${containers.length > 1 ? ` (×${containers.length})` : ""}`,
        cargoSpaceId: bestSpace.id,
        efficiency: overallEfficiency,
        totalWeight: totalWeightAll,
      });

      res.json({
        ...plan,
        space: bestSpace,
        items: containers[0].items,
        efficiency: containers.length > 1 ? overallEfficiency : bestResult.efficiency,
        totalWeight: containers.length > 1 ? totalWeightAll : bestResult.totalWeight,
        usedVolume: containers.length > 1 ? totalUsedVolumeAll : bestResult.usedVolume,
        spaceVolume: containers.length > 1 ? totalSpaceVolumeAll : bestResult.spaceVolume,
        totalItems: totalPlacedAll,
        remainingWeight: bestSpace.maxWeight - bestResult.totalWeight,
        totalRequested: bestResult.totalRequested,
        unplacedCount: bestResult.totalRequested - totalPlacedAll,
        containers: containers.length > 1 ? containers : undefined,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Erro ao calcular plano de carga" });
    }
  });

  // Orders API
  app.get("/api/orders", async (req: any, res) => {
    if (!req.user?.claims?.sub) return res.status(401).json({ message: "Not authenticated" });
    const userId = req.user.claims.sub;
    const userOrders = await storage.getOrders(userId);
    res.json(userOrders);
  });

  app.get("/api/orders/:id", async (req: any, res) => {
    if (!req.user?.claims?.sub) return res.status(401).json({ message: "Not authenticated" });
    const userId = req.user.claims.sub;
    const order = await storage.getOrder(parseInt(req.params.id), userId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  });

  app.post("/api/orders", async (req: any, res) => {
    if (!req.user?.claims?.sub) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = req.user.claims.sub;
      const { name, cargoSpaceName, cargoSpaceId, efficiency, totalWeight, totalVolume, itemCount, dossier } = req.body;
      if (!name || !dossier) return res.status(400).json({ message: "Name and dossier required" });
      const orderNumber = await storage.getNextOrderNumber(userId);
      const order = await storage.createOrder({
        orderNumber,
        name,
        userId,
        cargoSpaceName: cargoSpaceName || "",
        cargoSpaceId: cargoSpaceId || null,
        status: "completed",
        efficiency: efficiency || null,
        totalWeight: totalWeight || null,
        totalVolume: totalVolume || null,
        itemCount: itemCount || null,
        dossier,
      });
      res.json(order);
    } catch (err) {
      res.status(500).json({ message: "Error creating order" });
    }
  });

  app.delete("/api/orders/:id", async (req: any, res) => {
    if (!req.user?.claims?.sub) return res.status(401).json({ message: "Not authenticated" });
    const userId = req.user.claims.sub;
    await storage.deleteOrder(parseInt(req.params.id), userId);
    res.json({ ok: true });
  });

  return httpServer;
}
