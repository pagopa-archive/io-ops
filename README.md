io-ops
======

IO operations tool

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/io-ops.svg)](https://npmjs.org/package/io-ops)
[![CircleCI](https://circleci.com/gh/teamdigitale/io-ops/tree/master.svg?style=shield)](https://circleci.com/gh/teamdigitale/io-ops/tree/master)
[![Codecov](https://codecov.io/gh/teamdigitale/io-ops/branch/master/graph/badge.svg)](https://codecov.io/gh/teamdigitale/io-ops)
[![Downloads/week](https://img.shields.io/npm/dw/io-ops.svg)](https://npmjs.org/package/io-ops)
[![License](https://img.shields.io/npm/l/io-ops.svg)](https://github.com/teamdigitale/io-ops/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g io-ops
$ io-ops COMMAND
running command...
$ io-ops (-v|--version|version)
io-ops/0.0.1 darwin-x64 node-v10.13.0
$ io-ops --help [COMMAND]
USAGE
  $ io-ops COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`io-ops hello [FILE]`](#io-ops-hello-file)
* [`io-ops help [COMMAND]`](#io-ops-help-command)

## `io-ops hello [FILE]`

describe the command here

```
USAGE
  $ io-ops hello [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print

EXAMPLE
  $ io-ops hello
  hello world from ./src/hello.ts!
```

_See code: [src/commands/hello.ts](https://github.com/teamdigitale/io-ops/blob/v0.0.1/src/commands/hello.ts)_

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.1.6/src/commands/help.ts)_
<!-- commandsstop -->
