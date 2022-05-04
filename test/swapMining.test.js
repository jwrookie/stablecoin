const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');

const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');
const gas = {gasLimit: "9550000"};

const CRVFactory = require('./mock/mockPool/factory.json');
const FactoryAbi = require('./mock/mockPool/factory_abi.json');
const Plain3Balances = require('./mock/mockPool/Plain3Balances.json');
const PoolAbi = require('./mock/mockPool/3pool_abi.json');
const Registry = require("./mock/mockPool/Registry.json");
const PoolRegistry = require("./mock/mockPool/PoolRegistry.json");
const WETH9 = require("./mock/WETH9.json");


contract('SwapMining', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        zeroAddr = "0x0000000000000000000000000000000000000000";
        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();
        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(operatable.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(operatable.address, "frax", "frax");

        const MockToken = await ethers.getContractFactory("MockToken");
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

        await token0.mint(dev.address, toWei("10"));
        await token1.mint(dev.address, toWei("10"));
        await token2.mint(dev.address, toWei("10"));

        let lastBlock = await time.latestBlock();
        //console.log("lastBlock:" + lastBlock);

        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);

        let eta = time.duration.days(1);
        const Locker = await ethers.getContractFactory('Locker');
        lock = await Locker.deploy(operatable.address, fxs.address, parseInt(eta));

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


        await frax.addPool(owner.address);
        await lock.addBoosts(boost.address);


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

        weth9 = await deployContract(owner, {
            bytecode: WETH9.bytecode,
            abi: WETH9.abi,
        });


        await registry.set_address(0, poolRegistry.address);

        crvFactory = await deployContract(owner, {
            bytecode: CRVFactory.bytecode,
            abi: FactoryAbi.abi,
        }, [owner.address, registry.address])


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


        // // create  token0 token1 token2
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
        //
        // await poolRegistry.add_pool(poolAddress, 3, poolAddress, 18, "test", gas);
        //
        await crvFactory.deploy_plain_pool(
            "3pool1",
            "3pool1",
            [poolAddress, token1.address, token2.address, zeroAddr],
            "2000",
            "4000000", 0, 0, gas);

        const SwapRouter = await ethers.getContractFactory('SwapRouter');
        swapRouter = await SwapRouter.deploy(weth9.address);


        const SwapMining = await ethers.getContractFactory('SwapMining');
        swapMining = await SwapMining.deploy(
            operatable.address,
            lock.address,
            fxs.address,
            crvFactory.address,
            swapRouter.address,
            "10000",
            parseInt(lastBlock),
            "10"
        );
        await frax.addPool(swapMining.address);
        await swapRouter.setSwapMining(swapMining.address);
        expect(await swapRouter.swapMining()).to.be.eq(swapMining.address)
        expect(await swapMining.router()).to.be.eq(swapRouter.address)


        await swapRouter.setSwapMining(swapMining.address);


        await swapMining.addPair(100, pool.address, true)

    });
    it('pending', async () => {
        await token0.connect(owner).approve(swapRouter.address, toWei('10000'))
        await token1.connect(owner).approve(swapRouter.address, toWei('10000'))

        expect(await pool.coins(0, gas)).to.be.eq(token0.address)
        expect(await pool.coins(1, gas)).to.be.eq(token1.address)

        devToken0Befo = await token0.balanceOf(owner.address)
        devToken1Befo = await token1.balanceOf(owner.address)
        poolToken0Bef = await pool.balances(0, gas);
        poolToken1Bef = await pool.balances(1, gas);

        const times = Number((new Date().getTime() / 1000 + 1000).toFixed(0))
        let dx = "1000000"

        await swapRouter.connect(owner).swapStable(pool.address, 0, 1, dx, 0, owner.address, times)


        const reword = await swapMining.rewardInfo(owner.address)
        expect(reword).to.be.eq('157500000000000000')


    });


});