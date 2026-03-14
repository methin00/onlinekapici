declare module 'pg' {
  export type PoolSslOptions = {
    rejectUnauthorized?: boolean;
  };

  export type PoolConfig = {
    connectionString?: string;
    ssl?: PoolSslOptions;
  };

  export class Pool {
    constructor(config?: PoolConfig);
    end(): Promise<void>;
  }
}
