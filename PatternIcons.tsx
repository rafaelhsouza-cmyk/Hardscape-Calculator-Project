import type { ReactElement } from "react";
import type { LayoutType } from "@/lib/calculator";

type IconProps = {
  className?: string;
};

const COMMON = {
  viewBox: "0 0 80 80",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
};

const FILL = "currentColor";
const STROKE_W = 1;

function Brick({
  x,
  y,
  w,
  h,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={1}
      fill={FILL}
      fillOpacity={0.18}
      stroke={FILL}
      strokeWidth={STROKE_W}
    />
  );
}

/** Running Bond — rows of long bricks, every other row offset by half. */
function RunningBondIcon({ className }: IconProps) {
  const rows = [0, 16, 32, 48, 64];
  return (
    <svg {...COMMON} className={className}>
      <clipPath id="rb-clip">
        <rect x="0" y="0" width="80" height="80" rx="2" />
      </clipPath>
      <g clipPath="url(#rb-clip)">
        {rows.map((y, i) => {
          const offset = i % 2 === 0 ? 0 : -16;
          return (
            <g key={y}>
              {[0, 1, 2, 3].map((c) => (
                <Brick
                  key={c}
                  x={c * 32 + offset}
                  y={y}
                  w={32}
                  h={16}
                />
              ))}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** Stack Bond — bricks aligned on a perfect grid. */
function StackBondIcon({ className }: IconProps) {
  const rows = [0, 16, 32, 48, 64];
  return (
    <svg {...COMMON} className={className}>
      {rows.map((y) =>
        [0, 1, 2].map((c) => (
          <Brick key={`${y}-${c}`} x={c * 28 + 2} y={y} w={24} h={16} />
        )),
      )}
    </svg>
  );
}

/**
 * Generate a true herringbone tiling (no gaps).
 * Each lattice point (i, j) places a perpendicular pair of bricks:
 *   - Horizontal brick at (cx, cy) of size (2w, w)
 *   - Vertical brick   at (cx + 2w, cy) of size (w, 2w)
 * with the lattice basis vectors u = (3w, w) and v = (-w, w).
 * Each fundamental domain has area 4w² and contains exactly 2 bricks.
 */
function generateHerringbone(w: number, iRange: [number, number], jRange: [number, number]) {
  const l = 2 * w;
  const out: { x: number; y: number; w: number; h: number }[] = [];
  for (let i = iRange[0]; i <= iRange[1]; i++) {
    for (let j = jRange[0]; j <= jRange[1]; j++) {
      const cx = 3 * w * i - w * j;
      const cy = w * i + w * j;
      out.push({ x: cx, y: cy, w: l, h: w });
      out.push({ x: cx + l, y: cy, w: w, h: l });
    }
  }
  return out;
}

/** Herringbone 90° — true interlocking pattern parallel to the edges. */
function Herringbone90Icon({ className }: IconProps) {
  const bricks = generateHerringbone(10, [-3, 4], [-4, 8]);
  return (
    <svg {...COMMON} className={className}>
      <clipPath id="hb90-clip">
        <rect x="0" y="0" width="80" height="80" rx="2" />
      </clipPath>
      <g clipPath="url(#hb90-clip)">
        {bricks.map((b, i) => (
          <Brick key={i} {...b} />
        ))}
      </g>
    </svg>
  );
}

/** Herringbone 45° — same true tiling rotated 45° around the centre. */
function Herringbone45Icon({ className }: IconProps) {
  const bricks = generateHerringbone(10, [-6, 8], [-6, 10]);
  return (
    <svg {...COMMON} className={className}>
      <clipPath id="hb45-clip">
        <rect x="0" y="0" width="80" height="80" rx="2" />
      </clipPath>
      <g clipPath="url(#hb45-clip)">
        <g transform="rotate(45 40 40)">
          {bricks.map((b, i) => (
            <Brick key={i} {...b} />
          ))}
        </g>
      </g>
    </svg>
  );
}

/** Basket Weave — pairs of bricks alternating direction in 2x2 tiles. */
function BasketWeaveIcon({ className }: IconProps) {
  const cell = (cx: number, cy: number, vertical: boolean, key: string) => {
    if (vertical) {
      return (
        <g key={key}>
          <Brick x={cx} y={cy} w={16} h={32} />
          <Brick x={cx + 16} y={cy} w={16} h={32} />
        </g>
      );
    }
    return (
      <g key={key}>
        <Brick x={cx} y={cy} w={32} h={16} />
        <Brick x={cx} y={cy + 16} w={32} h={16} />
      </g>
    );
  };
  return (
    <svg {...COMMON} className={className}>
      {cell(8, 8, false, "a")}
      {cell(40, 8, true, "b")}
      {cell(8, 40, true, "c")}
      {cell(40, 40, false, "d")}
    </svg>
  );
}

/** Pinwheel — four bricks rotating around a small center square. */
function PinwheelIcon({ className }: IconProps) {
  const unit = (ox: number, oy: number, key: string) => (
    <g key={key} transform={`translate(${ox}, ${oy})`}>
      {/* center square */}
      <Brick x={14} y={14} w={8} h={8} />
      {/* top - horizontal */}
      <Brick x={6} y={6} w={16} h={8} />
      {/* right - vertical */}
      <Brick x={22} y={6} w={8} h={16} />
      {/* bottom - horizontal */}
      <Brick x={14} y={22} w={16} h={8} />
      {/* left - vertical */}
      <Brick x={6} y={14} w={8} h={16} />
    </g>
  );
  return (
    <svg {...COMMON} className={className}>
      {unit(4, 4, "a")}
      {unit(40, 4, "b")}
      {unit(4, 40, "c")}
      {unit(40, 40, "d")}
    </svg>
  );
}

/** Flemish Bond — each row alternates long stretchers and short headers. */
function FlemishBondIcon({ className }: IconProps) {
  const rows = [0, 16, 32, 48, 64];
  // Stretcher 24 wide, header 12 wide, gap counted in widths
  return (
    <svg {...COMMON} className={className}>
      <clipPath id="fb-clip">
        <rect x="0" y="0" width="80" height="80" rx="2" />
      </clipPath>
      <g clipPath="url(#fb-clip)">
        {rows.map((y, i) => {
          // alternating row offset so headers align over stretcher centers
          const offset = i % 2 === 0 ? 0 : -18;
          // pattern in row: stretcher (24), header (12), repeat
          let x = offset;
          const out: ReactElement[] = [];
          let idx = 0;
          while (x < 90) {
            const isStretcher = idx % 2 === 0;
            const w = isStretcher ? 24 : 12;
            out.push(
              <Brick key={`${y}-${idx}`} x={x} y={y} w={w} h={16} />,
            );
            x += w;
            idx++;
          }
          return <g key={y}>{out}</g>;
        })}
      </g>
    </svg>
  );
}

/** Random Ashlar — mixed paver sizes in a non-repeating pattern. */
function RandomAshlarIcon({ className }: IconProps) {
  // Hand-tuned mix that fits 80x80 cleanly
  const bricks = [
    { x: 0, y: 0, w: 32, h: 24 },
    { x: 32, y: 0, w: 48, h: 16 },
    { x: 32, y: 16, w: 24, h: 24 },
    { x: 56, y: 16, w: 24, h: 32 },
    { x: 0, y: 24, w: 16, h: 32 },
    { x: 16, y: 24, w: 16, h: 16 },
    { x: 16, y: 40, w: 40, h: 16 },
    { x: 0, y: 56, w: 32, h: 24 },
    { x: 32, y: 48, w: 24, h: 16 },
    { x: 56, y: 48, w: 24, h: 32 },
    { x: 32, y: 64, w: 24, h: 16 },
  ];
  return (
    <svg {...COMMON} className={className}>
      <clipPath id="ra-clip">
        <rect x="0" y="0" width="80" height="80" rx="2" />
      </clipPath>
      <g clipPath="url(#ra-clip)">
        {bricks.map((b, i) => (
          <Brick key={i} x={b.x} y={b.y} w={b.w} h={b.h} />
        ))}
      </g>
    </svg>
  );
}

export function PatternIcon({
  type,
  className,
}: {
  type: LayoutType;
  className?: string;
}) {
  switch (type) {
    case "running_bond":
      return <RunningBondIcon className={className} />;
    case "stack_bond":
      return <StackBondIcon className={className} />;
    case "herringbone_90":
      return <Herringbone90Icon className={className} />;
    case "herringbone_45":
      return <Herringbone45Icon className={className} />;
    case "basket_weave":
      return <BasketWeaveIcon className={className} />;
    case "pinwheel":
      return <PinwheelIcon className={className} />;
    case "flemish_bond":
      return <FlemishBondIcon className={className} />;
    case "random_ashlar":
      return <RandomAshlarIcon className={className} />;
    default:
      return null;
  }
}
