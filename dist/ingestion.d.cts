import { Polar } from '@polar-sh/sdk';

type IngestionContext<TContext extends Record<string, unknown> = Record<string, unknown>> = TContext & {
    customerId: string;
};
declare class Ingestion<TContext extends IngestionContext> {
    private polarClient;
    private transformers;
    constructor(polar: Polar);
    private pipe;
    execute(ctx: TContext): Promise<void>;
    schedule(meter: string, transformer: (ctx: TContext) => Record<string, number | string | boolean>): this;
}

export { Ingestion, type IngestionContext };
