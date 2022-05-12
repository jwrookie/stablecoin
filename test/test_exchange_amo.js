const CRVFactory = require('./mock/mockPool/factory.json');
const FactoryAbi = require('./mock/mockPool/factory_abi.json');
const Plain3Balances = require('./mock/mockPool/Plain3Balances.json');
const PoolAbi = require('./mock/mockPool/3pool_abi.json');
const Registry = require('./mock/mockPool/Registry.json');
const PoolRegistry = require('./mock/mockPool/PoolRegistry.json');
const Factory = require('../test/mock/PancakeFactory.json');
const Router = require('../test/mock/PancakeRouter.json');
const WETH = require('../test/mock/WETH9.json');
const {deployContract} = require('ethereum-waffle');
const {ethers} = require('hardhat');
const {expect} = require('chai');
const {BigNumber} = require('ethers');
const {toWei} = web3.utils;
const GAS = {gasLimit: "9550000"};

contract('test exchange amo', async function () {
    async function getUint8Array(len) {
        let buffer = new ArrayBuffer(len);
        let bufferArray = new Uint8Array(buffer);
        let length = bufferArray.length;
        for (let i = 0; i < length; i++) {
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

        await weth.deposit({value: toWei('10')});

        factory = await deployContract(owner, {
            bytecode: Factory.bytecode,
            abi: Factory.abi
        }, [owner.address]);

        router = await deployContract(owner, {
            bytecode: Router.bytecode,
            abi: Router.abi
        }, [factory.address, weth.address]);
        const testOperatable = await ethers.getContractFactory('Operatable');
        operatable = await testOperatable.deploy();

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(operatable.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(operatable.address, "frax", "frax");

        const MockToken = await ethers.getContractFactory("MockToken");
        usdc = await MockToken.deploy("usdc", "usdc", 18, BigNumber.from("1000000000000000000"));
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
        await frax.setStockAddress(fxs.address);

        const FraxPoolLibrary = await ethers.getContractFactory('PoolLibrary')
        fraxPoolLibrary = await FraxPoolLibrary.deploy();

        const Pool_USDC = await ethers.getContractFactory('Pool_USDC', {
            libraries: {
                PoolLibrary: fraxPoolLibrary.address,
            },
        });
        usdcPool = await Pool_USDC.deploy(operatable.address, frax.address, fxs.address, usdc.address, toWei('10000000000'));
        expect(await usdcPool.USDC_address()).to.be.eq(usdc.address);

        // =========
        await frax.addPool(usdcPool.address);

        await fxs.addPool(owner.address);
        // await fxs.addPool(dev.address);
        //   await frax.addPool(owner.address);

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
        await weth.approve(router.address, toWei('10000'));

        await router.addLiquidity(
            usdc.address,
            weth.address,
            BigNumber.from("100000000000000"),
            toWei('1'),
            0,
            0,
            owner.address,
            Math.round(new Date().getTime() + 1000)
        );

        await frax.approve(router.address, toWei('1000'));

        await router.addLiquidity(
            frax.address,
            weth.address,
            toWei('0.1'),
            toWei('1'),
            0,
            0,
            owner.address,
            Math.round(new Date().getTime() + 1000)
        );

        await fxs.approve(router.address, toWei('1000'));
        await router.addLiquidity(
            fxs.address,
            weth.address,
            toWei('0.1'),
            toWei('1'),
            0,
            0,
            owner.address,
            Math.round(new Date().getTime() + 1000)
        );

        const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
        usdc_uniswapOracle = await UniswapPairOracle.deploy(factory.address, usdc.address, weth.address, owner.address, timelock.address);
        await usdcPool.setCollatETHOracle(usdc_uniswapOracle.address, weth.address);

        frax_uniswapOracle = await UniswapPairOracle.deploy(factory.address, frax.address, weth.address, owner.address, timelock.address);
        await frax.setStableEthOracle(frax_uniswapOracle.address, weth.address);
        expect(await frax.stableEthOracleAddress()).to.be.eq(frax_uniswapOracle.address);

        fxs_uniswapOracle = await UniswapPairOracle.deploy(factory.address, fxs.address, weth.address, owner.address, timelock.address);
        await frax.setStockEthOracle(fxs_uniswapOracle.address, weth.address);
        expect(await frax.stockEthOracleAddress()).to.be.eq(fxs_uniswapOracle.address);

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
        //  await frax.addPool(amoMinter.address);

        await usdcPool.addAMOMinter(amoMinter.address);

        const FraxBond = await ethers.getContractFactory("Bond");
        fxb = await FraxBond.deploy(operatable.address, "tempName", "tempSymbol");

        const FraxBondIssuer = await ethers.getContractFactory("BondIssuer");
        fraxBondIssuer = await FraxBondIssuer.deploy(operatable.address, frax.address, fxb.address);

        //   await frax.addPool(fraxBondIssuer.address);

        // Approve
        await frax.approve(fraxBondIssuer.address, toWei("1000"));

        await factory.createPair(fxs.address, fxb.address);

        await fxb.addIssuer(owner.address);
        await fxb.issuerMint(owner.address, toWei("1000"));

        // Approve
        await fxb.approve(router.address, toWei('1000'));

        await router.addLiquidity(
            fxs.address,
            fxb.address,
            toWei('1'),
            toWei('100'),
            0,
            0,
            owner.address,
            Math.round(new Date().getTime() + 1000)
        )


    });

    it('test poolRedeem', async function () {

        const REDEEM_FEE = 1e4;

        // await mockChainLink.setAnswer(BigNumber.from(1e18));
        await mockChainLink.setAnswer(BigNumber.from("1000000000000000000"));
        // Set period
        await frax_uniswapOracle.setPeriod(1);
        expect(await frax_uniswapOracle.canUpdate()).to.be.eq(true);
        // Set oracle
        await frax_uniswapOracle.update();
        console.log("frax_price:\t" + await frax.stablePrice());

        // Set redeem fee
        await usdcPool.setPoolParameters(0, 0, 0, 0, 0, REDEEM_FEE, 0);
        redeemPtionFee = await usdcPool.redemptionFee();
        console.log("redeem_fee:\t" + redeemPtionFee);
        latestPrice = await chainlinkETHUSDPriceConsumer.getLatestPrice();
        console.log(latestPrice);
        // expect(parseInt(latestPrice)).to.be.eq(1);

        expect(await usdc_uniswapOracle.PERIOD()).to.be.eq(3600);
        // Set period
        await usdc_uniswapOracle.setPeriod(1);
        expect(await usdc_uniswapOracle.PERIOD()).to.be.eq(1);
        expect(await usdc_uniswapOracle.canUpdate()).to.be.eq(true);
        // expect(await chainlinkETHUSDPriceConsumer.getLatestPrice()).to.be.eq(1);
        // Update MockChainLink value -> test token so can call set function
        // await mockChainLink.setAnswer(BigNumber.from(1e13));
        // expect(await frax.ethUsdPrice()).to.be.eq(10);
        // Get usdc price
        await usdc_uniswapOracle.update();
        colPriceUsd = await usdcPool.getCollateralPrice();
        console.log("col_price_usd:\t" + colPriceUsd);
        // expect(parseInt(colPriceUsd)).to.be.eq(10);
        console.log("price_target:\t" + await frax.priceTarget());
        console.log("price_band:\t" + await frax.priceBand());
        console.log("frax_price:\t" + await frax.stablePrice());
        await frax.refreshCollateralRatio();
        globalCollateralRatio = await frax.globalCollateralRatio();
        console.log("global_collateral_ratio:\t" + globalCollateralRatio)
        // expect(parseInt(globalCollateralRatio)).to.be.eq(1000000);

        // Pool balances
        amoMinterBalanceOfFrax = await frax.balanceOf(amoMinter.address);
        expect(parseInt(amoMinterBalanceOfFrax)).to.be.eq(0);

        // Usdc pool redeemFractionalStable function
        // stockPrice = await frax.stockPrice();
        // Set period
        await fxs_uniswapOracle.setPeriod(1);
        // Set oracle
        await fxs_uniswapOracle.update();
        stockPrice = await frax.stockPrice();
        console.log(stockPrice);

        // Find -> addPool
        let count = await frax.stablePoolAddressCount();
        console.log("1\t" + await frax.ethUsdPrice());

        console.log("usd_price:\t" + await frax.ethUsdPrice());
        expect(parseInt(await frax.stablePoolAddressCount())).to.be.eq(1);
        console.log("owner_collat:\t" + await usdc.balanceOf(owner.address));
        // console.log("2\t" + await usdcPool.collatDollarBalance());

        // Mint usdc amount
        console.log("global_collateral_value:\t" + await frax.globalCollateralValue());
        console.log("1:\t" + await frax.totalSupply());


        console.log("usdc in pool:", (await usdc.balanceOf(usdcPool.address)));
        // todo Stablecoin is automatically generated using the pool
        await usdc.mint(usdcPool.address, toWei('100'));
        console.log("usdc in pool2:", (await usdc.balanceOf(usdcPool.address)));
        await usdc.approve(amoMinter.address, toWei('1'));
        await fxs.mint(amoMinter.address, toWei('1'));
        await fxs.approve(amoMinter.address, toWei('1'));
        //
        expect(parseInt(await fxs.balanceOf(amoMinter.address))).to.be.eq(parseInt(toWei('1')));
        console.log("2");
        // await amoMinter.addAMO(owner.address, true);
        await usdc.mint(amoMinter.address, toWei('1'));
        expect(parseInt(await usdc.balanceOf(amoMinter.address))).to.be.eq(parseInt(toWei('1')));
        await amoMinter.giveCollatToAMO(exchangeAMO.address, "10");

    });

});