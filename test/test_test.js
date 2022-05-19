const {ethers} = require("hardhat");
const {toWei} = web3.utils;
const {GetMockToken} = require("./Utils/GetMockConfig");
const {GetRusdAndTra, SetRusdAndTraConfig, StableCoinPool} = require("./Utils/GetStableConfig");
const {GetConfigAboutCRV, CrvFactoryDeploy} = require("./Tools/Deploy");
const {ZEROADDRESS} = require("./Lib/Address");
const {BigNumber} = require('ethers');
const {time} = require('@openzeppelin/test-helpers');

const {GetUniswap} = require("./Utils/GetUniswapConfig");
const GAS = {gasLimit: "9550000"};

contract("test", async function () {
    beforeEach(async function () {
        [owner, dev] = await ethers.getSigners();
        [, , checkOpera, rusd, tra] = await GetRusdAndTra();
        await SetRusdAndTraConfig(rusd, tra);
        [usdc, token0, token1] = await GetMockToken(3, [owner, dev], toWei("1"));
        stableCoinPool = await StableCoinPool(checkOpera, rusd, tra, usdc, 10000);
        [weth, factory, router, registry, poolRegistry, crvFactory, plain3Balances] = await GetConfigAboutCRV(owner);
        // Mint weth
        await weth.deposit({value: toWei("10")});
        await weth.approve(router.address, toWei("10000"));
        // await SetPlainImplementations(crvFactory, 3, [plain3Balances]);
        // Create token pair
        await CrvFactoryDeploy(crvFactory, [token0, rusd, token1], 0
            , 0, GAS);
        await usdc.approve(router.address, toWei("1000"));
        await router.addLiquidity(
            usdc.address,
            weth.address,
            toWei("1"),
            toWei("1"),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 2600000)
        );

        await rusd.approve(router.address, toWei("1000"));
        await router.addLiquidity(
            rusd.address,
            weth.address,
            toWei("0.5"),
            toWei("1"),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 2600000)
        );

        await tra.approve(router.address, toWei("1000"));
        await router.addLiquidity(
            tra.address,
            weth.address,
            toWei('0.1'),
            toWei('1'),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 2600000)
        );
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