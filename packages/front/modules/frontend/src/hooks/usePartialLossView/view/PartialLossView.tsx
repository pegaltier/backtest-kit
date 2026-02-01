import { IOutletModalProps, One, ScrollView } from "react-declarative";
import { Box } from "@mui/material";
import { defaultSlots } from "../../../components/OneSlotFactory";
import { partial_loss_available_fields, partial_loss_commit_fields } from "../../../assets/partial_loss_fields";

export const PartialLossView = ({ data }: IOutletModalProps) => {
  const fields = data.type === "partial_loss.commit"
    ? partial_loss_commit_fields
    : partial_loss_available_fields;

  return (
    <Box sx={{ height: "100%", width: "100%", pt: 1 }}>
      <ScrollView withScrollbar hideOverflowX sx={{ height: "100%" }}>
        <div>
          <One slots={defaultSlots} fields={fields} handler={() => data} />
          <Box sx={{ paddingBottom: "65px" }} />
        </div>
      </ScrollView>
    </Box>
  );
};

export default PartialLossView;
