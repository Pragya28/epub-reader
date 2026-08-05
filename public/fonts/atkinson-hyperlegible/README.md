Atkinson Hyperlegible static font files (latin + latin-ext, weight 400 only),
used as a selectable reader font so it renders correctly offline on the very
first read — same reasoning as `public/fonts/literata/`. Designed by the
Braille Institute to maximize character distinction (e.g. B/8, O/0, 1/I/l) —
offered as the accessibility-oriented reading option.

To regenerate:

```
curl -sL -A "Mozilla/5.0" "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400&display=swap"
# copy the latin / latin-ext woff2 URLs from the output, then:
curl -sL -o atkinson-latin-400.woff2 "<latin url>"
curl -sL -o atkinson-latin-ext-400.woff2 "<latin-ext url>"
```
