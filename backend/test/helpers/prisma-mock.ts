/**
 * Generic deep-mock builder for PrismaService used in integration tests.
 * Each model gets the standard CRUD jest.fn()s; tests override per-call.
 */
export type PrismaModelMock = {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  createMany: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
  aggregate: jest.Mock;
};

export function makeModelMock(): PrismaModelMock {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  };
}

export function makePrismaMock(models: string[]): Record<string, PrismaModelMock> & {
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
} {
  const out: any = {
    $transaction: jest.fn(async (arg: any) => {
      if (typeof arg === 'function') return arg(out);
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg;
    }),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
  for (const m of models) out[m] = makeModelMock();
  return out;
}
