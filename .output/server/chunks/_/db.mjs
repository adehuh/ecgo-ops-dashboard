import { d as defineEventHandler, s as setResponseStatus, u as useRuntimeConfig } from '../nitro/nitro.mjs';
import { ZodError } from 'zod';
import postgres from 'postgres';

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const STATUS_BY_CODE = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  INTERNAL: 500
};
class ApiError extends Error {
  constructor(code, message, details) {
    super(message);
    __publicField(this, "code", code);
    __publicField(this, "details", details);
    this.name = "ApiError";
  }
}
const notFound = (message) => new ApiError("NOT_FOUND", message);
function parseOrThrow(schema, input, what) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new ApiError(
    "VALIDATION_ERROR",
    `${what} tidak valid`,
    result.error.issues.map((issue) => ({
      path: issue.path.join(".") || "(root)",
      message: issue.message
    }))
  );
}
function defineApiHandler(handler) {
  return defineEventHandler(async (event) => {
    try {
      return await handler(event);
    } catch (error) {
      return respondWithError(event, error);
    }
  });
}
function respondWithError(event, error) {
  if (error instanceof ApiError) {
    setResponseStatus(event, STATUS_BY_CODE[error.code]);
    return { error: { code: error.code, message: error.message, ...error.details ? { details: error.details } : {} } };
  }
  if (error instanceof ZodError) {
    setResponseStatus(event, 400);
    return {
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter tidak valid",
        details: error.issues.map((i) => ({ path: i.path.join(".") || "(root)", message: i.message }))
      }
    };
  }
  console.error("[api] kegagalan tak tertangani", error);
  setResponseStatus(event, 500);
  return {
    error: {
      code: "INTERNAL",
      message: "Terjadi kesalahan tak terduga di server. Silakan coba lagi."
    }
  };
}

let client;
function useDb() {
  if (client) return client;
  const config = useRuntimeConfig();
  const url = config.databaseUrl || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL belum diset. Salin .env.example menjadi .env, lalu jalankan `docker compose up -d`."
    );
  }
  client = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {
    }
  });
  return client;
}
function staleMinutes() {
  const parsed = Number(useRuntimeConfig().staleMinutes);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

export { defineApiHandler as d, notFound as n, parseOrThrow as p, staleMinutes as s, useDb as u };
//# sourceMappingURL=db.mjs.map
