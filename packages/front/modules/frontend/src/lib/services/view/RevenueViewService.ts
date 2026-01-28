import { fetchApi, inject, randomString } from "react-declarative";
import LoggerService from "../base/LoggerService";
import TYPES from "../../config/TYPES";
import JwtService from "../base/JwtService";
import { CC_SERVICE_NAME } from "../../../config/params";

export class RevenueViewService {
    private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
    private readonly jwtService = inject<JwtService>(TYPES.jwtService);

    public getMastodonStatus = async () => {
        this.loggerService.log("revenueViewService getMastodonStatus");
        const { error, data } = await fetchApi("/api/v1/status/mastodon", {
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

    public getBraveStatus = async () => {
        this.loggerService.log("revenueViewService getBraveStatus");
        const { error, data } = await fetchApi("/api/v1/status/brave", {
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

    public getLongRangeStatus = async () => {
        this.loggerService.log("revenueViewService getLongRangeStatus");
        const { error, data } = await fetchApi("/api/v1/status/long", {
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

    public getVolumeDataStatus = async () => {
        this.loggerService.log("revenueViewService getVolumeDataStatus");
        const { error, data } = await fetchApi("/api/v1/status/volume", {
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

    public getSwingRangeStatus = async () => {
        this.loggerService.log("revenueViewService getSwingRangeStatus");
        const { error, data } = await fetchApi("/api/v1/status/swing", {
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

    public getShortRangeStatus = async () => {
        this.loggerService.log("revenueViewService getShortRangeStatus");
        const { error, data } = await fetchApi("/api/v1/status/short", {
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

    public getBalanceInfo = async () => {
        this.loggerService.log("revenueViewService getBalanceInfo");
        const { error, data } = await fetchApi("/api/v1/status/balance_info", {
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

    public getLastClosePrice = async () => {
        this.loggerService.log("revenueViewService getLastClosePrice");
        const { error, data } = await fetchApi(`/api/v1/status/close_price`, {
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

export default RevenueViewService;
