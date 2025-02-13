import {
  IngestionStrategy
} from "../../chunk-7COK3SBL.js";

// src/strategies/S3Strategy/S3Strategy.ts
var S3Strategy = class extends IngestionStrategy {
  s3Client;
  constructor(s3Client, polar) {
    super(polar);
    this.s3Client = s3Client;
  }
  wrapS3Client({
    s3Client,
    execute: _execute,
    customerId: _customerId
  }) {
    const plugin = {
      applyToStack: (stack) => {
        stack.add(
          (next, context) => async (args) => {
            const result = await next(args);
            console.log({ args, context, result });
            return result;
          },
          {
            step: "deserialize",
            priority: "high"
          }
        );
      }
    };
    s3Client.middlewareStack.use(plugin);
    return s3Client;
  }
  client(customerId) {
    const execute = this.createExecutionHandler();
    return this.wrapS3Client({
      s3Client: this.s3Client,
      execute,
      customerId
    });
  }
};
export {
  S3Strategy
};
