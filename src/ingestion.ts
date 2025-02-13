import { Polar, type SDKOptions } from "@polar-sh/sdk";
import type { IngestionStrategy } from "./strategy";

export type IngestionContext<
	TContext extends Record<string, string | number | boolean> = Record<
		string,
		string | number | boolean
	>,
> = TContext;

type Transformer<TContext extends IngestionContext> = (
	ctx: TContext,
	customerId: string,
) => Promise<void>;

export class PolarIngestion<TContext extends IngestionContext> {
	public polarClient?: Polar;
	private transformers: Transformer<TContext>[] = [];

	private pipe(transformer: Transformer<TContext>) {
		this.transformers.push(transformer);

		return this;
	}

	public async execute(ctx: TContext, customerId: string) {
		await Promise.all(
			this.transformers.map((transformer) => transformer(ctx, customerId)),
		);
	}

	public schedule(
		meter: string,
		metadataResolver?: (
			ctx: TContext,
		) => Record<string, number | string | boolean>,
	) {
		return this.pipe(async (ctx, customerId) => {
			if (!this.polarClient) {
				throw new Error("Polar client not initialized");
			}

			await this.polarClient.events.ingest({
				events: [
					{
						customerId,
						name: meter,
						metadata: metadataResolver ? metadataResolver(ctx) : ctx,
					},
				],
			});
		});
	}
}

export function Ingestion(polarConfig?: SDKOptions) {
	return {
		strategy: <TContext extends IngestionContext, TStrategyClient>(
			strategy: IngestionStrategy<TContext, TStrategyClient>,
		) => {
			strategy.polarClient = new Polar(polarConfig);
			return strategy;
		},
	};
}
