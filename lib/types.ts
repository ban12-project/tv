export {};

declare global {
  export type Dictionary<T> = Record<string, T>;

  export type Writable<T> = {
    -readonly [P in keyof T]: T[P];
  };

  /**
   * make only some properties optional
   *
   * https://github.com/Microsoft/TypeScript/issues/25760
   */
  export type WithOptional<T, K extends keyof T> = Omit<T, K> &
    Partial<Pick<T, K>>;

  export type WithRequired<T, K extends keyof T> = Omit<T, K> &
    Required<Pick<T, K>>;

  export type OmitNullish<T> = {
    [K in keyof T as T[K] extends null | undefined ? never : K]: T[K];
  };

  export type NoNullFields<T> = {
    [K in keyof T]: NonNullable<T[K]>;
  };
}
