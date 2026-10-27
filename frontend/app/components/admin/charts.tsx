"use client";

import { useId } from "react";
import type { SeriesPoint } from "../../lib/admin/types";
import { Empty, DateText } from "./ui";

export function TrendChart({ data, label }: { data: SeriesPoint[] | null; label: string }) {
  const id = useId();
  if (data === null) return <Empty title="Trend unavailable">This metric requires server-provided activity history.</Empty>;
  if (data.length === 0) return <Empty title="No activity in this period">Try a different reporting period to explore available records.</Empty>;
  const max = Math.max(1, ...data.map(point => point.value));
  const x = (index: number) => 42 + index * 506 / Math.max(1, data.length - 1);
  const y = (value: number) => 148 - value / max * 116;
  const points = data.map((point, i) => `${x(i)},${y(point.value)}`).join(" ");
  return <div className="adm-chart"><svg viewBox="0 0 580 186" role="img" aria-labelledby={id}><title id={id}>{label}. {data.length} reporting intervals. Exact values are available in the data table below.</title>{[0, 0.5, 1].map(tick => <g key={tick}><line x1="42" x2="548" y1={y(max * tick)} y2={y(max * tick)} className="adm-chart-grid" /><text x="29" y={y(max * tick) + 4} textAnchor="end">{new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(max * tick)}</text></g>)}<polyline points={points} fill="none" stroke="var(--action)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />{data.length <= 31 && data.map((point, i) => <circle key={`${point.date}-${i}`} cx={x(i)} cy={y(point.value)} r="3" fill="var(--surface)" stroke="var(--action)" strokeWidth="2"><title>{point.date}: {point.value}</title></circle>)}<text x="42" y="178">{data[0].date.slice(0, 10)}</text><text x="548" y="178" textAnchor="end">{data.at(-1)!.date.slice(0, 10)}</text></svg><details className="adm-chart-data"><summary>View chart data</summary><div className="adm-table-scroll" tabIndex={0} role="region" aria-label={`${label} data`}><table className="adm-table"><caption className="sr-only">{label}</caption><thead><tr><th scope="col">Date (UTC)</th><th scope="col">Count</th></tr></thead><tbody>{data.map((point, i) => <tr key={`${point.date}-${i}`}><td><DateText value={point.date} /></td><td>{point.value}</td></tr>)}</tbody></table></div></details></div>;
}
export function Distribution({ data, unavailable = "Distribution data is not available yet." }: { data: { label: string; count: number; tone?: string }[] | null; unavailable?: string }) {
  if (data === null) return <Empty title="Distribution unavailable">{unavailable}</Empty>;
  const total = data.reduce((sum, item) => sum + item.count, 0);
  if (!total) return <Empty title="No records to compare">A distribution will appear when records are available.</Empty>;
  return <div className="adm-distribution"><div className="adm-distribution-total"><strong>{total.toLocaleString("en")}</strong><span>Total records</span></div>{data.map(item => <div className="adm-distribution-row" key={item.label}><div><span><i className={item.tone ?? ""} />{item.label}</span><strong>{item.count.toLocaleString("en")}</strong></div><div className="adm-meter" role="meter" aria-label={item.label} aria-valuenow={item.count} aria-valuemin={0} aria-valuemax={total}><span className={item.tone ?? ""} style={{ width: `${item.count / total * 100}%` }} /></div></div>)}</div>;
}
