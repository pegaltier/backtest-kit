import { addActionSchema } from "backtest-kit";
import ActionName from "../../enum/ActionName.mjs";
import { BacktestTightenStopOnBreakevenAction } from "../../classes/BacktestTightenStopOnBreakevenAction.mjs";

addActionSchema({
  actionName: ActionName.BacktestTightenStopOnBreakevenAction,
  handler: BacktestTightenStopOnBreakevenAction,
  note: "Tighten trailing-stop by 3% when breakeven is reached",
});
