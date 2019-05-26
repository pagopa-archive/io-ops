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
io-ops/0.0.2 darwin-x64 node-v10.13.0
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
* [`io-ops messages:attributes`](#io-ops-messagesattributes)
* [`io-ops messages:check-content`](#io-ops-messagescheck-content)
* [`io-ops messages:list FISCALCODE`](#io-ops-messageslist-fiscalcode)
* [`io-ops profiles:list`](#io-ops-profileslist)

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

_See code: [src/commands/hello.ts](https://github.com/teamdigitale/io-ops/blob/v0.0.2/src/commands/hello.ts)_

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

## `io-ops messages:attributes`

Update message attributes

```
USAGE
  $ io-ops messages:attributes

OPTIONS
  -i, --input=input                   (required) Input file (CSV, with path as first column)
  -p, --parallel=parallel             [default: 1] Number of parallel workers to run
  --isPending=(true|false|undefined)  Set 'isPending' flag
```

_See code: [src/commands/messages/attributes.ts](https://github.com/teamdigitale/io-ops/blob/v0.0.2/src/commands/messages/attributes.ts)_

## `io-ops messages:check-content`

Checks validity of messages

```
USAGE
  $ io-ops messages:check-content

OPTIONS
  -i, --input=input        Input file (CSV, with path as first column) - defaults to stdin
  -p, --parallel=parallel  [default: 1] Number of parallel workers to run
```

_See code: [src/commands/messages/check-content.ts](https://github.com/teamdigitale/io-ops/blob/v0.0.2/src/commands/messages/check-content.ts)_

## `io-ops messages:list FISCALCODE`

List messages for a fiscalCode

```
USAGE
  $ io-ops messages:list FISCALCODE

OPTIONS
  -x, --extended     show extra columns
  --columns=columns  only show provided columns (comma-separated)
  --csv              output is csv format
  --filter=filter    filter property by partial string matching, ex: name=foo
  --no-header        hide table header from output
  --no-truncate      do not truncate output to fit screen
  --sort=sort        property to sort by (prepend '-' for descending)
```

_See code: [src/commands/messages/list.ts](https://github.com/teamdigitale/io-ops/blob/v0.0.2/src/commands/messages/list.ts)_

## `io-ops profiles:list`

Lists all profiles

```
USAGE
  $ io-ops profiles:list

OPTIONS
  -x, --extended     show extra columns
  --columns=columns  only show provided columns (comma-separated)
  --csv              output is csv format
  --filter=filter    filter property by partial string matching, ex: name=foo
  --no-header        hide table header from output
  --no-truncate      do not truncate output to fit screen
  --sort=sort        property to sort by (prepend '-' for descending)
```

_See code: [src/commands/profiles/list.ts](https://github.com/teamdigitale/io-ops/blob/v0.0.2/src/commands/profiles/list.ts)_
<!-- commandsstop -->
