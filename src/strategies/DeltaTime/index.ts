import type { IngestionContext } from "../../ingestion";
import { IngestionStrategy } from "../../strategy";

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

	public client(customerId: string): DeltaTimeStrategyStart {
		return () => {
			const startTime = this.nowResolver();

			return () => {
				const endTime = this.nowResolver();
				const deltaTime = endTime - startTime;

				const execute = this.createExecutionHandler();
				execute({ deltaTime }, customerId);

				return deltaTime;
			};
		};
	}
}
