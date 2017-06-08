var request = require('request');
var bitcoin = require('bitcoinjs-lib');
var wif = require('wif');

var coreNode = "https://core.blockstack.org";
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

var get_latest = function(fqa, cb){
    request(coreNode + "/v1/names/" + fqa,
	    function (err, resp, body){
		if (!err && resp.statusCode == 200) {
		    cb(JSON.parse(body));
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

var make_transfer = function(fqa, consensusHash, newOwner, keySigner, 
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
	console.log(owner_addr);
	tx.addInput(owner_txid, 1);
	tx.addOutput(owner_addr, 5500);
	keySigner(tx, bitcoin.Transaction.SIGHASH_ANYONECANPAY | bitcoin.Transaction.SIGHASH_SINGLE);
	cb(tx.build());
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
		      regtest_data.newOwner, keySigner, false,
		      function(tx){
			  console.log(tx);
			  console.log(tx.toHex());
		      });
    });
}

//keyOwner = bitcoin.ECPair.makeRandom();

coreNode = "http://localhost:6270";
network = bitcoin.networks.testnet;

generate_regtest_tx();
