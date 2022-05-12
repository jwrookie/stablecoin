const {ethers} = require("hardhat");
const {SetMockToken, MintMockToken} = require("../Core/MockTokenConfig");
const {ZEROADDRESS} = require("../Core/Address");
const {toWei} = web3.utils;

const GetMockToken = async (mockTokenNumber = 1, mintUser = [], mintNumber = toWei("1")) => {
    let token;
    let resultArray = new Array();

    if (mockTokenNumber === 0) {
        return Error("Please input token what you need!");
    }

    for (let i = 0; i < mockTokenNumber; i++) {
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