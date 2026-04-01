import { useState, useMemo } from "react";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, AlertTriangle, Ban, ChevronDown, ChevronUp, Layers, ArrowDown, MapPin } from "lucide-react";
import type { CargoSpace, PlacedUnitResult, LoadPlanResult } from "@/lib/types";

interface LoadingReportProps {
  space: CargoSpace | null;
  items: PlacedUnitResult[];
  result: LoadPlanResult | null;
}

function fmtCm(m: number) {
  return `${Math.round(m * 100)} cm`;
}

function formatDimsCm(w: number, l: number, h: number) {
  return `${fmtCm(l)} × ${fmtCm(w)} × ${fmtCm(h)}`;
}

interface SortedItem extends PlacedUnitResult {
  loadOrder: number;
  zoneLabel: string;
  zonePriority: number;
  positionDesc: string;
  stackInfo: string | null;
  supportItemIndex: number | null;
}

function MiniZoneSVG({ space, zoneItems, allItemsUpToZone }: { space: CargoSpace; zoneItems: SortedItem[]; allItemsUpToZone: SortedItem[] }) {
  const w = 200, h = 130, pad = 8;
  const drawW = w - pad * 2;
  const drawH = h - pad * 2;
  const scale = Math.min(drawW / space.width, drawH / space.length);
  const boxW = space.width * scale;
  const boxH = space.length * scale;
  const offX = pad + (drawW - boxW) / 2;
  const offY = pad + (drawH - boxH) / 2;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[200px] border rounded bg-slate-50" data-testid="mini-zone-svg">
      <rect x={offX} y={offY} width={boxW} height={boxH} fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" rx="1" />
      <line x1={offX} y1={offY} x2={offX + boxW} y2={offY} stroke="#ef4444" strokeWidth="2" />
      <text x={offX + boxW / 2} y={offY - 4} textAnchor="middle" fontSize="7" fill="#ef4444" fontWeight="600">PORTA</text>
      {allItemsUpToZone.map((item, i) => {
        const isCurrentZone = zoneItems.some(zi => zi.loadOrder === item.loadOrder);
        const ix = offX + item.x * scale;
        const iz = offY + item.z * scale;
        const iw = item.width * scale;
        const il = item.length * scale;
        return (
          <g key={i}>
            <rect x={ix + 0.5} y={iz + 0.5} width={Math.max(iw - 1, 1)} height={Math.max(il - 1, 1)} fill={item.color} fillOpacity={isCurrentZone ? 0.8 : 0.15} stroke={item.color} strokeWidth={isCurrentZone ? 1.5 : 0.5} strokeOpacity={isCurrentZone ? 0.9 : 0.2} rx="0.5" />
            {isCurrentZone && iw > 8 && il > 8 && (
              <text x={ix + iw / 2} y={iz + il / 2 + 3} textAnchor="middle" fontSize={Math.min(9, Math.min(iw, il) * 0.6)} fill="white" fontWeight="700" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}>
                {item.loadOrder}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function LoadingReport({ space, items, result }: LoadingReportProps) {
  const { t } = useI18n();
  const [expandedZones, setExpandedZones] = useState<Set<number>>(new Set([0]));

  const reportData = useMemo(() => {
    if (!items.length || !space) return { sortedItems: [], zones: [] };

    const sorted = items.slice().sort((a, b) => (a.loadOrder || 0) - (b.loadOrder || 0));

    const spaceThird = space.length / 3;

    const sortedItems: SortedItem[] = sorted.map((item) => {
      const zCenter = item.z + item.length / 2;
      const xCenter = item.x + item.width / 2;

      let zonePriority: number;
      let zoneLabel: string;
      if (zCenter >= spaceThird * 2) {
        zonePriority = 0;
        zoneLabel = (t.report as any).zoneBack || "Back Zone";
      } else if (zCenter >= spaceThird) {
        zonePriority = 1;
        zoneLabel = (t.report as any).zoneMiddle || "Middle Zone";
      } else {
        zonePriority = 2;
        zoneLabel = (t.report as any).zoneFront || "Door Zone";
      }

      const xSide = xCenter < space.width / 3
        ? ((t.report as any).leftSide || "Left")
        : xCenter > space.width * 2 / 3
          ? ((t.report as any).rightSide || "Right")
          : ((t.report as any).center || "Center");

      let positionDesc: string;
      if (item.y < 0.005) {
        positionDesc = `${(t.report as any).floor || "Floor"}, ${xSide}`;
      } else {
        positionDesc = `${fmtCm(item.y)} alt., ${xSide}`;
      }

      let stackInfo: string | null = null;
      let supportItemIndex: number | null = null;
      if (item.y > 0.005) {
        for (let si = 0; si < sorted.length; si++) {
          const below = sorted[si];
          if (below === item) continue;
          const topOfBelow = below.y + below.height;
          if (Math.abs(item.y - topOfBelow) < 0.02) {
            const overlapX = Math.max(0, Math.min(item.x + item.width, below.x + below.width) - Math.max(item.x, below.x));
            const overlapZ = Math.max(0, Math.min(item.z + item.length, below.z + below.length) - Math.max(item.z, below.z));
            if (overlapX > 0.01 && overlapZ > 0.01) {
              supportItemIndex = si;
              const template = (t.report as any).stackedOn || "stacked on #{num}";
              stackInfo = template.replace("{num}", String(below.loadOrder || si + 1));
              break;
            }
          }
        }
      }

      return {
        ...item,
        loadOrder: item.loadOrder || 0,
        zoneLabel,
        zonePriority,
        positionDesc,
        stackInfo,
        supportItemIndex,
      };
    });

    const zoneMap = new Map<number, SortedItem[]>();
    for (const item of sortedItems) {
      if (!zoneMap.has(item.zonePriority)) zoneMap.set(item.zonePriority, []);
      zoneMap.get(item.zonePriority)!.push(item);
    }

    const zones = Array.from(zoneMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([priority, zItems]) => ({
        priority,
        label: zItems[0].zoneLabel,
        items: zItems,
      }));

    return { sortedItems, zones };
  }, [items, space, t]);

  if (!result || !space || items.length === 0) return null;

  const totalWeight = items.reduce((sum, it) => sum + it.weight, 0);

  const handlePrint = () => {
    window.print();
  };

  const getOrientationLabel = (orientation: string) => {
    return (t.orientationLabels as Record<string, string>)[orientation] || orientation;
  };

  const toggleZone = (idx: number) => {
    setExpandedZones(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const zoneColors = ["#16a34a", "#f59e0b", "#ef4444"];
  const zoneIcons = ["bg-green-100 text-green-700", "bg-amber-100 text-amber-700", "bg-red-100 text-red-700"];

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-report, .print-report * { visibility: visible; }
          .print-report { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <Card className="print-report" data-testid="loading-report">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base" data-testid="report-title">{t.report.title}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="no-print"
              onClick={handlePrint}
              data-testid="button-print-report"
            >
              <Printer className="w-4 h-4 mr-1" />
              {t.report.printReport}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-md p-3 space-y-1" data-testid="report-space-info">
            <p className="text-sm font-semibold" data-testid="report-space-name">{space.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatDimsCm(space.width, space.length, space.height)} · {space.maxWeight?.toLocaleString()} kg
            </p>
          </div>

          <div className="border rounded-md p-3 grid grid-cols-4 gap-3 text-center" data-testid="report-summary">
            <div>
              <p className="text-lg font-bold" data-testid="report-total-items">{items.length}</p>
              <p className="text-xs text-muted-foreground">{t.stats.itemsLoaded}</p>
            </div>
            <div>
              <p className="text-lg font-bold" data-testid="report-total-weight">{totalWeight.toFixed(1)} kg</p>
              <p className="text-xs text-muted-foreground">{t.stats.totalWeight}</p>
            </div>
            <div>
              <p className="text-lg font-bold" data-testid="report-efficiency">{result.efficiency.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">{t.stats.efficiency}</p>
            </div>
            <div>
              <p className="text-lg font-bold" data-testid="report-zones">{reportData.zones.length}</p>
              <p className="text-xs text-muted-foreground">Zonas</p>
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-md p-3 flex items-start gap-2" data-testid="report-practical-note">
            <ArrowDown className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-primary">{(t.report as any).loadingOrder || "Loading Order"}</p>
              <p className="text-xs text-muted-foreground">{(t.report as any).practicalNote || "Load in the order shown — from back to door, bottom to top"}</p>
            </div>
          </div>

          <p className="text-sm font-semibold" data-testid="report-step-by-step-title">{t.report.stepByStep}</p>

          <div className="space-y-3">
            {reportData.zones.map((zone, zoneIdx) => {
              const isExpanded = expandedZones.has(zoneIdx);
              const allItemsUpTo = reportData.sortedItems.filter(it => {
                const zonesUpTo = reportData.zones.slice(0, zoneIdx + 1);
                return zonesUpTo.some(z => z.items.some(zi => zi.loadOrder === it.loadOrder));
              });

              return (
                <div key={zoneIdx} className="border rounded-lg overflow-hidden" data-testid={`report-zone-${zoneIdx + 1}`}>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
                    onClick={() => toggleZone(zoneIdx)}
                    data-testid={`button-toggle-zone-${zoneIdx + 1}`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${zoneIcons[zone.priority] || zoneIcons[0]}`}>
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-semibold" style={{ color: zoneColors[zone.priority] }}>
                        {zone.label}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({((t.report as any).zoneItems || "{count} items").replace("{count}", String(zone.items.length))})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        #{zone.items[0].loadOrder}–{zone.items[zone.items.length - 1].loadOrder}
                      </Badge>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-3 space-y-3">
                      <div className="flex justify-center">
                        <MiniZoneSVG space={space} zoneItems={zone.items} allItemsUpToZone={allItemsUpTo} />
                      </div>

                      <div className="space-y-2">
                        {zone.items.map((item) => (
                          <div key={item.loadOrder} className="flex items-start gap-3 p-2 rounded-md bg-muted/30" data-testid={`report-step-${item.loadOrder}`}>
                            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: item.color }} data-testid={`report-step-number-${item.loadOrder}`}>
                              {item.loadOrder}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium" data-testid={`report-item-name-${item.loadOrder}`}>{item.name}</span>
                                <Badge variant="outline" className="text-[10px]" data-testid={`report-item-type-${item.loadOrder}`}>
                                  {item.unitType === "pallet" ? t.table.pallet : t.table.box}
                                </Badge>
                                {item.fragile && (
                                  <Badge variant="destructive" className="text-[10px] gap-0.5" data-testid={`report-fragile-${item.loadOrder}`}>
                                    <AlertTriangle className="w-3 h-3" />
                                    {t.table.fragile}
                                  </Badge>
                                )}
                                {!item.canBearWeight && (
                                  <Badge variant="secondary" className="text-[10px] gap-0.5" data-testid={`report-no-stack-${item.loadOrder}`}>
                                    <Ban className="w-3 h-3" />
                                    {t.report.noStackWarning}
                                  </Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <div data-testid={`report-position-${item.loadOrder}`}>
                                  <span className="font-medium text-foreground">{t.report.atPosition}: </span>
                                  {item.positionDesc}
                                </div>
                                <div data-testid={`report-dimensions-${item.loadOrder}`}>
                                  <span className="font-medium text-foreground">{t.common.dimensions}: </span>
                                  {formatDimsCm(item.width, item.length, item.height)}
                                </div>
                                <div data-testid={`report-weight-${item.loadOrder}`}>
                                  <span className="font-medium text-foreground">{t.table.weight}: </span>
                                  {item.weight} kg
                                </div>
                                <div data-testid={`report-orientation-${item.loadOrder}`}>
                                  <span className="font-medium text-foreground">{t.table.orientation}: </span>
                                  {getOrientationLabel(item.orientation)}
                                </div>
                              </div>
                              {item.stackInfo && (
                                <div className="flex items-center gap-1 text-xs text-amber-600">
                                  <Layers className="w-3 h-3" />
                                  <span>{item.stackInfo}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-center text-muted-foreground pt-2" data-testid="report-generated-by">
            {t.report.generatedBy}
          </p>
        </CardContent>
      </Card>
    </>
  );
}
