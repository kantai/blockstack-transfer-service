# fire up blockstack: 
# $ BLOCKSTACK_TEST_CLIENT_RPC_PORT=6270 blockstack-test-scenario --interactive 2 blockstack_integration_tests.scenarios.rpc_register_multisig
# this file should be called after loading the *blockstack venv*
# and *with* your regtest client config + testnet settings
# $ export BLOCKSTACK_CLIENT_CONFIG=/tmp/blockstack-run-scenario.blockstack_integration_tests.scenarios.rpc_register_multisig/client/client.ini && export BLOCKSTACK_TESTNET=1

from flask import Flask

from blockstack_client.config import get_utxo_provider_client, APPROX_TX_IN_P2SH_LEN, get_tx_broadcaster
from blockstack_client.logger import get_logger
from blockstack_client.operations import fees_transfer
from blockstack_client.operations.transfer import build as transfer_build
from blockstack_client.scripts import tx_make_subsidizable
from blockstack_client.backend.nameops import estimate_payment_bytes
from blockstack_client.backend.blockchain import get_tx_fee, broadcast_tx, get_utxos, get_bitcoind_client
from blockstack_client.tx import deserialize_tx
from blockstack_client.proxy import get_default_proxy
from blockstack_client.rpc import local_api_status
from blockstack_client.actions import get_wallet_keys
from blockstack_client import get_name_blockchain_record

import sys, os, json

config_path = os.environ.get("BLOCKSTACK_CLIENT_CONFIG")

log = get_logger('blockstack-transfer-service')

def get_wallet_multisig():
    w = {
	"payment_address": "2NCL5euNJV9wNcKWQkTtEv7BxUdSTbaf7W1", 
	"payment_privkey": {
	    "address": "2NCL5euNJV9wNcKWQkTtEv7BxUdSTbaf7W1", 
	    "private_keys": [
		"6f432642c087c2d12749284d841b02421259c4e8178f25b91542c026ae6ced6d01", 
		"65268e6267b14eb52dc1ccc500dc2624a6e37d0a98280f3275413eacb1d2915d01", 
		"cdabc10f1ff3410082448b708c0f860a948197d55fb612cb328d7a5cc07a6c8a01"
	    ], 
            "redeem_script": ("522102d341f728783eb93e6fb5921a1ebe9d149e941de31e403cd" + 
                              "69afa2f0f1e698e812102f21b29694df4c2188bee97103d10d017" + 
                              "d1865fb40528f25589af9db6e0786b6521028791dc45c049107fb" + 
                              "99e673265a38a096536aacdf78aa90710a32fff7750f9f953ae")
        }
    }
    return w

def get_wallet_singlesig():
    w = {
        "payment_address": "mvF2KY1UbdopoomiB371epM99GTnzjSUfj", 
        "payment_privkey": "f4c3907cb5769c28ff603c145db7fc39d7d26f69f726f8a7f995a40d3897bb5201"
    }
    return w

def make_subsidized_tx(serialized_tx):
    wallet = get_wallet_keys(config_path=config_path, password=False)

    payment_address = str(wallet["payment_address"])
    payment_privkey_info = wallet["payment_privkey"]

    log.debug("subsidizing tx: {}".format(serialized_tx))

    utxo_client = get_utxo_provider_client(config_path=config_path)
    
    # estimating tx_fee...
    ## will need to pad to estimated length of payment input and output

    num_extra_bytes = estimate_payment_bytes( payment_address, utxo_client, config_path=config_path )
    approxed_tx = serialized_tx + '00' * num_extra_bytes

    tx_fee = get_tx_fee(approxed_tx, config_path = config_path)

    # make the subsidized tx
    try:
        subsidized_tx = tx_make_subsidizable(serialized_tx,
                                             fees_transfer,
                                             45000,
                                             payment_privkey_info,
                                             utxo_client,
                                             tx_fee=tx_fee)
    except ValueError as value_exc:
        log.error("Failed to subsidize transaction with exception: {}".format(value_exc))
        import traceback
        log.error("Stack trace: {}".format(traceback.format_exc()))
        return {"error" : "Subsidizer error"}

    return subsidized_tx

def do_broadcast(serialized_tx):
    # broadcast it.
    try:
        resp = broadcast_tx(serialized_tx, config_path = config_path,
                            tx_broadcaster = get_tx_broadcaster(config_path = config_path))
    except Exception as e:
        log.error('Caught exception broadcasting tx: {}'.format(e))
        log.error('Failed to broadcast transaction: {}'.format(
            json.dumps(deserialize_tx(serialized_tx), indent=4)))

        log.error('raw tx: \n{}'.format(serialized_tx))

        return {'error': 'Failed to broadcast transaction (caught exception)'}

    if 'error' in resp:
        log.error('Failed to broadcast transaction: {}'.format(resp['error']))

    return resp

app = Flask(__name__)

OBTUSE_ERR = json.dumps( {"error" : "Server error at subsidizer. Sorry, try again later."} )

def test_compatible_opreturns(*args):
    first = False
    for opret in args:
        opret = opret[:6] + opret[8:40]
        log.debug("Testing: {}".format(opret))
        if first == False:
            first = opret
        else:
            if first != opret:
                return False
    return True

def verify_tx_ownership(deserialized_tx, fqa):
    # check that input #1 is owned by the name owner, 
    # and that the name hasn't been revoked.
    record = get_name_blockchain_record(fqa)
    if record.get('revoked', False):
        return False, "Name revoked"

    received_input = deserialized_tx[0][0]["outpoint"]
    actual_txid = received_input["hash"]
    actual_vout = received_input["index"]

    bitcoind = get_bitcoind_client(config_path = config_path)
    myview = bitcoind.gettxout(actual_txid, actual_vout)
    received_owner = myview["scriptPubKey"]["addresses"][0]
    real_owner = record['address']

    if received_owner != real_owner:
        log.error("Expected owner {} of {}, but received address {}".format(
            real_owner, fqa, received_owner))
        return False, 'Unexpected input txn which is not the owner of name'
    
    return True, None

def verify_transfer_valid_format(deserialized_tx, fqa):
    # check that the op-return matches the given fqa

    expected_hex_opreturn = transfer_build(fqa, True, "00000000000000000000000000000000")
    actual_hex_opreturn = deserialized_tx[1][0]["script"][4:]
    log.debug("Expected: {}".format(expected_hex_opreturn))
    log.debug("Received: {}".format(actual_hex_opreturn))

    if not test_compatible_opreturns(expected_hex_opreturn, actual_hex_opreturn):
        return False, "OP_RETURN does not match the provided name"
    return True, None

@app.route("/subsidized_tx/<rawtx>/<fqa>")
def get_subsidize_tx(rawtx, fqa):
    rawtx = str(rawtx)
    fqa = str(fqa)

    deserialized_tx = deserialize_tx(rawtx)

    is_valid, err_msg = verify_transfer_valid_format(deserialized_tx, fqa)
    if not is_valid:
        return OBTUSE_ERR, 403

    is_owner_correct, err_msg = verify_tx_ownership(deserialized_tx, fqa)
    if not is_owner_correct:
        return json.dumps({'error' : err_msg}), 403

    subsidized = make_subsidized_tx(rawtx)

    if "error" in subsidized:
        return OBTUSE_ERR, 503
    return json.dumps([subsidized]), 200

@app.route("/broadcast/<rawtx>")
def broadcast(rawtx):
    resp = do_broadcast(str(rawtx))

    if "error" in resp:
        return OBTUSE_ERR, 503
    return json.dumps(resp), 200


if __name__ == "__main__":
    app.run()
