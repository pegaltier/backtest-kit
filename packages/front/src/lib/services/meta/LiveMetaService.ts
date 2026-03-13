import { inject } from "../../../lib/core/di";
import LoggerService from "../base/LoggerService";
import { TYPES } from "../../../lib/core/types";
import { Live } from "backtest-kit";
import { CC_ENABLE_MOCK } from "src/config/params";

export class LiveMetaService {
    private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

    public list = async () => {
        this.loggerService.log("liveMetaService list");
        if (CC_ENABLE_MOCK) {
            // todo
        }
        return await Live.list();
    }
}

export default LiveMetaService;
