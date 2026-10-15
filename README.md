# mail-view

Two standalone mail interfaces built with React, Vite, and TypeScript. Run them locally, explore the interactions, and use either as a starting point for your own UI.

All demo messages, people, organizations, profiles, and attachments are synthetic. The apps run locally without a mail account or backend.

[Get started](#get-started) · [Build your own UI](#build-your-own-ui)

## Superhuman

Split inbox, conversation reader, command palette, and composer.

![Superhuman inbox](superhuman/docs/inbox.png)

[More screenshots and source →](superhuman/README.md)

## Gmail

Dark-mode inbox, labels, search, conversation reader, and docked composer.

![Gmail inbox](gmail/docs/inbox.png)

[More screenshots and source →](gmail/README.md)

## Get started

Use Node.js 24 LTS or newer, with npm. The Gmail app also uses Bun for dependency installation and tests.

1. Clone the repository:

   ```sh
   git clone https://github.com/R44VC0RP/mail-view.git
   cd mail-view
   ```

2. From the repository root, start **one** of the apps:

   **Superhuman**

   ```sh
   cd superhuman
   npm ci
   npm run dev
   ```

   Open http://127.0.0.1:5178.

   **Gmail**

   ```sh
   cd gmail
   bun install
   bun run dev
   ```

   Open http://127.0.0.1:5174.

3. Open the chosen folder in your editor. Save changes to the React components or CSS to see them update in the browser.

## Build your own UI

1. **Pick a starting point.** Copy the complete `gmail/` or `superhuman/` folder into your own project. Each is a self-contained app; keep its `public/` assets, styles, package files, and configuration together.
2. **Change the look.** Start with [Gmail's `src/styles.css`](gmail/src/styles.css) or [Superhuman's `src/style.css`](superhuman/src/style.css) for colors, fonts, and layout variables. Component styles live in Gmail's `src/components/*.css` and Superhuman's `src/*.css`; check those for local overrides.
3. **Make the screens and content yours.** `src/App.tsx` in each app connects the views and state. Edit the inbox, reader, and composer components, then replace the examples in `src/data.ts`. Each app's README points to the main files. Browser edits are saved locally, so use a fresh browser profile when you want to load changed seed data.
4. **Add a backend when you're ready.** The current send, archive, and other mail actions update local demo state. Connect those actions to your API and map incoming data to Gmail's [`Email` type](gmail/src/types.ts) or Superhuman's [`Mail` type](superhuman/src/data.ts).

For a first customization, try changing the accent color, replacing a few sample conversations, and adding a new action to the composer.

### Check and build

Run these from your chosen app's folder:

**Superhuman**

```sh
npm test
npm run build
npm run preview
```

**Gmail**

```sh
bun test
bun run build
bun run preview
```

The build produces a `dist/` folder. `preview` lets you inspect that production build locally.
