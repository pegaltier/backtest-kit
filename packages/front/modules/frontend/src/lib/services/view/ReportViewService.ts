import { fetchApi, inject, randomString, TPaginator } from "react-declarative";
import LoggerService from "../base/LoggerService";
import TYPES from "../../config/TYPES";
import { CC_SERVICE_NAME } from "../../../config/params";
import JwtService from "../base/JwtService";

export class ReportViewService {
    private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
    private readonly jwtService = inject<JwtService>(TYPES.jwtService);

    public paginate: TPaginator = async (filterData, pagination) => {
        this.loggerService.log("reportViewService paginate", {
            filterData,
            pagination,
        });
        const { error, data } = await fetchApi("/api/v1/report/list", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await this.jwtService.generateAccessToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requestId: randomString(),
                serviceName: CC_SERVICE_NAME,
                filterData: {
                    ...filterData,
                    ignore: false,
                },
                pagination,
            }),
        });
        if (error) {
            throw new Error(error);
        }
        return {
            rows: data.rows,
            total: data.total,
        };
    };

    public paginateBrave = async (filterData, pagination) => {
        this.loggerService.log("reportViewService paginateBrave", {
            filterData,
            pagination,
        });
        const { error, data } = await fetchApi("/api/v1/report/list", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await this.jwtService.generateAccessToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requestId: randomString(),
                serviceName: CC_SERVICE_NAME,
                filterData: {
                    ...filterData,
                    ignore: false,
                    type: "brave",
                },
                pagination,
            }),
        });
        if (error) {
            throw new Error(error);
        }
        return {
            rows: data.rows,
            total: data.total,
        };
    };

    public paginateMastodon = async (filterData, pagination) => {
        this.loggerService.log("reportViewService paginateMastodon", {
            filterData,
            pagination,
        });
        const { error, data } = await fetchApi("/api/v1/report/list", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await this.jwtService.generateAccessToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requestId: randomString(),
                serviceName: CC_SERVICE_NAME,
                filterData: {
                    ...filterData,
                    ignore: false,
                    type: "mastodon"
                },
                pagination,
            }),
        });
        if (error) {
            throw new Error(error);
        }
        return {
            rows: data.rows,
            total: data.total,
        };
    };

    public paginateLongRange = async (filterData, pagination) => {
        this.loggerService.log("reportViewService paginateLongRange", {
            filterData,
            pagination,
        });
        const { error, data } = await fetchApi("/api/v1/report/list", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await this.jwtService.generateAccessToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requestId: randomString(),
                serviceName: CC_SERVICE_NAME,
                filterData: {
                    ...filterData,
                    ignore: false,
                    type: "long"
                },
                pagination,
            }),
        });
        if (error) {
            throw new Error(error);
        }
        return {
            rows: data.rows,
            total: data.total,
        };
    };

    public paginateSwingRange = async (filterData, pagination) => {
        this.loggerService.log("reportViewService paginateSwingRange", {
            filterData,
            pagination,
        });
        const { error, data } = await fetchApi("/api/v1/report/list", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await this.jwtService.generateAccessToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requestId: randomString(),
                serviceName: CC_SERVICE_NAME,
                filterData: {
                    ...filterData,
                    ignore: false,
                    type: "swing"
                },
                pagination,
            }),
        });
        if (error) {
            throw new Error(error);
        }
        return {
            rows: data.rows,
            total: data.total,
        };
    };

    public paginateShortRange = async (filterData, pagination) => {
        this.loggerService.log("reportViewService paginateShortRange", {
            filterData,
            pagination,
        });
        const { error, data } = await fetchApi("/api/v1/report/list", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await this.jwtService.generateAccessToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requestId: randomString(),
                serviceName: CC_SERVICE_NAME,
                filterData: {
                    ...filterData,
                    ignore: false,
                    type: "short"
                },
                pagination,
            }),
        });
        if (error) {
            throw new Error(error);
        }
        return {
            rows: data.rows,
            total: data.total,
        };
    };

    public paginateStrategyReport = async (filterData, pagination) => {
        this.loggerService.log("reportViewService paginateStrategyReport", {
            filterData,
            pagination,
        });
        const { error, data } = await fetchApi("/api/v1/report/list", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await this.jwtService.generateAccessToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requestId: randomString(),
                serviceName: CC_SERVICE_NAME,
                filterData: {
                    ...filterData,
                    ignore: false,
                    type: "strategy"
                },
                pagination,
            }),
        });
        if (error) {
            throw new Error(error);
        }
        return {
            rows: data.rows,
            total: data.total,
        };
    };

    public paginateVolumeDataReport = async (filterData, pagination) => {
        this.loggerService.log("reportViewService paginateVolumeDataReport", {
            filterData,
            pagination,
        });
        const { error, data } = await fetchApi("/api/v1/report/list", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await this.jwtService.generateAccessToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requestId: randomString(),
                serviceName: CC_SERVICE_NAME,
                filterData: {
                    ...filterData,
                    ignore: false,
                    type: "volume"
                },
                pagination,
            }),
        });
        if (error) {
            throw new Error(error);
        }
        return {
            rows: data.rows,
            total: data.total,
        };
    };

    public findOne = async (id: string) => {
        this.loggerService.log("reportViewService findOne", {
            id,
        });
        const { error, data } = await fetchApi(`/api/v1/report/one/${id}`, {
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

    public getOrderReport = async (orderId: string) => {
        this.loggerService.log("reportViewService getOrderReport", {
            orderId,
        });
        const { error, data } = await fetchApi(
            `/api/v1/report/order/one/${orderId}`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${await this.jwtService.generateAccessToken()}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    requestId: randomString(),
                    serviceName: CC_SERVICE_NAME,
                }),
            },
        );
        if (error) {
            throw new Error(error);
        }
        return data;
    };

    public getBalanceReport = async () => {
        this.loggerService.log("reportViewService getBalanceReport");
        const { error, data } = await fetchApi(`/api/v1/status/balance`, {
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

    public getHistoryReport = async () => {
        this.loggerService.log("reportViewService getHistoryReport");
        const { error, data } = await fetchApi(`/api/v1/report/history`, {
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

export default ReportViewService;
