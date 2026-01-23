import { inject } from "src/lib/core/di";
import { PlotModel } from "src/model/Plot.model";
import LoggerService from "../base/LoggerService";
import { TYPES } from "src/lib/core/types";

export type PlotExtractConfig = {
  plot: string;
  barsBack?: number;
  transform?: (value: number) => any;
};

export type PlotMapping<T> = {
  [K in keyof T]: string | PlotExtractConfig;
};

const GET_VALUE_FN = (
  plots: PlotModel,
  name: string,
  barsBack: number = 0,
): number => {
  const data = plots[name]?.data;
  if (!data || data.length === 0) return 0;
  const idx = data.length - 1 - barsBack;
  return idx >= 0 ? (data[idx]?.value ?? 0) : 0;
};

export class PineDataService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  public extract<T>(plots: PlotModel, mapping: PlotMapping<T>): T {
    this.loggerService.log("pineDataService extract", {
      plotCount: Object.keys(plots).length,
      mapping,
    });

    const result = {} as T;

    for (const key in mapping) {
      const config = mapping[key];

      if (typeof config === "string") {
        Object.assign(result, { [key]: GET_VALUE_FN(plots, config) });
      } else {
        const value = GET_VALUE_FN(plots, config.plot, config.barsBack ?? 0);
        Object.assign(result, {
          [key]: config.transform ? config.transform(value) : value,
        });
      }
    }

    return result;
  }
}

export default PineDataService;
