import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Settings2, Palette, GripVertical } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import type { ProductFamily } from "@/lib/types";

const PRESET_COLORS = [
  "#3b82f6", "#2563eb", "#1d4ed8",
  "#d97706", "#b45309", "#92400e",
  "#6b7280", "#4b5563", "#374151",
  "#10b981", "#059669", "#047857",
  "#8b5cf6", "#7c3aed", "#6d28d9",
  "#ef4444", "#dc2626", "#b91c1c",
  "#ec4899", "#db2777", "#be185d",
  "#06b6d4", "#0891b2", "#0e7490",
  "#f59e0b", "#eab308", "#ca8a04",
  "#14b8a6", "#0d9488", "#0f766e",
];

export default function SettingsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<ProductFamily | null>(null);
  const [form, setForm] = useState({ name: "", color: "#3b82f6" });
  const [editForm, setEditForm] = useState({ name: "", color: "#3b82f6" });

  const { data: families = [], isLoading } = useQuery<ProductFamily[]>({
    queryKey: ["/api/product-families"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/product-families", {
      name: form.name, color: form.color, sortOrder: families.length,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/product-families"] });
      toast({ title: t.settings?.familyAdded || "Família adicionada" });
      setCreateOpen(false);
      setForm({ name: "", color: "#3b82f6" });
    },
    onError: () => toast({ title: t.settings?.error || "Erro", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: () => {
      if (!editingFamily) return Promise.reject();
      return apiRequest("PUT", `/api/product-families/${editingFamily.id}`, {
        name: editForm.name, color: editForm.color, sortOrder: editingFamily.sortOrder,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/product-families"] });
      toast({ title: t.settings?.familyUpdated || "Família atualizada" });
      setEditOpen(false);
      setEditingFamily(null);
    },
    onError: () => toast({ title: t.settings?.error || "Erro", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/product-families/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/product-families"] });
      toast({ title: t.settings?.familyDeleted || "Família eliminada" });
    },
  });

  const openEdit = (f: ProductFamily) => {
    setEditingFamily(f);
    setEditForm({ name: f.name, color: f.color });
    setEditOpen(true);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Settings2 className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold">{t.settings?.title || "Definições"}</h2>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">{t.settings?.productFamilies || "Famílias de Produto"}</CardTitle>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-family">
                  <Plus className="w-4 h-4 mr-1" />
                  {t.settings?.addFamily || "Adicionar"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{t.settings?.newFamily || "Nova Família de Produto"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div>
                    <Label>{t.settings?.familyName || "Nome"}</Label>
                    <Input
                      data-testid="input-family-name"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="Ex: Vidro / Aquários"
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">{t.settings?.familyColor || "Cor"}</Label>
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-lg border-2 border-border"
                        style={{ backgroundColor: form.color }}
                      />
                      <Input
                        data-testid="input-family-color-hex"
                        value={form.color}
                        onChange={e => setForm({ ...form, color: e.target.value })}
                        className="w-28 font-mono text-sm"
                        placeholder="#3b82f6"
                      />
                    </div>
                    <div className="grid grid-cols-10 gap-1.5">
                      {PRESET_COLORS.map(c => (
                        <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                          className={`w-7 h-7 rounded-md border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent hover:border-muted-foreground/40"}`}
                          style={{ backgroundColor: c }}
                          data-testid={`color-preset-${c}`}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    data-testid="button-submit-family"
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending || !form.name || !form.color}
                  >
                    {createMutation.isPending ? "A guardar..." : t.settings?.addFamily || "Adicionar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t.settings?.familiesDescription || "Defina as famílias de produto com nome e cor. Estas famílias são usadas ao criar produtos para identificação visual."}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-6">A carregar...</p>
          ) : families.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">{t.settings?.noFamilies || "Nenhuma família definida."}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t.settings?.familyColor || "Cor"}</TableHead>
                  <TableHead>{t.settings?.familyName || "Nome"}</TableHead>
                  <TableHead className="w-12">{t.settings?.familyColorCode || "Código"}</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {families.map(f => (
                  <TableRow key={f.id} data-testid={`family-row-${f.id}`}>
                    <TableCell>
                      <div className="w-8 h-8 rounded-md border border-border" style={{ backgroundColor: f.color }} />
                    </TableCell>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{f.color}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(f)} data-testid={`button-edit-family-${f.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(f.id)} data-testid={`button-delete-family-${f.id}`}>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.settings?.editFamily || "Editar Família"}</DialogTitle>
          </DialogHeader>
          {editingFamily && (
            <div className="grid gap-4 py-2">
              <div>
                <Label>{t.settings?.familyName || "Nome"}</Label>
                <Input
                  data-testid="input-edit-family-name"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-2 block">{t.settings?.familyColor || "Cor"}</Label>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg border-2 border-border"
                    style={{ backgroundColor: editForm.color }}
                  />
                  <Input
                    data-testid="input-edit-family-color-hex"
                    value={editForm.color}
                    onChange={e => setEditForm({ ...editForm, color: e.target.value })}
                    className="w-28 font-mono text-sm"
                    placeholder="#3b82f6"
                  />
                </div>
                <div className="grid grid-cols-10 gap-1.5">
                  {PRESET_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setEditForm({ ...editForm, color: c })}
                      className={`w-7 h-7 rounded-md border-2 transition-all ${editForm.color === c ? "border-foreground scale-110" : "border-transparent hover:border-muted-foreground/40"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <Button
                data-testid="button-submit-edit-family"
                onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending || !editForm.name || !editForm.color}
              >
                {editMutation.isPending ? "A guardar..." : t.common?.save || "Guardar"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
