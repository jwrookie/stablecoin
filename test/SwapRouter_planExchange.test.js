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

        await token0.approve(pool.address, toWei("10000"))
        await token1.approve(pool.address, toWei("10000"))
        await token2.approve(pool.address, toWei("10000"))

        await pool.add_liquidity([toWei('100'), toWei('100'), toWei('100')], 0, gas)

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
        await swapMining.addPair(100, pool.address, true)

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

        await swapController.addPool(pool.address)


    });
    //  it('test swapStable have reward', async () => {
    //     await token0.connect(dev).approve(swapRouter.address, toWei('10000'))
    //     await token1.connect(dev).approve(swapRouter.address, toWei('10000'))
    //
    //     let times = Number((new Date().getTime() / 1000 + 2600000).toFixed(0));
    //
    //     let dx = "1000000";
    //
    //     //token0 -> token1
    //     await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);
    //     let reword = await swapMining.rewardInfo(dev.address);
    //     let bef = await fxs.balanceOf(dev.address);
    //
    //     await swapMining.connect(dev).getReward(0);
    //     let aft = await fxs.balanceOf(dev.address);
    //
    //     let diff = aft.sub(bef)
    //     expect(diff).to.be.eq(reword.add("52500000000000000"));
    //
    //     //token1 -> token0
    //     await swapRouter.connect(dev).swapStable(pool.address, 1, 0, dx, 0, dev.address, times);
    //
    //     reword = await swapMining.rewardInfo(dev.address);
    //     await swapMining.connect(dev).getReward(0);
    //
    //     let aft1 = await fxs.balanceOf(dev.address);
    //     let diff1 = aft1.sub(aft);
    //     expect(diff1).to.be.eq(reword.mul(2));
    //
    //
    // });
    it("'test allocPoint", async () => {

        let eta = time.duration.days(7);
        await lock.connect(dev).create_lock(toWei('10'), parseInt(eta));

        let info = await swapMining.poolInfo(0)
        console.log("allocPoint:" + info[2])

        await swapMining.connect(dev).vote(1, [pool.address], [toWei("1")]);
        info = await swapMining.poolInfo(0)
        console.log("allocPoint:" + info[2])

        // await swapController.connect(dev).vote(1, pool.address);
        // info = await swapMining.poolInfo(0)
        // console.log("allocPoint:" + info[2])


    });
    // it('swapStable have reward', async () => {
    //     await token0.connect(dev).approve(swapRouter.address, toWei('10000'))
    //     await token1.connect(dev).approve(swapRouter.address, toWei('10000'))
    //
    //     let times = Number((new Date().getTime() / 1000 + 2600000).toFixed(0));
    //
    //     let dx = "1000000";
    //
    //
    //     //token0 -> token1
    //     await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);
    //     // let reword = await swapMining.rewardInfo(dev.address);
    //     // let bef = await fxs.balanceOf(dev.address);
    //     let eta = time.duration.days(7);
    //     await lock.connect(dev).create_lock(toWei('10'), parseInt(eta));
    //
    //       await swapMining.connect(dev).getReward(0);
    //
    //     // await swapMining.connect(dev).getReward(0);
    //     // let aft = await fxs.balanceOf(dev.address);
    //     //
    //     // let diff = aft.sub(bef)
    //     // expect(diff).to.be.eq(reword.add("52500000000000000"));
    //     //
    //     // //token1 -> token0
    //     // await swapRouter.connect(dev).swapStable(pool.address, 1, 0, dx, 0, dev.address, times);
    //     //
    //     // reword = await swapMining.rewardInfo(dev.address);
    //     // await swapMining.connect(dev).getReward(0);
    //     //
    //     // let aft1 = await fxs.balanceOf(dev.address);
    //     // let diff1 = aft1.sub(aft);
    //     // expect(diff1).to.be.eq(reword.mul(2));
    //     console.log("reward:" + await fxs.balanceOf(dev.address))
    //
    //
    // });
    // it('test swapStable have reward', async () => {
    //     await token0.connect(dev).approve(swapRouter.address, toWei('10000'))
    //     await token1.connect(dev).approve(swapRouter.address, toWei('10000'))
    //
    //     let times = Number((new Date().getTime() / 1000 + 2600000).toFixed(0));
    //
    //     let dx = "1000000";
    //     let eta = time.duration.days(7);
    //     await lock.connect(dev).create_lock(toWei('10'), parseInt(eta));
    //
    //
    //     await swapMining.connect(dev).vote(1, [pool.address], [toWei("1")]);
    //
    //     //token0 -> token1
    //     await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);
    //
    //     await swapMining.connect(dev).getReward(0);
    //
    //
    //     console.log("reward:" + await fxs.balanceOf(dev.address))
    //
    //
    // });
    // it('test plain3Pool can swapStable', async () => {
    //     await token0.approve(swapRouter.address, toWei("10000"));
    //     await token1.approve(swapRouter.address, toWei("10000"));
    //     await token2.approve(swapRouter.address, toWei("10000"));
    //
    //
    //     let times = Number((new Date().getTime() + 1000).toFixed(0));
    //     await swapRouter.swapStable(pool.address, 0, 1, "10000000", 0, dev.address, times);
    //     await swapRouter.swapStable(pool.address, 0, 2, "10000000", 0, dev.address, times);
    //
    //     await swapRouter.swapStable(pool.address, 1, 0, "10000000", 0, dev.address, times);
    //     await swapRouter.swapStable(pool.address, 1, 2, "10000000", 0, dev.address, times);
    //
    //     await swapRouter.swapStable(pool.address, 2, 0, "10000000", 0, dev.address, times);
    //     await swapRouter.swapStable(pool.address, 2, 1, "10000000", 0, dev.address, times);
    //
    //
    // });


});