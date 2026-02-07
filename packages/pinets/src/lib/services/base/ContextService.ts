import { scoped } from "di-scoped";

export type ExchangeName = string;

export interface IContext {
  exchangeName: ExchangeName;
}

export const ContextService = scoped(
  class {
    constructor(readonly context: IContext) {}
  }
);

export type TContextService = InstanceType<typeof ContextService>;

export default ContextService;
