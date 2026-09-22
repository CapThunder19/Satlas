import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation as ForceSim,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { polygonCentroid, polygonHull } from "d3-polygon";
import type { Analysis, CoinAnalysis, Simulation, Utxo } from "../engine/types";
import { coinKey } from "../engine/types";
import { formatBtc, formatBtcShort } from "../lib/format";
import { ORIGIN } from "../lib/copy";
import { assignGroupColors, GROUP_OTHER, SPEND_HIGHLIGHT, groupColor } from "../lib/clusterColors";

interface Node extends SimulationNodeDatum {
  id: string;
  utxo: Utxo;
  info: CoinAnalysis | undefined;
  group: number;
  r: number;
}

interface Link extends SimulationLinkDatum<Node> {
  kind: "same-address" | "would-link";
}

interface Props {
  utxos: Utxo[];
  analysis: Analysis;
  /** Current simulator result, if any; its inputs are highlighted and joined. */
  simulation: Simulation | null;
}

const SURFACE = "#18181b";

export default function CoinGraph({ utxos, analysis, simulation }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<ForceSim<Node, Link> | null>(null);
  const [size, setSize] = useState({ w: 800, h: 480 });
  const [tick, setTick] = useState(0);
  const [hover, setHover] = useState<{ node: Node; x: number; y: number } | null>(null);

  const colors = useMemo(() => assignGroupColors(analysis), [analysis]);
  const infoByKey = useMemo(() => new Map(analysis.coins.map((c) => [coinKey(c), c])), [analysis]);
  const spending = useMemo(() => new Set(simulation?.inputs.map(coinKey) ?? []), [simulation]);

  // Stable node objects across renders so the simulation keeps its positions.
  const nodes = useMemo<Node[]>(() => {
    const max = Math.max(1, ...utxos.map((u) => u.value));
    const many = utxos.length > 60;
    return utxos.map((u) => {
      const info = infoByKey.get(coinKey(u));
      const r = (many ? 5 : 8) + Math.sqrt(u.value / max) * (many ? 14 : 26);
      return { id: coinKey(u), utxo: u, info, group: info?.clusterId ?? 0, r };
    });
  }, [utxos, infoByKey]);

  // Coins on the same address are tied by an observable fact. Only these
  // links shape the layout, so the map stays still while the user types.
  const addressLinks = useMemo<Link[]>(() => {
    const out: Link[] = [];
    const byAddr = new Map<string, Node[]>();
    for (const n of nodes) byAddr.set(n.utxo.address, [...(byAddr.get(n.utxo.address) ?? []), n]);
    for (const group of byAddr.values()) {
      for (let i = 1; i < group.length; i++) out.push({ source: group[i - 1]!, target: group[i]!, kind: "same-address" });
    }
    return out;
  }, [nodes]);

  // A simulated spend that draws from several groups would join them.
  const spendLinks = useMemo<Link[]>(() => {
    const out: Link[] = [];
    if (simulation && simulation.clustersTouched.length > 1) {
      const inputs = nodes.filter((n) => spending.has(n.id));
      // Join across groups only: one edge from each input to the first input of every other group.
      const firstOfGroup = new Map<number, Node>();
      for (const n of inputs) if (!firstOfGroup.has(n.group)) firstOfGroup.set(n.group, n);
      const reps = [...firstOfGroup.values()];
      for (let i = 0; i < reps.length; i++)
        for (let j = i + 1; j < reps.length; j++) out.push({ source: reps[i]!, target: reps[j]!, kind: "would-link" });
    }
    return out;
  }, [nodes, simulation, spending]);

  const links = useMemo(() => [...addressLinks, ...spendLinks], [addressLinks, spendLinks]);

  // Observe container size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.max(320, e!.contentRect.width);
      setSize({ w, h: Math.max(360, Math.min(640, w * 0.6)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // (Re)build the simulation when the node set changes.
  useEffect(() => {
    const groups = [...new Set(nodes.map((n) => n.group))];
    // Anchor each group on a ring so hulls do not overlap; big groups nearer the centre.
    const anchors = new Map<number, { x: number; y: number }>();
    const R = Math.min(size.w, size.h) * (groups.length > 1 ? 0.3 : 0);
    groups.forEach((g, i) => {
      const a = (i / groups.length) * Math.PI * 2 - Math.PI / 2;
      anchors.set(g, { x: size.w / 2 + Math.cos(a) * R, y: size.h / 2 + Math.sin(a) * R });
    });

    const sim = forceSimulation<Node, Link>(nodes)
      .force("charge", forceManyBody<Node>().strength((n) => -Math.max(40, n.r * 6)))
      .force("collide", forceCollide<Node>((n) => n.r + 10).iterations(2))
      .force("x", forceX<Node>((n) => anchors.get(n.group)!.x).strength(0.12))
      .force("y", forceY<Node>((n) => anchors.get(n.group)!.y).strength(0.12))
      .force(
        "link",
        forceLink<Node, Link>(addressLinks)
          .id((n) => n.id)
          .distance((l) => (l.source as Node).r + (l.target as Node).r + 34)
          .strength(0.8),
      )
      .alpha(1)
      .alphaDecay(0.035)
      .on("tick", () => {
        // Keep nodes inside the viewport.
        for (const n of nodes) {
          if (n.x != null) n.x = Math.max(n.r + 8, Math.min(size.w - n.r - 8, n.x));
          if (n.y != null) n.y = Math.max(n.r + 24, Math.min(size.h - n.r - 8, n.y));
        }
        setTick((t) => t + 1);
      });

    simRef.current = sim;
    return () => {
      sim.stop();
    };
  }, [nodes, addressLinks, size.w, size.h]);

  const hulls = useMemo(() => {
    void tick;
    const byGroup = new Map<number, Node[]>();
    for (const n of nodes) byGroup.set(n.group, [...(byGroup.get(n.group) ?? []), n]);
    return [...byGroup.entries()].map(([group, members]) => {
      const pts: [number, number][] = [];
      const pad = 14;
      for (const n of members) {
        const x = n.x ?? size.w / 2;
        const y = n.y ?? size.h / 2;
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2;
          pts.push([x + Math.cos(a) * (n.r + pad), y + Math.sin(a) * (n.r + pad)]);
        }
      }
      const hull = polygonHull(pts) ?? pts;
      const [cx] = polygonCentroid(hull);
      const top = Math.min(...hull.map((p) => p[1]));
      const value = members.reduce((s, n) => s + n.utxo.value, 0);
      return { group, hull, labelX: cx, labelY: top - 8, value, count: members.length };
    });
  }, [nodes, tick, size.w, size.h]);

  // Drag.
  const drag = useRef<{ node: Node } | null>(null);
  const toLocal = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as SVGElement).closest("svg")!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * size.w, y: ((e.clientY - rect.top) / rect.height) * size.h };
  };

  const showLabels = nodes.length <= 40;
  const colorOf = (g: number) => groupColor(colors, g);

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="block w-full rounded-lg border border-zinc-800"
        style={{ background: SURFACE, height: size.h }}
        role="img"
        aria-label="Map of your coins grouped by what an outsider can already link together"
        onPointerMove={(e) => {
          if (!drag.current) return;
          const p = toLocal(e);
          drag.current.node.fx = p.x;
          drag.current.node.fy = p.y;
        }}
        onPointerUp={() => {
          if (!drag.current) return;
          drag.current.node.fx = null;
          drag.current.node.fy = null;
          simRef.current?.alphaTarget(0);
          drag.current = null;
        }}
        onPointerLeave={() => setHover(null)}
      >
        {/* Group hulls */}
        {hulls.map((h) => (
          <g key={h.group}>
            <path
              d={`M${h.hull.map((p) => p.join(",")).join("L")}Z`}
              fill={colorOf(h.group)}
              fillOpacity={0.08}
              stroke={colorOf(h.group)}
              strokeOpacity={0.3}
              strokeWidth={24}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path d={`M${h.hull.map((p) => p.join(",")).join("L")}Z`} fill={colorOf(h.group)} fillOpacity={0.08} />
          </g>
        ))}

        {/* Links */}
        {links.map((l, i) => {
          const s = l.source as Node;
          const t = l.target as Node;
          if (s.x == null || t.x == null) return null;
          const would = l.kind === "would-link";
          return (
            <line
              key={i}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke={would ? SPEND_HIGHLIGHT : "#a1a1aa"}
              strokeWidth={would ? 2.5 : 2}
              strokeDasharray={would ? "6 5" : undefined}
              strokeOpacity={would ? 0.95 : 0.6}
            >
              {would && <animate attributeName="stroke-dashoffset" from="22" to="0" dur="1.2s" repeatCount="indefinite" />}
            </line>
          );
        })}

        {/* Group labels */}
        {hulls.map((h) => (
          <text
            key={`l${h.group}`}
            x={h.labelX}
            y={h.labelY}
            textAnchor="middle"
            fontSize={12}
            fontWeight={600}
            fill="#e4e4e7"
            stroke={SURFACE}
            strokeWidth={4}
            paintOrder="stroke"
          >
            Group {h.group + 1} · {formatBtcShort(h.value)}
          </text>
        ))}

        {/* Coins */}
        {nodes.map((n) => {
          if (n.x == null || n.y == null) return null;
          const spent = spending.has(n.id);
          const label = n.info?.labels[0]?.text;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              style={{ cursor: "grab" }}
              onPointerDown={(e) => {
                (e.target as Element).setPointerCapture?.(e.pointerId);
                drag.current = { node: n };
                simRef.current?.alphaTarget(0.25).restart();
              }}
              onPointerEnter={(e) => {
                const rect = wrapRef.current!.getBoundingClientRect();
                setHover({ node: n, x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              onPointerMove={(e) => {
                if (drag.current) return;
                const rect = wrapRef.current!.getBoundingClientRect();
                setHover({ node: n, x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              onPointerLeave={() => setHover(null)}
            >
              {/* Larger invisible hit target */}
              <circle r={n.r + 8} fill="transparent" />
              {spent && (
                <circle r={n.r + 5} fill="none" stroke={SPEND_HIGHLIGHT} strokeWidth={3}>
                  <animate attributeName="r" values={`${n.r + 4};${n.r + 7};${n.r + 4}`} dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              <circle r={n.r} fill={colorOf(n.group)} stroke={SURFACE} strokeWidth={2} />
              {n.utxo.chain === 1 && <circle r={Math.max(2, n.r * 0.3)} fill={SURFACE} fillOpacity={0.9} />}
              {(n.info?.addressUseCount ?? 1) > 1 && (
                <circle r={n.r} fill="none" stroke="#a1a1aa" strokeWidth={1.5} strokeDasharray="3 3" />
              )}
              {showLabels && (label || n.r >= 14) && (
                <text
                  y={n.r + 13}
                  textAnchor="middle"
                  fontSize={11}
                  fill={label ? "#e4e4e7" : "#a1a1aa"}
                  stroke={SURFACE}
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {label ?? formatBtcShort(n.utxo.value).replace(" BTC", "")}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 w-56 rounded-md border border-zinc-700 bg-zinc-950/95 p-2.5 text-xs shadow-xl"
          style={{ left: Math.min(hover.x + 14, size.w - 240), top: hover.y + 14 }}
        >
          <div className="font-semibold text-zinc-100">{formatBtc(hover.node.utxo.value)}</div>
          {hover.node.info?.labels.length ? (
            <div className="text-zinc-300">{hover.node.info.labels.map((l) => l.text).join(", ")}</div>
          ) : (
            <div className="text-zinc-500">no name yet</div>
          )}
          {hover.node.info && <div className="mt-1 text-zinc-400">{ORIGIN[hover.node.info.origin.kind]}</div>}
          <div className="mt-1 flex items-center gap-1.5 text-zinc-400">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorOf(hover.node.group) }} />
            Group {hover.node.group + 1}
            {(hover.node.info?.addressUseCount ?? 1) > 1 && <span>· shared address</span>}
            {spending.has(hover.node.id) && <span className="text-amber-300">· would be spent</span>}
          </div>
          <div className="mt-1 truncate font-mono text-[10px] text-zinc-500">{hover.node.utxo.address}</div>
        </div>
      )}

      <Legend colors={colors} analysis={analysis} hasSpend={spending.size > 0} />
    </div>
  );
}

function Legend({ colors, analysis, hasSpend }: { colors: ReturnType<typeof assignGroupColors>; analysis: Analysis; hasSpend: boolean }) {
  const named = [...colors.entries()].filter(([, c]) => c.named);
  const others = analysis.clusters.length - named.length;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-400">
      <span className="text-zinc-500">Each bubble is a coin, sized by value. A shaded area is a group an outsider can already tie together.</span>
      {named.map(([id, c]) => (
        <span key={id} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.fill }} /> Group {id + 1}
        </span>
      ))}
      {others > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: GROUP_OTHER }} /> other groups
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: `radial-gradient(circle, ${SURFACE} 0 30%, #71717a 31%)` }}
        />
        change coin (dot in the middle)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-0 w-5 border-t-2 border-zinc-400" /> same address
      </span>
      {hasSpend && (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: SPEND_HIGHLIGHT }} /> would be spent
          <span className="ml-1 inline-block h-0 w-5 border-t-2 border-dashed" style={{ borderColor: SPEND_HIGHLIGHT }} /> new link
        </span>
      )}
    </div>
  );
}
