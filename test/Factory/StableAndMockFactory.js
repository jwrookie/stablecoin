const {ethers} = require('hardhat');
const {SetOracle, SetOperatable, SetRusd, SetTra, SetCheckPermission} = require("../Core/StableConfig");
const {SetMockToken, MintMockToken} = require("../Core/MockTokenConfig");
const {ZEROADDRESS} = require("../Lib/Address");

const GraphicToken = {
    USDC: "",
    RUSD: "",
    RUSDOBJECT: null,
    TRA: ""
}

const TokenFactory = async () => {
    let resultArray = new Array();

    let oracle = await SetOracle();
    let operatable = await SetOperatable();
    let checkOpera = await SetCheckPermission(operatable);
    let rusd = await SetRusd(operatable);
    let tra = await SetTra(operatable, oracle);

    GraphicToken.RUSD = rusd.address;
    GraphicToken.RUSDOBJECT = rusd;
    GraphicToken.TRA = tra.address;

    resultArray.push(oracle, operatable, checkOpera, rusd, tra);

    return resultArray;
}

const MockTokenFactory = async (deployMockTokenNumber = 1, mintUser = [], mintNumber = toWei("1")) => {
    let user;
    let token;
    let temp;
    let resultArray = new Array();

    if (deployMockTokenNumber <= 0) {
        throw "Please input token what you need!";
    }

    for (let i = 0; i < deployMockTokenNumber; i++) {
        token = await SetMockToken();
        for (let j = 0; j < mintUser.length; j++) {
            if (mintUser[j] !== undefined || mintUser[j] !== ZEROADDRESS) {
                user = mintUser[j];
                await MintMockToken(token, user.address, mintNumber);
            } else {
                throw "Please checking user addresses!";
            }
        }
        resultArray.push(token);
    }

    temp = resultArray[0]
    GraphicToken.USDC = temp.address;

    return resultArray;
}

module.exports = {
    TokenFactory,
    MockTokenFactory,
    GraphicToken,
}