const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const Factory = require('../test/mock/PancakeFactory.json');
const Pair = require('../test/mock/PancakePair.json');
const Router = require('../test/mock/PancakeRouter.json');
const WETH = require('../test/mock/WETH9.json');
const {BigNumber} = require('ethers');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');


function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}


contract('Pool_USDC', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        const TestERC20 = await ethers.getContractFactory('TestERC20');
        usdc = await TestERC20.deploy();
        busd = await TestERC20.deploy();
        weth = await deployContract(owner, {
            bytecode: WETH.bytecode,
            abi: WETH.abi,
        });

        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const Timelock = await ethers.getContractFactory('Timelock');
        timelock = await Timelock.deploy(owner.address, "259200");

        Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();
        const CheckPermission = await ethers.getContractFactory("CheckPermission");
        checkPermission = await CheckPermission.deploy(operatable.address);

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(checkPermission.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(checkPermission.address, "frax", "frax");
        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        expect(await fxs.oracle()).to.be.eq(oracle.address);
        expect(await frax.stockAddress()).to.be.eq(fxs.address);

        const PoolLibrary = await ethers.getContractFactory('PoolLibrary')
        poolLibrary = await PoolLibrary.deploy();

        const Pool_USDC = await ethers.getContractFactory('Pool_USDC', {
            libraries: {
                PoolLibrary: poolLibrary.address,
            },
        });
        pool = await Pool_USDC.deploy(checkPermission.address, frax.address, fxs.address, usdc.address, toWei('10000000000'));
        expect(await pool.USDC_address()).to.be.eq(usdc.address);


        const MockChainLink = await ethers.getContractFactory("MockChainLink");
        chainLink = await MockChainLink.deploy();

        const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
        chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);
        await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address);

        await chainLink.setAnswer(toWei('100'));

        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('1000000'));
        expect(await frax.balanceOf(owner.address)).to.be.eq(toWei('2000000'));
        await frax.approve(pool.address, toWei('10000000000'));
        await fxs.approve(pool.address, toWei('10000000000'));
        await usdc.approve(pool.address, toWei('10000000000'));
        await frax.addPool(pool.address);

        factory = await deployContract(owner, {
            bytecode: Factory.bytecode,
            abi: Factory.abi
        }, [owner.address]);
        // console.log("factory:" + factory.address)

        pair = await deployContract(owner, {
            bytecode: Pair.bytecode,
            abi: Pair.abi
        });

        router = await deployContract(owner, {
            bytecode: Router.bytecode,
            abi: Router.abi
        }, [factory.address, weth.address]);
        // console.log("router:" + router.address);

        await factory.createPair(usdc.address, weth.address);
        pairAddr = await factory.getPair(usdc.address, weth.address);

        await factory.createPair(frax.address, weth.address);
        await factory.createPair(fxs.address, weth.address);
        // console.log("pair:" + pairAddr);
        usdc_busd = await pair.attach(pairAddr);
        expect(usdc_busd.address).to.be.eq(pairAddr);

        await usdc.approve(router.address, toWei('1000'));
        await weth.approve(router.address, toWei('1000'));
        await usdc.mint(owner.address, toWei('1000000000000'));
        //await busd.mint(owner.address, toWei('100'));
        await weth.deposit({value: toWei('100')});
        expect(await weth.balanceOf(owner.address)).to.be.eq(toWei('100'));

        await router.addLiquidity(
            usdc.address,
            weth.address,
            toWei('1'),
            toWei('0.1'),
            0,
            0,
            owner.address,
            Math.round(new Date().getTime() + 1000)
        );

        await frax.approve(router.address, toWei('1000'));

        await router.addLiquidity(
            frax.address,
            weth.address,
            toWei('1'),
            toWei('0.1'),
            0,
            0,
            owner.address,
            Math.round(new Date().getTime() + 1000)
        );

        await fxs.approve(router.address, toWei('1000'));
        await router.addLiquidity(
            fxs.address,
            weth.address,
            toWei('1'),
            toWei('0.1'),
            0,
            0,
            owner.address,
            Math.round(new Date().getTime() + 1000)
        );

        const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
        usdc_uniswapOracle = await UniswapPairOracle.deploy(factory.address, usdc.address, weth.address, owner.address, timelock.address);
        await pool.setCollatETHOracle(usdc_uniswapOracle.address, weth.address);

        frax_uniswapOracle = await UniswapPairOracle.deploy(factory.address, frax.address, weth.address, owner.address, timelock.address);
        await frax.setStableEthOracle(frax_uniswapOracle.address, weth.address);
        expect(await frax.stableEthOracleAddress()).to.be.eq(frax_uniswapOracle.address);

        fxs_uniswapOracle = await UniswapPairOracle.deploy(factory.address, fxs.address, weth.address, owner.address, timelock.address);
        await frax.setStockEthOracle(fxs_uniswapOracle.address, weth.address);
        expect(await frax.stockEthOracleAddress()).to.be.eq(fxs_uniswapOracle.address);

        await fxs.addPool(pool.address);

    });
    it("frax price >1, the collateral ratio decreased", async () => {
        await usdc_uniswapOracle.setPeriod(1);
        await frax_uniswapOracle.setPeriod(1);
        await fxs_uniswapOracle.setPeriod(1);
        await frax.setRefreshCooldown(1);
        await oraclePrice();

        await frax.refreshCollateralRatio();
        let ratio = 1000000;

        expect(await frax.globalCollateralRatio()).to.be.eq(ratio - 2500);

        await frax.refreshCollateralRatio();
        expect(await frax.globalCollateralRatio()).to.be.eq(ratio - 5000);


    });
    it("frax price < 1, the collateral ratio increases", async () => {
        await usdc_uniswapOracle.setPeriod(1);
        await frax_uniswapOracle.setPeriod(1);
        await fxs_uniswapOracle.setPeriod(1);
        await frax.setRefreshCooldown(1);
        await oraclePrice();

        await frax.refreshCollateralRatio();
        let ratio = 1000000;

        expect(await frax.globalCollateralRatio()).to.be.eq(ratio - 2500);

        let times = Number((new Date().getTime() / 1000 + 2600000).toFixed(0));
        for (let i = 0; i < 5; i++) {
            await router.swapExactTokensForTokens(
                toWei('1'),
                1,
                [frax.address, weth.address],
                owner.address,
                times
            )
            await oraclePrice();
            await frax.refreshCollateralRatio();
        };

        expect(await frax.globalCollateralRatio()).to.be.eq(ratio);


    });
    it("re mortgage will exceed the pool limit", async () => {
        await usdc_uniswapOracle.setPeriod(1);
        await frax_uniswapOracle.setPeriod(1);
        await fxs_uniswapOracle.setPeriod(1);
        await oraclePrice();

        expect(await pool.poolCeiling()).to.be.eq(toWei('10000000000'))

        await frax.refreshCollateralRatio();

        //console.log("usdc:"+await usdc.balanceOf(owner.address))
        let bef = await usdc.balanceOf(owner.address)
        //  await pool.recollateralizeStable(toWei('1'), "100");
        await pool.recollateralizeStable(toWei('100000'), "100");

        // await pool.recollateralizeStable(toWei('10000000000'), "100");
        let aft = await usdc.balanceOf(owner.address)
        //console.log("usdc:"+await usdc.balanceOf(owner.address))
        //   let amount = toWei('10000000001')
        let diff = bef.sub(aft)
        let amount = toWei('100000')

        expect(amount).to.be.eq(diff)

        // expect(await frax.globalCollateralRatio()).to.be.eq("997500");
        // expect(await frax.globalCollateralValue()).to.be.eq("10997503568922305760");
        //
        // expect(await pool.availableExcessCollatDV()).to.be.eq("3568922305761");
        //
        // expect(await usdc.balanceOf(pool.address)).to.be.eq("1099750356892230576");
        // expect(await fxs.balanceOf(owner.address)).to.be.eq("999999097992218904761904");
        //
        // await pool.mintFractionalStable(toWei('10'), toWei('10000000000'), 0);
        // await pool.buyBackStock(toWei('0.000000000001'), 0);
        // expect(await usdc.balanceOf(owner.address)).to.be.eq("999999999988900249643108769424");


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
        await usdc_uniswapOracle.update();
        await frax_uniswapOracle.update();
        await fxs_uniswapOracle.update();
    }
});
