import { type IngestionContext, PolarIngestion } from "./ingestion";

export type IngestionExecutionHandler<TUsageContext extends IngestionContext> =
	(ctx: TUsageContext, customerId: string) => Promise<void>;

export abstract class IngestionStrategy<
	TUsageContext extends IngestionContext,
	TStrategyClient,
> extends PolarIngestion<TUsageContext> {
	public createExecutionHandler(): IngestionExecutionHandler<TUsageContext> {
		return async (context: TUsageContext, customerId: string) => {
			await this.execute(context, customerId);
		};
	}

	public ingest(
		eventName: string,
		metadataResolver?: (
			ctx: TUsageContext,
		) => Record<string, number | string | boolean>,
	) {
		this.schedule(eventName, metadataResolver);

		return this;
	}

	public abstract client(customerId: string): TStrategyClient;
}
