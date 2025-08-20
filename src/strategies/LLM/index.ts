import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2StreamPart,
} from "@ai-sdk/provider";
import { type LanguageModelMiddleware, wrapLanguageModel } from "ai";
import type { IngestionContext } from "../../ingestion";
import {
  type IngestionExecutionHandler,
  IngestionStrategy,
  type IngestionStrategyCustomer,
  type IngestionStrategyExternalCustomer,
} from "../../strategy";

type LLMStrategyContext = IngestionContext<{
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  provider: LanguageModelV2["provider"];
  model: LanguageModelV2["modelId"];
  strategy: "LLM";
}>;

export class LLMStrategy extends IngestionStrategy<
  LLMStrategyContext,
  LanguageModelV2
> {
  private model: LanguageModelV2;

  constructor(model: LanguageModelV2) {
    super();

    this.model = model;
  }

  private middleware(
    execute: IngestionExecutionHandler<LLMStrategyContext>,
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer
  ): LanguageModelMiddleware {
    const wrapGenerate = async (options: {
      doGenerate: () => ReturnType<LanguageModelV2["doGenerate"]>;
      params: LanguageModelV2CallOptions;
      model: LanguageModelV2;
    }): Promise<Awaited<ReturnType<LanguageModelV2["doGenerate"]>>> => {
      const result = await options.doGenerate();

      await execute(
        {
          promptTokens: result.usage.inputTokens ?? 0,
          completionTokens: result.usage.outputTokens ?? 0,
          totalTokens: result.usage.totalTokens ?? 0,
          provider: this.model.provider,
          model: this.model.modelId,
          strategy: "LLM",
        },
        customer
      );

      return result;
    };

    const wrapStream = async ({
      doStream,
    }: {
      doStream: () => ReturnType<LanguageModelV2["doStream"]>;
      params: LanguageModelV2CallOptions;
      model: LanguageModelV2;
    }) => {
      const { stream, ...rest } = await doStream();

      const transformStream = new TransformStream<
        LanguageModelV2StreamPart,
        LanguageModelV2StreamPart
      >({
        transform: async (chunk, controller) => {
          if (chunk.type === "finish") {
            await execute(
              {
                promptTokens: chunk.usage.inputTokens ?? 0,
                completionTokens: chunk.usage.outputTokens ?? 0,
                totalTokens: chunk.usage.totalTokens ?? 0,
                provider: this.model.provider,
                model: this.model.modelId,
                strategy: "LLM",
              },
              customer
            );
          }

          controller.enqueue(chunk);
        },
      });

      return {
        stream: stream.pipeThrough(transformStream),
        ...rest,
      };
    };

    return {
      wrapGenerate,
      wrapStream,
    };
  }

  override client(
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer
  ): LanguageModelV2 {
    const executionHandler = this.createExecutionHandler();

    return wrapLanguageModel({
      model: this.model,
      middleware: this.middleware(executionHandler, customer),
    });
  }
}
