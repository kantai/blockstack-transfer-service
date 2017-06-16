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

var bitcoin = require('bitcoinjs-lib');
var wif = require('wif');
var RIPEMD160 = require('ripemd160');

exports.hash128 = function(buff){
    var ret = Buffer.from(bitcoin.crypto.sha256(buff).slice(0, 16));
    return ret;
}

exports.hash160 = function(buff){
    const sha256 = bitcoin.crypto.sha256(buff);
    const ret =  (new RIPEMD160()).update(sha256).digest();
    return ret;
}

exports.hex_to_wif = function(hexStr, network){
    var b = Buffer.from(hexStr, "hex");
    return wif.encode(network.wif, b, true);
}
