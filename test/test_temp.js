const {ethers} = require("hardhat");
const {toWei} = web3.utils;
const {GetMockToken} = require("./util/GetMockConfig");
const {GetRusdAndTra, StableCoinPool, StableCoinPoolFreeParameter} = require("./util/GetStableConfig");
const {DeployThreePoolFactoryAndPancakeFactory, DeployThreePoolByThreePoolFactory} = require("./util/GetThreePoolAndPancakePoolConfig");
const {
    GetUniswapByPancakeFactory,
    AddLiquidityByPancakeRouter,
    SetETHUSDOracle
} = require("./util/GetUniswapConfig");

contract("test", async function () {
    let checkPermission = "0x87465916d6168fdC9f42B8649074B0EE361Eb061";
    let rusdAddress = "0xc792dDbC43b0FB824D3B2916bb4BCa9dF113E9Ac";
    let traAddress = "0x707E9Dc22a38d7E14318Fea24EFe6848dd5D7bE9";
    let usdcAddress = "0x1d870E0bDF106B8E515Ed0276ACa660c30a58D3A";

    beforeEach(async function () {
        [owner, dev] = await ethers.getSigners();
        [rusd, tra, , checkOpera] = await GetRusdAndTra();
        [usdc, token0, token1] = await GetMockToken(3, [owner, dev], toWei("1"));
        stableCoinPool = await StableCoinPool(usdc.address, 10000);
        stableCoinPoolSecond = await StableCoinPoolFreeParameter(checkOpera.address, rusd.address, tra.address, usdc.address, 10000);
        [weth, pancakeFactory, threePoolFactory, threePool, pancakeRouter] = await DeployThreePoolFactoryAndPancakeFactory(
            owner,
            {value: toWei("300")}
        );

        // Create token pair
        pool = await DeployThreePoolByThreePoolFactory(threePoolFactory, threePool, [rusd.address, usdc.address, token1.address]);

        await AddLiquidityByPancakeRouter(pancakeFactory, [usdc, weth], pancakeRouter, toWei("1000"), [, toWei("1")], owner);
        await AddLiquidityByPancakeRouter(pancakeFactory, [rusd, weth], pancakeRouter, toWei("1000"), [toWei("0.000001")], owner);
        await AddLiquidityByPancakeRouter(pancakeFactory, [tra, weth], pancakeRouter, toWei("1000"), [, , , 0], owner);

        await SetETHUSDOracle(rusd);

        usdcUniswapOracle = await GetUniswapByPancakeFactory(pancakeFactory.address, [usdc.address, weth.address]);
        await stableCoinPool.setCollatETHOracle(usdcUniswapOracle.address, weth.address);
        fraxUniswapOracle = await GetUniswapByPancakeFactory(pancakeFactory.address, [rusd.address, weth.address]);
        await rusd.setStableEthOracle(fraxUniswapOracle.address, weth.address);
        fxsUniswapOracle = await GetUniswapByPancakeFactory(pancakeFactory.address, [tra.address, weth.address]);
        await rusd.setStockEthOracle(fxsUniswapOracle.address, weth.address);
    });
    it('should ', async function () {
        // console.log(rusd.address);
        // console.log(tra.address);
        // console.log(usdc.address);
        // console.log(token0.address);
        // console.log(token1.address);
        // console.log(stableCoinPool.address);
        // console.log(stableCoinPoolSecond.address);
        // console.log(pancakeFactory.address);
        // console.log("usdcUniswap:\t" + usdcUniswapOracle.address);
        // console.log("fraxUniswap:\t" + fraxUniswapOracle.address);
        // console.log("fxsUniswap:\t" + fxsUniswapOracle.address);
    });
});