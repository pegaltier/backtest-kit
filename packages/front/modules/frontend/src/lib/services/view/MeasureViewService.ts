import { fetchApi, inject, randomString } from "react-declarative";
import LoggerService from "../base/LoggerService";
import TYPES from "../../config/TYPES";
import JwtService from "../base/JwtService";
import { CC_SERVICE_NAME } from "../../../config/params";
import { TradingMeasure } from "../../model/Measure.model";

export class MeasureViewService {
    private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
    private readonly jwtService = inject<JwtService>(TYPES.jwtService);

    public getTradeInfo = async (): Promise<TradingMeasure> => {
        this.loggerService.log("measureViewService getTradeInfo");
        const { error, data } = await fetchApi("/api/v1/trade_info", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await this.jwtService.generateAccessToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requestId: randomString(),
                serviceName: CC_SERVICE_NAME,
            }),
        });
        if (error) {
            throw new Error(error);
        }
        return data;
    };
}

export default MeasureViewService;
