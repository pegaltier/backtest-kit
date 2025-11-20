const baseServices = {
    loggerService: Symbol('loggerService'),
};

const contextServices = {
    executionContextService: Symbol('executionContextService'),
    methodContextService: Symbol('methodContextService'),
};

const connectionServices = {
    exchangeConnectionService: Symbol('exchangeConnectionService'),
    strategyConnectionService: Symbol('strategyConnectionService'),
    frameConnectionService: Symbol('frameConnectionService'),
};

const schemaServices = {
    exchangeSchemaService: Symbol('exchangeSchemaService'),
    strategySchemaService: Symbol('strategySchemaService'),
    frameSchemaService: Symbol('frameSchemaService'),
}

const globalServices = {
    exchangeGlobalService: Symbol('exchangeGlobalService'),
    strategyGlobalService: Symbol('strategyGlobalService'),
    frameGlobalService: Symbol('frameGlobalService'),
}

const logicServices = {
    backtestLogicService: Symbol('backtestLogicService'),
    liveLogicService: Symbol('liveLogicService'),
}

export const TYPES = {
    ...baseServices,
    ...contextServices,
    ...connectionServices,
    ...schemaServices,
    ...globalServices,
    ...logicServices,
}

export default TYPES;
