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
      getStorageSync(key: string): unknown;
      setStorageSync(key: string, value: unknown): void;
      removeStorageSync(key: string): void;
      showToast(options: ShowToastOptions): void;
      redirectTo(options: NavigateOptions): void;
      switchTab(options: NavigateOptions): void;
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

    interface ShowToastOptions {
      title: string;
      icon?: "success" | "error" | "loading" | "none";
      duration?: number;
    }

    interface NavigateOptions {
      url: string;
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
