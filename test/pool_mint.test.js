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


contract('pool mint test', () => {
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

        const Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();
        const CheckPermission = await ethers.getContractFactory("CheckPermission");
        checkPermission = await CheckPermission.deploy(operatable.address);

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(checkPermission.address, "fxs", "fxs", oracle.address);
        await fxs.transfer(addr1.address, "299000000000000000000000000");
        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(checkPermission.address, "frax", "frax");
        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        expect(await fxs.oracle()).to.be.eq(oracle.address);
        expect(await frax.stockAddress()).to.be.eq(fxs.address);

        const PoolLibrary = await ethers.getContractFactory('PoolLibrary')
        poolLibrary = await PoolLibrary.deploy();

        const PoolUSD = await ethers.getContractFactory('PoolUSD', {
            libraries: {
                PoolLibrary: poolLibrary.address,
            },
        });
        pool = await PoolUSD.deploy(checkPermission.address, frax.address, fxs.address, usdc.address, toWei('10000000000'));
        expect(await pool.usdAddress()).to.be.eq(usdc.address);


        const MockChainLink = await ethers.getContractFactory("MockChainLink");
        chainLink = await MockChainLink.deploy();

        const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
        chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);
        expect(await chainlinkETHUSDPriceConsumer.getDecimals()).to.be.eq(18);
        await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address);

        await chainLink.setAnswer(toWei('100'));

        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('1000000'));
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
        usdc_uniswapOracle = await UniswapPairOracle.deploy(factory.address, usdc.address, weth.address);
        await pool.setCollatETHOracle(usdc_uniswapOracle.address, weth.address);

        frax_uniswapOracle = await UniswapPairOracle.deploy(factory.address, frax.address, weth.address);
        await frax.setStableEthOracle(frax_uniswapOracle.address, weth.address);
        expect(await frax.stableEthOracleAddress()).to.be.eq(frax_uniswapOracle.address);

        fxs_uniswapOracle = await UniswapPairOracle.deploy(factory.address, fxs.address, weth.address);
        await frax.setStockEthOracle(fxs_uniswapOracle.address, weth.address);
        expect(await frax.stockEthOracleAddress()).to.be.eq(fxs_uniswapOracle.address);

        expect(await fxs.stablePoolAddressCount()).to.be.eq(0);
        await fxs.addPool(pool.address);

        expect(await fxs.getPoolAddress(0)).to.be.eq(pool.address);
        expect(await fxs.stablePoolAddressCount()).to.be.eq(1);

    });
    it('test mint1t1Stable and redeem1t1Stable  ', async () => {
        expect(await frax.ethUsdPrice()).to.be.eq("100000000");
        expect(await usdc_uniswapOracle.price0Average()).to.be.eq(0);
        expect(await usdc_uniswapOracle.price1Average()).to.be.eq(0);

        await usdc_uniswapOracle.setPeriod(1);
        await usdc_uniswapOracle.update();

        expect(await pool.getCollateralPrice()).to.be.eq("100000000");

        expect(await usdc.balanceOf(owner.address)).to.be.eq(toWei('1000000000000'));
        expect(await frax.balanceOf(owner.address)).to.be.eq(toWei('1999999'));
        expect(await usdc.balanceOf(pool.address)).to.be.eq(0);

        await expect(pool.mint1t1Stable(toWei('10000000001'), 0)).to.be
            .revertedWith("[Pool's Closed]: Ceiling reached");
        await pool.mint1t1Stable("1000", 0);
        expect(await usdc.balanceOf(owner.address)).to.be.eq("999999999999999999999999999000");
        expect(await frax.balanceOf(owner.address)).to.be.eq("1999999000000000000100000");
        expect(await usdc.balanceOf(pool.address)).to.be.eq("1000");

        await pool.redeem1t1Stable("100000", 0);
        expect(await usdc.balanceOf(owner.address)).to.be.eq("999999999999999999999999999000");
        expect(await frax.balanceOf(owner.address)).to.be.eq("1999999000000000000000000");
        expect(await usdc.balanceOf(pool.address)).to.be.eq("1000");
        expect(await pool.unclaimedPoolCollateral()).to.be.eq("1000")
        expect(await pool.redeemCollateralBalances(owner.address)).to.be.eq("1000")

        await pool.collectRedemption();

        expect(await usdc.balanceOf(owner.address)).to.be.eq("1000000000000000000000000000000")
        expect(await pool.unclaimedPoolCollateral()).to.be.eq(0)
        expect(await pool.redeemCollateralBalances(owner.address)).to.be.eq(0)

    });
    it('test mintAlgorithmicStable and redeemAlgorithmicStable ', async () => {
        await usdc_uniswapOracle.setPeriod(1);
        await usdc_uniswapOracle.update();
        await frax_uniswapOracle.setPeriod(1);
        await frax_uniswapOracle.update();
        await fxs_uniswapOracle.setPeriod(1);
        await fxs_uniswapOracle.update();

        expect(await frax.stockPrice()).to.be.eq("100000000");
        expect(await frax.globalCollateralRatio()).to.be.eq("1000000");
        expect(await frax.stableStep()).to.be.eq("2500");

        await frax.setStableStep("2500000");
        expect(await frax.stableStep()).to.be.eq("2500000");
        await frax.refreshCollateralRatio();

        expect(await frax.globalCollateralRatio()).to.be.eq(0);
        expect(await frax.balanceOf(owner.address)).to.be.eq(toWei('1999999'));
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('999999'));

        await pool.mintAlgorithmicStable("1000", "100");
        expect(await frax.balanceOf(owner.address)).to.be.eq("1999999000000000000100000");
        expect(await fxs.balanceOf(owner.address)).to.be.eq("999998999999999999999000");
        expect(await fxs.balanceOf(pool.address)).to.be.eq(0);

        await pool.redeemAlgorithmicStable("1000000", 0);
        expect(await frax.balanceOf(owner.address)).to.be.eq("1999998999999999999100000");
        expect(await fxs.balanceOf(owner.address)).to.be.eq("999998999999999999999000");
        expect(await pool.unclaimedPoolStock()).to.be.eq("10000");

        await pool.collectRedemption();
        expect(await fxs.balanceOf(pool.address)).to.be.eq(0);
        expect(await fxs.balanceOf(owner.address)).to.be.eq("999999000000000000009000");
        expect(await pool.unclaimedPoolStock()).to.be.eq(0);


    });

    it("test buyBackStock", async () => {
        await usdc_uniswapOracle.setPeriod(1);
        await usdc_uniswapOracle.update();
        await frax_uniswapOracle.setPeriod(1);
        await frax_uniswapOracle.update();
        await fxs_uniswapOracle.setPeriod(1);
        await fxs_uniswapOracle.update();

        await frax.burn(toWei('1999999'));
        expect(await frax.totalSupply()).to.be.eq(toWei('1'));

        //await frax.setStableStep("250000");
        await frax.refreshCollateralRatio();
        expect(await pool.availableExcessCollatDV()).to.be.eq(0);
        await pool.mintFractionalStable(toWei('1'), toWei('10000000000'), 0);
        expect(await frax.globalCollateralValue()).to.be.eq("100000000000000000000");
        expect(await pool.availableExcessCollatDV()).to.be.eq(0);
        expect(await frax.totalSupply()).to.be.eq("101250626566416040100");

        expect(await usdc.balanceOf(pool.address)).to.be.eq("1000000000000000000");
        expect(await fxs.balanceOf(owner.address)).to.be.eq("999998997493734335839599");

        await pool.recollateralizeStable(toWei('1'), "100");

        expect(await frax.globalCollateralRatio()).to.be.eq("997500");
        expect(await frax.globalCollateralValue()).to.be.eq("100997521172932330800");

        expect(await pool.availableExcessCollatDV()).to.be.eq("21172932330801");

        expect(await usdc.balanceOf(pool.address)).to.be.eq("1009975211729323308");
        expect(await fxs.balanceOf(owner.address)).to.be.eq("999999007543760153132832");

        await pool.mintFractionalStable(toWei('10'), toWei('10000000000'), 0);
        await pool.buyBackStock(toWei('0.000000000001'), 0);
        expect(await usdc.balanceOf(owner.address)).to.be.eq("999999999988990024788271676692");


    });
    it('test addAMOMinter and removeAMOMinter', async () => {
        const AMOMinter = await ethers.getContractFactory('AMOMinter');
        amoMinter = await AMOMinter.deploy(
            checkPermission.address,
            frax.address,
            fxs.address,
            usdc.address,
            pool.address
        );
        expect(await pool.amoMinterAddresses(amoMinter.address)).to.be.eq(false);
        await pool.addAMOMinter(amoMinter.address);
        expect(await pool.amoMinterAddresses(amoMinter.address)).to.be.eq(true);

        await pool.removeAMOMinter(amoMinter.address);
        expect(await pool.amoMinterAddresses(amoMinter.address)).to.be.eq(false);


    });
    it('test addPool and removePool', async () => {
        expect(await fxs.isPools(pool.address)).to.be.eq(true);
        expect(await fxs.getPoolAddress(0)).to.be.eq(pool.address);
        expect(await fxs.stablePoolAddressCount()).to.be.eq(1);
        await fxs.removePool(pool.address);

        expect(await fxs.stablePoolAddressCount()).to.be.eq(0);
        expect(await fxs.isPools(pool.address)).to.be.eq(false);


    });
    it('test fxs setOracle', async () => {
        expect(await fxs.oracle()).to.be.eq(oracle.address);

        const TestOracle = await ethers.getContractFactory('TestOracle');
        newOracle = await TestOracle.deploy();
        await fxs.setOracle(newOracle.address)
        expect(await fxs.oracle()).to.be.eq(newOracle.address);


    });
    it("fxs mint upper limit", async () => {
        await fxs.addPool(owner.address)
        expect(await fxs.MAX_SUPPLY()).to.be.eq(toWei('1000000000'));
        expect(await fxs.totalSupply()).to.be.eq(toWei('300000000'));
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('999999'));

        //amount.add(totalSupply()) > MAX_SUPPLY
        await fxs.mint(owner.address, toWei('1000000000000'));
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('999999'));
        expect(await fxs.totalSupply()).to.be.eq(toWei('300000000'));

        //amount.add(totalSupply()) > MAX_SUPPLY
        await fxs.poolMint(owner.address, toWei('1000000000000'));
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('999999'));

        expect(await fxs.totalSupply()).to.be.eq(toWei('300000000'));

    });
    it("test poolBurn and removePool", async () => {
        let bef = await frax.balanceOf(owner.address);
        await frax.addPool(owner.address);
        await frax.poolBurn(owner.address, toWei('10000'));
        let aft = await frax.balanceOf(owner.address);

        expect(aft).to.be.eq(bef.sub(toWei('10000')));

        expect(await frax.stablePoolAddressCount()).to.be.eq(2);
        await frax.removePool(owner.address);
        expect(await frax.stablePoolAddressCount()).to.be.eq(1);

    });



});
