/** JSON ABI */
const CRVFactory = require('./mock/mockPool/factory.json');
const FactoryAbi = require('./mock/mockPool/factory_abi.json');
const Plain3Balances = require('./mock/mockPool/Plain3Balances.json');
const PoolAbi = require('./mock/mockPool/3pool_abi.json');
const Registry = require('./mock/mockPool/Registry.json');
const PoolRegistry = require('./mock/mockPool/PoolRegistry.json');
const Factory = require('../test/mock/PancakeFactory.json');
const Router = require('../test/mock/PancakeRouter.json');
const WETH = require('../test/mock/WETH9.json');
/** EXTERNAL MODULE */
const {deployContract} = require('ethereum-waffle');
const {ethers} = require('hardhat');
const {expect} = require('chai');
const {BigNumber} = require('ethers');
const {toWei} = web3.utils;
/** INTERNAL MODULE */
const GAS = {gasLimit: "9550000"};

contract('AMOMinter', async function () {
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

        factory = await deployContract(owner, {
            bytecode: Factory.bytecode,
            abi: Factory.abi
        }, [owner.address]);

        router = await deployContract(owner, {
            bytecode: Router.bytecode,
            abi: Router.abi
        }, [factory.address, weth.address]);


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

        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);

        const PoolLibrary = await ethers.getContractFactory('PoolLibrary')
        poolLibrary = await PoolLibrary.deploy();

        const Pool_USDC = await ethers.getContractFactory('Pool_USDC', {
            libraries: {
                PoolLibrary: poolLibrary.address,
            },
        });
        usdcPool = await Pool_USDC.deploy(operatable.address, frax.address, fxs.address, usdc.address, toWei('10000000000'));
        expect(await usdcPool.USDC_address()).to.be.eq(usdc.address);

        await frax.addPool(usdcPool.address);

        await fxs.addPool(owner.address);

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


        // create  token0 token1 token2
        await crvFactory.deploy_plain_pool(
            "3pool",
            "3pool",
            [token0.address, frax.address, token2.address, zeroAddr],
            "2000",
            "4000000", 0, 0, GAS);

        poolAddress = await crvFactory.pool_list(0, GAS);

        pool = await plain3Balances.attach(poolAddress);

        await token0.approve(pool.address, toWei("10000"))
        await frax.approve(pool.address, toWei("10000"))
        await token2.approve(pool.address, toWei("10000"))

        await pool.add_liquidity([toWei('100'), toWei('100'), toWei('100')], 0, GAS)

        // ETHOracle
        const MockChainLink = await ethers.getContractFactory("MockChainLink");
        mockChainLink = await MockChainLink.deploy();
        const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
        chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy(mockChainLink.address);
        await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address);

        await mockChainLink.setAnswer(toWei('100'));
        /** attention */

        await factory.createPair(usdc.address, weth.address);
        pairAddr = await factory.getPair(usdc.address, weth.address);

        await factory.createPair(frax.address, weth.address);
        await factory.createPair(fxs.address, weth.address);

        await usdc.approve(router.address, toWei('1000'));
        await weth.approve(router.address, toWei('10000'));

        await router.addLiquidity(
            usdc.address,
            weth.address,
            toWei('1'),
            toWei('1'),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 1000)
        );

        await frax.approve(router.address, toWei('1000'));

        await router.addLiquidity(
            frax.address,
            weth.address,
            toWei('0.001'),
            toWei('1'),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 1000)
        );

        await fxs.approve(router.address, toWei('1000'));
        await router.addLiquidity(
            fxs.address,
            weth.address,
            toWei('1'),
            toWei('1'),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 1000)
        );

        const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
        usdc_uniswapOracle = await UniswapPairOracle.deploy(factory.address, usdc.address, weth.address, owner.address, timelock.address);
        await usdcPool.setCollatETHOracle(usdc_uniswapOracle.address, weth.address);

        frax_uniswapOracle = await UniswapPairOracle.deploy(factory.address, frax.address, weth.address, owner.address, timelock.address);
        await frax.setFRAXEthOracle(frax_uniswapOracle.address, weth.address);
        expect(await frax.fraxEthOracleAddress()).to.be.eq(frax_uniswapOracle.address);

        fxs_uniswapOracle = await UniswapPairOracle.deploy(factory.address, fxs.address, weth.address, owner.address, timelock.address);
        await frax.setFXSEthOracle(fxs_uniswapOracle.address, weth.address);
        expect(await frax.fxsEthOracleAddress()).to.be.eq(fxs_uniswapOracle.address);

        const AMOMinter = await ethers.getContractFactory('AMOMinter');
        amoMinter = await AMOMinter.deploy(
            operatable.address,
            dev.address,
            frax.address,
            fxs.address,
            usdc.address,
            usdcPool.address
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
        //await frax.addPool(exchangeAMO.address)

        await fxs.mint(exchangeAMO.address, toWei("100000"));
        await token0.approve(exchangeAMO.address, toWei("100000000"));
        await token0.mint(exchangeAMO.address, toWei("100000"));

        await amoMinter.addAMO(exchangeAMO.address, true);

        await fxs.addPool(amoMinter.address);
        await frax.addPool(amoMinter.address);

        await usdcPool.addAMOMinter(amoMinter.address);
    });

    // it('test collatDollarBalance', async function () {
    //     let collatValue;
    //
    //     collatValue = await amoMinter.collatDollarBalance();
    //     expect(parseInt(collatValue)).to.be.eq(0);
    // });
    //
    // it('test dollarBalances', async function () {
    //     let valueMap;
    //     let fraxValueE18;
    //     let collatValueE18;
    //
    //     valueMap = await amoMinter.dollarBalances();
    //     fraxValueE18 = valueMap[0];
    //     collatValueE18 = valueMap[1];
    //     expect(parseInt(fraxValueE18)).to.be.eq(0);
    //     expect(parseInt(collatValueE18)).to.be.eq(0);
    // });

    // it('test allAMOAddress、allAMOsLength', async function () {
    //     price = await pool.get_virtual_price();
    //
    //     resultArrayLength = await amoMinter.allAMOsLength();
    //     expect(resultArrayLength).to.be.eq(1);
    //     resultArray = await amoMinter.allAMOAddresses();
    //     resultArrayValue = resultArray[0];
    //     expect(resultArrayValue).to.be.eq(exchangeAMO.address);
    //
    //     await amoMinter.removeAMO(exchangeAMO.address, true);
    //     resultArrayLength = await amoMinter.allAMOsLength();
    //     expect(resultArrayLength).to.be.eq(1);
    //     amoAddress = await amoMinter.amosArray(0);
    //     expect(amoAddress).to.be.eq(zeroAddr);
    // });

    // it('test fraxTrackedGlobal', async function () {
    //     let fraxDollarBalance;
    //     let fraxTrackedGlobalValue;
    //
    //     fraxDollarBalance = await amoMinter.fraxDollarBalanceStored();
    //     expect(parseInt(fraxDollarBalance)).to.be.eq(0);
    //
    //     fraxTrackedGlobalValue = await amoMinter.fraxTrackedGlobal();
    //     expect(parseInt(fraxTrackedGlobalValue)).to.be.eq(0);
    //
    //     expect(await amoMinter.fraxTrackedGlobal()).to.be.eq(0);
    // });

    // it('test fraxTrackedAMO', async function () {
    //     let dollarBalancesMap;
    //     let fraxValE18;
    //
    //     dollarBalancesMap = await amoMinter.dollarBalances();
    //     fraxValE18 = dollarBalancesMap[0];
    //     expect(fraxValE18).to.be.eq(0);
    // });

    it('test poolRedeem', async function () {
        let redeemPtionFee;
        let colPriceUsd;
        let globalCollateralRatio;
        let latestPrice;
        let amoMinterBalanceOfFrax;
        let fxsPrice;
        const REDEEM_FEE = 1e4;

        // Set period
        await frax_uniswapOracle.setPeriod(1);
        expect(await frax_uniswapOracle.canUpdate()).to.be.eq(true);
        // Set oracle
        await frax_uniswapOracle.update();
        console.log("frax_price:\t" + await frax.fraxPrice());

        // Set redeem fee
        await usdcPool.setPoolParameters(0, 0, 0, 0, 0, REDEEM_FEE, 0);
        redeemPtionFee = await usdcPool.redemption_fee();
        console.log("redeem_fee:\t" + redeemPtionFee);
        // latestPrice = await chainlinkETHUSDPriceConsumer.getLatestPrice();
        // expect(parseInt(latestPrice)).to.be.eq(1);

        expect(await usdc_uniswapOracle.PERIOD()).to.be.eq(3600);
        // Set period
        await usdc_uniswapOracle.setPeriod(1);
        expect(await usdc_uniswapOracle.PERIOD()).to.be.eq(1);
        expect(await usdc_uniswapOracle.canUpdate()).to.be.eq(true);
        //expect(await chainlinkETHUSDPriceConsumer.getLatestPrice()).to.be.eq(1);
        // Update MockChainLink value -> test token so can call set function
        await mockChainLink.setAnswer(BigNumber.from(1e13));
        expect(await frax.ethUsdPrice()).to.be.eq(10);
        // Get usdc price
        await usdc_uniswapOracle.update();
        colPriceUsd = await usdcPool.getCollateralPrice();
        expect(parseInt(colPriceUsd)).to.be.eq(10);
        globalCollateralRatio = await frax.globalCollateralRatio();
        expect(parseInt(globalCollateralRatio)).to.be.eq(1000000);

        // Pool balances
        amoMinterBalanceOfFrax = await frax.balanceOf(amoMinter.address);
        expect(parseInt(amoMinterBalanceOfFrax)).to.be.eq(0);

        // Usdc pool redeemFractionalFRAX function
        // fxsPrice = await frax.fxsPrice();
        // Set period
        await fxs_uniswapOracle.setPeriod(1);
        // Set oracle
        await fxs_uniswapOracle.update();
        fxsPrice = await frax.fxsPrice();
        console.log(fxsPrice);

        await amoMinter.poolCollectAndGive(exchangeAMO.address)

        await amoMinter.poolRedeem(100000);
        amoMinterBalanceOfFrax = await frax.balanceOf(amoMinter.address);
        expect(parseInt(amoMinterBalanceOfFrax)).to.be.eq(100000);
    });

    // it('test poolCollectAndGive', async function () {
    //     let collatBorrowedBalance;
    //     let initBorrowedBalance;
    //     let collatAmount;
    //
    //     collatBorrowedBalance = await amoMinter.collat_borrowed_balances(exchangeAMO.address);
    //     initBorrowedBalance = collatBorrowedBalance;
    //     expect(parseInt(initBorrowedBalance)).to.be.eq(0);
    //
    //     // Call the function
    //     // await amoMinter.poolCollectAndGive(exchangeAMO.address); // Error
    //     await amoMinter.poolCollectAndGive(exchangeAMO.address);
    //     collatAmount = await usdcPool.redeemCollateralBalances(amoMinter.address);
    //     expect(parseInt(collatAmount)).to.be.eq(0);
    //     collatBorrowedBalance = await amoMinter.collat_borrowed_balances(exchangeAMO.address);
    //     // expect(parseInt(collatBorrowedBalance)).to.be.eq(1);
    // });

    // it('test mintFraxForAMO and burnFraxForAMO', async function () {
    //     let fraxMintBalance;
    //     let fraxOfExchange;
    //     let fraxMintSum;
    //
    //     fraxMintBalance = await amoMinter.frax_mint_balances(exchangeAMO.address);
    //     expect(parseInt(fraxMintBalance)).to.be.eq(0);
    //     fraxOfExchange = await frax.balanceOf(owner.address);
    //     console.log(parseInt(fraxOfExchange));
    //
    //     await usdc_uniswapOracle.setPeriod(1);
    //     await usdc_uniswapOracle.update();
    //
    //     await frax_uniswapOracle.setPeriod(1);
    //     await frax_uniswapOracle.update();
    //
    //     await fxs_uniswapOracle.setPeriod(1);
    //     await fxs_uniswapOracle.update();
    //
    //     await frax.refreshCollateralRatio();
    //     await amoMinter.setMinimumCollateralRatio(0);
    //
    //     await frax.addPool(amoMinter.address);
    //     await amoMinter.mintFraxForAMO(exchangeAMO.address, toWei("100"));
    //     // fraxMintBalance = await amoMinter.frax_mint_balances(exchangeAMO.address);
    //     // console.log(fraxMintBalance);
    //     // fraxMintSum = await amoMinter.frax_mint_sum();
    //     // expect(parseInt(fraxMintSum)).to.be.eq(parseInt(toWei("100")));
    //
    //     await amoMinter.burnFraxFromAMO(toWei("1"));
    // });

    // it('test mintFxsForAMO and burnFxsFromAMO', async function () {
    //     let fxsMintBalances;
    //     let initFxsInPool;
    //
    //     fxsMintBalances = await amoMinter.fxs_mint_balances(exchangeAMO.address);
    //     expect(parseInt(fxsMintBalances)).to.be.eq(0);
    //
    //     // fxsBoolean = await fxs.isPools(exchangeAMO.address);
    //     // expect(fxsBoolean).to.be.eq(true);await
    //     amosMap = await amoMinter.amos(exchangeAMO.address);
    //     expect(amosMap).to.be.eq(true);
    //     await amoMinter.removeAMO(exchangeAMO.address, true);
    //     // await amoMinter.addAMO(exchangeAMO.address, true);
    //     // await amoMinter.mintFxsForAMO(exchangeAMO.address, toWei("1"));
    //     // fxsMintBalances = await amoMinter.fxs_mint_balances(exchangeAMO.address);
    //     // initFxsInPool = fxsMintBalances;
    //     // expect(parseInt(fxsInPool)).to.be.eq(parseInt(initFxsInPool + toWei("1")));
    //
    //     // Burn
    //     await amoMinter.burnFxsFromAMO(toWei("1"));
    //     fxsMintBalances = await amoMinter.fxs_mint_balances(exchangeAMO.address); // Error
    //     expect(parseInt(fxsMintBalances)).to.be.eq(0);
    //     expect(parseInt(fxsMintBalances)).to.be.not.eq(parseInt(initFxsInPool));
    // });


});
