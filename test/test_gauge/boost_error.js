const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {deployContract} = waffle;
const {expect} = require("chai");
const {toWei} = web3.utils;
const WETH9 = require('../mock/WETH9.json');
const CRVFactory = require('../mock/mockPool/factory.json');
const FactoryAbi = require('../mock/mockPool/factory_abi.json');
const Plain3Balances = require('../mock/mockPool/Plain3Balances.json');
const PoolAbi = require('../mock/mockPool/3pool_abi.json');
const Registry = require("../mock/mockPool/Registry.json");
const PoolRegistry = require("../mock/mockPool/PoolRegistry.json");
const {BigNumber} = require('ethers');
const gas = {gasLimit: "9550000"};

contract('Boost', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        zeroAddr = "0x0000000000000000000000000000000000000000";
        const TestERC20 = await ethers.getContractFactory('TestERC20');
        usdc = await TestERC20.deploy();
        busd = await TestERC20.deploy();
        weth9 = await deployContract(owner, {
            bytecode: WETH9.bytecode,
            abi: WETH9.abi,
        });
        const Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();

        const CheckPermission = await ethers.getContractFactory("CheckPermission");
        checkPermission = await CheckPermission.deploy(operatable.address);

        const SwapRouter = await ethers.getContractFactory('SwapRouter');
        swapRouter = await SwapRouter.deploy(checkPermission.address, weth9.address);
        const MockToken = await ethers.getContractFactory("MockToken");
        token0 = await MockToken.deploy("token0", "token0", 18, toWei('10'));
        token1 = await MockToken.deploy("token1", "token1", 18, toWei('10'));
        token2 = await MockToken.deploy("token2", "token2", 18, toWei('10'));

        await token0.mint(owner.address, toWei("10000"));
        await token1.mint(owner.address, toWei("10000"));
        await token2.mint(owner.address, toWei("10000"));


        await token0.mint(dev.address, toWei("1000000"));
        await token1.mint(dev.address, toWei("10000000"));
        await token2.mint(dev.address, toWei("10000000"));

        plain3Balances = await deployContract(owner, {
            bytecode: Plain3Balances.bytecode,
            abi: PoolAbi.abi
        });

        registry = await deployContract(owner, {
            bytecode: Registry.bytecode,
            abi: Registry.abi
        }, [owner.address]);

        poolRegistry = await deployContract(owner, {
            bytecode: PoolRegistry.bytecode,
            abi: PoolRegistry.abi
        }, [registry.address, zeroAddr]);


        await registry.set_address(0, poolRegistry.address);

        crvFactory = await deployContract(owner, {
            bytecode: CRVFactory.bytecode,
            abi: FactoryAbi.abi,
        }, [owner.address, registry.address]);

        await crvFactory.set_plain_implementations(3,
            [
                plain3Balances.address,
                zeroAddr,
                zeroAddr,
                zeroAddr,
                zeroAddr,
                zeroAddr,
                zeroAddr,
                zeroAddr,
                zeroAddr,
                zeroAddr]);


        // create  token0 token1 token2
        await crvFactory.deploy_plain_pool(
            "3pool",
            "3pool",
            [token0.address, token1.address, token2.address, zeroAddr],
            "2000",
            "4000000", 0, 0, gas);

        poolAddress = await crvFactory.pool_list(0, gas);
        pool = await plain3Balances.attach(poolAddress);

        await token0.approve(pool.address, toWei("10000"));
        await token1.approve(pool.address, toWei("10000"));
        await token2.approve(pool.address, toWei("10000"));
        await token0.connect(dev).approve(pool.address, toWei("10000"));
        await token1.connect(dev).approve(pool.address, toWei("10000"));
        await token2.connect(dev).approve(pool.address, toWei("10000"));

        await pool.add_liquidity([toWei('100'), toWei('100'), toWei('100')], 0, gas);

        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        await usdc.mint(owner.address, toWei('1'));
        await busd.mint(owner.address, toWei('1'));

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(checkPermission.address, "fxs", "fxs", oracle.address);
        await fxs.transfer(addr1.address, "299000000000000000000000000");
        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(checkPermission.address, "frax", "frax");

        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        let lastBlock = await time.latestBlock();

        const Locker = await ethers.getContractFactory('Locker');
        // let eta = time.duration.days(1);
        lock = await Locker.deploy(checkPermission.address, fxs.address, parseInt('1800'));

        const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
        gaugeFactory = await GaugeFactory.deploy(checkPermission.address);

        Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkPermission.address,
            lock.address,
            gaugeFactory.address,
            fxs.address,
            toWei("1"),
            parseInt(lastBlock),
            "1000"
        );

        await lock.addBoosts(boost.address);
        await usdc.mint(owner.address, toWei('1000'));
        // await fxs.connect(dev).approve(lock.address, toWei('10000'));
        await fxs.approve(lock.address, toWei('10000'));
        await usdc.mint(dev.address, toWei('10000000'));

        await boost.createGauge(usdc.address, "100", true);
        await boost.createGauge(busd.address, "100", true);

        gaugeAddr = await boost.gauges(usdc.address);
        gaugeAddr1 = await boost.gauges(busd.address);

        const Gauge = await ethers.getContractFactory('Gauge');
        gauge_usdc = await Gauge.attach(gaugeAddr);
        gauge_busd = await Gauge.attach(gaugeAddr1);
        expect(gauge_usdc.address).to.be.eq(gaugeAddr);

        await fxs.addPool(boost.address);

        await fxs.transfer(dev.address, toWei('10000'));
        await fxs.connect(dev).approve(gauge_usdc.address, toWei('100000'))
        await fxs.connect(dev).approve(lock.address, toWei('100000'))
        await fxs.approve(gauge_busd.address, toWei('100000'))
        await fxs.approve(lock.address, toWei('100000'))

        const GaugeController = await ethers.getContractFactory('GaugeController');
        gaugeController = await GaugeController.deploy(
            checkPermission.address,
            boost.address,
            lock.address,
            "300");


        await boost.addController(gaugeController.address);
        await gaugeController.addPool(usdc.address);
        await gaugeController.addPool(busd.address);

        await lock.addBoosts(gaugeController.address);

        const SwapMining = await ethers.getContractFactory('SwapMining');
        swapMining = await SwapMining.deploy(
            checkPermission.address,
            lock.address,
            fxs.address,
            owner.address,
            swapRouter.address,
            toWei('1'),
            parseInt(lastBlock),
            "10"
        );

        await swapRouter.setSwapMining(swapMining.address);
        await lock.addBoosts(swapMining.address);

        const SwapController = await ethers.getContractFactory('SwapController');
        swapController = await SwapController.deploy(
            checkPermission.address,
            swapMining.address,
            lock.address,
            "300",
        );
        await swapMining.addController(swapController.address);
        await lock.addBoosts(swapController.address);


        await swapMining.addPair(100, pool.address, true);
        await swapController.addPool(pool.address);


    });

    it("Reset after the user votes. The total weight is 0. " +
        "It can be reset only after another user votest", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1000'), parseInt(eta));

        expect(await boost.totalAllocPoint()).to.be.eq(200);

        await gaugeController.vote(1, usdc.address);
        let weightOwner = await gaugeController.usedWeights(1)

        expect(await boost.totalAllocPoint()).to.be.eq(weightOwner);

        await time.increase(time.duration.days(1));

        await expect(gaugeController.reset(1)).to.be.revertedWith("total=0");

        await gaugeController.connect(dev).vote(2, usdc.address);
        weightOwner = await gaugeController.usedWeights(1);
        let weightDev = await gaugeController.usedWeights(2);

        let total = BigNumber.from(weightOwner).add(weightDev);
        expect(await boost.totalAllocPoint()).to.be.eq(total);

        await gaugeController.reset(1)
        expect(await boost.totalAllocPoint()).to.be.gt(0);


    });
    it("test vote with swapMining", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1'), parseInt(eta));

        await expect(swapController.vote(1, usdc.address)).to.be.revertedWith("must pool");
        await swapController.vote(1, pool.address);

        await time.increase(time.duration.days(1));
        let weightOwner = await swapController.usedWeights(1);

        expect(await swapMining.totalAllocPoint()).to.be.eq(weightOwner);

        await expect(swapController.reset(1)).to.be.revertedWith("total=0");

        await swapController.connect(dev).vote(2, pool.address);
        weightOwner = await swapController.usedWeights(1);
        let weightDev = await swapController.usedWeights(2);

        let total = BigNumber.from(weightOwner).add(weightDev);
        expect(await swapMining.totalAllocPoint()).to.be.eq(total);

        await swapController.reset(1);
        await time.increase(time.duration.days(1));
        await expect(swapController.connect(dev).reset(2)).to.be.revertedWith("total=0");
        expect(await swapMining.totalAllocPoint()).to.be.gt(0);


    });
    it("boost multi user accelerated reset", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1'), parseInt(eta));

        await boost.vote(1, [usdc.address], [toWei('1')]);
        await boost.reset(1);

        await boost.connect(dev).vote(2, [usdc.address], [toWei('1')]);
        await boost.connect(dev).reset(2);


    });
    it("swapMining multi user accelerated reset", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1'), parseInt(eta));

        await swapMining.vote(1, [pool.address], [toWei('1')]);
        await swapMining.reset(1);

        await swapMining.connect(dev).vote(2, [pool.address], [toWei('1')]);
        await swapMining.connect(dev).reset(2);


    });


});
