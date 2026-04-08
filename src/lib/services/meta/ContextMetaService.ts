import { singleton } from "di-singleton";
import { inject } from "../../../lib/core/di";
import { TLoggerService } from "../base/LoggerService";
import TYPES from "../../../lib/core/types";
import ExecutionContextService, { TExecutionContextService } from "../context/ExecutionContextService";
import alignToInterval from "../../../utils/alignToInterval";

export const ContextMetaService = singleton(class {
    readonly loggerService = inject<TLoggerService>(TYPES.loggerService);
    readonly executionContextService = inject<TExecutionContextService>(TYPES.executionContextService);

    public getContextTimestamp = () => {
        this.loggerService.log("contextMetaService getContextTimestamp");
        if (ExecutionContextService.hasContext()) {
            return this.executionContextService.context.when.getTime();
        }
        return alignToInterval(new Date(), "1m").getTime();
    }
});

export type TContextMetaService = InstanceType<typeof ContextMetaService>;

export default ContextMetaService;
