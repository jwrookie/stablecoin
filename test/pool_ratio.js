const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {GetMockToken} = require("./Utils/GetMockConfig");
const {GetRusdAndTra, SetRusdAndTraConfig, StableCoinPool} = require("./Utils/GetStableConfig");
const {SetPlainImplementations, SetPoolByCrvFactory} = require("./Core/LibSourceConfig");
const {GetConfigAboutCRV, CrvFactoryDeploy} = require("./Tools/Deploy");

const {GetUniswap, RouterApprove} = require("./Utils/GetUniswapConfig");
const GAS = {gasLimit: "9550000"};
const {BigNumber} = require('ethers');


function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}


contract('PoolUSD', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        [, , checkOpera, rusd, tra] = await GetRusdAndTra();
        await SetRusdAndTraConfig(rusd, tra);
        [usdc, token0, token1] = await GetMockToken(3, [owner, dev], toWei("100000000000"));
        stableCoinPool = await StableCoinPool(checkOpera, rusd, tra, usdc, toWei('10000000000'));

        const MockChainLink = await ethers.getContractFactory("MockChainLink");
        chainLink = await MockChainLink.deploy();

        const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
        chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);
        await rusd.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address);

        await chainLink.setAnswer(toWei('100'));

        [weth, factory, router, registry, poolRegistry, crvFactory, plain3Balances] = await GetConfigAboutCRV(owner);
        await weth.deposit({value: toWei("100")});
        await weth.approve(router.address, toWei("100000"));
        await CrvFactoryDeploy(crvFactory, [token0, rusd, token1], 0
            , 0, GAS);


        //  await RouterApprove(usdc, {toWei("10000"), toWei("1"),  toWei("1"),0,  0}, owner);
        // await RouterApprove(rusd, {}, owner);
        // await RouterApprove(tra, {}, owner);
        await usdc.approve(router.address, toWei("100000"));
        await router.addLiquidity(
            usdc.address,
            weth.address,
            toWei("1"),
            toWei("0.1"),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 2600000)
        );

        await rusd.approve(router.address, toWei("1000"));
        await router.addLiquidity(
            rusd.address,
            weth.address,
            toWei("1"),
            toWei("0.1"),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 2600000)
        );

        await tra.approve(router.address, toWei("1000"));
        await router.addLiquidity(
            tra.address,
            weth.address,
            toWei('1'),
            toWei('0.1'),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 2600000)
        );
        usdcUniswapOracle = await GetUniswap(owner, stableCoinPool, factory, usdc, weth);
        fraxUniswapOracle = await GetUniswap(owner, stableCoinPool, factory, rusd, weth);
        fxsUniswapOracle = await GetUniswap(owner, stableCoinPool, factory, tra, weth);


        await tra.addPool(stableCoinPool.address);
        await rusd.addPool(stableCoinPool.address);
        await usdcUniswapOracle.setPeriod(1);
        await fraxUniswapOracle.setPeriod(1);
        await fxsUniswapOracle.setPeriod(1);
        await rusd.setRefreshCooldown(1);

        await rusd.approve(stableCoinPool.address, toWei('10000000000'));
        await tra.approve(stableCoinPool.address, toWei('10000000000'));
        await usdc.approve(stableCoinPool.address, toWei('10000000000'));
        await rusd.connect(dev).approve(stableCoinPool.address, toWei('10000000000'));
        await tra.connect(dev).approve(stableCoinPool.address, toWei('10000000000'));
        await usdc.connect(dev).approve(stableCoinPool.address, toWei('10000000000'));

        await tra.transfer(dev.address, toWei('1000'));

    });
    it("frax price >1, the collateral ratio decreased", async () => {

        await oraclePrice();

        await rusd.refreshCollateralRatio();
        let ratio = 1000000;

        expect(await rusd.globalCollateralRatio()).to.be.eq(ratio - 2500);

        await rusd.refreshCollateralRatio();
        expect(await rusd.globalCollateralRatio()).to.be.eq(ratio - 5000);


    });
    it("frax price < 1, the collateral ratio increases", async () => {
        await oraclePrice();

        await rusd.refreshCollateralRatio();
        let ratio = 1000000;

        expect(await rusd.globalCollateralRatio()).to.be.eq(ratio - 2500);

        let times = Number((new Date().getTime() / 1000 + 2600000).toFixed(0));
        for (let i = 0; i < 5; i++) {
            await router.swapExactTokensForTokens(
                toWei('1'),
                1,
                [rusd.address, weth.address],
                owner.address,
                times
            )
            await oraclePrice();
            await rusd.refreshCollateralRatio();
        }
        ;

        expect(await rusd.globalCollateralRatio()).to.be.eq(ratio);


    });
    it("re mortgage will exceed the pool limit", async () => {
        await usdc.approve(stableCoinPool.address, toWei("1000000000000"))
        await oraclePrice();

        expect(await stableCoinPool.poolCeiling()).to.be.eq(toWei('10000000000'))

        await rusd.refreshCollateralRatio();


        await expect(stableCoinPool.recollateralizeStable(1, "10")).to.be.revertedWith("Slippage limit reached");
        await stableCoinPool.recollateralizeStable(toWei('10000000000'), "10");


    });
    it("two users mintFractionalStable", async () => {
        await oraclePrice();
        await rusd.refreshCollateralRatio();
        //console.log( "getCollateralPrice"+await stableCoinPool.getCollateralPrice())
        await stableCoinPool.mintFractionalStable(toWei('1'), toWei('1'), 0);
        expect(await usdc.balanceOf(stableCoinPool.address)).to.be.eq(toWei('1'))

        await stableCoinPool.connect(dev).mintFractionalStable(toWei('1'), toWei('1'), 0);


        expect(await usdc.balanceOf(stableCoinPool.address)).to.be.eq(toWei('2'))
    });
    // it("test buyBackStock", async () => {
    //      await usdc_uniswapOracle.setPeriod(1);
    //      await frax_uniswapOracle.setPeriod(1);
    //      await fxs_uniswapOracle.setPeriod(1);
    //      await oraclePrice();
    //
    //
    //      // await frax.burn(toWei('1999999'));
    //      // expect(await frax.totalSupply()).to.be.eq(toWei('1'));
    //
    //     //await frax.setStableStep("250000");
    //      await frax.refreshCollateralRatio();
    //     // expect(await pool.availableExcessCollatDV()).to.be.eq(0);
    //     // await pool.mintFractionalStable(toWei('1'), toWei('10000000000'), 0);
    //      // expect(await frax.globalCollateralValue()).to.be.eq("10000000000000000000");
    //      // expect(await pool.availableExcessCollatDV()).to.be.eq(0);
    //      // expect(await frax.totalSupply()).to.be.eq("11025062656641604010");
    //      //
    //      // expect(await usdc.balanceOf(pool.address)).to.be.eq("1000000000000000000");
    //      // expect(await fxs.balanceOf(owner.address)).to.be.eq("999998997493734335839599");
    //     console.log("usdc:"+await usdc.balanceOf(owner.address))
    //
    //      await pool.recollateralizeStable(toWei('10000000000'), "100");
    //     console.log("usdc:"+await usdc.balanceOf(owner.address))
    //
    //      // expect(await frax.globalCollateralRatio()).to.be.eq("997500");
    //      // expect(await frax.globalCollateralValue()).to.be.eq("10997503568922305760");
    //      //
    //      // expect(await pool.availableExcessCollatDV()).to.be.eq("3568922305761");
    //      //
    //      // expect(await usdc.balanceOf(pool.address)).to.be.eq("1099750356892230576");
    //      // expect(await fxs.balanceOf(owner.address)).to.be.eq("999999097992218904761904");
    //      //
    //      // await pool.mintFractionalStable(toWei('10'), toWei('10000000000'), 0);
    //      // await pool.buyBackStock(toWei('0.000000000001'), 0);
    //      // expect(await usdc.balanceOf(owner.address)).to.be.eq("999999999988900249643108769424");
    //
    //
    //  });


    async function oraclePrice() {
        await usdcUniswapOracle.update();
        await fraxUniswapOracle.update();
        await fxsUniswapOracle.update();
    }
});
