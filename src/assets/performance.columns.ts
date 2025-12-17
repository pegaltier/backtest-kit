import { ColumnModel } from "../model/Column.model";
import { MetricStats } from "../model/PerformanceStatistics.model";

/**
 * Column configuration for performance metrics markdown reports.
 *
 * Defines the table structure for displaying performance statistics and timing metrics in performance reports.
 * Each column specifies how to format and display aggregated performance data for different metric types.
 *
 * Used by {@link PerformanceMarkdownService} to generate markdown tables showing:
 * - Metric identification (metric type)
 * - Execution statistics (count, total duration, average, min, max)
 * - Distribution metrics (standard deviation, median, percentiles)
 * - Wait time statistics (average, min, max wait times between events)
 *
 * @remarks
 * This configuration helps identify performance bottlenecks in strategy execution.
 * The service automatically sorts metrics by total duration to highlight the slowest operations.
 * All durations are measured in milliseconds.
 *
 * @example
 * ```typescript
 * import { performance_columns } from "./assets/performance.columns";
 *
 * // Use with PerformanceMarkdownService
 * const service = new PerformanceMarkdownService();
 * await service.getReport("BTCUSDT", "my-strategy", performance_columns);
 *
 * // Or customize for bottleneck analysis
 * const customColumns = performance_columns.filter(col =>
 *   ["metricType", "count", "avgDuration", "maxDuration", "p95"].includes(col.key)
 * );
 * await service.getReport("BTCUSDT", "my-strategy", customColumns);
 * ```
 *
 * @see {@link PerformanceMarkdownService} for usage in report generation
 * @see {@link ColumnModel} for column interface definition
 * @see {@link MetricStats} for data structure
 */
export const performance_columns: ColumnModel<MetricStats>[] = [
  {
    key: "metricType",
    label: "Metric Type",
    format: (data) => data.metricType,
    isVisible: () => true,
  },
  {
    key: "count",
    label: "Count",
    format: (data) => data.count.toString(),
    isVisible: () => true,
  },
  {
    key: "totalDuration",
    label: "Total (ms)",
    format: (data) => data.totalDuration.toFixed(2),
    isVisible: () => true,
  },
  {
    key: "avgDuration",
    label: "Avg (ms)",
    format: (data) => data.avgDuration.toFixed(2),
    isVisible: () => true,
  },
  {
    key: "minDuration",
    label: "Min (ms)",
    format: (data) => data.minDuration.toFixed(2),
    isVisible: () => true,
  },
  {
    key: "maxDuration",
    label: "Max (ms)",
    format: (data) => data.maxDuration.toFixed(2),
    isVisible: () => true,
  },
  {
    key: "stdDev",
    label: "Std Dev (ms)",
    format: (data) => data.stdDev.toFixed(2),
    isVisible: () => true,
  },
  {
    key: "median",
    label: "Median (ms)",
    format: (data) => data.median.toFixed(2),
    isVisible: () => true,
  },
  {
    key: "p95",
    label: "P95 (ms)",
    format: (data) => data.p95.toFixed(2),
    isVisible: () => true,
  },
  {
    key: "p99",
    label: "P99 (ms)",
    format: (data) => data.p99.toFixed(2),
    isVisible: () => true,
  },
  {
    key: "avgWaitTime",
    label: "Avg Wait (ms)",
    format: (data) => data.avgWaitTime.toFixed(2),
    isVisible: () => true,
  },
  {
    key: "minWaitTime",
    label: "Min Wait (ms)",
    format: (data) => data.minWaitTime.toFixed(2),
    isVisible: () => true,
  },
  {
    key: "maxWaitTime",
    label: "Max Wait (ms)",
    format: (data) => data.maxWaitTime.toFixed(2),
    isVisible: () => true,
  },
];
