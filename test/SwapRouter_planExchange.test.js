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
    before(async () => {
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
        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(operatable.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(operatable.address, "frax", "frax");

        let lastBlock = await time.latestBlock();
        let eta = time.duration.days(1);
        const Locker = await ethers.getContractFactory('Locker');
        lock = await Locker.deploy(operatable.address, fxs.address, parseInt(eta));


        const SwapMining = await ethers.getContractFactory('SwapMining');
        swapMining = await SwapMining.deploy(
            operatable.address,
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
            operatable.address,
            lock.address,
            gaugeFactory.address,
            fxs.address,
            toWei('1'),
            parseInt(lastBlock),
            "1000"
        );

        await fxs.addPool(boost.address);
        await lock.addBoosts(boost.address);
        await fxs.connect(dev).approve(lock.address, toWei('10000'));
        await fxs.approve(lock.address, toWei('10000'));
        await fxs.transfer(dev.address, toWei('10000'));

        await boost.createGauge(pool.address, "100", true);

        gaugeAddr = await boost.gauges(pool.address);

        const Gauge = await ethers.getContractFactory('Gauge');
        gauge_pool = await Gauge.attach(gaugeAddr);
        expect(gauge_pool.address).to.be.eq(gaugeAddr);

        expect(await boost.poolLength()).to.be.eq(1);

        expect(await boost.isGauge(gauge_pool.address)).to.be.eq(true);
        expect(await boost.poolForGauge(gauge_pool.address)).to.be.eq(pool.address);

        await fxs.addPool(swapMining.address);


    });
    it('swapRouter exchage  swapStable plan  token0 => token1', async () => {

        await token0.connect(dev).approve(swapRouter.address, toWei('10000'));
        // await token1.connect(dev).approve(swapRouter.address, toWei('10000'));
        expect(await pool.coins(0, gas)).to.be.eq(token0.address);
        expect(await pool.coins(1, gas)).to.be.eq(token1.address);

        devToken0Befo = await token0.balanceOf(dev.address);
        devToken1Befo = await token1.balanceOf(dev.address);
        poolToken0Bef = await pool.balances(0, gas);
        poolToken1Bef = await pool.balances(1, gas);

        const times = Number((new Date().getTime() + 1000).toFixed(0));
        let dx = "1000000";

        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, toWei('10'), 0, dev.address, times);

        devToken0Aft = await token0.balanceOf(dev.address);
        devToken1Aft = await token1.balanceOf(dev.address);
        poolToken0aft = await pool.balances(0, gas);
        poolToken1aft = await pool.balances(1, gas);

        // expect(devToken0Aft).to.be.eq(BigNumber.from(devToken0Befo).sub(dx));
        // expect(devToken1Aft).to.be.eq(BigNumber.from(devToken1Befo).add("999600"));
        // expect(poolToken0aft).to.be.eq(BigNumber.from(poolToken0Bef).add(dx));
        // expect(poolToken1aft).to.be.eq(BigNumber.from(poolToken1Bef).sub('999799'));


        let reword = await swapMining.rewardInfo(dev.address);
        console.log("reword:" + reword);
        //   console.log("dev:"+await fxs.balanceOf(dev.address));
        // await swapMining.connect(dev).getReward(0);
        // reword = await swapMining.rewardInfo(dev.address);
        // console.log("reword:"+reword);
        // console.log("dev:"+await fxs.balanceOf(dev.address));
        // expect(reword).to.be.eq('157500000000000000')

        await fxs.connect(dev).approve(lock.address, toWei('10000000'));
        let eta = time.duration.days(1);
        // console.log("eta:" + parseInt(eta));

        await lock.connect(dev).create_lock(toWei('1000'), parseInt(eta));

        console.log("weights:" + await boost.weights(pool.address))

        await boost.connect(dev).vote(1, [pool.address], [toWei('1')])
        console.log("weights:" + await boost.weights(pool.address))

        let info = await swapMining.poolInfo(0)
        //       let user = await swapMining.userInfo(0,dev.address)
        //
        //
        console.log("pool quantity:" + info[1])
        //      console.log("allocSwapTokenAmount:"+info[3])
        //       console.log("user quantity:"+user[0])
        //
        console.log("useVe:" + await lock.balanceOfNFT(1))
        console.log("totalWeight:" + await boost.totalWeight())
        let useVe = await lock.balanceOfNFT(1);
        let totalWeight = await boost.totalWeight()
        console.log("userSub:" + (info[1] * useVe / totalWeight)* 0.7)

        //   await time.increase(time.duration.days(3));
        //
        // await swapMining.connect(dev).getReward(0);
        //
        //  let lockBlock = await time.latestBlock();
        // await time.advanceBlockTo(parseInt(lockBlock) + 10);

        reword = await swapMining.rewardInfo(dev.address);
        console.log("reword:" + reword)

    });


});