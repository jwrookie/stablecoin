const {BigNumber} = require("ethers");
const {ethers} = require("hardhat");
const {toWei, fromWei, toBN} = require("web3-utils");
const {time} = require("@openzeppelin/test-helpers");
const {GetMockToken} = require("../test/Utils/GetMockConfig");
const {GetRusdAndTra, StableCoinPool} = require("../test/Utils/GetStableConfig");
const {DeployThreePoolFactoryAndPancakeFactory, DeployThreePoolByThreePoolFactory} = require("../test/Utils/GetThreePoolAndPancakePoolConfig");
const {
    GetUniswapByPancakeFactory,
    AddLiquidityByPancakeRouter,
    SetETHUSDOracle
} = require("../test/Utils/GetUniswapConfig");
const GAS = {gasLimit: "9550000"};

async function main() {
    let rusd, tra, checkOpera, usdc, usdt, weth, pancakeFactory, threePoolFactory, threePool, pancakeRouter;

    const account = await ethers.getSigners();
    
    let deployer = account[0];
    console.log("deployer:\t" + deployer.address);

    [rusd, tra, ,checkOpera] = await GetRusdAndTra();
    console.log("rusd:\t" + rusd.address);
    console.log("tra:\t" + tra.address);
    console.log("checkPermission:\t" + checkOpera.address);

    [usdc, usdt] = await GetMockToken(2, [deployer], toWei("100000000"));
    console.log("usdc:\t" + usdc.address);
    console.log("usdt:\t" + usdt.address);

    let stableCoinPool = await StableCoinPool(usdc.address, toWei("10000000000"));
    console.log("stableCoinPool:\t" + stableCoinPool.address);

    [weth, pancakeFactory, threePoolFactory, threePool, pancakeRouter] = await DeployThreePoolFactoryAndPancakeFactory(
        deployer,
        {value: toWei("300")}
    );
    let pool = await DeployThreePoolByThreePoolFactory(threePoolFactory, threePool, [rusd.address, usdc.address, usdt.address]);

    await AddLiquidityByPancakeRouter(pancakeFactory, [usdc, weth], pancakeRouter, toWei("30000"), [toWei("20000"), toWei("10")], deployer);
    await AddLiquidityByPancakeRouter(pancakeFactory, [rusd, weth], pancakeRouter, toWei("30000"), [toWei("20000"), toWei("10")], deployer);
    await AddLiquidityByPancakeRouter(pancakeFactory, [tra, weth], pancakeRouter, toWei("30000"), [toWei("20000"), toWei("10")], deployer);

    await SetETHUSDOracle(rusd, toWei("2000"));
    let usdcUniswapOracle = await GetUniswapByPancakeFactory(pancakeFactory.address, [usdc.address, weth.address]);
    await stableCoinPool.setCollatETHOracle(usdcUniswapOracle.address, weth.address);
    let rusdUniswapOracle = await GetUniswapByPancakeFactory(pancakeFactory.address, [rusd.address, weth.address]);
    await rusd.setStableEthOracle(rusdUniswapOracle.address, weth.address);
    let traUniswapOracle = await GetUniswapByPancakeFactory(pancakeFactory.address, [tra.address, weth.address]);
    await rusd.setStockEthOracle(traUniswapOracle.address, weth.address);
    console.log("usdcUniswapOracle:\t" + usdcUniswapOracle.address);
    console.log("rusdUniswapOracle:\t" + rusdUniswapOracle.address);
    console.log("traUniswapOracle:\t" + traUniswapOracle.address);

    const AMOMinter = await ethers.getContractFactory('AMOMinter');
    let amoMinter = await AMOMinter.deploy(
        checkOpera.address,
        rusd.address,
        tra.address,
        usdc.address,
        stableCoinPool.address
    );
    console.log("AMOMinter:\t" + amoMinter.address);

    const ExchangeAMO = await ethers.getContractFactory('ExchangeAMO');
    let exchangeAMO = await ExchangeAMO.deploy(
        checkOpera.address,
        amoMinter.address,
        rusd.address,
        tra.address,
        usdc.address,
        pool.address,
        pool.address, // 3pool Lp address
        1,
        0
    );
    console.log("ExchangeAMO:\t" + exchangeAMO.address);

    await rusd.addPool(amoMinter.address);
    await rusd.addPool(stableCoinPool.address);

    await tra.addPool(stableCoinPool.address);
    await tra.addPool(amoMinter.address);

    await usdc.approve(pool.address, toWei("10000"));
    await usdt.approve(pool.address, toWei("10000"));
    await rusd.approve(pool.address, toWei("10000"));

    await pool.add_liquidity([toWei("100"), toWei("100"), toWei("100")], 0, GAS);

    await amoMinter.addAMO(exchangeAMO.address, true); // Because will call the function dollarBalances and find get lpBalance in 3pool so need to add liquidity in 3pool
    await stableCoinPool.addAMOMinter(amoMinter.address); // Because amo will borrow usdc from stable coin pool

    let cr = await rusd.globalCollateralRatio();
    expect(cr).to.be.eq(toWei("1", "mwei"));

    let _deadline = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
    await pancakeRouter.swapExactTokensForTokens(
        toWei('0.1'),
        0,
        [weth.address, rusd.address],
        deployer.address,
        _deadline
    );
    await time.increase(time.duration.hours(1));
    await rusdUniswapOracle.update();
    await rusd.refreshCollateralRatio();
    await traUniswapOracle.update();
    await usdcUniswapOracle.update();

    cr = await rusd.globalCollateralRatio();

    await usdc.approve(stableCoinPool.address, toWei("100000000"));
    await tra.approve(stableCoinPool.address, toWei("100000000"));

    let _stockAmount = BigNumber.from(toWei("80000000")).mul(1e6 - cr);
    await stableCoinPool.mintFractionalStable(toWei("80000000"), _stockAmount, 0);

    await amoMinter.mintStableForAMO(exchangeAMO.address, toWei("200"));

    await exchangeAMO.poolDeposit(toWei("100"), 0, {gasLimit: "9500000"});

    await exchangeAMO.poolWithdrawStable(toWei("10"), false);

    await exchangeAMO.poolWithdrawStable(toWei("10"), true);

    await exchangeAMO.poolWithdrawCollateral(toWei("10"));

    let data = await exchangeAMO.showAllocations();
    console.log("data_0", fromWei(toBN(data[0])));
    console.log("data_1", fromWei(toBN(data[1])));
    console.log("data_2", fromWei(toBN(data[2])));
    console.log("data_3", fromWei(toBN(data[3])));
    console.log("data_4", fromWei(toBN(data[4])));
    console.log("data_5", fromWei(toBN(data[5])));
    console.log("data_6", fromWei(toBN(data[6])));
    console.log("data_7", fromWei(toBN(data[7])));
    console.log("data_8", fromWei(toBN(data[8])));
}

main()
    .then(() => console.log("Deploy Successfully!"))
    .catch((error) => {
        throw Error("Deploy fail! Error message:\t" + error);
    })