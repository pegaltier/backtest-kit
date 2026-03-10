import { IBabel } from "./Babel.interface";
import { ILogger } from "./Logger.interface";

export interface ILoaderParams {
    path: string;
    logger: ILogger;
    babel: IBabel;
}
