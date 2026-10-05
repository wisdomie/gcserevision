// Draws a question diagram as inline SVG. Pure: no hooks, so it renders on the
// server or the client. Colours come from the theme tokens.
import type {
  Axis,
  BarDiagram,
  Diagram as DiagramData,
  GeometryDiagram,
  GraphDiagram,
  Point,
  TextAnchor,
} from "@/lib/engine/diagram";

const FONT = 14;
const STROKE = "var(--foreground)";
const GRID = "var(--border)";
const MUTED = "var(--muted)";

/** Single letters are maths variables: draw them in italics. */
const isVariable = (text: string) => /^[a-zA-Z]$/.test(text);

function Label({
  x,
  y,
  text,
  anchor = "middle",
  size = FONT,
  fill = STROKE,
}: {
  x: number;
  y: number;
  text: string;
  anchor?: TextAnchor;
  size?: number;
  fill?: string;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      textAnchor={anchor}
      dominantBaseline="central"
      fill={fill}
      fontStyle={isVariable(text) ? "italic" : undefined}
      fontFamily="ui-sans-serif, system-ui, sans-serif"
    >
      {text}
    </text>
  );
}

function Frame({
  alt,
  viewBox,
  children,
  caption,
}: {
  alt: string;
  viewBox: [number, number, number, number];
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg
        role="img"
        aria-label={alt}
        viewBox={viewBox.join(" ")}
        // Drawn at 1 unit = 1px, shrinking only to fit, so text is the same size in every diagram
        width={viewBox[2]}
        className="h-auto max-w-full"
        data-testid="question-diagram"
      >
        {children}
      </svg>
      {caption && <figcaption className="text-muted text-xs">{caption}</figcaption>}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Drawing units have y up; SVG has y down. */
const flip = ([x, y]: Point): Point => [x, -y];

function unitVector(from: Point, to: Point): Point {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

function labelWidth(text: string) {
  return text.length * FONT * 0.6;
}

function geometryBounds(d: GeometryDiagram): [number, number, number, number] {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const s of d.shapes)
    for (const p of s.points) {
      const [x, y] = flip(p);
      xs.push(x);
      ys.push(y);
    }
  for (const l of d.labels) {
    const [x, y] = flip(l.at);
    const w = labelWidth(l.text);
    const left = l.anchor === "start" ? x : l.anchor === "end" ? x - w : x - w / 2;
    xs.push(left, left + w);
    ys.push(y - FONT / 2, y + FONT / 2);
  }
  const pad = 8;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  return [minX, minY, Math.max(...xs) + pad - minX, Math.max(...ys) + pad - minY];
}

function Geometry({ d }: { d: GeometryDiagram }) {
  return (
    <Frame alt={d.alt} viewBox={geometryBounds(d)} caption="Not drawn accurately">
      {d.shapes.map((s, i) => {
        const pts = s.points.map((p) => flip(p).join(",")).join(" ");
        return s.closed ? (
          <polygon key={i} points={pts} fill="var(--surface)" stroke={STROKE} strokeWidth={2} />
        ) : (
          <polyline key={i} points={pts} fill="none" stroke={STROKE} strokeWidth={2} />
        );
      })}
      {d.rightAngles.map((r, i) => {
        const at = flip(r.at);
        const ua = unitVector(at, flip(r.a));
        const ub = unitVector(at, flip(r.b));
        const size = 12;
        const p1: Point = [at[0] + ua[0] * size, at[1] + ua[1] * size];
        const p3: Point = [at[0] + ub[0] * size, at[1] + ub[1] * size];
        const p2: Point = [p1[0] + ub[0] * size, p1[1] + ub[1] * size];
        return (
          <polyline
            key={`r${i}`}
            points={[p1, p2, p3].map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke={STROKE}
            strokeWidth={1.5}
          />
        );
      })}
      {d.arcs.map((a, i) => {
        const at = flip(a.at);
        const ua = unitVector(at, flip(a.a));
        const ub = unitVector(at, flip(a.b));
        const r = 18;
        const cross = ua[0] * ub[1] - ua[1] * ub[0];
        const start: Point = [at[0] + ua[0] * r, at[1] + ua[1] * r];
        const end: Point = [at[0] + ub[0] * r, at[1] + ub[1] * r];
        return (
          <path
            key={`a${i}`}
            d={`M ${start.join(" ")} A ${r} ${r} 0 0 ${cross > 0 ? 1 : 0} ${end.join(" ")}`}
            fill="none"
            stroke={STROKE}
            strokeWidth={1.5}
          />
        );
      })}
      {d.labels.map((l, i) => {
        const [x, y] = flip(l.at);
        return <Label key={`l${i}`} x={x} y={y} text={l.text} anchor={l.anchor} />;
      })}
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Axes shared by graphs and bar charts
// ---------------------------------------------------------------------------

function ticks(axis: Axis): number[] {
  const out: number[] = [];
  const first = Math.ceil(axis.min / axis.step - 1e-9);
  for (let k = first; k * axis.step <= axis.max + 1e-9; k++)
    out.push(Math.round(k * axis.step * 1e6) / 1e6);
  return out;
}

/** Shows every tick label, or every other one when they'd crowd together. */
function labelEvery(values: number[], spacing: number, vertical = false) {
  const room = vertical ? 13 : Math.max(...values.map((v) => String(v).length)) * 7 + 6;
  return spacing >= room ? 1 : spacing * 2 >= room ? 2 : 5;
}

// ---------------------------------------------------------------------------
// Coordinate graphs (straight lines, scatter graphs)
// ---------------------------------------------------------------------------

function Graph({ d }: { d: GraphDiagram }) {
  const xRange = d.x.max - d.x.min;
  const yRange = d.y.max - d.y.min;
  // Coordinate grids (same step on both axes) get equal scales, so gradients
  // look right; charts like scatter graphs fill the space instead
  const equal = Math.min(280 / xRange, 260 / yRange);
  const grid = d.equalScale === true;
  const sx = grid ? equal : 280 / xRange;
  const sy = grid ? equal : 220 / yRange;
  const X = (x: number) => (x - d.x.min) * sx;
  const Y = (y: number) => -(y - d.y.min) * sy;
  const xAxisY = Y(d.y.min <= 0 && d.y.max >= 0 ? 0 : d.y.min);
  const yAxisX = X(d.x.min <= 0 && d.x.max >= 0 ? 0 : d.x.min);
  const xTicks = ticks(d.x);
  const yTicks = ticks(d.y);
  const width = X(d.x.max);
  const height = -Y(d.y.max);
  const left = -34;
  const top = -height - 24;

  return (
    <Frame alt={d.alt} viewBox={[left, top, width - left + 24, height - top + (grid ? 22 : 40)]}>
      {xTicks.map((t) => (
        <line
          key={`gx${t}`}
          x1={X(t)}
          x2={X(t)}
          y1={0}
          y2={-height}
          stroke={GRID}
          strokeWidth={1}
        />
      ))}
      {yTicks.map((t) => (
        <line key={`gy${t}`} x1={0} x2={width} y1={Y(t)} y2={Y(t)} stroke={GRID} strokeWidth={1} />
      ))}
      <line x1={0} x2={width} y1={xAxisY} y2={xAxisY} stroke={STROKE} strokeWidth={1.5} />
      <line x1={yAxisX} x2={yAxisX} y1={0} y2={-height} stroke={STROKE} strokeWidth={1.5} />
      {xTicks
        .filter((_, i) => i % labelEvery(xTicks, d.x.step * sx) === 0)
        .map((t) => (
          <Label key={`tx${t}`} x={X(t)} y={xAxisY + 12} text={String(t)} size={11} fill={MUTED} />
        ))}
      {yTicks
        .filter((_, i) => i % labelEvery(yTicks, d.y.step * sy, true) === 0)
        .map((t) => (
          <Label
            key={`ty${t}`}
            x={yAxisX - 5}
            y={Y(t)}
            text={String(t)}
            size={11}
            anchor="end"
            fill={MUTED}
          />
        ))}
      {d.x.label &&
        (grid ? (
          <Label x={width + 8} y={xAxisY} text={d.x.label} size={13} anchor="start" />
        ) : (
          <Label x={width / 2} y={30} text={d.x.label} size={12} />
        ))}
      {d.y.label &&
        (grid ? (
          <Label x={yAxisX} y={-height - 12} text={d.y.label} size={13} />
        ) : (
          <Label x={0} y={top + 10} text={d.y.label} size={12} anchor="start" />
        ))}
      {d.lines.map((l, i) => (
        <g key={`l${i}`}>
          <line
            x1={X(l.from[0])}
            y1={Y(l.from[1])}
            x2={X(l.to[0])}
            y2={Y(l.to[1])}
            stroke="var(--accent)"
            strokeWidth={2.5}
          />
          {l.label && (
            <Label x={X(l.to[0]) + 4} y={Y(l.to[1]) - 10} text={l.label} anchor="end" size={12} />
          )}
        </g>
      ))}
      {d.points.map(([px, py], i) => {
        const cx = X(px);
        const cy = Y(py);
        return (
          <path
            key={`p${i}`}
            d={`M ${cx - 4} ${cy - 4} L ${cx + 4} ${cy + 4} M ${cx - 4} ${cy + 4} L ${cx + 4} ${cy - 4}`}
            stroke="var(--accent)"
            strokeWidth={2}
          />
        );
      })}
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Bar charts
// ---------------------------------------------------------------------------

function Bars({ d }: { d: BarDiagram }) {
  const height = 200;
  const slot = Math.min(60, 280 / d.categories.length);
  const width = slot * d.categories.length;
  const Y = (v: number) => -((v - d.y.min) / (d.y.max - d.y.min)) * height;
  const yTicks = ticks(d.y);
  const top = -height - 26;

  return (
    <Frame alt={d.alt} viewBox={[-36, top, width + 44, height - top + 40]}>
      {yTicks.map((t) => (
        <g key={`t${t}`}>
          <line x1={0} x2={width} y1={Y(t)} y2={Y(t)} stroke={GRID} strokeWidth={1} />
          <Label x={-5} y={Y(t)} text={String(t)} size={11} anchor="end" fill={MUTED} />
        </g>
      ))}
      {d.values.map((v, i) => (
        <rect
          key={`b${i}`}
          x={i * slot + slot * 0.2}
          y={Y(v)}
          width={slot * 0.6}
          height={-Y(v)}
          fill="var(--accent)"
          opacity={0.85}
        />
      ))}
      <line x1={0} x2={width} y1={0} y2={0} stroke={STROKE} strokeWidth={1.5} />
      <line x1={0} x2={0} y1={0} y2={-height} stroke={STROKE} strokeWidth={1.5} />
      {d.categories.map((c, i) => (
        <Label key={`c${i}`} x={i * slot + slot / 2} y={12} text={c} size={11} />
      ))}
      {d.xLabel && <Label x={width / 2} y={32} text={d.xLabel} size={12} />}
      {d.y.label && <Label x={-30} y={top + 10} text={d.y.label} size={12} anchor="start" />}
    </Frame>
  );
}

export function Diagram({ diagram }: { diagram: DiagramData }) {
  switch (diagram.kind) {
    case "geometry":
      return <Geometry d={diagram} />;
    case "graph":
      return <Graph d={diagram} />;
    case "bar":
      return <Bars d={diagram} />;
  }
}
