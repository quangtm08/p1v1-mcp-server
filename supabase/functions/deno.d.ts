// Deno type definitions for Supabase Edge Functions
declare global {
  namespace Deno {
    interface Env {
      get(key: string): string | undefined;
    }
    
    const env: Env;
    
    interface ServeHandler {
      (request: Request): Response | Promise<Response>;
    }
    
    function serve(handler: ServeHandler): void;
  }
}

export {};