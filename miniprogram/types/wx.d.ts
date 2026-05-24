export {};

declare global {
  const wx: WechatMiniprogram.Wx;

  function App(options: WechatMiniprogram.AppOptions): void;
  function Page(options: WechatMiniprogram.PageOptions): void;

  namespace WechatMiniprogram {
    interface Wx {
      cloud?: {
        init(options: CloudInitOptions): void;
      };
    }

    interface CloudInitOptions {
      env: string;
      traceUser?: boolean;
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
