export interface ProductFamily {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
}

export interface Product {
  id: number;
  code: string;
  name: string;
  description: string | null;
  width: number;
  height: number;
  length: number;
  weight: number;
  fragile: boolean;
  canBearWeight: boolean;
  maxStackCount: number;
  allowedOrientations: string[];
  color: string;
  createdAt: string;
}

export interface BoxType {
  id: number;
  code: string;
  name: string;
  width: number;
  height: number;
  length: number;
  emptyWeight: number;
  fragile: boolean;
  canBearWeight: boolean;
  maxStackCount: number;
  allowedOrientations: string[];
  color: string;
  createdAt: string;
}

export interface PalletType {
  id: number;
  code: string;
  name: string;
  width: number;
  height: number;
  length: number;
  tareWeight: number;
  maxWeight: number;
  fragile: boolean;
  canBearWeight: boolean;
  maxStackCount: number;
  allowedOrientations: string[];
  color: string;
  createdAt: string;
}

export interface CargoSpace {
  id: number;
  name: string;
  category: string;
  width: number;
  height: number;
  length: number;
  maxWeight: number;
  isPreset: boolean;
  createdAt: string;
}

export interface PlacedUnitResult {
  unitType: "pallet" | "box";
  unitId: number;
  name: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  length: number;
  weight: number;
  color: string;
  orientation: string;
  fragile: boolean;
  canBearWeight: boolean;
  maxStackCount: number;
  loadOrder: number;
}

export interface ContainerResult {
  space: CargoSpace;
  items: PlacedUnitResult[];
  efficiency: number;
  totalWeight: number;
  usedVolume: number;
  spaceVolume: number;
  totalItems: number;
  remainingWeight: number;
}

export interface LoadPlanResult {
  id: number;
  name: string;
  cargoSpaceId: number;
  efficiency: number;
  totalWeight: number;
  space: CargoSpace;
  items: PlacedUnitResult[];
  usedVolume: number;
  spaceVolume: number;
  totalItems: number;
  remainingWeight: number;
  totalRequested?: number;
  unplacedCount?: number;
  createdAt: string;
  containers?: ContainerResult[];
}

export interface LoadItem {
  type: "pallet" | "box" | "product";
  id: number;
  name: string;
  color: string;
  quantity: number;
  dimensions: string;
  instanceId?: string;
}
