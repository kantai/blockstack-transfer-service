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
