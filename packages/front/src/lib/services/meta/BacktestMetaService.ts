import { inject } from "../../../lib/core/di";
import LoggerService from "../base/LoggerService";
import { TYPES } from "../../../lib/core/types";
import { Backtest } from "backtest-kit";
import { CC_ENABLE_MOCK } from "src/config/params";

export class BacktestMetaService {
    private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

    public list = async () => {
        this.loggerService.log("backtestMetaService list");
        if (CC_ENABLE_MOCK) {
            // todo
        }
        return await Backtest.list();
    }
}

export default BacktestMetaService;
