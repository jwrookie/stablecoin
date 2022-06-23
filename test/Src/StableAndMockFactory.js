const {ethers} = require('hardhat');
const {SetMockToken, MintMockToken} = require("./MockTokenConfig");

const GraphicTokenMap = new Map();

const GetMap = async () => {
    return GraphicTokenMap;
}

const SetOracle = async () => {
    const TestOracle = await ethers.getContractFactory("TestOracle");
    return await TestOracle.deploy();
}

const SetOperatable = async () => {
    const TestOperatable = await ethers.getContractFactory("Operatable");
    return await TestOperatable.deploy();
}

const SetCheckPermission = async (operatable) => {
    const CheckOperator = await ethers.getContractFactory("CheckPermission");
    return await CheckOperator.deploy(operatable.address);
}

const SetRusd = async (operatable) => {
    const RStableCoin = await ethers.getContractFactory("RStablecoin");
    return await RStableCoin.deploy(operatable.address, "Rusd", "Rusd");
}

const SetTra = async (operatable, oracle) => {
    const Stock = await ethers.getContractFactory("Stock");
    return await Stock.deploy(operatable.address, "Tra", "Tra", oracle.address);
}

const SetFraxPoolLib = async () => {
    const FraxPoolLibrary = await ethers.getContractFactory("PoolLibrary");
    return await FraxPoolLibrary.deploy();
}

const SetPoolAddress = async (poolLib) => {
    if ("object" !== typeof poolLib || "{}" === JSON.stringify(poolLib)) {
        throw Error("SetPoolAddress: Empty Parameter!");
    }

    return await ethers.getContractFactory("PoolUSD", {
        libraries: {
            PoolLibrary: poolLib.address,
        },
    });
}

const TokenFactory = async () => {
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

    return {
        rusd,
        tra,
        operatable,
        checkOpera,
        oracle
    }
}

const MockTokenFactory = async (deployMockTokenNumber = 1, mintUser = [], mintNumber = toWei("1")) => {
    let user;
    let token;
    let temp;
    let resultArray = new Array();

    for (let i = 0; i < deployMockTokenNumber; i++) {
        token = await SetMockToken();
        if (0 === mintUser.length) {
            throw Error("MockTokenFactory: Please enter the user who wants to mint coins!");
        }
        for (let j = 0; j < mintUser.length; j++) {
            if ("object" === typeof mintUser[j] && "{}" !== JSON.stringify(mintUser[j])) {
                user = mintUser[j];
                await MintMockToken(token, user.address, mintNumber);
            } else {
                throw Error("MockTokenFactory: Please checking user addresses!");
            }
        }
        resultArray.push(token);
    }

    temp = resultArray[0]; // First mock token defined to usdc
    GraphicTokenMap.set("USDC", temp);

    return resultArray;
}

module.exports = {
    SetFraxPoolLib,
    SetPoolAddress,
    TokenFactory,
    MockTokenFactory,
    GetMap
}
