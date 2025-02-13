import { S3Client } from '@aws-sdk/client-s3';
import { IngestionStrategy, IngestionContext } from '@polar-sh/adapter-utils';
import { Polar } from '@polar-sh/sdk';

type S3StrategyContext = IngestionContext & {
    bucket: string;
    key: string;
    bytes: number;
};
declare class S3Strategy extends IngestionStrategy<S3StrategyContext, S3Client> {
    private s3Client;
    constructor(s3Client: S3Client, polar: Polar);
    private wrapS3Client;
    client(customerId: string): S3Client;
}

export { S3Strategy };
