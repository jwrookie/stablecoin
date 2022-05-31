const {SetOracle, SetOperatable, SetRusd, SetTra, SetCheckPermission} = require("../Core/StableConfig");
const {SetMockToken, MintMockToken} = require("../Core/MockTokenConfig");

const GraphicTokenMap = new Map();

const GetMap = async () => {
    return GraphicTokenMap;
}

const TokenFactory = async () => {
    let resultArray = new Array();
    let oracle;
    let operatable;
    let checkOpera;
    let rusd;
    let tra;

    try {
        oracle = await SetOracle();
        operatable = await SetOperatable();
        checkOpera = await SetCheckPermission(operatable);
        rusd = await SetRusd(operatable);
        tra = await SetTra(operatable, oracle);
    }catch (err) {
        throw Error("Deploy token factory error! Error message:\t" + err);
    }

    GraphicTokenMap.set("CHECKOPERA", checkOpera);
    GraphicTokenMap.set("RUSD", rusd);
    GraphicTokenMap.set("TRA", tra);

    resultArray.push(rusd, tra, operatable, checkOpera, oracle);

    return resultArray;
}

const MockTokenFactory = async (deployMockTokenNumber = 1, mintUser = [], mintNumber = toWei("1")) => {
    let user;
    let token;
    let temp;
    let resultArray = new Array();

    for (let i = 0; i < deployMockTokenNumber; i++) {
        token = await SetMockToken();
        if (0 === mintUser.length) {
            throw Error("Please enter the user who wants to mint coins!");
        }
        for (let j = 0; j < mintUser.length; j++) {
            if ("object" === typeof mintUser[j] && undefined !== mintUser[j].address) {
                user = mintUser[j];
                await MintMockToken(token, user.address, mintNumber);
            } else {
                throw Error("Please checking user addresses!");
            }
        }
        resultArray.push(token);
    }

    temp = resultArray[0]; // First mock token defined to usdc
    GraphicTokenMap.set("USDC", temp);

    return resultArray;
}

module.exports = {
    TokenFactory,
    MockTokenFactory,
    GetMap
}
