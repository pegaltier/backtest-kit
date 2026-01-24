import pine from "../lib";
import { PlotModel } from "../model/Plot.model";

const DUMP_SIGNAL_METHOD_NAME = "dump.dumpSignal";

type ResultId = string | number;

export async function dumpPlotData(
  signalId: ResultId,
  plots: PlotModel,
  taName: string,
  outputDir = "./dump/ta",
): Promise<void> {
  pine.loggerService.log(DUMP_SIGNAL_METHOD_NAME, {
    signalId,
    plotCount: Object.keys(plots).length,
    outputDir,
  });
  return await pine.pineMarkdownService.dump(signalId, plots, taName, outputDir);
}
