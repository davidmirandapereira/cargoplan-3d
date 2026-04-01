import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, BoxIcon, Loader2, ShieldAlert, Pencil } from "lucide-react";
import { OrientationMiniPreview } from "@/components/orientation-preview";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import type { BoxType, Product } from "@/lib/types";

const COLOR_FAMILIES = [
  { name: "Vidro / Aquários", colors: ["#3b82f6", "#2563eb", "#60a5fa"] },
  { name: "Madeira / Natural", colors: ["#d97706", "#b45309", "#f59e0b"] },
  { name: "Metal / Industrial", colors: ["#6b7280", "#4b5563", "#9ca3af"] },
  { name: "Plástico / Acessórios", colors: ["#10b981", "#059669", "#34d399"] },
  { name: "Electrónica", colors: ["#8b5cf6", "#7c3aed", "#a78bfa"] },
  { name: "Frágil / Especial", colors: ["#ef4444", "#dc2626", "#f87171"] },
  { name: "Têxtil / Embalagem", colors: ["#ec4899", "#db2777", "#f472b6"] },
  { name: "Químico / Líquidos", colors: ["#06b6d4", "#0891b2", "#22d3ee"] },
];
const COLORS = COLOR_FAMILIES.flatMap(f => f.colors);
const ORIENTATIONS = ["upright", "side", "back", "front"];

const fmtDim = (m: number) => m >= 1 ? `${m.toFixed(2)}m` : `${Math.round(m * 100)}cm`;
const formatDims = (w: number, l: number, h: number): string => `${fmtDim(l)} × ${fmtDim(w)} × ${fmtDim(h)}`;

export default function BoxTypesPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<BoxType | null>(null);
  const [form, setForm] = useState({
    code: "", name: "", width: "", height: "", length: "", emptyWeight: "0.5",
    fragile: false, canBearWeight: true, maxStackCount: "3",
    allowedOrientations: ["upright"] as string[], color: COLORS[0],
  });
  const [editForm, setEditForm] = useState({
    code: "", name: "", width: "", height: "", length: "", emptyWeight: "0.5",
    fragile: false, canBearWeight: true, maxStackCount: "3",
    allowedOrientations: ["upright"] as string[], color: COLORS[0],
  });

  const { data: boxes = [], isLoading } = useQuery<BoxType[]>({ queryKey: ["/api/box-types"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  useEffect(() => {
    if (editingBox) {
      setEditForm({
        code: editingBox.code,
        name: editingBox.name,
        width: String(editingBox.width * 100),
        height: String(editingBox.height * 100),
        length: String(editingBox.length * 100),
        emptyWeight: editingBox.emptyWeight.toString(),
        fragile: editingBox.fragile,
        canBearWeight: editingBox.canBearWeight,
        maxStackCount: editingBox.maxStackCount.toString(),
        allowedOrientations: editingBox.allowedOrientations,
        color: editingBox.color,
      });
    }
  }, [editingBox]);

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/box-types", {
      code: form.code, name: form.name,
      width: parseFloat(form.width) / 100, height: parseFloat(form.height) / 100, length: parseFloat(form.length) / 100,
      emptyWeight: parseFloat(form.emptyWeight), fragile: form.fragile, canBearWeight: form.canBearWeight,
      maxStackCount: parseInt(form.maxStackCount), allowedOrientations: form.allowedOrientations, color: form.color,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/box-types"] });
      toast({ title: t.boxes.added });
      setOpen(false);
      setForm({ code: "", name: "", width: "", height: "", length: "", emptyWeight: "0.5", fragile: false, canBearWeight: true, maxStackCount: "3", allowedOrientations: ["upright"], color: COLORS[0] });
    },
    onError: () => toast({ title: t.boxes.error, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/box-types/${editingBox?.id}`, {
      code: editForm.code, name: editForm.name,
      width: parseFloat(editForm.width) / 100, height: parseFloat(editForm.height) / 100, length: parseFloat(editForm.length) / 100,
      emptyWeight: parseFloat(editForm.emptyWeight), fragile: editForm.fragile, canBearWeight: editForm.canBearWeight,
      maxStackCount: parseInt(editForm.maxStackCount), allowedOrientations: editForm.allowedOrientations, color: editForm.color,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/box-types"] });
      toast({ title: t.boxes.updated });
      setEditOpen(false);
      setEditingBox(null);
    },
    onError: () => toast({ title: t.boxes.updateError, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/box-types/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/box-types"] }),
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <BoxIcon className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">{t.boxes.title}</h2>
          <Badge variant="secondary">{boxes.length}</Badge>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-box"><Plus className="w-4 h-4 mr-1" />{t.boxes.addBox}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t.boxes.newBox}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t.boxes.code}</Label><Input data-testid="input-box-code" value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="CX-001" /></div>
                <div><Label>{t.boxes.name}</Label><Input data-testid="input-box-name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Caixa Aquário 60" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>{t.products.length}</Label><Input type="number" step="1" value={form.length} onChange={e => setForm({...form, length: e.target.value})} /></div>
                <div><Label>{t.products.width}</Label><Input type="number" step="1" value={form.width} onChange={e => setForm({...form, width: e.target.value})} /></div>
                <div><Label>{t.products.height}</Label><Input type="number" step="1" value={form.height} onChange={e => setForm({...form, height: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t.boxes.emptyWeight}</Label><Input type="number" step="0.1" value={form.emptyWeight} onChange={e => setForm({...form, emptyWeight: e.target.value})} /></div>
                <div><Label>{t.products.maxStackCount}</Label><Input type="number" min="1" value={form.maxStackCount} onChange={e => setForm({...form, maxStackCount: e.target.value})} /></div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2"><Switch checked={form.fragile} onCheckedChange={v => setForm({...form, fragile: v})} /><Label>{t.products.fragile}</Label></div>
                <div className="flex items-center gap-2"><Switch checked={form.canBearWeight} onCheckedChange={v => setForm({...form, canBearWeight: v})} /><Label>{t.products.canBearWeight}</Label></div>
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
                <Label>{t.boxes.color}</Label>
                <div className="space-y-1.5 mt-1">
                  {COLOR_FAMILIES.map(family => (
                    <div key={family.name} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-24 truncate flex-shrink-0">{family.name}</span>
                      <div className="flex gap-1">
                        {family.colors.map(c => (
                          <button key={c} type="button" onClick={() => setForm({...form, color: c})}
                            className={`w-6 h-6 rounded-md border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button data-testid="button-submit-box" onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.code || !form.name || !form.width || !form.height || !form.length}>
                {createMutation.isPending ? t.common.adding : t.common.add}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : boxes.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">{t.boxes.noBoxes}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>{t.boxes.code}</TableHead>
                  <TableHead>{t.boxes.name}</TableHead>
                  <TableHead>{t.common.dimensions}</TableHead>
                  <TableHead>{t.boxes.emptyWeight}</TableHead>
                  <TableHead>{t.products.fragile}</TableHead>
                  <TableHead>{t.products.canBearWeight}</TableHead>
                  <TableHead>{t.products.maxStackCount}</TableHead>
                  <TableHead>{t.products.orientations}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boxes.map(b => (
                  <TableRow key={b.id} data-testid={`box-row-${b.id}`}>
                    <TableCell><div className="w-4 h-4 rounded-sm" style={{ backgroundColor: b.color }} /></TableCell>
                    <TableCell className="font-mono text-sm">{b.code}</TableCell>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-sm">{formatDims(b.width, b.length, b.height)}</TableCell>
                    <TableCell className="text-sm">{b.emptyWeight}kg</TableCell>
                    <TableCell>{b.fragile ? <ShieldAlert className="w-4 h-4 text-destructive" /> : "-"}</TableCell>
                    <TableCell className="text-sm">{b.canBearWeight ? t.common.yes : t.common.no}</TableCell>
                    <TableCell className="text-sm">{b.maxStackCount}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {b.allowedOrientations.map(o => (
                          <Badge key={o} variant="outline" className="text-xs">{t.orientationLabels[o as keyof typeof t.orientationLabels] || o}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Dialog open={editOpen && editingBox?.id === b.id} onOpenChange={(isOpen) => {
                          setEditOpen(isOpen);
                          if (!isOpen) setEditingBox(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="ghost" onClick={() => setEditingBox(b)} data-testid={`button-edit-box-${b.id}`}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader><DialogTitle>{t.boxes.edit}</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-2">
                              <div className="grid grid-cols-2 gap-3">
                                <div><Label>{t.boxes.code}</Label><Input data-testid="input-box-edit-code" value={editForm.code} onChange={e => setEditForm({...editForm, code: e.target.value})} /></div>
                                <div><Label>{t.boxes.name}</Label><Input data-testid="input-box-edit-name" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div><Label>{t.products.length}</Label><Input type="number" step="1" value={editForm.length} onChange={e => setEditForm({...editForm, length: e.target.value})} /></div>
                                <div><Label>{t.products.width}</Label><Input type="number" step="1" value={editForm.width} onChange={e => setEditForm({...editForm, width: e.target.value})} /></div>
                                <div><Label>{t.products.height}</Label><Input type="number" step="1" value={editForm.height} onChange={e => setEditForm({...editForm, height: e.target.value})} /></div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div><Label>{t.boxes.emptyWeight}</Label><Input type="number" step="0.1" value={editForm.emptyWeight} onChange={e => setEditForm({...editForm, emptyWeight: e.target.value})} /></div>
                                <div><Label>{t.products.maxStackCount}</Label><Input type="number" min="1" value={editForm.maxStackCount} onChange={e => setEditForm({...editForm, maxStackCount: e.target.value})} /></div>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2"><Switch checked={editForm.fragile} onCheckedChange={v => setEditForm({...editForm, fragile: v})} /><Label>{t.products.fragile}</Label></div>
                                <div className="flex items-center gap-2"><Switch checked={editForm.canBearWeight} onCheckedChange={v => setEditForm({...editForm, canBearWeight: v})} /><Label>{t.products.canBearWeight}</Label></div>
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
                                <Label>{t.boxes.color}</Label>
                                <div className="space-y-1.5 mt-1">
                                  {COLOR_FAMILIES.map(family => (
                                    <div key={family.name} className="flex items-center gap-2">
                                      <span className="text-[10px] text-muted-foreground w-24 truncate flex-shrink-0">{family.name}</span>
                                      <div className="flex gap-1">
                                        {family.colors.map(c => (
                                          <button key={c} type="button" onClick={() => setEditForm({...editForm, color: c})}
                                            className={`w-6 h-6 rounded-md border-2 transition-all ${editForm.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                                            style={{ backgroundColor: c }} />
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <Button data-testid="button-submit-edit-box" onClick={() => editMutation.mutate()}
                                disabled={editMutation.isPending || !editForm.code || !editForm.name || !editForm.width || !editForm.height || !editForm.length}>
                                {editMutation.isPending ? t.common.adding : t.common.add}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(b.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
