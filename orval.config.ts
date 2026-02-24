import { defineConfig } from 'orval';

export default defineConfig({
  weebdex: {
    output: {
      baseUrl: 'https://wd.memaydex.online',
      mode: 'tags-split',
      target: './src/lib/weebdex/hooks',
      schemas: './src/lib/weebdex/model',
      client: 'react-query',
    //   mock: true,
    },
    input: {
      target: './src/lib/weebdex/docs/weebdex-api-docs-v3.json'
    },
  },
});