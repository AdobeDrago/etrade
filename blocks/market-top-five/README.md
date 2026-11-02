# Market Top Five

Selectable delayed stocks, mutual funds, and ETFs with quote links and small charts. Author a **Market Top Five** table:

| Key | Value |
| --- | --- |
| Heading | Top five |
| Default | TopDivYieldStocks |
| TopDivYieldStocks label | Top Dividend Yielding Stocks (optional) |
| MostSearchedMFs label | Most Searched Mutual Funds (optional) |
| TopETFs label | Top Performing ETFs (optional) |
| TopDivYieldStocks disclaimer | Complete authored stock disclaimer |
| MostSearchedMFs disclaimer | Complete authored mutual-fund disclaimer |
| TopETFs disclaimer | Complete authored ETF disclaimer |

Keys are case insensitive. Rows/cells may be omitted; unknown default values use stocks. Extra value cells are combined. Keep all three category disclosures authored before delivery. An omitted disclaimer stays hidden and is flagged by `data-disclaimer-state="missing"`; the block does not invent legal copy. The copy-ready page contains the reference disclosures for content-owner review.

The demo selects quotes and sparkline histories from same-origin `data/market-data.json` and labels the results as samples. Setting `Market Data Mode` metadata to `live` enables services: GET `top5/TopDivYieldStocks`, `top5/MostSearchedMFs`, and `top5/TopETFs`. `top5Response.data` supplies quotes; `chartResponse.data` aligns charts by position as in the existing site's PHX implementation. Latest Eastern calendar day observations are used for stock/ETF charts; mutual fund histories retain all observations. This positional contract must be verified against live service responses.

At most five unique valid quotes are shown; a shorter valid list remains usable. Missing charts are labeled unavailable. Requests and disclosures track the current selector; late older responses cannot overwrite it. Refresh retries failures. Prices are never authored or fabricated as a production fallback. Quote links hand off to E*TRADE's existing research destination.

Layout: one column below 768px. From 768px, the grid fits up to five columns, with a 10rem minimum per quote and shared 16-unit gaps; available width and enlarged text can reduce the column count. Data timestamps, delay notice, signed changes and accessible chart summaries are visible. Author category disclaimers and page metadata in DA using the keys above.

## Shared style system

Prices, changes, chart colors and controls use shared roles. The five-column cap reduces to fewer columns when available width or enlarged text requires it. Symbols and prices can wrap independently; category selection and authored disclosures are unchanged. See the [shared component styles](../../README.md#shared-component-styles) for ownership and validation on `etrade-style`.

`--market-top-five-grid-columns` stays local to this block because its five-quote cap, 10rem minimum, and gap differ from the shared card and ticker grids.
