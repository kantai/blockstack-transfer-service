//
// Blockstack-Transfer-Service
// ~~~~~
// copyright: (c) 2017 by Blockstack.org
//
// This file is part of Blockstack-Transfer-Service
//
// Blockstack-client is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Blockstack-client is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Blockstack-Transfer-Service. If not, see <http://www.gnu.org/licenses/>.


var request = require('request');
var bitcoin = require('bitcoinjs-lib');
var wif = require('wif');

var portal_wallet = require('./portal_wallet');
var core_wallet = require('./core_wallet');
var utils = require('./utils');

var coreNode = "https://core.blockstack.org";
var subsidizer = "http://localhost:5000";
var bitcoind = "http://blockstack:blockstacksystem@127.0.0.1:18332"
var network = bitcoin.networks.bitcoin;

function calculate_change_amount(input_tx, cb, err_cb){
    putbody = '{"jsonrpc": "1.0", "method": "gettxout", "params": ["' + 
	input_tx
	+'", 1] }';
    request.post({url: bitcoind,
		  body : putbody},
		 function (err, resp, body){
		     if (!err && resp.statusCode == 200) {
			 var result = JSON.parse(body).result;
			 if (!result){
			     console.log("tx " + input_tx + " has already been spent!");
			     err_cb();
			 }else{
			     var value = result.value;
			     satoshis = parseInt(1e8 * value);
			     cb(satoshis);
			 }
		     }else{
			 err_cb();
		     }
		 })
}

function getLastTxFromBlockstack(fqa, cb, err_cb){
    request(coreNode + "/v1/names/" + fqa, function (err, resp, body){
	if (!err && resp.statusCode == 200) {
	    const latest = JSON.parse(body);
	    var out = {}
	    out.txid = latest.last_txid
	    out.vout = 1
	    calculate_change_amount(out.txid, function(valueOut){
		out.value = valueOut;
		cb(out);
	    }, err_cb)
	}else{
	    err_cb();
	}
    });
}

function get_unspents(address, fqa, cb, on_err){
    const err_cb = function(){
	console.log("Error fetching txn from Blockstack, trying via bitcoind");
	get_utxos(address, cb, on_err);
    }
    getLastTxFromBlockstack(fqa, cb, err_cb);
}

function get_utxos(address, cb, on_err){
    putbody = '{"jsonrpc": "1.0", "method": "listunspent", "params": [' + 
	'1, 9999999, ["' + address + '"]]}';
    request.post({url: bitcoind, body : putbody}, function (err, resp, body){
	if (!err && resp.statusCode == 200) {
	    var result = JSON.parse(body).result;
	    if (!result){
		console.log("Error fetching utxo's " + address + ": " + body);
		on_err();
	    }else if (!result[0]){
		console.log("No UTXOs yet for " + address);
		on_err();
	    }else{
		top_utxo = result[0];
		var out = {}
		out.value = parseInt(1e8 * top_utxo.amount);
		out.txid = top_utxo.txid;
		out.vout = top_utxo.vout;
		cb(out);
	    }
	}else{
	    console.log("Error fetching utxo's " + address + ": " + err + ": " + body);
	    on_err();
	}
    })
}

function get_consensus(cb){
    request(coreNode + "/v1/blockchains/bitcoin/consensus",
	    function (err, resp, body){
		if (!err && resp.statusCode == 200) {
		    cb(JSON.parse(body).consensus_hash);
		}
	    });
}

function make_transfer(fqa, consensusHash, newOwner, keepZonefile, 
		       ownerTxId, ownerAddr, ownerVout, ownerChange){
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
    var hashed = utils.hash128(Buffer.from(fqa, 'ascii'));
    hashed.copy(op_ret, 4)
    op_ret.write(consensusHash, 20, 16, 'hex');

    var op_ret_payload = bitcoin.script.nullDataOutput(op_ret);

    var tx = new bitcoin.TransactionBuilder(network)

    tx.addOutput(op_ret_payload, 0);
    tx.addOutput(newOwner, 5500);
    tx.addOutput(ownerAddr, ownerChange);

    tx.addInput(ownerTxId, ownerVout);

    return tx.buildIncomplete();
}

function make_update(fqa, consensusHash, zonefileBuffer,
		       ownerTxId, ownerAddr, ownerVout, ownerChange){
    // Returns an update tx skeleton.
    // this is an unsigned serialized transaction.
    const op_ret = Buffer.alloc(39)
    op_ret.write('id+', 0, 3, 'ascii')

    const nameBuff = Buffer.from(fqa, 'ascii')
    const consensusBuff = Buffer.from(consensusHash, 'ascii')

    const hashedName = utils.hash128(Buffer.concat([nameBuff, consensusBuff],
					       nameBuff.length + consensusBuff.length))
    hashedName.copy(op_ret, 3)

    const hashedData = utils.hash160(zonefileBuffer)

    hashedData.copy(op_ret, 19)

    var op_ret_payload = bitcoin.script.nullDataOutput(op_ret)

    var tx = new bitcoin.TransactionBuilder(network)

    tx.addOutput(op_ret_payload, 0)
    tx.addOutput(ownerAddr, ownerChange)

    tx.addInput(ownerTxId, ownerVout)
    return tx.buildIncomplete()
}

function sign_rawtx(rawtx, keySigner){
    var tx_in = bitcoin.Transaction.fromHex(rawtx);
    var txb = bitcoin.TransactionBuilder.fromTransaction(tx_in, network);
    txb.inputs[0].prevOutType = undefined;
    keySigner(txb, bitcoin.Transaction.SIGHASH_ANYONECANPAY | bitcoin.Transaction.SIGHASH_ALL);
    return txb.build();
}

function get_subsidy(rawtx, fqa, consensusHash, cb){
    request(subsidizer + "/subsidized_tx/" + rawtx + "/" + fqa + "/" + consensusHash, 
	    function (err, resp, body){
		if (!err && resp.statusCode == 200) {
		    cb(JSON.parse(body)[0]);
		}else{
		    console.log(resp.statusCode + " Error: " + body);
		}
	    });
}

function get_owned_names(address, cb){
    request(coreNode + "/v1/addresses/bitcoin/" + address,
	    function (err, resp, body){
		if (!err && resp.statusCode == 200) {
		    cb(JSON.parse(body).names);
		}
	    });
}

function broadcast(rawtx, cb, err_cb){
    request(subsidizer + "/broadcast/" + rawtx, function (err, resp, body){
	if (!err && resp.statusCode == 200) {
	    cb(JSON.parse(body));
	}else{
	    err_cb(body);
	}
    });
}

function do_transfer(fqa, ownerAddress, newOwner, keySigner, keepZonefile, cb, maxIters){
    if (maxIters === undefined){
	maxIters = 10;
    }else if (maxIters <= 0){
	console.log("Too many attempts.");
	return;
    }

    const err_cb = function(){
	if (maxIters > 1){
	    console.log("Failed first attempt to transfer " + fqa +", will try " + (maxIters-1) + " more times.")
	}
	do_transfer(fqa, ownerAddress, newOwner, keySigner, keepZonefile, cb, maxIters - 1);
    }

    get_consensus(function(consensusHash){
	console.log("consensusHash: " + consensusHash)
	get_unspents(ownerAddress, fqa, function(info){
	    const tx = make_transfer(fqa, consensusHash, newOwner, keepZonefile, 
				     info.txid, ownerAddress, info.vout, info.value);
	    console.log("unsigned : " + tx.toHex());
	    get_subsidy(tx.toHex(), fqa, consensusHash, function(tx){
		console.log("subsidized : " + tx);
		signed_tx = sign_rawtx(tx, keySigner)
		console.log("signed : " + signed_tx.toHex());
		broadcast(signed_tx.toHex(), cb, err_cb);
	    });
	}, err_cb);
    });
}

function do_update(fqa, ownerAddress, dataBuff, keySigner, cb, maxIters){
    if (maxIters === undefined){
	maxIters = 3;
    }else if (maxIters <= 0){
	console.log("Too many attempts.");
	return;
    }

    const err_cb = function(){
	if (maxIters > 1){
	    console.log("Failed first attempt to update " + fqa +", will try " + (maxIters-1) + " more times.")
	}
	do_update(fqa, ownerAddress, dataBuff, keySigner, cb, maxIters - 1);
    }

    get_consensus(function(consensusHash){
	console.log("consensusHash: " + consensusHash)
	get_unspents(ownerAddress, fqa, function(info){
	    const tx = make_update(fqa, consensusHash, dataBuff, 
				   info.txid, ownerAddress, info.vout, info.value);
	    console.log("unsigned : " + tx.toHex());
	    get_subsidy(tx.toHex(), fqa, consensusHash, function(tx){
		console.log("subsidized : " + tx);
		signed_tx = sign_rawtx(tx, keySigner)
		console.log("signed : " + signed_tx.toHex());
		broadcast(signed_tx.toHex(), cb, err_cb);
	    });
	}, err_cb);
    });
}

function run_regtest_core_test(){
    // do an update and then a transfer.
    // --> because the name owner only has 1 UTXO, it has to wait
    //     for the update txn to confirm before the transfer.
    // --> it does this by retrying the transfer txn a bunch.
    var fs = require('fs');
    test_data = JSON.parse(fs.readFileSync('client/test_data.json', 'utf8'));
    regtest_data = test_data.core_regtest_info;
    keySigner = core_wallet.makeKeySigner(regtest_data.wallet, network);

    const zoneFileBuffer = Buffer.from("This zonefile is garbage, I'm really sorry about that.", "ascii");

    get_owned_names(regtest_data.ownerAddr, function(names){
	names.forEach(function(name){
	    do_update(name, regtest_data.ownerAddr, zoneFileBuffer, keySigner, function(update_resp){
		console.log(update_resp);
		do_transfer(name, regtest_data.ownerAddr, regtest_data.newOwner,
			    keySigner, true, console.log);
		})})});
}

function run_regtest_core_multi_test(){
    var fs = require('fs');
    test_data = JSON.parse(fs.readFileSync('client/test_data.json', 'utf8'));
    regtest_data = test_data.core_regtest_info;
    keySigner = core_wallet.makeKeySigner(regtest_data.wallet, network);

    portalData = test_data.portal_test_info;
    portalSigner = portal_wallet.getPortalKeySignerPre09(portalData.wallet, network);

    get_owned_names(regtest_data.ownerAddr, function(names){
	names.forEach(function(name){
	    do_transfer(name, regtest_data.ownerAddr, regtest_data.newOwner, 
			keySigner, false, console.log);
	})});

    get_owned_names(portalData.ownerAddr, function(names){
	names.forEach(function(name){
	    do_transfer(name, portalData.ownerAddr, portalData.newOwner, 
			portalSigner, false, console.log);
	})});
}

function run_regtest_portal_pre09_test(){
    var fs = require('fs');
    test_data = JSON.parse(fs.readFileSync('client/test_data.json', 'utf8'));
    regtest_data = test_data.portal_test_info;
    keySigner = portal_wallet.getPortalKeySignerPre09(regtest_data.wallet, network);

    do_transfer(regtest_data.fqa, regtest_data.ownerAddr, regtest_data.newOwner,
		keySigner, true, console.log);
}


if (process.argv.length > 2 && process.argv[2].startsWith('test')){
    coreNode = "http://localhost:6270";
    network = bitcoin.networks.testnet;
    var test = process.argv[2].slice(5);
    if (test == "core-wallet"){
	run_regtest_core_test();
    }else if (test == "core-wallet-multi"){
	run_regtest_core_multi_test();
    }else if (test == "portal-pre09"){
	run_regtest_portal_pre09_test();
    }
}
