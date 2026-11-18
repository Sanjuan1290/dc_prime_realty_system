import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';

// Resolve HR's settings beside this service even when started from the repo root.
// Hosted environment variables retain precedence. Tests use injected settings.
export function loadHrEnvironment({env = process.env, path = env.DOTENV_CONFIG_PATH || fileURLToPath(new URL('../.env', import.meta.url))} = {}) {
  if (env.NODE_ENV === 'test' && !env.DOTENV_CONFIG_PATH) return;
  return dotenv.config({path, processEnv: env, quiet: true});
}
loadHrEnvironment();
