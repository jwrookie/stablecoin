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
        fxs = await TestERC20.deploy();

        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        await usdc.mint(owner.address, toWei('1'));
        await busd.mint(owner.address, toWei('1'));

        const Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();

        const CheckPermission = await ethers.getContractFactory("CheckPermission");
        checkPermission = await CheckPermission.deploy(operatable.address);

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(checkPermission.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(checkPermission.address, "frax", "frax");

        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        const Locker = await ethers.getContractFactory('Locker');
        let eta = time.duration.days(1);
        lock = await Locker.deploy(checkPermission.address, fxs.address, parseInt(eta));

        await fxs.approve(lock.address, toWei('100000'));
        await fxs.transfer(dev.address, toWei('1000'));


    });

    it('lock Info  ', async () => {
        expect(await lock.name()).to.be.eq("veNFT");
        expect(await lock.symbol()).to.be.eq("veNFT");
        expect(await lock.decimals()).to.be.eq(18);
        expect(await lock.version()).to.be.eq("1.0.0");
        expect(await lock.token()).to.be.eq(fxs.address);


    });
    it("test createLock and withdraw", async () => {
        let amountfxs = await fxs.balanceOf(owner.address)
        await fxs.approve(lock.address, toWei('1000'))
        let eta = time.duration.days(1);
        await lock.createLock("1000", parseInt(eta));

        let amountfxsBef = await fxs.balanceOf(owner.address)

        expect(amountfxsBef).to.be.eq(BigNumber.from(amountfxs).sub("1000"));


        stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        await time.advanceBlockTo(parseInt(stratBlock) + 10);

        let lockInfo = await lock.locked(1);
        expect(lockInfo[0]).to.be.eq("1000");

        let eta1 = time.duration.days(2);
        await lock.increaseAmount(1, "4000")
        lockInfo = await lock.locked(1);
        expect(lockInfo[0]).to.be.eq("5000");
        let lockBef = lockInfo[1];

        await lock.increaseUnlockTime(1, parseInt(eta1));

        lockInfo = await lock.locked(1);
        let lockendAft = +lockInfo[1];
        expect(parseInt(eta)).to.be.eq(lockendAft - lockBef);


        await time.increase(time.duration.days(4));
        await lock.withdraw(1);

        let amountfxsAft = await fxs.balanceOf(owner.address);
        lockInfo = await lock.locked(1);
        expect(lockInfo[0]).to.be.eq(0);
        expect(lockInfo[1]).to.be.eq(0);
        expect(amountfxsAft).to.be.eq(BigNumber.from(amountfxsBef).add("1000"));

    });

    it("test createLockFor and withdraw", async () => {

        let amountfxs = await fxs.balanceOf(dev.address);
        await fxs.connect(dev).approve(lock.address, toWei('1000'));
        let eta = time.duration.days(1);

        await lock.connect(dev).createLockFor("1000", parseInt(eta), dev.address);

        let amountfxsBef = await fxs.balanceOf(dev.address);

        expect(amountfxsBef).to.be.eq(BigNumber.from(amountfxs).sub("1000"));

        let lockInfo = await lock.locked(1);
        expect(lockInfo[0]).to.be.eq("1000");

        await time.increase(time.duration.days(4));
        await lock.connect(dev).withdraw(1);

        let amountfxsAft = await fxs.balanceOf(dev.address);
        lockInfo = await lock.locked(1);
        expect(lockInfo[0]).to.be.eq(0);
        expect(lockInfo[1]).to.be.eq(0);
        expect(amountfxsAft).to.be.eq(BigNumber.from(amountfxsBef).add("1000"));

    });


});