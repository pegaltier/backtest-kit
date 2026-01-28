import { fetchApi, inject, randomString } from "react-declarative";
import LoggerService from "../base/LoggerService";
import TYPES from "../../config/TYPES";
import JwtService from "../base/JwtService";
import { CC_SERVICE_NAME } from "../../../config/params";

export class SettingViewService {
    private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
    private readonly jwtService = inject<JwtService>(TYPES.jwtService);

    public getValue = async () => {
        this.loggerService.log("settingViewService getValue");
        const { error, data } = await fetchApi("/api/v1/settings/read", {
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

    public setValue = async (dto: Record<string, unknown>) => {
        this.loggerService.log("settingViewService setValue");
        const { error, data } = await fetchApi("/api/v1/settings/write", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await this.jwtService.generateAccessToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                data: dto,
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

export default SettingViewService;
