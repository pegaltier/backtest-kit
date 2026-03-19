import LoggerService from "../base/LoggerService";
import TYPES from "../../core/TYPES";
import { fetchApi, inject, randomString } from "react-declarative";
import {
    CC_CLIENT_ID,
    CC_ENABLE_MOCK,
    CC_SERVICE_NAME,
    CC_USER_ID,
} from "../../../config/params";
import SignalMockService from "../mock/SignalMockService";
import { IPublicSignalRow } from "backtest-kit";

export class SignalViewService {
    private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
    private readonly signalMockService = inject<SignalMockService>(
        TYPES.signalMockService,
    );

    public getLastUpdateTimestamp = async (signalId: string): Promise<number> => {
        this.loggerService.log("signalViewService getLastUpdateTimestamp", {
            signalId,
        });
        if (CC_ENABLE_MOCK) {
            return await this.signalMockService.getLastUpdateTimestamp(signalId);
        }
        const { data, error } = await fetchApi(
            `/api/v1/view/signal_last_update/${signalId}`,
            {
                method: "POST",
                body: JSON.stringify({
                    clientId: CC_CLIENT_ID,
                    serviceName: CC_SERVICE_NAME,
                    userId: CC_USER_ID,
                    requestId: randomString(),
                }),
            },
        );
        if (error) {
            throw new Error(error);
        }
        return data;
    };

    public getPendingSignal = async (symbol: string): Promise<IPublicSignalRow | null> => {
        this.loggerService.log("signalViewService getPendingSignal", { symbol });
        if (CC_ENABLE_MOCK) {
            return await this.signalMockService.getPendingSignal(symbol);
        }
        const { data, error } = await fetchApi("/api/v1/view/signal_pending", {
            method: "POST",
            body: JSON.stringify({
                clientId: CC_CLIENT_ID,
                serviceName: CC_SERVICE_NAME,
                userId: CC_USER_ID,
                requestId: randomString(),
                symbol,
            }),
        });
        if (error) {
            throw new Error(error);
        }
        return data;
    };
}

export default SignalViewService;
