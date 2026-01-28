import { fetchApi, inject, randomString, TPaginator } from "react-declarative";
import LoggerService from "../base/LoggerService";
import TYPES from "../../config/TYPES";
import JwtService from "../base/JwtService";
import { CC_SERVICE_NAME } from "../../../config/params";

export class OrderCloseViewService {
    private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
    private readonly jwtService = inject<JwtService>(TYPES.jwtService);

    public revertCancellation = async (id: string) => {
        this.loggerService.log("orderCloseViewService revertCancellation", {
            id,
        });
        const { error, data } = await fetchApi(
            `/api/v1/order_close/revert/${id}`,
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

    public findOne = async (id: string) => {
        this.loggerService.log("orderCloseViewService findOne", {
            id,
        });
        const { error, data } = await fetchApi(
            `/api/v1/order_close/one/${id}`,
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

    public paginate: TPaginator = async (filterData, pagination) => {
        this.loggerService.log("orderCloseViewService paginate", {
            filterData,
            pagination,
        });
        const { error, data } = await fetchApi("/api/v1/order_close/list", {
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
}

export default OrderCloseViewService;
