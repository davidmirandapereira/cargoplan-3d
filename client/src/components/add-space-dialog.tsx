import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";

export default function AddSpaceDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [form, setForm] = useState({ name: "", width: "", height: "", length: "", maxWeight: "" });

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/cargo/spaces", {
      name: form.name, width: parseFloat(form.width) / 100, height: parseFloat(form.height) / 100,
      length: parseFloat(form.length) / 100, maxWeight: parseFloat(form.maxWeight),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargo/spaces"] });
      toast({ title: t.spaces.added });
      setOpen(false);
      setForm({ name: "", width: "", height: "", length: "", maxWeight: "" });
    },
    onError: () => toast({ title: t.spaces.error, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" data-testid="button-add-space"><Plus className="w-4 h-4 mr-1" />{t.spaces.addSpace}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t.spaces.newSpace}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div><Label>{t.spaces.name}</Label><Input data-testid="input-space-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>{t.spaces.length}</Label><Input data-testid="input-space-length" type="number" step="1" value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} /></div>
            <div><Label>{t.spaces.width}</Label><Input data-testid="input-space-width" type="number" step="1" value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} /></div>
            <div><Label>{t.spaces.height}</Label><Input data-testid="input-space-height" type="number" step="1" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} /></div>
          </div>
          <div><Label>{t.spaces.maxWeight}</Label><Input data-testid="input-space-max-weight" type="number" value={form.maxWeight} onChange={(e) => setForm({ ...form, maxWeight: e.target.value })} /></div>
          <Button data-testid="button-submit-space" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name || !form.width || !form.height || !form.length || !form.maxWeight}>
            {mutation.isPending ? t.common.adding : t.common.add}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
