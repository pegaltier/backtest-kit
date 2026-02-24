import cli from "../lib";

type PayloadBacktest = Parameters<typeof cli.backtestMainService.run>[0];
type PayloadPaper = Parameters<typeof cli.paperMainService.run>[0];
type PayloadLive = Parameters<typeof cli.liveMainService.run>[0];

type Mode = "backtest" | "live" | "paper";

type Args = 
 | Partial<PayloadBacktest>
 | Partial<PayloadPaper>
 | Partial<PayloadLive>

export async function run(mode: Mode, args: Args) {
    if (mode === "backtest") {
        return await cli.backtestMainService.run(<PayloadBacktest>args);
    }
    if (mode === "paper") {
        return await cli.paperMainService.run(<PayloadPaper>args);

    }
    if (mode === "live") {
        return await cli.liveMainService.run(<PayloadLive>args);
    }
    throw new Error(`Invalid mode: ${mode}`);
}
