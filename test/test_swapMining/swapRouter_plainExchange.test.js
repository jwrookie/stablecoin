const CRVFactory = require('../mock/mockPool/factory.json');
const FactoryAbi = require('../mock/mockPool/factory_abi.json');
const Plain3Balances = require('../mock/mockPool/Plain3Balances.json');
const PoolAbi = require('../mock/mockPool/3pool_abi.json');
const Plain4Balances = require('../mock/mockPool/Plain4Balances.json');
const Plain4BalancesAbi = require('../mock/mockPool/4pool_abi.json');
const Registry = require("../mock/mockPool/Registry.json");
const PoolRegistry = require("../mock/mockPool/PoolRegistry.json");
const MetaPool = require('../mock/mockPool/MetaUSDBalances.json');
const MetaPoolAbi = require('../mock/mockPool/meta_pool.json');

const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {waffle, ethers} = require("hardhat");
const {deployContract} = waffle;
const {expect} = require("chai");
const {toWei} = web3.utils;
const WETH9 = require('../mock/WETH9.json');
const gas = {gasLimit: "9550000"};
const {BigNumber} = require('ethers');
contract('plainPool', () => {
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
        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();


        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(checkPermission.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(checkPermission.address, "frax", "frax");
        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        let eta = time.duration.days(1);
        const Locker = await ethers.getContractFactory('Locker');
        lock = await Locker.deploy(checkPermission.address, fxs.address, parseInt(eta));

        const MockToken = await ethers.getContractFactory("MockToken")
        token0 = await MockToken.deploy("token0", "token0", 18, toWei('10'));
        token1 = await MockToken.deploy("token1", "token1", 18, toWei('10'));
        token2 = await MockToken.deploy("token2", "token2", 18, toWei('10'));
        token3 = await MockToken.deploy("token3", "token3", 18, toWei('10'));

        await token0.mint(owner.address, toWei("10000"));
        await token1.mint(owner.address, toWei("10000"));
        await token2.mint(owner.address, toWei("10000"));
        await token3.mint(owner.address, toWei("10000"));

        await token0.mint(dev.address, toWei("1000000"));
        await token1.mint(dev.address, toWei("10000000"));
        await token2.mint(dev.address, toWei("10000000"));
        await token3.mint(dev.address, toWei("10000000"));

        plain3Balances = await deployContract(owner, {
            bytecode: Plain3Balances.bytecode,
            abi: PoolAbi.abi
        });

        plain4Balances = await deployContract(owner, {
            bytecode: Plain4Balances.bytecode,
            abi: Plain4BalancesAbi.abi
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

        await crvFactory.set_plain_implementations(4,
            [
                plain4Balances.address,
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
        await crvFactory.deploy_plain_pool(
            "3pool",
            "3pool",
            [token0.address, token1.address, token2.address, zeroAddr],
            "2000",
            "4000000", 0, 0, gas);

        poolAddress1 = await crvFactory.pool_list(1, gas);

        await crvFactory.deploy_plain_pool(
            "4pool",
            "4pool",
            [token0.address, token1.address, token2.address, token3.address],
            "2000",
            "4000000", 0, 0, gas);
        poolAddress2 = await crvFactory.pool_list(2, gas);

        pool = await plain3Balances.attach(poolAddress);
        pool1 = await plain3Balances.attach(poolAddress1);
        pool4 = await plain4Balances.attach(poolAddress2);

        await token0.approve(pool.address, toWei("10000"));
        await token1.approve(pool.address, toWei("10000"));
        await token2.approve(pool.address, toWei("10000"));
        await token0.approve(pool1.address, toWei("10000"));
        await token1.approve(pool1.address, toWei("10000"));
        await token2.approve(pool1.address, toWei("10000"));
        await token0.approve(pool4.address, toWei("10000"));
        await token1.approve(pool4.address, toWei("10000"));
        await token2.approve(pool4.address, toWei("10000"));
        await token3.approve(pool4.address, toWei("10000"));

        await pool.add_liquidity([toWei('100'), toWei('100'), toWei('100')], 0, gas);
        await pool1.add_liquidity([toWei('100'), toWei('100'), toWei('100')], 0, gas);
        await pool4.add_liquidity([toWei('100'), toWei('100'), toWei('100'), toWei('100')], 0, gas);

        // await poolRegistry.add_pool(poolAddress, 3, poolAddress, 18, "test", gas);
        let lastBlock = await time.latestBlock();
        const SwapMining = await ethers.getContractFactory('SwapMining');
        swapMining = await SwapMining.deploy(
            checkPermission.address,
            lock.address,
            fxs.address,
            crvFactory.address,
            swapRouter.address,
            "10000",
            parseInt(lastBlock),
            "10"
        );

        await swapRouter.setSwapMining(swapMining.address);
        await swapMining.setRouter(swapRouter.address);
        await swapMining.addPair(100, pool.address, true);
        await swapMining.addPair(200, pool1.address, true);
        await swapMining.addPair(100, pool4.address, true);

        await lock.addBoosts(swapMining.address);
        await fxs.connect(dev).approve(lock.address, toWei('10000'));
        await fxs.approve(lock.address, toWei('10000'));
        await fxs.transfer(dev.address, toWei('10000'));

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

        await swapController.addPool(pool.address);
        await swapController.addPool(pool1.address);
        await swapController.addPool(pool4.address);

        await token0.approve(swapRouter.address, toWei('10000'));
        await token1.approve(swapRouter.address, toWei('10000'));
        await token0.connect(dev).approve(swapRouter.address, toWei('10000'));
        await token1.connect(dev).approve(swapRouter.address, toWei('10000'));


    });
    it('test swapStable have reward', async () => {
        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));

        let dx = "1000000";

        //token0 -> token1
        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);
        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('10000'));
        let pend = await swapMining.pending(0, dev.address)
        console.log("userSub:" + pend[0]);

        let info = await swapMining.getPoolInfo(0);

        expect(info[0]).to.be.eq(pool.address);
        expect(info[1]).to.be.eq(pend[0]);
        expect(info[2]).to.be.eq(pend[1]);
        expect(info[3]).to.be.eq("100");

        await swapMining.connect(dev).getReward(0)

        expect(await fxs.balanceOf(dev.address)).to.be.eq("10000223125000000003999");


    });
    it('test 4pool swapStable have reward', async () => {
        await token0.approve(swapRouter.address, toWei('10000'));
        await token1.approve(swapRouter.address, toWei('10000'));

        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));

        let dx = "1000000";

        //token0 -> token1
        await swapRouter.swapStable(pool4.address, 0, 3, dx, 0, owner.address, times);
        expect(await fxs.balanceOf(owner.address)).to.be.eq("299990000000000000000000000");

        await swapMining.getReward(0)

        expect(await fxs.balanceOf(owner.address)).to.be.eq("299990000000000000000000000");
    });

    it('test the acceleration without swapMining', async () => {
        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));

        let dx = "1000000";
        //token0 -> token1
        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);

        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));

        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('9990'));

        await swapMining.connect(dev).getReward(0);

        expect(await fxs.balanceOf(dev.address)).to.be.eq("9990236250000000003999");


    });
    it('test the acceleration with swapMining', async () => {
        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        let dx = "1000000";

        //token0 -> token1
        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);

        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));

        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('9990'));

        await swapMining.connect(dev).vote(1, [pool.address], [toWei("1")]);

        await swapMining.connect(dev).getReward(0);

        expect(await fxs.balanceOf(dev.address)).to.be.eq("9990249375000000003999");


    });
    it('two users have no transaction mining acceleration', async () => {
        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        let dx = "1000000";

        //token0 -> token1
        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);

        await swapRouter.connect(owner).swapStable(pool.address, 0, 1, dx, 0, owner.address, times);


        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('10000'));
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('299990000'));


        await swapMining.connect(dev).getReward(0);
        await swapMining.connect(owner).getReward(0);

        expect(await fxs.balanceOf(dev.address)).to.be.eq("10000118125000000001999");
        expect(await fxs.balanceOf(owner.address)).to.be.eq("299990000131250000000002000");


    });
    it('mining acceleration of two user transactions', async () => {
        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        let dx = "1000000";

        //token0 -> token1
        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);
        await swapRouter.connect(owner).swapStable(pool.address, 0, 1, dx, 0, owner.address, times);

        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('10000'));
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('299990000'));

        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));
        await lock.connect(owner).createLock(toWei('10'), parseInt(eta));

        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('9990'));

        await swapMining.connect(dev).vote(1, [pool.address], [toWei("1")]);
        await swapMining.connect(owner).vote(2, [pool.address], [toWei("1")]);

        await swapMining.connect(dev).getReward(0);
        await swapMining.connect(owner).getReward(0);

        expect(await fxs.balanceOf(dev.address)).to.be.eq("9990144375000000001999");
        expect(await fxs.balanceOf(owner.address)).to.be.eq("299989990157500000000002000");


    });
    it("the swapMining acceleration multiplier is 3.3", async () => {
        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        let dx = toWei('1');

        //token0 -> token1
        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);

        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));

        let rewardMax = await swapMining.rewardInfoMax(dev.address);
        let reward = await swapMining.rewardInfo(dev.address);


        let multiple = rewardMax.div(reward);
        expect(rewardMax).to.be.gt(reward);
        expect(multiple).to.be.eq(3);

        await swapMining.connect(dev).vote(1, [pool.address], [toWei('1')]);
        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);

        rewardMax = await swapMining.rewardInfoMax(dev.address);
        reward = await swapMining.rewardInfo(dev.address);

        multiple = rewardMax.div(reward);
        expect(rewardMax).to.be.eq(reward);
        expect(multiple).to.be.eq(1);


    });
    it('test plain3Pool can swapStable', async () => {
        await token2.approve(swapRouter.address, toWei("10000"));

        let times = Number((new Date().getTime() + 1000).toFixed(0));
        await swapRouter.swapStable(pool.address, 0, 1, "10000000", 0, dev.address, times);
        await swapRouter.swapStable(pool.address, 0, 2, "10000000", 0, dev.address, times);

        await swapRouter.swapStable(pool.address, 1, 0, "10000000", 0, dev.address, times);
        await swapRouter.swapStable(pool.address, 1, 2, "10000000", 0, dev.address, times);

        await swapRouter.swapStable(pool.address, 2, 0, "10000000", 0, dev.address, times);
        await swapRouter.swapStable(pool.address, 2, 1, "10000000", 0, dev.address, times);


    });
    it("transaction mining, single user swap, multi pool acceleration," +
        " receive reward", async () => {
        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        let dx = "1000000";

        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));
        await lock.createLock(toWei('10'), parseInt(eta));

        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('9990'));
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('299989990'));

        await swapMining.connect(dev).vote(1, [pool.address], [toWei("1")]);
        await swapMining.vote(2, [pool1.address], [toWei("1")]);

        //token0 -> token1
        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);
        await swapRouter.swapStable(pool1.address, 0, 1, dx, 0, owner.address, times);

        await swapMining.connect(dev).getReward(0);
        await swapMining.getReward(1);

        expect(await fxs.balanceOf(dev.address)).to.be.eq("9990288750000000003999");
        expect(await fxs.balanceOf(owner.address)).to.be.eq("299989990603750000000001999");

    });
    it("query the rewards before acceleration of a single pool", async () => {
        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        let dx = toWei('1');

        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));

        //token0 -> token1
        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);

        let info = await swapMining.rewardPoolInfo(0, dev.address);
        let infoMax = await swapMining.rewardPoolInfoMax(0, dev.address);

        let befReward = await fxs.balanceOf(dev.address);
        let multiple = infoMax.div(info);
        expect(multiple).to.be.eq(3);

        await swapMining.connect(dev).getReward(0);

        let aftReward = await fxs.balanceOf(dev.address);

        let diffReward = aftReward.sub(befReward);
        expect(diffReward).to.be.eq("236250000000003999");


    });
    it("query the rewards after acceleration of a single pool", async () => {
        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        let dx = toWei('1');

        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));
        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);

        let info = await swapMining.rewardPoolInfo(0, dev.address);
        let infoMax = await swapMining.rewardPoolInfoMax(0, dev.address);

        let multiple = infoMax.div(info);
        expect(multiple).to.be.eq(3);

        await swapMining.connect(dev).vote(1, [pool.address], [toWei('1')]);
        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);

        infoMax = await swapMining.rewardPoolInfoMax(0, dev.address);
        info = await swapMining.rewardPoolInfo(0, dev.address);

        let multiple1 = infoMax.div(info);
        expect(multiple1).to.be.eq(1);

        let befReward = await fxs.balanceOf(dev.address);

        await swapMining.connect(dev).getReward(0);

        let aftReward = await fxs.balanceOf(dev.address);

        let diffReward = aftReward.sub(befReward);
        expect(diffReward).to.be.eq("262500000000003999");

    });
    it("query the changes of rewards with different weights in multiple pools", async () => {
        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        let dx = "1000000";

        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);

        let infoMaxPool = await swapMining.rewardPoolInfoMax(0, dev.address);
        expect(infoMaxPool).to.be.eq("700000000000013333");

        let befReward = await fxs.balanceOf(dev.address);
        await swapMining.connect(dev).getReward(0);
        let aftReward = await fxs.balanceOf(dev.address);
        let diffPool = aftReward.sub(befReward);
        expect(diffPool).to.be.eq("223125000000003999");

        await swapRouter.connect(dev).swapStable(pool1.address, 0, 1, dx, 0, dev.address, times);

        let infoMaxPool1 = await swapMining.rewardPoolInfoMax(1, dev.address);
        expect(infoMaxPool1).to.be.eq("1575000000000006666");

        let bef1Reward = await fxs.balanceOf(dev.address);

        await swapMining.connect(dev).getReward(1);
        let aft1Reward = await fxs.balanceOf(dev.address);

        let diffPool1 = aft1Reward.sub(bef1Reward);
        expect(diffPool1).to.be.eq("498750000000001999");


    });
    it("receive multiple trading pool rewards at one time", async () => {
        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        let dx = toWei('1');

        //token0 -> token1
        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);

        let poolReward = await swapMining.rewardPoolInfo(0, dev.address);
        expect(poolReward).to.be.eq("210000000000003999");
        await swapRouter.connect(dev).swapStable(pool1.address, 0, 1, dx, 0, dev.address, times);

        let pool1Reward = await swapMining.rewardPoolInfo(1, dev.address);
        expect(pool1Reward).to.be.eq("446250000000001999");
        expect(await fxs.balanceOf(dev.address)).to.be.eq("10000000000000000000000");

        await swapMining.connect(dev).getRewardAll();
        expect(await fxs.balanceOf(dev.address)).to.be.eq("10000708750000000005998");

    });
    it("test pid =0, allocPoint = 200 reward", async () => {
        let info = await swapMining.poolInfo(0);
        expect(info[2]).to.be.eq("100");
        await swapMining.set(0, "200", true);
        info = await swapMining.poolInfo(0);
        expect(info[2]).to.be.eq("200");

        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));

        let dx = "1000000";

        //token0 -> token1
        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);
        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('10000'));

        await swapMining.connect(dev).getReward(0);
        expect(await fxs.balanceOf(dev.address)).to.be.eq("10000378000000000003999");


    });
    it("test tokenPerBlock,minTokenReward = 0", async () => {
        await swapMining.setMinTokenReward(0);
        expect(await swapMining.tokenPerBlock()).to.be.eq("10000");
        await swapMining.setTokenPerBlock(0, false);
        expect(await swapMining.tokenPerBlock()).to.be.eq(0);
        await swapMining.updatePool(0);
        expect(await swapMining.tokenPerBlock()).to.be.eq(0);

    });
    it("no exchange,no reward", async () => {
        let bef = await fxs.balanceOf(dev.address);
        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('10000'));

        await swapMining.connect(dev).getRewardAll();
        let aft = await fxs.balanceOf(dev.address);
        expect(aft).to.be.eq(bef);


    });


});