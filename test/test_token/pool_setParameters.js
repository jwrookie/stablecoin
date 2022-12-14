const {ethers} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {GetMockToken} = require("../util/GetMockConfig");
const {GetRusdAndTra, StableCoinPool} = require("../util/GetStableConfig");
const {
    DeployThreePoolFactoryAndPancakeFactory,
    DeployThreePoolByThreePoolFactory
} = require("../util/GetThreePoolAndPancakePoolConfig");
const {
    GetUniswapByPancakeFactory,
    AddLiquidityByPancakeRouter,
    SetETHUSDOracle
} = require("../util/GetUniswapConfig");

contract('pool setParameter', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        [rusd, tra, , checkOpera] = await GetRusdAndTra();

        [usdc, token0, token1] = await GetMockToken(3, [owner, dev], toWei("100000000000"));
        stableCoinPool = await StableCoinPool(usdc.address, toWei('10000000000'));

        await SetETHUSDOracle(rusd, toWei("100"));
        [weth, factory, threePoolFactory, threePool, router] = await DeployThreePoolFactoryAndPancakeFactory(owner, {value: toWei("100")});
        pool = await DeployThreePoolByThreePoolFactory(threePoolFactory, threePool, [usdc.address, rusd.address, token1.address]);

        await AddLiquidityByPancakeRouter(factory, [usdc, weth], router, toWei("1000"), [toWei("1"), toWei("0.1")], owner);
        await AddLiquidityByPancakeRouter(factory, [rusd, weth], router, toWei("1000"), [toWei("1"), toWei("0.1")], owner);
        await AddLiquidityByPancakeRouter(factory, [tra, weth], router, toWei("1000"), [toWei("1"), toWei("0.1")], owner);

        usdcUniswapOracle = await GetUniswapByPancakeFactory(factory.address, [usdc.address, weth.address]);
        await stableCoinPool.setCollatETHOracle(usdcUniswapOracle.address, weth.address);
        fraxUniswapOracle = await GetUniswapByPancakeFactory(factory.address, [rusd.address, weth.address]);
        await rusd.setStableEthOracle(fraxUniswapOracle.address, weth.address);
        fxsUniswapOracle = await GetUniswapByPancakeFactory(factory.address, [tra.address, weth.address]);
        await rusd.setStockEthOracle(fxsUniswapOracle.address, weth.address);


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
    it("the user did not set mintingFee and redemptionFee", async () => {
        await oraclePrice();
        await rusd.refreshCollateralRatio();
        globalCollateralRatio = await rusd.globalCollateralRatio();

        let befRusdOwner = await rusd.balanceOf(owner.address);
        expect(befRusdOwner).to.be.eq("1999999000000000000000000");

        await expect(stableCoinPool.mintFractionalStable(toWei('100000000000'), toWei('100000000001'), 0)).to.be.revertedWith("Pool ceiling reached, no more FRAX can be minted with this collateral");

        await stableCoinPool.mintFractionalStable(toWei('1'), toWei('1'), 0);
        let aftRusdOwner = await rusd.balanceOf(owner.address);
        expect(aftRusdOwner).to.be.eq("2000009025062656641604010");

        let diffRusd = aftRusdOwner.sub(befRusdOwner);
        expect(diffRusd).to.be.eq("10025062656641604010");

        await stableCoinPool.redeemFractionalStable(toWei('1'), toWei('0.0000001'), 0);

        let aft1RusdOwner = await rusd.balanceOf(owner.address);

        expect(aft1RusdOwner).to.be.eq("2000008025062656641604010");
        let diffRusdAft = aftRusdOwner.sub(aft1RusdOwner);
        expect(diffRusdAft).to.be.eq("1000000000000000000");


    });

    it("the user set mintingFee and redemptionFee", async () => {
        await stableCoinPool.setPoolParameters(
            toWei('100000000000'),
            "7500",
            1,
            "5000",
            "5000",
            0,
            0
        );
        expect(await stableCoinPool.poolCeiling()).to.be.eq(toWei("100000000000"));
        expect(await stableCoinPool.bonusRate()).to.be.eq("7500");
        expect(await stableCoinPool.redemptionDelay()).to.be.eq(1);
        expect(await stableCoinPool.mintingFee()).to.be.eq("5000");
        expect(await stableCoinPool.redemptionFee()).to.be.eq("5000");
        await oraclePrice();
        await rusd.refreshCollateralRatio();

        let befRusdOwner = await rusd.balanceOf(owner.address);
        expect(befRusdOwner).to.be.eq("1999999000000000000000000");

        await stableCoinPool.mintFractionalStable(toWei('1'), toWei('1'), 0);
        let aftRusdOwner = await rusd.balanceOf(owner.address);
        expect(aftRusdOwner).to.be.eq("2000008974937343358395989");
        let diffRusd = aftRusdOwner.sub(befRusdOwner);
        expect(diffRusd).to.be.eq("9974937343358395989");

        await stableCoinPool.redeemFractionalStable(toWei('1'), toWei('0.0000001'), 0);

        let aft1RusdOwner = await rusd.balanceOf(owner.address);

        expect(aft1RusdOwner).to.be.eq("2000007974937343358395989");
        let diffRusdAft = aftRusdOwner.sub(aft1RusdOwner);
        expect(diffRusdAft).to.be.eq("1000000000000000000");

    });
    it("the user did not set recollatFee", async () => {
        await oraclePrice();
        await rusd.refreshCollateralRatio();

        let befTraOwner = await tra.balanceOf(owner.address);

        await stableCoinPool.recollateralizeStable(toWei('1000'), "10");
        let aftTraOwner = await tra.balanceOf(owner.address);

        let diffTra = aftTraOwner.sub(befTraOwner);
        expect(diffTra).to.be.eq("1007500000000000000000");


    });
    it("the user set recollatFee", async () => {
        await stableCoinPool.setPoolParameters(
            toWei('100000000000'),
            "7500",
            1,
            0,
            0,
            0,
            "5000"
        );
        expect(await stableCoinPool.recollatFee()).to.be.eq("5000");
        await oraclePrice();
        await rusd.refreshCollateralRatio();

        let befTraOwner = await tra.balanceOf(owner.address);

        await stableCoinPool.recollateralizeStable(toWei('1000'), "10");
        let aftTraOwner = await tra.balanceOf(owner.address);

        let diffTra = aftTraOwner.sub(befTraOwner);
        expect(diffTra).to.be.eq("1002500000000000000000");


    });

    it("the user set buybackFee", async () => {
        await stableCoinPool.setPoolParameters(
            toWei('100000000000'),
            "7500",
            1,
            0,
            0,
            "5000",
            0
        );
        expect(await stableCoinPool.buybackFee()).to.be.eq("5000");
        await oraclePrice();
        await rusd.refreshCollateralRatio();
        await rusd.burn(toWei('1999999'));

        await stableCoinPool.mintFractionalStable(toWei('1'), toWei('1'), 0);

        await stableCoinPool.recollateralizeStable(toWei('1'), "10");

        let befUsdcOwner = await usdc.balanceOf(owner.address);
        expect(befUsdcOwner).to.be.eq("99999999998900249643107769424");


        await stableCoinPool.buyBackStock(toWei('0.0000001'), 0);
        let aftUsdcOwner = await usdc.balanceOf(owner.address);
        expect(aftUsdcOwner).to.be.eq("99999999998900249742607769424");

        let diffUsdc = aftUsdcOwner.sub(befUsdcOwner);
        expect(diffUsdc).to.be.eq("99500000000");


    });


    async function oraclePrice() {
        await usdcUniswapOracle.update();
        await fraxUniswapOracle.update();
        await fxsUniswapOracle.update();
    }
});
