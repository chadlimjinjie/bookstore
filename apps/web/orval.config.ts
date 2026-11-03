import { defineConfig } from 'orval'

// Generated from the committed spec; regenerate with `pnpm api` after editing openapi.yaml.
export default defineConfig({
  bookstore: {
    input: './openapi.yaml',
    output: {
      target: 'src/api/gen.ts',
      client: 'react-query',
      httpClient: 'axios',
      override: { mutator: { path: 'src/api/axios.ts', name: 'request' } },
    },
  },
})
