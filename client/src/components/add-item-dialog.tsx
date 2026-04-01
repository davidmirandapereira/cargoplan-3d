import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export default function AddItemDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    width: "",
    height: "",
    length: "",
    weight: "",
    quantity: "1",
    color: COLORS[0],
    canStack: true,
    canTilt: true,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/cargo/items", {
        name: form.name,
        width: parseFloat(form.width),
        height: parseFloat(form.height),
        length: parseFloat(form.length),
        weight: parseFloat(form.weight),
        quantity: parseInt(form.quantity),
        color: form.color,
        canStack: form.canStack,
        canTilt: form.canTilt,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargo/items"] });
      toast({ title: "Item adicionado com sucesso" });
      setOpen(false);
      setForm({ name: "", width: "", height: "", length: "", weight: "", quantity: "1", color: COLORS[0], canStack: true, canTilt: true });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar item", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-add-item">
          <Plus className="w-4 h-4 mr-1" />
          Adicionar Item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Item de Carga</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label htmlFor="item-name">Nome</Label>
            <Input
              id="item-name"
              data-testid="input-item-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Caixa de cartão"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="item-width">Largura (m)</Label>
              <Input id="item-width" data-testid="input-item-width" type="number" step="0.01" value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <Label htmlFor="item-height">Altura (m)</Label>
              <Input id="item-height" data-testid="input-item-height" type="number" step="0.01" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <Label htmlFor="item-length">Comprimento (m)</Label>
              <Input id="item-length" data-testid="input-item-length" type="number" step="0.01" value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="item-weight">Peso (kg)</Label>
              <Input id="item-weight" data-testid="input-item-weight" type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="0.0" />
            </div>
            <div>
              <Label htmlFor="item-qty">Quantidade</Label>
              <Input id="item-qty" data-testid="input-item-quantity" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="1" />
            </div>
          </div>
          <div>
            <Label>Cor</Label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  data-testid={`button-color-${c}`}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-md border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch id="can-stack" data-testid="switch-can-stack" checked={form.canStack} onCheckedChange={(v) => setForm({ ...form, canStack: v })} />
              <Label htmlFor="can-stack">Empilhável</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="can-tilt" data-testid="switch-can-tilt" checked={form.canTilt} onCheckedChange={(v) => setForm({ ...form, canTilt: v })} />
              <Label htmlFor="can-tilt">Pode inclinar</Label>
            </div>
          </div>
          <Button
            data-testid="button-submit-item"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.name || !form.width || !form.height || !form.length || !form.weight}
          >
            {mutation.isPending ? "A adicionar..." : "Adicionar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
