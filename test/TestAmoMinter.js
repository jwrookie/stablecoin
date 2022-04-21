/** JSON ABI */
const CRVFactory = require('./mock/mockPool/factory.json');
const FactoryAbi = require('./mock/mockPool/factory_abi.json');
const Plain3Balances = require('./mock/mockPool/Plain3Balances.json');
const PoolAbi = require('./mock/mockPool/3pool_abi.json');
const Registry = require('./mock/mockPool/Registry.json');
const PoolRegistry = require('./mock/mockPool/PoolRegistry.json');
/** EXTERNAL MODULE */
const { deployContract } = require('ethereum-waffle');
const { ethers, artifacts } = require('hardhat');
const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { toWei } = web3.utils;

contract('AMOMinter', async function() {
    const zeroAddr = "0x0000000000000000000000000000000000000000";
    const mockTokenDeployCount = "10";
    const mockTokenOwnerMintCount = "10000";
    const mockTokenDevMintCount = "10";
    const mockTokenApproveCount = "10000";
    const fraxInPool = "1000";

    let initFirstPool;

    async function getUint8Array(len) {
        var buffer = new ArrayBuffer(len); 
        var bufferArray = new Uint8Array(buffer);
        var length = bufferArray.length;
        for (var i = 0; i < length; i++) {
            bufferArray[i] = 0;
        }

        return bufferArray; 
    }

    beforeEach(async function() {
        [owner, dev] = await ethers.getSigners();

        // Inherit ERC20
        const MockToken = await ethers.getContractFactory("MockToken");
        token0 = await MockToken.deploy("token0", "token0", 18, toWei(mockTokenDeployCount));
        token1 = await MockToken.deploy("token1", "token1", 18, toWei(mockTokenDeployCount));
        token2 = await MockToken.deploy("token2", "token2", 18, toWei(mockTokenDeployCount));
        token3 = await MockToken.deploy("token3", "token3", 18, toWei(mockTokenDeployCount));

        await token0.mint(owner.address, toWei(mockTokenOwnerMintCount));
        await token1.mint(owner.address, toWei(mockTokenOwnerMintCount));
        await token2.mint(owner.address, toWei(mockTokenOwnerMintCount));
        await token3.mint(owner.address, toWei(mockTokenOwnerMintCount));

        await token0.mint(dev.address, toWei(mockTokenDevMintCount));
        await token1.mint(dev.address, toWei(mockTokenDevMintCount));
        await token2.mint(dev.address, toWei(mockTokenDevMintCount));
        await token3.mint(dev.address, toWei(mockTokenDevMintCount));

        // TestERC20 -> Collateral
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        usdc = await TestERC20.deploy();

        // Mint
        await usdc.mint(owner.address, toWei(mockTokenOwnerMintCount));
        await usdc.mint(dev.address, toWei(mockTokenDevMintCount));

        // Oracle
        const Oracle = await ethers.getContractFactory("TestOracle");
        oracle = await Oracle.deploy();

        // Fxs and Frax
        const Frax = await ethers.getContractFactory("FRAXStablecoin");
        frax = await Frax.deploy("testName", "testSymbol");
        const Fax = await ethers.getContractFactory("FRAXShares");
        fax = await Fax.deploy("testName", "testSymbol", oracle.address);
        await fax.setFraxAddress(frax.address);
        await frax.setFXSAddress(fax.address);

        await frax.addPool(owner.address);
        await frax.addPool(dev.address);

        await fax.mint(owner.address, toWei("100000"));
        await fax.mint(dev.address, toWei("100000"));

        // Frax pool
        const FraxPoolLibrary = await ethers.getContractFactory("FraxPoolLibrary");
        fraxPoolLibrary = await FraxPoolLibrary.deploy();

        const Pool_USDC = await ethers.getContractFactory('Pool_USDC', {
            libraries: {
                FraxPoolLibrary: fraxPoolLibrary.address,
            },
        });
        usdcPool = await Pool_USDC.deploy(frax.address, fax.address, usdc.address, toWei("10000000000"));

        const AMOMinter = await ethers.getContractFactory("AMOMinter");
        amoMinter = await AMOMinter.deploy(
            owner.address,
            dev.address,
            frax.address,
            fax.address,
            usdc.address,
            usdcPool.address
        );

        // About IStableSwap3Pool and IMetaImplementationUSD
        registry = await deployContract(owner, {
            bytecode: Registry.bytecode,
            abi: Registry.abi
        }, [owner.address]);

        poolRegistry = await deployContract(owner, {
            bytecode: PoolRegistry.bytecode,
            abi: PoolRegistry.abi
        }, [registry.address, zeroAddr]);

        plain3Balances = await deployContract(owner, {
            bytecode: Plain3Balances.bytecode,
            abi: PoolAbi.abi
        });

        crvFactory = await deployContract(owner, {
            bytecode: CRVFactory.bytecode,
            abi: FactoryAbi.abi,
        }, [owner.address, registry.address]);

        // Create three tokens pool ----> set、deploy、approve
        /** Set */
        await registry.set_address(0, poolRegistry.address);
        await crvFactory.set_plain_implementations(
            3, 
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
                zeroAddr,
            ]
        );

        /** Deploy */
        tempCRVPool = await crvFactory.deploy_plain_pool(
            "3pools",
            "3pools",
            [token0.address, frax.address, token2.address, zeroAddr],
            "2000",
            "4000000", 0, 0
        );
        poolAddress = await crvFactory.pool_list(0, {gasLimit: "1250000"});
        expect(poolAddress).to.be.not.eq(null);
        pool = await plain3Balances.attach(poolAddress);
        expect(parseInt(pool.length)).to.be.not.eq(0);
        initFirstPool = pool;
        expect(initFirstPool).to.be.eq(pool);
        expect(poolAddress).to.be.eq(pool.address);

        // Approve
        await token0.approve(pool.address, toWei(mockTokenApproveCount));
        await frax.approve(pool.address, toWei(mockTokenApproveCount));
        await token2.approve(pool.address, toWei(mockTokenApproveCount));

        // Add liquidity
        await pool.add_liquidity([toWei("10"), toWei("10"), toWei("10")], 0);

        // Aonter pool
        await crvFactory.deploy_plain_pool(
            "3pool2",
            "3pool2",
            [token0.address, frax.address, token2.address, zeroAddr],
            "2000",
            "4000000", 0, 0
        );
        poolTwoAddress = await crvFactory.pool_list(1, {gasLimit: "1250000"});
        expect(poolTwoAddress).to.be.not.eq(null);
        poolTwo = await plain3Balances.attach(poolTwoAddress);
        expect(parseInt(poolTwo.length)).to.be.not.eq(0);

        // Approve
        await token0.approve(poolTwo.address, toWei(mockTokenApproveCount));
        await frax.approve(poolTwo.address, toWei(mockTokenApproveCount));
        await token2.approve(poolTwo.address, toWei(mockTokenApproveCount));

        // Add liquidity
        await poolTwo.add_liquidity([toWei("1"), toWei("9"), toWei("9")], 0);

        const ExchangeAMO = await ethers.getContractFactory("ExchangeAMO");
        exchangeAMO = await ExchangeAMO.deploy(
            owner.address,
            amoMinter.address,
            frax.address,
            usdc.address,
            fax.address, // Quetion
            pool.address,
            poolTwo.address // Quetion
        );
    });

    it('test collatDollarBalance', async function() {
        let collatValue;

        collatValue = await amoMinter.collatDollarBalance();
        expect(parseInt(collatValue)).to.be.eq(0);
    });

    it('test dollarBalances', async function() {
        let farxValueE18;
        let collatValueE18;

        farxValueE18, collatValueE18 = await amoMinter.dollarBalances();
        console.log(parseInt(farxValueE18));
        console.log(parseInt(collatValueE18));
        // expect(parseInt(farxValueE18)).to.be.eq(0);
        expect(parseInt(collatValueE18)).to.be.eq(0);
    });

    it('test allAMOAddress、allAMOsLength、', async function() {
        let resultArray = new Array();
        let resultArrayLength;

        resultArray = await amoMinter.allAMOAddresses();
        resultArrayLength = await amoMinter.allAMOsLength();
        expect(resultArrayLength).to.be.eq(0);

        // Add
        // await amoMinter.addAMO(exchangeAMO.address, false);
        // resultArrayLength = await amoMinter.allAMOsLength();
        // expect(resultArrayLength).to.be.eq(1);
    });

    it('test fraxTrackedGlobal', async function() {
        let fraxDollarBalance;
        let fraxTrackedGlobalValue;

        fraxDollarBalance = await amoMinter.fraxDollarBalanceStored();
        expect(parseInt(fraxDollarBalance)).to.be.eq(0);

        fraxTrackedGlobalValue = await amoMinter.fraxTrackedGlobal();
        // expect(parseInt(fraxTrackedGlobalValue)).to.be.eq(0);
    });

    it('test fraxTrackedAMO', async function() {
        // await amoMinter.fraxTrackedAMO(exchangeAMO.address);
    });

    it('test oldPoolRredeem', async function() {
        let redemPtionFee;
        let colPriceUsd;
        let globalCollateralRatio;

        redemPtionFee = await usdcPool.redemption_fee();
        expect(parseInt(redemPtionFee)).to.be.eq(0);
        // colPriceUsd = await usdcPool.getCollateralPrice();
        // console.log(parseInt(colPriceUsd));
        globalCollateralRatio = await frax.globalCollateralRatio();
        expect(parseInt(globalCollateralRatio)).to.be.eq(1000000);
    });
});