var utils = require('./utils.js');
var bitcoin = require('bitcoinjs-lib');

exports.makeKeySigner = function(wallet, network){
    if (network == undefined) {
	network = bitcoin.networks.bitcoin
    }
    var keySigner = function(unsignedTX, sigWhat){
	ownerPrivKey = wallet.owner_privkey
	wif1 = utils.hex_to_wif(ownerPrivKey.private_keys[0], network)
	wif2 = utils.hex_to_wif(ownerPrivKey.private_keys[1], network)
	kp1 = bitcoin.ECPair.fromWIF(wif1, network)
	kp2 = bitcoin.ECPair.fromWIF(wif2, network)
	redeemScript = Buffer.from(ownerPrivKey.redeem_script, "hex");

	unsignedTX.sign(0, kp1, redeemScript,
			sigWhat);
	unsignedTX.sign(0, kp2, redeemScript,
			sigWhat);
    }
    return keySigner;
}
