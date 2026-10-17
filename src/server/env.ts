import type { TokenPayload } from './core/auth.js';

/** Hono 泛型环境：请求上下文中可用的变量 */
export type Env = {
  Variables: {
    user: TokenPayload;
  };
};
