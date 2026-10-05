import { z } from 'zod';

const httpsUrl = z.string().url().refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, 'Use an HTTPS URL without credentials');
const localAsset = z.string().regex(/^\/(?!\/)[a-zA-Z0-9/_ .-]+$/, 'Use a local public asset path').refine(value => !value.split('/').includes('..'), 'Path traversal is not allowed');
const hsl = z.string().regex(/^\d{1,3}(\.\d+)? \d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/)
  .refine(value => { const [h,s,l] = value.split(' ').map(parseFloat); return h <= 360 && s <= 100 && l <= 100; }, 'Invalid HSL color');
export const academySchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(5).max(300),
  siteUrl: httpsUrl.refine(value => new URL(value).pathname === '/' && !new URL(value).search && !new URL(value).hash, 'Use the site origin only'),
  logoPath: localAsset,
  certificateLogoPath: localAsset,
  contactEmail: z.string().email(),
  phone: z.string().regex(/^[+\d ()-]{0,30}$/),
  address: z.string().max(200),
  facebookUrl: z.union([z.literal(''), httpsUrl]),
  journalName: z.string().min(2).max(150),
  journalEmail: z.string().email(),
  certificatePrefix: z.string().regex(/^[A-Z0-9-]{2,12}$/),
  certificateTemplatePath: localAsset,
  meetingPrefix: z.string().regex(/^[A-Za-z0-9-]{2,60}$/),
  defaultLanguage: z.enum(['en', 'ar']),
  accentLight: hsl,
  accentDark: hsl,
  analyticsUrl: z.union([z.literal(''), httpsUrl]),
  features: z.object({
    journal: z.boolean(), research: z.boolean(), liveTeaching: z.boolean(),
    certificates: z.boolean(), learningPaths: z.boolean(), telegram: z.boolean(),
    payments: z.boolean(), testimonials: z.boolean(),
  }).strict(),
}).strict();
export type AcademyConfig = z.infer<typeof academySchema>;
