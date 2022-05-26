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
        await usdc.mint(owner.address, toWei("100000000"));
        await usdt.mint(owner.address, toWei("100000000"));

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

    it('test cr > 0.95, without collateral invest', async () => {
        let db = await amoMinter.dollarBalances();
        expect(db[0]).to.be.eq(0);
        expect(db[1]).to.be.eq(0);

        let cr = await frax.globalCollateralRatio();
        expect(cr).to.be.eq(toWei("1", "mwei"));

        // await frax.setStableStep(1e4);

        let _deadline = new Date().getTime() + 1000;
        for (let i = 0; i < 10; i++) {
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
        }
        await fxsEthOracle.update();
        await usdcEthOracle.update();

        cr = await frax.globalCollateralRatio();

        expect(cr).to.be.gt(await amoMinter.minCR());

        await usdc.approve(stablecoinPool.address, toWei("100000000"));
        await fxs.approve(stablecoinPool.address, toWei("100000000"));

        let _stockAmount = BigNumber.from(toWei("80000000")).mul(1e6 - cr);
        await stablecoinPool.mintFractionalStable(toWei("80000000"), _stockAmount, 0);

        let cv = await frax.globalCollateralValue();
        expect(cv).to.be.eq(toWei("80000000"));

        let usdcAmoBef = await usdc.balanceOf(exchangeAMO.address);
        let fraxAmoBef = await frax.balanceOf(exchangeAMO.address);
        let fxsAmoBef = await fxs.balanceOf(exchangeAMO.address);

        await frax.addPool(amoMinter.address);
        await amoMinter.mintStableForAMO(exchangeAMO.address, toWei("200"));

        let usdcAmoAft = await usdc.balanceOf(exchangeAMO.address);
        let fraxAmoAft = await frax.balanceOf(exchangeAMO.address);
        let fxsAmoAft = await fxs.balanceOf(exchangeAMO.address);

        expect(usdcAmoAft).to.be.eq(usdcAmoBef);
        expect(fraxAmoAft).to.be.eq(BigNumber.from(fraxAmoBef).add(toWei("200")));
        expect(fxsAmoAft).to.be.eq(fxsAmoBef);

        let rate = await exchangeAMO.stableDiscountRate();
        // $.log("rate", rate / 1e6);

        let dbAft = await amoMinter.dollarBalances();
        expect(dbAft[0]).to.be.eq(toWei("200"));
        expect(dbAft[1]).to.be.eq(BigNumber.from(toWei("200")).mul(rate).div(1e6));

        // deposit
        let lpAmoBef = await pool3.balanceOf(exchangeAMO.address, {gasLimit: "9500000"});
        await exchangeAMO.poolDeposit(toWei("100"), 0, {gasLimit: "9500000"});
        let lpAmoAft = await pool3.balanceOf(exchangeAMO.address, {gasLimit: "9500000"});

        expect(lpAmoAft).to.be.gt(lpAmoBef);

        // withdraw stable without burn
        let fraxAmoAft1 = await frax.balanceOf(exchangeAMO.address);

        await exchangeAMO.poolWithdrawStable(toWei("10"), false);
        let fraxAmoAft2 = await frax.balanceOf(exchangeAMO.address);

        expect(fraxAmoAft2).to.be.gt(fraxAmoAft1);

        // withdraw stable with burn
        await exchangeAMO.poolWithdrawStable(toWei("10"), true);
        let fraxAmoAft3 = await frax.balanceOf(exchangeAMO.address);

        expect(fraxAmoAft3).to.be.eq(fraxAmoAft2);

        // withdraw collateral
        let usdcAmoAft1 = await usdc.balanceOf(exchangeAMO.address);
        await exchangeAMO.poolWithdrawCollateral(toWei("10"));
        let usdcAmoAft2 = await usdc.balanceOf(exchangeAMO.address);

        expect(usdcAmoAft2).to.be.gt(usdcAmoAft1);

        // data
        let data = await exchangeAMO.showAllocations();
        $.log("data_0", fromWei(toBN(data[0])));
        $.log("data_1", fromWei(toBN(data[1])));
        $.log("data_2", fromWei(toBN(data[2])));
        $.log("data_3", fromWei(toBN(data[3])));
        $.log("data_4", fromWei(toBN(data[4])));
        $.log("data_5", fromWei(toBN(data[5])));
        $.log("data_6", fromWei(toBN(data[6])));
        $.log("data_7", fromWei(toBN(data[7])));
        $.log("data_8", fromWei(toBN(data[8])));

        expect(data[0]).to.be.eq(toWei("110.020486475649728004"));
        expect(data[3]).to.be.eq(toWei("9.982502180553633868"));
        expect(data[7]).to.be.eq(toWei("69.857320000864925392"));
    });
});