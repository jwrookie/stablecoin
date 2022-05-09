const CRVFACTORY = require('./mock/mockPool/factory.json');
const FACTORYABI = require('./mock/mockPool/factory_abi.json');
const PLAIN3BALANCE = require('./mock/mockPool/Plain3Balances.json');
const POOLABI = require('./mock/mockPool/3pool_abi.json');
const REGISTRY = require('./mock/mockPool/Registry.json');
const POOLREGISTRY = require('./mock/mockPool/PoolRegistry.json');
const FACTORY = require('../test/mock/PancakeFactory.json');
const ROUTER = require('../test/mock/PancakeRouter.json');
const WETH = require('../test/mock/WETH9.json');
const {deployContract} = require('ethereum-waffle');
const {ethers} = require('hardhat');
const {expect} = require('chai');
const {BigNumber} = require('ethers');
const {toWei} = web3.utils;
const {time} = require('@openzeppelin/test-helpers');
const GAS = {gasLimit: "9550000"};

contract('ExchangeAMO', async function () {
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const POOL_CELLING = toWei('10000000000');

    async function _getTimeLock() {
        const Timelock = await ethers.getContractFactory("Timelock");
        timelock = await Timelock.deploy(owner.address, "259200");
        return timelock;
    }

    async function _setCollatETHOracle(setConfig) {
        await stableCoinPool.setCollatETHOracle(setConfig.address, weth.address);
    }

    async function _setFRAXEthOracle(setConfig) {
        await frax.setStockAddress(setConfig.address, weth.address);
    }

    async function _setFXSEthOracle(setConfig) {
        await frax.setFXSEthOracle(setConfig.address, weth.address);
    }

    async function setUniswapOracle(coinPairs) {
        const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
        timelock = await _getTimeLock();
        uniswapOracle = await UniswapPairOracle.deploy(
            factory.address,
            coinPairs.address,
            weth.address,
            owner.address,
            timelock.address
        );

        switch (coinPairs) {
            case usdc:
                await _setCollatETHOracle(uniswapOracle);
                break;
            case frax:
                await _setFRAXEthOracle(uniswapOracle);
                expect(await frax.fraxEthOracleAddress()).to.be.eq(uniswapOracle.address);
                break;
            case fxs:
                await _setFXSEthOracle(uniswapOracle);
                expect(await frax.fxsEthOracleAddress()).to.be.eq(uniswapOracle.address);
                break;
            default:
                await console.log("Unknow token!");
        }
        return uniswapOracle;
    }

    async function getBalances(coin, account) {
        return await coin.balanceOf(account.address);
    }

    async function refreshOracle(oracle, periodDay) {
        await oracle.setPeriod(periodDay);
        if (expect(await oracle.canUpdate()).to.be.eq(true)) {
            await oracle.update();
        } else {
            await refreshOracle(oracle, periodDay);
        }
    }

    beforeEach(async function () {
        [owner, dev] = await ethers.getSigners();
        const TestOracle = await ethers.getContractFactory('TestOracle');
        testOracle = await TestOracle.deploy();

        const testOperatable = await ethers.getContractFactory('Operatable');
        operatable = await testOperatable.deploy();

        const RStableCoin = await ethers.getContractFactory('RStablecoin');
        frax = await RStableCoin.deploy(operatable.address, "frax", "frax");

        const Stock = await ethers.getContractFactory('Stock');
        fxs = await Stock.deploy(operatable.address, "fxs", "fxs", testOracle.address);

        // Set each other
        await fxs.setFraxAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        // Mock token Date
        const MockToken = await ethers.getContractFactory("MockToken");
        usdc = await MockToken.deploy("usdc", "usdc", 18, BigNumber.from("1000000000000000000"));
        token0 = await MockToken.deploy("token0", "token0", 18, toWei('10000000'));
        token2 = await MockToken.deploy("token2", "token2", 18, toWei('10000000'));

        // Mint for account
        await usdc.mint(owner.address, toWei("1000"));
        await usdc.mint(dev.address, toWei("1000"));
        await token0.mint(owner.address, toWei("10000"));
        await token0.mint(dev.address, toWei("10"));
        await token2.mint(owner.address, toWei("10000"));
        await token2.mint(dev.address, toWei("10"));

        const FraxPoolLibrary = await ethers.getContractFactory('PoolLibrary');
        fraxPoolLibrary = await FraxPoolLibrary.deploy();

        // Deploy usdc pool need libraries
        const Pool_USDC = await ethers.getContractFactory('Pool_USDC', {
            libraries: {
                PoolLibrary: fraxPoolLibrary.address,
            },
        });

        stableCoinPool = await Pool_USDC.deploy(
            operatable.address,
            frax.address,
            fxs.address,
            usdc.address,
            POOL_CELLING
        );
        expect(await stableCoinPool.USDC_address()).to.be.eq(usdc.address);

        // Approve
        await usdc.approve(stableCoinPool.address, toWei("1"));

        // Add pool
        await frax.addPool(stableCoinPool.address);

        await fxs.addPool(stableCoinPool.address);

        // Deploy weth
        weth = await deployContract(owner, {
            bytecode: WETH.bytecode,
            abi: WETH.abi,
        });

        // Factory ---> deploy pool ---> The last parameter is sender
        factory = await deployContract(owner, {
            bytecode: FACTORY.bytecode,
            abi: FACTORY.abi
        }, [owner.address]);

        // Router -> for adding liquidity
        router = await deployContract(owner, {
            bytecode: ROUTER.bytecode,
            abi: ROUTER.abi
        }, [factory.address, weth.address]);

        // Registry ---> add pool to pool registry
        registry = await deployContract(owner, {
            bytecode: REGISTRY.bytecode,
            abi: REGISTRY.abi
        }, [owner.address]);

        poolRegistry = await deployContract(owner, {
            bytecode: POOLREGISTRY.bytecode,
            abi: POOLREGISTRY.abi
        }, [registry.address, ZERO_ADDRESS]);

        // Through registry center to add pool in pool registry
        await registry.set_address(0, poolRegistry.address);

        // Deploy crv factory to deploy 3pool
        crvFactory = await deployContract(owner, {
            bytecode: CRVFACTORY.bytecode,
            abi: FACTORYABI.abi,
        }, [owner.address, registry.address]);

        plain3Balances = await deployContract(owner, {
            bytecode: PLAIN3BALANCE.bytecode,
            abi: POOLABI.abi
        });

        // Set pool and deploy
        await crvFactory.set_plain_implementations(3,
            [
                plain3Balances.address,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                ZERO_ADDRESS,
                ZERO_ADDRESS]);

        // Create token pair
        await crvFactory.deploy_plain_pool(
            "3pool",
            "3pool",
            [token0.address, frax.address, token2.address, ZERO_ADDRESS],
            "2000",
            "4000000", 0, 0, GAS);

        // Mint weth
        await weth.deposit({value: toWei("10")});
        await weth.approve(router.address, toWei("10000"));

        poolAddress = await crvFactory.pool_list(0, GAS);

        pool = await plain3Balances.attach(poolAddress);

        // Approve for pool
        await token0.approve(pool.address, toWei("10000"));
        await token2.approve(pool.address, toWei("10000"));
        await frax.approve(pool.address, toWei("10000"));
        await frax.approve(stableCoinPool.address, toWei("10000")); // Important
        await fxs.approve(pool.address, toWei("10000"));
        await fxs.approve(stableCoinPool.address, toWei("10000")); // Important

        // Add liquidity
        await pool.add_liquidity([toWei('100'), toWei('100'), toWei('100')], 0, GAS);

        // Create transaction pairs
        await factory.createPair(usdc.address, weth.address);
        await factory.createPair(frax.address, weth.address);
        await factory.createPair(fxs.address, weth.address);

        await usdc.approve(router.address, toWei("1000"));
        await router.addLiquidity(
            usdc.address,
            weth.address,
            BigNumber.from("100000000000000"),
            toWei("1"),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 2600000)
        );

        await frax.approve(router.address, toWei("1000"));
        await router.addLiquidity(
            frax.address,
            weth.address,
            toWei("0.5"),
            toWei("1"),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 2600000)
        );

        await fxs.approve(router.address, toWei("1000"));
        await router.addLiquidity(
            fxs.address,
            weth.address,
            toWei('0.1'),
            toWei('1'),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 2600000)
        );

        // About oracle and uniswap
        const MockChainLink = await ethers.getContractFactory("MockChainLink");
        mockChainLink = await MockChainLink.deploy();
        const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
        chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy(mockChainLink.address);
        await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address);

        // Set oracle
        usdcUniswapOracle = await setUniswapOracle(usdc);
        fraxUniswapOracle = await setUniswapOracle(frax);
        fxsUniswapOracle = await setUniswapOracle(fxs);

        // About amo and exchange amo
        const AMOMinter = await ethers.getContractFactory('AMOMinter');
        amoMinter = await AMOMinter.deploy(
            operatable.address,
            dev.address,
            frax.address,
            fxs.address,
            usdc.address,
            stableCoinPool.address
        );

        const ExchangeAMO = await ethers.getContractFactory('ExchangeAMO');
        exchangeAMO = await ExchangeAMO.deploy(
            operatable.address,
            amoMinter.address,
            frax.address,
            usdc.address,
            pool.address,
            frax.address
        );

        // Insert exchange amo in amo
        await amoMinter.addAMO(exchangeAMO.address, true);
    });

    it('test setAMOMinter', async function () {
        await exchangeAMO.setAMOMinter(amoMinter.address);
    });

    it('test setConvergenceWindow', async function () {
        expect(await exchangeAMO.convergenceWindow()).to.be.eq(1e15);
        await exchangeAMO.setConvergenceWindow(1e10);
        expect(await exchangeAMO.convergenceWindow()).to.be.eq(1e10);
    });

    it('test setCustomFloor', async function () {
        expect(await exchangeAMO.customFloor()).to.be.eq(false);
        expect(await exchangeAMO.stableCoinFloor()).to.be.eq(0);
        await exchangeAMO.setCustomFloor(true, 1e6);
        expect(await exchangeAMO.customFloor()).to.be.eq(true);
        expect(await exchangeAMO.stableCoinFloor()).to.be.eq(1e6);
    });

    it('test setDiscountRate', async function () {
        expect(await exchangeAMO.setDiscount()).to.be.eq(false);
        expect(await exchangeAMO.discountRate()).to.be.eq(0);
        await exchangeAMO.setDiscountRate(true, 1e7);
        expect(await exchangeAMO.setDiscount()).to.be.eq(true);
        expect(await exchangeAMO.discountRate()).to.be.eq(1e7);
    });

    it('test setSlippages', async function () {
        expect(await exchangeAMO.liqSlippage3crv()).to.be.eq(800000);
        await exchangeAMO.setSlippages(900000, 1000000);
        expect(await exchangeAMO.liqSlippage3crv()).to.be.eq(900000);
    });

    // it('test recoverERC20', async function () {
    //     initFraxBalanceOfOwner = await getBalances(frax, exchangeAMO);
    //     await amoMinter.recoverERC20(frax.address, toWei("1"));
    //     expect(await getBalances(frax, exchangeAMO)).to.be.eq(initFraxBalanceOfOwner - toWei("1"));
    // });
})