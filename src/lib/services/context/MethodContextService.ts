import { scoped } from "di-scoped";
import { ExchangeName } from "../../../interfaces/Exchange.interface";
import { StrategyName } from "../../../interfaces/Strategy.interface";
import { FrameName } from "../../../interfaces/Frame.interface";

export interface IExecutionContext {
  exchangeName: ExchangeName;
  strategyName: StrategyName;
  frameName: FrameName;
}

export const MethodContextService = scoped(
  class {
    constructor(readonly context: IExecutionContext) {}
  }
);

export type TMethodContextService = InstanceType<
  typeof MethodContextService
>;

export default MethodContextService;
