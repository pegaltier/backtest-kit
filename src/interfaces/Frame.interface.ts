export type FrameInterval =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "8h"
  | "12h"
  | "1d"
  | "3d";

export interface IFrameParams extends IFrameSchema {}

export interface IFrameCallbacks {
  onTimeframe: (
    timeframe: Date[],
    startDate: Date,
    endDate: Date,
    interval: FrameInterval
  ) => void;
}

export interface IFrameSchema {
  frameName: FrameName;
  interval: FrameInterval;
  startDate: Date;
  endDate: Date;
  callbacks?: Partial<IFrameCallbacks>;
}

export interface IFrame {
  getTimeframe: () => Promise<Date[]>;
}

export type FrameName = string;
