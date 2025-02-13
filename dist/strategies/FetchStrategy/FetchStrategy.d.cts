import { IngestionStrategy, IngestionContext } from '@polar-sh/adapter-utils';
import { Polar } from '@polar-sh/sdk';

type Fetch = typeof fetch;
type FetchStrategyContext = IngestionContext<{
    url: string;
    method: string;
}>;
declare class FetchStrategy extends IngestionStrategy<FetchStrategyContext, Fetch> {
    private fetchClient;
    constructor(fetchClient: Fetch, polar: Polar);
    client(customerId: string): Fetch;
}

export { FetchStrategy };
