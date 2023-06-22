# io-ops

IO operations tool

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/io-ops.svg)](https://npmjs.org/package/io-ops)
[![CircleCI](https://circleci.com/gh/pagopa/io-ops/tree/master.svg?style=shield)](https://circleci.com/gh/teamdigitale/io-ops/tree/master)
[![Codecov](https://codecov.io/gh/pagopa/io-ops/branch/master/graph/badge.svg)](https://codecov.io/gh/teamdigitale/io-ops)
[![Downloads/week](https://img.shields.io/npm/dw/io-ops.svg)](https://npmjs.org/package/io-ops)
[![License](https://img.shields.io/npm/l/io-ops.svg)](https://github.com/pagopa/io-ops/blob/master/package.json)

<!-- toc -->
* [io-ops](#io-ops)
* [Requirements](#requirements)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Requirements

### Environment variables
The following sets of commands require the environment variabiles listed in the table below:
`api-services:*`, `users:*`, `migrate-service`.

| Variable name                     | Description                                                                       | type   |
|-----------------------------------|-----------------------------------------------------------------------------------|--------|
| BASE_URL_ADMIN                    | The URL of the admin functions API                                                | string |
| OCP_APIM                          | The key used to authenticate to the admin functions API                           | string |

# Usage

<!-- usage -->
```sh-session
$ npm install -g io-ops
$ io-ops COMMAND
running command...
$ io-ops (-v|--version|version)
io-ops/0.2.0 darwin-x64 node-v18.13.0
$ io-ops --help [COMMAND]
USAGE
  $ io-ops COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`io-ops help [COMMAND]`](#io-ops-help-command)

## `io-ops help [COMMAND]`

display help for io-ops

```
USAGE
  $ io-ops help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.18/src/commands/help.ts)_
<!-- commandsstop -->

```

```
