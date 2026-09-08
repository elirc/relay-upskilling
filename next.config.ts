import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone', poweredByHeader: false,
  outputFileTracingExcludes: { '/*': ['./.tools/**/*','./.cache/**/*','./.data/**/*','./.env*','./test-results/**/*','./upskilling/**/*','./worker/**/*','./worker.tests/**/*'] }
};
export default config;