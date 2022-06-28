const $ = require('../lib/common');
const {time} = require('@openzeppelin/test-helpers');
const {waffle, ethers} = require("hardhat");
const {expect} = require("chai");
const {toWei, fromWei, toBN} = web3.utils;
const {Decimal} = require('decimal.js');
const WETH9 = require('../mock/WETH9.json');

const CRVFactory = require('../mock/mockPool/factory.json');
const FactoryAbi = require('../mock/mockPool/factory_abi.json');
const Plain3Balances = require('../mock/mockPool/Plain3Balances.json');
const PoolAbi = require('../mock/mockPool/3pool_abi.json');

const Registry = require("../mock/mockPool/Registry.json");
const PoolRegistry = require("../mock/mockPool/PoolRegistry.json");
const {deployContract} = waffle;
const gas = {gasLimit: "9550000"};

contract('swapMul', () => {
    beforeEach(async () => {
        [owner, dev, addr1, addr2] = await ethers.getSigners();
        zeroAddr = "0x0000000000000000000000000000000000000000";
        token0 = await $.mockToken("token0", "token0", 18, 0);
        token1 = await $.mockToken("token1", "token1", 18, 0);
        token2 = await $.mockToken("token2", "token2", 18, 0);

        await token0.mint(owner.address, toWei('100000'));
        await token0.mint(dev.address, toWei('100000'));
        await token0.mint(addr1.address, toWei('100000'));

        await token1.mint(owner.address, toWei('100000'));
        await token1.mint(dev.address, toWei('100000'));
        await token1.mint(addr1.address, toWei('100000'));

        await token2.mint(owner.address, toWei('100000'));
        await token2.mint(dev.address, toWei('100000'));
        await token2.mint(addr1.address, toWei('100000'));

        const {
            TestOracle,
            Operatable, CheckPermission, Stock, RStablecoin,
            Locker
        } = await $.setup();

        operatable = await Operatable.deploy();
        checkPermission = await CheckPermission.deploy(operatable.address);

        oracle = await TestOracle.deploy();
        fxs = await Stock.deploy(checkPermission.address, "fxs", "fxs", oracle.address);
        frax = await RStablecoin.deploy(checkPermission.address, "frax", "frax");

        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);
        await fxs.transfer(dev.address, toWei("10000"));
        await fxs.transfer(addr1.address, toWei("10000"));

        lock = await Locker.deploy(checkPermission.address, fxs.address, parseInt('1800'));

        plain3Balances = await deployContract(owner, {
            bytecode: Plain3Balances.bytecode,
            abi: PoolAbi.abi
        });

        weth9 = await deployContract(owner, {
            bytecode: WETH9.bytecode,
            abi: WETH9.abi,
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

        await token0.connect(addr1).approve(pool.address, toWei("10000"));
        await token1.connect(addr1).approve(pool.address, toWei("10000"));
        await token2.connect(addr1).approve(pool.address, toWei("10000"));

        await pool.add_liquidity([toWei('100'), toWei('100'), toWei('100')], 0, gas);
        const SwapRouter = await ethers.getContractFactory('SwapRouter');
        swapRouter = await SwapRouter.deploy(checkPermission.address, weth9.address);

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

        await lock.addBoosts(swapMining.address);
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

        await fxs.approve(lock.address, toWei('10000'));
        await fxs.connect(dev).approve(lock.address, toWei('10000'));
        await fxs.connect(addr1).approve(lock.address, toWei('10000'));

        await token0.approve(swapRouter.address, toWei('10000'));
        await token1.approve(swapRouter.address, toWei('10000'));
        await token0.connect(dev).approve(swapRouter.address, toWei('10000'));
        await token1.connect(dev).approve(swapRouter.address, toWei('10000'));
        await token0.connect(addr1).approve(swapRouter.address, toWei('10000'));
        await token1.connect(addr1).approve(swapRouter.address, toWei('10000'));


    });

    it("different transaction volumes,different acceleration times", async () => {
        let _duration = time.duration.days(1);

        await lock.createLock(toWei('1000'), parseInt(_duration));
        let tokenId1 = await lock.tokenId();
        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        let dx = toWei('0.5');

        //token0 -> token1
        await swapRouter.swapStable(pool.address, 0, 1, dx, 0, owner.address, times);
        await swapMining.vote(tokenId1, [pool.address], [toWei('10')]);

        await lock.connect(dev).createLock(toWei("1"), parseInt(_duration));
        let tokenId2 = await lock.tokenId();

        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, toWei('1'), 0, dev.address, times);
        await swapMining.connect(dev).vote(tokenId2, [pool.address], [toWei('10')]);

        let rewardPoolInfoMaxOwnerBef = fromWei(toBN(await swapMining.rewardPoolInfoMax(0, owner.address)));
        let rewardPoolInfoOwnerBef = fromWei(toBN(await swapMining.rewardPoolInfo(0, owner.address)));
        let rewardPoolInfoMaxDevBef = fromWei(toBN(await swapMining.rewardPoolInfoMax(0, dev.address)));
        let rewardPoolInfoDevBef = fromWei(toBN(await swapMining.rewardPoolInfo(0, dev.address)));

        expect(new Decimal(rewardPoolInfoMaxOwnerBef).toFixed(2)).to.be.eq("1.23");
        expect(new Decimal(rewardPoolInfoOwnerBef).toFixed(2)).to.be.eq("0.72");
        expect(new Decimal(rewardPoolInfoMaxDevBef).toFixed(2)).to.be.eq("2.45");
        expect(new Decimal(rewardPoolInfoDevBef).toFixed(2)).to.be.eq("0.74");

        await lock.connect(addr1).createLock(toWei("50"), parseInt(_duration));
        let tokenId3 = await lock.tokenId();

        await swapRouter.connect(addr1).swapStable(pool.address, 0, 1, toWei('2'), 0, addr1.address, times);
        await swapMining.connect(addr1).vote(tokenId3, [pool.address], [toWei('10')]);

        let rewardPoolInfoMaxOwner = fromWei(toBN(await swapMining.rewardPoolInfoMax(0, owner.address)));
        let rewardPoolInfoOwner = fromWei(toBN(await swapMining.rewardPoolInfo(0, owner.address)));
        let rewardPoolInfoMaxDev = fromWei(toBN(await swapMining.rewardPoolInfoMax(0, dev.address)));
        let rewardPoolInfoDev = fromWei(toBN(await swapMining.rewardPoolInfo(0, dev.address)));
        let rewardPoolInfoMaxAddr1 = fromWei(toBN(await swapMining.rewardPoolInfoMax(0, addr1.address)));
        let rewardPoolInfoAddr1 = fromWei(toBN(await swapMining.rewardPoolInfo(0, addr1.address)));

        expect(new Decimal(rewardPoolInfoMaxOwner).toFixed(2)).to.be.eq("0.60");
        expect(new Decimal(rewardPoolInfoOwner).toFixed(2)).to.be.eq("0.51");
        expect(new Decimal(rewardPoolInfoMaxDev).toFixed(2)).to.be.eq("1.20");
        expect(new Decimal(rewardPoolInfoDev).toFixed(2)).to.be.eq("0.36");
        expect(new Decimal(rewardPoolInfoMaxAddr1).toFixed(2)).to.be.eq("2.40");
        expect(new Decimal(rewardPoolInfoAddr1).toFixed(2)).to.be.eq("0.79");


        // mul will expired
        await time.increase(await time.duration.days(1));

        rewardPoolInfoMaxOwner = await swapMining.rewardPoolInfoMax(0, owner.address);
        rewardPoolInfoOwner = await swapMining.rewardPoolInfo(0, owner.address);
        rewardPoolInfoMaxDev = await swapMining.rewardPoolInfoMax(0, dev.address);
        rewardPoolInfoDev = await swapMining.rewardPoolInfo(0, dev.address);
        rewardPoolInfoMaxAddr1 = await swapMining.rewardPoolInfoMax(0, addr1.address);
        rewardPoolInfoAddr1 = await swapMining.rewardPoolInfo(0, addr1.address);

        let swapMulOwnerAft1 = rewardPoolInfoOwner / (rewardPoolInfoMaxOwner * 30 / 100)
        let swapMulDevAft1 = rewardPoolInfoDev / (rewardPoolInfoMaxDev * 30 / 100)
        let swapMulAddr1Aft1 = rewardPoolInfoAddr1 / (rewardPoolInfoMaxAddr1 * 30 / 100)

        expect(new Decimal(swapMulOwnerAft1).toFixed(2)).to.be.eq("1.00");
        expect(new Decimal(swapMulDevAft1).toFixed(2)).to.be.eq("1.00");
        expect(new Decimal(swapMulAddr1Aft1).toFixed(2)).to.be.eq("1.00");

    });
    it("same transaction volumes,same acceleration times", async () => {
        let _duration = time.duration.days(1);

        await lock.createLock(toWei('1000'), parseInt(_duration));
        let tokenId1 = await lock.tokenId();
        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        let dx = toWei('0.5');

        //token0 -> token1
        await swapRouter.swapStable(pool.address, 0, 1, dx, 0, owner.address, times);
        await swapMining.vote(tokenId1, [pool.address], [toWei('10')]);

        await lock.connect(dev).createLock(toWei("1"), parseInt(_duration));
        let tokenId2 = await lock.tokenId();

        await swapRouter.connect(dev).swapStable(pool.address, 0, 1, dx, 0, dev.address, times);
        await swapMining.connect(dev).vote(tokenId2, [pool.address], [toWei('10')]);

        let rewardPoolInfoMaxOwnerBef = fromWei(toBN(await swapMining.rewardPoolInfoMax(0, owner.address)));
        let rewardPoolInfoOwnerBef = fromWei(toBN(await swapMining.rewardPoolInfo(0, owner.address)));
        let rewardPoolInfoMaxDevBef = fromWei(toBN(await swapMining.rewardPoolInfoMax(0, dev.address)));
        let rewardPoolInfoDevBef = fromWei(toBN(await swapMining.rewardPoolInfo(0, dev.address)));

        expect(new Decimal(rewardPoolInfoMaxOwnerBef).toFixed(2)).to.be.eq("1.84");
        expect(new Decimal(rewardPoolInfoOwnerBef).toFixed(2)).to.be.eq("0.90");
        expect(new Decimal(rewardPoolInfoMaxDevBef).toFixed(2)).to.be.eq("1.84");
        expect(new Decimal(rewardPoolInfoDevBef).toFixed(2)).to.be.eq("0.55");

        await lock.connect(addr1).createLock(toWei("50"), parseInt(_duration));
        let tokenId3 = await lock.tokenId();

        await swapRouter.connect(addr1).swapStable(pool.address, 0, 1, dx, 0, addr1.address, times);
        await swapMining.connect(addr1).vote(tokenId3, [pool.address], [toWei('10')]);

        let rewardPoolInfoMaxOwner = fromWei(toBN(await swapMining.rewardPoolInfoMax(0, owner.address)));
        let rewardPoolInfoOwner = fromWei(toBN(await swapMining.rewardPoolInfo(0, owner.address)));
        let rewardPoolInfoMaxDev = fromWei(toBN(await swapMining.rewardPoolInfoMax(0, dev.address)));
        let rewardPoolInfoDev = fromWei(toBN(await swapMining.rewardPoolInfo(0, dev.address)));
        let rewardPoolInfoMaxAddr1 = fromWei(toBN(await swapMining.rewardPoolInfoMax(0, addr1.address)));
        let rewardPoolInfoAddr1 = fromWei(toBN(await swapMining.rewardPoolInfo(0, addr1.address)));

        expect(new Decimal(rewardPoolInfoMaxOwner).toFixed(2)).to.be.eq("1.40");
        expect(new Decimal(rewardPoolInfoOwner).toFixed(2)).to.be.eq("0.75");
        expect(new Decimal(rewardPoolInfoMaxDev).toFixed(2)).to.be.eq("1.40");
        expect(new Decimal(rewardPoolInfoDev).toFixed(2)).to.be.eq("0.42");
        expect(new Decimal(rewardPoolInfoMaxAddr1).toFixed(2)).to.be.eq("1.40");
        expect(new Decimal(rewardPoolInfoAddr1).toFixed(2)).to.be.eq("0.44");


    });

});
