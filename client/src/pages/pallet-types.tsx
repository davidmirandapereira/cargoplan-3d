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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2, ShieldAlert, Layers, Pencil } from "lucide-react";
import { OrientationMiniPreview } from "@/components/orientation-preview";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import type { PalletType } from "@/lib/types";

const fmtDim = (m: number) => m >= 1 ? `${m.toFixed(2)}m` : `${Math.round(m * 100)}cm`;
const formatDims = (w: number, l: number, h: number) => `${fmtDim(l)} × ${fmtDim(w)} × ${fmtDim(h)}`;

const COLOR_FAMILIES = [
  { name: "Madeira / Natural", colors: ["#d97706", "#b45309", "#f59e0b"] },
  { name: "Metal / Industrial", colors: ["#6b7280", "#4b5563", "#92400e"] },
  { name: "Plástico", colors: ["#10b981", "#059669", "#34d399"] },
  { name: "Vidro", colors: ["#3b82f6", "#2563eb", "#60a5fa"] },
  { name: "Especial", colors: ["#ef4444", "#8b5cf6", "#ec4899"] },
];
const COLORS = COLOR_FAMILIES.flatMap(f => f.colors);
const ORIENTATIONS = ["upright", "side", "back", "front"];

export default function PalletTypesPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingPallet, setEditingPallet] = useState<PalletType | null>(null);
  const [form, setForm] = useState({
    code: "", name: "", width: "", height: "", length: "",
    tareWeight: "25", maxWeight: "1000",
    fragile: false, canBearWeight: true, maxStackCount: "3",
    allowedOrientations: ["upright"] as string[], color: COLORS[0],
  });
  const [editForm, setEditForm] = useState({
    code: "", name: "", width: "", height: "", length: "",
    tareWeight: "25", maxWeight: "1000",
    fragile: false, canBearWeight: true, maxStackCount: "3",
    allowedOrientations: ["upright"] as string[], color: COLORS[0],
  });

  const { data: pallets = [], isLoading } = useQuery<PalletType[]>({ queryKey: ["/api/pallet-types"] });

  useEffect(() => {
    if (editingPallet) {
      setEditForm({
        code: editingPallet.code,
        name: editingPallet.name,
        width: String(editingPallet.width * 100),
        height: String(editingPallet.height * 100),
        length: String(editingPallet.length * 100),
        tareWeight: String(editingPallet.tareWeight),
        maxWeight: String(editingPallet.maxWeight),
        fragile: editingPallet.fragile,
        canBearWeight: editingPallet.canBearWeight,
        maxStackCount: String(editingPallet.maxStackCount),
        allowedOrientations: editingPallet.allowedOrientations,
        color: editingPallet.color,
      });
    }
  }, [editingPallet]);

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/pallet-types", {
      code: form.code, name: form.name,
      width: parseFloat(form.width) / 100, height: parseFloat(form.height) / 100, length: parseFloat(form.length) / 100,
      tareWeight: parseFloat(form.tareWeight), maxWeight: parseFloat(form.maxWeight),
      fragile: form.fragile, canBearWeight: form.canBearWeight,
      maxStackCount: parseInt(form.maxStackCount), allowedOrientations: form.allowedOrientations, color: form.color,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pallet-types"] });
      toast({ title: t.pallets.added });
      setOpen(false);
      setForm({ code: "", name: "", width: "", height: "", length: "", tareWeight: "25", maxWeight: "1000", fragile: false, canBearWeight: true, maxStackCount: "3", allowedOrientations: ["upright"], color: COLORS[0] });
    },
    onError: () => toast({ title: t.pallets.error, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/pallet-types/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/pallet-types"] }),
  });

  const editMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/pallet-types/${editingPallet?.id}`, {
      code: editForm.code, name: editForm.name,
      width: parseFloat(editForm.width) / 100, height: parseFloat(editForm.height) / 100, length: parseFloat(editForm.length) / 100,
      tareWeight: parseFloat(editForm.tareWeight), maxWeight: parseFloat(editForm.maxWeight),
      fragile: editForm.fragile, canBearWeight: editForm.canBearWeight,
      maxStackCount: parseInt(editForm.maxStackCount), allowedOrientations: editForm.allowedOrientations, color: editForm.color,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pallet-types"] });
      toast({ title: t.pallets.updated });
      setEditOpen(false);
      setEditingPallet(null);
    },
    onError: () => toast({ title: t.pallets.updateError, variant: "destructive" }),
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
          <Layers className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">{t.pallets.title}</h2>
          <Badge variant="secondary">{pallets.length}</Badge>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-pallet"><Plus className="w-4 h-4 mr-1" />{t.pallets.addPallet}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t.pallets.newPallet}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t.pallets.code}</Label><Input data-testid="input-pallet-code" value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="EUR-001" /></div>
                <div><Label>{t.pallets.name}</Label><Input data-testid="input-pallet-name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Europalete Standard" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>{t.products.length}</Label><Input type="number" step="1" value={form.length} onChange={e => setForm({...form, length: e.target.value})} /></div>
                <div><Label>{t.products.width}</Label><Input type="number" step="1" value={form.width} onChange={e => setForm({...form, width: e.target.value})} /></div>
                <div><Label>{t.products.height}</Label><Input type="number" step="1" value={form.height} onChange={e => setForm({...form, height: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t.pallets.tareWeight}</Label><Input type="number" step="0.1" value={form.tareWeight} onChange={e => setForm({...form, tareWeight: e.target.value})} /></div>
                <div><Label>{t.pallets.maxWeight}</Label><Input type="number" step="1" value={form.maxWeight} onChange={e => setForm({...form, maxWeight: e.target.value})} /></div>
              </div>
              <div><Label>{t.products.maxStackCount}</Label><Input type="number" min="1" value={form.maxStackCount} onChange={e => setForm({...form, maxStackCount: e.target.value})} /></div>
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
                <Label>{t.pallets.color}</Label>
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
              <Button data-testid="button-submit-pallet" onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.code || !form.name || !form.width || !form.height || !form.length}>
                {createMutation.isPending ? t.common.adding : t.common.add}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen && editingPallet !== null} onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingPallet(null);
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t.pallets.edit}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t.pallets.code}</Label><Input data-testid="input-edit-pallet-code" value={editForm.code} onChange={e => setEditForm({...editForm, code: e.target.value})} placeholder="EUR-001" /></div>
                <div><Label>{t.pallets.name}</Label><Input data-testid="input-edit-pallet-name" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="Europalete Standard" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>{t.products.length}</Label><Input type="number" step="1" value={editForm.length} onChange={e => setEditForm({...editForm, length: e.target.value})} /></div>
                <div><Label>{t.products.width}</Label><Input type="number" step="1" value={editForm.width} onChange={e => setEditForm({...editForm, width: e.target.value})} /></div>
                <div><Label>{t.products.height}</Label><Input type="number" step="1" value={editForm.height} onChange={e => setEditForm({...editForm, height: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t.pallets.tareWeight}</Label><Input type="number" step="0.1" value={editForm.tareWeight} onChange={e => setEditForm({...editForm, tareWeight: e.target.value})} /></div>
                <div><Label>{t.pallets.maxWeight}</Label><Input type="number" step="1" value={editForm.maxWeight} onChange={e => setEditForm({...editForm, maxWeight: e.target.value})} /></div>
              </div>
              <div><Label>{t.products.maxStackCount}</Label><Input type="number" min="1" value={editForm.maxStackCount} onChange={e => setEditForm({...editForm, maxStackCount: e.target.value})} /></div>
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
                <Label>{t.pallets.color}</Label>
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
              <Button data-testid="button-submit-edit-pallet" onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending || !editForm.code || !editForm.name || !editForm.width || !editForm.height || !editForm.length}>
                {editMutation.isPending ? t.products.saving : t.common.save}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : pallets.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">{t.pallets.noPallets}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>{t.pallets.code}</TableHead>
                  <TableHead>{t.pallets.name}</TableHead>
                  <TableHead>{t.common.dimensions}</TableHead>
                  <TableHead>{t.pallets.tareWeight}</TableHead>
                  <TableHead>{t.pallets.maxWeight}</TableHead>
                  <TableHead>{t.products.fragile}</TableHead>
                  <TableHead>{t.products.maxStackCount}</TableHead>
                  <TableHead>{t.products.orientations}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pallets.map(p => (
                  <TableRow key={p.id} data-testid={`pallet-row-${p.id}`}>
                    <TableCell><div className="w-4 h-4 rounded-sm" style={{ backgroundColor: p.color }} /></TableCell>
                    <TableCell className="font-mono text-sm">{p.code}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm">{formatDims(p.width, p.length, p.height)}</TableCell>
                    <TableCell className="text-sm">{p.tareWeight}kg</TableCell>
                    <TableCell className="text-sm">{p.maxWeight}kg</TableCell>
                    <TableCell>{p.fragile ? <ShieldAlert className="w-4 h-4 text-destructive" /> : "-"}</TableCell>
                    <TableCell className="text-sm">{p.maxStackCount}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {p.allowedOrientations.map(o => (
                          <Badge key={o} variant="outline" className="text-xs">{t.orientationLabels[o as keyof typeof t.orientationLabels] || o}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" data-testid={`button-edit-pallet-${p.id}`} onClick={() => { setEditingPallet(p); setEditOpen(true); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(p.id)}>
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
