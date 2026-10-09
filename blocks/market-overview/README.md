# Market Overview

Index chart and quote search. Author a **Market Overview** table:

| Key | Value |
| --- | --- |
| Heading | Market overview |
| Search label | Get quotes |

Rows are optional, extra value cells are combined, and empty tables use the default labels.

Four index tabs use POST `chart` with `indexes: DJIND`, `COMPIDX`, `SPX`, or `TNX`. Latest Eastern calendar day observations are sorted and deduplicated by timestamp. Treasury chart prices are divided by ten. Native SVG plots require no chart library. A labeled slider lets keyboard users inspect each point, and a native disclosure exposes a complete data table. Arrow keys, Home, and End switch index tabs. A single shared tabpanel follows the selected tab. Late responses from earlier selections cannot overwrite a new selection.

Search suggestions call POST `lookup` after a 300ms debounce, rendering up to eight symbol/company matches. Enter navigates a valid typed symbol to the existing E*TRADE quote page; selecting a suggestion does the same. Escape clears suggestions, Arrow Down enters the list, and suggestion buttons support normal keyboard navigation. The latest five searched symbols are stored in sessionStorage; storage failure never prevents navigation. Returning in the same tab restores links and attempts delayed quote changes. This storage is independent of production E*TRADE's domain cookie.

Service failures preserve navigation and show retryable states. Stale requests cannot overwrite newer search suggestions. No synthetic values replace failed market data. Shared service configuration and local-only fixture rules are documented in Market Ticker and the authoring guide.
