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

const publicServices = {
    exchangePublicService: Symbol('exchangePublicService'),
    strategyPublicService: Symbol('strategyPublicService'),
    framePublicService: Symbol('framePublicService'),
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
    ...publicServices,
    ...logicServices,
}

export default TYPES;
