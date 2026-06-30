import { Polar, type SDKOptions } from "@polar-sh/sdk";
import type { CostMetadataInput } from "@polar-sh/sdk/models/components/costmetadatainput.js";
import type { LLMMetadata } from "@polar-sh/sdk/models/components/llmmetadata.js";
import type {
	ChatMiddleware,
	ChatMiddlewareContext,
	UsageInfo,
} from "@tanstack/ai";
import type {
	IngestionStrategyCustomer,
	IngestionStrategyExternalCustomer,
} from "../strategy";

export type TanStackAIUsageContext = {
	inputTokens: number;
	outputTokens: number;
	cachedInputTokens: number;
	totalTokens: number;
	vendor: string;
	model: string;
	strategy: "LLM";
	_llm: LLMMetadata;
	_cost?: CostMetadataInput;
};

type Customer = IngestionStrategyCustomer | IngestionStrategyExternalCustomer;
type TanStackAICostContext = TanStackAIUsageContext & {
	providerCost?: number;
};

export type TanStackAICustomerResolver<TContext = unknown> = (
	ctx: ChatMiddlewareContext<TContext>,
) => Customer;

export type TanStackAICostResolver = (
	ctx: TanStackAICostContext,
) => CostMetadataInput;

export type TanStackAIMiddlewareOptions<TContext = unknown> = {
	polar?: SDKOptions;
	eventName: string;
	customer: Customer | TanStackAICustomerResolver<TContext>;
	cost?: TanStackAICostResolver;
	vendor?: string;
	model?: string;
};

type Totals = Pick<
	TanStackAIUsageContext,
	"inputTokens" | "outputTokens" | "cachedInputTokens" | "totalTokens"
> & {
	providerCost?: number;
};

const emptyTotals = (): Totals => ({
	inputTokens: 0,
	outputTokens: 0,
	cachedInputTokens: 0,
	totalTokens: 0,
});

const addUsage = (totals: Totals, usage: UsageInfo) => {
	totals.inputTokens += usage.promptTokens;
	totals.outputTokens += usage.completionTokens;
	totals.cachedInputTokens += usage.promptTokensDetails?.cachedTokens ?? 0;
	totals.totalTokens += usage.totalTokens;

	if (usage.cost !== undefined) {
		totals.providerCost = (totals.providerCost ?? 0) + usage.cost;
	}
};

const hasUsage = (totals: Totals) =>
	totals.inputTokens > 0 ||
	totals.outputTokens > 0 ||
	totals.cachedInputTokens > 0 ||
	totals.totalTokens > 0;

export function polarTanStackAIMiddleware<TContext = unknown>(
	options: TanStackAIMiddlewareOptions<TContext>,
): ChatMiddleware<TContext> {
	const polar = new Polar(options.polar);
	const totalsByRequestId = new Map<string, Totals>();

	const getCustomer = (ctx: ChatMiddlewareContext<TContext>) =>
		typeof options.customer === "function"
			? options.customer(ctx)
			: options.customer;

	const cleanup = (ctx: ChatMiddlewareContext<TContext>) => {
		totalsByRequestId.delete(ctx.requestId);
	};

	return {
		name: "polar-ingestion",
		onUsage(ctx, usage) {
			const totals = totalsByRequestId.get(ctx.requestId) ?? emptyTotals();
			addUsage(totals, usage);
			totalsByRequestId.set(ctx.requestId, totals);
		},
		onFinish(ctx, info) {
			const totals = totalsByRequestId.get(ctx.requestId) ?? emptyTotals();

			if (!hasUsage(totals) && info.usage) {
				addUsage(totals, info.usage);
			}

			cleanup(ctx);

			if (!hasUsage(totals)) {
				return;
			}

			const vendor = options.vendor ?? ctx.provider;
			const model = options.model ?? ctx.model;
			const { providerCost, ...usageMetadata } = totals;
			const metadata: TanStackAIUsageContext = {
				...usageMetadata,
				vendor,
				model,
				strategy: "LLM",
				_llm: {
					vendor,
					model,
					inputTokens: totals.inputTokens,
					outputTokens: totals.outputTokens,
					cachedInputTokens: totals.cachedInputTokens,
					totalTokens: totals.totalTokens,
				},
			};

			if (providerCost !== undefined) {
				metadata._cost = {
					amount: String(providerCost * 100),
					currency: "USD",
				};
			}

			if (options.cost) {
				metadata._cost = options.cost({ ...metadata, providerCost });
			}

			const ingestion = polar.events
				.ingest({
					events: [
						{
							...getCustomer(ctx),
							name: options.eventName,
							metadata,
						},
					],
				})
				.catch(() => undefined);

			ctx.defer(ingestion);
		},
		onAbort: cleanup,
		onError: cleanup,
	};
}
