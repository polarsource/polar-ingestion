import type { Polar } from "@polar-sh/sdk";
import type { IngestionStrategy } from "./strategy";

export type IngestionContext<
	TContext extends Record<string, unknown> = Record<string, unknown>,
> = TContext & {
	customerId: string;
};

type Transformer<TContext extends IngestionContext> = (
	ctx: TContext,
) => Promise<void>;

export class PolarIngestion<TContext extends IngestionContext> {
	public polarClient?: Polar;
	private transformers: Transformer<TContext>[] = [];

	constructor(polar: Polar) {
		this.polarClient = polar;
	}

	private pipe(transformer: Transformer<TContext>) {
		this.transformers.push(transformer);

		return this;
	}

	public async execute(ctx: TContext) {
		await Promise.all(this.transformers.map((transformer) => transformer(ctx)));
	}

	public schedule(
		meter: string,
		transformer: (ctx: TContext) => Record<string, number | string | boolean>,
	) {
		return this.pipe(async (ctx) => {
			if (!this.polarClient) {
				throw new Error("Polar client not initialized");
			}

			await this.polarClient.events.ingest({
				events: [
					{
						customerId: ctx.customerId,
						name: meter,
						metadata: transformer(ctx),
					},
				],
			});
		});
	}
}

export function Ingestion(polar: Polar) {
	return {
		strategy: <TContext extends IngestionContext, TStrategyClient>(
			strategy: IngestionStrategy<TContext, TStrategyClient>,
		) => {
			strategy.polarClient = polar;
			return strategy;
		},
	};
}
