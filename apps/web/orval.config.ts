import { defineConfig } from 'orval';

export default defineConfig({
  auth: {
    input: {
      target: '../../contracts/openapi/openapi.yaml',
    },
    output: {
      mode: 'single',
      target: 'src/shared/api/generated/auth.ts',
      schemas: 'src/shared/api/generated/model',
      client: 'fetch',
      clean: true,
      prettier: false,
    },
  },
});
