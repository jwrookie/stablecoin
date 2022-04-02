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
        lock = await Locker.deploy(cvx.address);
        stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        //  await time.advanceBlockTo(parseInt(stratBlock) + 10);
        const Operatable = await ethers.getContractFactory('Operatable');
        operatable = await Operatable.deploy();
        //
        // const RewardPool = await ethers.getContractFactory('RewardPool');
        // rewardPool = await RewardPool.deploy(operatable.address, "10000", parseInt(stratBlock), 100);



       // await  cvx.mint(lock.address,toWei('1000'))


    });

    it('lock Info  ', async () => {
        expect(await lock.name()).to.be.eq("veNFT")
        expect(await lock.symbol()).to.be.eq("veNFT")
        expect(await lock.decimals()).to.be.eq(18)
         expect(await lock.version()).to.be.eq("1.0.0")


    });
    it("deposit_for", async () => {

      let point  = await lock.point_history(0)
        console.log("bias:"+point[0] )
          console.log("slope:"+point[1])
          console.log("ts:"+point[2])
          console.log("blk:"+point[3])

        //  stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
         //await time.advanceBlockTo(parseInt(stratBlock) + 10);
                // let eta = (await time.latest()).add(time.duration.days(1));
    //  console.log("eta:"+eta)
        await cvx.approve(lock.address,toWei('1000'))

     await lock.create_lock("1000","1000000")
       // await lock.deposit_for(1,1000)


        //console.log("balanceOfNFT:"+await lock.balanceOfNFT(1))


       //console.log("balanceOfNFTAt:"+await lock.balanceOfNFTAt(1,"1648810870"))

       // console.log("tokenURI:"+await lock.tokenURI(1))


       let lockInfo =  await lock.locked(1)
        console.log("amount:"+lockInfo[0])
         console.log("end:"+lockInfo[1])

        console.log("balanceOf:"+await lock.balanceOf(owner.address))

        console.log("locked__end:"+await lock.locked__end(1))

        console.log("latest:"+await time.latest())
       let eta = (await time.latest()).add(time.duration.days(4));

      console.log("eta:"+eta)
        await lock.withdraw(1)




    });


});
