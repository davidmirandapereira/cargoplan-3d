import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, Loader2, RotateCcw, Trash2, BoxIcon, Layers, Search, Plus, Minus, Container, Truck, Package, ChevronDown, ChevronRight, Lightbulb, Pencil, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Download, FileText, Save, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import Container3D from "@/components/container-3d";
import StatsPanel from "@/components/stats-panel";
import AddSpaceDialog from "@/components/add-space-dialog";
import WeightDistribution from "@/components/weight-distribution";
import LoadingReport from "@/components/loading-report";
import type { CargoSpace, BoxType, PalletType, Product, LoadPlanResult, LoadItem, PlacedUnitResult } from "@/lib/types";

function fmtDim(m: number) {
  return `${Math.round(m * 100)} cm`;
}

function formatDims(w: number, l: number, h: number) {
  return `${fmtDim(l)} × ${fmtDim(w)} × ${fmtDim(h)}`;
}

interface OrderLine {
  productId: number;
  code: string;
  name: string;
  quantity: number;
}

function FillRateBar({ efficiency, t }: { efficiency: number; t: any }) {
  const pct = Math.min(efficiency, 100);
  let color = "bg-red-500";
  let label = t.planning.fillPoor;
  if (efficiency > 90) {
    color = "bg-red-600";
    label = t.planning.fillExcess;
  } else if (efficiency >= 75) {
    color = "bg-green-500";
    label = t.planning.fillOptimal;
  } else if (efficiency >= 60) {
    color = "bg-orange-500";
    label = t.planning.fillModerate;
  }

  return (
    <div data-testid="fill-rate-bar">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium">{t.planning.fillRate}</span>
        <span className="text-xs font-bold">{efficiency.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export default function HomePage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<"container" | "truck" | "">("");
  const [selectionMode, setSelectionMode] = useState<"auto" | "manual">("auto");
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  const [loadItems, setLoadItems] = useState<LoadItem[]>([]);
  const [result, setResult] = useState<LoadPlanResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({ container: false, truck: false, custom: false, pallet: true, box: true });
  const [packingResult, setPackingResult] = useState<any | null>(null);
  const [editSpaceOpen, setEditSpaceOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<CargoSpace | null>(null);
  const [editSpaceForm, setEditSpaceForm] = useState({ name: "", width: "", height: "", length: "", maxWeight: "", category: "container" });
  const [orderImportOpen, setOrderImportOpen] = useState(false);
  const [orderImportPreview, setOrderImportPreview] = useState<{matched: {code: string; name: string; productId: number; quantity: number}[]; unmatched: {code: string; quantity: number; row: number}[]}>({ matched: [], unmatched: [] });
  const [showReport, setShowReport] = useState(false);
  const [selectedContainerIdx, setSelectedContainerIdx] = useState(0);
  const [saveOrderOpen, setSaveOrderOpen] = useState(false);
  const [saveOrderName, setSaveOrderName] = useState("");
  const [preview3D, setPreview3D] = useState<{ space: CargoSpace; items: PlacedUnitResult[] } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: spaces = [] } = useQuery<CargoSpace[]>({ queryKey: ["/api/cargo/spaces"] });
  const { data: boxes = [] } = useQuery<BoxType[]>({ queryKey: ["/api/box-types"] });
  const { data: pallets = [] } = useQuery<PalletType[]>({ queryKey: ["/api/pallet-types"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  useEffect(() => {
    if (spaces.length === 0) {
      apiRequest("POST", "/api/cargo/seed-presets", {}).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/cargo/spaces"] });
      }).catch(() => {});
    }
  }, [spaces.length]);

  useEffect(() => {
    if (products.length === 0) return;
    const stored = sessionStorage.getItem("directLoadProducts");
    if (!stored) return;
    sessionStorage.removeItem("directLoadProducts");
    try {
      const raw = JSON.parse(stored);
      if (!Array.isArray(raw)) return;
      const items = raw.filter((it: any) => typeof it?.productId === "number" && typeof it?.quantity === "number" && it.quantity > 0);
      if (items.length === 0) return;
      setLoadItems(prev => {
        const merged = [...prev];
        for (const item of items) {
          const prod = products.find(p => p.id === item.productId);
          if (!prod) continue;
          const existing = merged.find(li => li.type === "product" && li.id === prod.id);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            merged.push({
              type: "product", id: prod.id,
              name: `${prod.code} - ${prod.name}`,
              color: prod.color, quantity: item.quantity,
              dimensions: formatDims(prod.width, prod.length, prod.height),
            });
          }
        }
        return merged;
      });
      toast({ title: t.planning.directLoadAdded || "Products added directly to load" });
    } catch {}
  }, [products]);

  const selectedSpace = result?.space || null;

  const groupedSpaces = useMemo(() => {
    const groups: Record<string, CargoSpace[]> = { container: [], truck: [], custom: [] };
    spaces.forEach((s) => {
      const cat = s.category || "custom";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return groups;
  }, [spaces]);

  const palletItems = useMemo(() => pallets.map((p) => ({
    id: p.id, name: p.name, code: p.code, color: p.color,
    dims: formatDims(p.width, p.length, p.height),
    weight: `${p.maxWeight} kg`,
  })), [pallets]);

  const boxItems = useMemo(() => boxes.map((b) => ({
    id: b.id, name: b.name, code: b.code, color: b.color,
    dims: formatDims(b.width, b.length, b.height),
    weight: `${b.emptyWeight} kg`,
  })), [boxes]);

  const findPosition = useCallback((w: number, l: number, spaceW: number, spaceL: number, occupied: { x: number; z: number; w: number; l: number }[], gap: number) => {
    const candidates: { x: number; z: number }[] = [{ x: 0, z: 0 }];
    for (const o of occupied) {
      candidates.push({ x: Math.round((o.x + o.w + gap) * 1000) / 1000, z: o.z });
      candidates.push({ x: o.x, z: Math.round((o.z + o.l + gap) * 1000) / 1000 });
      candidates.push({ x: Math.round((o.x + o.w + gap) * 1000) / 1000, z: 0 });
      candidates.push({ x: 0, z: Math.round((o.z + o.l + gap) * 1000) / 1000 });
    }
    candidates.sort((a, b) => a.z - b.z || a.x - b.x);
    for (const c of candidates) {
      if (c.x + w > spaceW + 0.001 || c.z + l > spaceL + 0.001) continue;
      const fits = !occupied.some(o =>
        c.x < o.x + o.w + gap && c.x + w + gap > o.x &&
        c.z < o.z + o.l + gap && c.z + l + gap > o.z
      );
      if (fits) return c;
    }
    return null;
  }, []);

  const packItemsInSpace = useCallback((
    itemsList: (Partial<PlacedUnitResult> & { width: number; height: number; length: number; [key: string]: any })[],
    spaceW: number, spaceH: number, spaceL: number, gap: number
  ): PlacedUnitResult[] => {
    const sorted = [...itemsList].sort((a, b) => (b.width * b.length * b.height) - (a.width * a.length * a.height));
    const placed: PlacedUnitResult[] = [];
    const layers: { yBase: number; maxH: number; occupied: { x: number; z: number; w: number; l: number }[] }[] = [];
    layers.push({ yBase: 0, maxH: 0, occupied: [] });

    for (const item of sorted) {
      let wasPlaced = false;
      const orientations = [
        { w: item.width, l: item.length, h: item.height },
        { w: item.length, l: item.width, h: item.height },
        { w: item.width, l: item.height, h: item.length },
        { w: item.height, l: item.width, h: item.length },
        { w: item.length, l: item.height, h: item.width },
        { w: item.height, l: item.length, h: item.width },
      ].filter(o => o.w <= spaceW + 0.001 && o.l <= spaceL + 0.001 && o.h <= spaceH + 0.001);

      for (const layer of layers) {
        for (const ori of orientations) {
          if (layer.yBase + ori.h > spaceH + 0.001) continue;
          const pos = findPosition(ori.w, ori.l, spaceW, spaceL, layer.occupied, gap);
          if (pos) {
            placed.push({ ...item, x: pos.x, y: layer.yBase, z: pos.z, width: ori.w, height: ori.h, length: ori.l } as PlacedUnitResult);
            layer.occupied.push({ x: pos.x, z: pos.z, w: ori.w, l: ori.l });
            layer.maxH = Math.max(layer.maxH, ori.h);
            wasPlaced = true;
            break;
          }
        }
        if (wasPlaced) break;
      }
      if (!wasPlaced) {
        const lastLayer = layers[layers.length - 1];
        const newY = lastLayer.yBase + (lastLayer.maxH || 0) + gap;
        for (const ori of orientations) {
          if (newY + ori.h > spaceH + 0.001) continue;
          const newLayer = { yBase: newY, maxH: ori.h, occupied: [{ x: 0, z: 0, w: ori.w, l: ori.l }] };
          layers.push(newLayer);
          placed.push({ ...item, x: 0, y: newY, z: 0, width: ori.w, height: ori.h, length: ori.l } as PlacedUnitResult);
          wasPlaced = true;
          break;
        }
      }
    }
    return placed;
  }, [findPosition]);

  const previewPallet3D = useCallback(async (pallet: PalletType) => {
    try {
      const res = await fetch(`/api/pallet-types/${pallet.id}/boxes`);
      const palletBoxes = await res.json();
      const virtualSpace: CargoSpace = {
        id: -pallet.id,
        name: pallet.name,
        category: "pallet",
        width: pallet.width,
        height: pallet.height,
        length: pallet.length,
        maxWeight: pallet.maxWeight,
        isPreset: false,
        createdAt: new Date().toISOString(),
      };
      const allItems: any[] = [];
      palletBoxes.forEach((pb: any) => {
        const box = boxes.find(b => b.id === pb.boxTypeId);
        if (!box) return;
        for (let q = 0; q < (pb.quantity || 1); q++) {
          allItems.push({
            unitType: "box" as const, unitId: box.id, name: box.name,
            x: 0, y: 0, z: 0,
            width: box.width, height: box.height, length: box.length,
            weight: box.emptyWeight, color: box.color,
            orientation: "upright", fragile: box.fragile,
            canBearWeight: box.canBearWeight, maxStackCount: box.maxStackCount,
          });
        }
      });
      const items = packItemsInSpace(allItems, pallet.width, pallet.height, pallet.length, 0.005);
      setPreview3D({ space: virtualSpace, items });
    } catch {}
  }, [boxes, packItemsInSpace]);

  const previewBox3D = useCallback(async (box: BoxType) => {
    try {
      const res = await fetch(`/api/box-types/${box.id}/products`);
      const boxProducts = await res.json();
      const virtualSpace: CargoSpace = {
        id: -box.id,
        name: box.name,
        category: "box",
        width: box.width,
        height: box.height,
        length: box.length,
        maxWeight: 9999,
        isPreset: false,
        createdAt: new Date().toISOString(),
      };
      const allItems: any[] = [];
      boxProducts.forEach((bp: any) => {
        const prod = products.find(p => p.id === bp.productId);
        if (!prod) return;
        for (let q = 0; q < (bp.quantity || 1); q++) {
          allItems.push({
            unitType: "box" as const, unitId: prod.id, name: prod.name,
            x: 0, y: 0, z: 0,
            width: prod.width, height: prod.height, length: prod.length,
            weight: prod.weight,
            color: `hsl(${(prod.id * 67) % 360}, 70%, 55%)`,
            orientation: "upright", fragile: prod.fragile,
            canBearWeight: prod.canBearWeight, maxStackCount: prod.maxStackCount,
          });
        }
      });
      const items = packItemsInSpace(allItems, box.width, box.height, box.length, 0.002);
      setPreview3D({ space: virtualSpace, items });
    } catch {}
  }, [products, packItemsInSpace]);

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case "container": return t.planning.containers;
      case "truck": return t.planning.trucks;
      case "pallet": return t.nav.pallets;
      case "box": return t.nav.boxes;
      default: return t.planning.custom;
    }
  };

  const categoryIcon = (cat: string) => {
    switch (cat) {
      case "container": return <Container className="w-3.5 h-3.5 mr-1" />;
      case "truck": return <Truck className="w-3.5 h-3.5 mr-1" />;
      case "pallet": return <Layers className="w-3.5 h-3.5 mr-1" />;
      case "box": return <BoxIcon className="w-3.5 h-3.5 mr-1" />;
      default: return <Package className="w-3.5 h-3.5 mr-1" />;
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [products, searchQuery]);

  const addOrderLine = useCallback((product: Product) => {
    setOrderLines((prev) => {
      const existing = prev.find((ol) => ol.productId === product.id);
      if (existing) return prev.map((ol) => ol.productId === product.id ? { ...ol, quantity: ol.quantity + 1 } : ol);
      return [...prev, { productId: product.id, code: product.code, name: product.name, quantity: 1 }];
    });
    setSearchQuery("");
  }, []);

  const updateOrderQty = useCallback((productId: number, qty: number) => {
    if (qty < 1) {
      setOrderLines((prev) => prev.filter((ol) => ol.productId !== productId));
    } else {
      setOrderLines((prev) => prev.map((ol) => ol.productId === productId ? { ...ol, quantity: qty } : ol));
    }
  }, []);

  const removeOrderLine = useCallback((productId: number) => {
    setOrderLines((prev) => prev.filter((ol) => ol.productId !== productId));
  }, []);

  const handleOrderFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const lines = text.replace(/\r\n/g, "\n").split("\n").filter(l => l.trim());
      if (lines.length === 0) return;

      const firstLine = lines[0].toLowerCase();
      const sep = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ",";
      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, "").replace(/^\uFEFF/, ""));
      const codeIdx = headers.findIndex(h => ["code", "codigo", "código", "cod", "ref", "referencia", "referência", "sku"].includes(h));
      const qtyIdx = headers.findIndex(h => ["quantity", "qty", "quantidade", "qtd", "qte", "quant", "menge", "cantidad"].includes(h));

      let startRow = 0;
      if (codeIdx >= 0) {
        startRow = 1;
      }

      const matched: {code: string; name: string; productId: number; quantity: number}[] = [];
      const unmatched: {code: string; quantity: number; row: number}[] = [];

      for (let i = startRow; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""));
        const code = cols[codeIdx >= 0 ? codeIdx : 0]?.trim();
        const qtyStr = cols[qtyIdx >= 0 ? qtyIdx : 1]?.trim();
        const qty = parseInt(qtyStr) || 1;
        if (!code) continue;

        const product = products.find(p => p.code.toLowerCase() === code.toLowerCase());
        if (product) {
          const existing = matched.find(m => m.productId === product.id);
          if (existing) {
            existing.quantity += qty;
          } else {
            matched.push({ code: product.code, name: product.name, productId: product.id, quantity: qty });
          }
        } else {
          unmatched.push({ code, quantity: qty, row: i + 1 });
        }
      }

      setOrderImportPreview({ matched, unmatched });
      setOrderImportOpen(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [products]);

  const applyOrderImport = useCallback(() => {
    setOrderLines((prev) => {
      const next = [...prev];
      for (const m of orderImportPreview.matched) {
        const existing = next.find(ol => ol.productId === m.productId);
        if (existing) {
          existing.quantity += m.quantity;
        } else {
          next.push({ productId: m.productId, code: m.code, name: m.name, quantity: m.quantity });
        }
      }
      return next;
    });
    setOrderImportOpen(false);
    setOrderImportPreview({ matched: [], unmatched: [] });
    toast({ title: (t.planning.orderImported || "{count} products added").replace("{count}", orderImportPreview.matched.length.toString()) });
  }, [orderImportPreview, t, toast]);

  const downloadOrderTemplate = useCallback(() => {
    const bom = "\uFEFF";
    const csv = bom + "code;quantity\nAQ-120;2\nAQ-080;5\nCX-STD;10\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "order_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const addToLoad = useCallback((type: "pallet" | "box" | "product", item: BoxType | PalletType | Product) => {
    setLoadItems((prev) => {
      const existing = prev.find((li) => li.type === type && li.id === item.id);
      if (existing) return prev.map((li) => li.type === type && li.id === item.id ? { ...li, quantity: li.quantity + 1 } : li);
      const name = type === "product" ? `${(item as Product).code} - ${item.name}` : item.name;
      return [...prev, { type, id: item.id, name, color: item.color, quantity: 1, dimensions: formatDims(item.width, item.length, item.height) }];
    });
  }, []);

  const removeFromLoad = useCallback((type: string, id: number) => {
    setLoadItems((prev) => prev.filter((li) => !(li.type === type && li.id === id)));
  }, []);

  const updateQuantity = useCallback((type: string, id: number, qty: number) => {
    if (qty < 1) return;
    setLoadItems((prev) => prev.map((li) => li.type === type && li.id === id ? { ...li, quantity: qty } : li));
  }, []);


  const openEditSpace = useCallback((space: CargoSpace) => {
    setEditingSpace(space);
    setEditSpaceForm({
      name: space.name,
      width: String(Math.round(space.width * 100)),
      height: String(Math.round(space.height * 100)),
      length: String(Math.round(space.length * 100)),
      maxWeight: String(space.maxWeight),
      category: space.category,
    });
    setEditSpaceOpen(true);
  }, []);

  const editSpaceMutation = useMutation({
    mutationFn: () => {
      if (!editingSpace) return Promise.reject();
      const w = parseFloat(editSpaceForm.width);
      const h = parseFloat(editSpaceForm.height);
      const l = parseFloat(editSpaceForm.length);
      const mw = parseFloat(editSpaceForm.maxWeight);
      if (isNaN(w) || isNaN(h) || isNaN(l) || isNaN(mw) || w <= 0 || h <= 0 || l <= 0 || mw <= 0) {
        return Promise.reject(new Error("Invalid dimensions"));
      }
      return apiRequest("PUT", `/api/cargo/spaces/${editingSpace.id}`, {
        name: editSpaceForm.name,
        width: w / 100,
        height: h / 100,
        length: l / 100,
        maxWeight: mw,
        category: editSpaceForm.category,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargo/spaces"] });
      toast({ title: t.spaces.updated });
      setEditSpaceOpen(false);
      setEditingSpace(null);
    },
    onError: () => toast({ title: t.spaces.updateError, variant: "destructive" }),
  });

  const deleteSpaceMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/cargo/spaces/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargo/spaces"] });
      toast({ title: t.spaces.deleted });
    },
    onError: () => toast({ title: t.spaces.deleteError, variant: "destructive" }),
  });

  const recommendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cargo/recommend", {
        products: orderLines.map((ol) => ({ productId: ol.productId, quantity: ol.quantity })),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setPackingResult(data);
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const applyPacking = useCallback(() => {
    if (!packingResult) return;
    const newItems: LoadItem[] = [];

    for (const pal of (packingResult.pallets || [])) {
      newItems.push({
        type: "pallet" as const,
        id: pal.palletTypeId,
        name: `${pal.palletNumber} (${pal.palletTypeName})`,
        color: pal.color,
        quantity: 1,
        dimensions: formatDims(pal.width, pal.length, pal.actualHeight),
        instanceId: pal.palletNumber,
      });
    }

    for (const boxNum of (packingResult.unassignedBoxes || [])) {
      const box = packingResult.boxes.find((b: any) => b.boxNumber === boxNum);
      if (box) {
        newItems.push({
          type: "box" as const,
          id: box.boxTypeId,
          name: `${box.boxNumber} (${box.boxTypeName})`,
          color: box.color,
          quantity: 1,
          dimensions: formatDims(box.width, box.length, box.height),
          instanceId: box.boxNumber,
        });
      }
    }

    setLoadItems(newItems);
    toast({ title: t.recommend.addToLoad });
  }, [packingResult, t, toast]);

  const calcMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        items: loadItems.map((li) => ({ type: li.type, id: li.id, quantity: li.quantity })),
      };
      if (selectionMode === "manual" && selectedSpaceId) {
        body.spaceId = selectedSpaceId;
      } else {
        body.category = selectedCategory || "container";
      }
      const res = await apiRequest("POST", "/api/cargo/calculate", body);
      return res.json();
    },
    onSuccess: (data: LoadPlanResult) => {
      setResult(data);
      setSelectedContainerIdx(0);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      const msg = t.planning.planResult.replace("{efficiency}", data.efficiency.toString());
      if (data.containers && data.containers.length > 1) {
        toast({
          title: msg,
          description: `${data.containers.length}× ${data.space.name}`,
        });
      } else if (data.unplacedCount && data.unplacedCount > 0) {
        toast({
          title: msg,
          description: `${data.unplacedCount} de ${data.totalRequested} itens não couberam.`,
          variant: "destructive",
        });
      } else {
        toast({ title: `${msg} — ${data.space.name}` });
      }
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const saveOrderMutation = useMutation({
    mutationFn: async () => {
      if (!result || !selectedSpace) return;
      const res = await apiRequest("POST", "/api/orders", {
        name: saveOrderName || `${selectedSpace.name} - ${new Date().toLocaleDateString("pt-PT")}`,
        cargoSpaceName: selectedSpace.name,
        cargoSpaceId: selectedSpace.id,
        efficiency: result.efficiency,
        totalWeight: result.totalWeight,
        totalVolume: result.usedVolume,
        itemCount: result.totalItems,
        dossier: {
          space: selectedSpace,
          items: result.items,
          efficiency: result.efficiency,
          totalWeight: result.totalWeight,
          usedVolume: result.usedVolume,
          spaceVolume: result.spaceVolume,
          orderLines,
          loadItems,
        },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: t.orders?.saved || "Order saved" });
      setSaveOrderOpen(false);
      setSaveOrderName("");
    },
    onError: () => toast({ title: t.orders?.saveError || "Error saving order", variant: "destructive" }),
  });

  const hasMultiContainers = result?.containers && result.containers.length > 1;
  const activeContainer = hasMultiContainers ? result.containers![selectedContainerIdx] : null;
  const resultItems: PlacedUnitResult[] = activeContainer ? activeContainer.items : (result?.items ?? []);
  const activeSpace = activeContainer ? activeContainer.space : selectedSpace;

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 h-[calc(100vh-56px)]">
      <Dialog open={editSpaceOpen} onOpenChange={setEditSpaceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.spaces.editSpace}</DialogTitle></DialogHeader>
          {editingSpace && (
            <div className="grid gap-4 py-2">
              <div><Label>{t.spaces.name}</Label><Input data-testid="input-edit-space-name" value={editSpaceForm.name} onChange={(e) => setEditSpaceForm({ ...editSpaceForm, name: e.target.value })} /></div>
              <div>
                <Label>{t.spaces.category}</Label>
                <Select value={editSpaceForm.category} onValueChange={(v) => setEditSpaceForm({ ...editSpaceForm, category: v })}>
                  <SelectTrigger data-testid="select-edit-space-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="container">{t.planning.containers}</SelectItem>
                    <SelectItem value="truck">{t.planning.trucks}</SelectItem>
                    <SelectItem value="custom">{t.planning.custom}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>{t.spaces.length}</Label><Input data-testid="input-edit-space-length" type="number" step="1" value={editSpaceForm.length} onChange={(e) => setEditSpaceForm({ ...editSpaceForm, length: e.target.value })} /></div>
                <div><Label>{t.spaces.width}</Label><Input data-testid="input-edit-space-width" type="number" step="1" value={editSpaceForm.width} onChange={(e) => setEditSpaceForm({ ...editSpaceForm, width: e.target.value })} /></div>
                <div><Label>{t.spaces.height}</Label><Input data-testid="input-edit-space-height" type="number" step="1" value={editSpaceForm.height} onChange={(e) => setEditSpaceForm({ ...editSpaceForm, height: e.target.value })} /></div>
              </div>
              <div><Label>{t.spaces.maxWeight}</Label><Input data-testid="input-edit-space-max-weight" type="number" value={editSpaceForm.maxWeight} onChange={(e) => setEditSpaceForm({ ...editSpaceForm, maxWeight: e.target.value })} /></div>
              <Button data-testid="button-submit-edit-space" onClick={() => editSpaceMutation.mutate()}
                disabled={editSpaceMutation.isPending || !editSpaceForm.name || !editSpaceForm.width || !editSpaceForm.height || !editSpaceForm.length || !editSpaceForm.maxWeight}>
                {editSpaceMutation.isPending ? t.common.adding : t.common.save}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={orderImportOpen} onOpenChange={setOrderImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              {t.planning.importOrder}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {orderImportPreview.matched.length > 0 && (
              <div>
                <p className="text-sm font-medium text-green-600 flex items-center gap-1 mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {orderImportPreview.matched.length} {t.planning.orderMatched || "products found"}
                </p>
                <div className="border rounded-md overflow-hidden max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs h-7">{t.planning.code}</TableHead>
                        <TableHead className="text-xs h-7">{t.planning.product}</TableHead>
                        <TableHead className="text-xs h-7 text-center">{t.planning.qty}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderImportPreview.matched.map((m) => (
                        <TableRow key={m.productId}>
                          <TableCell className="py-1 text-xs font-mono">{m.code}</TableCell>
                          <TableCell className="py-1 text-xs truncate max-w-[180px]">{m.name}</TableCell>
                          <TableCell className="py-1 text-xs text-center font-medium">{m.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            {orderImportPreview.unmatched.length > 0 && (
              <div>
                <p className="text-sm font-medium text-amber-600 flex items-center gap-1 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  {orderImportPreview.unmatched.length} {t.planning.orderUnmatched || "codes not found"}
                </p>
                <div className="border border-amber-200 bg-amber-50 rounded-md p-2 max-h-32 overflow-y-auto">
                  {orderImportPreview.unmatched.map((u, i) => (
                    <p key={i} className="text-xs text-amber-700">
                      {t.planning.orderRow} {u.row}: <span className="font-mono font-medium">{u.code}</span> (×{u.quantity})
                    </p>
                  ))}
                </div>
              </div>
            )}
            {orderImportPreview.matched.length === 0 && orderImportPreview.unmatched.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t.planning.noResults}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOrderImportOpen(false)} data-testid="button-cancel-order-import">
                {t.common.cancel}
              </Button>
              <Button
                onClick={applyOrderImport}
                disabled={orderImportPreview.matched.length === 0}
                data-testid="button-confirm-order-import"
              >
                {(t.planning.confirmOrderImport || "Add {count} products").replace("{count}", orderImportPreview.matched.length.toString())}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={saveOrderOpen} onOpenChange={setSaveOrderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.orders?.saveOrder || "Save Order"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>{t.orders?.orderName || "Order Name"}</Label>
              <Input
                data-testid="input-save-order-name"
                placeholder={selectedSpace ? `${selectedSpace.name} - ${new Date().toLocaleDateString("pt-PT")}` : ""}
                value={saveOrderName}
                onChange={(e) => setSaveOrderName(e.target.value)}
              />
            </div>
            {result && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{t.orders?.cargoSpace || "Cargo Space"}: <strong>{selectedSpace?.name}</strong></p>
                <p>{t.stats?.efficiency || "Efficiency"}: <strong>{result.efficiency.toFixed(1)}%</strong></p>
                <p>{t.stats?.totalWeight || "Total Weight"}: <strong>{result.totalWeight.toFixed(1)} kg</strong></p>
                <p>{t.stats?.itemsLoaded || "Items"}: <strong>{result.totalItems}{result.unplacedCount ? ` / ${result.totalRequested}` : ""}</strong></p>
              </div>
            )}
            <Button
              data-testid="button-confirm-save-order"
              onClick={() => saveOrderMutation.mutate()}
              disabled={saveOrderMutation.isPending}
            >
              {saveOrderMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              {saveOrderMutation.isPending ? (t.common?.adding || "Saving...") : (t.orders?.saveOrder || "Save Order")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview3D} onOpenChange={(open) => !open && setPreview3D(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              {t.planning.preview3D}: {preview3D?.space.name}
            </DialogTitle>
          </DialogHeader>
          <div className="h-[420px]">
            {preview3D && (
              <Container3D space={preview3D.space} items={preview3D.items} isPallet={preview3D.space.category === "pallet"} />
            )}
          </div>
          {preview3D && preview3D.items.length > 0 && (
            <div className="border-t pt-4 space-y-3" data-testid="preview-packing-info">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="border rounded-md p-2">
                  <p className="text-lg font-bold" data-testid="preview-total-items">{preview3D.items.length}</p>
                  <p className="text-[10px] text-muted-foreground">{t.stats?.itemsLoaded || "Itens colocados"}</p>
                </div>
                <div className="border rounded-md p-2">
                  <p className="text-lg font-bold" data-testid="preview-total-weight">{preview3D.items.reduce((s, i) => s + i.weight, 0).toFixed(1)} kg</p>
                  <p className="text-[10px] text-muted-foreground">{t.stats?.totalWeight || "Peso total"}</p>
                </div>
                <div className="border rounded-md p-2">
                  <p className="text-lg font-bold" data-testid="preview-volume-used">
                    {((preview3D.items.reduce((s, i) => s + i.width * i.height * i.length, 0) / (preview3D.space.width * preview3D.space.height * preview3D.space.length)) * 100).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">{t.stats?.efficiency || "Eficiência"}</p>
                </div>
                <div className="border rounded-md p-2">
                  <p className="text-lg font-bold" data-testid="preview-layers">
                    {new Set(preview3D.items.map(i => Math.round(i.y * 1000))).size}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{t.report?.layers || "Camadas"}</p>
                </div>
              </div>
              <div className="space-y-1.5" data-testid="preview-step-list">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t.report?.stepByStep || "Passo a passo"}</p>
                {preview3D.items.slice().sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x).map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded-md hover:bg-muted/50" data-testid={`preview-step-${i + 1}`}>
                    <span className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">{i + 1}</span>
                    <span className="w-3 h-3 rounded-sm flex-shrink-0 border" style={{ backgroundColor: item.color }} />
                    <span className="font-medium flex-shrink-0">{item.name}</span>
                    <span className="text-muted-foreground">
                      {fmtDim(item.length)} × {fmtDim(item.width)} × {fmtDim(item.height)} · {item.weight}kg
                    </span>
                    <span className="text-muted-foreground ml-auto flex-shrink-0">
                      x={Math.round(item.x * 100)} y={Math.round(item.y * 100)} z={Math.round(item.z * 100)}cm
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {preview3D && preview3D.items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">{t.planning.noItemsInside || "No items configured inside this unit."}</p>
          )}
        </DialogContent>
      </Dialog>

      <div className="lg:w-[420px] space-y-3 overflow-y-auto flex-shrink-0">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t.planning.cargoSpace}</CardTitle>
              <AddSpaceDialog />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-1 mb-1">
              <button
                data-testid="mode-auto"
                className={`flex-1 text-xs py-1.5 px-2 rounded-md font-medium transition-all ${
                  selectionMode === "auto"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                onClick={() => { setSelectionMode("auto"); setSelectedSpaceId(null); setResult(null); }}
              >
                {t.planning.autoMode || "Automático"}
              </button>
              <button
                data-testid="mode-manual"
                className={`flex-1 text-xs py-1.5 px-2 rounded-md font-medium transition-all ${
                  selectionMode === "manual"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                onClick={() => { setSelectionMode("manual"); setResult(null); }}
              >
                {t.planning.manualMode || "Manual"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(groupedSpaces["container"] || []).length > 0 && (
                <button
                  data-testid="select-category-container"
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border-2 text-sm transition-all cursor-pointer ${
                    selectedCategory === "container"
                      ? "border-primary bg-primary/10 font-semibold shadow-sm"
                      : "border-border hover:bg-muted/50 hover:border-muted-foreground/30"
                  }`}
                  onClick={() => { setSelectedCategory("container"); setSelectedSpaceId(null); setResult(null); }}
                >
                  <Container className="w-6 h-6" />
                  <span>{categoryLabel("container")}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {(groupedSpaces["container"] || []).length} {t.planning.available || "disponíveis"}
                  </span>
                </button>
              )}
              {(groupedSpaces["truck"] || []).length > 0 && (
                <button
                  data-testid="select-category-truck"
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border-2 text-sm transition-all cursor-pointer ${
                    selectedCategory === "truck"
                      ? "border-primary bg-primary/10 font-semibold shadow-sm"
                      : "border-border hover:bg-muted/50 hover:border-muted-foreground/30"
                  }`}
                  onClick={() => { setSelectedCategory("truck"); setSelectedSpaceId(null); setResult(null); }}
                >
                  <Truck className="w-6 h-6" />
                  <span>{categoryLabel("truck")}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {(groupedSpaces["truck"] || []).length} {t.planning.available || "disponíveis"}
                  </span>
                </button>
              )}
            </div>

            {selectionMode === "auto" && selectedCategory && (
              <p className="text-[11px] text-muted-foreground text-center italic">
                {t.planning.autoSelectInfo || "O tamanho ideal será selecionado automaticamente"}
              </p>
            )}

            {selectionMode === "manual" && selectedCategory && (
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground mb-1">
                  {t.planning.chooseSpace || "Escolha o espaço de carga:"}
                </p>
                {(groupedSpaces[selectedCategory] || [])
                  .sort((a, b) => (a.width * a.height * a.length) - (b.width * b.height * b.length))
                  .map((sp) => (
                  <button
                    key={sp.id}
                    data-testid={`select-space-${sp.id}`}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-all cursor-pointer ${
                      selectedSpaceId === sp.id
                        ? "border-primary bg-primary/10 font-medium shadow-sm"
                        : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => { setSelectedSpaceId(sp.id); setResult(null); }}
                  >
                    <span>{sp.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {sp.length}×{sp.width}×{sp.height}m · {sp.maxWeight}kg
                    </span>
                  </button>
                ))}
              </div>
            )}

            {palletItems.length > 0 && (
              <div>
                <button
                  data-testid="toggle-pallet-category"
                  className="text-xs font-medium text-muted-foreground mb-1 flex items-center w-full hover:text-foreground transition-colors"
                  onClick={() => toggleCategory("pallet")}
                >
                  {collapsedCategories.pallet ? <ChevronRight className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
                  {categoryIcon("pallet")}{categoryLabel("pallet")}
                </button>
                {!collapsedCategories.pallet && (
                  <div className="grid grid-cols-1 gap-1">
                    {palletItems.map((p) => (
                      <div
                        key={p.id}
                        data-testid={`button-pallet-space-${p.id}`}
                        className="flex items-center gap-1 text-left px-3 py-2 rounded-md border border-border hover:bg-muted/50 text-sm transition-colors"
                      >
                        <div className="flex-1 cursor-pointer" onClick={() => addToLoad("pallet", pallets.find(pl => pl.id === p.id)!)}>
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {p.dims} · {p.weight}
                          </span>
                        </div>
                        <button
                          data-testid={`preview-pallet-${p.id}`}
                          className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          onClick={(e) => { e.stopPropagation(); previewPallet3D(pallets.find(pl => pl.id === p.id)!); }}
                          title={t.planning.preview3D}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {boxItems.length > 0 && (
              <div>
                <button
                  data-testid="toggle-box-category"
                  className="text-xs font-medium text-muted-foreground mb-1 flex items-center w-full hover:text-foreground transition-colors"
                  onClick={() => toggleCategory("box")}
                >
                  {collapsedCategories.box ? <ChevronRight className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
                  {categoryIcon("box")}{categoryLabel("box")}
                </button>
                {!collapsedCategories.box && (
                  <div className="grid grid-cols-1 gap-1">
                    {boxItems.map((b) => (
                      <div
                        key={b.id}
                        data-testid={`button-box-space-${b.id}`}
                        className="flex items-center gap-1 text-left px-3 py-2 rounded-md border border-border hover:bg-muted/50 text-sm transition-colors"
                      >
                        <div className="flex-1 cursor-pointer" onClick={() => addToLoad("box", boxes.find(bx => bx.id === b.id)!)}>
                          <span className="font-medium">{b.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {b.dims} · {b.weight}
                          </span>
                        </div>
                        <button
                          data-testid={`preview-box-${b.id}`}
                          className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          onClick={(e) => { e.stopPropagation(); previewBox3D(boxes.find(bx => bx.id === b.id)!); }}
                          title={t.planning.preview3D}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="w-4 h-4" />
                {t.planning.orderTable}
              </CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={downloadOrderTemplate} data-testid="button-order-template">
                  <Download className="w-3 h-3" />
                  {t.planning.orderTemplate}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => document.getElementById("order-csv-input")?.click()} data-testid="button-import-order">
                  <Upload className="w-3 h-3" />
                  {t.planning.importOrder}
                </Button>
                <input id="order-csv-input" type="file" accept=".csv,.txt,.tsv,.xls" className="hidden" onChange={handleOrderFileImport} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                data-testid="input-product-search"
                className="pl-9"
                placeholder={t.planning.searchProduct}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {filteredProducts.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      data-testid={`button-search-result-${p.id}`}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between"
                      onClick={() => addOrderLine(p)}
                    >
                      <span>
                        <span className="font-mono text-xs text-muted-foreground mr-2">{p.code}</span>
                        {p.name}
                      </span>
                      <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.trim() && filteredProducts.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-center text-sm text-muted-foreground">
                  {t.planning.noResults}
                </div>
              )}
            </div>

            {orderLines.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs h-8">{t.planning.code}</TableHead>
                      <TableHead className="text-xs h-8">{t.planning.product}</TableHead>
                      <TableHead className="text-xs h-8 text-center w-32">{t.planning.qty}</TableHead>
                      <TableHead className="text-xs h-8 w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderLines.map((ol) => (
                      <TableRow key={ol.productId}>
                        <TableCell className="py-1 text-xs font-mono">{ol.code}</TableCell>
                        <TableCell className="py-1 text-xs truncate max-w-[120px]">{ol.name}</TableCell>
                        <TableCell className="py-1">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateOrderQty(ol.productId, ol.quantity - 1)} data-testid={`button-order-minus-${ol.productId}`}>
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              max="9999"
                              className="w-20 h-6 text-center text-xs"
                              value={ol.quantity}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => updateOrderQty(ol.productId, parseInt(e.target.value) || 1)}
                              data-testid={`input-order-qty-${ol.productId}`}
                            />
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateOrderQty(ol.productId, ol.quantity + 1)} data-testid={`button-order-plus-${ol.productId}`}>
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="py-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeOrderLine(ol.productId)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {orderLines.length > 0 && (
              <div className="space-y-1.5">
                <Button
                  variant="secondary"
                  className="w-full"
                  data-testid="button-recommend"
                  onClick={() => recommendMutation.mutate()}
                  disabled={recommendMutation.isPending}
                >
                  {recommendMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Lightbulb className="w-4 h-4 mr-1" />}
                  {recommendMutation.isPending ? t.recommend.calculating : t.recommend.calculate}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  data-testid="button-direct-load"
                  onClick={() => {
                    for (const ol of orderLines) {
                      const prod = products.find(p => p.id === ol.productId);
                      if (!prod) continue;
                      setLoadItems((prev) => {
                        const existing = prev.find((li) => li.type === "product" && li.id === prod.id);
                        if (existing) return prev.map((li) => li.type === "product" && li.id === prod.id ? { ...li, quantity: li.quantity + ol.quantity } : li);
                        return [...prev, { type: "product" as const, id: prod.id, name: `${prod.code} - ${prod.name}`, color: prod.color, quantity: ol.quantity, dimensions: formatDims(prod.width, prod.length, prod.height) }];
                      });
                    }
                    toast({ title: t.planning.directLoadAdded || "Products added directly to load" });
                  }}
                >
                  <Package className="w-4 h-4 mr-1" />
                  {t.planning.directLoad || "Load directly (without boxes)"}
                </Button>
              </div>
            )}

            {packingResult && (packingResult.boxes?.length > 0 || packingResult.pallets?.length > 0) && (
              <div className="border rounded-md p-3 bg-muted/30 space-y-3">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  {t.recommend.title}
                </p>

                {packingResult.boxes?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                      <BoxIcon className="w-3 h-3" />
                      {t.recommend.numberedBoxes} ({packingResult.boxes.length})
                    </p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {packingResult.boxes.map((box: any) => (
                        <div key={box.boxNumber} className="text-xs border rounded-md p-2 bg-background">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: box.color }} />
                            <span className="font-bold">{box.boxNumber}</span>
                            <span className="text-muted-foreground">{box.boxTypeName}</span>
                            <Badge variant="outline" className="text-[10px] ml-auto">{box.totalWeight} kg</Badge>
                          </div>
                          <div className="pl-5 space-y-0.5 text-muted-foreground">
                            {box.contents.map((c: any) => (
                              <span key={c.productId} className="block">
                                {c.quantity}× {c.code} {c.name} <span className="text-[10px]">({c.weight.toFixed(1)} kg)</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {packingResult.pallets?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {t.recommend.numberedPallets} ({packingResult.pallets.length})
                    </p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {packingResult.pallets.map((pal: any) => (
                        <div key={pal.palletNumber} className="text-xs border rounded-md p-2 bg-background">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: pal.color }} />
                            <span className="font-bold">{pal.palletNumber}</span>
                            <span className="text-muted-foreground">{pal.palletTypeName}</span>
                            <Badge variant="outline" className="text-[10px] ml-auto">
                              {pal.totalWeight} kg · h={Math.round(pal.actualHeight * 100)} cm
                            </Badge>
                          </div>
                          <div className="pl-5 space-y-0.5 text-muted-foreground">
                            {pal.boxes.map((b: any) => (
                              <span key={b.boxNumber} className="block">
                                {b.boxNumber} ({b.boxTypeCode}) — {b.weight} kg
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {packingResult.summary?.productsNotPacked?.length > 0 && (
                  <div className="text-xs text-destructive border border-destructive/30 rounded-md p-2">
                    <span className="font-semibold">{t.recommend.notPacked}:</span>
                    {packingResult.summary.productsNotPacked.map((p: any) => (
                      <span key={p.productId} className="block pl-2">{p.remaining}× {p.code} {p.name}</span>
                    ))}
                  </div>
                )}

                <div className="text-xs text-muted-foreground border-t pt-2">
                  {t.recommend.summaryLabel}: {packingResult.summary?.totalBoxes} {t.recommend.boxesLabel}, {packingResult.summary?.totalPallets} {t.recommend.palletsLabel}, {packingResult.summary?.totalWeight} kg
                </div>

                <Button size="sm" className="w-full" data-testid="button-apply-recommendations" onClick={applyPacking}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {t.recommend.addToLoad}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.planning.loadItems}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">{t.planning.noItems}</p>
            )}

            {loadItems.length > 0 && (
              <div className="border rounded-md divide-y">
                {loadItems.map((li) => (
                  <div key={`${li.type}-${li.id}`} className="flex items-center gap-2 px-2 py-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: li.color }} />
                    <span className="text-sm flex-1 truncate">{li.name}</span>
                    <span className="text-xs text-muted-foreground">{li.dimensions}</span>
                    <Input type="number" min="1" className="w-20 h-7 text-center text-sm" value={li.quantity}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateQuantity(li.type, li.id, parseInt(e.target.value) || 1)}
                      data-testid={`input-qty-${li.type}-${li.id}`} />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeFromLoad(li.type, li.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button className="flex-1" data-testid="button-calculate" onClick={() => calcMutation.mutate()}
                disabled={calcMutation.isPending || (!selectedCategory && selectionMode === "auto") || (selectionMode === "manual" && !selectedSpaceId) || loadItems.length === 0}>
                {calcMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Calculator className="w-4 h-4 mr-1" />}
                {calcMutation.isPending ? t.planning.calculating : t.planning.calculate}
              </Button>
              {result && (
                <Button variant="outline" onClick={() => setSaveOrderOpen(true)} data-testid="button-save-order">
                  <Save className="w-4 h-4" />
                </Button>
              )}
              {result && (
                <Button variant="outline" onClick={() => setShowReport(!showReport)} data-testid="button-report">
                  <FileText className="w-4 h-4" />
                </Button>
              )}
              {result && (
                <Button variant="outline" onClick={() => { setResult(null); setShowReport(false); setSelectedContainerIdx(0); }} data-testid="button-reset">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

      </div>

      <div ref={resultsRef} className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
        {result && <StatsPanel result={result} space={activeSpace} />}

        {result && (
          <Card>
            <CardContent className="pt-4 pb-3">
              <FillRateBar efficiency={activeContainer ? activeContainer.efficiency : result.efficiency} t={t} />
            </CardContent>
          </Card>
        )}

        {hasMultiContainers && result.containers && (
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{result.containers.length} {result.space.name}</span>
                <span className="text-xs text-muted-foreground mx-1">|</span>
                {result.containers.map((c, idx) => (
                  <Button
                    key={idx}
                    size="sm"
                    variant={selectedContainerIdx === idx ? "default" : "outline"}
                    className="h-7 text-xs px-3"
                    onClick={() => setSelectedContainerIdx(idx)}
                    data-testid={`button-container-${idx}`}
                  >
                    #{idx + 1} ({c.efficiency.toFixed(0)}%)
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {result && <WeightDistribution space={activeSpace} items={resultItems} />}

        <Card className="min-h-[520px]">
          <CardContent className="p-0 h-[520px]">
            <Container3D space={activeSpace} items={resultItems} />
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">{t.planning.loadSequence}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-10">{t.planning.seq}</TableHead>
                    <TableHead className="text-xs">{t.table.item}</TableHead>
                    <TableHead className="text-xs">{t.table.position}</TableHead>
                    <TableHead className="text-xs">{t.table.dimensions}</TableHead>
                    <TableHead className="text-xs">{t.table.orientation}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultItems
                    .slice()
                    .sort((a, b) => (a.loadOrder || 0) - (b.loadOrder || 0) || a.z - b.z || a.y - b.y || a.x - b.x)
                    .map((item, i) => {
                      const spaceLen = activeSpace?.length || 1;
                      const spaceWid = activeSpace?.width || 1;
                      const zCenter = item.z + item.length / 2;
                      const xCenter = item.x + item.width / 2;
                      const third = spaceLen / 3;
                      const zone = zCenter >= third * 2
                        ? ((t.report as any).zoneBack || "Fundo")
                        : zCenter >= third
                          ? ((t.report as any).zoneMiddle || "Meio")
                          : ((t.report as any).zoneFront || "Porta");
                      const side = xCenter < spaceWid / 3
                        ? ((t.report as any).leftSide || "Esq.")
                        : xCenter > spaceWid * 2 / 3
                          ? ((t.report as any).rightSide || "Dir.")
                          : ((t.report as any).center || "Centro");
                      const height = item.y < 0.005
                        ? ((t.report as any).floor || "Chão")
                        : `${fmtDim(item.y)} alt.`;
                      return (
                    <TableRow key={i}>
                      <TableCell className="py-1 text-xs font-bold text-center">{item.loadOrder || i + 1}</TableCell>
                      <TableCell className="py-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                          <span className="text-xs font-medium">{item.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1">
                            {item.unitType === "pallet" ? t.table.pallet : t.table.box}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs py-1">{zone} · {side} · {height}</TableCell>
                      <TableCell className="text-xs py-1">{formatDims(item.width, item.length, item.height)}</TableCell>
                      <TableCell className="text-xs py-1">{t.orientationLabels[item.orientation as keyof typeof t.orientationLabels] || item.orientation}</TableCell>
                    </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {showReport && result && (
          <LoadingReport space={activeSpace} items={resultItems} result={result} />
        )}
      </div>
    </div>
  );
}
