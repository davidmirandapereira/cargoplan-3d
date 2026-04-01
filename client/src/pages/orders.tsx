import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Trash2, Eye, Package, Layers, BoxIcon, Truck, Container, Calendar, Weight, BarChart3, Printer, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";

interface Order {
  id: number;
  orderNumber: string;
  name: string;
  cargoSpaceName: string;
  status: string;
  efficiency: number | null;
  totalWeight: number | null;
  totalVolume: number | null;
  itemCount: number | null;
  dossier: any;
  createdAt: string;
}

export default function OrdersPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { data: orders = [], isLoading } = useQuery<Order[]>({ queryKey: ["/api/orders"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: t.orders?.deleted || "Order deleted" });
    },
  });

  const printDossier = (order: Order) => {
    const w = window.open("", "_blank");
    if (!w) return;
    const d = order.dossier;
    w.document.write(`
      <html><head><title>${order.orderNumber} - ${order.name}</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; color: #1a1a1a; }
        h1 { font-size: 24px; border-bottom: 3px solid #f59e0b; padding-bottom: 8px; }
        h2 { font-size: 18px; color: #333; margin-top: 24px; }
        .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
        .meta-item { background: #f5f5f5; padding: 12px; border-radius: 8px; }
        .meta-label { font-size: 11px; color: #666; text-transform: uppercase; }
        .meta-value { font-size: 18px; font-weight: bold; color: #1a1a1a; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th { background: #f5f5f5; text-align: left; padding: 8px; font-size: 12px; border-bottom: 2px solid #ddd; }
        td { padding: 8px; border-bottom: 1px solid #eee; font-size: 13px; }
        .color-dot { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 6px; vertical-align: middle; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .badge-pallet { background: #fef3c7; color: #92400e; }
        .badge-box { background: #dbeafe; color: #1e40af; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #999; text-align: center; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>CargoPlan 3D - ${t.orders?.dossier || "Dossier"}</h1>
      <p><strong>${order.orderNumber}</strong> — ${order.name}</p>
      <p style="color:#666;font-size:13px;">${new Date(order.createdAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
      
      <div class="meta">
        <div class="meta-item"><div class="meta-label">${t.orders?.cargoSpace || "Cargo Space"}</div><div class="meta-value">${order.cargoSpaceName}</div></div>
        <div class="meta-item"><div class="meta-label">${t.stats?.efficiency || "Efficiency"}</div><div class="meta-value">${order.efficiency?.toFixed(1) || "—"}%</div></div>
        <div class="meta-item"><div class="meta-label">${t.stats?.totalWeight || "Total Weight"}</div><div class="meta-value">${order.totalWeight?.toFixed(1) || "—"} kg</div></div>
      </div>

      ${d?.items?.length ? `
        <h2>${t.planning?.loadSequence || "Loading Sequence"}</h2>
        <table>
          <thead><tr><th>#</th><th>${t.table?.item || "Item"}</th><th>${t.table?.type || "Type"}</th><th>${t.table?.position || "Position"}</th><th>${t.table?.dimensions || "Dimensions"}</th><th>${t.table?.weight || "Weight"}</th></tr></thead>
          <tbody>
            ${d.items.sort((a: any, b: any) => a.z - b.z || a.x - b.x || a.y - b.y).map((item: any, i: number) => `
              <tr>
                <td>${i + 1}</td>
                <td><span class="color-dot" style="background:${item.color}"></span>${item.name}</td>
                <td><span class="badge ${item.unitType === "pallet" ? "badge-pallet" : "badge-box"}">${item.unitType === "pallet" ? (t.table?.pallet || "Pallet") : (t.table?.box || "Box")}</span></td>
                <td>${item.x?.toFixed(2)}, ${item.y?.toFixed(2)}, ${item.z?.toFixed(2)}</td>
                <td>${Math.round(Math.max(item.width, item.length) * 100)} × ${Math.round(Math.min(item.width, item.length) * 100)} × ${Math.round(item.height * 100)} cm</td>
                <td>${item.weight?.toFixed(1)} kg</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : ""}
      
      <div class="footer">${t.report?.generatedBy || "Generated by CargoPlan 3D"} — ${new Date().toLocaleDateString("pt-PT")}</div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  if (selectedOrder) {
    const d = selectedOrder.dossier;
    const items = d?.items || [];
    return (
      <div className="p-4 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)} data-testid="button-back-orders">
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t.orders?.backToList || "Back"}
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2" data-testid="text-order-number">
              <FileText className="w-5 h-5 text-primary" />
              {selectedOrder.orderNumber}
            </h1>
            <p className="text-sm text-muted-foreground">{selectedOrder.name}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => printDossier(selectedOrder)} data-testid="button-print-dossier">
            <Printer className="w-4 h-4 mr-1" />
            {t.orders?.printDossier || "Print"}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">{t.orders?.cargoSpace || "Cargo Space"}</p>
              <p className="text-sm font-bold mt-1" data-testid="text-order-space">{selectedOrder.cargoSpaceName}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">{t.stats?.efficiency || "Efficiency"}</p>
              <p className="text-lg font-bold text-primary mt-1" data-testid="text-order-efficiency">{selectedOrder.efficiency?.toFixed(1) || "—"}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">{t.stats?.totalWeight || "Total Weight"}</p>
              <p className="text-lg font-bold mt-1" data-testid="text-order-weight">{selectedOrder.totalWeight?.toFixed(1) || "—"} kg</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">{t.stats?.itemsLoaded || "Items Loaded"}</p>
              <p className="text-lg font-bold mt-1" data-testid="text-order-items">{selectedOrder.itemCount || items.length}</p>
            </CardContent>
          </Card>
        </div>

        {items.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t.planning?.loadSequence || "Loading Sequence"}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-10">#</TableHead>
                    <TableHead className="text-xs">{t.table?.item || "Item"}</TableHead>
                    <TableHead className="text-xs">{t.table?.type || "Type"}</TableHead>
                    <TableHead className="text-xs">{t.table?.position || "Position"}</TableHead>
                    <TableHead className="text-xs">{t.table?.dimensions || "Dimensions"}</TableHead>
                    <TableHead className="text-xs">{t.table?.weight || "Weight"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items
                    .sort((a: any, b: any) => a.z - b.z || a.x - b.x || a.y - b.y)
                    .map((item: any, i: number) => (
                    <TableRow key={i} data-testid={`row-order-item-${i}`}>
                      <TableCell className="py-1 text-xs font-bold text-center">{i + 1}</TableCell>
                      <TableCell className="py-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                          <span className="text-xs font-medium">{item.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-1">
                        <Badge variant="outline" className="text-[10px] px-1">
                          {item.unitType === "pallet" ? (t.table?.pallet || "Pallet") : (t.table?.box || "Box")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs py-1">{item.x?.toFixed(2)}, {item.y?.toFixed(2)}, {item.z?.toFixed(2)}</TableCell>
                      <TableCell className="text-xs py-1">
                        {Math.round(Math.max(item.width, item.length) * 100)} × {Math.round(Math.min(item.width, item.length) * 100)} × {Math.round(item.height * 100)} cm
                      </TableCell>
                      <TableCell className="text-xs py-1">{item.weight?.toFixed(1)} kg</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">{t.orders?.createdAt || "Created at"}</p>
            <p className="text-sm mt-1">
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              {new Date(selectedOrder.createdAt).toLocaleDateString("pt-PT", {
                day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
              })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-orders-title">
          <FileText className="w-5 h-5 text-primary" />
          {t.orders?.title || "Order History"}
        </h1>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">{t.common?.loading || "Loading..."}</div>
      )}

      {!isLoading && orders.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground" data-testid="text-no-orders">{t.orders?.noOrders || "No orders saved yet."}</p>
            <p className="text-sm text-muted-foreground/60 mt-1">{t.orders?.noOrdersHint || "Calculate a load plan and save it to create your first order."}</p>
          </CardContent>
        </Card>
      )}

      {orders.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t.orders?.orderNum || "Order #"}</TableHead>
                  <TableHead className="text-xs">{t.orders?.orderName || "Name"}</TableHead>
                  <TableHead className="text-xs">{t.orders?.cargoSpace || "Cargo Space"}</TableHead>
                  <TableHead className="text-xs text-center">{t.stats?.efficiency || "Efficiency"}</TableHead>
                  <TableHead className="text-xs text-center">{t.stats?.totalWeight || "Weight"}</TableHead>
                  <TableHead className="text-xs text-center">{t.stats?.itemsLoaded || "Items"}</TableHead>
                  <TableHead className="text-xs">{t.orders?.date || "Date"}</TableHead>
                  <TableHead className="text-xs w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                    <TableCell className="py-2 text-xs font-mono font-bold text-primary" data-testid={`text-order-num-${order.id}`}>
                      {order.orderNumber}
                    </TableCell>
                    <TableCell className="py-2 text-sm font-medium">{order.name}</TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">{order.cargoSpaceName}</TableCell>
                    <TableCell className="py-2 text-center">
                      <Badge variant={order.efficiency && order.efficiency >= 75 ? "default" : "secondary"} className="text-[10px]">
                        {order.efficiency?.toFixed(1) || "—"}%
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-xs text-center">{order.totalWeight?.toFixed(0) || "—"} kg</TableCell>
                    <TableCell className="py-2 text-xs text-center">{order.itemCount || "—"}</TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("pt-PT")}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedOrder(order)} data-testid={`button-view-order-${order.id}`}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => printDossier(order)} data-testid={`button-print-order-${order.id}`}>
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                          if (confirm(t.orders?.confirmDelete || "Delete this order?")) deleteMutation.mutate(order.id);
                        }} data-testid={`button-delete-order-${order.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
