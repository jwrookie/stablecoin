const {ZEROADDRESS} = require("../Lib/Address");

const CheckParameter = async (param = []) => {
    if (0 < param.length) {
        for (let i = 0; i < param.length; i++) {
            if ("object" !== typeof param[i]) {
                throw Error("Need An Object!");
            }
            switch (param[i].address) {
                case undefined:
                    throw Error("Empty Object Error!");
                case ZEROADDRESS:
                    throw Error("Address Type Error!");
                default:
                    break;
            }
        }
    }else {
        return false;
    }
    return true;
}

module.exports = {
    CheckParameter
}