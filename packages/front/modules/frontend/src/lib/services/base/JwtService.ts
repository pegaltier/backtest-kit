import jwt, { SignOptions } from "jsonwebtoken";
import ErrorService from "./ErrorService";
import TYPES from "../../config/TYPES";
import { inject } from "react-declarative";
import { CC_WEBHOOK_JWT_SECRET } from "../../../config/params";

const JWT_OPTIONS: SignOptions = {
    expiresIn: "15s",
};

export class JwtService {
    readonly errorService = inject<ErrorService>(TYPES.errorService);

    protected getServiceToken = () => {
        return this.generateAccessToken(
            {},
            {
                expiresIn: "3650d",
            },
        );
    };

    protected getLicenseToken = () => {
        return this.generateAccessToken(
            {},
            {
                expiresIn: "90d",
            },
        );
    };

    generateAccessToken = <Data extends object = Record<string, unknown>>(
        payload: Data = {} as unknown as Data,
        options = JWT_OPTIONS,
    ) => {
        try {
            return jwt.sign(payload, CC_WEBHOOK_JWT_SECRET, options);
        } catch (error) {
            this.errorService.handleGlobalError(error as unknown as Error);
            throw error;
        }
    };

    verifyAccessToken = (token: string) => {
        try {
            const data = jwt.verify(token, CC_WEBHOOK_JWT_SECRET);
            return data;
        } catch (error) {
            console.log(error);
            return null;
        }
    };
}

export default JwtService;
