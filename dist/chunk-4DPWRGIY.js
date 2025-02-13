// src/ingestion.ts
var Ingestion = class {
  polarClient;
  transformers = [];
  constructor(polar) {
    this.polarClient = polar;
  }
  pipe(transformer) {
    this.transformers.push(transformer);
    return this;
  }
  async execute(ctx) {
    await Promise.all(this.transformers.map((transformer) => transformer(ctx)));
  }
  schedule(meter, transformer) {
    return this.pipe(async (ctx) => {
      await this.polarClient.events.ingest({
        events: [
          {
            customerId: ctx.customerId,
            name: meter,
            metadata: transformer(ctx)
          }
        ]
      });
    });
  }
};

export {
  Ingestion
};
