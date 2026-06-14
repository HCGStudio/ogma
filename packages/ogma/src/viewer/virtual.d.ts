declare module 'virtual:ogma-config' {
  import type { OgmaClientConfig } from '../types.js';

  export const runtimeConfig: OgmaClientConfig;
}

declare module 'virtual:ogma-design' {
  import type { OgmaReviewDefinition } from '../types.js';

  export const review: OgmaReviewDefinition;
}
