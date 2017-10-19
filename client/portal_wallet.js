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
var bip39 = require('bip39')

// for portal versions before 2038088458012dcff251027ea23a22afce443f3b
class IdentityNode{
    constructor(key){
        this.key = key
    }
    getAddress(){
        return this.key.getAddress()
    }
    getSKHex(){
        return this.key.keyPair.d.toBuffer(32).toString('hex')
    }
}

function getIdentityNodeFromPhrase(phrase, version = "current"){

}

// on main branch, that's commit -- 848d1f5445f01db1e28cde4a52bb3f22e5ca014c
function portalGetIdentityKeyPre09(pK, network){
    const identityKey = pK.privatelyNamedChild('blockstack-0')
    const secret = identityKey.ecPair.d //getPrivateKeyBuffer().toString('hex');
    return new bitcoin.ECPair(secret, false, {"network" : network})
}

function portalGetIdentityKeyPost14(pK, network){
    //                                                 index ------v
    return pK.deriveHardened(888).deriveHardened(0).deriveHardened(0)
}

function portalGetIdentityKey09to14(pK, network){
    //                                                 index ------v
    return pK.deriveHardened(888).deriveHardened(0).deriveHardened(0).derive(0)
}

function getPortalKeyPre09(mnemonic, network) {
    if (network == undefined) {
        network = bitcoin.networks.bitcoin
    }
    const privateKeychain = keychains.PrivateKeychain.fromMnemonic(mnemonic)
    return portalGetIdentityKeyPre09(privateKeychain, network)
}


function getPortalKey09to14(mnemonic, network) {
    if (network == undefined) {
        network = bitcoin.networks.bitcoin
    }
    const seed = bip39.mnemonicToSeed(mnemonic)
    const masterKeychain = bitcoin.HDNode.fromSeedBuffer(seed)
    return portalGetIdentityKey09to14(masterKeychain, network)
}

function getPortalKeyCurrent(mnemonic, network) {
    if (network == undefined) {
        network = bitcoin.networks.bitcoin
    }

    const seed = bip39.mnemonicToSeed(mnemonic)
    const masterKeychain = bitcoin.HDNode.fromSeedBuffer(seed)
    return portalGetIdentityKeyPost14(masterKeychain, network)
}


exports.getPortalKeyPre09 = getPortalKeyPre09
exports.getPortalKey09to14 = getPortalKey09to14
exports.getPortalKeyCurrent = getPortalKeyCurrent
