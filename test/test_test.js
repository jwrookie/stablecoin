const {ethers} = require("hardhat");
const {toWei} = web3.utils;
const {GetMockToken} = require("./Utils/GetMockConfig");
const {GetRusdAndTra, SetRusdAndTraConfig, StableCoinPool} = require("./Utils/GetStableConfig");
const {GetConfigAboutCRV, CrvFactoryDeploy} = require("./Tools/Deploy");
const {GetUniswap, RouterApprove, SetETHUSDOracle} = require("./Utils/GetUniswapConfig");

contract("test", async function () {
    beforeEach(async function () {
        [owner, dev] = await ethers.getSigners();
        [rusd, tra] = await GetRusdAndTra();
        [usdc, token0, token1] = await GetMockToken(3, [owner, dev], toWei("1"));
        stableCoinPool = await StableCoinPool(usdc, 10000);
        [weth,factory, registry, poolRegistry,router] = await GetConfigAboutCRV(owner);
        // Create token pair
        pool = await CrvFactoryDeploy([usdc, rusd, token1], {});

        await RouterApprove(usdc, toWei("1000"), [, toWei("0.1")], owner);
        await RouterApprove(rusd, toWei("1000"),[toWei("0.000001")], owner);
        await RouterApprove(tra, toWei("1000"),[, , , 0], owner);

        await SetETHUSDOracle();

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
        console.log(factory.address);
        console.log("usdcUniswap:\t" + usdcUniswapOracle.address);
        console.log("fraxUniswap:\t" + fraxUniswapOracle.address);
        console.log("fxsUniswap:\t" + fxsUniswapOracle.address);
    });
});