const $ = require('./common.js');
const Config = require("./conftest.js");
const WETH9 = require("../mock/WETH9.json");
const {toWei, fromWei, toBN} = require("web3-utils");

const PancakeFactory = require("../../test/mock/PancakeFactory.json");
const PancakeRouter = require("../mock/PancakeRouter.json");
const PancakePair = require("../mock/PancakePair.json");

contract('StableCoin', async () => {

    beforeEach(async () => {
        const {
            owner, dev, zeroAddress,
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
        await usdc.mint(owner.address, toWei("1000000"));

        weth = await $.deploy(owner, WETH9.bytecode, WETH9.abi);
        await weth.deposit({value: toWei("1000")});

        const poolLibrary = await PoolLibrary.deploy();
        stablecoinPool = await Config.getStablecoinPool(poolLibrary, checkPermission, frax, fxs, usdc);

        await frax.addPool(stablecoinPool.address);

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

        let _deadline = new Date().getTime() + 1000;
        await pancakeRouter.addLiquidity(
            usdc.address, weth.address,
            toWei("1"), toWei("1"), 0, 0,
            owner.address, _deadline
        );
        await pancakeRouter.addLiquidity(
            fxs.address, weth.address,
            toWei("1"), toWei("1"), 0, 0,
            owner.address, _deadline
        );
        await pancakeRouter.addLiquidity(
            frax.address, weth.address,
            toWei("1"), toWei("1"), 0, 0,
            owner.address, _deadline
        );

        chainLink = await MockChainLink.deploy();
        ETHUSDOracle = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);

        // chainLink.setAnswer(1e18);
        await frax.setETHUSDOracle(ETHUSDOracle.address);

        fxsEthOracle = await Config.getUniswapPairOracle(pancakeFactory, fxs, weth);
        await frax.setStockEthOracle(fxsEthOracle.address, weth.address);

        fraxEthOracle = await Config.getUniswapPairOracle(pancakeFactory, frax, weth);
        await frax.setStableEthOracle(fraxEthOracle.address, weth.address);
    });

    it('test pair', async () => {
        usdc_weth_pair = await pancakeFactory.getPair(usdc.address, weth.address);
        usdc_weth = await pancakePair.attach(usdc_weth_pair);

        expect(usdc_weth_pair).to.be.eq(usdc_weth.address);


        fxs_weth_pair = await pancakeFactory.getPair(fxs.address, weth.address);
        fxs_weth = await pancakePair.attach(fxs_weth_pair);

        expect(fxs_weth_pair).to.be.eq(fxs_weth.address);


        frax_weth_pair = await pancakeFactory.getPair(frax.address, weth.address);
        frax_weth = await pancakePair.attach(frax_weth_pair);

        expect(frax_weth_pair).to.be.eq(frax_weth.address);
    });
});