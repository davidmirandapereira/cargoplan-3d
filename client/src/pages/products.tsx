import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ShieldAlert, Package, Loader2, Pencil, Upload, Download, FileText, AlertTriangle, CheckCircle2, Search, ChevronLeft, ChevronRight, ChevronDown, Minus, Calculator } from "lucide-react";
import { OrientationMiniPreview } from "@/components/orientation-preview";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import type { Product, ProductFamily } from "@/lib/types";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const fmtCm = (m: number) => `${Math.round(m * 100)} cm`;
const formatDims = (w: number, l: number, h: number): string => `${fmtCm(l)} × ${fmtCm(w)} × ${fmtCm(h)}`;

const DEFAULT_COLOR = "#3b82f6";
const ORIENTATIONS = ["upright", "side", "back", "front"];
const PAGE_SIZE = 25;

function BoxPreview3D({ length, width, height, fragile, canBearWeight, weight, color }: {
  length: number; width: number; height: number;
  fragile?: boolean; canBearWeight?: boolean; weight?: number; color?: string;
}) {
  const hasValidDims = length > 0 && width > 0 && height > 0;
  if (!hasValidDims) return (
    <div className="flex items-center justify-center h-[160px] border border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
      <span className="text-xs text-muted-foreground">C × L × A</span>
    </div>
  );

  const maxDim = Math.max(length, width, height);
  const clamp = (v: number) => Math.max(20, (v / maxDim) * 60);
  const bL = clamp(length);
  const bW = clamp(width);
  const bH = clamp(height);

  const margin = 55;
  const ox = margin + bW * 0.866;
  const oy = margin + bH + 5;
  const ix = (x: number, y: number) => ox + x * 0.866 - y * 0.866;
  const iy = (x: number, y: number, z: number) => oy - z + x * 0.5 + y * 0.5;
  const pt = (x: number, y: number, z: number) => `${ix(x,y)},${iy(x,y,z)}`;

  const svgW = ox + bL * 0.866 + margin + 30;
  const svgH = oy + bL * 0.5 + bW * 0.5 + margin + 10;

  const dimCol = "hsl(0 0% 50%)";
  const dimText = "hsl(0 0% 20%)";
  const dashCol = "hsl(37 95% 48% / 0.5)";
  const dash = "3,2";
  const sw = 0.7;
  const tick = 4;
  const gap = 10;

  const tFL = { x: ix(0,0), y: iy(0,0,bH) };
  const tFR = { x: ix(bL,0), y: iy(bL,0,bH) };
  const tBL = { x: ix(0,bW), y: iy(0,bW,bH) };
  const tBR = { x: ix(bL,bW), y: iy(bL,bW,bH) };
  const bFL = { x: ix(0,0), y: iy(0,0,0) };
  const bFR = { x: ix(bL,0), y: iy(bL,0,0) };
  const bBL = { x: ix(0,bW), y: iy(0,bW,0) };
  const bBR = { x: ix(bL,bW), y: iy(bL,bW,0) };

  const cY = tFL.y - gap;
  const cY2 = tFR.y - gap;

  const aX = tBL.x - gap;

  const lOff = gap;

  return (
    <div className="flex flex-col items-center gap-2" data-testid="box-preview-3d">
      <svg width="100%" height="170" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet">

        <line x1={bBL.x} y1={bBL.y} x2={bFL.x} y2={bFL.y} stroke={dashCol} strokeWidth="1" strokeDasharray={dash} />
        <line x1={bBL.x} y1={bBL.y} x2={bBR.x} y2={bBR.y} stroke={dashCol} strokeWidth="1" strokeDasharray={dash} />
        <line x1={bBL.x} y1={bBL.y} x2={tBL.x} y2={tBL.y} stroke={dashCol} strokeWidth="1" strokeDasharray={dash} />

        <polygon points={`${pt(0,0,0)} ${pt(bL,0,0)} ${pt(bL,0,bH)} ${pt(0,0,bH)}`}
          fill={`${color || '#3b82f6'}88`} stroke={color || '#3b82f6'} strokeWidth="1.5" strokeLinejoin="round" />
        <polygon points={`${pt(bL,0,0)} ${pt(bL,bW,0)} ${pt(bL,bW,bH)} ${pt(bL,0,bH)}`}
          fill={`${color || '#3b82f6'}66`} stroke={color || '#3b82f6'} strokeWidth="1.5" strokeLinejoin="round" />
        <polygon points={`${pt(0,0,bH)} ${pt(bL,0,bH)} ${pt(bL,bW,bH)} ${pt(0,bW,bH)}`}
          fill={`${color || '#3b82f6'}99`} stroke={color || '#3b82f6'} strokeWidth="1.5" strokeLinejoin="round" />

        {fragile && (() => {
          const cx = (ix(0,0) + ix(bL,0)) / 2;
          const cy = (iy(0,0,bH/2) + iy(bL,0,bH/2)) / 2;
          return (
            <g transform={`translate(${cx}, ${cy})`}>
              <text textAnchor="middle" dominantBaseline="middle" fontSize="18" fill="hsl(0 70% 50% / 0.7)">⚠</text>
            </g>
          );
        })()}

        <g>
          <line x1={tFL.x} y1={tFL.y} x2={tFL.x} y2={cY - 2} stroke={dimCol} strokeWidth={sw * 0.6} />
          <line x1={tFR.x} y1={tFR.y} x2={tFR.x} y2={cY2 - 2} stroke={dimCol} strokeWidth={sw * 0.6} />
          <line x1={tFL.x} y1={cY} x2={tFR.x} y2={cY2} stroke={dimCol} strokeWidth={sw} />
          <line x1={tFL.x} y1={cY - tick/2} x2={tFL.x} y2={cY + tick/2} stroke={dimCol} strokeWidth={sw} />
          <line x1={tFR.x} y1={cY2 - tick/2} x2={tFR.x} y2={cY2 + tick/2} stroke={dimCol} strokeWidth={sw} />
          <text x={(tFL.x + tFR.x) / 2} y={(cY + cY2) / 2 - 14}
            textAnchor="middle" fontSize="10" fontWeight="600" fill={dimText}>
            C: {length} cm
          </text>
        </g>

        <g>
          <line x1={tBL.x} y1={tBL.y} x2={aX - 2} y2={tBL.y} stroke={dimCol} strokeWidth={sw * 0.6} />
          <line x1={bBL.x} y1={bBL.y} x2={aX - 2} y2={bBL.y} stroke={dimCol} strokeWidth={sw * 0.6} />
          <line x1={aX} y1={tBL.y} x2={aX} y2={bBL.y} stroke={dimCol} strokeWidth={sw} />
          <line x1={aX - tick/2} y1={tBL.y} x2={aX + tick/2} y2={tBL.y} stroke={dimCol} strokeWidth={sw} />
          <line x1={aX - tick/2} y1={bBL.y} x2={aX + tick/2} y2={bBL.y} stroke={dimCol} strokeWidth={sw} />
          <text x={aX - 14} y={(tBL.y + bBL.y) / 2 + 4}
            textAnchor="end" fontSize="10" fontWeight="600" fill={dimText}>
            A: {height} cm
          </text>
        </g>

        <g>
          <line x1={bFR.x} y1={bFR.y} x2={bFR.x + lOff} y2={bFR.y + lOff * 0.58}
            stroke={dimCol} strokeWidth={sw * 0.6} />
          <line x1={bBR.x} y1={bBR.y} x2={bBR.x + lOff} y2={bBR.y + lOff * 0.58}
            stroke={dimCol} strokeWidth={sw * 0.6} />
          <line x1={bFR.x + lOff} y1={bFR.y + lOff * 0.58}
            x2={bBR.x + lOff} y2={bBR.y + lOff * 0.58}
            stroke={dimCol} strokeWidth={sw} />
          <line x1={bFR.x + lOff - tick*0.3} y1={bFR.y + lOff*0.58 - tick*0.4}
            x2={bFR.x + lOff + tick*0.3} y2={bFR.y + lOff*0.58 + tick*0.4}
            stroke={dimCol} strokeWidth={sw} />
          <line x1={bBR.x + lOff - tick*0.3} y1={bBR.y + lOff*0.58 - tick*0.4}
            x2={bBR.x + lOff + tick*0.3} y2={bBR.y + lOff*0.58 + tick*0.4}
            stroke={dimCol} strokeWidth={sw} />
          <text x={(bFR.x + bBR.x) / 2 + lOff + 14}
            y={(bFR.y + bBR.y) / 2 + lOff * 0.58 + 16}
            textAnchor="middle" fontSize="10" fontWeight="600" fill={dimText}>
            L: {width} cm
          </text>
        </g>
      </svg>
      <div className="flex flex-col gap-1 items-center" data-testid="dim-legend">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>C = {length} cm</span>
          <span>L = {width} cm</span>
          <span>A = {height} cm</span>
          {weight ? <span>⚖ {weight} kg</span> : null}
        </div>
        {(fragile || canBearWeight === false) && (
          <div className="flex items-center gap-3 text-[11px]">
            {fragile && <span className="text-amber-600 font-medium">⚠ Frágil</span>}
            {canBearWeight === false && <span className="text-red-500 font-medium">✕ Não suporta peso</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "", name: "", width: "", height: "", length: "", weight: "",
    fragile: false, canBearWeight: true, maxStackCount: "1",
    allowedOrientations: ["upright"] as string[], color: DEFAULT_COLOR,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    code: "", name: "", width: "", height: "", length: "", weight: "",
    fragile: false, canBearWeight: true, maxStackCount: "1",
    allowedOrientations: ["upright"] as string[], color: DEFAULT_COLOR,
  });

  const [importOpen, setImportOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [collapsedFamilies, setCollapsedFamilies] = useState<Record<string, boolean>>({});
  const [, navigate] = useLocation();

  const { data: products = [], isLoading } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: families = [] } = useQuery<ProductFamily[]>({ queryKey: ["/api/product-families"] });

  const filteredProducts = searchFilter
    ? products.filter(p =>
        p.code.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (p.description || "").toLowerCase().includes(searchFilter.toLowerCase())
      )
    : products;

  const productsByFamily = useMemo(() => {
    const groups: { family: ProductFamily | null; products: Product[] }[] = [];
    const familyMap = new Map<string, Product[]>();
    const noFamily: Product[] = [];

    for (const p of filteredProducts) {
      const fam = families.find(f => f.color === p.color);
      if (fam) {
        const key = fam.id.toString();
        if (!familyMap.has(key)) familyMap.set(key, []);
        familyMap.get(key)!.push(p);
      } else {
        noFamily.push(p);
      }
    }

    for (const fam of families) {
      const prods = familyMap.get(fam.id.toString());
      if (prods && prods.length > 0) {
        groups.push({ family: fam, products: prods });
      }
    }
    if (noFamily.length > 0) {
      groups.push({ family: null, products: noFamily });
    }
    return groups;
  }, [filteredProducts, families]);

  const selectedCount = useMemo(() => {
    return Object.entries(quantities).filter(([, qty]) => qty > 0).length;
  }, [quantities]);

  const totalSelectedQty = useMemo(() => {
    return Object.values(quantities).reduce((sum, qty) => sum + (qty > 0 ? qty : 0), 0);
  }, [quantities]);

  const setQty = useCallback((productId: number, qty: number) => {
    setQuantities(prev => {
      if (qty <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: qty };
    });
  }, []);

  const toggleFamily = useCallback((familyKey: string) => {
    setCollapsedFamilies(prev => ({ ...prev, [familyKey]: !prev[familyKey] }));
  }, []);

  const goToCalculate = useCallback(() => {
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ productId: parseInt(id), quantity: qty }));
    if (items.length === 0) return;
    sessionStorage.setItem("directLoadProducts", JSON.stringify(items));
    navigate("/");
  }, [quantities, navigate]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/products", {
      code: form.code, name: form.name,
      width: parseFloat(form.width) / 100, height: parseFloat(form.height) / 100, length: parseFloat(form.length) / 100,
      weight: parseFloat(form.weight), fragile: form.fragile, canBearWeight: form.canBearWeight,
      maxStackCount: parseInt(form.maxStackCount), allowedOrientations: form.allowedOrientations, color: form.color,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: t.products.added });
      setOpen(false);
      setForm({ code: "", name: "", width: "", height: "", length: "", weight: "", fragile: false, canBearWeight: true, maxStackCount: "1", allowedOrientations: ["upright"], color: DEFAULT_COLOR });
    },
    onError: () => toast({ title: t.products.error, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/products"] }),
  });

  const editMutation = useMutation({
    mutationFn: () => {
      if (!editingProduct) return Promise.reject("No product selected");
      return apiRequest("PUT", `/api/products/${editingProduct.id}`, {
        code: editForm.code, name: editForm.name,
        width: parseFloat(editForm.width) / 100, height: parseFloat(editForm.height) / 100, length: parseFloat(editForm.length) / 100,
        weight: parseFloat(editForm.weight), fragile: editForm.fragile, canBearWeight: editForm.canBearWeight,
        maxStackCount: parseInt(editForm.maxStackCount), allowedOrientations: editForm.allowedOrientations, color: editForm.color,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: t.products.updated });
      setEditOpen(false);
      setEditingProduct(null);
    },
    onError: () => toast({ title: t.products.updateError, variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const res = await apiRequest("POST", "/api/products/import/csv", { rows });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: t.products.importSuccess?.replace("{count}", data.imported) || `${data.imported} products imported`,
        description: data.errors?.length > 0 ? `${data.errors.length} ${t.products.importErrors || "errors"}` : undefined,
      });
      setImportOpen(false);
      setCsvPreview([]);
      setCsvFileName("");
    },
    onError: () => toast({ title: t.products.error, variant: "destructive" }),
  });

  const toggleOrientation = (o: string) => {
    setForm(prev => ({
      ...prev,
      allowedOrientations: prev.allowedOrientations.includes(o)
        ? prev.allowedOrientations.filter(x => x !== o)
        : [...prev.allowedOrientations, o]
    }));
  };

  const editToggleOrientation = (o: string) => {
    setEditForm(prev => ({
      ...prev,
      allowedOrientations: prev.allowedOrientations.includes(o)
        ? prev.allowedOrientations.filter(x => x !== o)
        : [...prev.allowedOrientations, o]
    }));
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      code: product.code,
      name: product.name,
      width: String(product.width * 100),
      height: String(product.height * 100),
      length: String(product.length * 100),
      weight: product.weight.toString(),
      fragile: product.fragile,
      canBearWeight: product.canBearWeight,
      maxStackCount: product.maxStackCount.toString(),
      allowedOrientations: [...product.allowedOrientations],
      color: product.color || DEFAULT_COLOR,
    });
    setEditOpen(true);
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    if (isXlsx) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        setCsvPreview(data);
        setImportOpen(true);
      };
      reader.readAsBinaryString(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setCsvPreview(results.data as any[]);
          setImportOpen(true);
        },
        error: () => {
          toast({ title: t.products.error, variant: "destructive" });
        },
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [toast, t]);

  const downloadTemplate = useCallback(() => {
    const data = [
      ["code", "name", "description", "width_cm", "height_cm", "length_cm", "weight_kg", "fragile", "canBearWeight", "maxStackCount", "allowedOrientations"],
      ["AQ-060", "Aquário 60cm", "Aquário vidro temperado 60x30x35cm", 61, 36, 31, 12, true, false, 1, "upright"],
      ["AC-FLT", "Filtro Externo", "Filtro para aquários até 200L", 20, 40, 20, 3, false, true, 4, "upright|side"],
      ["AC-LMP", "Calha LED", "Iluminação LED 60cm", 65, 8, 12, 1.5, true, false, 3, "upright|side|front|back"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "products_template.xlsx");
  }, []);

  const exportCsv = useCallback(() => {
    window.open("/api/products/export/csv", "_blank");
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">{t.products.title}</h2>
          <Badge variant="secondary">{products.length}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadTemplate} data-testid="button-download-template" className="h-9 px-3">
            <FileText className="w-4 h-4 mr-1" />
            Template Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="button-import-csv" className="h-9 px-3">
            <Upload className="w-4 h-4 mr-1" />
            Importar Excel/CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} data-testid="button-export-csv" className="h-9 px-3">
            <Download className="w-4 h-4 mr-1" />
            Exportar Excel
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-product" className="h-9 px-3 bg-blue-600 hover:bg-blue-700 text-white"><Plus className="w-4 h-4 mr-1" />{t.products.addProduct}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t.products.newProduct}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div><Label>{t.products.code}</Label><Input data-testid="input-product-code" value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="AQ-001" /></div>
                <div>
                  <Label>{t.products.description}</Label>
                  <textarea
                    data-testid="input-product-name"
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    placeholder={t.products.descriptionPlaceholder}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>{t.products.length}</Label><Input data-testid="input-product-length" type="number" step="1" value={form.length} onChange={e => setForm({...form, length: e.target.value})} /></div>
                  <div><Label>{t.products.width}</Label><Input data-testid="input-product-width" type="number" step="1" value={form.width} onChange={e => setForm({...form, width: e.target.value})} /></div>
                  <div><Label>{t.products.height}</Label><Input data-testid="input-product-height" type="number" step="1" value={form.height} onChange={e => setForm({...form, height: e.target.value})} /></div>
                </div>
                <BoxPreview3D length={parseFloat(form.length) || 0} width={parseFloat(form.width) || 0} height={parseFloat(form.height) || 0} fragile={form.fragile} canBearWeight={form.canBearWeight} weight={parseFloat(form.weight) || 0} color={form.color} />
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t.products.weight}</Label><Input type="number" step="0.1" value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} /></div>
                  <div><Label>{t.products.maxStackCount}</Label><Input type="number" min="1" value={form.maxStackCount} onChange={e => setForm({...form, maxStackCount: e.target.value})} /></div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.fragile} onCheckedChange={v => setForm({...form, fragile: v})} />
                    <Label>{t.products.fragile}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.canBearWeight} onCheckedChange={v => setForm({...form, canBearWeight: v})} />
                    <Label>{t.products.canBearWeight}</Label>
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">{t.products.orientations}</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {ORIENTATIONS.map(o => {
                      const isActive = form.allowedOrientations.includes(o);
                      return (
                        <button key={o} type="button" onClick={() => toggleOrientation(o)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${isActive ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`}>
                          <OrientationMiniPreview orientation={o} length={parseFloat(form.length) || 0} width={parseFloat(form.width) || 0} height={parseFloat(form.height) || 0} active={isActive} />
                          <span className={`text-[11px] font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                            {t.orientationLabels[o as keyof typeof t.orientationLabels]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">{t.settings?.productFamilies || "Família de Produto"}</Label>
                  {families.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {families.map(family => (
                        <button key={family.id} type="button" onClick={() => setForm({...form, color: family.color})}
                          className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left ${form.color === family.color ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`}>
                          <span className="w-6 h-6 rounded-md flex-shrink-0 border border-border" style={{ backgroundColor: family.color }} />
                          <span className={`text-xs truncate ${form.color === family.color ? "text-primary font-medium" : "text-muted-foreground"}`}>{family.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t.settings?.noFamilies || "Defina famílias em Definições."}</p>
                  )}
                </div>
                <Button data-testid="button-submit-product" onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !form.code || !form.name || !form.width || !form.height || !form.length || !form.weight}>
                  {createMutation.isPending ? t.products.adding : t.products.add}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileSelect} data-testid="input-csv-file" />
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t.products.edit}</DialogTitle></DialogHeader>
          {editingProduct && (
            <div className="grid gap-4 py-2">
              <div><Label>{t.products.code}</Label><Input data-testid="input-edit-product-code" value={editForm.code} onChange={e => setEditForm({...editForm, code: e.target.value})} placeholder="AQ-001" /></div>
              <div>
                <Label>{t.products.description}</Label>
                <textarea
                  data-testid="input-edit-product-name"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  placeholder={t.products.descriptionPlaceholder}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>{t.products.length}</Label><Input data-testid="input-edit-product-length" type="number" step="1" value={editForm.length} onChange={e => setEditForm({...editForm, length: e.target.value})} /></div>
                <div><Label>{t.products.width}</Label><Input data-testid="input-edit-product-width" type="number" step="1" value={editForm.width} onChange={e => setEditForm({...editForm, width: e.target.value})} /></div>
                <div><Label>{t.products.height}</Label><Input data-testid="input-edit-product-height" type="number" step="1" value={editForm.height} onChange={e => setEditForm({...editForm, height: e.target.value})} /></div>
              </div>
              <BoxPreview3D length={parseFloat(editForm.length) || 0} width={parseFloat(editForm.width) || 0} height={parseFloat(editForm.height) || 0} fragile={editForm.fragile} canBearWeight={editForm.canBearWeight} weight={parseFloat(editForm.weight) || 0} color={editForm.color} />
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t.products.weight}</Label><Input type="number" step="0.1" value={editForm.weight} onChange={e => setEditForm({...editForm, weight: e.target.value})} /></div>
                <div><Label>{t.products.maxStackCount}</Label><Input type="number" min="1" value={editForm.maxStackCount} onChange={e => setEditForm({...editForm, maxStackCount: e.target.value})} /></div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={editForm.fragile} onCheckedChange={v => setEditForm({...editForm, fragile: v})} />
                  <Label>{t.products.fragile}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editForm.canBearWeight} onCheckedChange={v => setEditForm({...editForm, canBearWeight: v})} />
                  <Label>{t.products.canBearWeight}</Label>
                </div>
              </div>
              <div>
                <Label className="mb-2 block">{t.products.orientations}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {ORIENTATIONS.map(o => {
                    const isActive = editForm.allowedOrientations.includes(o);
                    return (
                      <button key={o} type="button" onClick={() => editToggleOrientation(o)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${isActive ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`}>
                        <OrientationMiniPreview orientation={o} length={parseFloat(editForm.length) || 0} width={parseFloat(editForm.width) || 0} height={parseFloat(editForm.height) || 0} active={isActive} />
                        <span className={`text-[11px] font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                          {t.orientationLabels[o as keyof typeof t.orientationLabels]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="mb-2 block">{t.settings?.productFamilies || "Família de Produto"}</Label>
                {families.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {families.map(family => (
                      <button key={family.id} type="button" onClick={() => setEditForm({...editForm, color: family.color})}
                        className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left ${editForm.color === family.color ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`}>
                        <span className="w-6 h-6 rounded-md flex-shrink-0 border border-border" style={{ backgroundColor: family.color }} />
                        <span className={`text-xs truncate ${editForm.color === family.color ? "text-primary font-medium" : "text-muted-foreground"}`}>{family.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t.settings?.noFamilies || "Defina famílias em Definições."}</p>
                )}
              </div>
              <Button data-testid="button-submit-edit-product" onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending || !editForm.code || !editForm.name || !editForm.width || !editForm.height || !editForm.length || !editForm.weight}>
                {editMutation.isPending ? t.products.saving : t.common.save}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              {t.products.importCsv || "Importar CSV"} — {csvFileName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
              <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span className="text-sm text-blue-800 dark:text-blue-200">
                {csvPreview.length} {t.products.rowsFound || "linhas encontradas"}
              </span>
            </div>

            {csvPreview.length > 0 && (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-8">#</TableHead>
                      <TableHead className="text-xs">{t.products.code}</TableHead>
                      <TableHead className="text-xs">{t.products.name}</TableHead>
                      <TableHead className="text-xs">{t.products.width}</TableHead>
                      <TableHead className="text-xs">{t.products.height}</TableHead>
                      <TableHead className="text-xs">{t.products.length}</TableHead>
                      <TableHead className="text-xs">{t.products.weight}</TableHead>
                      <TableHead className="text-xs">{t.products.orientations}</TableHead>
                      <TableHead className="text-xs">{t.products.fragile}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvPreview.slice(0, 20).map((row, i) => {
                      const hasCode = !!row.code;
                      const hasName = !!row.name;
                      const validDims = parseFloat(row.width_cm) > 0 && parseFloat(row.height_cm) > 0 && parseFloat(row.length_cm) > 0;
                      const validWeight = parseFloat(row.weight_kg) > 0;
                      const isValid = hasCode && hasName && validDims && validWeight;
                      return (
                        <TableRow key={i} className={!isValid ? "bg-red-50 dark:bg-red-950/30" : ""}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="text-xs font-mono">{row.code || <span className="text-destructive">—</span>}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{row.name || <span className="text-destructive">—</span>}</TableCell>
                          <TableCell className="text-xs">{row.width_cm || <span className="text-destructive">—</span>}</TableCell>
                          <TableCell className="text-xs">{row.height_cm || <span className="text-destructive">—</span>}</TableCell>
                          <TableCell className="text-xs">{row.length_cm || <span className="text-destructive">—</span>}</TableCell>
                          <TableCell className="text-xs">{row.weight_kg || <span className="text-destructive">—</span>}</TableCell>
                          <TableCell className="text-xs font-mono">{row.allowedOrientations || "upright"}</TableCell>
                          <TableCell className="text-xs">
                            {isValid ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {csvPreview.length > 20 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">
                    ... {t.products.andMore?.replace("{count}", String(csvPreview.length - 20)) || `+ ${csvPreview.length - 20} more rows`}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setImportOpen(false); setCsvPreview([]); }} data-testid="button-cancel-import">
                {t.common.cancel}
              </Button>
              <Button
                onClick={() => importMutation.mutate(csvPreview)}
                disabled={importMutation.isPending || csvPreview.length === 0}
                data-testid="button-confirm-import"
              >
                {importMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{t.products.importing || "A importar..."}</>
                ) : (
                  <><Upload className="w-4 h-4 mr-1" />{t.products.confirmImport?.replace("{count}", String(csvPreview.length)) || `Importar ${csvPreview.length} produtos`}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <div className="p-3 border-b flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t.products.searchPlaceholder || "Pesquisar produtos..."}
              value={searchFilter}
              onChange={e => { setSearchFilter(e.target.value); setCurrentPage(1); }}
              className="h-8 max-w-xs"
              data-testid="input-search-products"
            />
            {searchFilter && (
              <Badge variant="secondary" className="text-xs">
                {filteredProducts.length} / {products.length}
              </Badge>
            )}
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">{t.products.noProducts}</p>
          ) : (
            <div className="divide-y">
              {productsByFamily.map(({ family, products: groupProducts }) => {
                const familyKey = family ? family.id.toString() : "_none";
                const isCollapsed = collapsedFamilies[familyKey];
                const groupQtyCount = groupProducts.filter(p => (quantities[p.id] || 0) > 0).length;
                return (
                  <div key={familyKey}>
                    <button
                      data-testid={`toggle-family-${familyKey}`}
                      className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => toggleFamily(familyKey)}
                    >
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                      {family && <span className="w-4 h-4 rounded-md flex-shrink-0 border border-border" style={{ backgroundColor: family.color }} />}
                      <span className="font-semibold text-sm">{family ? family.name : (t.products.noFamily || "Sem família")}</span>
                      <Badge variant="secondary" className="text-[10px] ml-1">{groupProducts.length}</Badge>
                      {groupQtyCount > 0 && (
                        <Badge className="text-[10px] ml-auto bg-primary text-primary-foreground">{groupQtyCount} {t.products.selected || "selecionados"}</Badge>
                      )}
                    </button>
                    {!isCollapsed && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs w-28">{t.planning?.qty || "Qtd."}</TableHead>
                            <TableHead className="text-xs">{t.products.code}</TableHead>
                            <TableHead className="text-xs">{t.products.description}</TableHead>
                            <TableHead className="text-xs">{t.common.dimensions}</TableHead>
                            <TableHead className="text-xs">{t.products.weight}</TableHead>
                            <TableHead className="text-xs">{t.products.fragile}</TableHead>
                            <TableHead className="text-xs"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupProducts.map(p => {
                            const qty = quantities[p.id] || 0;
                            return (
                              <TableRow key={p.id} data-testid={`product-row-${p.id}`} className={qty > 0 ? "bg-primary/5" : ""}>
                                <TableCell className="py-1">
                                  <div className="flex items-center gap-1">
                                    <Button size="icon" variant="ghost" className="h-7 w-7"
                                      onClick={() => setQty(p.id, qty - 1)}
                                      disabled={qty <= 0}
                                      data-testid={`button-qty-minus-${p.id}`}>
                                      <Minus className="w-3 h-3" />
                                    </Button>
                                    <Input
                                      type="number" min="0" max="9999"
                                      className="w-20 h-7 text-center text-xs"
                                      value={qty || ""}
                                      placeholder="0"
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => setQty(p.id, parseInt(e.target.value) || 0)}
                                      data-testid={`input-qty-${p.id}`}
                                    />
                                    <Button size="icon" variant="ghost" className="h-7 w-7"
                                      onClick={() => setQty(p.id, qty + 1)}
                                      data-testid={`button-qty-plus-${p.id}`}>
                                      <Plus className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell className="font-mono text-xs py-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color || '#3b82f6' }} />
                                    {p.code}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs py-1 max-w-[250px] truncate" data-testid={`product-description-${p.id}`}>{p.name}</TableCell>
                                <TableCell className="text-xs py-1">{formatDims(p.width, p.length, p.height)}</TableCell>
                                <TableCell className="text-xs py-1">{p.weight}kg</TableCell>
                                <TableCell className="py-1">{p.fragile ? <ShieldAlert className="w-3.5 h-3.5 text-destructive" /> : <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                                <TableCell className="py-1">
                                  <div className="flex gap-0.5">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDialog(p)} data-testid={`button-edit-product-${p.id}`}>
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMutation.mutate(p.id)} data-testid={`button-delete-product-${p.id}`}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {totalSelectedQty > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge className="bg-primary text-primary-foreground text-sm px-3 py-1">{totalSelectedQty}</Badge>
              <span className="text-sm font-medium">
                {selectedCount} {t.products.productsSelected || "produtos selecionados"}
              </span>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setQuantities({})} data-testid="button-clear-selection">
                {t.common.cancel || "Limpar"}
              </Button>
            </div>
            <Button onClick={goToCalculate} data-testid="button-calculate-from-products" className="gap-2">
              <Calculator className="w-4 h-4" />
              {t.products.calculateLoad || "Calcular Plano de Carga"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
