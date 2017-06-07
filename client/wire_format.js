var request = require('request');
var bitcoin = require('bitcoinjs-lib');

var hash128 = function(buff){
    var ret = Buffer.from(bitcoin.crypto.sha256(buff).slice(0, 16));
    console.log(ret);
    return ret;
}

var get_latest = function(fqa, cb){
    request("https://core.blockstack.org/v1/names/" + fqa,
	    function (err, resp, body){
		if (!err && resp.statusCode == 200) {
		    cb(JSON.parse(body));
		}
	    });
}

var make_transfer = function(fqa, consensusHash, newOwner, keyOwner, 
			     keepZonefile, cb){
    // Returns a transfer tx skeleton.
    // this is an unsigned serialized transaction.
    const op_ret = Buffer.alloc(36);
    op_ret.write('id>', 0, 3, 'ascii');
    if(keepZonefile){
	keepChar = '>';
    }else{
	keepChar = '~';
    }
    op_ret.write(keepChar, 3, 1, 'ascii');
    var hashed = hash128(Buffer.from(fqa, 'ascii'));
    hashed.copy(op_ret, 4)
    op_ret.write(consensusHash, 20, 16, 'hex');

    var op_ret_payload = bitcoin.script.nullData.output.encode(op_ret);

    var tx = new bitcoin.TransactionBuilder()

    tx.addOutput(op_ret_payload, 0);
    tx.addOutput(newOwner, 5500);
    get_latest(fqa, function(latest_info){
	owner_txid = latest_info.last_txid;
	owner_addr = latest_info.address;
	tx.addInput(owner_txid, 5500);
	tx.addOutput(owner_addr, 5500);
	tx.sign(0, keyOwner, undefined, bitcoin.Transaction.SIGHASH_ANYONECANPAY |
		bitcoin.Transaction.SIGHASH_ALL)
	cb(tx.buildIncomplete());
    });
}

keyOwner = bitcoin.ECPair.makeRandom();

make_transfer("ablankstein.id", "5965d05dd8254156662a674c28b8696c",
	      "34bNQUVgyhSrA8XpM4HkerHUUdNmLpiyj7", keyOwner, false,
	      function (unsigned_tx) {
		  console.log(unsigned_tx.toHex());
	      })
	      

// Inputs:
// 
//   Owner scriptSig
//   Payment scriptSig's

// Outputs:

//    OP_RETURN payload
//    new name owner's scriptPubkey
//    old name owner's scriptPubkey
//    payment scriptPubkey change

/// in core:
///    -> make unsigned transfer tx -> "transfer_tx" :: returns without subsidy outputs
///    -> make subsidizable tx -> "tx_make_subsidizable" :: 
///    -> do tx                -> "do_blockchain_tx"
