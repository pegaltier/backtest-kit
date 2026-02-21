const baseServices = {
    errorService: Symbol('errorService'),
    loggerService: Symbol('loggerService'),
    resolveService: Symbol('resolveService'),
};

const mainServices = {
    backtestMainService: Symbol('backtestMainService'),
    paperMainService: Symbol('paperMainService'),
    liveMainService: Symbol('liveMainService'),
}

const logicServices = {
    exchangeSchemaService: Symbol('exchangeSchemaService'),
    symbolSchemaService: Symbol('symbolSchemaService'),
    frameSchemaService: Symbol('frameSchemaService'),
    cacheLogicService: Symbol('cacheLogicService'),
}

const providerServices = {
    frontendProviderService: Symbol('frontendProviderService'),
    telegramProviderService: Symbol('telegramProviderService'),
}

export const TYPES = {
    ...baseServices,
    ...mainServices,
    ...logicServices,
    ...providerServices,
}

export default TYPES;
