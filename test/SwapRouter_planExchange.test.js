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
contract('SwapRouter', () => {
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

        const SwapRouter = await ethers.getContractFactory('SwapRouter');
        swapRouter = await SwapRouter.deploy(weth9.address);

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

        await crvFactory.deploy_plain_pool(
            "3pool1",
            "3pool1",
            [poolAddress, token1.address, token2.address, zeroAddr],
            "2000",
            "4000000", 0, 0, gas);
        mulPoolAddress = await crvFactory.pool_list(1, gas);

        mulPool = await plain3Balances.attach(mulPoolAddress);
        await pool.approve(mulPool.address, toWei("10000"))
        await token1.approve(mulPool.address, toWei("10000"))
        await token2.approve(mulPool.address, toWei("10000"))

        await mulPool.add_liquidity([toWei('100'), toWei('100'), toWei('100')], 0, gas)


        const Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();

        const CheckPermission = await ethers.getContractFactory("CheckPermission");
        checkPermission = await CheckPermission.deploy(operatable.address);

        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(checkPermission.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(checkPermission.address, "frax", "frax");

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
        gaugeFactory = await GaugeFactory.deploy(operatable.address);

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
        //
        await fxs.addPool(boost.address);
        // await lock.addBoosts(boost.address);
        await lock.addBoosts(swapMining.address);

        await fxs.connect(dev).approve(lock.address, toWei('10000'));
        await fxs.approve(lock.address, toWei('10000'));
        await fxs.transfer(dev.address, toWei('10000'));

        await boost.createGauge(pool.address, "100", true);
        await boost.createGauge(token1.address, "100", true);

        gaugeAddr = await boost.gauges(pool.address);
        gaugeAddr1 = await boost.gauges(token1.address);

        const Gauge = await ethers.getContractFactory('Gauge');
        gauge_pool = await Gauge.attach(gaugeAddr);
        gauge_token1 = await Gauge.attach(gaugeAddr1);
        expect(gauge_pool.address).to.be.eq(gaugeAddr);
        expect(gauge_token1.address).to.be.eq(gaugeAddr1);

        expect(await boost.poolLength()).to.be.eq(2);

        expect(await boost.isGauge(gauge_pool.address)).to.be.eq(true);
        expect(await boost.poolForGauge(gauge_pool.address)).to.be.eq(pool.address);

        await fxs.addPool(swapMining.address);
        const SwapController = await ethers.getContractFactory('SwapController');
        swapController = await SwapController.deploy(
            checkPermission.address,
            boost.address,
            lock.address,
            "10",
        );
        await boost.addController(swapController.address);
        await lock.addBoosts(swapController.address);
        await lock.addBoosts(boost.address);
        await fxs.connect(dev).approve(gaugeAddr1, toWei('10000000'))
        await token1.connect(dev).approve(gaugeAddr1, toWei('10000000'))
        await swapController.addPool(pool.address);
        await token0.connect(dev).approve(swapRouter.address, toWei('10000'));
        await token1.connect(dev).approve(swapRouter.address, toWei('10000'));

        await fxs.connect(dev).approve(lock.address, toWei('10000000'));


    });
    it('liquidity mining and transaction mining acceleration failure', async () => {
        let eta = time.duration.days(7);
        // console.log("eta:" + parseInt(eta));

        await lock.connect(dev).create_lock(toWei('10'), parseInt(eta));
        await gauge_token1.connect(dev).deposit("1000", 1);

        // let times = Number((new Date().getTime() + 1000).toFixed(0));
        // let dx = "1000000";
        //
        // await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);

        await swapMining.connect(dev).vote(1, [pool.address], [toWei('1')])
        await expect(boost.connect(dev).vote(1, [token1.address], [toWei('1')])).to
            .be.revertedWith("tokenId voted");


    });
    // it('liquidity mining and transaction mining acceleration failure', async () => {
    //     await token0.connect(dev).approve(swapRouter.address, toWei('10000'));
    //     await token0.approve(swapRouter.address, toWei('10000'));
    //     await token1.connect(dev).approve(swapRouter.address, toWei('10000'));
    //
    //     expect(await pool.coins(0, gas)).to.be.eq(token0.address);
    //     expect(await pool.coins(1, gas)).to.be.eq(token1.address);
    //
    //     devToken0Befo = await token0.balanceOf(dev.address);
    //     devToken1Befo = await token1.balanceOf(dev.address);
    //     poolToken0Bef = await pool.balances(0, gas);
    //     poolToken1Bef = await pool.balances(1, gas);
    //
    //     await fxs.connect(dev).approve(lock.address, toWei('10000000'));
    //     await fxs.approve(lock.address, toWei('10000000'));
    //     let eta = time.duration.days(7);
    //     // console.log("eta:" + parseInt(eta));
    //
    //     await lock.connect(dev).create_lock(toWei('10'), parseInt(eta));
    //     await lock.create_lock(toWei('10'), parseInt(eta));
    //     await gauge_token1.connect(dev).deposit("1000", 1);
    //
    //     const times = Number((new Date().getTime() + 1000).toFixed(0));
    //     let dx = "1000000";
    //
    //     await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);
    //
    //
    //     //console.log("dev:" + await fxs.balanceOf(dev.address))
    //     // let reword = await swapMining.rewardInfo(dev.address);
    //     // let pend = await swapMining.pending(0, dev.address);
    //     // expect(reword).to.be.eq("2640000000000000000");
    //     // console.log("reword:" + reword)
    //     // console.log("pend:" + pend)
    //
    //     await swapMining.connect(dev).vote(1, [pool.address], [toWei('1')])
    //
    //
    //     await swapMining.connect(dev).getReward(0);
    //     //console.log("get reward befor blocknum:" + await getCurrentBlock());
    //     //console.log("dev:" + await fxs.balanceOf(dev.address))
    //
    //
    //     await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);
    //     //  let lockBlock = await time.latestBlock();
    //     // await time.advanceBlockTo(parseInt(lockBlock) + 10);
    //
    //     reword = await swapMining.rewardInfo(dev.address);
    //     pend = await swapMining.pending(0, dev.address);
    //     // console.log("reword:" + reword)
    //     // console.log("pend:" + pend)
    //     // //expect(reword).to.be.eq("240000000000000000");
    //     // console.log("get reward befor blocknum:" + await getCurrentBlock());
    //     await swapMining.connect(dev).getReward(0);
    //    // console.log("dev:" + await fxs.balanceOf(dev.address))
    //
    //    await boost.connect(dev).reset(1)
    //
    //      await swapController.connect(dev).vote(1, pool.address);
    //        // await swapMining.connect(dev).vote(1, [pool.address], [toWei('1')]);
    //
    //
    //     //console.log("weights:" + await boost.weights(pool.address))
    //     // await swapController.addPool(pool.address);
    //     // //  expect(await lock.voted(1)).to.be.eq(true)
    //     // //  await swapController.reset(1)
    //     // // // await lock.abstain(1)
    //     // //  expect(await lock.voted(1)).to.be.eq(false)
    //     //
    //     // await swapController.vote(2, pool.address);
    //     // // await swapController.connect(dev).vote(1, pool.address);
    //     // console.log("weights:" + await swapController.weights(pool.address))
    //
    //
    //   //  await expect(boost.connect(dev).vote(1, [token1.address], [toWei('1')])).to.be.revertedWith("tokenId voted");
    //
    //
    // });
    it('transaction mining users can accelerate, reset and vote again', async () => {
        let eta = time.duration.days(7);
        // console.log("eta:" + parseInt(eta));

        await lock.connect(dev).create_lock(toWei('10'), parseInt(eta));
        // await boost.connect(dev).vote(1,[ pool.address], [toWei('1')]);
        //
        // await boost.connect(dev).reset(1);
        let info = await swapMining.poolInfo(0)
        //   console.log(""+await )

        expect(info[2]).to.be.eq("100");
        await swapController.connect(dev).vote(1, pool.address);
        let result = await swapController.getUserInfo(1)
        console.log("poolVote.pool:" + result[0])
        console.log("poolVote.lastUse:" + result[1])
        expect(info[2]).to.be.eq("100");

    });


});