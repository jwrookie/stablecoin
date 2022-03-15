const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {toWei} = web3.utils;

function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

contract('FRAXStablecoin', ([owner, alice, bob, carol]) => {
    beforeEach(async () => {
        const TestERC20 = await ethers.getContractFactory('TestERC20');
        usdc = await TestERC20.deploy();

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

        // assert.equal(await fxs.balanceOf(owner), toWei('100000000'));
        // assert.equal(await frax.balanceOf(owner), toWei('2000000'));
        // await usdc.mint(owner,toWei('1'))
         await usdc.mint(pool.address,toWei('1'))
        console.log("pool_ceiling:"+await pool.pool_ceiling())


    });

    it('test ', async () => {
        //await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address)

        // assert.equal(await frax.isFraxPools(pool.address), false)
        // await frax.addPool(pool.address);
        // assert.equal(await frax.isFraxPools(pool.address), true)
        // //await fxs.poolMint(owner,1000);
        // await frax.mint(owner,1000);
        // console.log("frax:" + await frax.balanceOf(owner))
        // console.log("fxs:" + await fxs.balanceOf(owner))
        // // // await fxs.mint(owner,1000)
        // //  console.log("fxs:"+await fxs.balanceOf(owner))
        console.log("usdc:" + await usdc.balanceOf(owner))


    });
     it('test mint1t1FRAX ', async () => {
         console.log("ethUsdPrice:"+await frax.ethUsdPrice())
        //console.log("getCollateralPrice:"+await pool.getCollateralPrice())
        //  console.log("usdc:"+await usdc.balanceOf(pool.address))
        //  console.log("unclaimedPoolCollateral:"+await pool.unclaimedPoolCollateral())

        //  //console.log("ethUsdPrice:"+await frax.ethUsdPrice())
        // // console.log("collatDollarBalance:"+await pool.collatDollarBalance())
        // await pool.mint1t1FRAX(toWei('1'),0)
        // assert.equal(await frax.isFraxPools(pool.address), false)
        //
        //  console.log("getLatestPrice:"+await chainlinkETHUSDPriceConsumer.getLatestPrice())
        // await frax.addPool(pool.address);
        // assert.equal(await frax.isFraxPools(pool.address), true)
        // //await fxs.poolMint(owner,1000);
        // await frax.mint(owner,1000);
        // console.log("frax:" + await frax.balanceOf(owner))
        // console.log("fxs:" + await fxs.balanceOf(owner))
        // // // await fxs.mint(owner,1000)
        // //  console.log("fxs:"+await fxs.balanceOf(owner))
        // console.log("usdc:" + await usdc.balanceOf(owner))
         //await pool.mint1t1FRAX("10000000",0)


    });


});
