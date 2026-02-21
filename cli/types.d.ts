interface ILogger {
    log(topic: string, ...args: any[]): void;
    debug(topic: string, ...args: any[]): void;
    info(topic: string, ...args: any[]): void;
    warn(topic: string, ...args: any[]): void;
}

declare enum ExchangeName {
    DefaultExchange = "default_exchange"
}

declare enum FrameName {
    DefaultFrame = "default_frame"
}

declare function setLogger(logger: ILogger): void;

export { ExchangeName, FrameName, setLogger };
