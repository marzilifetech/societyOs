import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

const REQUEST_ID_HEADER = 'x-request-id';

// UUIDv7 (time-ordered) implementation — falls back to v4 if generation fails.
// Format: time_high(48)|ver(4)|time_low(12)|var(2)|rand(62)
function uuidv7(): string {
  try {
    const ts = BigInt(Date.now());
    const tsHex = ts.toString(16).padStart(12, '0'); // 48 bits
    const rand = Buffer.from(
      Array.from({ length: 10 }, () => Math.floor(Math.random() * 256)),
    );
    // 4-bit version (7) + 12-bit rand
    rand[0] = (0x70 | (rand[0] & 0x0f));
    // 2-bit variant (10) + 14-bit rand
    rand[2] = (0x80 | (rand[2] & 0x3f));
    const hex = rand.toString('hex');
    return [
      tsHex.slice(0, 8),
      tsHex.slice(8, 12),
      hex.slice(0, 4),
      hex.slice(4, 8),
      hex.slice(8, 20),
    ].join('-');
  } catch {
    return uuidv4();
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const id = (typeof incoming === 'string' && incoming.length > 0 && incoming.length < 200)
      ? incoming
      : uuidv7();
    (req as any).id = id;
    res.setHeader('X-Request-Id', id);
    next();
  }
}

export { uuidv7 };
