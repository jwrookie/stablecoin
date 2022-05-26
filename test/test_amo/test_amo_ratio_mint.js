const $ = require('../../test/Core/common');
const Config = require('./conftest');
const {toWei, fromWei, toBN} = require("web3-utils");
const WETH9 = require("../mock/WETH9.json");
const PancakeFactory = require("../mock/PancakeFactory.json");
const PancakePair = require("../mock/PancakePair.json");
const PancakeRouter = require("../mock/PancakeRouter.json");
const {BigNumber} = require("ethers");
const {time} = require("@openzeppelin/test-helpers");

contract('ExchangeAMO', async () => {

    let _owner;
    let _dev;

    beforeEach(async () => {
        const {
            owner, dev, zeroAddress,
            Stock, RStablecoin, PoolLibrary,
            CheckPermission, Operatable,
            TestOracle, MockChainLink, ChainlinkETHUSDPriceConsumer,
            ExchangeAMO, AMOMinter
        } = await $.setup();
        _owner = owner;
        _dev = dev;

        operatable = await Operatable.deploy();
        checkPermission = await CheckPermission.deploy(operatable.address);

        testOracle = await TestOracle.deploy();
        fxs = await Stock.deploy(checkPermission.address, "fxs", "fxs", testOracle.address);
        frax = await RStablecoin.deploy(checkPermission.address, "frax", "frax");
        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        [usdc, usdt] = await $.mockTokenBatch(18, 0, "usdc", "usdt");
        await usdc.mint(owner.address, toWei("1000000"));
        await usdt.mint(owner.address, toWei("1000000"));

        weth = await $.deploy(owner, WETH9.bytecode, WETH9.abi);
        await weth.deposit({value: toWei("1000")});

        const poolLibrary = await PoolLibrary.deploy();
        stablecoinPool = await Config.getStablecoinPool(poolLibrary, checkPermission, frax, fxs, usdc);

        await frax.addPool(stablecoinPool.address);
        await fxs.addPool(stablecoinPool.address);

        pancakeFactory = await $.deploy(owner, PancakeFactory.bytecode, PancakeFactory.abi, [owner.address]);
        await pancakeFactory.createPair(usdc.address, weth.address);
        await pancakeFactory.createPair(fxs.address, weth.address);
        await pancakeFactory.createPair(frax.address, weth.address);

        pancakePair = await $.deploy(owner, PancakePair.bytecode, PancakePair.abi);

        pancakeRouter = await $.deploy(owner, PancakeRouter.bytecode, PancakeRouter.abi, [pancakeFactory.address, weth.address]);

        await usdc.approve(pancakeRouter.address, toWei("100000"));
        await fxs.approve(pancakeRouter.address, toWei("100000"));
        await frax.approve(pancakeRouter.address, toWei("100000"));
        await weth.approve(pancakeRouter.address, toWei("10000"));

        let _deadline = new Date().getTime() + 1000;
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
        ETHUSDOracle = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);

        await chainLink.setAnswer(toWei("2000"));

        await frax.setETHUSDOracle(ETHUSDOracle.address);

        fxsEthOracle = await Config.getUniswapPairOracle(pancakeFactory, fxs, weth);
        await frax.setStockEthOracle(fxsEthOracle.address, weth.address);

        fraxEthOracle = await Config.getUniswapPairOracle(pancakeFactory, frax, weth);
        await frax.setStableEthOracle(fraxEthOracle.address, weth.address);

        usdcEthOracle = await Config.getUniswapPairOracle(pancakeFactory, usdc, weth);
        await stablecoinPool.setCollatETHOracle(usdcEthOracle.address, weth.address);

        pool3 = await Config.getPlain3Pool(frax, usdc, usdt);

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

        exchangeAMO = await ExchangeAMO.deploy(
            checkPermission.address,
            amoMinter.address,
            frax.address,
            fxs.address,
            usdc.address,
            pool3.address,
            pool3.address,
            1, 0);

        amoMinter.addAMO(exchangeAMO.address, true);
    });

    it('test price', async () => {
        let stablePrice = await frax.stablePrice();
        let stockPrice = await frax.stockPrice();
        let ethUsdPrice = await frax.ethUsdPrice();
        let cr = await frax.globalCollateralRatio();

        expect(stablePrice).to.be.eq(toWei("1", "mwei"));
        expect(stockPrice).to.be.eq(toWei("1", "mwei"));
        expect(ethUsdPrice).to.be.eq(toWei("2000", "mwei"));
        expect(cr).to.be.eq(toWei("1", "mwei"));

        let data = await frax.stableInfo();

        expect(data[2]).to.be.eq(toWei("2000000"));

        await frax.setMintingFee(3e3);
        await frax.setRedemptionFee(3e3);

        data = await frax.stableInfo();

        expect(data[5]).to.be.eq(3e3);
        expect(data[6]).to.be.eq(3e3);
    });

    it('test cr = 1 mint', async () => {
        let usdcOwnerBef = await usdc.balanceOf(_owner.address);
        let fraxOwnerBef = await frax.balanceOf(_owner.address);
        let fxsOwnerBef = await fxs.balanceOf(_owner.address);

        await usdc.approve(stablecoinPool.address, toWei("10000"));
        await stablecoinPool.mint1t1Stable(toWei("1000"), 0);

        let usdcOwnerAft = await usdc.balanceOf(_owner.address);
        let fraxOwnerAft = await frax.balanceOf(_owner.address);
        let fxsOwnerAft = await fxs.balanceOf(_owner.address);

        expect(usdcOwnerAft).to.be.eq(BigNumber.from(usdcOwnerBef).sub(toWei("1000")));
        expect(fraxOwnerAft).to.be.eq(BigNumber.from(fraxOwnerBef).add(toWei("1000")));
        expect(fxsOwnerAft).to.be.eq(fxsOwnerBef);
    });

    it('test cr ≠ 1 mint', async () => {
        let stablePriceBef = await frax.stablePrice();
        let CRBef = await frax.globalCollateralRatio();

        let _deadline = new Date().getTime() + 1000;
        await pancakeRouter.swapExactTokensForTokens(
            toWei('1'),
            0,
            [weth.address, frax.address],
            _owner.address,
            _deadline
        );
        await time.increase(time.duration.hours(1));
        await fraxEthOracle.update();
        await frax.refreshCollateralRatio();

        let stablePriceAft = await frax.stablePrice();
        let CRAft = await frax.globalCollateralRatio();

        expect(stablePriceAft).to.be.gt(stablePriceBef);
        expect(CRAft).to.be.eq(BigNumber.from(CRBef).sub(2500));

        $.log("stablePrice", stablePriceAft / 1e6);
        $.log("cr", CRAft / 1e6);

        let usdcOwnerBef = await usdc.balanceOf(_owner.address);
        let fraxOwnerBef = await frax.balanceOf(_owner.address);
        let fxsOwnerBef = await fxs.balanceOf(_owner.address);

        await usdc.approve(stablecoinPool.address, toWei("10000"));
        await fxs.approve(stablecoinPool.address, toWei("10000"));

        let _stockAmount = BigNumber.from(toWei("200")).mul(1e6 - CRAft);
        await stablecoinPool.mintFractionalStable(toWei("200"), _stockAmount, 0);

        let usdcOwnerAft = await usdc.balanceOf(_owner.address);
        let fraxOwnerAft = await frax.balanceOf(_owner.address);
        let fxsOwnerAft = await fxs.balanceOf(_owner.address);

        expect(usdcOwnerAft).to.be.eq(BigNumber.from(usdcOwnerBef).sub(toWei("200")));
        expect(fraxOwnerAft).to.be.eq(BigNumber.from(fraxOwnerBef).add(toWei("200")).add(BigNumber.from(fxsOwnerBef).sub(fxsOwnerAft)));
    });

    it('test cr = 0 mint', async () => {
        let _deadline = new Date().getTime() + 1000;
        await pancakeRouter.swapExactTokensForTokens(
            toWei('100'),
            0,
            [weth.address, frax.address],
            _owner.address,
            _deadline
        );

        await time.increase(time.duration.hours(1));
        await fraxEthOracle.update();
        await frax.refreshCollateralRatio();

        let stablePriceBef = await frax.stablePrice();
        let CRBef = await frax.globalCollateralRatio();

        $.log("stablePriceBef", stablePriceBef / 1e6);
        $.log("CRBef", CRBef / 1e6);

        await frax.setStableStep(1e5);

        let cr, flag = true, i = 0;
        while (flag) {
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

            cr = await frax.globalCollateralRatio();
            if (parseInt(cr) === 0 || ++i >= 10000) {
                flag = false;
            }
        }
        let stablePriceAft = await frax.stablePrice();
        let CRAft = await frax.globalCollateralRatio();
        $.log("stablePriceAft", stablePriceAft / 1e6);
        $.log("CRAft", CRAft / 1e6);

        expect(CRAft).to.be.eq(0);

        let usdcOwnerBef = await usdc.balanceOf(_owner.address);
        let fraxOwnerBef = await frax.balanceOf(_owner.address);
        let fxsOwnerBef = await fxs.balanceOf(_owner.address);

        await fxsEthOracle.update();

        await fxs.approve(stablecoinPool.address, toWei("10000"));
        await stablecoinPool.mintAlgorithmicStable(toWei("100"), 0);

        let usdcOwnerAft = await usdc.balanceOf(_owner.address);
        let fraxOwnerAft = await frax.balanceOf(_owner.address);
        let fxsOwnerAft = await fxs.balanceOf(_owner.address);

        expect(usdcOwnerAft).to.be.eq(usdcOwnerBef);
        expect(fraxOwnerAft).to.be.eq(BigNumber.from(fraxOwnerBef).add(toWei("100")));
        expect(fxsOwnerAft).to.be.eq(BigNumber.from(fxsOwnerBef).sub(toWei("100")));
    });
});