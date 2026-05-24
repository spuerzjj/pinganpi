export {};

declare global {
  const wx: WechatMiniprogram.Wx;

  function App(options: WechatMiniprogram.AppOptions): void;
  function Page(options: WechatMiniprogram.PageOptions): void;

  namespace WechatMiniprogram {
    interface Wx {
      cloud?: {
        init(options: CloudInitOptions): void;
        callFunction<T = unknown>(options: CloudCallFunctionOptions): Promise<CloudCallFunctionResult<T>>;
      };
    }

    interface CloudInitOptions {
      env: string;
      traceUser?: boolean;
    }

    interface CloudCallFunctionOptions {
      name: string;
      data?: unknown;
    }

    interface CloudCallFunctionResult<T = unknown> {
      result?: T;
    }

    interface AppOptions {
      globalData?: Record<string, unknown>;
      onLaunch?(): void;
      onShow?(): void;
      onHide?(): void;
    }

    interface PageOptions {
      data?: Record<string, unknown>;
      onLoad?(): void;
      onShow?(): void;
      [key: string]: unknown;
    }
  }
}
