const {Signers} = require("../Core/WalletConfig");

const GetSigners = async () => {
    return await Signers();
}

module.exports = {
    GetSigners
}