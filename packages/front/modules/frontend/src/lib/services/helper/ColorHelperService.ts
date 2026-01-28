import { inject } from "react-declarative";
import LoggerService from "../base/LoggerService";
import TYPES from "../../config/TYPES";
import { colors } from "@mui/material";

const COLOR_LIST = [
    colors.purple[900],
    colors.red[900], 
    colors.purple[300],
    colors.yellow[900],
    colors.blue[500],
    colors.blue[900],
    colors.yellow[500],
    colors.orange[900],
    colors.cyan[500],
    colors.red[200], 
];

export class ColorHelperService {
    private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

    public getColorByIndex = (index: number) => {
        this.loggerService.log("colorHelperService getColorByIndex", {
            index,
        });
        return COLOR_LIST[index % COLOR_LIST.length];
    };
}

export default ColorHelperService;
