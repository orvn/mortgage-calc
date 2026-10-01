import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decode } from '@toon-format/toon';

export interface GlobalContent {
  name: string;
  tagline: string;
  description: string;
  url: string;
  title_postfix: string;
  og_image: string;
}

export interface PageMeta {
  title: string | null;
  description: string;
  og_image: string;
}

export interface PageOptions {
  noindex?: boolean;
}

export interface PageContent<C = Record<string, unknown>> {
  meta: PageMeta;
  options: PageOptions | null;
  content: C;
}

export interface CalculatorContent {
  rail: string;
  kicker: string;
  heading: string;
  subheading: string;
  intro: string;
  illustration_alt: string;
  figures_rail: string;
  labels: Record<'price' | 'down' | 'rate' | 'term' | 'tax' | 'insured' | 'currency' | 'region' | 'land_transfer', string>;
  results: Record<'monthly' | 'total' | 'with_tax' | 'without_tax' | 'biweekly' | 'in_base', string>;
  segments: Record<'principal' | 'interest' | 'down' | 'tax' | 'insurance' | 'land_transfer', string>;
  disclaimer: string;
  settings: {
    currency: string;
    currencies: string[];
    fx_rate: number;
    locale: string;
    terms: number[];
    defaults: {
      price: number;
      down_pct: number;
      rate: number;
      years: number;
      tax_pct: number;
      tax_on: boolean;
      land_transfer_on: boolean;
      region: string;
    };
    ranges: Record<'price' | 'down_pct' | 'rate' | 'tax_pct', number[]>;
    regions: Record<string, { name: string; schedules: string[] }>;
    land_transfer: Record<string, { name: string; brackets: { from: number; rate: number }[] }>;
  };
}

function readToon(filename: string): string {
  return readFileSync(join(process.cwd(), 'src/content', filename), 'utf-8');
}

export function loadGlobal(): GlobalContent {
  return decode(readToon('global.toon')) as unknown as GlobalContent;
}

export function loadPage<C = Record<string, unknown>>(name: string): PageContent<C> {
  return decode(readToon(`${name}.toon`)) as unknown as PageContent<C>;
}
