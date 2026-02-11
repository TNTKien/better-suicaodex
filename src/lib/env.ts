import { config } from "dotenv";
import { resolve } from "node:path";
import z from "zod";

export const ENVIRONMENT_MODES = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
} as const;

export const LOG_LEVELS = {
  TRACE: "trace",
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  FATAL: "fatal",
} as const;

config({
  path: resolve(".env"),
  quiet: true,
});

// commented bc dont nd it on docker or CI/CD platform
// const checkEnv = () => {
//   if (!existsSync(resolve(".env"))) {
//     console.error(USERS_MESSAGES.DOTENV_FILE_NOT_FOUND);
//     process.exit(1);
//   }
// };
// checkEnv();

const configSchema = z.object({
  // --- Server ---
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(ENVIRONMENT_MODES).default("development"),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("debug"),

  // Auth
  AUTH_SECRET: z.string(),

  AUTH_DISCORD_ID: z.string().default(""),
  AUTH_DISCORD_SECRET: z.string().default(""),

  AUTH_GOOGLE_ID: z.string().default(""),
  AUTH_GOOGLE_SECRET: z.string().default(""),

  AUTH_GITHUB_ID: z.string().default(""),
  AUTH_GITHUB_SECRET: z.string().default(""),

  AUTH_FACEBOOK_ID: z.string().default(""),
  AUTH_FACEBOOK_SECRET: z.string().default(""),

  // --- Database ---
  MONGO_URI: z.string().default(""),
  POSTGRE_DATABASE_URL: z.string().default(""),
  MYSQL_DATABASE_URL: z
    .string()
    .default("mysql://root@localhost:3306/bettersuicao"),
  MYSQL_DATABASE_USER: z.string().default("root"),
  MYSQL_DATABASE_PASSWORD: z.string().default(""),
  MYSQL_DATABASE_NAME: z.string().default("bettersuicao"),
  MYSQL_DATABASE_HOST: z.string().default("localhost"),
  MYSQL_DATABASE_PORT: z.coerce.number().default(3306),
  SHADOW_DATABASE_URL: z.string().default(""),

  NEXT_PUBLIC_BASE_URL: z.string().default(""),
  NEXT_PUBLIC_PROXY_URL: z.string().default(""),
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: z.string().default(""),
});

const configServer = configSchema.safeParse(process.env);

if (!configServer.success) {
  console.error("❌ Các khai báo trong file .env không hợp lệ:");
  configServer.error.issues.forEach((issue) => {
    console.error(` - ${issue.path.join(".")}: ${issue.message}`);
  });
  throw new Error("Lỗi cấu hình biến môi trường");
}

const envConfig = configServer.data;

export const isProduction = envConfig.NODE_ENV === ENVIRONMENT_MODES.PRODUCTION;

export default envConfig;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface ProcessEnv extends z.infer<typeof configSchema> {}
  }
}
