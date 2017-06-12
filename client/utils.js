var bitcoin = require('bitcoinjs-lib');
var wif = require('wif');

exports.hash128 = function(buff){
    var ret = Buffer.from(bitcoin.crypto.sha256(buff).slice(0, 16));
    return ret;
}

exports.hex_to_wif = function(hexStr, network){
    b = Buffer.from(hexStr, "hex");
    return wif.encode(network.wif, b, true);
}
