export function OrientationMiniPreview({ orientation, length, width, height, active }: { orientation: string; length: number; width: number; height: number; active: boolean }) {
  let dl = length || 30, dw = width || 20, dh = height || 40;
  if (orientation === "side") { [dl, dw] = [dw, dl]; }
  else if (orientation === "front") { [dl, dh] = [dh, dl]; }
  else if (orientation === "back") { [dw, dh] = [dh, dw]; }

  const maxD = Math.max(dl, dw, dh, 1);
  const clamp = (v: number) => Math.max(8, (v / maxD) * 24);
  const sl = clamp(dl), sw = clamp(dw), sh = clamp(dh);

  const cx = 30, cy = 42;
  const ix = (x: number, y: number) => cx + (x - y) * 0.866;
  const iy = (x: number, y: number, z: number) => cy - z + (x + y) * 0.5;
  const pt = (x: number, y: number, z: number) => `${ix(x,y)},${iy(x,y,z)}`;

  const baseColor = active ? "hsl(37 95% 55%)" : "hsl(0 0% 55%)";
  const fillFront = active ? "hsl(37 95% 55% / 0.5)" : "hsl(0 0% 80% / 0.35)";
  const fillRight = active ? "hsl(37 95% 45% / 0.4)" : "hsl(0 0% 70% / 0.35)";
  const fillTop = active ? "hsl(37 95% 65% / 0.6)" : "hsl(0 0% 88% / 0.45)";
  const dashColor = active ? "hsl(37 95% 48% / 0.5)" : "hsl(0 0% 55% / 0.4)";

  const frontPts = `${pt(0,0,0)} ${pt(sl,0,0)} ${pt(sl,0,sh)} ${pt(0,0,sh)}`;
  const rightPts = `${pt(sl,0,0)} ${pt(sl,sw,0)} ${pt(sl,sw,sh)} ${pt(sl,0,sh)}`;
  const topPts = `${pt(0,0,sh)} ${pt(sl,0,sh)} ${pt(sl,sw,sh)} ${pt(0,sw,sh)}`;

  const dimText = `${dl} × ${dw} × ${dh}`;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="56" height="50" viewBox="0 0 60 54" className="flex-shrink-0">
        <line x1={ix(0,sw)} y1={iy(0,sw,0)} x2={ix(0,0)} y2={iy(0,0,0)} stroke={dashColor} strokeWidth="0.8" strokeDasharray="2,2" />
        <line x1={ix(0,sw)} y1={iy(0,sw,0)} x2={ix(sl,sw)} y2={iy(sl,sw,0)} stroke={dashColor} strokeWidth="0.8" strokeDasharray="2,2" />
        <line x1={ix(0,sw)} y1={iy(0,sw,0)} x2={ix(0,sw)} y2={iy(0,sw,sh)} stroke={dashColor} strokeWidth="0.8" strokeDasharray="2,2" />
        <polygon points={frontPts} fill={fillFront} stroke={baseColor} strokeWidth="1" strokeLinejoin="round" />
        <polygon points={rightPts} fill={fillRight} stroke={baseColor} strokeWidth="1" strokeLinejoin="round" />
        <polygon points={topPts} fill={fillTop} stroke={baseColor} strokeWidth="1" strokeLinejoin="round" />
        <line x1={ix(0,0)} y1={iy(0,0,0)} x2={ix(0,0)} y2={iy(0,0,0) + 3} stroke={baseColor} strokeWidth="0.6" />
        <line x1={ix(0,0) - 2} y1={iy(0,0,0) + 3} x2={ix(0,0) + 2} y2={iy(0,0,0) + 3} stroke={baseColor} strokeWidth="0.6" />
      </svg>
      <span className={`text-[8px] leading-tight text-center ${active ? "text-primary font-medium" : "text-muted-foreground"}`}>
        {dimText}
      </span>
    </div>
  );
}
