/** 轻量事件总线：模块间解耦挂钩（如上传完成后触发缩略图/转码等后续模块） */
export type EventPayload = Record<string, unknown>;
type Handler = (payload: EventPayload) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, Set<Handler>>();

  /** 返回取消订阅函数 */
  on(event: string, handler: Handler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  async emit(event: string, payload: EventPayload = {}): Promise<void> {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        await handler(payload);
      } catch (err) {
        // 一个订阅者（尤其外部模块）的异常不影响其他订阅者与主流程
        console.error(`[bus] ${event} handler error:`, err);
      }
    }
  }
}
