# Design of the Blockstack Transfer Service

This will provide a web interface for transfering names over from an
old format wallet to a new format key. The user will enter their
private key to web app (crypto will occur on the client browser, so
that the SK never needs to leave the local machine), which will then:

1. find any names owned by that key
2. generate `transfer` operations for those names
3. if necessary (as in the case of cli-transfers), generate `update` operations
4. pass the operations to a subsidizer service which will subsidize and broadcast the operations

## Uploading a key

For the CLI, a user should just paste the output of `blockstack wallet`

For older versions of portal, the user should just enter the mnemonic
(note: will we be able to tell the difference between the old
mnemonics and the new ones?)

## Finding names owned by a key

For the CLI, this is relatively straight-forward, as there is only 1
owner address per wallet.

For importing from older version of portal, the service will need to
generate the owner keys and then search for names owned by each of
those.

(Aaron: I think for the versions of browser older than commit
2038088458012dcff251027ea23a22afce443f3b, all the names are owned by
`privateKeychain.privatelyNamedChild('blockstack-0')` but someone can
correct me if I'm misreading that code.)

## Client Side Operation Generation

The client will need to construct `transfer` and `update`
operations. Because the client will be local JS, this will require
implementing the Blockstack wire protocol in JS. Shouldn't be too
hard.

The wire protocol: https://github.com/blockstack/blockstack-core/wiki/Transaction-Formats

The `update` operation will have to be signed by the new key.

## Subsidizer and Broadcaster

We'll need a hot wallet that signs the uploaded operations and then
broadcasts them. We want some kind of spam protection-- but this
*should* be easy given that we only want to process operations that
are valid (which requires the owner's signature).

### Rotating Wallets

The subsidizer should rotate wallets so that it is able to subsidize
transfers without waiting for UTXOs. 

In addition to this, the subsidizer should perhaps keep track of which
UTXOs it has already used, but haven't been broadcasted yet.

### Tracking Names That Already Used the Service

Users shouldn't be able to continuously use and reuse the
service. Instead, the subsidizer should track which names have already
received a subsidy (and which of those have been confirmed, in case
the subsidized transaction doesn't actually get confirmed, the user
should be able to try again).

# Running Tests

## Multisig Core Wallet

First, fire up Blockstack core with integration testing:

```
$ BLOCKSTACK_TEST_CLIENT_RPC_PORT=6270 blockstack-test-scenario --interactive 2 blockstack_integration_tests.scenarios.rpc_register_multisig
```

Now, you want to wait until the registration has been fully
processed. Once that is finished, start up the transfer service
backend (and set up the blockstack environment in your shell, maybe
installing flask):

```
$ source ~/.blockstack-venv/bin/activate
$ pip install Flask
$ export BLOCKSTACK_CLIENT_CONFIG=/tmp/blockstack-run-scenario.blockstack_integration_tests.scenarios.rpc_register_multisig/client/client.ini && export BLOCKSTACK_TESTNET=1 && export BLOCKSTACK_DEBUG=1
$ python python-service/test_subsidizer.py
```

Now, fire off the `wire_format.js` test script:

```
$ node client/wire_format.js test-core-wallet
```

If successful, when you run `blockstack whois foo.test | grep address`, 
you should see the owner `mi8mUNSFC9EoGXmjPF8vKqCUSfGE2fbD4V`

## Portal Wallet

First, fire up Blockstack core with integration testing:

```
$ BLOCKSTACK_TEST_CLIENT_RPC_PORT=6270 blockstack-test-scenario --interactive 2 blockstack_integration_tests.scenarios.portal_test_env
```

Wait until registrations complete. Once they've completed (should be a
minute or two), if you want to just get the name to the tested wallet
address from the CLI, issue:

```
$ blockstack transfer foo.id mrvqHGMoYCvWFoRQyYcx1EwuVMdb7uE3YD
```

*Otherwise*, you'll need to open portal (in private mode) and do the
 registration there. You'll need to *restore* the wallet from the one
 in `test_data.json`, and change `"foo.id"` in the test data json to
 whatever name you register in portal.

Okay, now, just as above, you'll need to start the test service
(possibly installing flask if you didn't already):

```
$ source ~/.blockstack-venv/bin/activate
$ pip install Flask
$ export BLOCKSTACK_CLIENT_CONFIG=/tmp/blockstack-run-scenario.blockstack_integration_tests.scenarios.portal_test_env/client/client.ini && export BLOCKSTACK_TESTNET=1 && export BLOCKSTACK_DEBUG=1
$ python python-service/test_subsidizer.py
```

Now, fire off the `wire_format.js` test script:

```
$ node client/wire_format.js test-portal-pre09
```

If successful, when you run `blockstack whois foo.id | grep address`,
you should see the owner `mi8mUNSFC9EoGXmjPF8vKqCUSfGE2fbD4V`

## Testing Multiple Transfers

This repo includes a Blockstack Core integration test which sets up
one name associated with a core wallet and one with a portal
wallet. You can ran the test scenario like this:

```
$ source ~/.blockstack-venv/bin/activate
$ BLOCKSTACK_TEST_CLIENT_RPC_PORT=6270 blockstack-test-scenario --interactive 2 test_scenarios.core_plus_portal_wallets
```

This may fail if the `test_scenarios` directory isn't included in your
Python path.

Now, run the subsidizer:

```
$ source ~/.blockstack-venv/bin/activate
$ pip install Flask
$ export BLOCKSTACK_CLIENT_CONFIG=/tmp/blockstack-run-scenario.test_scenarios.core_plus_portal_wallets/client/client.ini && export BLOCKSTACK_TESTNET=1 && export BLOCKSTACK_DEBUG=1
$ python python-service/test_subsidizer.py
```

And try to transfer two names asynchronously:

```
$ node client/wire_format.js test-core-wallet-multi
```

The subsidizer will subsidize both transfers with the same UTXO, which
will fail on broadcast. The client will try to transfer the failed
operation a second time, and the subsidizer should have a different
UTXO to use on that attempt.
