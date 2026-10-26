# Contributing

Raptor Panel is a community project and contributions are welcome, whether it's a bug fix, a new feature or an
improvement to the documentation.

Before starting on a larger change, please open an issue or a discussion first so that the approach can be agreed on.

## Development

See [BUILDING.md](./BUILDING.md) for setting up the front-end tooling. Before opening a pull request, make sure the
following pass:

```bash
yarn tsc && yarn lint && yarn test
vendor/bin/phpunit
```

## Upstream

Raptor Panel is based on [Pterodactyl](https://github.com/pterodactyl/panel). Issues that also affect the upstream
project, in particular security issues, should be reported to Pterodactyl as well.
