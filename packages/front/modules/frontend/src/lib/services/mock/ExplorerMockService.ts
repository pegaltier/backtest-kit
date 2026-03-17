import LoggerService from "../base/LoggerService";
import { fetchApi, inject, randomString, ttl } from "react-declarative";
import TYPES from "../../core/TYPES";
import {
    CC_CLIENT_ID,
    CC_SERVICE_NAME,
    CC_USER_ID,
} from "../../../config/params";
import {
    ExplorerData,
    ExplorerFile,
    ExplorerNode,
} from "../../../model/Explorer.model";
import ExplorerHelperService from "../helpers/ExplorerHelperService";

const TTL_TIMEOUT = 45_000;

export class ExplorerMockService {
    private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
    private readonly explorerHelperService = inject<ExplorerHelperService>(
        TYPES.explorerHelperService,
    );

    public getTreeRaw = ttl(
        async (): Promise<ExplorerNode[]> => {
            this.loggerService.log("explorerMockService getTreeRaw");
            const { data, error } = await fetchApi(
                "/api/v1/explorer_mock/tree",
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
        },
        {
            timeout: TTL_TIMEOUT,
        },
    );

    public getTree = ttl(
        async (): Promise<ExplorerData> => {
            this.loggerService.log("explorerMockService getTree");
            const raw = await this.getTreeRaw();
            return {
                record: this.explorerHelperService.treeToRecord(raw),
                map: this.explorerHelperService.treeToMap(raw),
            };
        },
        {
            timeout: TTL_TIMEOUT,
        },
    );

    public getContent = async (path: string): Promise<string> => {
        this.loggerService.log("explorerMockService getContent", { path });
        const { data, error } = await fetchApi("/api/v1/explorer_mock/node", {
            method: "POST",
            body: JSON.stringify({
                clientId: CC_CLIENT_ID,
                serviceName: CC_SERVICE_NAME,
                userId: CC_USER_ID,
                requestId: randomString(),
                path,
            }),
        });
        if (error) {
            throw new Error(error);
        }
        return data;
    };

    public getFileInfo = async (id: string): Promise<ExplorerFile> => {
        this.loggerService.log("explorerMockService getFileInfo", {
            id,
        });
        const { map } = await this.getTree();
        const value = map[id];
        if (!value) {
            throw new Error(
                `explorerMockService getFileInfo file not found id=${id}`,
            );
        }
        if (value.type !== "file") {
            throw new Error(
                `explorerMockService getFileInfo not a file id=${id} type=${value.type}`,
            );
        }
        return value;
    };

    public clear = () => {
        this.loggerService.log("explorerMockService clear");
        {
            this.getTreeRaw.clear();
            this.getTree.clear();
        }
    };
}

export default ExplorerMockService;
