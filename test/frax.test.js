const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const TestOwnableToken = artifacts.require('TestOwnableToken');
const FraxPoolLibrary = artifacts.require('FraxPoolLibrary');
const Timelock = artifacts.require('Timelock');
const FRAXShares = artifacts.require('FRAXShares');
const FRAXStablecoin = artifacts.require('FRAXStablecoin');
// const Pool_USDC = artifacts.require('Pool_USDC');
const TestERC20 = artifacts.require('TestERC20');
const TestOracle = artifacts.require('TestOracle')


function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

contract('FRAXStablecoin', ([owner, alice, bob, carol]) => {
    beforeEach(async () => {
        usdc = await TestERC20.new();
        oracle = await TestOracle.new();

        timelock = await Timelock.new(owner, '259200');
        zeroAddress = "0x";
        fxs = await FRAXShares.new("Test", "Test", oracle.address)

        frax = await FRAXStablecoin.new("usdc", "usdc");
        await fxs.setFraxAddress(frax.address);

        assert.equal(await fxs.oracle(), oracle.address);
        // assert.equal(await frax.fxsAddress(),fxs.address);
        //   console.log("")
        fraxPoolLibrary = await FraxPoolLibrary.new();
        // await Pool_USDC.link( fraxPoolLibrary.address)

        Pool_USDC= await ethers.getContractFactory('Pool_USDC', {
            libraries: {
                FraxPoolLibrary: fraxPoolLibrary.address,
            },
        });



        pool  = await Pool_USDC.deploy(frax.address,fxs.address,usdc.address,100);



    });

    it('test', async () => {
        console.log("fxs:" + fxs.address)
        console.log("stablecoin:" + frax.address)


        console.log("pool:"+pool.address)


    });


});
