const CRVFactory = require('../mock/mockPool/factory.json');
const FactoryAbi = require('../mock/mockPool/factory_abi.json');
const Plain3Balances = require('../mock/mockPool/Plain3Balances.json');
const PoolAbi = require('../mock/mockPool/3pool_abi.json');
const Registry = require("../mock/mockPool/Registry.json");
const PoolRegistry = require("../mock/mockPool/PoolRegistry.json");

const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {waffle, ethers} = require("hardhat");
const {deployContract} = waffle;
const {expect} = require("chai");
const {toWei} = web3.utils;
const WETH9 = require('../mock/WETH9.json');
const gas = {gasLimit: "9550000"};

contract('gauge,swapMining', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        zeroAddr = "0x0000000000000000000000000000000000000000";

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

        const MockToken = await ethers.getContractFactory("MockToken")

        token0 = await MockToken.deploy("token0", "token0", 18, toWei('10'));
        token1 = await MockToken.deploy("token1", "token1", 18, toWei('10'));
        token2 = await MockToken.deploy("token2", "token2", 18, toWei('10'));
        usdc = await MockToken.deploy("usdc", "usdc", 18, toWei('10'));

        await token0.mint(owner.address, toWei("10000"));
        await token1.mint(owner.address, toWei("10000"));
        await token2.mint(owner.address, toWei("10000"));


        await token0.mint(dev.address, toWei("1000000"));
        await token1.mint(dev.address, toWei("10000000"));
        await token2.mint(dev.address, toWei("10000000"));

        plain3Balances = await deployContract(owner, {
            bytecode: Plain3Balances.bytecode,
            abi: PoolAbi.abi
        })

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
        await pool.connect(dev).add_liquidity([toWei('100'), toWei('100'), toWei('100')], 0, gas);
        // await poolRegistry.add_pool(poolAddress, 3, poolAddress, 18, "test", gas);

        await crvFactory.deploy_plain_pool(
            "3pool1",
            "3pool1",
            [poolAddress, token1.address, token2.address, zeroAddr],
            "2000",
            "4000000", 0, 0, gas);
        mulPoolAddress = await crvFactory.pool_list(1, gas);

        mulPool = await plain3Balances.attach(mulPoolAddress);
        await pool.approve(mulPool.address, toWei("10000"));
        await token1.approve(mulPool.address, toWei("10000"));
        await token2.approve(mulPool.address, toWei("10000"));

        await mulPool.add_liquidity([toWei('100'), toWei('100'), toWei('100')], 0, gas);


        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(checkPermission.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(checkPermission.address, "frax", "frax");
        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        let lastBlock = await time.latestBlock();
        let eta = time.duration.days(1);
        const Locker = await ethers.getContractFactory('Locker');
        lock = await Locker.deploy(checkPermission.address, fxs.address, parseInt(eta));


        const SwapMining = await ethers.getContractFactory('SwapMining');
        swapMining = await SwapMining.deploy(
            checkPermission.address,
            lock.address,
            fxs.address,
            crvFactory.address,
            swapRouter.address,
            toWei('1'),
            parseInt(lastBlock),
            "10"
        );

        await swapRouter.setSwapMining(swapMining.address);
        expect(await swapMining.router()).to.be.eq(swapRouter.address);
        expect(await swapRouter.swapMining()).to.be.eq(swapMining.address);
        await swapMining.addPair(100, pool.address, true)

        const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
        gaugeFactory = await GaugeFactory.deploy(checkPermission.address);

        Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkPermission.address,
            lock.address,
            gaugeFactory.address,
            fxs.address,
            toWei('1'),
            parseInt(lastBlock),
            "1000"
        );

        await fxs.addPool(boost.address);
        await lock.addBoosts(swapMining.address);

        await fxs.connect(dev).approve(lock.address, toWei('10000'));
        await fxs.approve(lock.address, toWei('10000'));
        await fxs.transfer(dev.address, toWei('10000'));

        await boost.createGauge(pool.address, "100", true);

        gaugeAddr = await boost.gauges(pool.address);

        const Gauge = await ethers.getContractFactory('Gauge');
        gauge_pool = await Gauge.attach(gaugeAddr);
        expect(gauge_pool.address).to.be.eq(gaugeAddr);
        await pool.connect(dev).approve(gauge_pool.address, toWei('10000'));
        expect(await boost.poolLength()).to.be.eq(1);

        expect(await boost.isGauge(gauge_pool.address)).to.be.eq(true);
        expect(await boost.poolForGauge(gauge_pool.address)).to.be.eq(pool.address);

        await fxs.addPool(swapMining.address);
        const SwapController = await ethers.getContractFactory('SwapController');
        swapController = await SwapController.deploy(
            checkPermission.address,
            swapMining.address,
            lock.address,
            "300",
        );
        await swapMining.addController(swapController.address);
        await lock.addBoosts(swapController.address);
        await lock.addBoosts(boost.address);
        await swapController.addPool(pool.address);
        await token0.connect(dev).approve(swapRouter.address, toWei('10000'));
        await token1.connect(dev).approve(swapRouter.address, toWei('10000'));

        await fxs.connect(dev).approve(lock.address, toWei('10000000'));
        const GaugeController = await ethers.getContractFactory('GaugeController');
        gaugeController = await GaugeController.deploy(
            checkPermission.address,
            boost.address,
            lock.address,
            "300");

        await boost.addController(gaugeController.address);
        await gaugeController.addPool(pool.address);
        await lock.addBoosts(gaugeController.address);

         await token0.connect(dev).approve(swapRouter.address, toWei('10000'));
        await token1.connect(dev).approve(swapRouter.address, toWei('10000'));
        await token0.approve(swapRouter.address, toWei('10000'));
        await token1.approve(swapRouter.address, toWei('10000'));

    });
    it('swapMining, two users did not accelerate to receive rewards', async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));

        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        let dx = "1000000";

        //token0 -> token1
        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);
        let befDev = await fxs.balanceOf(dev.address);

        let pend = await swapMining.rewardPoolInfo(0, dev.address);
        console.log("userReward:" + pend / 10 ** 18);

        await swapMining.connect(dev).getReward(0);
        let aftDev = await fxs.balanceOf(dev.address);
        expect(aftDev).to.be.eq(toWei('9996.96'));

        await swapRouter.connect(owner).swapStable(pool.address, 0, 1, dx, 0, owner.address, times);

        let befOwner = await fxs.balanceOf(owner.address);
        expect(befOwner).to.be.eq(toWei('299990000'));

        await swapMining.getReward(0);
        let aftOwner = await fxs.balanceOf(owner.address);
        expect(aftOwner).to.be.eq(toWei('299990000.48'));

        let devDiff = aftDev.sub(befDev);
        expect(devDiff).to.be.eq(toWei('6.96'));

        let ownerDiff = aftOwner.sub(befOwner);
        expect(ownerDiff).to.be.eq(toWei('0.48'));


    });

    it('swapMining, one user did not accelerate to receive the reward, ' +
        'and the other user accelerated to receive the reward', async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));

        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        let dx = "1000000";

        //token0 -> token1
        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);
        let befDev = await fxs.balanceOf(dev.address);
        expect(befDev).to.be.eq(toWei('9990'));

        await swapMining.connect(dev).vote(1, [pool.address], [toWei('1')]);

        let pend = await swapMining.rewardPoolInfo(0, dev.address);
        console.log("userReward:" + pend / 10 ** 18);

        await swapMining.connect(dev).getReward(0);
        let aftDev = await fxs.balanceOf(dev.address);
        expect(aftDev).to.be.eq(toWei('9997.2'));

        await swapRouter.connect(owner).swapStable(pool.address, 0, 1, dx, 0, owner.address, times);
        let befOwner = await fxs.balanceOf(owner.address);
        expect(befOwner).to.be.eq(toWei('299990000'));

        await swapMining.getReward(0);
        let aftOwner = await fxs.balanceOf(owner.address);
        expect(aftOwner).to.be.eq(toWei('299990000.48'));

        let devDiff = aftDev.sub(befDev);
        expect(devDiff).to.be.eq(toWei('7.2'));

        let ownerDiff = aftOwner.sub(befOwner);
        expect(ownerDiff).to.be.eq(toWei('0.48'));


    });
    it('swapMining, one user did not vote to receive the reward,' +
        ' and another user voted to receive the reward', async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));

        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        let dx = "1000000";

        //token0 -> token1
        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);
        let befDev = await fxs.balanceOf(dev.address);
        expect(befDev).to.be.eq(toWei('9990'));

        await swapController.connect(dev).vote(1, pool.address);
        let pend = await swapMining.rewardPoolInfo(0, dev.address);
        console.log("userReward:" + pend / 10 ** 18);

        await swapMining.connect(dev).getReward(0);
        let aftDev = await fxs.balanceOf(dev.address);
        expect(aftDev).to.be.eq(toWei('9997.2'));

        await swapRouter.connect(owner).swapStable(pool.address, 0, 1, dx, 0, owner.address, times);
        let befOwner = await fxs.balanceOf(owner.address);
        expect(befOwner).to.be.eq(toWei('299990000'));

        await swapMining.getReward(0);
        let aftOwner = await fxs.balanceOf(owner.address);
        expect(aftOwner).to.be.eq(toWei('299990000.48'));

        let devDiff = aftDev.sub(befDev);
        expect(devDiff).to.be.eq(toWei('7.2'));

        let ownerDiff = aftOwner.sub(befOwner);
        expect(ownerDiff).to.be.eq(toWei('0.48'));


    });


});