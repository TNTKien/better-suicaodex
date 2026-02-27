import { siteConfig } from '@/config/site';
import { defineConfig } from 'orval';

export default defineConfig({
  weebdex: {
    output: {
      baseUrl: siteConfig.weebdex.proxyURL,
      mode: 'tags-split',
      target: './src/lib/weebdex/hooks',
      schemas: './src/lib/weebdex/model',
      client: 'react-query',
      clean: true,
      prettier: true,
    },
    input: {
      target: './src/lib/weebdex/docs/weebdex-api-docs-v3.json'
    },
  },
});