const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");

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
        pool = await Pool_USDC.deploy(frax.address, fxs.address, usdc.address, 100);
        assert.equal(await pool.USDC_address(), usdc.address)

        const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
        chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy();


    });

    it('test ', async () => {
        await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address)

        // assert.equal(await frax.isFraxPools(pool.address), false)
        // await frax.addPool(pool.address);
        // assert.equal(await frax.isFraxPools(pool.address), true)
        // //await fxs.poolMint(owner,1000);
        // await frax.mint(owner,1000);
        // console.log("frax:" + await frax.balanceOf(owner))
        // console.log("fxs:" + await fxs.balanceOf(owner))
        // // // await fxs.mint(owner,1000)
        // //  console.log("fxs:"+await fxs.balanceOf(owner))
        // console.log("usdc:" + await usdc.balanceOf(owner))


    });


});
