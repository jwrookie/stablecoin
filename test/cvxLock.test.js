const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('LockerV2', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        const TestERC20 = await ethers.getContractFactory('TestERC20');
        usdc = await TestERC20.deploy();
        busd = await TestERC20.deploy();
        cvx = await TestERC20.deploy();

        await usdc.mint(owner.address, toWei('1'));
        await busd.mint(owner.address, toWei('1'))
        await cvx.mint(owner.address, toWei('1'))

        const LockerV2 = await ethers.getContractFactory('LockerV2');
        lock = await LockerV2.deploy(cvx.address);
        stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        //  await time.advanceBlockTo(parseInt(stratBlock) + 10);
        const Operatable = await ethers.getContractFactory('Operatable');
        operatable = await Operatable.deploy();
        //
        // const RewardPool = await ethers.getContractFactory('RewardPool');
        // rewardPool = await RewardPool.deploy(operatable.address, "10000", parseInt(stratBlock), 100);


        await lock.setBoost("1000", "10000", dev.address);


    });

    it('lock Info  ', async () => {
        expect(await lock.name()).to.be.eq("Vote Locked Convex Token")
        expect(await lock.symbol()).to.be.eq("vlCVX")
        expect(await lock.decimals()).to.be.eq(18)


    });
    it("rewardWeightOf", async () => {
        stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        await time.advanceBlockTo(parseInt(stratBlock) + 10);
        let info = await lock.epochs(0);
        console.log("supply:" + info[0])
        console.log("date:" + info[1])

        await cvx.approve(lock.address, toWei('1000'))
        console.log("maximumBoostPayment:" + await lock.maximumBoostPayment())
        console.log("nextMaximumBoostPayment:" + await lock.nextMaximumBoostPayment())
        console.log("--------------------------")

        await lock.checkpointEpoch();
        console.log("maximumBoostPayment:" + await lock.maximumBoostPayment())
        console.log("nextMaximumBoostPayment:" + await lock.nextMaximumBoostPayment())
        console.log("---------------------")

        await lock.lock(owner.address, "10000", "1000")
        console.log("rewardWeightOf:" + await lock.rewardWeightOf(owner.address))
        console.log("lockedBalanceOf:" + await lock.lockedBalanceOf(owner.address))
        console.log("balanceOf:" + await lock.balanceOf(owner.address))


        console.log("---------------------")
        info = await lock.epochs(0);
        console.log("supply:" + info[0])
        console.log("date:" + info[1])

        // console.log("totalSupplyAtEpoch:"+await lock.totalSupplyAtEpoch(1))

        console.log("lockedBalances:" + await lock.lockedBalances(owner.address))

        let lockInfo = await lock.userLocks(owner.address, 0)
        console.log("amount:" + lockInfo[0])
        console.log("boosted:" + lockInfo[1])
        console.log("unlockTime:" + lockInfo[2])

        let balance = await lock.balances(owner.address)
        console.log("locked:" + balance[0])
        console.log("boosted:" + balance[1])
        console.log("nextUnlockIndex:" + balance[2])


        //  stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        //  await time.advanceBlockTo(parseInt(stratBlock) + 30);
        // await lock.withdrawExpiredLocksTo(owner.address)


        // await lock.kickExpiredLocks(owner.address)

        // await lock.processExpiredLocks(true)

        console.log("epochCount:"+await lock.epochCount())

        console.log("findEpochId:"+await lock.findEpochId("1658966400"))

    });


});
