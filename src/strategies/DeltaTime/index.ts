import type { IngestionContext } from "../../ingestion";
import {
	IngestionStrategy,
	type IngestionStrategyCustomer,
	type IngestionStrategyExternalCustomer,
} from "../../strategy";

type DeltaTimeStrategyContext = IngestionContext & {
	deltaTime: number;
};

type DeltaTimeStrategyNowResolver = () => number;

type DeltaTimeStrategyStart = () => DeltaTimeStrategyStop;
type DeltaTimeStrategyStop = () => number;

export class DeltaTimeStrategy extends IngestionStrategy<
	DeltaTimeStrategyContext,
	DeltaTimeStrategyStart
> {
	public startTime = 0;
	public endTime = 0;
	public nowResolver: DeltaTimeStrategyNowResolver;

	constructor(now: DeltaTimeStrategyNowResolver) {
		super();

		this.nowResolver = now;
	}

	public client(
		customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
	): DeltaTimeStrategyStart {
		return () => {
			const startTime = this.nowResolver();

			return () => {
				const endTime = this.nowResolver();
				const deltaTime = endTime - startTime;

				const execute = this.createExecutionHandler();
				execute({ deltaTime }, customer);

				return deltaTime;
			};
		};
	}
}
