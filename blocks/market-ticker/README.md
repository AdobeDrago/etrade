# Market Ticker

Four index quotes (currently demo samples): DOW, NASDAQ, S&P and 10-year Treasury. Author a **Market Ticker** table with an optional `Label | Market indices` row. Empty tables and omitted cells are supported.

The demo defaults to same-origin `/data/market-data.json`, including already-previewed DA pages with no new metadata. Ticker, overview charts, symbol lookup and all Top Five categories share this file and display sample-data notices. Edit `data/market-data.json` to change the demo values. The file is served by Edge Delivery, unlike test fixtures.

Set page Metadata `Market Data Mode` to `live` when the real service is ready. In live mode, `Market Data Base` defaults to `https://us.etrade.com/phx/pros/apicontent/market/`. A configured same-origin proxy base must end in `/` and implement the same service paths and responses. External replacement providers require a separately reviewed adapter; arbitrary external endpoints are rejected.

The block requests `POST quote` with `symbol: DJIND,COMP.IDX,SPX,TNX` and `detailFlag: INTRADAY`. Quotes match by symbol, not array position. Treasury last price is divided by ten, matching the reference. Changes retain the service's units. Missing quotes show unavailable text. Zero values are valid. Fetches omit credentials, time out after seven seconds, share one-minute successful responses, and retry on Refresh. No sample prices are displayed on service failure.

Data delay and service timestamps remain visible. The PHX quote timestamp field needs verification with a live response; absent timestamps show “Time unavailable”. Direction has signed text and accessible names as well as color.

The bundled sample file is allowed on the same origin on localhost, preview and live delivery. Additional `/test/fixtures/*.json` remain localhost-only. Failure in either selected mode stays unavailable and does not switch sources. Copyable page metadata and market blocks are available in `docs/current-pages-authoring.html?page=welcome-back`.
