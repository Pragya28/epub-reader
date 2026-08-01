Literata variable font files (latin + latin-ext, weight axis, normal + italic),
used by the reader iframe so book text renders correctly offline on the very
first read (not just after the Google Fonts CDN has been hit once).

Sourced from `@fontsource-variable/literata` — to regenerate:

```
pnpm add -D @fontsource-variable/literata
cp node_modules/@fontsource-variable/literata/files/literata-latin{,-ext}-wght-{normal,italic}.woff2 public/fonts/literata/
pnpm remove @fontsource-variable/literata
```
