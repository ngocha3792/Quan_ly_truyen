import { registerAs } from '@nestjs/config';

export default registerAs('search', () => ({
  enabled: process.env.SEARCH_MEILISEARCH_ENABLED === 'true',
  host: process.env.MEILISEARCH_HOST ?? 'http://127.0.0.1:7700',
  apiKey: process.env.MEILISEARCH_API_KEY ?? '',
  index: process.env.MEILISEARCH_INDEX ?? 'reader_search',
}));
