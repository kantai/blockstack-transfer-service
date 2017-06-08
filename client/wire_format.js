var request = require('request');
var bitcoin = require('bitcoinjs-lib');
var wif = require('wif');

var coreNode = "https://core.blockstack.org";
var subsidizer = "http://localhost:5000";
var bitcoind = "http://blockstack:blockstacksystem@127.0.0.1:18332"
var network = bitcoin.networks.bitcoin;

var hash128 = function(buff){
    var ret = Buffer.from(bitcoin.crypto.sha256(buff).slice(0, 16));
    return ret;
}

var hex_to_wif = function(hexStr){
    b = Buffer.from(hexStr, "hex");
    return wif.encode(network.wif, b, true);
}

var core_wallet_key_signer = function(wallet){
    var keySigner = function(unsigned_tx, sigWhat){
	ownerPrivKey = wallet.owner_privkey
	wif1 = hex_to_wif(ownerPrivKey.private_keys[0])
	wif2 = hex_to_wif(ownerPrivKey.private_keys[1])
	kp1 = bitcoin.ECPair.fromWIF(wif1, network)
	kp2 = bitcoin.ECPair.fromWIF(wif2, network)
	redeemScript = Buffer.from(ownerPrivKey.redeem_script, "hex");

	unsigned_tx.sign(0, kp1, redeemScript,
			 sigWhat);
	unsigned_tx.sign(0, kp2, redeemScript,
			 sigWhat);
    }
    return keySigner;
}

var calculate_change_amount = function(input_tx, cb){
    putbody = '{"jsonrpc": "1.0", "method": "gettxout", "params": ["' + 
	input_tx
	+'", 1] }';
    request.post({url: bitcoind,
		  body : putbody},
		 function (err, resp, body){
		     if (!err && resp.statusCode == 200) {
			 value = JSON.parse(body).result.value;
			 satoshis = parseInt(1e8 * value);
			 cb(satoshis);
		     }
		 })
}

var get_latest = function(fqa, cb){
    request(coreNode + "/v1/names/" + fqa, function (err, resp, body){
	if (!err && resp.statusCode == 200) {
	    latest = JSON.parse(body);
	    last_txid = latest.last_txid
	    calculate_change_amount(last_txid, function(lasttxid_vout){
		latest.vout = lasttxid_vout;
		cb(latest);
	    })
	}
    });
}

var get_consensus = function(cb){
    request(coreNode + "/v1/blockchains/bitcoin/consensus",
	    function (err, resp, body){
		if (!err && resp.statusCode == 200) {
		    cb(JSON.parse(body).consensus_hash);
		}
	    });
}

var make_transfer = function(fqa, consensusHash, newOwner,
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

    var tx = new bitcoin.TransactionBuilder(network)

    tx.addOutput(op_ret_payload, 0);
    tx.addOutput(newOwner, 5500);
    get_latest(fqa, function(latest_info){
	owner_txid = latest_info.last_txid;
	owner_addr = latest_info.address;
	tx.addInput(owner_txid, 1);
	tx.addOutput(owner_addr, latest_info.vout);
	cb(tx.buildIncomplete());
    });
}

var sign_rawtx = function(rawtx, keySigner){
    var tx_in = bitcoin.Transaction.fromHex(rawtx);
    var txb = bitcoin.TransactionBuilder.fromTransaction(tx_in, network);
    txb.inputs[0].prevOutType = undefined;
    keySigner(txb, bitcoin.Transaction.SIGHASH_ANYONECANPAY | bitcoin.Transaction.SIGHASH_ALL);
    return txb.build();
}

var get_subsidy = function(rawtx, cb){
    request(subsidizer + "/subsidized_tx/" + rawtx,
	    function (err, resp, body){
		if (!err && resp.statusCode == 200) {
		    cb(JSON.parse(body)[0]);
		}
	    });
}

var broadcast = function(rawtx, cb){
    request(subsidizer + "/broadcast/" + rawtx,
	    function (err, resp, body){
		if (!err && resp.statusCode == 200) {
		    cb(JSON.parse(body));
		}
	    });
}

var generate_regtest_tx = function(){
    var fs = require('fs');
    test_data = JSON.parse(fs.readFileSync('client/test_data.json', 'utf8'));
    regtest_data = test_data.core_regtest_info;
    keySigner = core_wallet_key_signer(regtest_data.wallet);

    get_consensus(function(consensusHash){
	console.log("consensusHash: " + consensusHash)
	make_transfer(regtest_data.fqa, consensusHash,
		      regtest_data.newOwner, false,
		      function(tx){
			  console.log("unsigned : " + tx.toHex());
			  get_subsidy(tx.toHex(), function(tx){
			      console.log("subsidized : " + tx);
			      signed_tx = sign_rawtx(tx, keySigner)
			      console.log("signed : " + signed_tx.toHex());
			      broadcast(signed_tx.toHex(), console.log);
			  });
		      });
    });
}

//keyOwner = bitcoin.ECPair.makeRandom();

coreNode = "http://localhost:6270";
network = bitcoin.networks.testnet;

generate_regtest_tx();
