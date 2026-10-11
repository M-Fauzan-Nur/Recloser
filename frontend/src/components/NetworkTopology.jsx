/** Directed-graph tree layout for network topology visualization.
 *
 * Layout algorithm (do not change):
 *  1. Build directed graph from from_bus → to_bus
 *  2. Find root: node with in-degree = 0
 *  3. Simple tree layout:
 *       - x = depth * H_SPACING (left = root, right = deeper)
 *       - y = even vertical distribution within each depth level
 *  4. Draw edges with SVG lines; arrowheads indicate direction
 *  5. Diamond markers at line midpoints for recloser lines
 *  6. Fit-to-view viewBox with margin
 *
 * Zoom / Pan:
 *  - transform applied to inner <g> that wraps ALL elements
 *  - Zoom: buttons, mouse wheel, pinch
 *  - Pan: click + drag when pointer is over SVG
 *  - Fit: resets transform to show full topology
 */

import { useState, useRef, useCallback, useEffect } from 'react';

/* ─── Layout constants ─────────────────────────────────────────────────── */
const H_SPACING = 110;
const V_SPACING = 30;
const MARGIN_X = 60;
const MARGIN_Y = 40;
const SVG_MIN_HEIGHT = 600;

/* ─── Zoom limits ──────────────────────────────────────────────────────── */
const MIN_SCALE = 1.0;   // Fit-to-view scale (no zoom out past this)
const MAX_SCALE = 5.0;

/* ─── Helpers ──────────────────────────────────────────────────────────── */

/** "line_27" → 27, 27 → 27 */
function normaliseLineId(id) {
  if (id === null || id === undefined) return null;
  const s = String(id).trim();
  const m = s.match(/^line_?(\d+)$/i);
  return m ? parseInt(m[1], 10) : parseInt(s, 10);
}

/** Build directed adjacency list + in-degree */
function buildDirectedGraph(topologyMap) {
  const adj = {};
  const inDegree = {};
  const allBuses = new Set();

  Object.values(topologyMap).forEach(info => {
    const from = Number(info.from_bus);
    const to = Number(info.to_bus);
    if (isNaN(from) || isNaN(to)) return;
    allBuses.add(from);
    allBuses.add(to);
    if (!adj[from]) adj[from] = [];
    adj[from].push(to);
    inDegree[to] = (inDegree[to] || 0) + 1;
    if (inDegree[from] === undefined) inDegree[from] = 0;
  });

  return { adj, inDegree, allBuses };
}

/** Root: node with in-degree === 0 */
function findRoot(inDegree, allBuses) {
  for (const bus of allBuses) {
    if ((inDegree[bus] || 0) === 0) return bus;
  }
  return 1;
}

/** BFS: collect buses grouped by depth from root */
function collectByDepth(root, adj) {
  const depthBuckets = [];
  const visited = new Set();

  function traverse(bus, depth) {
    if (visited.has(bus)) return;
    visited.add(bus);
    if (!depthBuckets[depth]) depthBuckets[depth] = [];
    depthBuckets[depth].push(bus);
    const children = adj[bus] || [];
    for (const childBus of children) traverse(childBus, depth + 1);
  }

  traverse(root, 0);
  return { depthBuckets };
}

/* ─── ZoomControls sub-component ─────────────────────────────────────────── */

function ZoomControls({ scale, onZoomIn, onZoomOut, onFit }) {
  return (
    <div style={{
      position: 'absolute',
      top: 8,
      right: 8,
      display: 'flex',
      gap: 4,
      zIndex: 10,
    }}>
      <button
        onClick={onZoomOut}
        title="Zoom Out"
        style={BASE_BTN}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="3" y="7" width="10" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>
      <button
        onClick={onZoomIn}
        title="Zoom In"
        style={BASE_BTN}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="3" y="7" width="10" height="2" rx="1" fill="currentColor" />
          <rect x="7" y="3" width="2" height="10" rx="1" fill="currentColor" />
        </svg>
      </button>
      <button
        onClick={onFit}
        title="Fit to View"
        style={{
          ...btnStyle(scale > MIN_SCALE + 0.01),
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.02em',
          padding: '0 8px',
          minWidth: 36,
        }}
      >
        FIT
      </button>
    </div>
  );
}

function btnStyle(enabled) {
  return {
    width: 30,
    height: 30,
    border: '1px solid #d1d5db',
    borderRadius: 6,
    background: enabled ? '#fff' : '#f3f4f6',
    color: enabled ? '#374151' : '#9ca3af',
    cursor: enabled ? 'pointer' : 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    transition: 'background 0.15s, color 0.15s',
  };
}

const BASE_BTN = {
  width: 30,
  height: 30,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'background 0.15s, color 0.15s',
};

/* ─── Main export ──────────────────────────────────────────────────────── */

export default function TopologyVisualization({ topologyMap, abcResults }) {
  if (!topologyMap || Object.keys(topologyMap).length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '32px 16px',
        color: 'var(--color-text-muted, #6b7280)',
        fontSize: 14,
        border: '1px dashed #d1d5db',
        borderRadius: 8,
      }}>
        Network topology tidak tersedia. Upload Network Data terlebih dahulu.
      </div>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────
  const { adj, inDegree, allBuses } = buildDirectedGraph(topologyMap);
  const root = findRoot(inDegree, allBuses);
  const { depthBuckets } = collectByDepth(root, adj);

  // Assign x = depth * H_SPACING, y = evenly distributed per depth
  const positions = {};
  depthBuckets.forEach((buses, depth) => {
    if (!buses || buses.length === 0) return;
    const x = depth * H_SPACING;
    const totalSpan = (buses.length - 1) * V_SPACING;
    const startY = -totalSpan / 2;
    buses.forEach((bus, i) => {
      positions[bus] = { x, y: startY + i * V_SPACING };
    });
  });

  // ── Recloser line IDs ────────────────────────────────────────────────
  const recloserLineIds = new Set(
    (abcResults?.optimal?.positions || [])
      .map(p => normaliseLineId(p))
      .filter(n => n !== null && !isNaN(n))
  );

  // ── Edges ───────────────────────────────────────────────────────────
  const edges = Object.entries(topologyMap).map(([lid, info]) => {
    const lineId = normaliseLineId(lid);
    const fromPos = positions[Number(info.from_bus)];
    const toPos = positions[Number(info.to_bus)];
    if (!fromPos || !toPos) return null;
    return {
      lineId,
      isRecloser: recloserLineIds.has(lineId),
      x1: fromPos.x, y1: fromPos.y,
      x2: toPos.x,   y2: toPos.y,
      mx: (fromPos.x + toPos.x) / 2,
      my: (fromPos.y + toPos.y) / 2,
    };
  }).filter(Boolean);

  // ── Bus nodes ────────────────────────────────────────────────────────
  const busNodes = Object.entries(positions).map(([bus, pos]) => ({
    bus: Number(bus),
    x: pos.x,
    y: pos.y,
    isRoot: Number(bus) === root,
  }));

  if (busNodes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>
        Topology layout tidak dapat dihitung.
      </div>
    );
  }

  // ── SVG bounds ───────────────────────────────────────────────────────
  const xs = busNodes.map(n => n.x);
  const ys = busNodes.map(n => n.y);
  const bMinX = Math.min(...xs);
  const bMaxX = Math.max(...xs);
  const bMinY = Math.min(...ys);
  const bMaxY = Math.max(...ys);
  const rawW = bMaxX - bMinX + MARGIN_X * 2;
  const rawH = bMaxY - bMinY + MARGIN_Y * 2;
  const svgW = Math.max(rawW, 400);
  const svgH = Math.max(rawH, SVG_MIN_HEIGHT);

  // Origin offset so topology sits nicely inside the viewport
  const originX = -(bMinX - MARGIN_X);
  const originY = -(bMinY - MARGIN_Y);

  // ── Zoom/pan state ───────────────────────────────────────────────────
  const [transform, setTransform] = useState({ scale: 1, tx: 0, ty: 0 });
  const svgRef = useRef(null);
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  // Fit: reset to show full topology
  const handleFit = useCallback(() => {
    setTransform({ scale: 1, tx: 0, ty: 0 });
  }, []);

  // Zoom in/out centred on the SVG centre
  const zoomBy = useCallback((delta) => {
    setTransform(prev => {
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * delta));
      // When zooming towards 1 (fit), reset translation to 0 for clean fit
      if (newScale <= MIN_SCALE + 0.01) {
        return { scale: 1, tx: 0, ty: 0 };
      }
      return { scale: newScale, tx: prev.tx, ty: prev.ty };
    });
  }, []);

  const handleZoomIn = useCallback(() => zoomBy(1.25), [zoomBy]);
  const handleZoomOut = useCallback(() => zoomBy(0.8), [zoomBy]);

  // Mouse wheel zoom toward cursor
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const delta = e.deltaY < 0 ? 1.1 : 0.9;

    setTransform(prev => {
      const rawScale = prev.scale * delta;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));

      if (newScale <= MIN_SCALE + 0.01) {
        return { scale: 1, tx: 0, ty: 0 };
      }

      // Zoom towards cursor: adjust translation so the point under cursor stays fixed
      const scaleRatio = newScale / prev.scale;
      const newTx = cursorX - scaleRatio * (cursorX - prev.tx);
      const newTy = cursorY - scaleRatio * (cursorY - prev.ty);

      return { scale: newScale, tx: newTx, ty: newTy };
    });
  }, []);

  // Register wheel listener (must be non-passive to preventDefault)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Pan: pointer drag
  const handlePointerDown = useCallback((e) => {
    // Only pan with left mouse button or single touch
    if (e.button !== 0) return;
    isPanning.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setTransform(prev => ({ ...prev, tx: prev.tx + dx, ty: prev.ty + dy }));
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Touch pinch zoom
  const lastTouches = useRef(null);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const [t1, t2] = e.touches;
      lastTouches.current = {
        dist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
        mx: (t1.clientX + t2.clientX) / 2,
        my: (t1.clientY + t2.clientY) / 2,
        scale: transform.scale,
        tx: transform.tx,
        ty: transform.ty,
      };
    } else {
      lastTouches.current = null;
    }
  }, [transform]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && lastTouches.current) {
      e.preventDefault();
      const [t1, t2] = e.touches;
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const mx = (t1.clientX + t2.clientX) / 2;
      const my = (t1.clientY + t2.clientY) / 2;
      const prev = lastTouches.current;
      const delta = dist / prev.dist;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * delta));

      if (newScale <= MIN_SCALE + 0.01) {
        setTransform({ scale: 1, tx: 0, ty: 0 });
        lastTouches.current = null;
        return;
      }

      const scaleRatio = newScale / prev.scale;
      setTransform({
        scale: newScale,
        tx: mx - scaleRatio * (mx - prev.tx),
        ty: my - scaleRatio * (my - prev.ty),
      });
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastTouches.current = null;
  }, []);

  const { scale, tx, ty } = transform;

  // Scale font size so labels stay readable but grow with zoom
  const labelScale = Math.min(scale, 2.0);

  return (
    <div style={{ width: '100%' }}>
      {/* Container with controls overlay */}
      <div style={{ position: 'relative' }}>
        <ZoomControls
          scale={scale}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFit={handleFit}
        />

        {/* SVG viewport — all transforms applied to inner <g> */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgW} ${svgH}`}
          width="100%"
          style={{
            display: 'block',
            background: '#f9fafb',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            fontFamily: 'system-ui, sans-serif',
            cursor: isPanning.current ? 'grabbing' : 'grab',
            touchAction: 'none',  // prevent browser scroll on touch
            maxHeight: 700,
            overflow: 'hidden',
          }}
          aria-label="Network topology with recloser placement"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* All elements inside a transformed group */}
          <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>

            <defs>
              <marker id="arrowhead" markerWidth="7" markerHeight="7"
                refX="7" refY="3.5" orient="auto">
                <path d="M0,0 L0,7 L7,3.5 z" fill="#9ca3af" />
              </marker>
            </defs>

            {/* Translate origin so all coordinates are positive */}
            <g transform={`translate(${originX}, ${originY})`}>

              {/* Edges */}
              {edges.map(({ lineId, x1, y1, x2, y2, mx, my, isRecloser }) => (
                <g key={lineId}>
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={isRecloser ? '#047857' : '#9ca3af'}
                    strokeWidth={isRecloser ? 3 : 1.5}
                    strokeLinecap="round"
                    markerEnd="url(#arrowhead)"
                  />
                  {/* Line ID label */}
                  <text
                    x={mx}
                    y={my - 4}
                    fontSize={8 * labelScale}
                    fill={isRecloser ? '#065f46' : '#9ca3af'}
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {lineId}
                  </text>
                  {/* Recloser diamond at line midpoint */}
                  {isRecloser && (
                    <polygon
                      points={`${mx},${my - 7 * labelScale} ${mx + 6 * labelScale},${my} ${mx},${my + 7 * labelScale} ${mx - 6 * labelScale},${my}`}
                      fill="#047857"
                      stroke="#065f46"
                      strokeWidth="1.5"
                    />
                  )}
                </g>
              ))}

              {/* Bus nodes */}
              {busNodes.map(({ bus, x, y, isRoot }) => {
                const r = isRoot ? 9 : 7;
                const fill = isRoot ? '#1e40af' : '#e5e7eb';
                const stroke = isRoot ? '#1e3a8a' : '#9ca3af';
                const fs = 8 * labelScale;
                return (
                  <g key={bus}>
                    <circle
                      cx={x} cy={y} r={r}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isRoot ? 2 : 1}
                    />
                    <text
                      x={x}
                      y={y + (isRoot ? fs * 0.45 : fs * 0.35)}
                      fontSize={fs}
                      fill={isRoot ? '#fff' : '#374151'}
                      textAnchor="middle"
                      fontWeight={isRoot ? 'bold' : 'normal'}
                    >
                      {bus}
                    </text>
                  </g>
                );
              })}

            </g>
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 20,
        justifyContent: 'center',
        marginTop: 12,
        fontSize: 13,
        flexWrap: 'wrap',
        color: '#374151',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="6" fill="#1e40af" />
          </svg>
          Substation (Bus {root})
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="6" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1" />
          </svg>
          Bus
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="14" height="14" viewBox="0 0 14 14">
            <polygon points="7,1 13,7 7,13 1,7" fill="#047857" stroke="#065f46" strokeWidth="1" />
          </svg>
          Recloser
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="20" height="3" viewBox="0 0 20 3">
            <line x1="0" y1="1.5" x2="20" y2="1.5" stroke="#047857" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Protected Line
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="20" height="3" viewBox="0 0 20 3">
            <line x1="0" y1="1.5" x2="20" y2="1.5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Line
        </span>
      </div>

      {/* Recloser badge chips */}
      {recloserLineIds.size > 0 && (
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginTop: 10,
        }}>
          {Array.from(recloserLineIds).sort((a, b) => a - b).map(lineId => (
            <span
              key={lineId}
              style={{
                background: '#dcfce7',
                color: '#065f46',
                border: '1px solid #047857',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 12,
                fontFamily: 'monospace',
              }}
            >
              line_{lineId}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
