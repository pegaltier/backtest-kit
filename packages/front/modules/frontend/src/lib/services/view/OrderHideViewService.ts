import { fetchApi, inject, randomString, TPaginator } from "react-declarative";
import LoggerService from "../base/LoggerService";
import TYPES from "../../config/TYPES";
import JwtService from "../base/JwtService";
import { CC_SERVICE_NAME } from "../../../config/params";

export class OrderHideViewService {
    private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
    private readonly jwtService = inject<JwtService>(TYPES.jwtService);

    public paginate: TPaginator = async (filterData, pagination) => {
        this.loggerService.log("orderHideViewService paginate", {
            filterData,
            pagination,
        });
        const { error, data } = await fetchApi("/api/v1/order_hide/list", {
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

export default OrderHideViewService;
