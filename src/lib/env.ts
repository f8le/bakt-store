import 'server-only';
import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  MOYASAR_SECRET_KEY: z.string().min(10),
  MOYASAR_PUBLISHABLE_KEY: z.string().min(10),
  MOYASAR_WEBHOOK_SECRET: z.string().min(16),
});
let cached: z.infer<typeof schema> | undefined;
export const env = () => (cached ??= schema.parse(process.env));
