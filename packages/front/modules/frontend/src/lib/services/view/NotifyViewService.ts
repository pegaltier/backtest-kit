import { fetchApi, inject, randomString, TPaginator } from "react-declarative";
import LoggerService from "../base/LoggerService";
import TYPES from "../../config/TYPES";
import { CC_SERVICE_NAME } from "../../../config/params";
import JwtService from "../base/JwtService";

export class NotifyViewService {
    private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
    private readonly jwtService = inject<JwtService>(TYPES.jwtService);

    public getCount = async () => {
        this.loggerService.log("notifyViewService getCount");
        const { total } = await this.paginate(
            {
                $or: [
                    { notificationType: "buy" },
                    { notificationType: "close" },
                    { notificationType: "wait" },
                ],
            },
            { limit: 0, offset: 0 },
        );
        return Number(total);
    };

    public paginate = async (filterData, pagination) => {
        this.loggerService.log("notifyViewService paginate", {
            filterData,
            pagination,
        });
        const { error, data } = await fetchApi("/api/v1/notification/list", {
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

    public findOne = async (id: string) => {
        this.loggerService.log("notifyViewService findOne", {
            id,
        });
        const { error, data } = await fetchApi(`/api/v1/notification/one/${id}`, {
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

export default NotifyViewService;
