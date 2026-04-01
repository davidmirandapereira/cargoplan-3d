import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import type { CargoSpace, PlacedUnitResult } from "@/lib/types";
import { Scale, Crosshair, Truck } from "lucide-react";

interface WeightDistributionProps {
  space: CargoSpace | null;
  items: PlacedUnitResult[];
}

function getBalanceColor(pct: number): string {
  if (pct >= 45 && pct <= 55) return "bg-green-500";
  if ((pct >= 35 && pct < 45) || (pct > 55 && pct <= 65)) return "bg-yellow-500";
  return "bg-red-500";
}

function getBalanceLabel(pct: number, t: any): string {
  if (pct >= 45 && pct <= 55) return t.weight.balanced;
  if ((pct >= 35 && pct < 45) || (pct > 55 && pct <= 65)) return t.weight.slightlyOff;
  return t.weight.unbalanced;
}

function getBalanceTextColor(pct: number): string {
  if (pct >= 45 && pct <= 55) return "text-green-600";
  if ((pct >= 35 && pct < 45) || (pct > 55 && pct <= 65)) return "text-yellow-600";
  return "text-red-600";
}

export default function WeightDistribution({ space, items }: WeightDistributionProps) {
  const { t } = useI18n();

  const calculations = useMemo(() => {
    if (!space || items.length === 0) return null;

    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight === 0) return null;

    const centerX = space.width / 2;
    const centerZ = space.length / 2;

    let leftWeight = 0;
    let rightWeight = 0;
    let frontWeight = 0;
    let backWeight = 0;
    let cogX = 0;
    let cogY = 0;
    let cogZ = 0;

    for (const item of items) {
      const itemCenterX = item.x + item.width / 2;
      const itemCenterY = item.y + item.height / 2;
      const itemCenterZ = item.z + item.length / 2;

      cogX += itemCenterX * item.weight;
      cogY += itemCenterY * item.weight;
      cogZ += itemCenterZ * item.weight;

      if (itemCenterX <= centerX) {
        leftWeight += item.weight;
      } else {
        rightWeight += item.weight;
      }

      if (itemCenterZ <= centerZ) {
        frontWeight += item.weight;
      } else {
        backWeight += item.weight;
      }
    }

    cogX /= totalWeight;
    cogY /= totalWeight;
    cogZ /= totalWeight;

    const leftPct = totalWeight > 0 ? (leftWeight / totalWeight) * 100 : 50;
    const rightPct = 100 - leftPct;
    const frontPct = totalWeight > 0 ? (frontWeight / totalWeight) * 100 : 50;
    const backPct = 100 - frontPct;

    const cogInRange =
      cogX >= space.width / 3 && cogX <= (2 * space.width) / 3 &&
      cogY >= space.height / 3 && cogY <= (2 * space.height) / 3 &&
      cogZ >= space.length / 3 && cogZ <= (2 * space.length) / 3;

    const frontAxleLoad = frontWeight;
    const rearAxleLoad = backWeight;

    return {
      leftPct,
      rightPct,
      frontPct,
      backPct,
      cogX,
      cogY,
      cogZ,
      cogInRange,
      totalWeight,
      frontAxleLoad,
      rearAxleLoad,
      isTruck: space.category === "truck",
    };
  }, [space, items]);

  if (!calculations) return null;

  const {
    leftPct, rightPct, frontPct, backPct,
    cogX, cogY, cogZ, cogInRange,
    totalWeight, frontAxleLoad, rearAxleLoad, isTruck,
  } = calculations;

  return (
    <Card data-testid="weight-distribution-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" />
          {t.weight.distribution}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div data-testid="weight-left-right">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">{t.weight.leftRight}</span>
            <span className={`text-xs font-medium ${getBalanceTextColor(leftPct)}`}>
              {getBalanceLabel(leftPct, t)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold w-12 text-right" data-testid="text-left-pct">
              {leftPct.toFixed(1)}%
            </span>
            <div className="flex-1 flex h-3 rounded-full overflow-hidden bg-muted">
              <div
                className={`h-full transition-all duration-500 ${getBalanceColor(leftPct)}`}
                style={{ width: `${leftPct}%` }}
                data-testid="bar-left-weight"
              />
              <div
                className={`h-full transition-all duration-500 ${getBalanceColor(rightPct)}`}
                style={{ width: `${rightPct}%`, opacity: 0.6 }}
                data-testid="bar-right-weight"
              />
            </div>
            <span className="text-xs font-bold w-12" data-testid="text-right-pct">
              {rightPct.toFixed(1)}%
            </span>
          </div>
        </div>

        <div data-testid="weight-front-back">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">{t.weight.frontBack}</span>
            <span className={`text-xs font-medium ${getBalanceTextColor(frontPct)}`}>
              {getBalanceLabel(frontPct, t)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold w-12 text-right" data-testid="text-front-pct">
              {frontPct.toFixed(1)}%
            </span>
            <div className="flex-1 flex h-3 rounded-full overflow-hidden bg-muted">
              <div
                className={`h-full transition-all duration-500 ${getBalanceColor(frontPct)}`}
                style={{ width: `${frontPct}%` }}
                data-testid="bar-front-weight"
              />
              <div
                className={`h-full transition-all duration-500 ${getBalanceColor(backPct)}`}
                style={{ width: `${backPct}%`, opacity: 0.6 }}
                data-testid="bar-back-weight"
              />
            </div>
            <span className="text-xs font-bold w-12" data-testid="text-back-pct">
              {backPct.toFixed(1)}%
            </span>
          </div>
        </div>

        <div data-testid="weight-center-of-gravity" className="border-t pt-3">
          <div className="flex items-center gap-2 mb-2">
            <Crosshair className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">{t.weight.centerOfGravity}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-mono" data-testid="text-cog-x">
              X: {(cogX * 100).toFixed(0)} cm
            </span>
            <span className="text-xs font-mono" data-testid="text-cog-y">
              Y: {(cogY * 100).toFixed(0)} cm
            </span>
            <span className="text-xs font-mono" data-testid="text-cog-z">
              Z: {(cogZ * 100).toFixed(0)} cm
            </span>
            <span
              className={`text-xs font-medium ml-auto ${cogInRange ? "text-green-600" : "text-red-600"}`}
              data-testid="text-cog-status"
            >
              {cogInRange ? t.weight.balanced : t.weight.unbalanced}
            </span>
          </div>
        </div>

        {isTruck && (
          <div data-testid="weight-axle-load" className="border-t pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{t.weight.axleLoad}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div data-testid="axle-front">
                <p className="text-[10px] text-muted-foreground">{t.weight.frontAxle}</p>
                <p className="text-sm font-bold" data-testid="text-front-axle-load">
                  {frontAxleLoad.toLocaleString()} kg
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {totalWeight > 0 ? `${((frontAxleLoad / totalWeight) * 100).toFixed(1)}%` : "0%"}
                </p>
              </div>
              <div data-testid="axle-rear">
                <p className="text-[10px] text-muted-foreground">{t.weight.rearAxle}</p>
                <p className="text-sm font-bold" data-testid="text-rear-axle-load">
                  {rearAxleLoad.toLocaleString()} kg
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {totalWeight > 0 ? `${((rearAxleLoad / totalWeight) * 100).toFixed(1)}%` : "0%"}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
