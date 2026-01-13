const commonServices = {
    loggerService: Symbol("loggerService"),
}

const baseServices = {
    contextService: Symbol('contextService'),
};

const privateServices = {
    runnerPrivateService: Symbol('runnerPrivateService'),
    outlinePrivateService: Symbol('outlinePrivateService'),
};

const publicServices = {
    runnerPublicService: Symbol('runnerPublicService'),
    outlinePublicService: Symbol('outlinePublicService'),
};

export const TYPES = {
    ...commonServices,
    ...baseServices,
    ...privateServices,
    ...publicServices,
}
