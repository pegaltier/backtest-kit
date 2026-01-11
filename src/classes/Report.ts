import * as fs from "fs/promises";
import { createWriteStream, WriteStream } from "fs";
import { join } from "path";
import lib from "../lib";
import { compose, makeExtendable, memoize, singleshot } from "functools-kit";

const REPORT_BASE_METHOD_NAME_CTOR = "ReportBase.CTOR";
const REPORT_BASE_METHOD_NAME_WAIT_FOR_INIT = "ReportBase.waitForInit";
const REPORT_BASE_METHOD_NAME_WRITE = "ReportBase.write";

const REPORT_UTILS_METHOD_NAME_USE_REPORT_ADAPTER = "ReportUtils.useReportAdapter";
const REPORT_UTILS_METHOD_NAME_WRITE_DATA = "ReportUtils.writeReportData";
const REPORT_UTILS_METHOD_NAME_ENABLE = "ReportUtils.enable";

const BASE_WAIT_FOR_INIT_SYMBOL = Symbol("wait-for-init");

interface IReportTarget {
  risk: boolean;
  breakeven: boolean;
  partial: boolean;
  heat: boolean;
  walker: boolean;
  performance: boolean;
  schedule: boolean;
  live: boolean;
  backtest: boolean;
}

export type ReportName = keyof IReportTarget;

export type TReportBase = InstanceType<typeof ReportBase>;

export type TReportBaseCtor = new (reportName: ReportName, baseDir: string) => TReportBase;

export const ReportBase = makeExtendable(
  class {
    _filePath: string;
    _stream: WriteStream | null = null;

    constructor(
      readonly reportName: ReportName,
      readonly baseDir = join(process.cwd(), "./dump/report")
    ) {
      lib.loggerService.debug(REPORT_BASE_METHOD_NAME_CTOR, {
        reportName: this.reportName,
        baseDir,
      });
      this._filePath = join(this.baseDir, `${this.reportName}.jsonl`);
    }

    [BASE_WAIT_FOR_INIT_SYMBOL] = singleshot(async (): Promise<void> => {
      await fs.mkdir(this.baseDir, { recursive: true });
      this._stream = createWriteStream(this._filePath, { flags: "a" });
    });

    async waitForInit(initial: boolean): Promise<void> {
      lib.loggerService.debug(REPORT_BASE_METHOD_NAME_WAIT_FOR_INIT, {
        reportName: this.reportName,
        initial,
      });
      await this[BASE_WAIT_FOR_INIT_SYMBOL]();
    }

    async write<T = any>(data: T): Promise<void> {
      lib.loggerService.debug(REPORT_BASE_METHOD_NAME_WRITE, {
        reportName: this.reportName,
      });
      if (!this._stream) {
        throw new Error(
          `Stream not initialized for report ${this.reportName}. Call waitForInit() first.`
        );
      }
      const line = JSON.stringify(data) + "\n";
      this._stream.write(line);
    }
  }
);

const WILDCARD_TARGET: IReportTarget = {
  backtest: true,
  breakeven: true,
  heat: true,
  live: true,
  partial: true,
  performance: true,
  risk: true,
  schedule: true,
  walker: true,
};

export class ReportUtils {
  public enable = ({
    backtest: bt = false,
    breakeven = false,
    heat = false,
    live = false,
    partial = false,
    performance = false,
    risk = false,
    schedule = false,
    walker = false,
  }: Partial<IReportTarget> = WILDCARD_TARGET) => {
    lib.loggerService.debug(REPORT_UTILS_METHOD_NAME_ENABLE, {
      backtest: bt,
      breakeven,
      heat,
      live,
      partial,
      performance,
      risk,
      schedule,
      walker,
    });
    const unList: Function[] = [];
    if (bt) {
      unList.push(lib.backtestReportService.subscribe());
    }
    if (breakeven) {
      unList.push(lib.breakevenReportService.subscribe());
    }
    if (heat) {
      unList.push(lib.heatReportService.subscribe());
    }
    if (live) {
      unList.push(lib.liveReportService.subscribe());
    }
    if (partial) {
      unList.push(lib.partialReportService.subscribe());
    }
    if (performance) {
      unList.push(lib.performanceReportService.subscribe());
    }
    if (risk) {
      unList.push(lib.riskReportService.subscribe());
    }
    if (schedule) {
      unList.push(lib.scheduleReportService.subscribe());
    }
    if (walker) {
      unList.push(lib.walkerReportService.subscribe());
    }
    return compose(...unList.map((un) => () => void un()));
  };
}

export class ReportAdapter extends ReportUtils {
  private ReportFactory: TReportBaseCtor = ReportBase;

  private getReportStorage = memoize(
    ([reportName]: [ReportName]): string => reportName,
    (reportName: ReportName): TReportBase =>
      Reflect.construct(this.ReportFactory, [reportName, "./dump/report"])
  );

  public useReportAdapter(Ctor: TReportBaseCtor): void {
    lib.loggerService.info(REPORT_UTILS_METHOD_NAME_USE_REPORT_ADAPTER);
    this.ReportFactory = Ctor;
  }

  public writeData = async <T = any>(
    reportName: ReportName,
    data: T
  ): Promise<void> => {
    lib.loggerService.info(REPORT_UTILS_METHOD_NAME_WRITE_DATA);

    const isInitial = !this.getReportStorage.has(reportName);
    const reportStorage = this.getReportStorage(reportName);
    await reportStorage.waitForInit(isInitial);

    await reportStorage.write({
        reportName,
        data,
        timestamp: Date.now(),
    });
  };
}

export const Report = new ReportAdapter();
