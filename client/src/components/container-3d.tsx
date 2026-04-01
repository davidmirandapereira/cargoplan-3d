import { Component, useRef, useState, useCallback, useMemo, useEffect, Suspense } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Canvas, useThree, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Grid, Html, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { useI18n } from "@/i18n";
import { Maximize2, Minimize2, RotateCcw } from "lucide-react";
import type { CargoSpace, PlacedUnitResult } from "@/lib/types";

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

class WebGLErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onError?: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode; onError?: () => void }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.warn("WebGL rendering failed, using fallback:", error.message);
    this.props.onError?.();
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

interface Container3DProps {
  space: CargoSpace | null;
  items: PlacedUnitResult[];
  isPallet?: boolean;
}

interface HoveredItem {
  item: PlacedUnitResult;
  point: THREE.Vector3;
}

function PalletBase({ space, offset }: { space: CargoSpace; offset: [number, number, number] }) {
  const boardThickness = 0.02;
  const blockHeight = 0.10;
  const boardColor = "#c4a46c";
  const blockColor = "#a08050";

  const topBoards = useMemo(() => {
    const boards: Array<{ x: number; z: number; w: number; l: number }> = [];
    const boardCount = 5;
    const gap = space.width / boardCount;
    for (let i = 0; i < boardCount; i++) {
      boards.push({
        x: i * gap + gap * 0.05,
        z: 0,
        w: gap * 0.9,
        l: space.length,
      });
    }
    return boards;
  }, [space.width, space.length]);

  const supportBlocks = useMemo(() => {
    const blocks: Array<{ x: number; z: number }> = [];
    const bw = space.width * 0.12;
    const bl = space.length * 0.12;
    const positions = [
      [bw / 2, bl / 2],
      [space.width / 2, bl / 2],
      [space.width - bw / 2, bl / 2],
      [bw / 2, space.length / 2],
      [space.width / 2, space.length / 2],
      [space.width - bw / 2, space.length / 2],
      [bw / 2, space.length - bl / 2],
      [space.width / 2, space.length - bl / 2],
      [space.width - bw / 2, space.length - bl / 2],
    ];
    for (const [x, z] of positions) {
      blocks.push({ x, z });
    }
    return { blocks, bw, bl };
  }, [space.width, space.length]);

  return (
    <group position={[offset[0], offset[1] - boardThickness - blockHeight, offset[2]]}>
      {supportBlocks.blocks.map((block, i) => (
        <mesh key={`block-${i}`} position={[block.x, blockHeight / 2, block.z]} castShadow receiveShadow>
          <boxGeometry args={[supportBlocks.bw, blockHeight, supportBlocks.bl]} />
          <meshStandardMaterial color={blockColor} roughness={0.8} />
        </mesh>
      ))}
      {topBoards.map((board, i) => (
        <mesh key={`board-${i}`} position={[board.x + board.w / 2, blockHeight + boardThickness / 2, board.z + board.l / 2]} castShadow receiveShadow>
          <boxGeometry args={[board.w, boardThickness, board.l]} />
          <meshStandardMaterial color={boardColor} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[space.width / 2, blockHeight + boardThickness + 0.001, space.length / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[space.width, space.length]} />
        <meshStandardMaterial color="#d4b88c" roughness={0.9} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

function CargoBox({
  item,
  offset,
  isHovered,
  onHover,
  onUnhover,
  label,
}: {
  item: PlacedUnitResult;
  offset: [number, number, number];
  isHovered: boolean;
  onHover: (item: PlacedUnitResult, point: THREE.Vector3) => void;
  onUnhover: () => void;
  label: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);

  const position: [number, number, number] = [
    item.x + item.width / 2 + offset[0],
    item.y + item.height / 2 + offset[1],
    item.z + item.length / 2 + offset[2],
  ];

  const size: [number, number, number] = [item.width, item.height, item.length];

  const color = useMemo(() => new THREE.Color(item.color), [item.color]);
  const hoverColor = useMemo(() => {
    const c = new THREE.Color(item.color);
    c.offsetHSL(0, 0, 0.15);
    return c;
  }, [item.color]);

  const darkerColor = useMemo(() => {
    const c = new THREE.Color(item.color);
    c.offsetHSL(0, 0, -0.25);
    return c;
  }, [item.color]);

  const geometry = useMemo(() => new THREE.BoxGeometry(...size), [size[0], size[1], size[2]]);
  const edgesGeometry = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        castShadow
        receiveShadow
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover(item, e.point);
        }}
        onPointerOut={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onUnhover();
        }}
      >
        <meshStandardMaterial
          color={isHovered ? hoverColor : color}
          roughness={0.5}
          metalness={0.05}
          transparent
          opacity={0.92}
        />
      </mesh>
      <lineSegments ref={edgesRef} geometry={edgesGeometry}>
        <lineBasicMaterial color={darkerColor} linewidth={1} />
      </lineSegments>
      {isHovered && (
        <mesh geometry={geometry}>
          <meshBasicMaterial color="white" transparent opacity={0.08} />
        </mesh>
      )}
      <Html
        position={[0, item.height / 2 + 0.005, 0]}
        center
        style={{ pointerEvents: "none" }}
        occlude={false}
      >
        <div
          className="flex items-center justify-center rounded-full font-bold text-white shadow-md border border-white/40"
          style={{
            backgroundColor: item.color,
            width: "22px",
            height: "22px",
            fontSize: "11px",
            textShadow: "0 1px 2px rgba(0,0,0,0.6)",
          }}
          data-testid={`label-item-${label}`}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

interface SizeGroup {
  w: number;
  h: number;
  l: number;
  items: { item: PlacedUnitResult; index: number }[];
}

function InstancedBoxes({
  items,
  offset,
}: {
  items: PlacedUnitResult[];
  offset: [number, number, number];
}) {
  return <MergedBoxesMesh items={items} offset={offset} />;
}

function MergedBoxesMesh({ items, offset }: { items: PlacedUnitResult[]; offset: [number, number, number] }) {
  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const boxPos = box.getAttribute("position").array as Float32Array;
    const boxIdx = box.getIndex()!.array as Uint16Array;
    const boxNorm = box.getAttribute("normal").array as Float32Array;
    const vPerBox = boxPos.length / 3;
    const iPerBox = boxIdx.length;

    const totalVerts = vPerBox * items.length;
    const totalIdx = iPerBox * items.length;
    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const colors = new Float32Array(totalVerts * 3);
    const indices = new Uint32Array(totalIdx);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const cx = item.x + item.width / 2 + offset[0];
      const cy = item.y + item.height / 2 + offset[1];
      const cz = item.z + item.length / 2 + offset[2];
      const vBase = i * vPerBox;
      const color = new THREE.Color(item.color);

      for (let v = 0; v < vPerBox; v++) {
        const vi = v * 3;
        const bi = (vBase + v) * 3;
        positions[bi] = boxPos[vi] * item.width + cx;
        positions[bi + 1] = boxPos[vi + 1] * item.height + cy;
        positions[bi + 2] = boxPos[vi + 2] * item.length + cz;
        normals[bi] = boxNorm[vi];
        normals[bi + 1] = boxNorm[vi + 1];
        normals[bi + 2] = boxNorm[vi + 2];
        colors[bi] = color.r;
        colors[bi + 1] = color.g;
        colors[bi + 2] = color.b;
      }

      for (let j = 0; j < iPerBox; j++) {
        indices[i * iPerBox + j] = boxIdx[j] + vBase;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    box.dispose();
    return geo;
  }, [items, offset]);

  useEffect(() => {
    return () => { geometry.dispose(); };
  }, [geometry]);

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <meshBasicMaterial vertexColors transparent opacity={0.9} />
    </mesh>
  );
}

function ContainerWireframe({
  space,
  offset,
}: {
  space: CargoSpace;
  offset: [number, number, number];
}) {
  const position: [number, number, number] = [
    space.width / 2 + offset[0],
    space.height / 2 + offset[1],
    space.length / 2 + offset[2],
  ];

  const geometry = useMemo(
    () => new THREE.BoxGeometry(space.width, space.height, space.length),
    [space.width, space.height, space.length]
  );
  const edgesGeometry = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

  const bottomGeometry = useMemo(
    () => new THREE.PlaneGeometry(space.width, space.length),
    [space.width, space.length]
  );

  return (
    <group>
      <group position={position}>
        <lineSegments geometry={edgesGeometry}>
          <lineBasicMaterial color="#475569" linewidth={1.5} transparent opacity={0.6} />
        </lineSegments>
        <mesh geometry={geometry}>
          <meshStandardMaterial
            color="#94a3b8"
            transparent
            opacity={0.04}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
      <mesh
        position={[space.width / 2 + offset[0], offset[1] + 0.001, space.length / 2 + offset[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        geometry={bottomGeometry}
      >
        <meshStandardMaterial color="#e2e8f0" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

function DimensionLabels({
  space,
  offset,
}: {
  space: CargoSpace;
  offset: [number, number, number];
}) {
  const fmtDim = (m: number) => (m >= 1 ? `${m.toFixed(2)}m` : `${Math.round(m * 100)}cm`);

  return (
    <group>
      <Html
        position={[space.width / 2 + offset[0], offset[1] - 0.15, offset[2] - 0.15]}
        center
        style={{ pointerEvents: "none" }}
      >
        <div className="text-[11px] font-bold text-slate-600 bg-white/80 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap" data-testid="label-dim-width">
          {fmtDim(space.width)}
        </div>
      </Html>
      <Html
        position={[offset[0] - 0.15, space.height / 2 + offset[1], offset[2] - 0.15]}
        center
        style={{ pointerEvents: "none" }}
      >
        <div className="text-[11px] font-bold text-slate-600 bg-white/80 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap" data-testid="label-dim-height">
          {fmtDim(space.height)}
        </div>
      </Html>
      <Html
        position={[offset[0] - 0.15, offset[1] - 0.15, space.length / 2 + offset[2]]}
        center
        style={{ pointerEvents: "none" }}
      >
        <div className="text-[11px] font-bold text-slate-600 bg-white/80 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap" data-testid="label-dim-length">
          {fmtDim(space.length)}
        </div>
      </Html>
      <Html
        position={[space.width / 2 + offset[0], space.height + offset[1] + 0.2, space.length / 2 + offset[2]]}
        center
        style={{ pointerEvents: "none" }}
      >
        <div className="text-xs font-semibold text-slate-500 bg-white/80 px-2 py-0.5 rounded shadow-sm whitespace-nowrap" data-testid="label-space-name">
          {space.name}
        </div>
      </Html>
    </group>
  );
}

function CameraSetup({ space }: { space: CargoSpace | null }) {
  const { camera } = useThree();
  const initialized = useRef(false);

  useFrame(() => {
    if (!space || initialized.current) return;
    const maxDim = Math.max(space.width, space.height, space.length);
    const dist = maxDim * 2.2;
    camera.position.set(dist * 0.7, dist * 0.5, dist * 0.9);
    camera.lookAt(space.width / 2, space.height / 3, space.length / 2);
    initialized.current = true;
  });

  return null;
}

const INSTANCED_THRESHOLD = 50;
const WEBGL_MAX_ITEMS = 200;

function Scene({
  space,
  items,
  hoveredItem,
  onHover,
  onUnhover,
  isPallet,
}: {
  space: CargoSpace | null;
  items: PlacedUnitResult[];
  hoveredItem: PlacedUnitResult | null;
  onHover: (item: PlacedUnitResult, point: THREE.Vector3) => void;
  onUnhover: () => void;
  isPallet?: boolean;
}) {
  if (!space) return null;

  const offset: [number, number, number] = [0, 0, 0];
  const maxDim = Math.max(space.width, space.height, space.length);
  const useInstanced = items.length > INSTANCED_THRESHOLD;
  const ultraLight = items.length > 300;
  const hoveredIdx = hoveredItem ? items.indexOf(hoveredItem) : null;

  return (
    <>
      <CameraSetup space={space} />

      <ambientLight intensity={useInstanced ? 0.8 : 0.5} />
      <directionalLight
        position={[maxDim * 2, maxDim * 3, maxDim * 1.5]}
        intensity={useInstanced ? 0.6 : 1.2}
        castShadow={false}
      />

      {!useInstanced && (
        <>
          <directionalLight
            position={[-maxDim, maxDim * 2, -maxDim]}
            intensity={0.3}
          />
          <hemisphereLight args={["#b0c4de", "#8b7355", 0.4]} />
          <ContactShadows
            position={[space.width / 2, isPallet ? -0.13 : -0.01, space.length / 2]}
            opacity={0.35}
            scale={maxDim * 3}
            blur={2}
            far={maxDim * 2}
          />
          <Grid
            position={[space.width / 2, isPallet ? -0.13 : -0.005, space.length / 2]}
            cellSize={maxDim * 0.1}
            cellThickness={0.5}
            cellColor="#cbd5e1"
            sectionSize={maxDim * 0.5}
            sectionThickness={1}
            sectionColor="#94a3b8"
            fadeDistance={maxDim * 5}
            fadeStrength={1}
            infiniteGrid
          />
        </>
      )}

      {isPallet && <PalletBase space={space} offset={offset} />}
      <ContainerWireframe space={space} offset={offset} />
      {!useInstanced && <DimensionLabels space={space} offset={offset} />}

      {useInstanced ? (
        <InstancedBoxes items={items} offset={offset} />
      ) : (
        items.map((item, index) => (
          <CargoBox
            key={`${item.unitType}-${item.unitId}-${index}`}
            item={item}
            offset={offset}
            isHovered={hoveredItem === item}
            onHover={onHover}
            onUnhover={onUnhover}
            label={String(item.loadOrder || index + 1)}
          />
        ))
      )}
    </>
  );
}

function Isometric3DView({ space, items, t }: { space: CargoSpace | null; items: PlacedUnitResult[]; t: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredItem, setHoveredItem] = useState<PlacedUnitResult | null>(null);
  const fmtDim = (m: number) => (m >= 1 ? `${m.toFixed(2)}m` : `${Math.round(m * 100)}cm`);

  const isoProject = useCallback((x: number, y: number, z: number, scale: number, ox: number, oy: number): [number, number] => {
    const angle = Math.PI / 6;
    const px = ox + (x - z) * Math.cos(angle) * scale;
    const py = oy - y * scale + (x + z) * Math.sin(angle) * scale;
    return [px, py];
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !space) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#f0f4f8");
    grad.addColorStop(0.5, "#e8edf3");
    grad.addColorStop(1, "#f8fafc");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const maxDim = Math.max(space.width, space.height, space.length);
    const scale = Math.min(w * 0.28, h * 0.35) / maxDim;
    const ox = w * 0.5;
    const oy = h * 0.65;

    const iso = (x: number, y: number, z: number): [number, number] => isoProject(x, y, z, scale, ox, oy);

    const drawFace = (points: [number, number][], fillColor: string, strokeColor: string, alpha: number = 1) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const floorPts = [iso(0, 0, 0), iso(space.width, 0, 0), iso(space.width, 0, space.length), iso(0, 0, space.length)];
    ctx.fillStyle = "#e2e8f0";
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(floorPts[0][0], floorPts[0][1]);
    floorPts.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    const gridStepX = Math.ceil(space.width / 10) > 0 ? space.width / Math.ceil(space.width / 0.5) : space.width;
    const gridStepZ = Math.ceil(space.length / 10) > 0 ? space.length / Math.ceil(space.length / 0.5) : space.length;
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 0.3;
    ctx.globalAlpha = 0.4;
    for (let gx = 0; gx <= space.width; gx += gridStepX) {
      const a = iso(gx, 0, 0);
      const b = iso(gx, 0, space.length);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    for (let gz = 0; gz <= space.length; gz += gridStepZ) {
      const a = iso(0, 0, gz);
      const b = iso(space.width, 0, gz);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const containerEdges: [[number, number, number], [number, number, number]][] = [
      [[0,0,0],[space.width,0,0]], [[0,0,0],[0,space.height,0]], [[0,0,0],[0,0,space.length]],
      [[space.width,0,0],[space.width,space.height,0]], [[space.width,0,0],[space.width,0,space.length]],
      [[0,space.height,0],[space.width,space.height,0]], [[0,space.height,0],[0,space.height,space.length]],
      [[0,0,space.length],[space.width,0,space.length]], [[0,0,space.length],[0,space.height,space.length]],
      [[space.width,space.height,0],[space.width,space.height,space.length]],
      [[space.width,0,space.length],[space.width,space.height,space.length]],
      [[0,space.height,space.length],[space.width,space.height,space.length]],
    ];
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    containerEdges.forEach(([a, b]) => {
      const pa = iso(a[0], a[1], a[2]);
      const pb = iso(b[0], b[1], b[2]);
      ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
    });
    ctx.setLineDash([]);

    const sorted = [...items].sort((a, b) => {
      const da = a.x + a.z - a.y * 2;
      const db = b.x + b.z - b.y * 2;
      return da - db;
    });

    const adjustColor = (hex: string, amount: number): string => {
      const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount));
      const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount));
      const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount));
      return `rgb(${r},${g},${b})`;
    };

    sorted.forEach((item) => {
      const x1 = item.x, y1 = item.y, z1 = item.z;
      const x2 = x1 + item.width, y2 = y1 + item.height, z2 = z1 + item.length;
      const isHovered = hoveredItem === item;
      const alpha = isHovered ? 1 : 0.88;

      const topFace = [iso(x1, y2, z1), iso(x2, y2, z1), iso(x2, y2, z2), iso(x1, y2, z2)];
      drawFace(topFace, adjustColor(item.color, 30), adjustColor(item.color, -40), alpha);

      const rightFace = [iso(x2, y1, z1), iso(x2, y2, z1), iso(x2, y2, z2), iso(x2, y1, z2)];
      drawFace(rightFace, adjustColor(item.color, -20), adjustColor(item.color, -50), alpha);

      const frontFace = [iso(x1, y1, z2), iso(x2, y1, z2), iso(x2, y2, z2), iso(x1, y2, z2)];
      drawFace(frontFace, item.color, adjustColor(item.color, -40), alpha);

      if (isHovered) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        [topFace, rightFace, frontFace].forEach(face => {
          ctx.beginPath();
          ctx.moveTo(face[0][0], face[0][1]);
          face.forEach(p => ctx.lineTo(p[0], p[1]));
          ctx.closePath();
          ctx.stroke();
        });
      }

      const showLabels = items.length <= 100;
      if (showLabels) {
        const center = iso((x1 + x2) / 2, y2, (z1 + z2) / 2);
        const label = String(item.loadOrder || (items.indexOf(item) + 1));
        const fontSize = Math.max(7, Math.min(11, Math.min(item.width, item.length) * scale * 0.6));
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillText(label, center[0] + 0.5, center[1] + 0.5);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, center[0], center[1]);
      }
    });

    const widthLabel = fmtDim(space.width);
    const heightLabel = fmtDim(space.height);
    const lengthLabel = fmtDim(space.length);
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";

    const wMid = iso(space.width / 2, 0, 0);
    ctx.fillText(widthLabel, wMid[0], wMid[1] + 16);

    const lMid = iso(0, 0, space.length / 2);
    ctx.save();
    ctx.translate(lMid[0] - 16, lMid[1]);
    ctx.rotate(-Math.PI / 6);
    ctx.fillText(lengthLabel, 0, 0);
    ctx.restore();

    const hMid = iso(0, space.height / 2, 0);
    ctx.save();
    ctx.translate(hMid[0] - 12, hMid[1]);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(heightLabel, 0, 0);
    ctx.restore();

    ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillStyle = "#475569";
    ctx.textAlign = "center";
    ctx.fillText(space.name, w / 2, 18);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(
      `${fmtDim(space.length)} × ${fmtDim(space.width)} × ${fmtDim(space.height)}` +
        (items.length > 0 ? ` · ${items.length} ${items.length === 1 ? "item" : "itens"}` : ""),
      w / 2,
      33
    );
  }, [space, items, hoveredItem, isoProject]);

  const uniqueItemTypes = useMemo(() => {
    const map = new Map<string, { name: string; color: string; count: number }>();
    items.forEach(item => {
      const key = `${item.unitType}-${item.unitId}-${item.name}`;
      if (!map.has(key)) map.set(key, { name: item.name, color: item.color, count: 0 });
      map.get(key)!.count++;
    });
    return Array.from(map.values());
  }, [items]);

  if (!space) {
    return (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-gradient-to-b from-slate-100 to-white" data-testid="canvas-3d-view">
        <p className="text-muted-foreground text-sm">{t.planning.selectSpaceToView}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[400px] flex flex-col bg-gradient-to-b from-slate-50 to-white" data-testid="canvas-3d-view">
      <div ref={containerRef} className="flex-1 min-h-[300px]">
        <canvas ref={canvasRef} className="w-full h-full" data-testid="isometric-canvas" />
      </div>

      {uniqueItemTypes.length > 0 && (
        <div className="px-4 pb-3 pt-1 flex flex-wrap gap-x-4 gap-y-1 justify-center border-t" data-testid="fallback-legend">
          {uniqueItemTypes.map((entry, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border" style={{ backgroundColor: entry.color }} />
              <span>{entry.count}x {entry.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Container3D({ space, items, isPallet }: Container3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<HoveredItem | null>(null);
  const [webglAvailable, setWebglAvailable] = useState(() => detectWebGL());
  const [contextLost, setContextLost] = useState(false);
  const { t } = useI18n();

  const perfTier = items.length > INSTANCED_THRESHOLD ? "high" : "low";

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (contextLost && retryCount < 2) {
      const timer = setTimeout(() => {
        setContextLost(false);
        setRetryCount(r => r + 1);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [contextLost, retryCount]);

  useEffect(() => {
    setRetryCount(0);
  }, [space]);

  const handleWebGLError = useCallback(() => {
    setWebglAvailable(false);
  }, []);

  const handleHover = useCallback((item: PlacedUnitResult, point: THREE.Vector3) => {
    setHoveredItem({ item, point });
  }, []);

  const handleUnhover = useCallback(() => {
    setHoveredItem(null);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFullscreen]);

  const fmtDim = (m: number) => (m >= 1 ? `${m.toFixed(2)}m` : `${Math.round(m * 100)}cm`);

  const cameraDistance = useMemo(() => {
    if (!space) return 5;
    return Math.max(space.width, space.height, space.length) * 2.5;
  }, [space]);

  const fallbackView = <Isometric3DView space={space} items={items} t={t} />;

  const uniqueItemTypes = useMemo(() => {
    const map = new Map<string, { name: string; color: string; count: number }>();
    items.forEach(item => {
      const key = `${item.unitType}-${item.unitId}-${item.name}`;
      if (!map.has(key)) {
        map.set(key, { name: item.name, color: item.color, count: 0 });
      }
      map.get(key)!.count++;
    });
    return Array.from(map.values());
  }, [items]);

  return (
    <>
      {isFullscreen && (
        <div
          className="fixed inset-0 bg-black/60 z-[9998]"
          onClick={() => setIsFullscreen(false)}
          data-testid="fullscreen-overlay"
        />
      )}
      <div
        ref={containerRef}
        className={
          isFullscreen
            ? "fixed inset-4 z-[9999] rounded-md bg-background flex flex-col overflow-hidden"
            : "relative w-full h-full min-h-[400px]"
        }
        data-testid="container-3d-wrapper"
      >
        {webglAvailable && !contextLost ? (
          <WebGLErrorBoundary fallback={fallbackView} onError={handleWebGLError}>
            <Canvas
              shadows={false}
              dpr={[1, 1]}
              frameloop="demand"
              camera={{
                fov: 45,
                near: 0.01,
                far: 1000,
                position: [cameraDistance * 0.7, cameraDistance * 0.5, cameraDistance * 0.9],
              }}
              style={{ background: "linear-gradient(180deg, #f0f4f8 0%, #e2e8f0 50%, #f8fafc 100%)" }}
              data-testid="canvas-3d-view"
              gl={{
                antialias: false,
                powerPreference: "high-performance",
                failIfMajorPerformanceCaveat: false,
                preserveDrawingBuffer: false,
                alpha: false,
                stencil: false,
              }}
              raycaster={perfTier === "high" ? { enabled: false } as any : undefined}
              onCreated={({ gl }) => {
                gl.shadowMap.enabled = false;
                const canvas = gl.domElement;
                canvas.addEventListener("webglcontextlost", (e) => {
                  e.preventDefault();
                  setContextLost(true);
                });
                canvas.addEventListener("webglcontextrestored", () => {
                  setContextLost(false);
                });
              }}
            >
              <Suspense fallback={null}>
                <Scene
                  space={space}
                  items={items}
                  hoveredItem={hoveredItem?.item ?? null}
                  onHover={handleHover}
                  onUnhover={handleUnhover}
                  isPallet={isPallet}
                />
                <OrbitControls
                  enableDamping={perfTier === "low"}
                  dampingFactor={0.08}
                  minDistance={0.5}
                  maxDistance={cameraDistance * 3}
                  maxPolarAngle={Math.PI / 2 - 0.05}
                  zoomSpeed={0.4}
                  target={space ? [space.width / 2, space.height / 3, space.length / 2] : [0, 0, 0]}
                  onChange={() => {
                    if (perfTier === "high") {
                      const canvas = containerRef.current?.querySelector('canvas');
                      if (canvas) {
                        const ctx = (canvas as any).__r3f;
                        if (ctx) ctx.invalidate();
                      }
                    }
                  }}
                />
              </Suspense>
            </Canvas>
          </WebGLErrorBoundary>
        ) : (
          fallbackView
        )}

        {!space && webglAvailable && !contextLost && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-muted-foreground text-sm">{t.planning.selectSpaceToView}</p>
          </div>
        )}

        {hoveredItem && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border rounded-lg px-4 py-2.5 text-xs shadow-lg z-10 pointer-events-none"
            data-testid="tooltip-item-hover"
          >
            <div className="font-semibold text-sm mb-1" data-testid="tooltip-item-name">
              <span
                className="inline-block w-3 h-3 rounded-sm mr-1.5 align-middle border"
                style={{ backgroundColor: hoveredItem.item.color }}
              />
              {hoveredItem.item.name}
            </div>
            <div className="text-muted-foreground">
              #{hoveredItem.item.loadOrder} &middot; {fmtDim(hoveredItem.item.length)} × {fmtDim(hoveredItem.item.width)} × {fmtDim(hoveredItem.item.height)}
            </div>
            <div className="text-muted-foreground">{hoveredItem.item.weight} kg</div>
            {hoveredItem.item.fragile && (
              <div className="text-amber-600 font-medium mt-0.5">⚠ {t.report?.fragileWarning || "Fragile"}</div>
            )}
          </div>
        )}

        <button
          onClick={() => setIsFullscreen((prev) => !prev)}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-card/80 backdrop-blur text-muted-foreground hover:bg-card transition-colors"
          data-testid="button-fullscreen-toggle"
          title={isFullscreen ? t.planning.exitFullscreen : t.planning.fullscreen}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        <div
          className="absolute top-2 left-2 flex items-center gap-1 text-xs text-muted-foreground bg-card/80 backdrop-blur px-2 py-1 rounded-md"
          data-testid="zoom-indicator"
        >
          <RotateCcw className="w-3 h-3" />
          <span data-testid="text-zoom-level">{t.planning.dragToRotate} · {t.planning.scrollToZoom}</span>
        </div>

        {uniqueItemTypes.length > 0 && (
          <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur border rounded-lg px-3 py-2 text-xs max-h-40 overflow-y-auto shadow-sm" data-testid="item-legend">
            <div className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{t.report?.title || "Items"} ({items.length})</div>
            {uniqueItemTypes.map((type, i) => (
              <div key={i} className="flex items-center gap-1.5 py-0.5">
                <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-white/30" style={{ backgroundColor: type.color }} />
                <span className="truncate max-w-[140px]">{type.count}× {type.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
