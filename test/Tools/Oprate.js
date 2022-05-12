const {ZEROADDRESS} = require("../Core/Address");

const SetArray = async (length= 10, address = []) => {
    let resultArray = new Array(length);

    for (let i = 0; i < length; i++) {
        if (address[i] !== undefined) {
            resultArray.push(address[i]);
        }else {
            resultArray.push(ZEROADDRESS);
        }
    }
    return resultArray;
}

module.exports = {
    SetArray
}