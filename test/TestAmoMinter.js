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
    async function getUint8Array(len) {
        var buffer = new ArrayBuffer(len);
        var bufferArray = new Uint8Array(buffer);
        var length = bufferArray.length;
        for (var i = 0; i < length; i++) {
            bufferArray[i] = 0;
        }

        return bufferArray;
    }

    beforeEach(async function () {
        [owner, dev, addr1] = await ethers.getSigners();
        zeroAddr = "0x0000000000000000000000000000000000000000";
        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        weth = await deployContract(owner, {
            bytecode: WETH.bytecode,
            abi: WETH.abi,
        });

        await weth.deposit({value: toWei('100')});

        factory = await deployContract(owner, {
            bytecode: Factory.bytecode,
            abi: Factory.abi
        }, [owner.address]);

        router = await deployContract(owner, {
            bytecode: Router.bytecode,
            abi: Router.abi
        }, [factory.address, weth.address]);


        const FRAXShares = await ethers.getContractFactory('FRAXShares');
        fxs = await FRAXShares.deploy("fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('FRAXStablecoin');
        frax = await FRAXStablecoin.deploy("frax", "frax");

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

        const FraxPoolLibrary = await ethers.getContractFactory('FraxPoolLibrary')
        fraxPoolLibrary = await FraxPoolLibrary.deploy();

        const Pool_USDC = await ethers.getContractFactory('Pool_USDC', {
            libraries: {
                FraxPoolLibrary: fraxPoolLibrary.address,
            },
        });
        usdcPool = await Pool_USDC.deploy(frax.address, fxs.address, usdc.address, toWei('10000000000'));
        expect(await usdcPool.USDC_address()).to.be.eq(usdc.address);

        // =========
        await frax.addPool(usdcPool.address);

        await fxs.addPool(owner.address);
        // await fxs.addPool(dev.address);
        await frax.addPool(owner.address);

        // await fxs.mint(dev.address, toWei("100000"));
        // await fxs.mint(owner.address, toWei("100000"));
        // ==========

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
        /** attention */

        await factory.createPair(usdc.address, weth.address);
        pairAddr = await factory.getPair(usdc.address, weth.address);

        await factory.createPair(frax.address, weth.address);
        await factory.createPair(fxs.address, weth.address);

        await usdc.approve(router.address, toWei('1000'));
        await weth.approve(router.address, toWei('1000'));

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
            toWei('1'),
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
            owner.address,
            dev.address,
            frax.address,
            fxs.address,
            usdc.address,
            usdcPool.address
        );

        const ExchangeAMO = await ethers.getContractFactory('ExchangeAMO');
        exchangeAMO = await ExchangeAMO.deploy(
            owner.address,
            amoMinter.address,
            frax.address,
            usdc.address,
            fxs.address,
            pool.address,
            frax.address
        );
        //await frax.addPool(exchangeAMO.address)

        await fxs.mint(exchangeAMO.address, toWei("100000"));
        await token0.approve(exchangeAMO.address, toWei("100000000"));
        await token0.mint(exchangeAMO.address, toWei("100000"));

        await amoMinter.addAMO(exchangeAMO.address, true);

        await fxs.addPool(amoMinter.address);

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

    it('test allAMOAddress、allAMOsLength、', async function () {
        price = await pool.get_virtual_price();
        let resultArray = new Array(1);
        let resultArrayLength;

        resultArrayLength = await amoMinter.allAMOsLength();
        expect(resultArrayLength).to.be.eq(0);

        // Add
        resultArrayLength = await amoMinter.allAMOsLength();
        expect(resultArrayLength).to.be.eq(1);
        resultArray = await amoMinter.allAMOAddresses();
        resultArrayValue = resultArray[0];

        // Remove
        await amoMinter.removeAMO(exchangeAMO.address, true);
        resultArrayLength = await amoMinter.allAMOsLength();
        expect(resultArrayLength).to.be.eq(0);
    });

    // it('test fraxTrackedGlobal', async function () {
    //     let fraxDollarBalance;
    //     let fraxTrackedGlobalValue;
    //
    //     fraxDollarBalance = await amoMinter.fraxDollarBalanceStored();
    //     expect(parseInt(fraxDollarBalance)).to.be.eq(0);
    //
    //     fraxTrackedGlobalValue = await amoMinter.fraxTrackedGlobal();
    //     expect(parseInt(fraxTrackedGlobalValue)).to.be.eq(0);
    // });

    // it('test fraxTrackedAMO', async function () {
    //     let fraxValE18;
    //
    //     fraxValE18 = await amoMinter.dollarBalances();
    //     console.log(await amoMinter.fraxTrackedAMO(exchangeAMO.address));
    // });

    // it('test oldPoolRredeem', async function () {
    //     let redemPtionFee;
    //     let colPriceUsd;
    //     let globalCollateralRatio;
    //     let latestPrice;
    //
    //     redemPtionFee = await usdcPool.redemption_fee();
    //     expect(parseInt(redemPtionFee)).to.be.eq(0);
    //     latestPrice = await chainlinkETHUSDPriceConsumer.getLatestPrice();
    //     console.log(parseInt(latestPrice));
    //     colPriceUsd = await usdcPool.getCollateralPrice();
    //     console.log(parseInt(colPriceUsd));
    //     globalCollateralRatio = await frax.globalCollateralRatio();
    //     console.log("Global:\t" + globalCollateralRatio);
    //     expect(parseInt(globalCollateralRatio)).to.be.eq(1000000);
    // });

    // it('test oldPoolCollectAndGive', async function () {
    //     let collatBorrowedBalance;
    //     let initBorrowedBalance;
    //     let collatAmount;
    //
    //     collatBorrowedBalance = await amoMinter.collat_borrowed_balances(exchangeAMO.address);
    //     initBorrowedBalance = collatBorrowedBalance;
    //     expect(parseInt(initBorrowedBalance)).to.be.eq(0);
    //
    //     // Call the function
    //     // await amoMinter.oldPoolCollectAndGive(exchangeAMO.address); // Error
    //     // await amoMinter.oldPoolCollectAndGive(exchangeAMO.address);
    //     collatAmount = await usdcPool.redeemCollateralBalances(exchangeAMO.address);
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

    // it('test setCustodian', async function () {
    //     let initCustodian;
    //     let currentCustodian;
    //
    //     initCustodian = await amoMinter.custodian_address();
    //     // expect(initCustodian).to.be.eq(usdc.address);
    //     await amoMinter.setCustodian(owner.address);
    //     currentCustodian = await amoMinter.custodian_address();
    //     expect(currentCustodian).to.be.not.eq(initCustodian);
    // });
    //
    // it('test setFraxMintCap', async function () {
    //     let initFraxMintCap;
    //     let currentFraxMintCap;
    //
    //     initFraxMintCap = await amoMinter.frax_mint_cap();
    //     await amoMinter.setFraxMintCap(toWei("100"));
    //     currentFraxMintCap = await amoMinter.frax_mint_cap();
    //     expect(currentFraxMintCap).to.be.not.eq(initFraxMintCap);
    //     expect(currentFraxMintCap).to.be.eq(toWei("100"));
    // });

    // it('test setfxsMintCap', async function () {
    //     let initfxsMintCap;
    //     let currentfxsMintCap;
    //
    //     initfxsMintCap = await amoMinter.fxs_mint_cap();
    //     await amoMinter.setFxsMintCap(toWei("1"));
    //     currentfxsMintCap = await amoMinter.fxs_mint_cap();
    //     expect(currentfxsMintCap).to.be.not.eq(initfxsMintCap);
    //     expect(currentfxsMintCap).to.be.eq(toWei("1"));
    // });
    //
    // it('test setCollatBorrowCap', async function () {
    //     let initCollatBorrowCap;
    //     let currentCollatBorrowCap;
    //
    //     initCollatBorrowCap = await amoMinter.collat_borrow_cap();
    //     await amoMinter.setCollatBorrowCap(toWei("100"));
    //     currentCollatBorrowCap = await amoMinter.collat_borrow_cap();
    //     expect(currentCollatBorrowCap).to.be.not.eq(initCollatBorrowCap);
    //     expect(currentCollatBorrowCap).to.be.eq(toWei("100"));
    // });

    // it('test setMinimumCollateralRatio', async function () {
    //     let initMinCr;
    //     let currentMinCr;
    //
    //     initMinCr = await amoMinter.min_cr();
    //     expect(parseInt(initMinCr)).to.be.eq(810000);
    //     await amoMinter.setMinimumCollateralRatio(1);
    //     currentMinCr = await amoMinter.min_cr();
    //     expect(currentMinCr).to.be.eq(1);
    // });

    // it('test setAMOCorrectionOffsets', async function () {
    //     let correctionOffsetsAmosIndexOne;
    //     let correctionOffsetsAmosIndexTwo;
    //
    //     correctionOffsetsAmosIndexOne = await amoMinter.correction_offsets_amos(exchangeAMO.address, 0);
    //     expect(parseInt(correctionOffsetsAmosIndexOne)).to.be.eq(0);
    //     correctionOffsetsAmosIndexTwo = await amoMinter.correction_offsets_amos(exchangeAMO.address, 1);
    //     expect(parseInt(correctionOffsetsAmosIndexTwo)).to.be.eq(0);
    //
    //     await amoMinter.setAMOCorrectionOffsets(exchangeAMO.address, 1, 1);
    //     correctionOffsetsAmosIndexOne = await amoMinter.correction_offsets_amos(exchangeAMO.address, 0);
    //     expect(parseInt(correctionOffsetsAmosIndexOne)).to.be.eq(1);
    //     correctionOffsetsAmosIndexTwo = await amoMinter.correction_offsets_amos(exchangeAMO.address, 1);
    //     expect(parseInt(correctionOffsetsAmosIndexTwo)).to.be.eq(1);
    // });
    //
    // it('test setFraxPool', async function () {
    //     let initPool;
    //     let currentPool;
    //
    //     initPool = await amoMinter.pool();
    //     await amoMinter.setFraxPool(pool.address);
    //     currentPool = await amoMinter.pool();
    //     expect(initPool).to.be.not.eq(currentPool);
    // });
    //
    // it('test recoverERC20', async function () {
    //     await token0.mint(amoMinter.address, toWei("1"));
    //     await amoMinter.recoverERC20(token0.address, toWei("1"));
    // });
});