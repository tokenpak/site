import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://tokenpak.ai',
  integrations: [tailwind({ applyBaseStyles: true })],
});
