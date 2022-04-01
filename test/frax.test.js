const { expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { ethers, waffle } = require("hardhat");
const { toWei } = web3.utils;

function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

contract('FRAXStablecoin', ([owner, alice, bob, carol]) => {
    beforeEach(async () => {
        const TestERC20 = await ethers.getContractFactory('TestERC20');
        usdc = await TestERC20.deploy();
        busd = await TestERC20.deploy();
        weth = await TestERC20.deploy();

        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const Timelock = await ethers.getContractFactory('Timelock');
        timelock = await Timelock.deploy(owner, "259200");

        const FRAXShares = await ethers.getContractFactory('FRAXShares');
        fxs = await FRAXShares.deploy("Test", "Test", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('FRAXStablecoin');
        frax = await FRAXStablecoin.deploy("usdc", "usdc");
        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);

        assert.equal(await fxs.oracle(), oracle.address);
        assert.equal(await frax.fxsAddress(), fxs.address);

        const FraxPoolLibrary = await ethers.getContractFactory('FraxPoolLibrary')
        fraxPoolLibrary = await FraxPoolLibrary.deploy();

        const Pool_USDC = await ethers.getContractFactory('Pool_USDC', {
            libraries: {
                FraxPoolLibrary: fraxPoolLibrary.address,
            },
        });
        pool = await Pool_USDC.deploy(frax.address, fxs.address, usdc.address, toWei('10000000'));
        assert.equal(await pool.USDC_address(), usdc.address)


        const MockChainLink = await ethers.getContractFactory("MockChainLink");
        chainLink = await MockChainLink.deploy();


        const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
        chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);
        await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address)

        assert.equal(await fxs.balanceOf(owner), toWei('100000000'));
        assert.equal(await frax.balanceOf(owner), toWei('2000000'));
        // await usdc.mint(owner,toWei('1'))
        await usdc.mint(pool.address, toWei('1'))
        console.log("pool_ceiling:" + await pool.pool_ceiling())
        console.log("collat_eth_oracle_address:" + await pool.collat_eth_oracle_address())


        const UniV2TWAMMFactory = await ethers.getContractFactory("UniV2TWAMMFactory");
        factory = await UniV2TWAMMFactory.deploy(owner);

        await factory.createPair(usdc.address, busd.address)
        pairAddr = await factory.getPair(usdc.address, busd.address)
        console.log("pair:" + pairAddr)

        // const UniV2TWAMMPair = await ethers.getContractFactory("UniV2TWAMMPair");
        // const pair = await UniV2TWAMMPair.attach(pairAddr)


        const UniV2TWAMMRouter = await ethers.getContractFactory("UniV2TWAMMRouter");
        router = await UniV2TWAMMRouter.deploy(factory.address, weth.address);

        await usdc.approve(router.address, toWei('1000'))
        await busd.approve(router.address, toWei('1000'))
        await usdc.mint(owner, toWei('100'))
        await busd.mint(owner, toWei('100'))


        // await router.addLiquidity(
        //     usdc.address,
        //     busd.address,
        //     toWei('1'),
        //     toWei('1'),
        //     0,
        //     0,
        //     owner,
        //     Math.round(new Date() / 1000 + 1000)

        // )

        // const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
        // uniswapOracle = await UniswapPairOracle.deploy(factory.address,usdc.address,busd.address,owner,timelock.address);
        //

        // await pool.setCollatETHOracle()

        //console.log("collat_eth_oracle_address:"+await pool.collat_eth_oracle_address())


    });

    it('test ', async () => {
        // console.log("Answer:" + await chainLink.answer())
        // console.log("getDecimals:" + await chainlinkETHUSDPriceConsumer.getDecimals())
        // //await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address)

        // assert.equal(await frax.isFraxPools(pool.address), false)
        // await frax.addPool(pool.address);
        // assert.equal(await frax.isFraxPools(pool.address), true)
        // //await fxs.poolMint(owner,1000);
        // await frax.mint(owner,1000);
        // console.log("frax:" + await frax.balanceOf(owner))
        // console.log("fxs:" + await fxs.balanceOf(owner))
        // // // await fxs.mint(owner,1000)
        // //  console.log("fxs:"+await fxs.balanceOf(owner))


    });

    it('should return the correct number of frax pools', async () => {
        await frax.addPool(pool.address);

        const count = await frax.fraxPoolAddressCount()

        expect(count).to.be.eq(1)
    });


});
