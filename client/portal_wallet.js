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

var keychains = require('blockstack-keychains');
var bitcoin = require('bitcoinjs-lib');

function makeKeySigner(identityKey){
    var keySigner = function(unsignedTX, sigWhat){
	unsignedTX.sign(0, identityKey, undefined, sigWhat);
    }
    return keySigner;
}

// for portal versions before 2038088458012dcff251027ea23a22afce443f3b
// on main branch, that's commit -- 848d1f5445f01db1e28cde4a52bb3f22e5ca014c
function portalGetIdentityKeyPre09(privateKeychain, network){
    const identityKey = privateKeychain.privatelyNamedChild('blockstack-0');
    const secret = identityKey.ecPair.d; //getPrivateKeyBuffer().toString('hex');
    //const wif = utils.hex_to_wif(asHexSecret);
    return new bitcoin.ECPair(secret, false, {"network" : network});
}

function getPortalKeySignerPre09(mnemonic, network) {
    if (network == undefined) {
	network = bitcoin.networks.bitcoin;
    }
    const privateKeychain = keychains.PrivateKeychain.fromMnemonic(mnemonic)
    const identityKey = portalGetIdentityKeyPre09(privateKeychain, network);
    return makeKeySigner(identityKey);
}

exports.getPortalKeySignerPre09 = getPortalKeySignerPre09;
