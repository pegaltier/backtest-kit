import { IOutlineMessage } from 'agent-swarm-kit';

declare const ollama: (messages: IOutlineMessage[], model: string, apiKey?: string | string[]) => Promise<{
    id: string;
    position: "long" | "short";
    minuteEstimatedTime: number;
    priceStopLoss: number;
    priceTakeProfit: number;
    note: string;
    priceOpen: number;
}>;
declare const grok: (messages: IOutlineMessage[], model: string, apiKey?: string | string[]) => Promise<{
    id: string;
    position: "long" | "short";
    minuteEstimatedTime: number;
    priceStopLoss: number;
    priceTakeProfit: number;
    note: string;
    priceOpen: number;
}>;
declare const hf: (messages: IOutlineMessage[], model: string, apiKey?: string | string[]) => Promise<{
    id: string;
    position: "long" | "short";
    minuteEstimatedTime: number;
    priceStopLoss: number;
    priceTakeProfit: number;
    note: string;
    priceOpen: number;
}>;
declare const claude: (messages: IOutlineMessage[], model: string, apiKey?: string | string[]) => Promise<{
    id: string;
    position: "long" | "short";
    minuteEstimatedTime: number;
    priceStopLoss: number;
    priceTakeProfit: number;
    note: string;
    priceOpen: number;
}>;
declare const gpt5: (messages: IOutlineMessage[], model: string, apiKey?: string | string[]) => Promise<{
    id: string;
    position: "long" | "short";
    minuteEstimatedTime: number;
    priceStopLoss: number;
    priceTakeProfit: number;
    note: string;
    priceOpen: number;
}>;
declare const deepseek: (messages: IOutlineMessage[], model: string, apiKey?: string | string[]) => Promise<{
    id: string;
    position: "long" | "short";
    minuteEstimatedTime: number;
    priceStopLoss: number;
    priceTakeProfit: number;
    note: string;
    priceOpen: number;
}>;
declare const mistral: (messages: IOutlineMessage[], model: string, apiKey?: string | string[]) => Promise<{
    id: string;
    position: "long" | "short";
    minuteEstimatedTime: number;
    priceStopLoss: number;
    priceTakeProfit: number;
    note: string;
    priceOpen: number;
}>;
declare const perplexity: (messages: IOutlineMessage[], model: string, apiKey?: string | string[]) => Promise<{
    id: string;
    position: "long" | "short";
    minuteEstimatedTime: number;
    priceStopLoss: number;
    priceTakeProfit: number;
    note: string;
    priceOpen: number;
}>;
declare const cohere: (messages: IOutlineMessage[], model: string, apiKey?: string | string[]) => Promise<{
    id: string;
    position: "long" | "short";
    minuteEstimatedTime: number;
    priceStopLoss: number;
    priceTakeProfit: number;
    note: string;
    priceOpen: number;
}>;
declare const alibaba: (messages: IOutlineMessage[], model: string, apiKey?: string | string[]) => Promise<{
    id: string;
    position: "long" | "short";
    minuteEstimatedTime: number;
    priceStopLoss: number;
    priceTakeProfit: number;
    note: string;
    priceOpen: number;
}>;

interface ILogger {
    log(topic: string, ...args: any[]): void;
    debug(topic: string, ...args: any[]): void;
    info(topic: string, ...args: any[]): void;
    warn(topic: string, ...args: any[]): void;
}

declare const setLogger: (logger: ILogger) => void;

export { alibaba, claude, cohere, deepseek, gpt5, grok, hf, mistral, ollama, perplexity, setLogger };
