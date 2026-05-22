import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),

  // Required at boot — fail-fast
  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).required(),
  AWS_REGION: Joi.string().required(),

  // Optional
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // External Marzi Senior Community backend integration.
  // When false (prod default), /auth/send-otp + /auth/verify-otp return 404 —
  // client must use the external backend for OTP. JwtStrategy verifies
  // externally-issued JWTs using the same JWT_SECRET (HS256 shared secret).
  AUTH_LOCAL_OTP_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),

  // OTP delivery source for /auth/send-otp + /auth/verify-otp:
  //   local → in-house Redis OTP (dev magic code 123456 when NODE_ENV!=production)
  //   marzi → proxy send/verify to the external Marzi backend at
  //           MARZI_AUTH_BASE_URL. SocietyOS still mints its own JWTs, so no
  //           shared JWT secret with the external backend is needed.
  OTP_PROVIDER: Joi.string().valid('local', 'marzi').default('local'),
  MARZI_AUTH_BASE_URL: Joi.string().uri().allow('').optional(),
  MARZI_TENANT_NAME: Joi.string().allow('').default('Marzi'),
  AWS_S3_BUCKET: Joi.string().optional(),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),

  CORS_ORIGINS: Joi.string().default(''),

  RAZORPAY_KEY_ID: Joi.string().allow('').optional(),
  RAZORPAY_KEY_SECRET: Joi.string().allow('').optional(),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().allow('').optional(),

  FIREBASE_SERVICE_ACCOUNT: Joi.string().allow('').optional(),
  FIREBASE_SA_BASE64: Joi.string().allow('').optional(),

  SENTRY_DSN: Joi.string().uri().allow('').optional(),
  SENTRY_TRACES_SAMPLE_RATE: Joi.number().min(0).max(1).default(0.1),

  // Throttler quotas (overridable)
  THROTTLE_TTL_MS: Joi.number().default(60_000),
  THROTTLE_LIMIT_DEFAULT: Joi.number().default(100),
  THROTTLE_LIMIT_AUTH: Joi.number().default(10),
  THROTTLE_LIMIT_SOS: Joi.number().default(5),

  /** Resident-only: max time after trigger to mark false alarm (ms). Admins/staff uncapped. */
  SOS_CANCEL_WINDOW_MS: Joi.number().min(1000).max(120_000).default(5000),

  // Body size
  BODY_LIMIT: Joi.string().default('1mb'),

  GOOGLE_TRANSLATE_API_KEY: Joi.string().allow('').optional(),

  // PII encryption (P3 may use this)
  PII_ENCRYPTION_KEY: Joi.string().length(64).allow('').optional(),

  // Swagger gating in prod
  SWAGGER_USER: Joi.string().allow('').optional(),
  SWAGGER_PASS: Joi.string().allow('').optional(),

  // Pagination
  LIST_DEFAULT_LIMIT: Joi.number().default(50),
  LIST_MAX_LIMIT: Joi.number().default(200),
}).unknown(true);
