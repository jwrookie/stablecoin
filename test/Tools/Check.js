const {ZEROADDRESS} = require("../Lib/Address");

const CheckParameter = async (param = []) => {
    if (0 < param.length) {
        for (let i = 0; i < param.length; i++) {
            switch (typeof param[i]) {
                case "object":
                    if ("{}" === JSON.stringify(param[i])
                        || undefined === param[i]) {
                        throw Error("CheckParameter: Empty object!");
                    }
                    break;
                case "string":
                    if (ZEROADDRESS === param[i]
                        || "" === param[i]
                        || undefined === param[i]) {
                        throw Error("CheckParameter: Invalid address!");
                    }
                    break;
                default:
                    throw Error("CheckParameter: Invalid Type Of Parameters!");
            }
        }
    } else {
        throw Error("CheckParameter: The array of parameters is empty!");
    }
    return true;
}

module.exports = {
    CheckParameter
}