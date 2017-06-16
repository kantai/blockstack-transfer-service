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
