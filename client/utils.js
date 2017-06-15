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
