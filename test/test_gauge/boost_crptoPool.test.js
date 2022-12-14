const Registry = require('../mock/mockPool/Registry.json');
const CryptoRegistry = require('../mock/mockPool/CryptoRegistry.json');
const CurveCryptoSwap2ETH = require('../mock/mockPool/CurveCryptoSwap2ETH.json');
const CurveCryptoSwap2ETHAbi = require('../mock/mockPool/curve_crypto_swap2_eth_abi.json');
const CurveTokenV5 = require('../mock/mockPool/CurveTokenV5.json');
const CurveTokenV5Abi = require('../mock/mockPool/curve_token_v5_abi.json');
const CryptoFactory = require('../mock/mockPool/CryptoFactory.json');
const CryptoFactoryAbi = require('../mock/mockPool/crpto_factory_abi.json');
const WETH = require('../mock/WETH9.json');

const {deployContract} = require('ethereum-waffle');
const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers} = require('hardhat');
const {expect} = require('chai');
const {BigNumber} = require('ethers');
const {toWei} = web3.utils;
const GAS = {gasLimit: "9550000"};

contract('Boost crypto pool', async function () {
    beforeEach(async function () {
        [owner, dev, addr1] = await ethers.getSigners();
        zeroAddr = "0x0000000000000000000000000000000000000000";
        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        weth = await deployContract(owner, {
            bytecode: WETH.bytecode,
            abi: WETH.abi,
        });

        await weth.deposit({value: toWei('10')});

        registry = await deployContract(owner, {
            bytecode: Registry.bytecode,
            abi: Registry.abi
        }, [owner.address]);

        cryptoRegistry = await deployContract(owner, {
            bytecode: CryptoRegistry.bytecode,
            abi: CryptoRegistry.abi
        }, [registry.address]);


        await registry.set_address(0, cryptoRegistry.address);

        curveCryptoSwap = await deployContract(owner, {
            bytecode: CurveCryptoSwap2ETH.bytecode,
            abi: CurveCryptoSwap2ETHAbi.abi
        }, [weth.address]);


        curveToken = await deployContract(owner, {
            bytecode: CurveTokenV5.bytecode,
            abi: CurveTokenV5Abi.abi
        });

        crvFactory = await deployContract(owner, {
            bytecode: CryptoFactory.bytecode,
            abi: CryptoFactoryAbi.abi,
        }, [owner.address,
            curveCryptoSwap.address,
            curveToken.address,
            zeroAddr,
            weth.address]);

        const Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(operatable.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(operatable.address, "frax", "frax");

        const MockToken = await ethers.getContractFactory("MockToken");
        usdc = await MockToken.deploy("usdc", "usdc", 18, toWei('10'));
        busd = await MockToken.deploy("busd", "busd", 18, toWei('10'));
        crv = await MockToken.deploy("crv", "crv", 18, toWei('10'));

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

        const Timelock = await ethers.getContractFactory('Timelock');
        timelock = await Timelock.deploy(owner.address, "259200");

        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        const PoolLibrary = await ethers.getContractFactory('PoolLibrary')
        poolLibrary = await PoolLibrary.deploy();

        const PoolUSD = await ethers.getContractFactory('PoolUSD', {
            libraries: {
                PoolLibrary: poolLibrary.address,
            },
        });
        usdcPool = await PoolUSD.deploy(operatable.address, frax.address, fxs.address, usdc.address, toWei('10000000000'));
        expect(await usdcPool.usdAddress()).to.be.eq(usdc.address);

        await frax.addPool(usdcPool.address);

        await crvFactory.deploy_pool(
            "3TestPo",
            "3TPo",
            [token0.address, token1.address],
            3600000,
            toWei("0.00028"),
            "5000000",
            "40000000",
            10 ** 10,
            toWei("0.012"),
            "5500000000000",
            0,
            3600, toWei('0.01'));
        poolAddress = await crvFactory.pool_list(0);
        pool = await curveCryptoSwap.attach(poolAddress);

        expect(pool.address).to.be.eq(poolAddress);

        await token0.approve(pool.address, toWei("10000"));
        await token1.approve(pool.address, toWei("10000"));
        await token2.approve(pool.address, toWei("10000"));

        await pool.add_liquidity([toWei('10'), toWei('10')], 0, false, owner.address, {gasLimit: "3250000",});

        lpAddress = await crvFactory.get_token(pool.address);
        lp = await curveToken.attach(lpAddress);

        let eta = time.duration.days(1);
        const Locker = await ethers.getContractFactory('Locker');
        lock = await Locker.deploy(operatable.address, fxs.address, parseInt(eta));


        const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
        gaugeFactory = await GaugeFactory.deploy(operatable.address);
        let lockBlock = await time.latestBlock();

        Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            operatable.address,
            lock.address,
            gaugeFactory.address,
            fxs.address,
            "10000",
            parseInt(lockBlock),
            "1000"
        );

        await fxs.addPool(boost.address);
        await lock.addBoosts(boost.address);
        await fxs.approve(lock.address, toWei('10000'));

       // await expectRevert(boost.createGauge(pool.address, "100", true), " function returned an unexpected amount of data");

        //todo add token for pool
        // gaugeAddr = await boost.gauges(pool.address);
        //
        // const Gauge = await ethers.getContractFactory('Gauge');
        // gauge_pool = await Gauge.attach(gaugeAddr);
        // expect(gauge_pool.address).to.be.eq(gaugeAddr);
        //
        // expect(await boost.poolLength()).to.be.eq(1);
        //
        // expect(await boost.isGauge(gauge_pool.address)).to.be.eq(true);
        // expect(await boost.poolForGauge(gauge_pool.address)).to.be.eq(pool.address);
        // await busd.mint(dev.address, toWei('100'));

        // gaugeAddr1 = await boost.gauges(busd.address);
        //
        // gauge_busd = await Gauge.attach(gaugeAddr1);
        // expect(gauge_busd.address).to.be.eq(gaugeAddr1);
        // expect(await boost.poolLength()).to.be.eq(2);


    });

    it('if crypto pool is the pool address, an error will be reported', async function () {
       await boost.createGauge(token0.address, "100", true);



    });


});
