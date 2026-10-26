# Local Development
The Panel front-end is built with React 18, TypeScript and Tailwind CSS, bundled by [Vite](https://vite.dev/).
Release versions include pre-compiled, minified, and hashed assets ready-to-go.

If you want to run custom themes or modify the React files you'll need to build the assets yourself. You'll need at
minimum:

* [Node.js](https://nodejs.org/en/) v22.x
* [Yarn](https://classic.yarnpkg.com/lang/en/) v1.x

### Install Dependencies
```bash
yarn install
```

### Development Server (Hot Module Reloading)
```bash
yarn dev
```

This starts the Vite development server and writes a `public/hot` file which tells Laravel to load assets from it, so
changes to the React files show up instantly without reloading the page. Stop the server (and delete `public/hot` if
it was left behind) to go back to the built assets.

If the panel is accessed from another machine, make sure the Vite server is reachable from that machine (it listens on
`0.0.0.0:5173` by default).

### Checks
```bash
yarn tsc     # Type checking
yarn lint    # ESLint + Prettier
yarn test    # Unit tests (Vitest)
```

### Building for Production
```bash
yarn build
```

This generates the production bundle in `public/build/`, together with a `manifest.json` used by Laravel's `@vite`
directive. Until this has been run at least once (or the dev server is running) the Panel will fail to render with a
missing Vite manifest error.

### Running Wings
To run `wings` in development all you need to do is set up the configuration file as normal when adding a new node, and
then you can build and run a local version of Wings by executing `make debug` in the Wings code directory. This must
be run on a Linux VM of some sort, you cannot run this locally on macOS or Windows.
