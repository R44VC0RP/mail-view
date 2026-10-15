# mail-view

Front-end recreations of mail client UIs, built with React, Vite and TypeScript and running on fully synthetic demo data.

Demo messages, people, organizations, profiles, and attachments are fictional. Screenshots use the same synthetic data. Both apps save changes in browser storage; use a fresh browser profile to see the current seed data if you have run an earlier version.

| App | Recreates | Dev server |
| --- | --- | --- |
| [`superhuman/`](superhuman) | Superhuman | http://127.0.0.1:5178 |
| [`gmail/`](gmail) | Gmail | http://127.0.0.1:5174 |

| Superhuman | Gmail |
| --- | --- |
| [![Superhuman inbox](superhuman/docs/inbox.png)](superhuman) | [![Gmail inbox](gmail/docs/inbox.png)](gmail) |

## Run

```sh
cd superhuman   # or gmail
npm install     # gmail uses bun install
npm run dev
```

Reference captures and pixel-diff benchmarks from the original experiments are not included.
