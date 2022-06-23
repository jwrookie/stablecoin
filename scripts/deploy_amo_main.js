const {ethers} = require("hardhat");
const $ = require("../test/Src/common");
const {toWei} = require("web3-utils");
const WETH9 = require("../test/mock/WETH9.json");
const Config = require("../test/test_amo/conftest");
const PancakeFactory = require("../test/mock/PancakeFactory.json");
const PancakePair = require("../test/mock/PancakePair.json");
const PancakeRouter = require("../test/mock/PancakeRouter.json");
const {time} = require("@openzeppelin/test-helpers");
const {BigNumber} = require("ethers");

async function main() {
    const account = await ethers.getSigners();

    let deployer = account[0];
    $.log("deployer", deployer.address);

    const {
        Stock, RStablecoin, PoolLibrary,
        CheckPermission, Operatable,
        TestOracle, MockChainLink, ChainlinkETHUSDPriceConsumer,
        ExchangeAMO, AMOMinter
    } = await $.setup();

    operatable = await Operatable.deploy();
    $.log("operatable", operatable.address);

    checkPermission = await CheckPermission.deploy(operatable.address);
    $.log("checkPermission", checkPermission.address);

    testOracle = await TestOracle.deploy();
    $.log("testOracle", testOracle.address);

    fxs = await Stock.deploy(checkPermission.address, "fxs", "fxs", testOracle.address);
    $.log("fxs", fxs.address);

    frax = await RStablecoin.deploy(checkPermission.address, "frax", "frax");
    $.log("frax", frax.address);

    await fxs.setStableAddress(frax.address);
    await frax.setStockAddress(fxs.address);

    [usdc, usdt] = await $.mockTokenBatch(18, 0, "usdc", "usdt");
    $.log("usdc", usdc.address);
    $.log("usdt", usdt.address);

    await usdc.mint(owner.address, toWei("100000000"));
    await usdt.mint(owner.address, toWei("100000000"));

    weth = await $.deploy(owner, WETH9.bytecode, WETH9.abi);
    $.log("weth", weth.address);

    await weth.deposit({value: toWei("1000")});

    const poolLibrary = await PoolLibrary.deploy();
    stablecoinPool = await Config.getStablecoinPool(poolLibrary, checkPermission, frax, fxs, usdc);
    $.log("stablecoinPool", stablecoinPool.address);


    await frax.addPool(stablecoinPool.address);
    await fxs.addPool(stablecoinPool.address);

    pancakeFactory = await $.deploy(owner, PancakeFactory.bytecode, PancakeFactory.abi, [owner.address]);
    $.log("pancakeFactory", pancakeFactory.address);

    await pancakeFactory.createPair(usdc.address, weth.address);
    await pancakeFactory.createPair(fxs.address, weth.address);
    await pancakeFactory.createPair(frax.address, weth.address);

    pancakePair = await $.deploy(owner, PancakePair.bytecode, PancakePair.abi);
    $.log("pancakePair", pancakePair.address);

    pancakeRouter = await $.deploy(owner, PancakeRouter.bytecode, PancakeRouter.abi, [pancakeFactory.address, weth.address]);
    $.log("pancakeRouter", pancakeRouter.address);

    await usdc.approve(pancakeRouter.address, toWei("100000"));
    await fxs.approve(pancakeRouter.address, toWei("100000"));
    await frax.approve(pancakeRouter.address, toWei("100000"));
    await weth.approve(pancakeRouter.address, toWei("10000"));

    let _deadline = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
    await pancakeRouter.addLiquidity(
        usdc.address, weth.address,
        toWei("20000"), toWei("10"), 0, 0,
        owner.address, _deadline
    );
    await pancakeRouter.addLiquidity(
        fxs.address, weth.address,
        toWei("20000"), toWei("10"), 0, 0,
        owner.address, _deadline
    );
    await pancakeRouter.addLiquidity(
        frax.address, weth.address,
        toWei("20000"), toWei("10"), 0, 0,
        owner.address, _deadline
    );

    chainLink = await MockChainLink.deploy();
    $.log("chainLink", chainLink.address);

    ETHUSDOracle = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);
    $.log("ETHUSDOracle", ETHUSDOracle.address);

    await chainLink.setAnswer(toWei("2000"));
    await frax.setETHUSDOracle(ETHUSDOracle.address);

    fxsEthOracle = await Config.getUniswapPairOracle(pancakeFactory, fxs, weth);
    $.log("fxsEthOracle", fxsEthOracle.address);

    await frax.setStockEthOracle(fxsEthOracle.address, weth.address);

    fraxEthOracle = await Config.getUniswapPairOracle(pancakeFactory, frax, weth);
    $.log("fraxEthOracle", fraxEthOracle.address);

    await frax.setStableEthOracle(fraxEthOracle.address, weth.address);

    usdcEthOracle = await Config.getUniswapPairOracle(pancakeFactory, usdc, weth);
    $.log("usdcEthOracle", usdcEthOracle.address);

    await stablecoinPool.setCollatETHOracle(usdcEthOracle.address, weth.address);

    pool3 = await Config.getPlain3Pool(frax, usdc, usdt);
    $.log("pool3", pool3.address);

    await frax.approve(pool3.address, toWei("1000"));
    await usdc.approve(pool3.address, toWei("1000"));
    await usdt.approve(pool3.address, toWei("1000"));
    await pool3.add_liquidity([toWei("100"), toWei("100"), toWei("100")], 0);

    amoMinter = await AMOMinter.deploy(
        checkPermission.address,
        frax.address,
        fxs.address,
        usdc.address,
        stablecoinPool.address);
    $.log("amoMinter", amoMinter.address);

    exchangeAMO = await ExchangeAMO.deploy(
        checkPermission.address,
        amoMinter.address,
        frax.address,
        fxs.address,
        usdc.address,
        pool3.address,
        pool3.address,
        1, 0);
    $.log("exchangeAMO", exchangeAMO.address);


    await amoMinter.addAMO(exchangeAMO.address, true);
    await stablecoinPool.addAMOMinter(amoMinter.address);

    ////////////
    _deadline = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
    for (let i = 0; i < 10; i++) {
        await pancakeRouter.swapExactTokensForTokens(
            toWei('0.1'),
            0,
            [weth.address, frax.address],
            _owner.address,
            _deadline
        );
        await time.increase(time.duration.hours(1));
        await fraxEthOracle.update();
        await frax.refreshCollateralRatio();
    }
    await fxsEthOracle.update();
    await usdcEthOracle.update();

    cr = await frax.globalCollateralRatio();

    expect(cr).to.be.gt(await amoMinter.minCR());

    await usdc.approve(stablecoinPool.address, toWei("100000000"));
    await fxs.approve(stablecoinPool.address, toWei("100000000"));

    let _stockAmount = BigNumber.from(toWei("80000000")).mul(1e6 - cr);
    await stablecoinPool.mintFractionalStable(toWei("80000000"), _stockAmount, 0);

    await frax.addPool(amoMinter.address);
    await amoMinter.mintStableForAMO(exchangeAMO.address, toWei("200"));

    // deposit
    await exchangeAMO.poolDeposit(toWei("100"), 0, {gasLimit: "9500000"});


    await exchangeAMO.poolWithdrawStable(toWei("10"), false);

    await exchangeAMO.poolWithdrawStable(toWei("10"), true);

    await exchangeAMO.poolWithdrawCollateral(toWei("10"));

    // data
    let data = await exchangeAMO.showAllocations();
    $.log("data_0", fromWei(toBN(data[0])));
    $.log("data_1", fromWei(toBN(data[1])));
    $.log("data_2", fromWei(toBN(data[2])));
    $.log("data_3", fromWei(toBN(data[3])));
    $.log("data_4", fromWei(toBN(data[4])));
    $.log("data_5", fromWei(toBN(data[5])));
    $.log("data_6", fromWei(toBN(data[6])));
    $.log("data_7", fromWei(toBN(data[7])));
    $.log("data_8", fromWei(toBN(data[8])));
}

main()
    .then(() => console.log("Deploy Successfully!"))
    .catch((error) => {
        throw Error("Deploy fail! Error message:\t" + error);
    })

// deployer:            0xC585BBbcA646b67Ab587d30e6AD005BA1e3835e0
// rusd:                0x0862181Ca8b4EE252dCc7F8dda170C9927A25A98
// tra:                 0x3deC37c61a7F151F71CF8852024B0646eA0895f7
// checkPermission:     0x7679894992d35089C9cc0C7A2905E603aE81E107
// usdc:                0xbab14cc0a7903aeb50B8986285b1B3941D8C6050
// usdt:                0x192EAc71aA6Cf7fEC5306d5f8Dbf4BF94d83b051
// stableCoinPool:      0xEC2237065965d5feb0F32eb820C9253126Aa6f32