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
const {ethers, artifacts} = require('hardhat');
const {expect} = require('chai');
const {BigNumber} = require('ethers');
const {toWei} = web3.utils;

const GAS = {gasLimit: "9550000"};

contract('ExchangeAMO', async function () {
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

        await weth.deposit({value: toWei('100')});

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

        // =========
        await frax.addPool(usdcPool.address);

        await fxs.addPool(owner.address);
        // await fxs.addPool(dev.address);
        // await frax.addPool(owner.address);

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

        await token0.approve(pool.address, toWei("10000"));
        await frax.approve(pool.address, toWei("10000"));
        await token2.approve(pool.address, toWei("10000"));

        await pool.add_liquidity([toWei('100'), toWei('100'), toWei('100')], 0, GAS)

        // ETHOracle
        const MockChainLink = await ethers.getContractFactory("MockChainLink");
        mockChainLink = await MockChainLink.deploy();
        const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
        chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy(mockChainLink.address);
        await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address);

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
        await pool.approve(exchangeAMO.address, toWei("100000"));

        await fxs.mint(exchangeAMO.address, toWei("100000"));
        await token0.approve(exchangeAMO.address, toWei("100000000"));
        await token0.mint(exchangeAMO.address, toWei("100000"));
    });

    it('test showAllocations', async function () {

        await frax.addPool(owner.address);
        await frax.poolMint(exchangeAMO.address, toWei("100"));
        lpOwned = await frax.balanceOf(exchangeAMO.address);
        initLpOwned = lpOwned;
        expect(parseInt(lpOwned)).to.be.not.eq(0);

        expect(parseInt(lpOwned)).to.be.not.eq(parseInt(initLpOwned));

        fraxCrvSupply = await frax.totalSupply();
        expect(parseInt(fraxCrvSupply)).to.be.not.eq(0);
        valueMap = await exchangeAMO.iterate();
        fraxWithDrawAble = await valueMap[0];
        threePoolWithDrawAble = await valueMap[1];
        expect(parseInt(fraxWithDrawAble)).to.be.eq(0);
        expect(parseInt(threePoolWithDrawAble)).to.be.eq(0);
        fraxInContract = await frax.balanceOf(exchangeAMO.address);
        usdcInContract = await usdc.balanceOf(exchangeAMO.address);
        expect(parseInt(usdcInContract)).to.be.eq(0);
        virtualPrice = await pool.get_virtual_price();
        decimals = await pool.decimals(GAS);
        usdcWithDrawAble = threePoolWithDrawAble * (virtualPrice) / 1e18 / 10 ** (18 - decimals);
        usdcSubTotal = usdcInContract + usdcWithDrawAble;

        allocationsArray = await exchangeAMO.showAllocations();

        for (let i = 0; i < allocationsArray.length; i++) {
            console.log(allocationsArray[i]);
        }
    });


    it('test stableFloor', async function () {

        fraxCollateralRatio = await frax.globalCollateralRatio();
        functionReturnRatio = await exchangeAMO.stableFloor();

        console.log(parseInt(functionReturnRatio));

        expect(parseInt(functionReturnRatio)).to.be.eq(parseInt(fraxCollateralRatio));
    });

    it('test metapoolDeposit', async function () {


        fraxAmount = await frax.balanceOf(owner.address);
        collateralAmount = await usdc.balanceOf(owner.address);

        let tempArray = new Array(3);
        tempArray[0] = 0;
        tempArray[1] = toWei("10");
        tempArray[2] = 0;
        let usdcD = await usdc.decimals();
        // console.log(parseInt(await exchangeAMO.missing_decimals()));
        // var tempMinLpOut = 1000000 * (10 ** await exchangeAMO.missing_decimals()) * 800000 / 1e6;
        // console.log(parseInt(tempMinLpOut));

        let temp = await pool.add_liquidity(tempArray, 0);
        // console.log(temp);

        metaPoolLpReceived = await exchangeAMO.metapoolDeposit(toWei("1"), toWei("1")); // Error
        // console.log(metaPoolLpReceived);
    });

    it('test iterate', async function () {


        valueMap = await exchangeAMO.iterate();
        fraxBalance = valueMap[0];
        crvBalance = valueMap[1];
        indexI = valueMap[2];
        factor = valueMap[3];

        console.log("fraxBalance:\t" + fraxBalance);
        console.log("crvBalance:\t" + crvBalance);
        console.log("indexI:\t" + indexI);
        console.log("factor:\t" + factor);
    });

    it('test mintedBalance', async function () {

        amoFraxBalance = await amoMinter.stableMintBalances(exchangeAMO.address);
        expect(parseInt(amoFraxBalance)).to.be.eq(0);

        ownerFraxBalance = await frax.balanceOf(owner.address);
        expect(parseInt(ownerFraxBalance)).to.be.not.eq(0);
        // Mint frax
        sureBoolean = await amoMinter.amos(exchangeAMO.address);
        expect(sureBoolean).to.be.eq(false);
        await amoMinter.addAMO(exchangeAMO.address, true);
        sureBoolean = await amoMinter.amos(exchangeAMO.address);
        expect(sureBoolean).to.be.eq(true);
        amoFraxBalance = await amoMinter.stableMintBalances(exchangeAMO.address);
        expect(parseInt(amoFraxBalance)).to.be.eq(0);
        // expect(parseInt(await exchangeAMO.mintedBalance())).to.be.eq(parseInt(amoFraxBalance));

        ethUsdPrice = await frax.ethUsdPrice();
        console.log("ethUsdPrice:\t" + parseInt(ethUsdPrice));

        // Quetion function
        collatDollarBalance = await amoMinter.collatDollarBalance();
        console.log("coolatDollarBalance:\t" + parseInt(collatDollarBalance));
        await amoMinter.mintStableForAMO(amoMinter.address, toWei("1"));
        amoFraxBalance = await amoMinter.stableMintBalances(amoMinter.address);
        console.log(amoFraxBalance);
    });

    // it('test three_pool_to_collateral', async function () {
    //     // await exchangeAMO.three_pool_to_collateral(300);
    // });

    it('test withdrawCRVRewards', async function () {

        ownerFxsBalance = await fxs.balanceOf(owner.address);
        startFxsBalance = ownerFxsBalance;

        poolFxsBalance = await fxs.balanceOf(exchangeAMO.address);
        initPoolFxsBalance = poolFxsBalance;


    });

    it('test giveCollatBack', async function () {
        let collatBorrowedBalanceInAmoMinter;
        let collatBorrowedSum;

        collatBorrowedBalanceInAmoMinter = await amoMinter.collat_borrowed_balances(amoMinter.address);
        expect(parseInt(collatBorrowedBalanceInAmoMinter)).to.be.eq(0);
        collatBorrowedSum = await amoMinter.collat_borrowed_sum();
        expect(parseInt(collatBorrowedSum)).to.be.eq(0);

        await amoMinter.addAMO(amoMinter.address, true);
        expect(await amoMinter.amos(amoMinter.address)).to.be.eq(true);
        // Call the function will modify collatBoorowedBalance and collatBorrowedSum
        // await exchangeAMO.giveCollatBack(toWei("1")); // This function can not through modifier validAMO
        collatBorrowedBalanceInAmoMinter = await amoMinter.collat_borrowed_balances(amoMinter.address);
        expect(parseInt(collatBorrowedBalanceInAmoMinter)).to.be.eq(0);
        collatBorrowedSum = await amoMinter.collat_borrowed_sum();
        expect(parseInt(collatBorrowedSum)).to.be.eq(0);
    });

    it('test burnStable', async function () {
        // await exchangeAMO.burnStable(toWei("1"));
    });

    it('test setConvergenceWindow', async function () {
        let initConverGence;
        let currentConverGence;

        initConverGence = await exchangeAMO.convergenceWindow();
        await exchangeAMO.setConvergenceWindow(10000);
        currentConverGence = await exchangeAMO.convergenceWindow();
        expect(currentConverGence).to.be.eq(10000);
    });

    it('test setCustomFloor', async function () {

    });
});