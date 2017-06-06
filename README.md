# Blockstack Transfer Service

This will provide a web interface for transfering names over from an old format wallet to a new format key. The user will enter their private key to web app (crypto will occur on the client browser, so that the SK never needs to leave the local machine), which will then:

1. find any names owned by that key
2. generate `transfer` operations for those names
3. if necessary (as in the case of cli-transfers), generate `update` operations
4. pass the operations to a subsidizer service which will subsidize and broadcast the operations

## Uploading a key

For the CLI, a user should just paste the output of `blockstack wallet`

For older versions of portal, the user should just enter the mnemonic (note: will we be able to tell the difference between the old mnemonics and the new ones?)

## Finding names owned by a key

For the CLI, this is relatively straight-forward, as there is only 1 owner address per wallet.

For importing from older version of portal, the service will need to generate the owner keys and then search for names owned by each of those. 

(Aaron: I think for the versions of browser older than commit 2038088458012dcff251027ea23a22afce443f3b, all the names are owned by `privateKeychain.privatelyNamedChild('blockstack-0')` but someone can correct me if I'm misreading that code.)

## Client Side Operation Generation

The client will need to construct `transfer` and `update` operations. Because the client will be local JS, this will require implementing the Blockstack wire protocol in JS. Shouldn't be too hard.

The wire protocol: https://github.com/blockstack/blockstack-core/wiki/Transaction-Formats

The `update` operation will have to be signed by the new key.

## Subsidizer and Broadcaster

We'll need a hot wallet that signs the uploaded operations and then broadcasts them. We want some kind of spam protection-- but this *should* be easy given that we only want to process operations that are valid (which requires the owner's signature).
