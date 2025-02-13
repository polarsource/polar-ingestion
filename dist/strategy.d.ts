import { IngestionContext, Ingestion } from './ingestion.js';
import '@polar-sh/sdk';

type IngestionExecutionHandler<TUsageContext extends IngestionContext> = (ctx: TUsageContext) => Promise<void>;
declare abstract class IngestionStrategy<TUsageContext extends IngestionContext, TStrategyClient> extends Ingestion<TUsageContext> {
    createExecutionHandler(): IngestionExecutionHandler<TUsageContext>;
    ingest(eventName: string, metadataResolver: (ctx: TUsageContext) => Record<string, number | string | boolean>): this;
    abstract client(customerId: string): TStrategyClient;
}

export { type IngestionExecutionHandler, IngestionStrategy };
