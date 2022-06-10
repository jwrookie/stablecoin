const CRVFactory = require('./mock/mockPool/factory.json');
const FactoryAbi = require('./mock/mockPool/factory_abi.json');
const Plain3Balances = require('./mock/mockPool/Plain3Balances.json');
const PoolAbi = require('./mock/mockPool/3pool_abi.json');
const Registry = require("./mock/mockPool/Registry.json");
const PoolRegistry = require("./mock/mockPool/PoolRegistry.json");
const MetaPool = require('./mock/mockPool/MetaUSDBalances.json');
const MetaPoolAbi = require('./mock/mockPool/meta_pool.json');

const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {waffle, ethers} = require("hardhat");
const {deployContract} = waffle;
const {expect} = require("chai");
const {toWei} = web3.utils;
const WETH9 = require('./mock/WETH9.json');
const gas = {gasLimit: "9550000"};
const {BigNumber} = require('ethers');
const {fromWei, toBN} = require("web3-utils");
contract('SwapController', () => {
    async function getCurrentBlock() {
        return parseInt(await time.latestBlock());
    }

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

    });
    it('liquidity mining and transaction mining acceleration will fail', async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));
        await gauge_pool.connect(dev).deposit("1000", 1);

        await boost.connect(dev).vote(1, [pool.address], [toWei('1')]);

        await expect(swapMining.connect(dev).vote(1, [pool.address], [toWei('1')])).to
            .be.revertedWith("tokenId voted");


    });
    it('transaction mining acceleration and voting will fail', async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));

        await boost.connect(dev).vote(1, [pool.address], [toWei('1')]);

        await expect(swapController.connect(dev).vote(1, pool.address)).to
            .be.revertedWith("tokenId voted");


    });
    it('liquidity acceleration and voting will fail', async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));

        await boost.connect(dev).vote(1, [pool.address], [toWei('1')]);

        await expect(gaugeController.connect(dev).vote(1, pool.address)).to
            .be.revertedWith("tokenId voted");


    });

    it('trading mining voting and liquidity voting will fail', async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));
        await gauge_pool.connect(dev).deposit("1000", 1);

        await gaugeController.connect(dev).vote(1, pool.address);

        await expect(swapController.connect(dev).vote(1, pool.address)).to
            .be.revertedWith("tokenId voted");

    });
    it('transaction mining users can accelerate, reset and vote again', async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));
        await lock.createLock(toWei('10'), parseInt(eta));

        let info = await swapMining.poolInfo(0);
        expect(info[2]).to.be.eq("100");

        await swapController.connect(dev).vote(1, pool.address);
        info = await swapMining.poolInfo(0);
        let weight = await lock.balanceOfNFT(1);
        expect(info[2]).to.be.not.eq("100");

        expect(info[2]).to.be.eq(weight);
        await time.increase(time.duration.days(1));

        await expect(swapController.connect(dev).reset(1)).to.be.revertedWith("total=0");
        await swapController.vote(2, pool.address);
        await swapController.connect(dev).reset(1);

        info = await swapMining.poolInfo(0);

        expect(info[2]).to.be.gt(weight);

        await time.increase(time.duration.days(1));
        await swapController.connect(dev).vote(1, pool.address);


    });
    it('users cannot vote again before the cycle', async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));
        await lock.createLock(toWei('10'), parseInt(eta));

        let info = await swapMining.poolInfo(0);
        expect(info[2]).to.be.eq("100");

        await swapController.connect(dev).vote(1, pool.address);
        info = await swapMining.poolInfo(0);
        let weight = await lock.balanceOfNFT(1);

        expect(info[2]).to.be.not.eq("100");
        expect(info[2]).to.be.eq(weight);

        await expect(swapController.connect(dev).vote(1, pool.address)).to
            .be.revertedWith("next duration use");
        await time.increase(time.duration.days(1));
        await expect(swapController.connect(dev).reset(1)).to.be.revertedWith("total=0");
        await swapController.vote(2, pool.address);

        let weight1 = await lock.balanceOfNFT(1);
        info = await swapMining.poolInfo(0);

        expect(weight1).to.be.not.eq(weight);
        expect(info[2]).to.be.eq(BigNumber.from(weight1).add(weight));


    });
    it('transaction mining multi-user single pool voting', async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));
        await lock.createLock(toWei('10'), parseInt(eta));

        let info = await swapMining.poolInfo(0);
        expect(info[2]).to.be.eq("100");

        await swapController.connect(dev).vote(1, pool.address);
        await swapController.vote(2, pool.address);
        info = await swapMining.poolInfo(0);
        expect(info[2]).to.be.not.eq("100");

        await time.increase(time.duration.days(1));
        await swapController.connect(dev).reset(1);
        await swapController.reset(2)
        await time.increase(time.duration.days(1));

        await swapController.connect(dev).vote(1, pool.address);
        await swapController.vote(2, pool.address);

        let usedWeightsDev = await swapController.usedWeights(1);
        let usedWeightsOwner = await swapController.usedWeights(2);

        let totalWeight = await swapController.totalWeight();
        expect(totalWeight).to.be.eq(usedWeightsDev.add(usedWeightsOwner));


    });
    it("two users liquidity accelerate, reset weight > 0", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1000'), parseInt(eta));

        await boost.vote(1, [pool.address], [toWei('1')]);
        await boost.reset(1);
        await expect(gaugeController.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(swapController.reset(1)).to.be.revertedWith("use weight > 0");

        await expect(gaugeController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(swapController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(boost.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");

        await boost.connect(dev).vote(2, [pool.address], [toWei('2')]);
        await expect(gaugeController.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(swapController.reset(1)).to.be.revertedWith("use weight > 0");

        await expect(gaugeController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(swapController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await boost.connect(dev).reset(2);


    });
    it("two users swapMining accelerate, reset weight > 0", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1000'), parseInt(eta));

        await swapMining.vote(1, [pool.address], [toWei('1')]);
        await swapMining.reset(1);
        await expect(swapController.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(boost.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.reset(1)).to.be.revertedWith("use weight > 0");

        await expect(swapController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(boost.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");

        await swapMining.connect(dev).vote(2, [pool.address], [toWei('2')]);
        await expect(swapController.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(boost.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.reset(1)).to.be.revertedWith("use weight > 0");

        await expect(swapController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(boost.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await swapMining.connect(dev).reset(2);


    });

    it("two users swapMining vote, reset weight > 0", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1000'), parseInt(eta));

        await swapController.vote(1, pool.address);
        await expect(gaugeController.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(boost.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.reset(1)).to.be.revertedWith("use weight > 0");

        await expect(gaugeController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(boost.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(swapController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");

        await swapController.connect(dev).vote(2, pool.address);
        await expect(gaugeController.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(boost.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.reset(1)).to.be.revertedWith("use weight > 0");

        await expect(gaugeController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(boost.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");

        await time.increase(time.duration.days(7));

        await swapController.reset(1);
        expect(await swapController.usedWeights(1)).to.be.eq(0)

        await swapController.connect(dev).reset(2);
        expect(await swapController.usedWeights(2)).to.be.eq(0)


    });
    it("two users liquidity vote, reset weight > 0", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1000'), parseInt(eta));

        await gaugeController.vote(1, pool.address);

        await expect(swapController.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(boost.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.reset(1)).to.be.revertedWith("use weight > 0");

        await expect(gaugeController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(swapController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(boost.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");

        await gaugeController.connect(dev).vote(2, pool.address);
        await expect(swapController.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(boost.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.reset(1)).to.be.revertedWith("use weight > 0");

        await expect(swapController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(boost.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");

        await time.increase(time.duration.days(7));
        await gaugeController.reset(1);
        expect(await gaugeController.usedWeights(1)).to.be.eq(0);

        await gaugeController.connect(dev).reset(2);
        expect(await gaugeController.usedWeights(2)).to.be.eq(0);

    });
    it("two users swapMining accelerate ,poke, weight > 0", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1000'), parseInt(eta));

        await expect(swapMining.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.connect(dev).poke(2)).to.be.revertedWith("use weight > 0");
        await expect(swapController.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(swapController.connect(dev).poke(2)).to.be.revertedWith("use weight > 0");

        await expect(boost.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(boost.connect(dev).poke(2)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.connect(dev).poke(2)).to.be.revertedWith("use weight > 0");

        await swapMining.vote(1, [pool.address], [toWei('1')]);
        await swapMining.poke(1);

        await expect(swapController.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(swapController.connect(dev).poke(2)).to.be.revertedWith("use weight");
        await expect(boost.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(boost.connect(dev).poke(2)).to.be.revertedWith("use weight");

        await expect(gaugeController.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.connect(dev).poke(2)).to.be.revertedWith("use weight");
        await expect(swapMining.connect(dev).poke(2)).to.be.revertedWith("use weight");

        await swapMining.connect(dev).vote(2, [pool.address], [toWei('2')]);
        await expect(swapController.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(swapController.connect(dev).poke(2)).to.be.revertedWith("use weight");
        await expect(boost.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(boost.connect(dev).poke(2)).to.be.revertedWith("use weight");

        await expect(gaugeController.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.connect(dev).poke(2)).to.be.revertedWith("use weight");
        await swapMining.connect(dev).poke(2);


    });

    it("two users swapMining vote ,poke, weight > 0", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1000'), parseInt(eta));

        await swapController.vote(1, pool.address);
        await swapController.poke(1);

        await expect(swapMining.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.connect(dev).poke(2)).to.be.revertedWith("use weight");
        await expect(boost.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(boost.connect(dev).poke(2)).to.be.revertedWith("use weight");

        await expect(gaugeController.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.connect(dev).poke(2)).to.be.revertedWith("use weight");
        await expect(swapController.connect(dev).poke(2)).to.be.revertedWith("use weight");

        await swapController.connect(dev).vote(2, pool.address);
        await expect(swapMining.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.connect(dev).poke(2)).to.be.revertedWith("use weight");
        await expect(boost.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(boost.connect(dev).poke(2)).to.be.revertedWith("use weight");

        await expect(gaugeController.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.connect(dev).poke(2)).to.be.revertedWith("use weight");
        await swapController.connect(dev).poke(2);


    });

    it("two users liquidity accelerate ,poke, weight > 0", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1000'), parseInt(eta));

        await boost.vote(1, [pool.address], [toWei('1')]);
        await boost.poke(1);
        await expect(swapController.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(swapController.connect(dev).poke(2)).to.be.revertedWith("use weight");

        await expect(swapMining.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.connect(dev).poke(2)).to.be.revertedWith("use weight");
        await expect(gaugeController.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.connect(dev).poke(2)).to.be.revertedWith("use weight");
        await expect(boost.connect(dev).poke(2)).to.be.revertedWith("use weight");


        await boost.connect(dev).vote(2, [pool.address], [toWei('2')]);
        await expect(swapController.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(swapController.connect(dev).poke(2)).to.be.revertedWith("use weight");
        await expect(swapMining.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.connect(dev).poke(2)).to.be.revertedWith("use weight");

        await expect(gaugeController.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.connect(dev).poke(2)).to.be.revertedWith("use weight");
        await boost.connect(dev).poke(2);


    });

    it("two users liquidity vote ,poke, weight > 0", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1000'), parseInt(eta));

        await gaugeController.vote(1, pool.address);
        await gaugeController.poke(1);
        await expect(swapMining.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.connect(dev).poke(2)).to.be.revertedWith("use weight");
        await expect(boost.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(boost.connect(dev).poke(2)).to.be.revertedWith("use weight");

        await expect(swapController.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(swapController.connect(dev).poke(2)).to.be.revertedWith("use weight");
        await expect(gaugeController.connect(dev).poke(2)).to.be.revertedWith("use weight");


        await gaugeController.connect(dev).vote(2, pool.address);
        await expect(swapMining.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.connect(dev).poke(2)).to.be.revertedWith("use weight");
        await expect(boost.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(boost.connect(dev).poke(2)).to.be.revertedWith("use weight");

        await expect(swapController.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(swapController.connect(dev).poke(2)).to.be.revertedWith("use weight");
        await gaugeController.connect(dev).poke(2);

    });
    it("test vote and reset, other reset", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1000'), parseInt(eta));

        await boost.vote(1, [pool.address], [toWei('1')]);
        await boost.poke(1);

        await boost.reset(1);
        await expect(boost.vote(1, [pool.address], [toWei('2')])).to.be.emit(boost, "Voted");

        await expect(swapController.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.reset(1)).to.be.revertedWith("use weight > 0");

        await expect(swapController.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.poke(1)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.poke(1)).to.be.revertedWith("use weight > 0");

        await boost.connect(dev).vote(2, [pool.address], [toWei('2')]);
        await boost.connect(dev).poke(2);

        await expect(swapController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");

        await expect(swapController.connect(dev).poke(2)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.connect(dev).poke(2)).to.be.revertedWith("use weight > 0");
        await expect(gaugeController.connect(dev).poke(2)).to.be.revertedWith("use weight > 0");
    });
    it("test ve token >0", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1000'), parseInt(eta));

        expect(await boost.totalAllocPoint()).to.be.eq("100")
        await gaugeController.vote(1, pool.address);

        await time.increase(time.duration.days(1));
        await expect(gaugeController.reset(1)).to.be.revertedWith("total=0");

        await gaugeController.connect(dev).vote(2, pool.address);

        await time.increase(time.duration.days(7));
        await gaugeController.reset(1);

        await expect(swapController.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(boost.reset(1)).to.be.revertedWith("use weight > 0");
        await expect(swapMining.reset(1)).to.be.revertedWith("use weight > 0");

        await expect(swapController.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");
        await expect(boost.connect(dev).reset(2)).to.be.revertedWith("use weight > 0");


        await gaugeController.connect(dev).reset(2)
        await time.increase(time.duration.days(1));

        await expect(gaugeController.vote(1, pool.address)).to.be.revertedWith("ve token >0");

    });


});