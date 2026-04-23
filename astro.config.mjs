import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tokenpak.ai',
  integrations: [
    tailwind({ applyBaseStyles: true }),
    sitemap(),
  ],
});
