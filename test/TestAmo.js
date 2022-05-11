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

contract('AMOMinter', async function () {
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const POOL_CELLING = toWei('10000000000');
    let initFraxDollarBalanceStored;
    let initCollatDollarBalanceStored;
    let initCorrectionOffsetsAmos0;
    let initCorrectionOffsetsAmos1;

    async function getTimeLock() {
        const Timelock = await ethers.getContractFactory("Timelock");
        timelock = await Timelock.deploy(owner.address, "259200");
        return timelock;
    }

    async function setCollatETHOracle(setConfig) {
        await stableCoinPool.setCollatETHOracle(setConfig.address, weth.address);
    }

    async function setStableEthOracle(setConfig) {
        await frax.setStableEthOracle(setConfig.address, weth.address);
    }

    async function setStockEthOracle(setConfig) {
        await frax.setStockEthOracle(setConfig.address, weth.address);
    }

    async function setUniswapOracle(coinPairs) {
        const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
        timelock = await getTimeLock();
        uniswapOracle = await UniswapPairOracle.deploy(
            factory.address,
            coinPairs.address,
            weth.address,
            owner.address,
            timelock.address
        );

        switch (coinPairs) {
            case usdc:
                await setCollatETHOracle(uniswapOracle);
                break;
            case frax:
                await setStableEthOracle(uniswapOracle);
                expect(await frax.stableEthOracleAddress()).to.be.eq(uniswapOracle.address);
                break;
            case fxs:
                await setStockEthOracle(uniswapOracle);
                expect(await frax.stockEthOracleAddress()).to.be.eq(uniswapOracle.address);
                break;
            default:
                return Error("Unknow token!");
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
        // About fxs and rusd
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

        // Add pool about amo pools -> about fcunction
        await frax.addPool(amoMinter.address);
        await fxs.addPool(amoMinter.address);
        // await frax.addPool(exchangeAMO.address);
        // await stableCoinPool.addAMOMinter(amoMinter.address);
        // await stableCoinPool.addAMOMinter(exchangeAMO.address);
    });

    it('test addAMO and removeAMO', async function () {
        expect(await amoMinter.allAMOsLength()).to.be.eq(1);
        amoAddress = await amoMinter.amosArray(0)
        expect(exchangeAMO.address).to.be.eq(amoAddress);
        expect(await amoMinter.amos(exchangeAMO.address)).to.be.eq(true);
        expect(await amoMinter.stableMintBalances(exchangeAMO.address)).to.be.eq(0);
        expect(await amoMinter.stockMintBalances(exchangeAMO.address)).to.be.eq(0);
        expect(await amoMinter.collatBorrowedBalances(exchangeAMO.address)).to.be.eq(0);
        correctionOffsetsAmos0 = await amoMinter.correctionOffsetsAmos(exchangeAMO.address, 0);
        correctionOffsetsAmos1 = await amoMinter.correctionOffsetsAmos(exchangeAMO.address, 1);
        expect(correctionOffsetsAmos0).to.be.eq(0);
        initCorrectionOffsetsAmos0 = correctionOffsetsAmos0;
        expect(correctionOffsetsAmos1).to.be.eq(0);
        initCorrectionOffsetsAmos1 = correctionOffsetsAmos1;
        stableDollarBalanceStored = await amoMinter.stableDollarBalanceStored();
        initFraxDollarBalanceStored = stableDollarBalanceStored;
        collatDollarBalanceStored = await amoMinter.collatDollarBalanceStored();
        initCollatDollarBalanceStored = collatDollarBalanceStored;

        await amoMinter.removeAMO(exchangeAMO.address, true);
        expect(await amoMinter.amos(exchangeAMO.address)).to.be.eq(false);
        expect(await amoMinter.allAMOsLength()).to.be.eq(1);
        expect(await amoMinter.amosArray(0)).to.be.eq(ZERO_ADDRESS);
        expect(await amoMinter.stableMintBalances(exchangeAMO.address)).to.be.eq(0);
        expect(await amoMinter.stockMintBalances(exchangeAMO.address)).to.be.eq(0);
        expect(await amoMinter.collatBorrowedBalances(exchangeAMO.address)).to.be.eq(0);
        correctionOffsetsAmos0 = await amoMinter.correctionOffsetsAmos(exchangeAMO.address, 0);
        correctionOffsetsAmos1 = await amoMinter.correctionOffsetsAmos(exchangeAMO.address, 1);
        expect(correctionOffsetsAmos0).to.be.eq(initCorrectionOffsetsAmos0);
        expect(correctionOffsetsAmos1).to.be.eq(initCorrectionOffsetsAmos1);
        // Because address is ZERO_ADDRESS
        expect(await amoMinter.stableDollarBalanceStored()).to.be.eq(0);
        expect(await amoMinter.collatDollarBalanceStored()).to.be.eq(0);
    });

    it('test mintStableForAMO and burnStableFromAMO', async function () {
        expect(await getBalances(frax, amoMinter)).to.be.eq(0);
        expect(await getBalances(frax, stableCoinPool)).to.be.eq(0);
        expect(await getBalances(frax, exchangeAMO)).to.be.eq(0);
        expect(await amoMinter.amosArray(0)).to.be.eq(exchangeAMO.address);
        fraxPoolsLength = await frax.stablePoolAddressCount();
        // expect(fraxPoolsLength).to.be.eq(3);
        for (let i = 0; i < fraxPoolsLength; i++) {
            switch (i) {
                case 0:
                    expect(await frax.poolAddress(i)).to.be.eq(stableCoinPool.address);
                    break;
                case 1:
                    expect(await frax.poolAddress(i)).to.be.eq(amoMinter.address);
                    break;
                case 2:
                    expect(await frax.poolAddress(i)).to.be.eq(exchangeAMO.address);
                    break;
            }
        }
        /*
        Mint some frax in stable coin pool
        Need to get get global collateral value by oracle
         */
        expect(await amoMinter.minCR()).to.be.eq(950000);
        await usdcUniswapOracle.setPeriod(1);
        expect(await usdcUniswapOracle.canUpdate()).to.be.eq(true);
        await usdcUniswapOracle.update();
        await amoMinter.setMinimumCollateralRatio(0);
        expect(await getBalances(frax, exchangeAMO)).to.be.eq(0);
        await amoMinter.mintStableForAMO(exchangeAMO.address, 1000);
        expect(await getBalances(frax, exchangeAMO)).to.be.eq(1000);
        expect(await amoMinter.stableMintBalances(exchangeAMO.address)).to.be.eq(1000);
        expect(await amoMinter.stableMintSum()).to.be.eq(1000);

        await exchangeAMO.burnStable(100);
        expect(await getBalances(frax, exchangeAMO)).to.be.eq(900);
        // await frax.poolMint(owner.address, 10000); // Question
    });

    it('test mintStockForAMO and burnStockFromAMO', async function () {
        expect(await getBalances(fxs, exchangeAMO)).to.be.eq(0);
        await amoMinter.mintStockForAMO(exchangeAMO.address, 1000);
        expect(await getBalances(fxs, exchangeAMO)).to.be.eq(1000);
        initFxsInOwner = await getBalances(fxs, owner);
        //todo buransTock
        await exchangeAMO.burnStock(0);
        // expect(await getBalances(fxs, owner)).to.be.eq(initFxsInOwner - 100);
        // console.log(await amoMinter.stockMintBalances(owner.address));
    });

    it('test giveCollatToAmo and receiveCollatFromAMO', async function () {
        await usdcUniswapOracle.setPeriod(1);
        expect(await usdcUniswapOracle.canUpdate()).to.be.eq(true);
        await usdcUniswapOracle.update();
        initUsdcInPool = await getBalances(usdc, stableCoinPool);
        expect(parseInt(initUsdcInPool)).to.be.eq(0);
        await stableCoinPool.mint1t1FRAX(toWei("1"), 0);
        // console.log(await usdc.balanceOf(stableCoinPool.address));
        // expect(await usdc.balanceOf(stableCoinPool.address)).to.be.eq(parseInt(toWei("1")));
        expect(await getBalances(usdc, exchangeAMO)).to.be.eq(0);
        await stableCoinPool.addAMOMinter(amoMinter.address);
        initUsdcInOwner = await getBalances(usdc, owner);
        await amoMinter.giveCollatToAMO(exchangeAMO.address, 1000000);
        // expect(await getBalances(usdc, owner)).to.be.eq(initUsdcInOwner + BigNumber.from(10000000000000));
        expect(await getBalances(usdc, exchangeAMO)).to.be.eq(1000000);
        expect(await amoMinter.collatBorrowedBalances(exchangeAMO.address)).to.be.eq(1000000);

        await exchangeAMO.giveCollatBack(10000);
        expect(await amoMinter.collatBorrowedBalances(exchangeAMO.address)).to.be.eq(1000000 - 10000);
    });

    it('test oldPoolRedeem and oldPoolCollectAndGive', async function () {
        let redemptionFee;
        let colPriceUsd;
        let globalCollateralRatio;

        redemptionFee = await stableCoinPool.redemption_fee();
        // Set oracle
        expect(parseInt(redemptionFee)).to.be.eq(0);
        // Set mockChainLink
        await mockChainLink.setAnswer(10 ** 13);
        mockChainLinkMap = await mockChainLink.latestRoundData();
        mockChainLinkMapLength = mockChainLinkMap.length;
        for (let i = 0; i < mockChainLinkMapLength; i++) {
            if (i == 1) {
                expect(parseInt(mockChainLinkMap[i])).to.be.eq(10 ** 13);
                break;
            }
        }
        expect(parseInt(await frax.ethUsdPrice())).to.be.eq(10); // 10 -> 1e13 * 1e6 / 1e18
        // await usdcUniswapOracle.setPeriod(1);
        // expect(await usdcUniswapOracle.canUpdate()).to.be.eq(true);
        // await usdcUniswapOracle.update();
        await refreshOracle(usdcUniswapOracle, 1);
        colPriceUsd = await stableCoinPool.getCollateralPrice();
        expect(parseInt(colPriceUsd)).to.be.eq(101010); // By calculation
        globalCollateralRatio = await frax.globalCollateralRatio();
        expect(parseInt(globalCollateralRatio)).to.be.eq(1e6);
        // Frax price -> first need to refresh frax oracle
        await fxsUniswapOracle.setPeriod(1);
        expect(await fxsUniswapOracle.canUpdate()).to.be.eq(true);
        await fxsUniswapOracle.update();
        // await refreshOracle(fxsUniswapOracle, 1);
        await fraxUniswapOracle.setPeriod(1);
        expect(await fraxUniswapOracle.canUpdate()).to.be.eq(true);
        await fraxUniswapOracle.update();
        // await refreshOracle(fraxUniswapOracle, 1);
        await amoMinter.setMinimumCollateralRatio(0);
        expect(await getBalances(frax, exchangeAMO)).to.be.eq(0);
        await amoMinter.mintStableForAMO(exchangeAMO.address, 1000);
        await frax.setPriceTarget(22);
        await frax.setPriceBand(1);
        // await frax.setFraxStep(1);
        await frax.refreshCollateralRatio();
        expect(parseInt(await frax.stablePrice())).to.be.eq(20);
        expect(parseInt(await frax.globalCollateralRatio())).to.be.eq(1000000);
        await stableCoinPool.mint1t1FRAX(toWei("1"), 0);
        // console.log(await usdc.balanceOf(stableCoinPool.address));
        // expect(await getBalances(usdc, stableCoinPool)).to.be.eq(parseInt(toWei("1")));
        expect(await getBalances(usdc, exchangeAMO)).to.be.eq(0);
        initUsdcInOwner = await getBalances(usdc, owner);
        await stableCoinPool.addAMOMinter(amoMinter.address);
        await amoMinter.giveCollatToAMO(exchangeAMO.address, 1000000);
        await frax.setRefreshCooldown(0);
        // (await time.latest()).add(time.duration.days(1));
        await time.advanceBlockTo(parseInt(await time.latestBlock()) + 1);
        await frax.setPriceTarget(18);
        await frax.setPriceBand(1);
        await frax.refreshCollateralRatio();
        expect(parseInt(await frax.globalCollateralRatio())).to.be.eq(997500);
        await amoMinter.poolRedeem(100);
    });

    it('test collatDollarBalance', async function () {
        collatValue = await amoMinter.collatDollarBalance();
        expect(BigNumber.from(collatValue)).to.be.eq(initCollatDollarBalanceStored);
    });

    it('test dollarBalances', async function () {
        valueMap = await amoMinter.dollarBalances();
        fraxValueE18 = valueMap[0];
        collatValueE18 = valueMap[1];
        expect(BigNumber.from(fraxValueE18)).to.be.eq(BigNumber.from(initFraxDollarBalanceStored));
        expect(BigNumber.from(collatValueE18)).to.be.eq(BigNumber.from(initCollatDollarBalanceStored));
    });

    it('test fraxTrackedGlobal', async function () {
        fraxDollarBalance = await amoMinter.stableDollarBalanceStored();
        expect(fraxDollarBalance).to.be.eq(initFraxDollarBalanceStored);

        fraxTrackedGlobalValue = await amoMinter.stableTrackedGlobal();
        expect(fraxTrackedGlobalValue).to.be.eq(initFraxDollarBalanceStored);
    });

    it('test fraxTrackedAMO', async function () {
        dollarBalancesMap = await amoMinter.dollarBalances();
        fraxValE18 = dollarBalancesMap[0];
        expect(BigNumber.from(fraxValE18)).to.be.eq(initFraxDollarBalanceStored);
    });

});