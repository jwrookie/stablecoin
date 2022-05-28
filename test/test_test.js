const {ethers} = require("hardhat");
const {toWei} = web3.utils;
const {GetMockToken} = require("./Utils/GetMockConfig");
const {SetFraxPoolLib} = require("./Core/StableConfig");
const {GetRusdAndTra, StableCoinPool, StableCoinPoolFreeParameter} = require("./Utils/GetStableConfig");
const {GetCRV, DeployThreePoolByCrvFactory} = require("./Tools/Deploy");
const {GetUniswap, RouterApprove, SetETHUSDOracle} = require("./Utils/GetUniswapConfig");

contract("test", async function () {
    let checkPermission = "0x87465916d6168fdC9f42B8649074B0EE361Eb061";
    let rusdAddress = "0xc792dDbC43b0FB824D3B2916bb4BCa9dF113E9Ac";
    let traAddress = "0x707E9Dc22a38d7E14318Fea24EFe6848dd5D7bE9";
    let usdcAddress = "0x1d870E0bDF106B8E515Ed0276ACa660c30a58D3A";

    beforeEach(async function () {
        [owner, dev] = await ethers.getSigners();
        [rusd, tra] = await GetRusdAndTra();
        [usdc, token0, token1] = await GetMockToken(3, [owner, dev], toWei("1"));
        stableCoinPool = await StableCoinPool(usdc, 10000);
        [weth,factory, registry, poolRegistry,router] = await GetCRV(owner, {value: toWei("200")});
        // Create token pair
        pool = await DeployThreePoolByCrvFactory([usdc, rusd, token1], {});

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