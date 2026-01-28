import { fetchApi, inject, randomString } from "react-declarative";
import LoggerService from "../base/LoggerService";
import TYPES from "../../config/TYPES";
import JwtService from "../base/JwtService";
import { CC_SERVICE_NAME } from "../../../config/params";

export class ActionViewService {
    private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
    private readonly jwtService = inject<JwtService>(TYPES.jwtService);

    public commitCreate = async (dto: {
        comment: string;
        price: string;
        quantity: string;
        timestamp: number;
    }) => {
        this.loggerService.log("actionViewService commitCreate", {
            dto,
        });
        const { error, data } = await fetchApi(`/api/v1/order/create`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await this.jwtService.generateAccessToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requestId: randomString(),
                serviceName: CC_SERVICE_NAME,
                data: dto,
            }),
        });
        if (error) {
            throw new Error(error);
        }
        return data;
    }

    public commitEdit = async (id: string, dto: {
        comment: string;
        price: string;
        quantity: string;
        timestamp: number;
    }) => {
        this.loggerService.log("actionViewService commitEdit", {
            dto,
        });
        const { error, data } = await fetchApi(`/api/v1/order/edit/${id}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await this.jwtService.generateAccessToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requestId: randomString(),
                serviceName: CC_SERVICE_NAME,
                data: dto,
            }),
        });
        if (error) {
            throw new Error(error);
        }
        return data;
    }

    public commitRemove = async (
        orderId: string,
    ) => {
        this.loggerService.log("actionViewService commitRemove", {
            orderId,
        });
        const { error, data } = await fetchApi(`/api/v1/order/remove/${orderId}`, {
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
        return {
            isValid: data.isValid,
            message: data.message,
        };
    };

    public commitClose = async (
        coin: string,
        orderId: string,
        closePrice: string,
        comment: string,
    ) => {
        this.loggerService.log("actionViewService commitClose", {
            comment,
        });
        const { error, data } = await fetchApi("/api/v1/action/commit_close", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await this.jwtService.generateAccessToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requestId: randomString(),
                serviceName: CC_SERVICE_NAME,
                coin,
                orderId,
                closePrice,
                comment,
            }),
        });
        if (error) {
            throw new Error(error);
        }
        return {
            isValid: data.isValid,
            message: data.message,
        };
    };

    public commitBuy = async (comment: string) => {
        this.loggerService.log("actionViewService commitBuy", {
            comment,
        });
        const { error, data } = await fetchApi("/api/v1/action/commit_buy", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await this.jwtService.generateAccessToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requestId: randomString(),
                serviceName: CC_SERVICE_NAME,
                comment,
            }),
        });
        if (error) {
            throw new Error(error);
        }
        return {
            isValid: data.isValid,
            message: data.message,
        };
    };
}

export default ActionViewService;
