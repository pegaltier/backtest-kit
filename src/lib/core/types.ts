const baseServices = {
    loggerService: Symbol('loggerService'),
};

const contextServices = {
    executionContextService: Symbol('executionContextService'),
};

const connectionServices = {
    candleConnectionService: Symbol('candleConnectionService'),
    strategyConnectionService: Symbol('strategyConnectionService'),
};

const schemaServices = {
    candleSchemaService: Symbol('candleSchemaService'),
    strategySchemaService: Symbol('strategySchemaService'),
}

const publicServices = {
    candlePublicService: Symbol('candlePublicService'),
    strategyPublicService: Symbol('strategyPublicService'),
}

export const TYPES = {
    ...baseServices,
    ...contextServices,
    ...connectionServices,
    ...schemaServices,
    ...publicServices,
}

export default TYPES;
