import { Polar, type SDKOptions } from "@polar-sh/sdk";
import type { EventCreateCustomer } from "@polar-sh/sdk/models/components/eventcreatecustomer.js";
import type {
  IngestionStrategy,
  IngestionStrategyContext,
  IngestionStrategyCustomer,
  IngestionStrategyExternalCustomer,
} from "./strategy";
import type { EventCreateExternalCustomer } from "@polar-sh/sdk/models/components/eventcreateexternalcustomer.js";

export type IngestionContext<
  TContext extends Record<string, string | number | boolean> = Record<
    string,
    string | number | boolean
  >
> = TContext;

type Transformer<TContext extends IngestionContext> = (
  ctx: TContext,
  customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer
) => Promise<void>;

export class PolarIngestion<TContext extends IngestionContext> {
  public polarClient?: Polar;
  private transformers: Transformer<TContext>[] = [];
  private eventBatch: (EventCreateCustomer | EventCreateExternalCustomer)[] =
    [];
  private batchTimer?: NodeJS.Timeout;
  private readonly batchTimeout = 500;

  private pipe(transformer: Transformer<TContext>) {
    this.transformers.push(transformer);

    return this;
  }

  private async flushBatch() {
    if (this.eventBatch.length === 0) return;

    const eventsToSend = [...this.eventBatch];
    this.eventBatch = [];

    if (this.polarClient) {
      await this.polarClient.events.ingest({
        events: eventsToSend,
      });
    }
  }

  public async execute(
    ctx: TContext,
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer
  ) {
    await Promise.all(
      this.transformers.map((transformer) => transformer(ctx, customer))
    );
  }

  public schedule(
    meter: string,
    metadataResolver?: (
      ctx: TContext
    ) => Record<string, number | string | boolean>
  ) {
    return this.pipe(async (ctx, customer) => {
      if (!this.polarClient) {
        throw new Error("Polar client not initialized");
      }

      const event = {
        ...customer,
        name: meter,
        metadata: metadataResolver ? metadataResolver(ctx) : ctx,
      };

      this.eventBatch.push(event);

      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }

      this.batchTimer = setTimeout(() => {
        this.flushBatch();
        this.batchTimer = undefined;
      }, this.batchTimeout);
    });
  }
}

export function Ingestion(polarConfig?: SDKOptions) {
  return {
    strategy: <TContext extends IngestionStrategyContext, TStrategyClient>(
      strategy: IngestionStrategy<TContext, TStrategyClient>
    ) => {
      strategy.polarClient = new Polar(polarConfig);
      return strategy;
    },
    ingest: async (events: (EventCreateCustomer | EventCreateCustomer)[]) => {
      const polar = new Polar(polarConfig);

      return polar.events.ingest({
        events,
      });
    },
  };
}
