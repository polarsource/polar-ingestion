# @polar-sh/ingestion

This ingestion framework offers a robust SDK to work with Polar's event ingestion API.

> [!WARNING]  
> This SDK is still under development, and should not be used unless for development reasons. Polar's ingestion feature does still not have a UI.

## Strategies

Want to report events regarding Large Language Model usage, S3 file uploads or something else? Our Ingestion strategies are customized to make it as seamless as possible to fire ingestion events for complex needs.

### LLM Strategy

Wrap any LLM model from the `@ai-sdk/*` library, to automatically fire prompt- & completion tokens used by every model call.

```
pnpm add @polar-sh/ingestion ai @ai-sdk/openai
```

```typescript
import { Ingestion } from '@polar-sh/ingestion';
import { LLMStrategy } from '@polar-sh/ingestion/strategies/LLM';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Setup the LLM Ingestion Strategy
const llmIngestion = Ingestion({ accessToken: process.env.POLAR_ACCESS_TOKEN })
    .strategy(new LLMStrategy(openai('gpt-4o')))
    .ingest('openai-usage')

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();

  // Get the wrapped LLM model with ingestion capabilities
  // Pass Customer Id to properly annotate the ingestion events with a specific customer
  const model = llmIngestion.client(
    req.headers.get('X-Polar-Customer-Id')
  )

  const { text } = await generateText({
    model,
    system: 'You are a helpful assistant.',
    prompt,
  });

  return Response.json({ text });
}
```

### S3 Strategy

Wrap the official AWS S3 Client with our S3 Ingestion Strategy to automatically ingest bytes uploaded. 

```
pnpm add @polar-sh/ingestion @aws-sdk/client-s3
```

```typescript
import { Ingestion } from '@polar-sh/ingestion';
import { S3Strategy } from "@polar-sh/ingestion/strategies/S3";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Setup the S3 Ingestion Strategy
const s3Ingestion = Ingestion({ accessToken: process.env.POLAR_ACCESS_TOKEN })
    .strategy(new S3Strategy(s3Client))
    .ingest('s3-uploads')

export async function POST(request: Request) {
  try {

    // Get the wrapped S3 Client
    // Pass Customer Id to properly annotate the ingestion events with a specific customer
    const s3 = s3Ingestion.client(
      request.headers.get("X-Polar-Customer-Id") ?? ""
    );

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: 'a-random-key',
        Body: JSON.stringify({
          name: 'John Doe',
          age: 30,
        }),
        ContentType: 'application/json',
      })
    );

    return Response.json({});
  } catch (error) {
    return Response.json({ error: error.message });
  }
}

```

### Stream Strategy

Wrap any Readable or Writable stream of choice to automatically ingest the bytes consumed.

```
pnpm add @polar-sh/ingestion
```

```typescript
import { Ingestion } from '@polar-sh/ingestion';
import { StreamStrategy } from '@polar-sh/ingestion/strategies/Stream';

const myReadstream = createReadStream(...);

// Setup the Stream Ingestion Strategy
const streamIngestion = Ingestion({ accessToken: process.env.POLAR_ACCESS_TOKEN })
  .strategy(new StreamStrategy(myReadstream))
  .ingest("my-stream");

export async function GET(request: Request) {
  try {

    // Get the wrapped stream
    // Pass Customer Id to properly annotate the ingestion events with a specific customer
    const stream = streamIngestion.client(
      request.headers.get("X-Polar-Customer-Id") ?? ""
    );
    
    // Consume stream...
    stream.on('data', () => ...)

    return Response.json({});
  } catch (error) {
    return Response.json({ error: error.message });
  }
}
```

## Usage Based Billing with Polar Ingestion

Documentation coming soon.
