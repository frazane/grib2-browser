# grib2-studio

A web app for browsing WMO GRIB2 table specifications and building or editing GRIB2 binary files.

https://frazane.github.io/grib2-studio

## Features

**Browser tab** — browse all WMO GRIB2 code/flag tables and section templates. Search across all tables with highlighted results. Cross-reference links let you jump directly from a template field to the code table that defines its values.

**Editor tab** — a 9-step wizard that walks through each GRIB2 section (0–7). Template-driven steps let you pick a template and fill in its fields. The final step validates field ranges, assembles a binary GRIB2 message, and offers download or a hex dump preview.

You can also load an existing `.grib2` file into the editor, which decodes it and populates all sections for inspection or modification.

## Running locally

No build step — the app is a single `index.html` plus a few JS files. Serve it over HTTP (required for loading the WMO XML data files):

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Data

WMO GRIB2 table files (`data/CodeFlag.xml`, `data/Template.xml`) are vendored from the [wmo-im/GRIB2](https://github.com/wmo-im/GRIB2) repository. The current tables version and app version are shown in the UI status bar.

## Tests

Unit tests cover pure utility functions in `js/utils.js`:

```bash
conda run -n nodejs npm --prefix tests install  # first time only
conda run -n nodejs npm --prefix tests test
```
