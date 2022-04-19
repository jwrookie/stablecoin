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
const TestERC20 = artifacts.require("TestERC20");
const ExchangeAMO = artifacts.require("ExchangeAMO");

contract('ExchangeAMO', async function() {
    const zeroAddr = "0x0000000000000000000000000000000000000000";
    const mockTokenDeployCount = "10";
    const mockTokenOwnerMintCount = "10000";
    const mockTokenDevMintCount = "10";
    const mockTokenApproveCount = "10000";

    let token0;
    let token1;
    let token2;
    let token3;
    let registry;
    let poolRegistry;
    let plain3Balances;
    let crvFactory;
    let exchangeAMO;
    let frax;
    let tempCRVPool;
    let poolAddress;
    let poolTwoAddress;
    let pool;
    let poolTwo;
    let byteArray;
    let usdc;
    let oracle;
    let fax;
    let fraxPoolLibrary;
    let amoMinter;
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
        [owner, dev, addr1] = await ethers.getSigners();

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
            [token0.address, token1.address, token2.address, zeroAddr],
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
        await token1.approve(pool.address, toWei(mockTokenApproveCount));
        await token2.approve(pool.address, toWei(mockTokenApproveCount));

        // Add liquidity
        await pool.add_liquidity([toWei("10"), toWei("10"), toWei("10")], 0);
        
        // Aonter pool
        await crvFactory.deploy_plain_pool(
            "3pool2",
            "3pool2",
            [token0.address, token1.address, token2.address, zeroAddr],
            "2000",
            "4000000", 0, 0
        );
        poolTwoAddress = await crvFactory.pool_list(1, {gasLimit: "1250000"});
        expect(poolTwoAddress).to.be.not.eq(null);
        poolTwo = await plain3Balances.attach(poolTwoAddress);
        expect(parseInt(poolTwo.length)).to.be.not.eq(0);

        // Approve
        await token0.approve(poolTwo.address, toWei(mockTokenApproveCount));
        await token1.approve(poolTwo.address, toWei(mockTokenApproveCount));
        await token2.approve(poolTwo.address, toWei(mockTokenApproveCount));

        // Add liquidity
        await poolTwo.add_liquidity([toWei("1"), toWei("9"), toWei("9")], 0);

        byteArray = await getUint8Array(32);
        expect(parseInt(byteArray.length)).to.be.eq(32);

        await poolRegistry.add_pool_without_underlying(poolAddress, 3, poolAddress, byteArray, 18, 18, true, false, "test", {gasLimit: "1250000"});

        // Collateral
        usdc = await TestERC20.new();
        
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
        pool = await Pool_USDC.deploy(frax.address, fax.address, usdc.address, toWei("10000000000"));

        const AMOMinter = await ethers.getContractFactory("AMOMinter");
        amoMinter = await AMOMinter.deploy(
            owner.address,
            dev.address,
            frax.address,
            fax.address,
            usdc.address,
            pool.address
        );

        exchangeAMO = await ExchangeAMO.new(
            owner.address,
            amoMinter.address,
            frax.address,
            usdc.address,
            token0.address,
            pool.address,
            token1.address
        );
    });

    it('test showAllocations', async function() {
        let allocationsArray = new Array(11);

        // await exchangeAMO.showAllocations();

        // for (var i = 0; i < allocationsArray.length; i++) {
        //     console.log(allocationsArray[i]);
        // }
    });

    it('test usdValueInVault', async function() {
        const targetValue = 1e18;
        let usdValue;

        usdValue = await exchangeAMO.usdValueInVault();
        expect(parseInt(usdValue)).to.be.eq(targetValue);
    });

    it('test fraxFloor', async function() {
        let fraxCollateralRatio;
        let functionReturnRatio;

        fraxCollateralRatio = await frax.globalCollateralRatio();
        functionReturnRatio = await exchangeAMO.fraxFloor();

        console.log(parseInt(functionReturnRatio));

        expect(parseInt(functionReturnRatio)).to.be.eq(parseInt(fraxCollateralRatio));
    });

    it('test metapoolDeposit', async function() {
        let fraxAmount;
        let collateralAmount;
        let metaPoolLpReceived;

        fraxAmount = await frax.balanceOf(owner.address);
        collateralAmount = await usdc.balanceOf(owner.address);

        var tempArray = new Array(3);
        // tempArray[0] = 0;
        tempArray[1] = 1;
        // tempArray[2] = 0;
        var usdcD = await usdc.decimals();
        console.log(parseInt(usdcD));
        console.log(parseInt(await exchangeAMO.missing_decimals()));
        var tempMinLpOut = 1000000 * (10 ** await exchangeAMO.missing_decimals()) * 800000 / 1e6;
        console.log(parseInt(tempMinLpOut));

        // var temp = await initFirstPool.add_liquidity(tempArray, 0);
        // console.log(temp);

        metaPoolLpReceived = await exchangeAMO.metapoolDeposit(toWei("1"), toWei("1"));
        // console.log(metaPoolLpReceived);
    });

    // it('test iterate', async function() {
    //     const mulNumber = 1e18;
    //     const divNumber = 1e6;
    //     let virtualPrice;
    //     let crv3Balance;
    //     let fraxBalance;
    //     let totalBalance;
    //     let fraxCollateralRatio;
    //     let floorPriceFrax;
    //     let frax3CrvPool;

    //     frax3CrvPool = await exchangeAMO.frax3crv_metapool_address();

    //     console.log(frax3CrvPool);

    //     fraxBalance = await frax.balanceOf(frax3CrvPool);
    //     crv3Balance = await token1.balanceOf(frax3CrvPool);
    //     totalBalance = await fraxBalance.add(crv3Balance);

    //     console.log("fraxBalance:\t" + fraxBalance);
    //     console.log("crv3Balnace:\t" + crv3Balance);
    //     console.log("totalBalance:\t" + totalBalance);

    //     fraxCollateralRatio = await exchangeAMO.fraxFloor();

    //     floorPriceFrax = mulNumber * fraxCollateralRatio / divNumber;

    //     // virtualPrice = await initFirstPool.get_dy(0, 1, 1e18, [fraxBalance, crv3Balance]); // over flow -> 180

    //     var temp = await exchangeAMO.iterate();
    //     console.log(temp[0]);

    //     // virtualPrice = await initFirstPool.get_virtual_price();
    //     // console.log(parseInt(virtualPrice));

    //     console.log(parseInt(await initFirstPool.fee({ gasLimit : "1250000" }))); // Call this function fail -> 181

    //     // await exchangeAMO.iterate();
    // });

    it('')
});