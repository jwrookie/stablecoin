const {ethers} = require("hardhat");
const {SetMockToken, MintMockToken} = require("../Core/MockTokenConfig");
const {ZEROADDRESS} = require("../Core/Address");
const {toWei} = web3.utils;

const GetMockToken = async (mintToken, mintUser = [], mintNumber = toWei("1")) => {
    let token;
    let resultArray = new Array();
    let length = mintToken.length;

    if (length === 0) {
        return Error("Please input token what you need!");
    }

    for (let i = 0; i < length; i++) {
        token = mintToken[i];
        token = await SetMockToken();
        for (let j = 0; j < mintUser.length; j++) {
            if (mintUser[j] !== undefined || mintUser[j] !== ZEROADDRESS) {
                await MintMockToken(token, mintUser[j], mintNumber);
            }else {
                return Error("Please checking user addresses!");
            }
        }
        resultArray.push(token);
    }
    return resultArray;
}

module.exports = {
    GetMockToken
}