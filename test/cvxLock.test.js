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

        const Locker = await ethers.getContractFactory('Locker');
        let eta = time.duration.days(1);
        lock = await Locker.deploy(cvx.address, parseInt(eta));

    });

    it('lock Info  ', async () => {
        expect(await lock.name()).to.be.eq("veNFT");
        expect(await lock.symbol()).to.be.eq("veNFT");
        expect(await lock.decimals()).to.be.eq(18);
        expect(await lock.version()).to.be.eq("1.0.0");
        expect(await lock.token()).to.be.eq(cvx.address);


    });
    it("test create_lock and withdraw", async () => {
        let point = await lock.point_history(0)
        console.log("bias:" + point[0])
        console.log("slope:" + point[1])
        console.log("ts:" + point[2])
        console.log("blk:" + point[3])

        let amountCvx = await cvx.balanceOf(owner.address)
        await cvx.approve(lock.address, toWei('1000'))
        let eta = time.duration.days(1);
        await lock.create_lock("1000", parseInt(eta));

        let amountCvxBef = await cvx.balanceOf(owner.address)

        expect(amountCvxBef).to.be.eq(BigNumber.from(amountCvx).sub("1000"));


        stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        await time.advanceBlockTo(parseInt(stratBlock) + 10);
        //console.log("balanceOfNFT:"+await lock.balanceOfNFT(1))
        //console.log("balanceOfNFTAt:"+await lock.balanceOfNFTAt(1,"1648810870"))


        let lockInfo = await lock.locked(1);
        expect(lockInfo[0]).to.be.eq("1000");
        console.log("end:" + lockInfo[1])

        let eta1 = time.duration.days(2);
        // console.log("balanceOf:" + await lock.balanceOf(owner.address)
        // console.log("get_last_user_slope:" + await lock.get_last_user_slope(1))
        // console.log("user_point_history__ts:" + await lock.user_point_history__ts(1, 0))
        await lock.increase_amount(1, "4000")
        lockInfo = await lock.locked(1);
        expect(lockInfo[0]).to.be.eq("5000");
        let lockBef = lockInfo[1];

        await lock.increase_unlock_time(1, parseInt(eta1));

        lockInfo = await lock.locked(1);
        let lockendAft = +lockInfo[1];
        expect(parseInt(eta)).to.be.eq(lockendAft - lockBef);

        console.log("balanceOfNFT:" + await lock.balanceOfNFT(1))

        await time.increase(time.duration.days(4));
        await lock.withdraw(1);

        let amountCvxAft = await cvx.balanceOf(owner.address);
        lockInfo = await lock.locked(1);
        expect(lockInfo[0]).to.be.eq(0);
        expect(lockInfo[1]).to.be.eq(0);
        expect(amountCvxAft).to.be.eq(BigNumber.from(amountCvxBef).add("1000"));

    });

    it("test create_lock_for and withdraw", async () => {
        await cvx.mint(dev.address, toWei('1'));
        let point = await lock.point_history(0);
        console.log("bias:" + point[0])
        console.log("slope:" + point[1])
        console.log("ts:" + point[2])
        console.log("blk:" + point[3])

        let amountCvx = await cvx.balanceOf(dev.address);
        await cvx.connect(dev).approve(lock.address, toWei('1000'));
        let eta = time.duration.days(1);

        await lock.connect(dev).create_lock_for("1000", parseInt(eta), dev.address);

        let amountCvxBef = await cvx.balanceOf(dev.address);

        expect(amountCvxBef).to.be.eq(BigNumber.from(amountCvx).sub("1000"));

        let lockInfo = await lock.locked(1);
        expect(lockInfo[0]).to.be.eq("1000");
        console.log("end:" + lockInfo[1])

        await time.increase(time.duration.days(4));
        await lock.connect(dev).withdraw(1);

        let amountCvxAft = await cvx.balanceOf(dev.address);
        lockInfo = await lock.locked(1);
        expect(lockInfo[0]).to.be.eq(0);
        expect(lockInfo[1]).to.be.eq(0);
        expect(amountCvxAft).to.be.eq(BigNumber.from(amountCvxBef).add("1000"));

    });


});
