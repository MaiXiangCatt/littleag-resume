import { defineConfig } from 'orval';

export default defineConfig({
  auth: {
    input: {
      target: '../../contracts/openapi/openapi.yaml',
    },
    output: {
      mode: 'single',
      target: 'src/services/generated/auth.ts',
      schemas: 'src/services/generated/model',
      client: 'fetch',
      clean: true,
      prettier: false,
    },
  },
});
