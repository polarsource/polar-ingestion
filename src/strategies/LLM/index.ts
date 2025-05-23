import type {
	LanguageModelV1,
	LanguageModelV1CallOptions,
	LanguageModelV1StreamPart,
} from "@ai-sdk/provider";
import { type LanguageModelV1Middleware, wrapLanguageModel } from "ai";
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
}>;

export class LLMStrategy extends IngestionStrategy<
	LLMStrategyContext,
	LanguageModelV1
> {
	private model: LanguageModelV1;

	constructor(model: LanguageModelV1) {
		super();

		this.model = model;
	}

	private middleware(
		execute: IngestionExecutionHandler<LLMStrategyContext>,
		customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
	): LanguageModelV1Middleware {
		const wrapGenerate = async (options: {
			doGenerate: () => ReturnType<LanguageModelV1["doGenerate"]>;
			params: LanguageModelV1CallOptions;
			model: LanguageModelV1;
		}): Promise<Awaited<ReturnType<LanguageModelV1["doGenerate"]>>> => {
			const result = await options.doGenerate();

			await execute(
				{
					...result.usage,
					totalTokens:
						result.usage.promptTokens + result.usage.completionTokens,
				},
				customer,
			);

			return result;
		};

		const wrapStream = async ({
			doStream,
		}: {
			doStream: () => ReturnType<LanguageModelV1["doStream"]>;
			params: LanguageModelV1CallOptions;
			model: LanguageModelV1;
		}) => {
			const { stream, ...rest } = await doStream();

			const transformStream = new TransformStream<
				LanguageModelV1StreamPart,
				LanguageModelV1StreamPart
			>({
				transform: async (chunk, controller) => {
					if (chunk.type === "finish") {
						await execute(
							{
								...chunk.usage,
								totalTokens:
									chunk.usage.promptTokens + chunk.usage.completionTokens,
							},
							customer,
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
		customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
	): LanguageModelV1 {
		const executionHandler = this.createExecutionHandler();

		return wrapLanguageModel({
			model: this.model,
			middleware: this.middleware(executionHandler, customer),
		});
	}
}
