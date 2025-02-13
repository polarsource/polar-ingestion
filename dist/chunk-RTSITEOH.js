import {
  Ingestion
} from "./chunk-4DPWRGIY.js";

// src/strategy.ts
var IngestionStrategy = class extends Ingestion {
  createExecutionHandler() {
    return async (context) => {
      await this.execute(context);
    };
  }
  ingest(eventName, metadataResolver) {
    this.schedule(eventName, metadataResolver);
    return this;
  }
};

export {
  IngestionStrategy
};
