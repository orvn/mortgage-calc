/**
 * Alpine.js entrypoint, runs before Alpine.start()
 *
 * Register Alpine.data() components, Alpine.store() stores, and
 * Alpine.directive() custom directives here
 *
 * This is the officially supported pattern from @astrojs/alpinejs
 * https://docs.astro.build/en/guides/integrations-guide/alpinejs/
 * Without it, Alpine.data() registrations can race against DOM
 * processing, esp in Safari and during virtual navigation
 */

import type { Alpine } from 'alpinejs';

// Squarified treemap: splits a W x H box into tiles proportional to vals,
// keeping tiles close to square. Returns fractions of W and H
function squarify(vals: number[], W: number, H: number) {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  let x = 0, y = 0, w = W, h = H, i = 0;
  const area = W * H;
  while (i < vals.length) {
    const horiz = w >= h, side = horiz ? h : w;
    const row: number[] = [];
    let sumA = 0, best = Infinity;
    for (let j = i; j < vals.length; j++) {
      const a = vals[j] * area, s = sumA + a, mn = Math.min(...row, a), mx = Math.max(...row, a);
      const worst = Math.max(side * side * mx / (s * s), s * s / (side * side * mn));
      if (worst > best && row.length) break;
      row.push(a); sumA = s; best = worst;
    }
    const t = sumA / side;
    let off = 0;
    for (const a of row) {
      const len = a / t;
      out.push(horiz ? { x, y: y + off, w: t, h: len } : { x: x + off, y, w: len, h: t });
      off += len;
    }
    if (horiz) { x += t; w -= t; } else { y += t; h -= t; }
    i += row.length;
  }
  return out.map(r => ({ x: r.x / W, y: r.y / H, w: r.w / W, h: r.h / H }));
}

// Marginal tax: each bracket's rate applies only to the slice of price above its `from`
function marginalTax(price: number, brackets: { from: number; rate: number }[]) {
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const from = brackets[i].from, to = brackets[i + 1]?.from ?? Infinity;
    if (price <= from) break;
    tax += (Math.min(price, to) - from) * brackets[i].rate / 100;
  }
  return tax;
}

export default (Alpine: Alpine) => {
  Alpine.store('currency', { code: null as string | null });
  Alpine.store('region', { key: null as string | null });

  Alpine.data('mortgageCalc', (cfg: any) => ({
    price: cfg.defaults.price,
    downPct: cfg.defaults.downPct,
    rate: cfg.defaults.rate,
    years: cfg.defaults.years,
    taxPct: cfg.defaults.taxPct,
    taxOn: cfg.defaults.taxOn,
    landTransferOn: cfg.defaults.landTransferOn,

    get currency(): string {
      return (this as any).$store.currency.code ?? cfg.currency;
    },
    get region(): string {
      return (this as any).$store.region.key ?? cfg.defaults.region;
    },
    get down() { return this.price * this.downPct / 100; },
    get base() { return this.price - this.down; },
    // Default insurance premium tiers by down payment share
    get insuranceRate() {
      return this.downPct < 10 ? 0.04 : this.downPct < 15 ? 0.031 : this.downPct < 20 ? 0.028 : 0;
    },
    get insurance() { return this.base * this.insuranceRate; },
    get principal() { return this.base + this.insurance; },
    get months() { return this.years * 12; },
    get monthly() {
      const r = this.rate / 100 / 12, n = this.months, p = this.principal;
      return r > 0 ? p * r / (1 - Math.pow(1 + r, -n)) : p / n;
    },
    get interest() { return this.monthly * this.months - this.principal; },
    get tax() { return this.taxOn ? this.price * this.taxPct / 100 / 12 : 0; },
    get biweekly() { return this.monthly * 12 / 26; },
    get regionName() { return cfg.regions[this.region].name; },
    get landTransferParts() {
      return cfg.regions[this.region].schedules.map((k: string) => ({
        name: cfg.landTransfer[k].name,
        v: marginalTax(this.price, cfg.landTransfer[k].brackets),
      }));
    },
    get landTransfer() {
      return this.landTransferOn ? this.landTransferParts.reduce((m: number, p: any) => m + p.v, 0) : 0;
    },

    get items() {
      const s = cfg.segments;
      return [
        { key: 'principal', name: s.principal, v: this.base },
        { key: 'interest', name: s.interest, v: this.interest },
        { key: 'down', name: s.down, v: this.down },
        { key: 'tax', name: s.tax, v: this.tax * this.months },
        { key: 'insurance', name: s.insurance, v: this.insurance },
        { key: 'land_transfer', name: s.land_transfer, v: this.landTransfer },
      ].filter(i => i.v > 0).sort((a, b) => b.v - a.v);
    },
    get total() { return this.items.reduce((m, i) => m + i.v, 0); },
    get cells() {
      const items = this.items, sum = this.total;
      return squarify(items.map(i => i.v / sum), 1, 0.52).map((q, i) => ({
        ...items[i],
        x: `${(q.x * 100).toFixed(2)}%`,
        y: `${(q.y * 100).toFixed(2)}%`,
        w: `${(q.w * 100).toFixed(2)}%`,
        h: `${(q.h * 100).toFixed(2)}%`,
        value: this.fmt(items[i].v),
        pct: `${Math.round(items[i].v / sum * 100)}%`,
        size: (q.w < 0.1 || q.h < 0.12) ? 'is-tiny' : q.w < 0.3 ? 'is-small' : (q.w > 0.35 && q.w * q.h > 0.25) ? 'is-large' : '',
      }));
    },

    fmt(v: number, currency = this.currency) {
      const conv = currency === cfg.currency ? 1 : cfg.fxRate;
      return new Intl.NumberFormat(cfg.locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(v * conv);
    },
    // Fill fraction of a range input, for the track's progress colour
    pct(key: string) {
      const [min, max] = cfg.ranges[key];
      return `${(((this as any)[key] - min) / (max - min) * 100).toFixed(1)}%`;
    },

    get priceLabel() { return this.fmt(this.price); },
    get downLabel() { return `${this.downPct}% · ${this.fmt(this.down)}`; },
    get rateLabel() { return `${this.rate.toFixed(2)}%`; },
    get taxLabel() { return `${this.taxPct.toFixed(2)}% · ${this.fmt(this.tax)}/mo`; },
    get landTransferLabel() {
      const parts = this.landTransferParts;
      const total = parts.reduce((m: number, p: any) => m + p.v, 0);
      return this.fmt(total);
    },
    get landTransferNote() {
      const parts = this.landTransferParts;
      if (parts.length < 2) return '';
      return parts.map((p: any) => `${p.name} ${this.fmt(p.v)}`).join(' · ');
    },
    get totalLabel() { return cfg.results.total.replace('{years}', this.years); },
    get taxNote() {
      const r = cfg.results;
      const bi = `${this.fmt(this.biweekly)} ${r.biweekly}`;
      return this.taxOn ? `${this.fmt(this.monthly + this.tax)} ${r.with_tax} · ${bi}` : `${r.without_tax} · ${bi}`;
    },
    get fxNote() {
      if (this.currency === cfg.currency) return '';
      return `${this.fmt(this.monthly, cfg.currency)} ${cfg.results.in_base.replace('{currency}', cfg.currency)}`;
    },
    get fxLabel() {
      const other = cfg.currencies.find((c: string) => c !== cfg.currency);
      return `1 ${cfg.currency} = ${cfg.fxRate} ${other}`;
    },
    get disclaimer() { return cfg.disclaimer.replace('{fx}', this.fxLabel); },
  }));
};
