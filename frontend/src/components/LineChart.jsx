/**
 * LineChart — SVG line chart, generic, reusable.
 *
 * Props:
 *   title: string
 *   xLabel: string
 *   yLabel: string
 *   series: [{ name, color, points: [{ x, y }] }]
 *   yFormatter: (v) => string (default: (v) => v.toFixed(2))
 *   width: number (default 600, viewBox)
 *   height: number (default 320, viewBox)
 *
 * Behavior:
 *   - Renders axes, gridlines, polylines, markers, legend.
 *   - Empty state if all series have zero points.
 */
export default function LineChart({
  title,
  xLabel = 'X',
  yLabel = 'Y',
  series = [],
  yFormatter = (v) => Number(v).toFixed(2),
  width = 600,
  height = 320,
}) {
  const padding = { top: 32, right: 24, bottom: 56, left: 64 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const allPoints = series.flatMap((s) => s.points || []);
  const hasData = allPoints.length > 0;

  let xMin = 0, xMax = 1, yMin = 0, yMax = 1;
  if (hasData) {
    const xs = allPoints.map((p) => p.x);
    const ys = allPoints.map((p) => p.y);
    xMin = Math.min(...xs);
    xMax = Math.max(...xs);
    const yExtent = Math.max(...ys) - Math.min(...ys);
    yMin = Math.min(...ys);
    yMax = Math.max(...ys);
    if (yExtent === 0) {
      yMin = yMin - 1;
      yMax = yMax + 1;
    } else {
      yMin = yMin - yExtent * 0.1;
      yMax = yMax + yExtent * 0.1;
    }
  }

  const xScale = (x) =>
    padding.left + ((x - xMin) / Math.max(xMax - xMin, 1e-9)) * plotW;
  const yScale = (y) =>
    padding.top + plotH - ((y - yMin) / Math.max(yMax - yMin, 1e-9)) * plotH;

  // Y-axis ticks (5 evenly spaced)
  const yTicks = [];
  for (let i = 0; i <= 4; i++) {
    yTicks.push(yMin + ((yMax - yMin) * i) / 4);
  }
  // X-axis ticks: unique x values from series
  const xTickSet = new Set();
  series.forEach((s) => (s.points || []).forEach((p) => xTickSet.add(p.x)));
  const xTicks = Array.from(xTickSet).sort((a, b) => a - b);

  return (
    <div className="section-card">
      <div className="section-card-header">
        <h3>{title}</h3>
      </div>

      {!hasData ? (
        <div className="empty-state">
          Data belum tersedia untuk grafik ini. Jalankan ABC Optimization untuk
          skenario terkait agar titik data muncul.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            style={{ minWidth: 320, maxWidth: 760, display: 'block', margin: '0 auto' }}
            role="img"
            aria-label={title}
          >
            {/* Gridlines (Y) */}
            {yTicks.map((t, i) => (
              <line
                key={`grid-${i}`}
                x1={padding.left}
                x2={padding.left + plotW}
                y1={yScale(t)}
                y2={yScale(t)}
                stroke="#e5e7eb"
                strokeDasharray="2 4"
              />
            ))}
            {/* Axes */}
            <line
              x1={padding.left}
              x2={padding.left + plotW}
              y1={padding.top + plotH}
              y2={padding.top + plotH}
              stroke="#374151"
            />
            <line
              x1={padding.left}
              x2={padding.left}
              y1={padding.top}
              y2={padding.top + plotH}
              stroke="#374151"
            />
            {/* Y tick labels */}
            {yTicks.map((t, i) => (
              <text
                key={`yt-${i}`}
                x={padding.left - 8}
                y={yScale(t)}
                fontSize="11"
                fill="#374151"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {yFormatter(t)}
              </text>
            ))}
            {/* Y axis label */}
            <text
              x={-(padding.top + plotH / 2)}
              y={16}
              transform="rotate(-90)"
              fontSize="11"
              fill="#4b5563"
              fontWeight="600"
              textAnchor="middle"
            >
              {yLabel}
            </text>
            {/* X tick labels */}
            {xTicks.map((t, i) => (
              <text
                key={`xt-${i}`}
                x={xScale(t)}
                y={padding.top + plotH + 18}
                fontSize="11"
                fill="#374151"
                textAnchor="middle"
              >
                {t}
              </text>
            ))}
            {/* X axis label */}
            <text
              x={padding.left + plotW / 2}
              y={height - 12}
              fontSize="11"
              fill="#4b5563"
              fontWeight="600"
              textAnchor="middle"
            >
              {xLabel}
            </text>
            {/* Series lines + markers */}
            {series.map((s, si) => {
              const pts = (s.points || []).slice().sort((a, b) => a.x - b.x);
              if (pts.length === 0) return null;
              const path = pts
                .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x)} ${yScale(p.y)}`)
                .join(' ');
              return (
                <g key={`series-${si}`}>
                  <path
                    d={path}
                    fill="none"
                    stroke={s.color || '#047857'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {pts.map((p, i) => (
                    <circle
                      key={`pt-${si}-${i}`}
                      cx={xScale(p.x)}
                      cy={yScale(p.y)}
                      r="4"
                      fill={s.color || '#047857'}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  ))}
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'center',
              padding: '8px 0 0',
            }}
          >
            {series.map((s, i) => (
              <div
                key={`legend-${i}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: '#374151',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 14,
                    height: 4,
                    background: s.color || '#047857',
                    borderRadius: 2,
                  }}
                />
                {s.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}