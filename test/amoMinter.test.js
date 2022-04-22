const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');

const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');
const gas = {gasLimit: "9550000"};

const WETH = require('../test/mock/WETH9.json');
const Factory = require('../test/mock/PancakeFactory.json');
const Router = require('../test/mock/PancakeRouter.json');
const CRVFactory = require('./mock/mockPool/factory.json');
const FactoryAbi = require('./mock/mockPool/factory_abi.json');
const Plain3Balances = require('./mock/mockPool/Plain3Balances.json');
const PoolAbi = require('./mock/mockPool/3pool_abi.json');
const Registry = require("./mock/mockPool/Registry.json");
const PoolRegistry = require("./mock/mockPool/PoolRegistry.json");

contract('AMOMinter', () => {
    beforeEach(async () => {
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


        let lastBlock = await time.latestBlock();
        //console.log("lastBlock:" + lastBlock);

        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);

        const FraxPoolLibrary = await ethers.getContractFactory('FraxPoolLibrary')
        fraxPoolLibrary = await FraxPoolLibrary.deploy();

        const Pool_USDC = await ethers.getContractFactory('Pool_USDC', {
            libraries: {
                FraxPoolLibrary: fraxPoolLibrary.address,
            },
        });
        pool_usdc = await Pool_USDC.deploy(frax.address, fxs.address, usdc.address, toWei('10000000000'));
        expect(await pool_usdc.USDC_address()).to.be.eq(usdc.address);


        await frax.addPool(pool_usdc.address);

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
            "4000000", 0, 0, gas);

        poolAddress = await crvFactory.pool_list(0, gas);

        pool = await plain3Balances.attach(poolAddress);

        await token0.approve(pool.address, toWei("10000"))
        await frax.approve(pool.address, toWei("10000"))
        await token2.approve(pool.address, toWei("10000"))

        await pool.add_liquidity([toWei('100'), toWei('100'), toWei('100')], 0, gas)


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
        await pool_usdc.setCollatETHOracle(usdc_uniswapOracle.address, weth.address);

        frax_uniswapOracle = await UniswapPairOracle.deploy(factory.address, frax.address, weth.address, owner.address, timelock.address);
        await frax.setFRAXEthOracle(frax_uniswapOracle.address, weth.address);
        expect(await frax.fraxEthOracleAddress()).to.be.eq(frax_uniswapOracle.address);

        fxs_uniswapOracle = await UniswapPairOracle.deploy(factory.address, fxs.address, weth.address, owner.address, timelock.address);
        await frax.setFXSEthOracle(fxs_uniswapOracle.address, weth.address);
        expect(await frax.fxsEthOracleAddress()).to.be.eq(fxs_uniswapOracle.address);

        const AMOMinter = await ethers.getContractFactory('AMOMinter');
        minter = await AMOMinter.deploy(
            owner.address,
            dev.address,
            frax.address,
            fxs.address,
            usdc.address,
            pool_usdc.address
        );

        const ExchangeAMO = await ethers.getContractFactory('ExchangeAMO');
        exchangeAMO = await ExchangeAMO.deploy(
            owner.address,
            minter.address,
            frax.address,
            usdc.address,
            fxs.address,
            pool.address,
            frax.address
        );
          await fxs.addPool(exchangeAMO.address)
         await fxs.addPool(minter.address)


    });
    // it('should two users getReward correct', async () => {
    //     await minter.addAMO(exchangeAMO.address, true)
    //     expect(await minter.allAMOsLength()).to.be.eq(1)
    //
    //     assert.equal(await minter.allAMOAddresses(), exchangeAMO.address)
    //
    //     // await minter.removeAMO(exchangeAMO.address,true)
    //     //   expect(await minter.allAMOsLength()).to.be.eq(0)
    //     //   assert.equal(await minter.allAMOAddresses(),0)
    //
    //     console.log("collatDollarBalance:" + await minter.collatDollarBalance())
    //     let info = await minter.dollarBalances()
    //     console.log("fraxDollarBalanceStored:" + info[0])
    //
    //     console.log("collatDollarBalanceStored:" + info[1])
    //
    //
    //     // console.log("dollarBalances:" + await minter.dollarBalances())
    //
    //     console.log("fraxTrackedGlobal:" + await minter.fraxTrackedGlobal())
    //
    //     console.log("fraxTrackedAMO:" + await minter.fraxTrackedAMO(exchangeAMO.address))
    // });
    // it("test", async () => {
    //     await minter.addAMO(exchangeAMO.address, true)
    //     let info = await exchangeAMO.showAllocations()
    //     console.log("frax_in_contract:" + info[0])
    //     console.log("frax_withdrawable:" + info[1])
    //     console.log("frax_withdrawable1:" + info[2])
    //     console.log("usdc_in_contract:" + info[3])
    //     console.log("usdc_withdrawable:" + info[4])
    //     console.log("usdc_subtotal:" + info[5])
    //     console.log("usdc_subtotal1:" + info[6])
    //     console.log("lp_owned:" + info[7])
    //     console.log("frax3crv_supply:" + info[8])
    //     console.log("_3pool_withdrawable:" + info[9])
    //     console.log("lp_value_in_vault:" + info[10])
    //
    //     console.log("frax_mint_balances bef:" + await minter.frax_mint_balances(exchangeAMO.address))
    //
    //     await exchangeAMO.mintedBalance()
    //
    //
    //     console.log("frax_mint_balances aft:" + await minter.frax_mint_balances(exchangeAMO.address))
    //
    //     console.log("fraxDiscountRate:" + await exchangeAMO.fraxDiscountRate())
    //
    //     console.log("fraxFloor:" + await exchangeAMO.fraxFloor())
    //
    //     let temp = await exchangeAMO.dollarBalances()
    //
    //     console.log("frax_val_e18:" + temp[0])
    //     console.log("collat_val_e18:" + temp[1])
    //
    // });
    it('test mintFraxForAMO', async function () {
        //await frax.setRefreshCooldown(1)


        await usdc_uniswapOracle.setPeriod(1);
        await usdc_uniswapOracle.update();

        await frax_uniswapOracle.setPeriod(1);
        await frax_uniswapOracle.update();

        await fxs_uniswapOracle.setPeriod(1);
        await fxs_uniswapOracle.update();

          await frax.setFraxStep("250000");
        await frax.refreshCollateralRatio();

          console.log("globalCollateralRatio:"+await frax.globalCollateralRatio());




       //   await pool_usdc.mintFractionalFRAX(toWei('10000000'), toWei('10000000'), 0);
        //      await pool_usdc.recollateralizeFRAX(toWei('1000'), "100");
        //
        //        console.log("frax:" + await frax.globalCollateralValue());
        // console.log("fraxSupply:" + await frax.totalSupply());


        //await minter.mintFraxForAMO(exchangeAMO.address, toWei("100"));
        // fraxMintBalance = await amoMinter.frax_mint_balances(exchangeAMO.address);
        // console.log(fraxMintBalance);
        // fraxMintSum = await amoMinter.frax_mint_sum();
        // expect(parseInt(fraxMintSum)).to.be.eq(parseInt(toWei("100")));
    });


});