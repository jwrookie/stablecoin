const $ = require('../Src/common');
const Config = require('./conftest');
const {toWei, fromWei, toBN} = require("web3-utils");
const WETH9 = require("../mock/WETH9.json");
const PancakeFactory = require("../mock/PancakeFactory.json");
const PancakePair = require("../mock/PancakePair.json");
const PancakeRouter = require("../mock/PancakeRouter.json");
const {BigNumber} = require("ethers");
const {time} = require("@openzeppelin/test-helpers");
const {StableCoinPool} = require("../Utils/GetStableConfig");

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
        await weth.deposit({value: toWei("500")});

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

        let _deadline = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        await pancakeRouter.addLiquidity(
            usdc.address, weth.address,
            toWei("2000"), toWei("1"), 0, 0,
            owner.address, _deadline
        );
        await pancakeRouter.addLiquidity(
            fxs.address, weth.address,
            toWei("2000"), toWei("1"), 0, 0,
            owner.address, _deadline
        );
        await pancakeRouter.addLiquidity(
            frax.address, weth.address,
            toWei("2000"), toWei("1"), 0, 0,
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

        await exchangeAMO.setIndex(1, 0);

        await amoMinter.addAMO(exchangeAMO.address, true);
        await exchangeAMO.setAMOMinter(amoMinter.address);
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

        let _deadline = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
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

        let cdbBef = await stablecoinPool.collatDollarBalance();
        expect(cdbBef).to.be.eq(toWei("200"));

        await stablecoinPool.togglePause();
        expect(await stablecoinPool.paused()).to.be.true;

        let cdbAft = await stablecoinPool.collatDollarBalance();
        expect(cdbAft).to.be.eq(0);
        expect(await stablecoinPool.getCollateralPrice()).to.be.eq(0);

        await stablecoinPool.togglePause();
        expect(await stablecoinPool.paused()).to.be.false;
    });

    it('test cr = 0 mint', async () => {
        let _deadline = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
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

    it('test recover', async () => {
        await usdc.transfer(amoMinter.address, toWei("1"));
        await usdc.transfer(exchangeAMO.address, toWei("1"));

        let usdcBef = await usdc.balanceOf(amoMinter.address);
        await amoMinter.recoverERC20(usdc.address, usdcBef);
        let usdcAft = await usdc.balanceOf(amoMinter.address);

        expect(usdcAft).to.be.eq(0);

        let usdcAmoBef = await usdc.balanceOf(exchangeAMO.address);
        await exchangeAMO.recoverERC20(usdc.address, usdcAmoBef);
        let usdcAmoAft = await usdc.balanceOf(exchangeAMO.address);

        expect(usdcAmoAft).to.be.eq(0);
    });

    it('test amoMinter execute', async () => {
        await usdc.transfer(amoMinter.address, toWei("1"));

        let usdcBef = await usdc.balanceOf(amoMinter.address);

        let calldata = web3.eth.abi.encodeFunctionCall({
            name: 'transfer',
            type: 'function',
            inputs: [{type: 'address', name: 'recipient'}, {type: 'uint256', name: 'amount'}]
        }, [_owner.address, usdcBef]);

        await amoMinter.execute(usdc.address, 0, calldata);
        let usdcAft = await usdc.balanceOf(amoMinter.address);

        expect(usdcAft).to.be.eq(0);
    });

    it('test exchangeAMO execute', async () => {
        await usdc.transfer(exchangeAMO.address, toWei("1"));

        let usdcBef = await usdc.balanceOf(exchangeAMO.address);

        let calldata = web3.eth.abi.encodeFunctionCall({
            name: 'transfer',
            type: 'function',
            inputs: [{type: 'address', name: 'recipient'}, {type: 'uint256', name: 'amount'}]
        }, [_owner.address, usdcBef]);

        await exchangeAMO.execute(usdc.address, 0, calldata);
        let usdcAft = await usdc.balanceOf(exchangeAMO.address);

        expect(usdcAft).to.be.eq(0);
    });
});