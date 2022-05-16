const {ethers} = require("hardhat");
const {SetMockToken, MintMockToken} = require("../Core/MockTokenConfig");
const {ZEROADDRESS} = require("../Lib/Address");
const {toWei} = web3.utils;

const GetMockToken = async (deployMockTokenNumber = 1, mintUser = [], mintNumber = toWei("1")) => {
    let user;
    let token;
    let resultArray = new Array();

    if (deployMockTokenNumber <= 0) {
        return Error("Please input token what you need!");
    }

    for (let i = 0; i < deployMockTokenNumber; i++) {
        token = await SetMockToken();
        for (let j = 0; j < mintUser.length; j++) {
            if (mintUser[j] !== undefined || mintUser[j] !== ZEROADDRESS) {
                user = mintUser[j];
                await MintMockToken(token, user.address, mintNumber);
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