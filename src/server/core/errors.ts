/** 带 HTTP 状态码的业务错误，由全局 onError 统一转为 JSON 响应 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const unauthorized = (msg = '未登录或登录已过期') => new HttpError(401, msg);
export const forbidden = (msg = '没有权限') => new HttpError(403, msg);
export const notFound = (msg = '资源不存在') => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);
