from blockstack_client.config import get_utxo_provider_client, APPROX_TX_IN_P2SH_LEN
from blockstack_client.operations import fees_transfer
from blockstack_client.scripts import tx_make_subsidizable
from blockstack_client.backend.nameops import estimate_payment_bytes
from blockstack_client.backend.blockchain import get_tx_fee
from blockstack_client.backend.registrar import get_wallet_payment_privkey_info
from blockstack_client.tx import deserialize_tx
from blockstack_client.proxy import get_default_proxy
from blockstack_client.rpc import local_api_status
from blockstack_client.actions import get_wallet_with_backoff

import sys

config_path = "/home/aaron/.blockstack/client.ini"

def subsidize_tx(serialized_tx):
    if not local_api_status(config_dir="/home/aaron/.blockstack/"):
        raise Exception("Start api server")
#    proxy = get_default_proxy(config_path)

    wallet = get_wallet_with_backoff(config_path)

    payment_address = str(wallet["payment_address"])
    payment_privkey_info = wallet["payment_privkey"]

    utxo_client = get_utxo_provider_client(config_path=config_path)
    
    # estimating tx_fee...
    ## will need to pad to estimated length of payment input and output
    ##   plus owner signature.

    num_extra_bytes = estimate_payment_bytes( payment_address, utxo_client, config_path=config_path )

    approxed_tx = serialized_tx + '00' * num_extra_bytes

    tx_fee = get_tx_fee(approxed_tx, config_path = config_path)

    print tx_fee

    subsidized_tx = tx_make_subsidizable(serialized_tx,
                                         fees_transfer,
                                         500000,
                                         payment_privkey_info,
                                         utxo_client,
                                         tx_fee=tx_fee)
    
    return subsidized_tx

if __name__ == "__main__":
    hex_in = sys.argv[1]
    subsidized = subsidize_tx(hex_in)
    print subsidized
    print deserialize_tx(subsidized)

    
