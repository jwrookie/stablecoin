const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('Locker', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        const TestERC20 = await ethers.getContractFactory('TestERC20');
        usdc = await TestERC20.deploy();
        busd = await TestERC20.deploy();
        cvx = await TestERC20.deploy();

        await usdc.mint(owner.address, toWei('1'));
        await busd.mint(owner.address, toWei('1'))
        await cvx.mint(owner.address, toWei('1'))


        let eta = time.duration.days(1);
        Locker = await ethers.getContractFactory('Locker');
        locker = await Locker.deploy(cvx.address, parseInt(eta));

    });

    it('lock Info  ', async () => {
        // await locker.setVoter(owner.address);
        attachment = await locker.attachments("0");
        assert.equal(attachment, 0);
        await locker.used("1");
        testAtt = await locker.attachments("1");
        assert.equal(testAtt, 1);


    });


});
