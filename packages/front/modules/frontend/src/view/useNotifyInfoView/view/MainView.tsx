import { IOutletModalProps, One, ScrollView } from "react-declarative";
import { Box } from "@mui/material";
import Markdown from "../../../components/common/Markdown";
import { defaultSlots } from "../../../components/OneSlotFactory";
import notify_fields from "../../../assets/notify_fields";

export const MainView = ({ data }: IOutletModalProps) => {
    return (
        <Box sx={{ height: "100%", width: "100%", pt: 1 }}>
            <ScrollView withScrollbar hideOverflowX sx={{ height: "100%" }}>
                <div>
                    <One slots={defaultSlots} fields={notify_fields} handler={() => data} />
                    <Box sx={{ paddingBottom: "65px" }} />
                </div>
            </ScrollView>
        </Box>
    );
};

export default MainView;
