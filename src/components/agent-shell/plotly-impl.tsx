"use client";

// Client-only Plotly renderer built on the lightweight basic dist (bar / scatter /
// pie only — all we need). Loaded exclusively via next/dynamic({ ssr: false }) from
// agent-plotly-chart.tsx so plotly never touches the server bundle.

import createPlotlyComponent from "react-plotly.js/factory";
// @ts-expect-error - plotly.js-basic-dist-min ships no type declarations
import Plotly from "plotly.js-basic-dist-min";

const Plot = createPlotlyComponent(Plotly);

export default function PlotlyImpl({
  data,
  layout,
  config,
  style,
}: {
  data: unknown[];
  layout: Record<string, unknown>;
  config?: Record<string, unknown>;
  style?: React.CSSProperties;
}) {
  return (
    <Plot
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data={data as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      layout={layout as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config={{ displayModeBar: false, responsive: true, ...(config as any) }}
      style={{ width: "100%", height: "100%", ...style }}
      useResizeHandler
    />
  );
}
