const {ethers} = require("hardhat");
const {toWei} = web3.utils;
const {GetMockToken} = require("./Utils/GetMockConfig");
const {GetRusdAndTra, SetRusdAndTraConfig, StableCoinPool} = require("./Utils/GetStableConfig");
const {GetConfigAboutCRV, CrvFactoryDeploy} = require("./Tools/Deploy");
const {GetUniswap, RouterApprove} = require("./Utils/GetUniswapConfig");

contract("test", async function () {
    beforeEach(async function () {
        [owner, dev] = await ethers.getSigners();
        [, , checkOpera, rusd, tra] = await GetRusdAndTra();
        await SetRusdAndTraConfig(rusd, tra);
        [usdc, token0, token1] = await GetMockToken(3, [owner, dev], toWei("1"));
        stableCoinPool = await StableCoinPool(checkOpera, rusd, tra, usdc, 10000);
        [weth, factory, router, registry, poolRegistry, crvFactory, plain3Balances] = await GetConfigAboutCRV(owner);
        // Create token pair
        await CrvFactoryDeploy(crvFactory, [token0, rusd, token1], {});

        await RouterApprove(usdc, {}, owner);
        await RouterApprove(rusd, {}, owner);
        await RouterApprove(tra, {}, owner);

        usdcUniswapOracle = await GetUniswap(owner, stableCoinPool, factory, usdc, weth);
        fraxUniswapOracle = await GetUniswap(owner, stableCoinPool, factory, rusd, weth);
        fxsUniswapOracle = await GetUniswap(owner, stableCoinPool, factory, tra, weth);
    });
    it('should ', async function () {
        console.log(rusd.address);
        console.log(tra.address);
        console.log(usdc.address);
        console.log(token0.address);
        console.log(token1.address);
        console.log(stableCoinPool.address);
        console.log(crvFactory.address);
        console.log(factory.address);
    });
});