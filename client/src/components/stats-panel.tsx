import { Card, CardContent } from "@/components/ui/card";
import { Package, Weight, Boxes } from "lucide-react";
import { useI18n } from "@/i18n";
import type { LoadPlanResult, CargoSpace } from "@/lib/types";

interface StatsPanelProps {
  result: LoadPlanResult | null;
  space: CargoSpace | null;
}

export default function StatsPanel({ result, space }: StatsPanelProps) {
  const { t } = useI18n();
  const totalWeight = result?.totalWeight ?? 0;
  const maxWeight = space?.maxWeight ?? 0;
  const totalItems = result?.totalItems ?? 0;
  const usedVolume = result?.usedVolume ?? 0;
  const spaceVolume = result?.spaceVolume ?? 0;

  return (
    <div className="grid grid-cols-3 gap-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Weight className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">{t.stats.totalWeight}</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-total-weight">{totalWeight.toLocaleString()} kg</p>
          <p className="text-xs text-muted-foreground mt-1">
            {maxWeight > 0 ? t.stats.maxWeight.replace("{max}", maxWeight.toLocaleString()) : t.stats.noLimit}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Boxes className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">{t.stats.itemsLoaded}</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-total-items">{totalItems}</p>
          <p className="text-xs text-muted-foreground mt-1">{t.stats.unitsPlaced}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">{t.stats.volume}</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-used-volume">{usedVolume.toFixed(1)} m³</p>
          <p className="text-xs text-muted-foreground mt-1">
            {spaceVolume > 0 ? t.stats.available.replace("{total}", spaceVolume.toFixed(1)) : ""}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
