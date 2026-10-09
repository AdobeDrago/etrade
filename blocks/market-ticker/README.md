# Market Ticker

Four delayed public index quotes: DOW, NASDAQ, S&P and 10-year Treasury. Author a **Market Ticker** table with an optional `Label | Market indices` row. Empty tables and omitted cells are supported.

Page Metadata `Market Data Base` defaults to `https://us.etrade.com/phx/pros/apicontent/market/`. A configured same-origin proxy base must end in `/` and implement the same service paths and responses. External replacement providers require a separately reviewed adapter; arbitrary external endpoints are rejected.

The block requests `POST quote` with `symbol: DJIND,COMP.IDX,SPX,TNX` and `detailFlag: INTRADAY`. Quotes match by symbol, not array position. Treasury last price is divided by ten, matching the reference. Changes retain the service's units. Missing quotes show unavailable text. Zero values are valid. Fetches omit credentials, time out after seven seconds, share one-minute successful responses, and retry on Refresh. No sample prices are displayed on service failure.

Data delay and service timestamps remain visible. The PHX quote timestamp field needs verification with a live response; absent timestamps show “Time unavailable”. Direction has signed text and accessible names as well as color.

Local samples are restricted to localhost and `/test/fixtures/*.json`. They are labeled and excluded from Edge Delivery. See `docs/welcome-back-authoring.html` for service and delivery dependencies.
