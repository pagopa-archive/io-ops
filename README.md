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
$ io-ops (--version)
io-ops/1.0.0 darwin-x64 node-v18.13.0
$ io-ops --help [COMMAND]
USAGE
  $ io-ops COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`io-ops api-services:create`](#io-ops-api-servicescreate)
* [`io-ops api-services:get SERVICEID`](#io-ops-api-servicesget-serviceid)
* [`io-ops api-services:get-all`](#io-ops-api-servicesget-all)
* [`io-ops api-services:keys SERVICEID`](#io-ops-api-serviceskeys-serviceid)
* [`io-ops api-services:keys-regenerate SERVICEID`](#io-ops-api-serviceskeys-regenerate-serviceid)
* [`io-ops api-services:logo SERVICEID`](#io-ops-api-serviceslogo-serviceid)
* [`io-ops api-services:update`](#io-ops-api-servicesupdate)
* [`io-ops hello`](#io-ops-hello)
* [`io-ops help [COMMANDS]`](#io-ops-help-commands)
* [`io-ops messages:attributes`](#io-ops-messagesattributes)
* [`io-ops messages:check-content`](#io-ops-messagescheck-content)
* [`io-ops messages:list FISCALCODE`](#io-ops-messageslist-fiscalcode)
* [`io-ops migrate-services METADATA`](#io-ops-migrate-services-metadata)
* [`io-ops plugins`](#io-ops-plugins)
* [`io-ops plugins:install PLUGIN...`](#io-ops-pluginsinstall-plugin)
* [`io-ops plugins:inspect PLUGIN...`](#io-ops-pluginsinspect-plugin)
* [`io-ops plugins:install PLUGIN...`](#io-ops-pluginsinstall-plugin-1)
* [`io-ops plugins:link PLUGIN`](#io-ops-pluginslink-plugin)
* [`io-ops plugins:uninstall PLUGIN...`](#io-ops-pluginsuninstall-plugin)
* [`io-ops plugins:uninstall PLUGIN...`](#io-ops-pluginsuninstall-plugin-1)
* [`io-ops plugins:uninstall PLUGIN...`](#io-ops-pluginsuninstall-plugin-2)
* [`io-ops plugins:update`](#io-ops-pluginsupdate)
* [`io-ops profiles:delete FISCALCODE`](#io-ops-profilesdelete-fiscalcode)
* [`io-ops profiles:exist`](#io-ops-profilesexist)
* [`io-ops profiles:list`](#io-ops-profileslist)
* [`io-ops services:check`](#io-ops-servicescheck)
* [`io-ops services:details`](#io-ops-servicesdetails)
* [`io-ops services:list`](#io-ops-serviceslist)
* [`io-ops subscriptions:list-delete DELETEFILEPATH [DELAYONDELETE] [OWNEREMAIL]`](#io-ops-subscriptionslist-delete-deletefilepath-delayondelete-owneremail)
* [`io-ops users:create`](#io-ops-userscreate)
* [`io-ops users:get EMAIL`](#io-ops-usersget-email)
* [`io-ops users:get-all`](#io-ops-usersget-all)
* [`io-ops users:subscription EMAIL SUBSCRIPTIONID`](#io-ops-userssubscription-email-subscriptionid)
* [`io-ops users:update-groups EMAIL`](#io-ops-usersupdate-groups-email)
* [`io-ops users:update_user_token_name EMAIL TOKENNAMEVALUE`](#io-ops-usersupdate_user_token_name-email-tokennamevalue)
* [`io-ops users:write-messages EMAIL ACTION`](#io-ops-userswrite-messages-email-action)
* [`io-ops users:write-services EMAIL ACTION`](#io-ops-userswrite-services-email-action)

## `io-ops api-services:create`

Create a service

```
USAGE
  $ io-ops api-services:create --payload <value>

FLAGS
  --payload=<value>  (required) JSON string rapresentation of a service

DESCRIPTION
  Create a service

EXAMPLES
  $ io-ops api-service:create  --json='{ "authorized_cidrs": [], "authorized_recipients": [], "department_name": "department_test", "organization_fiscal_code": "12345670013", "organization_name": "organization_name", "service_id": "test-api-123", "service_name": "test_name", "is_visible": false, "max_allowed_payment_amount": 0, "require_secure_channels": false }'
```

_See code: [src/commands/api-services/create.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/api-services/create.ts)_

## `io-ops api-services:get SERVICEID`

Get the service by serviceId

```
USAGE
  $ io-ops api-services:get SERVICEID

ARGUMENTS
  SERVICEID  id of the service

DESCRIPTION
  Get the service by serviceId

EXAMPLES
  $ io-ops api-service:get  SERVICEID
```

_See code: [src/commands/api-services/get.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/api-services/get.ts)_

## `io-ops api-services:get-all`

Get all services

```
USAGE
  $ io-ops api-services:get-all

DESCRIPTION
  Get all services

EXAMPLES
  $ io-ops api-service:get-all
```

_See code: [src/commands/api-services/get-all.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/api-services/get-all.ts)_

## `io-ops api-services:keys SERVICEID`

Get subscription keys associated to service

```
USAGE
  $ io-ops api-services:keys SERVICEID

ARGUMENTS
  SERVICEID  id of the service

DESCRIPTION
  Get subscription keys associated to service

EXAMPLES
  $ io-ops api-service:keys SERVICEID
```

_See code: [src/commands/api-services/keys.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/api-services/keys.ts)_

## `io-ops api-services:keys-regenerate SERVICEID`

Regenerate keys associated to service

```
USAGE
  $ io-ops api-services:keys-regenerate SERVICEID --key_type PRIMARY_KEY|SECONDARY_KEY

ARGUMENTS
  SERVICEID  id of the service

FLAGS
  --key_type=<option>  (required) JSON string rapresentation of a service
                       <options: PRIMARY_KEY|SECONDARY_KEY>

DESCRIPTION
  Regenerate keys associated to service

EXAMPLES
  $ io-ops api-service:keys-regenerate  SERVICEID --key_type=PRIMARY_KEY
```

_See code: [src/commands/api-services/keys-regenerate.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/api-services/keys-regenerate.ts)_

## `io-ops api-services:logo SERVICEID`

Update service data with base64 of the logo

```
USAGE
  $ io-ops api-services:logo SERVICEID --logo <value>

ARGUMENTS
  SERVICEID  id of the service

FLAGS
  --logo=<value>  (required) Path of logo image to be uploaded

DESCRIPTION
  Update service data with base64 of the logo

EXAMPLES
  $ io-ops api-service:logo SERVICEID --logo ~/PATH/logo.png
```

_See code: [src/commands/api-services/logo.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/api-services/logo.ts)_

## `io-ops api-services:update`

Update a service

```
USAGE
  $ io-ops api-services:update --payload <value>

FLAGS
  --payload=<value>  (required) JSON string rapresentation of a service

DESCRIPTION
  Update a service

EXAMPLES
  $ io-ops api-service:update  --json='{ "authorized_cidrs": [], "authorized_recipients": [], "department_name": "department_test", "organization_fiscal_code": "12345670013", "organization_name": "organization_name", "service_id": "test-api-123", "service_name": "test_name", "is_visible": false, "max_allowed_payment_amount": 0, "require_secure_channels": false }'
```

_See code: [src/commands/api-services/update.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/api-services/update.ts)_

## `io-ops hello`

describe the command here

```
USAGE
  $ io-ops hello [-h] [-n <value>] [-f]

FLAGS
  -f, --force
  -h, --help          Show CLI help.
  -n, --name=<value>  name to print

DESCRIPTION
  describe the command here

EXAMPLES
  $ io-ops hello
  hello world from ./src/hello.ts!
```

_See code: [src/commands/hello.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/hello.ts)_

## `io-ops help [COMMANDS]`

Display help for io-ops.

```
USAGE
  $ io-ops help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for io-ops.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.2.10/src/commands/help.ts)_

## `io-ops messages:attributes`

Update message attributes

```
USAGE
  $ io-ops messages:attributes -i <value> [-p <value>] [--isPending true|false|undefined]

FLAGS
  -i, --input=<value>     (required) Input file (CSV, with path as first column)
  -p, --parallel=<value>  [default: 1] Number of parallel workers to run
  --isPending=<option>    Set 'isPending' flag
                          <options: true|false|undefined>

DESCRIPTION
  Update message attributes
```

_See code: [src/commands/messages/attributes.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/messages/attributes.ts)_

## `io-ops messages:check-content`

Checks validity of messages

```
USAGE
  $ io-ops messages:check-content [-i <value>] [-p <value>]

FLAGS
  -i, --input=<value>     Input file (CSV, with path as first column) - defaults to stdin
  -p, --parallel=<value>  [default: 1] Number of parallel workers to run

DESCRIPTION
  Checks validity of messages
```

_See code: [src/commands/messages/check-content.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/messages/check-content.ts)_

## `io-ops messages:list FISCALCODE`

List messages for a fiscalCode

```
USAGE
  $ io-ops messages:list FISCALCODE

DESCRIPTION
  List messages for a fiscalCode
```

_See code: [src/commands/messages/list.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/messages/list.ts)_

## `io-ops migrate-services METADATA`

Migrate metadata or logos from github

```
USAGE
  $ io-ops migrate-services METADATA

ARGUMENTS
  METADATA  (metadata|logo) Migrate metadata or logo from github

DESCRIPTION
  Migrate metadata or logos from github

EXAMPLES
  $ io-ops migrate metadata

  $ io-ops migrate logo
```

_See code: [src/commands/migrate-services.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/migrate-services.ts)_

## `io-ops plugins`

List installed plugins.

```
USAGE
  $ io-ops plugins [--core]

FLAGS
  --core  Show core plugins.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ io-ops plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.4.7/src/commands/plugins/index.ts)_

## `io-ops plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ io-ops plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ io-ops plugins:add

EXAMPLES
  $ io-ops plugins:install myplugin 

  $ io-ops plugins:install https://github.com/someuser/someplugin

  $ io-ops plugins:install someuser/someplugin
```

## `io-ops plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ io-ops plugins:inspect PLUGIN...

ARGUMENTS
  PLUGIN  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ io-ops plugins:inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.4.7/src/commands/plugins/inspect.ts)_

## `io-ops plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ io-ops plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ io-ops plugins:add

EXAMPLES
  $ io-ops plugins:install myplugin 

  $ io-ops plugins:install https://github.com/someuser/someplugin

  $ io-ops plugins:install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.4.7/src/commands/plugins/install.ts)_

## `io-ops plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ io-ops plugins:link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Links a plugin into the CLI for development.
  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ io-ops plugins:link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.4.7/src/commands/plugins/link.ts)_

## `io-ops plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ io-ops plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ io-ops plugins:unlink
  $ io-ops plugins:remove
```

## `io-ops plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ io-ops plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ io-ops plugins:unlink
  $ io-ops plugins:remove
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.4.7/src/commands/plugins/uninstall.ts)_

## `io-ops plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ io-ops plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ io-ops plugins:unlink
  $ io-ops plugins:remove
```

## `io-ops plugins:update`

Update installed plugins.

```
USAGE
  $ io-ops plugins:update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.4.7/src/commands/plugins/update.ts)_

## `io-ops profiles:delete FISCALCODE`

Delete a profile

```
USAGE
  $ io-ops profiles:delete FISCALCODE [-a] [-p] [-m] [-n] [-s]

FLAGS
  -a, --all           delete items in all containers
  -m, --message       delete items in message container
  -n, --notification  delete items in notification container
  -p, --profile       delete items in profile container
  -s, --service       delete items in service container

DESCRIPTION
  Delete a profile
```

_See code: [src/commands/profiles/delete.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/profiles/delete.ts)_

## `io-ops profiles:exist`

Returns the input CSV with a new column that is true if a profile for that fiscal code exists.

```
USAGE
  $ io-ops profiles:exist [-i <value>] [-p <value>]

FLAGS
  -i, --input=<value>     Input file (CSV, with the CF as first column) - defaults to stdin
  -p, --parallel=<value>  [default: 1] Number of parallel workers to run

DESCRIPTION
  Returns the input CSV with a new column that is true if a profile for that fiscal code exists.
```

_See code: [src/commands/profiles/exist.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/profiles/exist.ts)_

## `io-ops profiles:list`

Lists all profiles

```
USAGE
  $ io-ops profiles:list

DESCRIPTION
  Lists all profiles
```

_See code: [src/commands/profiles/list.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/profiles/list.ts)_

## `io-ops services:check`

```
USAGE
  $ io-ops services:check
```

_See code: [src/commands/services/check.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/services/check.ts)_

## `io-ops services:details`

Retrieve service info and metadata from a given service ID

```
USAGE
  $ io-ops services:details [-i <value>]

FLAGS
  -i, --serviceId=<value>  The service ID

DESCRIPTION
  Retrieve service info and metadata from a given service ID
```

_See code: [src/commands/services/details.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/services/details.ts)_

## `io-ops services:list`

List all services in csv format

```
USAGE
  $ io-ops services:list

DESCRIPTION
  List all services in csv format
```

_See code: [src/commands/services/list.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/services/list.ts)_

## `io-ops subscriptions:list-delete DELETEFILEPATH [DELAYONDELETE] [OWNEREMAIL]`

Migrate metadata or logos from github

```
USAGE
  $ io-ops subscriptions:list-delete DELETEFILEPATH [DELAYONDELETE] [OWNEREMAIL]

ARGUMENTS
  DELETEFILEPATH  CSV Input file containing subscription list
  DELAYONDELETE   [default: 500] The delay between delete's operations
  OWNEREMAIL      Email of the subscriptions owner

DESCRIPTION
  Migrate metadata or logos from github

EXAMPLES
  $ io-ops subscriptions:list-delete -inputListPath=/tmp/input.csv
```

_See code: [src/commands/subscriptions/list-delete.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/subscriptions/list-delete.ts)_

## `io-ops users:create`

Create a new user with a random password in the Active Directory Azure B2C, then create a corresponding user on the API management resource.

```
USAGE
  $ io-ops users:create --payload <value>

FLAGS
  --payload=<value>  (required) JSON string rapresentation of a user

DESCRIPTION
  Create a new user with a random password in the Active Directory Azure B2C, then create a corresponding user on the
  API management resource.

EXAMPLES
  $ io-ops api-service:create  --json='{ "email": "foobar@example.com","first_name": "string","last_name": "string"}'
```

_See code: [src/commands/users/create.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/users/create.ts)_

## `io-ops users:get EMAIL`

Gets the user information, that is the complete list of subscription and the complete list of groups for the User identified by the provided email

```
USAGE
  $ io-ops users:get EMAIL

ARGUMENTS
  EMAIL  email

DESCRIPTION
  Gets the user information, that is the complete list of subscription and the complete list of groups for the User
  identified by the provided email

EXAMPLES
  $ io-ops users:get example@example.it
```

_See code: [src/commands/users/get.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/users/get.ts)_

## `io-ops users:get-all`

Get users max 100 per call use cursor for iterating

```
USAGE
  $ io-ops users:get-all [--cursor <value>]

FLAGS
  --cursor=<value>  Items to skip

DESCRIPTION
  Get users max 100 per call use cursor for iterating

EXAMPLES
  $ io-ops users:get-all

  $ io-ops users:get-all --cursor=100
```

_See code: [src/commands/users/get-all.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/users/get-all.ts)_

## `io-ops users:subscription EMAIL SUBSCRIPTIONID`

Create a Subscription identified by the provided subscription id for the User identified by the provided email

```
USAGE
  $ io-ops users:subscription EMAIL SUBSCRIPTIONID --product_name <value>

ARGUMENTS
  EMAIL           email
  SUBSCRIPTIONID  The id of the Subscription

FLAGS
  --product_name=<value>  (required) The name of the product

DESCRIPTION
  Create a Subscription identified by the provided subscription id for the User identified by the provided email

EXAMPLES
  $ io-ops users:subscription  example@example.com SUBSCRIPTIONID --product_name=PRODUCTNAME
```

_See code: [src/commands/users/subscription.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/users/subscription.ts)_

## `io-ops users:update-groups EMAIL`

Update the list of groups (permissions) associated to the User identified by the provided email

```
USAGE
  $ io-ops users:update-groups EMAIL --groups <value>

ARGUMENTS
  EMAIL  email

FLAGS
  --groups=<value>  (required) A comma separeted list of groups

DESCRIPTION
  Update the list of groups (permissions) associated to the User identified by the provided email

EXAMPLES
  $ io-ops users:update-groups  --groups=ApiInfoRead,ApiLimitedMessageWrite,ApiMessageRead
```

_See code: [src/commands/users/update-groups.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/users/update-groups.ts)_

## `io-ops users:update_user_token_name EMAIL TOKENNAMEVALUE`

Update the Token Name attribute associated to the User identified by the provided email

```
USAGE
  $ io-ops users:update_user_token_name EMAIL TOKENNAMEVALUE

ARGUMENTS
  EMAIL           email
  TOKENNAMEVALUE  tokenNameValue

DESCRIPTION
  Update the Token Name attribute associated to the User identified by the provided email

EXAMPLES
  $ io-ops users:update-token-name
```

_See code: [src/commands/users/update_user_token_name.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/users/update_user_token_name.ts)_

## `io-ops users:write-messages EMAIL ACTION`

Update the list of groups (permissions) associated to the User identified by the provided email

```
USAGE
  $ io-ops users:write-messages EMAIL ACTION

ARGUMENTS
  EMAIL   email
  ACTION  action

DESCRIPTION
  Update the list of groups (permissions) associated to the User identified by the provided email

EXAMPLES
  $ io-ops users:write-messages example@example.it enable
```

_See code: [src/commands/users/write-messages.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/users/write-messages.ts)_

## `io-ops users:write-services EMAIL ACTION`

Update the list of groups (permissions) associated to the User identified by the provided email

```
USAGE
  $ io-ops users:write-services EMAIL ACTION

ARGUMENTS
  EMAIL   email
  ACTION  action

DESCRIPTION
  Update the list of groups (permissions) associated to the User identified by the provided email

EXAMPLES
  $ io-ops users:write-services example@example.it enable
```

_See code: [src/commands/users/write-services.ts](https://github.com/pagopa/io-ops/blob/v1.0.0/src/commands/users/write-services.ts)_
<!-- commandsstop -->

```

```
