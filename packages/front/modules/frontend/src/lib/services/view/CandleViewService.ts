import { fetchApi, inject, randomString } from "react-declarative";
import LoggerService from "../base/LoggerService";
import JwtService from "../base/JwtService";
import TYPES from "../../config/TYPES";
import { CC_SERVICE_NAME } from "../../../config/params";

export class CandleViewService {
    private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
    private readonly jwtService = inject<JwtService>(TYPES.jwtService);

    public getChartCandles = async (startDate: string, endDate: string) => {
        this.loggerService.log("candleViewService getChartCandles");
        const { error, data } = await fetchApi("/api/v1/candles/range", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await this.jwtService.generateAccessToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requestId: randomString(),
                serviceName: CC_SERVICE_NAME,
                startDate,
                endDate,
            }),
        });
        if (error) {
            throw new Error(error);
        }
        return data;
    };
}

export default CandleViewService;
