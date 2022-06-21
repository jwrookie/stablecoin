const $ = require('../Core/common.js');
const Config = require("./conftest.js");
const WETH9 = require("../mock/WETH9.json");
const {toWei, fromWei, toBN} = require("web3-utils");

const PancakeFactory = require("../../test/mock/PancakeFactory.json");
const PancakeRouter = require("../mock/PancakeRouter.json");
const PancakePair = require("../mock/PancakePair.json");
const {time} = require("@openzeppelin/test-helpers");
const {ethers} = require("hardhat");
const {BigNumber} = require("ethers");

contract('StableCoin', async () => {

    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();

        const {
            Stock, RStablecoin, PoolLibrary,
            CheckPermission, Operatable,
            TestOracle, MockChainLink, ChainlinkETHUSDPriceConsumer
        } = await $.setup();

        operatable = await Operatable.deploy();
        checkPermission = await CheckPermission.deploy(operatable.address);

        testOracle = await TestOracle.deploy();
        fxs = await Stock.deploy(checkPermission.address, "fxs", "fxs", testOracle.address);
        frax = await RStablecoin.deploy(checkPermission.address, "frax", "frax");
        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        [usdc] = await $.mockTokenBatch(18, 0, "usdc");
        await usdc.mint(owner.address, toWei("1000000000"));

        weth = await $.deploy(owner, WETH9.bytecode, WETH9.abi);
        await weth.deposit({value: toWei("100")});

        const poolLibrary = await PoolLibrary.deploy();
        stablecoinPool = await Config.getStablecoinPool(poolLibrary, checkPermission, frax, fxs, usdc);

        await frax.addPool(stablecoinPool.address);
        await fxs.addPool(stablecoinPool.address);

        pancakeFactory = await $.deploy(owner, PancakeFactory.bytecode, PancakeFactory.abi, [owner.address]);
        await pancakeFactory.createPair(usdc.address, weth.address);
        await pancakeFactory.createPair(fxs.address, weth.address);
        await pancakeFactory.createPair(frax.address, weth.address);

        pancakePair = await $.deploy(owner, PancakePair.bytecode, PancakePair.abi);

        pancakeRouter = await $.deploy(owner, PancakeRouter.bytecode, PancakeRouter.abi,
            [pancakeFactory.address, weth.address]);
        await usdc.approve(pancakeRouter.address, toWei("1000"));
        await fxs.approve(pancakeRouter.address, toWei("1000"));
        await frax.approve(pancakeRouter.address, toWei("1000"));
        await weth.approve(pancakeRouter.address, toWei("100"));

        let _deadline = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        await pancakeRouter.addLiquidity(
            usdc.address, weth.address,
            toWei("10"), toWei("10"), 0, 0,
            owner.address, _deadline
        );
        await pancakeRouter.addLiquidity(
            fxs.address, weth.address,
            toWei("10"), toWei("10"), 0, 0,
            owner.address, _deadline
        );
        await pancakeRouter.addLiquidity(
            frax.address, weth.address,
            toWei("10"), toWei("10"), 0, 0,
            owner.address, _deadline
        );

        chainLink = await MockChainLink.deploy();
        ETHUSDOracle = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);

        await chainLink.setAnswer(toWei("1"));

        await frax.setETHUSDOracle(ETHUSDOracle.address);

        fxsEthOracle = await Config.getUniswapPairOracle(pancakeFactory, fxs, weth);
        await frax.setStockEthOracle(fxsEthOracle.address, weth.address);

        fraxEthOracle = await Config.getUniswapPairOracle(pancakeFactory, frax, weth);
        await frax.setStableEthOracle(fraxEthOracle.address, weth.address);

        usdcEthOracle = await Config.getUniswapPairOracle(pancakeFactory, usdc, weth);
        await stablecoinPool.setCollatETHOracle(usdcEthOracle.address, weth.address);
    });

    it('test pair', async () => {
        let usdc_weth_pair = await pancakeFactory.getPair(usdc.address, weth.address);
        let usdc_weth = await pancakePair.attach(usdc_weth_pair);

        expect(usdc_weth_pair).to.be.eq(usdc_weth.address);


        let fxs_weth_pair = await pancakeFactory.getPair(fxs.address, weth.address);
        let fxs_weth = await pancakePair.attach(fxs_weth_pair);

        expect(fxs_weth_pair).to.be.eq(fxs_weth.address);


        let frax_weth_pair = await pancakeFactory.getPair(frax.address, weth.address);
        let frax_weth = await pancakePair.attach(frax_weth_pair);

        expect(frax_weth_pair).to.be.eq(frax_weth.address);
    });

    it('test maxCR and setK', async () => {
        let stablePriceBef = await frax.stablePrice();
        let CRBef = await frax.globalCollateralRatio();

        let _deadline = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        await pancakeRouter.swapExactTokensForTokens(
            toWei('1'),
            0,
            [weth.address, frax.address],
            owner.address,
            _deadline
        );
        await time.increase(time.duration.hours(1));
        await fraxEthOracle.update();
        await fxsEthOracle.update();
        await usdcEthOracle.update();
        await frax.refreshCollateralRatio();

        let stablePriceAft = await frax.stablePrice();
        let CRAft = await frax.globalCollateralRatio();

        expect(stablePriceAft).to.be.gt(stablePriceBef);
        expect(CRAft).to.be.eq(BigNumber.from(CRBef).sub(2500));

        await usdc.approve(stablecoinPool.address, toWei("20000000"));
        await fxs.approve(stablecoinPool.address, toWei("2000000"));
        await frax.approve(stablecoinPool.address, toWei("20000000"));

        expect(await frax.totalSupply()).eq(toWei("2000000"));
        expect(await frax.maxCR()).eq(1e6);

        await wait();

        let fraxOwnerBef = await frax.balanceOf(owner.address);
        await stablecoinPool.mintFractionalStable(toWei("20000000"), toWei("2000000"), 0);

        let fraxOwnerAft = await frax.balanceOf(owner.address);
        let diff = BigNumber.from(fraxOwnerAft).sub(BigNumber.from(fraxOwnerBef));

        await frax.refreshCollateralRatio();
        expect(diff).to.be.gt(toWei("20000000"));
        expect(await frax.maxCR()).eq(998001);

        await wait();

        await stablecoinPool.redeemFractionalStable(toWei("10000000"), 0, 0);
        await frax.refreshCollateralRatio();
        expect(await frax.maxCR()).eq(999000);

        await wait();

        await frax.setKAndKDuration(1e2, toWei("10000"));

        await stablecoinPool.redeemFractionalStable(toWei("10001"), 0, 0);
        await frax.refreshCollateralRatio();
        expect(await frax.maxCR()).eq(999099);

        await wait();

        await frax.setKAndKDuration(1e4, toWei("10000"));

        await stablecoinPool.redeemFractionalStable(toWei("10001"), 0, 0);
        await frax.refreshCollateralRatio();
        expect(await frax.maxCR()).eq(1e6);
    });

    async function wait() {
        await time.increase(time.duration.hours(1));
        await fraxEthOracle.update();
        await fxsEthOracle.update();
        await usdcEthOracle.update();
    }
});