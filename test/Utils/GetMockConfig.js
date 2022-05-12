const {ethers} = require("hardhat");
const {SetMockToken} = require("../Core/MockTokenConfig");
const {toWei} = web3.utils;

const GetMockToken = async (mintToken, mintUser, mintNumber = toWei("1")) => {
    let token;
    let user;
    let resultArray = new Array();
    let length = mintToken.length;
    let mintUserLength = mintUser.length;

    if (length === 0 || mintUserLength === 0) {
        return Error("Please input token what you need or what user you want to transfer!");
    }

    for (let i = 0; i < length; i++) {
        token = mintToken[i];
        token = await SetMockToken(mintNumber);
        for (let j = 0; j < mintUserLength; j++) {
            user = mintUser[i];
            console.log("==========" + user);
            await token.mint(user, mintNumber);
        }
        resultArray.push(token);
    }
    return resultArray;
}

module.exports = {
    GetMockToken
}