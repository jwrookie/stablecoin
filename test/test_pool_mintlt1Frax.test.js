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


contract('test pool mint stable', () => {
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

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(operatable.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(operatable.address, "frax", "frax");
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
        pool = await Pool_USDC.deploy(operatable.address, frax.address, fxs.address, usdc.address, toWei('10000000000'));
        expect(await pool.USDC_address()).to.be.eq(usdc.address);


        const MockChainLink = await ethers.getContractFactory("MockChainLink");
        chainLink = await MockChainLink.deploy();

        const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
        chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);
        await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address);

        await chainLink.setAnswer(toWei('100'));

        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('100000000'));
        expect(await frax.balanceOf(owner.address)).to.be.eq(toWei('2000000'));
        await usdc.mint(owner.address, toWei('1'));

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
            toWei('1'),
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
            toWei('1'),
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
            toWei('1'),
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
    it('test mintFractionalStable and redeemFractionalStable', async () => {
        await usdc_uniswapOracle.setPeriod(1);
        await usdc_uniswapOracle.update();
        await frax_uniswapOracle.setPeriod(1);
        await frax_uniswapOracle.update();
        await fxs_uniswapOracle.setPeriod(1);
        await fxs_uniswapOracle.update();

        expect(await frax.stockPrice()).to.be.eq("100000000");
        expect(await frax.globalCollateralRatio()).to.be.eq("1000000");
        await frax.setStableStep("250000");
        await frax.refreshCollateralRatio();
        expect(await frax.globalCollateralRatio()).to.be.eq("750000");
        expect(await usdc.balanceOf(owner.address)).to.be.eq(toWei('1000000000000'));
        expect(await frax.balanceOf(owner.address)).to.be.eq(toWei('1999999'));
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('99999999'));
        expect(await fxs.balanceOf(pool.address)).to.be.eq(0);
        expect(await usdc.balanceOf(pool.address)).to.be.eq(0);

        //  console.log("globalCollateralValue:"+await frax.globalCollateralValue())
        await pool.mintFractionalStable("1000", "1000000000000", 0);
        expect(await usdc.balanceOf(owner.address)).to.be.eq("999999999999999999999999999000");
        expect(await frax.balanceOf(owner.address)).to.be.eq("1999999000000000000133333");
        expect(await fxs.balanceOf(owner.address)).to.be.eq("99999998999999999999999667");
        expect(await fxs.balanceOf(pool.address)).to.be.eq(0);
        expect(await usdc.balanceOf(pool.address)).to.be.eq("1000");
        //
        await pool.redeemFractionalStable("133340", 0, 0);
        expect(await frax.balanceOf(owner.address)).to.be.eq("1999998999999999999999993");
        expect(await usdc.balanceOf(owner.address)).to.be.eq("999999999999999999999999999000");
        expect(await usdc.balanceOf(pool.address)).to.be.eq("1000");
        expect(await fxs.balanceOf(pool.address)).to.be.eq("333");

        expect(await fxs.balanceOf(owner.address)).to.be.eq("99999998999999999999999667");
        expect(await pool.unclaimedPoolCollateral()).to.be.eq("1000");
        expect(await pool.unclaimedPoolStock()).to.be.eq("333");
        expect(await pool.redeemCollateralBalances(owner.address)).to.be.eq("1000");

        await pool.collectRedemption();
        expect(await usdc.balanceOf(owner.address)).to.be.eq("1000000000000000000000000000000");
        expect(await usdc.balanceOf(pool.address)).to.be.eq("0");
        expect(await fxs.balanceOf(pool.address)).to.be.eq(0);

        expect(await fxs.balanceOf(owner.address)).to.be.eq("99999999000000000000000000");
        expect(await pool.unclaimedPoolCollateral()).to.be.eq(0);
        expect(await pool.unclaimedPoolStock()).to.be.eq(0);
        expect(await pool.redeemCollateralBalances(owner.address)).to.be.eq(0);

    });


});
