import LoggerService from "../base/LoggerService";
import { fetchApi, inject, randomString } from "react-declarative";
import TYPES from "../../core/TYPES";
import { CC_CLIENT_ID, CC_SERVICE_NAME, CC_USER_ID } from "../../../config/params";
import { ExplorerData, ExplorerNode } from "../../../model/Explorer.model";
import ExplorerHelperService from "../helpers/ExplorerHelperService";

export class ExplorerMockService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly explorerHelperService = inject<ExplorerHelperService>(TYPES.explorerHelperService);

  public getTreeRaw = async (): Promise<ExplorerNode[]> => {
    this.loggerService.log("explorerMockService getTreeRaw");
    const { data, error } = await fetchApi("/api/v1/explorer_mock/tree", {
      method: "POST",
      body: JSON.stringify({
        clientId: CC_CLIENT_ID,
        serviceName: CC_SERVICE_NAME,
        userId: CC_USER_ID,
        requestId: randomString(),
      }),
    });
    if (error) {
      throw new Error(error);
    }
    return data;
  };

  public getTree = async (): Promise<ExplorerData> => {
    this.loggerService.log("explorerMockService getTree");
    const raw = await this.getTreeRaw();
    return {
      record: this.explorerHelperService.treeToRecord(raw),
      map: this.explorerHelperService.treeToMap(raw),
    }
  };

  public getNode = async (path: string): Promise<string> => {
    this.loggerService.log("explorerMockService getNode", { path });
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
}

export default ExplorerMockService;
