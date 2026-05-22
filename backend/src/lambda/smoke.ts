// Local smoke test: invoke a Lambda handler with a synthetic API Gateway v2
// (HTTP API) event. Run with: `pnpm lambda:smoke <handler-name> [path]`.
//
// Example: pnpm lambda:smoke core-identity /v1/health
//
// Requires the same env that a real deploy needs (DATABASE_URL, JWT_SECRET, etc.).
// Health endpoint is the safest target — it doesn't need auth and exercises
// Prisma + Redis connections.

import 'reflect-metadata';
import type { LambdaName } from './module-groups';
import { MODULE_GROUPS } from './module-groups';

async function main() {
  const name = (process.argv[2] ?? 'core-identity') as LambdaName;
  const path = process.argv[3] ?? '/v1/health';
  const method = (process.argv[4] ?? 'GET').toUpperCase();
  const bodyArg = process.argv[5]; // optional JSON string
  const tokenArg = process.env.SMOKE_BEARER; // optional bearer token

  if (!(name in MODULE_GROUPS)) {
    console.error(
      `Unknown handler "${name}". Valid: ${Object.keys(MODULE_GROUPS).join(', ')}`,
    );
    process.exit(1);
  }

  const mod = await import(`./handlers/${name}`);
  const handler = mod.handler as (e: unknown, c: unknown) => Promise<unknown>;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    host: 'smoke.local',
  };
  if (tokenArg) headers.authorization = `Bearer ${tokenArg}`;

  const event = {
    version: '2.0',
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: '',
    headers,
    requestContext: {
      accountId: 'local',
      apiId: 'local',
      domainName: 'smoke.local',
      domainPrefix: 'smoke',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'smoke',
      },
      requestId: `smoke-${Date.now()}`,
      routeKey: `${method} ${path}`,
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    body: bodyArg,
    isBase64Encoded: false,
  };

  const context = {
    awsRequestId: `smoke-${Date.now()}`,
    functionName: name,
    functionVersion: '$LATEST',
    invokedFunctionArn: `arn:aws:lambda:local:000000000000:function:${name}`,
    memoryLimitInMB: '512',
    logGroupName: `/aws/lambda/${name}`,
    logStreamName: 'smoke',
    getRemainingTimeInMillis: () => 30_000,
    callbackWaitsForEmptyEventLoop: false,
    done: () => undefined,
    fail: () => undefined,
    succeed: () => undefined,
  };

  const t0 = Date.now();
  const res = await handler(event, context);
  const ms = Date.now() - t0;
  console.log(`[${name} ${path}] ${ms}ms`);
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error('smoke failed:', err);
  process.exit(1);
});
