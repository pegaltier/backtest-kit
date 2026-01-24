import { inject } from "../../core/di";
import { PlotModel } from "../../../model/Plot.model";
import LoggerService from "../base/LoggerService";
import { TYPES } from "../../core/types";
import { Markdown, MarkdownName } from "backtest-kit";

/**
 * Unique identifier for signal result.
 */
type ResultId = string | number;

/**
 * Row data extracted from PlotModel for markdown table generation.
 */
interface IPlotRow {
  time: number;
  [key: string]: number | null;
}

/**
 * Default number formatter for indicator values.
 */
const DEFAULT_FORMAT = (v: number | null): string =>
  v !== null ? Number(v).toFixed(4) : "N/A";

/**
 * Checks if a value is unsafe for calculations.
 */
function isUnsafe(value: number | null): boolean {
  if (value === null) return true;
  if (typeof value !== "number") return true;
  if (isNaN(value)) return true;
  if (!isFinite(value)) return true;
  return false;
}

/**
 * Extracts row data from PlotModel at a specific index.
 */
function extractRowAtIndex(
  plots: PlotModel,
  keys: string[],
  index: number,
): IPlotRow | null {
  let time: number | null = null;
  for (const key of keys) {
    const plotData = plots[key]?.data;
    if (plotData && plotData[index]) {
      time = plotData[index].time;
      break;
    }
  }

  if (time === null) return null;

  const row: IPlotRow = { time };

  for (const key of keys) {
    const plotData = plots[key]?.data;
    if (plotData && plotData[index]) {
      const value = plotData[index].value;
      row[key] = isUnsafe(value) ? null : value;
    } else {
      row[key] = null;
    }
  }

  return row;
}

/**
 * Checks if all indicators in a row have valid values.
 * Used for warmup detection.
 */
function isRowWarmedUp(row: IPlotRow, keys: string[]): boolean {
  for (const key of keys) {
    if (!row[key]) {
      return false;
    }
  }
  return true;
}

/**
 * Generates markdown table from plot rows.
 * Columns are dynamically generated from PlotModel keys.
 */
function generateMarkdownTable(
  rows: IPlotRow[],
  keys: string[],
  signalId: ResultId,
): string {
  let markdown = "";

  markdown += `# PineScript Technical Analysis Dump\n\n`;
  markdown += `**Signal ID**: ${String(signalId)}\n\n`;

  // Dynamic columns from PlotModel keys
  const header = `| Timestamp | ${keys.join(" | ")} |\n`;
  const separator = `| --- | ${keys.map(() => "---").join(" | ")} |\n`;

  markdown += header;
  markdown += separator;

  for (const row of rows) {
    const timestamp = new Date(row.time).toISOString();
    const cells = keys.map((key) => DEFAULT_FORMAT(row[key] as number | null));
    markdown += `| ${timestamp} | ${cells.join(" | ")} |\n`;
  }

  return markdown;
}

/**
 * Service for generating markdown reports from Pine Script indicator data.
 *
 * Features:
 * - Dynamic columns from PlotModel keys
 * - Warmup detection (skips rows until all indicators have values)
 * - Configurable output directory
 */
export class PineMarkdownService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  public getData = (plots: PlotModel) => {
    const keys = Object.keys(plots);

    if (keys.length === 0) {
      return;
    }

    const firstPlot = plots[keys[0]];
    const dataLength = firstPlot?.data?.length ?? 0;

    if (dataLength === 0) {
      return;
    }

    const rows: IPlotRow[] = [];
    let warmupComplete = false;

    for (let i = 0; i < dataLength; i++) {
      const row = extractRowAtIndex(plots, keys, i);
      if (!row) continue;

      if (!warmupComplete) {
        if (isRowWarmedUp(row, keys)) {
          warmupComplete = true;
        } else {
          continue;
        }
      }

      rows.push(row);
    }

    return rows;
  };

  public getReport = (signalId: ResultId, plots: PlotModel) => {
    const rows = this.getData(plots);
    const keys = Object.keys(plots);
    return generateMarkdownTable(rows, keys, signalId);
  };

  public dump = async (
    signalId: ResultId,
    plots: PlotModel,
    taName: string,
    outputDir = `./dump/ta/${taName}`,
  ): Promise<void> => {
    this.loggerService.log("pineMarkdownService dumpSignal", {
      signalId,
      plotCount: Object.keys(plots).length,
      outputDir,
    });

    const content = this.getReport(signalId, plots);

    await Markdown.writeData(<MarkdownName>taName, content, {
      path: outputDir,
      file: `${String(signalId)}.md`,
      symbol: "",
      signalId: String(signalId),
      strategyName: "",
      exchangeName: "",
      frameName: "",
    });
  };
}

export default PineMarkdownService;
