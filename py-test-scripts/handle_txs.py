from blockstack_client.config import get_utxo_provider_client, APPROX_TX_IN_P2SH_LEN, get_tx_broadcaster
from blockstack_client.operations import fees_transfer
from blockstack_client.scripts import tx_make_subsidizable
from blockstack_client.backend.nameops import estimate_payment_bytes
from blockstack_client.backend.blockchain import get_tx_fee, broadcast_tx
from blockstack_client.backend.registrar import get_wallet_payment_privkey_info
from blockstack_client.tx import deserialize_tx
from blockstack_client.proxy import get_default_proxy
from blockstack_client.rpc import local_api_status
from blockstack_client.actions import get_wallet_with_backoff

import sys, os, json

config_path = os.environ.get("BLOCKSTACK_CLIENT_CONFIG")

def get_wallet():
    w = {
	      "data_privkey": "f4c3907cb5769c28ff603c145db7fc39d7d26f69f726f8a7f995a40d3897bb5201", 
	      "data_pubkey": "046a6582a6566aa4059b7361536e7e4ac3df4d77bf6e843c4c8207eaa12e0ca19e15fc59c959b4a5d6d1de975ab059d9255a795dd57b9c78656a070ea5002efe87", 
	      "owner_address": "2N41ZaexX9Jq8DRzdJhSs3CE4DGg7K9GmXn", 
	      "owner_privkey": {
		  "address": "2N41ZaexX9Jq8DRzdJhSs3CE4DGg7K9GmXn", 
		  "private_keys": [
		      "4c3ab2a0704dfd9fdc319cff2c3629b72ebda1580316c7fddf9fad1baa323e9601", 
		      "75c9f091aa4f0b1544a59e0fce274fb1ac29d7f7e1cd020b66f941e5d260617b01", 
		      "d62af1329e541871b244c4a3c69459e8666c40b683ffdcb504aa4adc6a559a7701"
		  ], 
		  "redeem_script": "522102c2d392595125333ed1d907a236721767a32e7857fcb6783f4749c25989aa3ff321030cdce7e7142157f90bd923e33ec7008eaf42389c2e9e1ed08772a3ef189c32e521034f0e2de5356416258faf2a1f461c2f0e73c2324e8c37488900a5dd3e085fb50153ae"
	      }, 
	      "payment_address": "2NCL5euNJV9wNcKWQkTtEv7BxUdSTbaf7W1", 
	      "payment_privkey": {
		  "address": "2NCL5euNJV9wNcKWQkTtEv7BxUdSTbaf7W1", 
		  "private_keys": [
		      "6f432642c087c2d12749284d841b02421259c4e8178f25b91542c026ae6ced6d01", 
		      "65268e6267b14eb52dc1ccc500dc2624a6e37d0a98280f3275413eacb1d2915d01", 
		      "cdabc10f1ff3410082448b708c0f860a948197d55fb612cb328d7a5cc07a6c8a01"
		  ], 
		  "redeem_script": "522102d341f728783eb93e6fb5921a1ebe9d149e941de31e403cd69afa2f0f1e698e812102f21b29694df4c2188bee97103d10d017d1865fb40528f25589af9db6e0786b6521028791dc45c049107fb99e673265a38a096536aacdf78aa90710a32fff7750f9f953ae"
	      }
    }
    return w

def subsidize_tx(serialized_tx):
    wallet = get_wallet()

    payment_address = str(wallet["payment_address"])
    payment_privkey_info = wallet["payment_privkey"]

    utxo_client = get_utxo_provider_client(config_path=config_path)
    
    # estimating tx_fee...
    ## will need to pad to estimated length of payment input and output

    num_extra_bytes = estimate_payment_bytes( payment_address, utxo_client, config_path=config_path )
    approxed_tx = serialized_tx + '00' * num_extra_bytes

    tx_fee = get_tx_fee(approxed_tx, config_path = config_path)

    # make the subsidized tx
    subsidized_tx = tx_make_subsidizable(serialized_tx,
                                         fees_transfer,
                                         500000,
                                         payment_privkey_info,
                                         utxo_client,
                                         tx_fee=tx_fee)
    
    # broadcast it.
    try:
        resp = broadcast_tx(subsidized_tx, config_path = config_path,
                            tx_broadcaster = get_tx_broadcaster(config_path = config_path))
    except Exception as e:
        print('Failed to broadcast transaction: {}'.format(
            json.dumps(deserialize_tx(subsidized_tx), indent=4)))

        print('raw: \n{}'.format(subsidized_tx))
        
        return {'error': 'Failed to broadcast transaction (caught exception)'}

    if 'error' in resp:
        print('Failed to broadcast transaction: {}'.format(resp['error']))

    return resp

if __name__ == "__main__":
    hex_in = sys.argv[1]
    subsidized = subsidize_tx(hex_in)
    print subsidized

    
