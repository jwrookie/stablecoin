const {time, expectRevert} = require("@openzeppelin/test-helpers");
const {ethers} = require("hardhat");
const {toWei} = web3.utils;
const {GetRusdAndTra} = require("../Utils/GetStableConfig");
const {deploy} = require("../Src/common");
const LOCKER = require("../mock/Locker.json");
const LOCKERFIRST = require("../mock/LockerFirstAbi.json");
const LOCKERSECOND = require("../mock/LockerSecondAbi.json");

contract('Dao locker specific', async function () {
    const ONE_DAT_DURATION = 86400;

    beforeEach(async function (){
        [owner, dev] = await ethers.getSigners();
        [rusd, tra, , checkOpera] = await GetRusdAndTra();
        await rusd.transfer(dev.address, toWei("0.5"));
        await tra.transfer(dev.address, toWei("0.5"));
    });

    it('Test about safeTransfer by abi', async function () {
        let lockerFirst = await deploy(owner, LOCKER.bytecode, LOCKERFIRST.abi, [checkOpera.address, tra.address, ONE_DAT_DURATION]);

        // Tra will be giving to the user as reward
        await tra.approve(lockerFirst.address, toWei("0.5"));
        await tra.connect(dev).approve(lockerFirst.address, toWei("0.5"));

        await lockerFirst.createLockFor(toWei("0.1"), ONE_DAT_DURATION, owner.address);
        tokenId = await lockerFirst.tokenId();

        transferValue = await web3.eth.abi.encodeParameter("");

        await lockerFirst.safeTransferFrom(
            owner.address,
            dev.address,
            tokenId,
            transferValue
        );
    });

    it('Test about safeTransferSecond by abi', async function () {
        let lockerSecond = await deploy(owner, LOCKER.bytecode, LOCKERSECOND.abi, [checkOpera.address, tra.address, ONE_DAT_DURATION]);

        // Tra will be giving to the user as reward
        await tra.approve(lockerSecond.address, toWei("0.5"));
        await tra.connect(dev).approve(lockerSecond.address, toWei("0.5"));

        await lockerSecond.createLockFor(toWei("0.1"), ONE_DAT_DURATION, owner.address);
        tokenId = await lockerSecond.tokenId();

        await lockerSecond.safeTransferFrom(
            owner.address,
            dev.address,
            tokenId
        );
    });

    it('Test about safeTransfer by abi and transfer to dev but dev is not owner of token id', async function () {
        let lockerFirst = await deploy(owner, LOCKER.bytecode, LOCKERFIRST.abi, [checkOpera.address, tra.address, ONE_DAT_DURATION]);

        // Tra will be giving to the user as reward
        await tra.approve(lockerFirst.address, toWei("0.5"));
        await tra.connect(dev).approve(lockerFirst.address, toWei("0.5"));

        await lockerFirst.createLockFor(toWei("0.1"), ONE_DAT_DURATION, dev.address);
        tokenId = await lockerFirst.tokenId();

        transferValue = await web3.eth.abi.encodeParameter("");

        await expectRevert(lockerFirst.safeTransferFrom(
            owner.address,
            dev.address,
            tokenId,
            transferValue
        ), "no owner");
    });

    it('Test about safeTransferSecond by abi and transfer to dev but dev is not owner of token id', async function () {
        let lockerSecond = await deploy(owner, LOCKER.bytecode, LOCKERSECOND.abi, [checkOpera.address, tra.address, ONE_DAT_DURATION]);

        // Tra will be giving to the user as reward
        await tra.approve(lockerSecond.address, toWei("0.5"));
        await tra.connect(dev).approve(lockerSecond.address, toWei("0.5"));

        await lockerSecond.createLockFor(toWei("0.1"), ONE_DAT_DURATION, dev.address);
        tokenId = await lockerSecond.tokenId();

        await expectRevert(lockerSecond.safeTransferFrom(
            owner.address,
            dev.address,
            tokenId
        ), "no owner");
    });

    it('Test about safeTransfer by contract', async function () {
        const Locker = await ethers.getContractFactory("Locker");
        locker = await Locker.deploy(checkOpera.address, tra.address, ONE_DAT_DURATION);

        // Tra will be giving to the user as reward
        await tra.approve(locker.address, toWei("0.5"));
        await tra.connect(dev).approve(locker.address, toWei("0.5"));

        await locker.createLockFor(toWei("0.1"), ONE_DAT_DURATION, owner.address);
        tokenId = await locker.tokenId();

        try {
            await locker.safeTransferFrom(
                owner.address,
                dev.address,
                tokenId
            );
        }catch (err) {
            expect(err.toString()).to.be.eq("TypeError: locker.safeTransferFrom is not a function");
        }
    });

    it('Test about safeTransfer by contract', async function () {
        const Locker = await ethers.getContractFactory("Locker");
        locker = await Locker.deploy(checkOpera.address, tra.address, ONE_DAT_DURATION);

        // Tra will be giving to the user as reward
        await tra.approve(locker.address, toWei("0.5"));
        await tra.connect(dev).approve(locker.address, toWei("0.5"));

        await locker.createLockFor(toWei("0.1"), ONE_DAT_DURATION, owner.address);
        tokenId = await locker.tokenId();

        transferValue = await web3.eth.abi.encodeParameter("");

        try {
             await locker.safeTransferFrom(
                owner.address,
                dev.address,
                tokenId,
                transferValue
            );
        }catch (err) {
            expect(err.toString()).to.be.eq("TypeError: locker.safeTransferFrom is not a function");
        }
    });
});