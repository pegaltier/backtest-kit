import {
  distinctDocuments,
  iterateDocuments,
  resolveDocuments,
  str,
} from "functools-kit";
import {
  IOptimizer,
  IOptimizerData,
  IOptimizerFilterArgs,
  IOptimizerParams,
  IOptimizerSourceFn,
  IOptimizerStrategy,
} from "../interfaces/Optimizer.interface";
import { MessageModel } from "../model/Message.model";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const ITERATION_LIMIT = 25;
const DEFAULT_SOURCE_NAME = "unknown";

const CREATE_PREFIX_FN = () => (Math.random() + 1).toString(36).substring(7);

const DEFAULT_USER_FN = async <Data extends IOptimizerData = any>(
  symbol: string,
  data: Data[],
  name: string,
  self: ClientOptimizer
) => {
  return await self.params.template.getUserMessage(symbol, data, name);
};

const DEFAULT_ASSISTANT_FN = async <Data extends IOptimizerData = any>(
  symbol: string,
  data: Data[],
  name: string,
  self: ClientOptimizer
) => {
  return await self.params.template.getAssistantMessage(symbol, data, name);
};

const RESOLVE_PAGINATION_FN = async <Data extends IOptimizerData = any>(
  fetch: IOptimizerSourceFn,
  filterData: IOptimizerFilterArgs
) => {
  const iterator = iterateDocuments<Data>({
    limit: ITERATION_LIMIT,
    async createRequest({ limit, offset }) {
      return await fetch({
        symbol: filterData.symbol,
        startDate: filterData.startDate,
        endDate: filterData.endDate,
        limit,
        offset,
      });
    },
  });
  const distinct = distinctDocuments(iterator, (data) => data.id);
  return await resolveDocuments(distinct);
};

const GET_STRATEGY_DATA_FN = async (symbol: string, self: ClientOptimizer) => {
  const strategyList: IOptimizerStrategy[] = [];
  for (const { startDate, endDate } of self.params.rangeTrain) {
    const messageList: MessageModel[] = [];
    for (const source of self.params.source) {
      if (typeof source === "function") {
        const data = await RESOLVE_PAGINATION_FN(source, {
          symbol,
          startDate,
          endDate,
        });
        const [userContent, assistantContent] = await Promise.all([
          DEFAULT_USER_FN(symbol, data, DEFAULT_SOURCE_NAME, this),
          DEFAULT_ASSISTANT_FN(symbol, data, DEFAULT_SOURCE_NAME, this),
        ]);
        messageList.push(
          {
            role: "user",
            content: userContent,
          },
          {
            role: "assistant",
            content: assistantContent,
          }
        );
        return;
      }
      const {
        fetch,
        name = DEFAULT_SOURCE_NAME,
        assistant = DEFAULT_ASSISTANT_FN,
        user = DEFAULT_USER_FN,
      } = source;
      const data = await RESOLVE_PAGINATION_FN(fetch, {
        symbol,
        startDate,
        endDate,
      });
      const [userContent, assistantContent] = await Promise.all([
        user(symbol, data, name, this),
        assistant(symbol, data, name, this),
      ]);
      messageList.push(
        {
          role: "user",
          content: userContent,
        },
        {
          role: "assistant",
          content: assistantContent,
        }
      );
    }
    strategyList.push({
      symbol,
      messages: messageList,
      strategy: await self.params.getPrompt(symbol, messageList),
    });
  }
  return strategyList;
};

export class ClientOptimizer implements IOptimizer {
  constructor(readonly params: IOptimizerParams) {}

  public getData = async (symbol: string) => {
    this.params.logger.debug("ClientOptimizer getData", {
      symbol,
    });
    return await GET_STRATEGY_DATA_FN(symbol, this);
  };

  public getReport = async (symbol: string): Promise<string> => {
    this.params.logger.debug("ClientOptimizer getReport", {
      symbol,
    });
    const strategyData = await this.getData(symbol);

    const sections: string[] = [];
    const exchangeName = this.params.optimizerName; // or extract from params
    const prefix = CREATE_PREFIX_FN();

    // 1. Top banner with imports
    {
      sections.push(await this.params.template.getTopBanner(symbol));
      sections.push("");
    }

    // 2. Helper functions (text and json)
    {
      sections.push(await this.params.template.getTextTemplate(symbol));
      sections.push("");
    }

    {
      sections.push(await this.params.template.getJsonTemplate(symbol));
      sections.push("");
    }

    // 3. Exchange template (assuming first strategy has exchange info)
    {
      sections.push(
        await this.params.template.getExchangeTemplate(
          symbol,
          `${prefix}_${exchangeName}`
        )
      );
      sections.push("");
    }

    // 4. Train frame templates
    {
      for (let i = 0; i < this.params.rangeTrain.length; i++) {
        const range = this.params.rangeTrain[i];
        const frameName = `${prefix}_train_frame-${i + 1}`;
        sections.push(
          await this.params.template.getFrameTemplate(
            symbol,
            frameName,
            "1m", // default interval
            range.startDate,
            range.endDate
          )
        );
        sections.push("");
      }
    }

    // 5. Test frame template
    {
      const testFrameName = `${prefix}_test_frame`;
      sections.push(
        await this.params.template.getFrameTemplate(
          symbol,
          testFrameName,
          "1m", // default interval
          this.params.rangeTest.startDate,
          this.params.rangeTest.endDate
        )
      );
      sections.push("");
    }

    // 6. Strategy templates for each generated strategy
    {
      for (let i = 0; i < strategyData.length; i++) {
        const strategy = strategyData[i];
        const strategyName = `${prefix}_strategy-${i + 1}`;
        const interval = "5m"; // default interval
        sections.push(
          await this.params.template.getStrategyTemplate(
            strategyName,
            interval,
            strategy.strategy
          )
        );
        sections.push("");
      }
    }

    // 7. Walker template (uses test frame for validation)
    {
      const walkerName = `${prefix}_walker`;
      const testFrameName = `${prefix}_test_frame`;
      const strategies = strategyData.map(
        (_, i) => `${prefix}_strategy-${i + 1}`
      );
      sections.push(
        await this.params.template.getWalkerTemplate(
          walkerName,
          `${prefix}_${exchangeName}`,
          testFrameName,
          strategies
        )
      );
      sections.push("");
    }

    // 8. Launcher template
    {
      const walkerName = `${prefix}_walker`;
      sections.push(
        await this.params.template.getLauncherTemplate(symbol, walkerName)
      );
      sections.push("");
    }

    return str.newline(sections);
  };

  public dump = async (
    symbol: string,
    path = "./"
  ): Promise<void> => {
    this.params.logger.debug("ClientOptimizer dump", {
      symbol,
      path,
    });

    const report = await this.getReport(symbol);

    try {
      const dir = join(process.cwd(), path);
      await mkdir(dir, { recursive: true });

      const filename = `${this.params.optimizerName}_${symbol}.mjs`;
      const filepath = join(dir, filename);

      await writeFile(filepath, report, "utf-8");
      this.params.logger.info(`Optimizer report saved: ${filepath}`);
    } catch (error) {
      this.params.logger.warn(`Failed to save optimizer report:`, error);
      throw error;
    }
  };
}

export default ClientOptimizer;
