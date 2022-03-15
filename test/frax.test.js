const {expectRevert, time} = require('@openzeppelin/test-helpers');
const ethers = require('ethers');
const TestOwnableToken = artifacts.require('TestOwnableToken');
const Timelock = artifacts.require('Timelock');
const FRAXShares = artifacts.require('FRAXShares');
const FRAXStablecoin = artifacts.require('FRAXStablecoin');
const Pool_USDC = artifacts.require('Pool_USDC');
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

        //pool  = await Pool_USDC.new(frax.address,fxs.address,usdc.address,100);

        // let eta = (await time.latest()).add(time.duration.days(4));
        // await timelock.queueTransaction(
        //     timelock.address, '0', 'setDelay(uint256)',
        //     encodeParameters(['uint256'],
        //         ['300000']), eta,
        // );
        // await time.increase(time.duration.days(4));
        // await timelock.executeTransaction(
        //     timelock.address, '0', 'setDelay(uint256)',
        //     encodeParameters(['uint256'],
        //         ['300000']), eta,
        // );
        // assert.equal(await timelock.delay(), "300000");


    });

    it('test', async () => {
        console.log("fxs:" + fxs.address)
        console.log("stablecoin:" + frax.address)


        //console.log("pool:"+pool.address)


    });


});
