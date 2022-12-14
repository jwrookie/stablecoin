const CRVFactory = require('../mock/mockPool/factory.json');
const FactoryAbi = require('../mock/mockPool/factory_abi.json');
const Plain3Balances = require('../mock/mockPool/Plain3Balances.json');
const PoolAbi = require('../mock/mockPool/3pool_abi.json');
const Registry = require("../mock/mockPool/Registry.json");
const PoolRegistry = require("../mock/mockPool/CryptoRegistry.json");
const MetaPool = require('../mock/mockPool/MetaUSDBalances.json');
const MetaPoolAbi = require('../mock/mockPool/meta_pool.json');

const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');
const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');
const WETH9 = require('../mock/WETH9.json');
const gas = {gasLimit: "9550000"};
const {expectRevert, time} = require('@openzeppelin/test-helpers');
contract('3metaPool', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();


        const MockToken = await ethers.getContractFactory("MockToken")

        usdc = await MockToken.deploy("usdc", "usdc", 18, toWei('10'));
        busd = await MockToken.deploy("busd", "busd", 18, toWei('10'));
        token0 = await MockToken.deploy("token0", "token0", 18, toWei('10'));
        token1 = await MockToken.deploy("token1", "token1", 18, toWei('10'));
        token2 = await MockToken.deploy("token2", "token2", 18, toWei('10'));
        token3 = await MockToken.deploy("token3", "token3", 18, toWei('10'));

        await token0.mint(owner.address, toWei("10000"));
        await token1.mint(owner.address, toWei("10000"));
        await token2.mint(owner.address, toWei("10000"));
        await token3.mint(owner.address, toWei("10000"));

        Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();

        const CheckPermission = await ethers.getContractFactory("CheckPermission");
        checkPermission = await CheckPermission.deploy(operatable.address);

        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();


        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(checkPermission.address, "fxs", "fxs", oracle.address);
        await fxs.transfer(addr1.address, "299000000000000000000000000");
        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(checkPermission.address, "frax", "frax");


        weth9 = await deployContract(owner, {
            bytecode: WETH9.bytecode,
            abi: WETH9.abi,
        });

        const SwapRouter = await ethers.getContractFactory('SwapRouter');
        swapRouter = await SwapRouter.deploy(checkPermission.address, weth9.address);

        expect(await weth9.balanceOf(owner.address)).to.be.eq(0);
        await weth9.deposit({value: toWei('10')});

        expect(await weth9.balanceOf(owner.address)).to.be.eq(toWei('10'));

        let lastBlock = await time.latestBlock();
        //console.log("lastBlock:" + lastBlock);

        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);
        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        let eta = time.duration.days(1);
        const Locker = await ethers.getContractFactory('Locker');
        lock = await Locker.deploy(checkPermission.address, fxs.address, parseInt(eta));

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
        }, [registry.address]);


        await registry.set_address(0, poolRegistry.address);

        crvFactory = await deployContract(owner, {
            bytecode: CRVFactory.bytecode,
            abi: FactoryAbi.abi,
        }, [owner.address, registry.address])
        zeroAddr = "0x0000000000000000000000000000000000000000";

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
                zeroAddr])

        // console.log((await crvFactory.get_fee_receiver(owner.address)));
        //create a pool[token0,token1,token2]
        await crvFactory.deploy_plain_pool(
            "3TestPo",
            "3TPo",
            [token0.address, token1.address, token2.address, zeroAddr],
            "2000",
            "4000000", 0, 0);
        poolAddress = await crvFactory.pool_list(0, gas);
        pool = await plain3Balances.attach(poolAddress);
        await token0.approve(pool.address, toWei("10000"))
        await token1.approve(pool.address, toWei("10000"))
        await token2.approve(pool.address, toWei("10000"))


        metaPool = await deployContract(owner, {
            bytecode: MetaPool.bytecode,
            abi: MetaPoolAbi.abi
        }, [poolAddress, poolAddress, [token0.address, token1.address, token2.address]]);

        await pool.add_liquidity([toWei('1'), toWei('1'), toWei('1')], 0, gas);


        await poolRegistry.add_pool(poolAddress, 3, poolAddress, 18, "test", gas);
        await crvFactory.add_base_pool(poolAddress, owner.address, 3, [
            metaPool.address,
            zeroAddr,
            zeroAddr,
            zeroAddr,
            zeroAddr,
            zeroAddr,
            zeroAddr,
            zeroAddr,
            zeroAddr,
            zeroAddr]);

        await crvFactory.set_metapool_implementations(poolAddress, [
            metaPool.address,
            zeroAddr,
            zeroAddr,
            zeroAddr,
            zeroAddr,
            zeroAddr,
            zeroAddr,
            zeroAddr,
            zeroAddr,
            zeroAddr]);

        implementAddress = await crvFactory.metapool_implementations(poolAddress, gas);
        expect(implementAddress[0]).to.be.eq(metaPool.address);

        //create a metaPool[token3,pool]
        await crvFactory.deploy_metapool(
            poolAddress,
            poolAddress,
            [token0.address, token1.address, token2.address],
            "3Test",
            "3TPo",
            token3.address,
            "2000",
            "4000000",
            "0", gas);
        admin = await crvFactory.admin(gas);
        expect(admin).to.be.eq(owner.address);

        poolAddress1 = await crvFactory.pool_list(1, gas);
        //console.log("poolAddress1" + poolAddress1);

        pool1 = await metaPool.attach(poolAddress1);
        expect(poolAddress1).to.be.eq(pool1.address);

        await token3.approve(pool1.address, toWei("10000"));
        await pool.approve(pool1.address, toWei("10000"));


        await pool1.add_liquidity([toWei('1'), toWei('1')], 0, gas);
        const n_coins = await pool.n_coins()
        expect(n_coins).to.be.eq(3);
        coins1 = await pool1.coins(0, gas);

        expect(coins1).to.be.eq(token3.address);
        coins2 = await pool1.coins(1, gas);
        expect(coins2).to.be.eq(pool.address);


        await token0.mint(dev.address, toWei('100'));
        await token1.mint(dev.address, toWei('100'));
        await token2.mint(dev.address, toWei('100'));
        await token3.mint(dev.address, toWei('100'));

        await token0.connect(dev).approve(pool.address, toWei("10000"));
        await token1.connect(dev).approve(pool.address, toWei("10000"));
        await token2.connect(dev).approve(pool.address, toWei("10000"));

        await pool.connect(dev).add_liquidity([toWei('1'), toWei('1'), toWei('1')], 0, gas);

        await token3.connect(dev).approve(pool1.address, toWei("10000"));
        await pool.connect(dev).approve(pool1.address, toWei("10000"));

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
        await swapMining.addPair(100, pool1.address, true);
        await lock.addBoosts(swapMining.address);
        await fxs.addPool(swapMining.address);
        await fxs.approve(lock.address, toWei('100000'));

        await token0.approve(swapRouter.address, toWei("10000"));
        await token1.approve(swapRouter.address, toWei("10000"));
        await token3.approve(swapRouter.address, toWei("10000"));
        await token2.approve(swapRouter.address, toWei("10000"));
        await pool.approve(swapRouter.address, toWei('100000'));

    });
    it('test metaPool swapMeta have reward', async () => {
        let times = Number((new Date().getTime() + 1000).toFixed(0));
        await swapRouter.swapMeta(pool1.address, 0, 1, "10000000", 0, owner.address, times);
        let reword = await swapMining.rewardInfo(owner.address);

        let bef = await fxs.balanceOf(owner.address);

        await swapMining.getReward(0);
        let aft = await fxs.balanceOf(owner.address);

        let diff = aft.sub(bef);
        expect(diff).to.be.eq(reword.add("52500000000000000"));

        await swapRouter.swapMeta(pool1.address, 1, 0, "10000000", 0, owner.address, times);

        reword = await swapMining.rewardInfo(owner.address);
        await swapMining.getReward(0);

        let aft1 = await fxs.balanceOf(owner.address);
        let diff1 = aft1.sub(aft);
        expect(diff1).to.be.eq(reword.mul(2));


    });
    it('test vote without swapMining', async () => {
        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));

        let dx = "1000000";
        await swapRouter.swapMeta(pool1.address, 0, 1, dx, 0, owner.address, times);
        let eta = time.duration.days(7);
        await lock.createLock(toWei('10'), parseInt(eta));

        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('999990'));
        await swapMining.getReward(0);
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('999990.5775'));


    });
    it('test vote with swapMining', async () => {
        let times = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        let dx = "1000000";

        await swapRouter.swapMeta(pool1.address, 0, 1, dx, 0, owner.address, times);

        let eta = time.duration.days(7);
        await lock.createLock(toWei('10'), parseInt(eta));

        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('999990'));

        await swapMining.vote(1, [pool.address], [toWei("1")]);

        await swapMining.getReward(0);

        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('999990.63'));


    });
    it('test metaPool can swapMeta', async () => {
        let times = Number((new Date().getTime() + 1000).toFixed(0));
        await swapRouter.swapMeta(pool1.address, 0, 1, "10000000", 0, owner.address, times);
        await swapRouter.swapMeta(pool1.address, 0, 2, "10000000", 0, owner.address, times);
        await swapRouter.swapMeta(pool1.address, 0, 3, "10000000", 0, owner.address, times);


        await swapRouter.swapMeta(pool1.address, 1, 0, "10000000", 0, owner.address, times);
        await swapRouter.swapMeta(pool1.address, 1, 2, "10000000", 0, owner.address, times);
        await swapRouter.swapMeta(pool1.address, 1, 3, "10000000", 0, owner.address, times);

        await swapRouter.swapMeta(pool1.address, 2, 0, "10000000", 0, owner.address, times);
        await swapRouter.swapMeta(pool1.address, 2, 1, "10000000", 0, owner.address, times);
        await swapRouter.swapMeta(pool1.address, 2, 3, "10000000", 0, owner.address, times);

        await swapRouter.swapMeta(pool1.address, 3, 0, "10000000", 0, owner.address, times);
        await swapRouter.swapMeta(pool1.address, 3, 1, "10000000", 0, owner.address, times);
        await swapRouter.swapMeta(pool1.address, 3, 2, "10000000", 0, owner.address, times);


    });

});