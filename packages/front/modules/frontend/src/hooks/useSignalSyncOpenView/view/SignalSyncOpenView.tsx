import { IOutletModalProps, One, ScrollView } from "react-declarative";
import { Box } from "@mui/material";
import { defaultSlots } from "../../../components/OneSlotFactory";
import signal_sync_open_fields from "../../../assets/signal_sync_open_fields";

export const SignalSyncOpenView = ({ data }: IOutletModalProps) => {
  return (
    <Box sx={{ height: "100%", width: "100%", pt: 1 }}>
      <ScrollView withScrollbar hideOverflowX sx={{ height: "100%" }}>
        <div>
          <One slots={defaultSlots} fields={signal_sync_open_fields} handler={() => data} />
          <Box sx={{ paddingBottom: "65px" }} />
        </div>
      </ScrollView>
    </Box>
  );
};

export default SignalSyncOpenView;
