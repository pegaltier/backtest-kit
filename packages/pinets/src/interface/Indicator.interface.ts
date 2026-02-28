export type TIndicatorCtor = new (source: string, inputs?: Record<string, any>) => IIndicator; 

export interface IIndicator {
    source: string;
    inputs: Record<string, any>;
}
